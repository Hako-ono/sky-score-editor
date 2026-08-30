import { GRID_MIDI_NOTES, SINGLE_GRID_PLAY_SEC } from '../constants/config.js';
import { getAudibleKeys } from './scoreLayers.js';
import { DEBUG_ENABLED } from './debugFlag.js';
import {
  recordPlaybackScheduleMetrics,
  recordPlaybackStopMetrics,
} from './debugMetrics.js';

// public/audio/salamander/ に自前ホスト。BASE_URL を挟むことでサブパス配信でも解決できる。
const SALAMANDER_URL = `${import.meta.env.BASE_URL}audio/salamander/`;

// 視覚変化を先に認識してから音を受け取れるよう、連続再生では発音だけを少し遅らせる。
// Tone.Draw側は遅らせないため、追加のタイマーやコールバックは発生しない。
const PLAYBACK_AUDIO_DELAY_SEC = 0.05;

class AudioEngine {
  constructor() {
    this.sampler = null;
    this.isReady = false;
    this.Tone = null;
    this.initPromise = null; // 重複読み込み防止用のプロミス
    this.tonePromise = null; // tone チャンクの取得。先読みと本読みで共有する
    this.rawContext = null;  // ユーザー操作の中で起こした AudioContext
    this.contextAttached = false;
    // 予約済みのコールバックはこのフィールドを発火時に読む。引数として
    // クロージャに閉じ込めると、一時停止中にキーを変えても resume() は
    // イベントを登録し直さないため古い値のまま発音してしまう。
    this.transposeSemitones = 0;
    this.tempoBpm = 120;
    this.playbackSession = null;
    // 停止処理のフォールバック用タイマー（stop() の「壊しやすい点」参照）
    this.stopFallbackId = null;
    // AudioContext.state の変化を外部（usePlayback）へ配るための購読者集合。
    // rawContext 自体は unlock() がユーザー操作の中で作るため未生成のことがあり、
    // その場合でも購読だけは先に受け付けておく（rawContext 生成時にリスナを張る）。
    this.contextStateListeners = new Set();
    this.metronomeSynth = null;
    this.metronomeEnabled = false;
    this.metronomeVolume = 'medium';
    this.metronomeBeatsPerBar = 4;
    this.metronomeGridsPerBeat = 4;
    this.metronomeAccentEnabled = true;
    // rawContext ごとに1つだけ張るネイティブ側の statechange リスナ。
    // 購読者が増えてもここは増やさず、この1つが全購読者へ通知する。
    this._handleContextStateChange = this._handleContextStateChange.bind(this);
  }

  _handleContextStateChange() {
    const state = this.getContextState();
    this.contextStateListeners.forEach((cb) => cb(state));
  }

  onContextStateChange(callback) {
    this.contextStateListeners.add(callback);
    return () => this.contextStateListeners.delete(callback);
  }

  getContextState() {
    return this.rawContext ? this.rawContext.state : null;
  }

  clearStopFallback() {
    if (this.stopFallbackId !== null) {
      clearTimeout(this.stopFallbackId);
      this.stopFallbackId = null;
    }
  }

  setTranspose(semitones) {
    this.transposeSemitones = Number.isFinite(semitones) ? semitones : 0;
  }

  setTempo(bpm) {
    this.tempoBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
    if (this.Tone) {
      const transport = this.Tone.getTransport();
      if (transport.bpm) transport.bpm.value = this.tempoBpm;
    }
  }

  setMetronomeConfig({ enabled, volume, beatsPerBar, gridsPerBeat }) {
    this.metronomeEnabled = enabled === true;
    this.metronomeVolume = ['low', 'medium', 'high'].includes(volume)
      ? volume
      : 'medium';
    this.metronomeAccentEnabled = beatsPerBar === 3 || beatsPerBar === 4;
    this.metronomeBeatsPerBar = beatsPerBar === 3 ? 3 : 4;
    // 1拍を何グリッドで数えるか。BPMはグリッドの間隔なので、4なら BPM÷4、
    // 2なら BPM÷2 の速さでクリックが鳴る
    this.metronomeGridsPerBeat = gridsPerBeat === 2 ? 2 : 4;
  }

  ensureMetronomeSynth() {
    if (this.metronomeSynth || !this.Tone) return;
    this.metronomeSynth = new this.Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.025 },
    }).toDestination();
  }

  triggerMetronome(time, accent, volume = this.metronomeVolume) {
    this.ensureMetronomeSynth();
    if (!this.metronomeSynth) return;
    const volumeDb = { low: -24, medium: -17, high: -10 }[volume] ?? -17;
    this.metronomeSynth.volume.value = volumeDb;
    this.metronomeSynth.triggerAttackRelease(accent ? 1320 : 920, 0.045, time);
  }

  // tone は約340KB の別チャンクで、初回タップ時に取りに行くと iOS では
  // ダウンロード中にユーザー操作の有効期間が切れる（unlock() のコメント参照）。
  // 先読みと本読みで同じプロミスを共有し、二重取得を防ぐ。
  loadTone() {
    if (!this.tonePromise) {
      this.tonePromise = import('tone').catch((err) => {
        this.tonePromise = null; // 失敗しても次のタップでやり直せるようにする
        throw err;
      });
    }
    return this.tonePromise;
  }

  preload() {
    this.loadTone().catch(() => {
      // 先読みの失敗はここでは扱わない。実際に再生するとき init() が改めて試み、
      // そちらで利用者向けのエラー表示まで行う
    });
  }

  // iOS Safari は、ユーザー操作から離れたタスクで AudioContext を resume しても
  // suspended のままにする。init() は tone の動的 import を待つため、その await を
  // 越えた先で Tone.start() を呼んでも間に合わない。
  // このメソッドは await を一切挟まず、タップと同じタスクで完了しきること。
  unlock() {
    try {
      if (this.rawContext) {
        // 他タブへの切り替えなどで suspended に戻ることがあるため毎回見る
        if (this.rawContext.state !== 'running') this.rawContext.resume();
        return;
      }
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.rawContext = new Ctor();
      // 購読者への通知はこの1リスナ経由。rawContext を作り直すことはないため
      // （早期returnの分岐がある限り）張り直しは発生しない
      this.rawContext.addEventListener('statechange', this._handleContextStateChange);
      this.rawContext.resume();
      // iOS では無音を1つ通すまで出力が有効にならないことがある
      const source = this.rawContext.createBufferSource();
      source.buffer = this.rawContext.createBuffer(1, 1, this.rawContext.sampleRate);
      source.connect(this.rawContext.destination);
      source.start(0);
    } catch (e) {
      // 生成に失敗しても再生自体は試みる。その場合 Tone が自前のコンテキストを使う。
      // 生成済みの rawContext を捨てる前にリスナを外し、参照だけが残らないようにする
      if (this.rawContext) {
        this.rawContext.removeEventListener('statechange', this._handleContextStateChange);
      }
      this.rawContext = null;
    }
  }

  async init() {
    // await より前に呼ぶこと。ここがユーザー操作と同じタスクである最後の地点。
    this.unlock();

    if (this.isReady) return;
    if (this.initPromise) return this.initPromise; // 既に読み込み中ならそれを待つ

    this.initPromise = (async () => {
      this.Tone = await this.loadTone();

      // tone は import しただけで自前の AudioContext を作る（index.js が
      // トップレベルで getContext() を呼ぶ）。それはユーザー操作の外で
      // 生成されたもので iOS では起きないため、unlock() で起こしておいた
      // コンテキストに差し替える。第2引数の true は用済みの側を閉じるため。
      if (this.rawContext && !this.contextAttached) {
        this.Tone.setContext(this.rawContext, true);
        this.contextAttached = true;
      }

      await this.Tone.start();
      this.Tone.getContext().lookAhead = 0.1;

      return new Promise((resolve, reject) => {
        this.sampler = new this.Tone.Sampler({
          // 使用音域は C4〜C6、トランスポーズ最大+11半音で実質 C4〜B6。
          // サンプラーが補間するため、この12ファイルで足りる。
          urls: {
            C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3',
            C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3',
            C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', A6: 'A6.mp3',
          },
          baseUrl: SALAMANDER_URL,
          attack: 0.01,
          release: 0.8,
          maxPolyphony: 32,
          onload: () => {
            this.isReady = true;
            resolve();
          },
          onerror: reject,
        }).toDestination();
      });
    })().catch((err) => {
      this.initPromise = null;
      this.sampler = null;
      throw err;
    });

    return this.initPromise;
  }

  stop() {
    const t0 = DEBUG_ENABLED ? performance.now() : 0;
    // Tone の読み込み状態とタイマーの生死は無関係なため、!this.Tone のガードより前に置く
    this.clearStopFallback();
    this.playbackSession = null;
    if (!this.Tone) return;
    this.Tone.getContext().lookAhead = 0.1;
    this.Tone.getTransport().stop();
    this.Tone.getTransport().cancel();
    this.Tone.getTransport().loop = false;
    this.Tone.getDraw().cancel();
    // triggerAttackRelease で発音済みの音は Transport の stop/cancel では消えない
    // （AudioContext 自身の時計で release されるため）。cancel の後に呼ぶことで、
    // cancel 前にスケジュールされていた音が releaseAll 直後に鳴り出すのを防ぐ
    if (this.sampler) this.sampler.releaseAll();
    if (DEBUG_ENABLED) recordPlaybackStopMetrics(performance.now() - t0);
  }

  pause() {
    if (!this.Tone) return;
    this.Tone.getTransport().pause();
  }

  resume() {
    if (!this.Tone) return;
    this.Tone.getTransport().start();
  }

  disableLoop() {
    if (!this.Tone) return;
    this.Tone.getTransport().loop = false;
  }

  enableLoop() {
    if (!this.Tone || !this.playbackSession) return;
    const transport = this.Tone.getTransport();
    transport.loopStart = `${this.playbackSession.playbackStartTicks}i`;
    transport.loopEnd = `${this.playbackSession.playbackEndTicks}i`;
    transport.loop = true;
  }

  // `?debug=1` の診断オーバレイ専用の読み出し。副作用は持たない。
  // rawContext は Tone の Context クラスが公開する「ラップ前のネイティブ
  // AudioContext/OfflineAudioContext」を返す getter（`[コード実測]`
  // node_modules/tone/build/esm/core/context/Context.js）。
  getDebugSnapshot() {
    if (!this.Tone) {
      return {
        audioContextState: null,
        transportState: null,
        transportSeconds: null,
        transportEventCount: null,
      };
    }
    const transport = this.Tone.getTransport();
    return {
      audioContextState: this.Tone.getContext().rawContext.state,
      transportState: transport.state,
      transportSeconds: transport.seconds,
      // Tone.js 15.1.22 の Timeline.length getter。Object.keys(_scheduledEvents)は
      // 10,000件の配列を250msごとに作るため、診断自体が負荷源になる。
      transportEventCount: Number.isFinite(transport._timeline?.length)
        ? transport._timeline.length
        : null,
    };
  }

  playGridDirect(keys, transposeSemitones) {
    const audibleKeys = getAudibleKeys({ keys });
    if (!this.isReady || audibleKeys.length === 0) return;
    const freqs = audibleKeys.map(k =>
      this.Tone.Frequency(GRID_MIDI_NOTES[k] + transposeSemitones, 'midi').toNote()
    );
    // 発音時刻を Tone.now() + 0.02 にして遅延を無くす
    this.sampler.triggerAttackRelease(freqs, SINGLE_GRID_PLAY_SEC, this.Tone.now() + 0.02);
  }

  schedule(
    grids,
    bpm,
    transposeSemitones,
    startIndex,
    onUpdateIndex,
    onStop,
    {
      endIndex = grids.length - 1,
      loop = false,
      countIn = null,
      onPlaybackStart = null,
    } = {},
  ) {
    this.stop(); // 既存のスケジュールをリセット
    const scheduleT0 = DEBUG_ENABLED ? performance.now() : 0;
    this.transposeSemitones = transposeSemitones;

    this.Tone.getContext().lookAhead = 0.3;

    const transport = this.Tone.getTransport();
    const draw = this.Tone.getDraw();
    this.setTempo(bpm);
    const gridTicks = transport.PPQ;
    const countInBeats = Number.isInteger(countIn?.beats) && countIn.beats > 0
      ? countIn.beats
      : 0;
    // カウントインの1拍も、メトロノームと同じ「何グリッドで1拍か」で数える。
    // ここだけ 4 固定にすると、テンポを BPM÷2 にしたときにカウントだけ半分の
    // 速さになり、数えた拍と本編の拍が合わない
    const countInGridsPerBeat = countIn?.gridsPerBeat === 2 ? 2 : 4;
    const countInBeatTicks = countInGridsPerBeat * gridTicks;
    const playbackStartTicks = countInBeats * countInBeatTicks;
    const countInBeatsPerBar = countIn?.beatsPerBar === 3 ? 3 : 4;
    const countInAccentEnabled = countIn?.accentEnabled !== false;
    const safeStartIndex = Math.max(0, Math.min(startIndex, grids.length - 1));
    const safeEndIndex = Math.max(
      safeStartIndex,
      Math.min(endIndex, grids.length - 1),
    );
    const segmentLength = safeEndIndex - safeStartIndex + 1;
    const playbackEndTicks = playbackStartTicks + segmentLength * gridTicks;
    this.playbackSession = {
      playbackStartTicks,
      playbackEndTicks,
      playbackStarted: false,
    };

    if (countIn) {
      this.metronomeBeatsPerBar = countInBeatsPerBar;
      this.metronomeAccentEnabled = countInAccentEnabled;
      this.metronomeGridsPerBeat = countInGridsPerBeat;
    }

    if (loop) {
      this.enableLoop();
    }

    // カウントと本再生をTransport開始前にまとめて予約する。カウント終了後に
    // schedule()を呼び直すと、その再構築時間が境界へそのまま上乗せされるため。
    // クリックもピアノと同じ50msオフセットへ置き、両方の音の位相を揃える。
    for (let index = 0; index < countInBeats; index += 1) {
      transport.scheduleOnce((time) => {
        const soundTime = time + PLAYBACK_AUDIO_DELAY_SEC;
        const beatsPerBar = this.metronomeBeatsPerBar;
        this.triggerMetronome(
          soundTime,
          this.metronomeAccentEnabled && index % beatsPerBar === 0,
          countIn.volume,
        );
        draw.schedule(
          () => countIn.onCount?.((index % beatsPerBar) + 1),
          soundTime,
        );
      }, `${index * countInBeatTicks}i`);
    }

    // 全グリッドを個別に予約せず、PPQ tickごとの1本の反復イベントから現在位置を
    // 導出する。発火回数を状態として持たないため、ループ周回やBPM変更の前後でも
    // 同じTransport tickは必ず同じグリッドを指す。
    transport.scheduleRepeat((time) => {
      const ticks = Math.round(transport.getTicksAtTime(time));
      const gridPosition = Math.round((ticks - playbackStartTicks) / gridTicks);
      if (gridPosition < 0 || gridPosition >= segmentLength) return;

      const index = safeStartIndex + gridPosition;
      const audibleKeys = getAudibleKeys(grids[index]);
      if (this.metronomeEnabled && gridPosition % this.metronomeGridsPerBeat === 0) {
        const beatPosition = gridPosition / this.metronomeGridsPerBeat;
        this.triggerMetronome(
          time + PLAYBACK_AUDIO_DELAY_SEC,
          this.metronomeAccentEnabled
            && beatPosition % this.metronomeBeatsPerBar === 0,
        );
      }
      if (audibleKeys.length > 0) {
        const freqs = audibleKeys.map(k =>
          this.Tone.Frequency(GRID_MIDI_NOTES[k] + this.transposeSemitones, 'midi').toNote()
        );
        const playDuration = Math.max(60 / this.tempoBpm, 0.4);
        this.sampler.triggerAttackRelease(
          freqs,
          playDuration,
          time + PLAYBACK_AUDIO_DELAY_SEC,
        );
      }
      draw.schedule(() => {
        if (!this.playbackSession?.playbackStarted) {
          if (this.playbackSession) this.playbackSession.playbackStarted = true;
          onPlaybackStart?.();
        }
        onUpdateIndex(index);
      }, time);
    }, `${gridTicks}i`, `${playbackStartTicks}i`, `${segmentLength * gridTicks}i`);

    // 停止処理は Tone.Draw（rAF駆動）に載せている。発音より最大 lookAhead ぶん
    // 早く来る Transport のコールバックで直接止めると最後の音が切れるため。
    // ただし Draw は期限(0.25秒)を過ぎたコールバックを実行せずに捨てるので、
    // タブが裏に回るなどで rAF が止まると停止処理が永久に失われる。時間で追う
    // 経路を併走させ、先に来たほうだけが実行されるようにする。
    // loopEndと同じtickに永続イベントを置く。ループ中はToneがイベント実行より先に
    // loopStartへ戻すため発火せず、ループ解除後は次の区間末尾で発火する。
    transport.schedule((time) => {
      let done = false;
      const finish = () => {
        if (done) return;
        if (transport.loop) {
          this.clearStopFallback();
          return;
        }
        done = true;
        this.clearStopFallback();
        this.Tone.getContext().lookAhead = 0.1;
        onStop();
      };
      const finishTime = time + PLAYBACK_AUDIO_DELAY_SEC;
      draw.schedule(finish, finishTime);
      // Tone.now() は lookAhead を足した値を返すため使わない。Draw が捨てる
      // 境界（time + 0.25）より後ろに置き、通常は Draw が先に来るようにする
      const delayMs =
        Math.max(0, (finishTime - this.Tone.getContext().currentTime) * 1000) + 300;
      this.stopFallbackId = setTimeout(finish, delayMs);
    }, `${playbackEndTicks}i`);

    transport.start();
    if (DEBUG_ENABLED) {
      recordPlaybackScheduleMetrics({
        durationMs: performance.now() - scheduleT0,
        gridCount: segmentLength,
        eventCount: countInBeats + 2,
        loop,
      });
    }
  }
}

export const audioEngine = new AudioEngine();
