import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { audioEngine } from '../lib/audioEngine.js';
import { SINGLE_GRID_PLAY_SEC } from '../constants/config.js';
import { useActiveGridStore } from '../contexts/ActiveGridContext.jsx';
import { getAudibleKeys } from '../lib/scoreLayers.js';
import { selectedRange } from '../lib/rangeSelectionStore.js';
import { beatsPerBarForBits } from '../lib/layout.js';

function rangeToken(range) {
  return range ? `${range.start}:${range.end}` : null;
}

export function usePlayback(
  grids,
  bpm,
  pitchLevel,
  showStatus,
  dismissStatus,
  loopEnabled = false,
  rangeStore,
  playbackAids = {},
  bitsPerPage = 16,
) {
  const [playbackState, setPlaybackState] = useState('stopped');
  const [countInBeat, setCountInBeat] = useState(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const safePitchLevel = pitchLevel || 0;
  const {
    speed = 1,
    metronomeEnabled = false,
    gridsPerBeat = 4,
    clickVolume = 'medium',
    countInBars = 0,
  } = playbackAids;
  const scoreBeatsPerBar = beatsPerBarForBits(bitsPerPage);
  const countInBeatsPerBar = scoreBeatsPerBar || 4;
  const playbackSpeed = speed === 0.25 || speed === 0.5 ? speed : 1;
  const clickGridsPerBeat = gridsPerBeat === 2 ? 2 : 4;
  // activeGrid は再生中1グリッドごとに変わるため、useState ではなく
  // React の外側で管理するストア（ActiveGridContext）に置く。
  // ここで useState にすると、変化のたびに usePlayback の呼び出し元
  // （App）まで再評価が波及してしまう。
  const activeGridStore = useActiveGridStore();

  // 再生開始処理 / playSingleGrid はイベントハンドラからしか呼ばれず、イベントは
  // commit 後に処理されるため ref で十分。依存配列から grids を外すことで、
  // 1文字打つたびに grids の参照が変わっても各ハンドラの
  // 識別子が変わらなくなり、これらを props として受け取る全 GridCard の
  // memo が素通りしなくなる。
  const gridsRef = useRef(grids);
  useEffect(() => {
    gridsRef.current = grids;
  }, [grids]);

  const playbackSelectionRef = useRef(null);
  const stop = useCallback(() => {
    audioEngine.stop();
    playbackSelectionRef.current = null;
    setPlaybackState('stopped');
    setCountInBeat(null);
    activeGridStore.setActiveIndex(-1);
  }, [activeGridStore]);

  // 購読コールバックは AudioContext の statechange から呼ばれるため、
  // クロージャで playbackState を直接見ると古い値を掴む。ref で最新値を渡す
  const playbackStateRef = useRef(playbackState);
  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  // 他アプリへの切り替え等で AudioContext が suspended になったとき、UIを追従させる。
  // running に戻っても自動再開はしない（現在の「利用者が再開を押す」操作感を変えない）
  useEffect(() => {
    const unsubscribe = audioEngine.onContextStateChange((state) => {
      if (state === 'suspended' && playbackStateRef.current === 'playing') {
        audioEngine.pause();
        setPlaybackState('paused');
      } else if (state === 'suspended' && playbackStateRef.current === 'counting') {
        stop();
      }
    });
    return unsubscribe;
  }, [stop]);

  useEffect(() => rangeStore.subscribe(() => {
    const scheduledSelection = playbackSelectionRef.current;
    if (scheduledSelection === null) return;
    if (rangeToken(selectedRange(rangeStore.getState())) !== scheduledSelection) stop();
  }), [rangeStore, stop]);

  // レンダリングのたびに grids 全体の配列生成と JSON.stringify を行わないよう、
  // grids が変わったときだけ再計算する。
  const keysSignature = useMemo(
    () => JSON.stringify(grids.map(g => getAudibleKeys(g))),
    [grids],
  );

  useEffect(() => {
    stop();
    return stop;
  }, [keysSignature, bpm, playbackSpeed, scoreBeatsPerBar, stop]);

  const previousLoopEnabledRef = useRef(loopEnabled);
  useEffect(() => {
    const wasLoopEnabled = previousLoopEnabledRef.current;
    const isLoopEnabled = loopEnabled;
    if (wasLoopEnabled && !isLoopEnabled) {
      audioEngine.disableLoop();
    } else if (isLoopEnabled) {
      stop();
    }
    previousLoopEnabledRef.current = isLoopEnabled;
  }, [grids, loopEnabled, stop]);

  // Transport に登録済みのイベントは発火時にエンジンのキーを読むため、
  // 一時停止中・再生中にキーが変わっても次のグリッドから反映される。
  useEffect(() => {
    audioEngine.setTranspose(safePitchLevel);
  }, [safePitchLevel]);

  useEffect(() => {
    audioEngine.setMetronomeConfig({
      enabled: metronomeEnabled,
      volume: clickVolume,
      beatsPerBar: scoreBeatsPerBar,
      gridsPerBeat: clickGridsPerBeat,
    });
  }, [clickGridsPerBeat, clickVolume, metronomeEnabled, scoreBeatsPerBar]);

  const ensureInit = useCallback(async () => {
    // ローカルのStateではなく、エンジン本体の準備状態を直接確認する
    if (!audioEngine.isReady) {
      showStatus('音源を読み込んでいます（初回のみ数秒かかります）...', 'loading', false);
      try {
        await audioEngine.init();
        // 直後に音が鳴ることが成功の合図なので完了は知らせない。
        // ただし「読み込んでいます」を出したままにはできない
        dismissStatus();
      } catch (err) {
        showStatus('音源の読み込みに失敗しました。', 'error', false);
        return false;
      }
    }
    return true;
  }, [showStatus, dismissStatus]);

  const startScheduledPlayback = useCallback((
    startIndex,
    endIndex = null,
    trackSelection = false,
    countIn = null,
  ) => {
    const gridsNow = gridsRef.current;
    if (gridsNow.length === 0) return;
    if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= gridsNow.length) return;
    const playbackEnd = endIndex === null
      ? gridsNow.length - 1
      : Math.min(endIndex, gridsNow.length - 1);
    if (!Number.isInteger(playbackEnd) || playbackEnd < startIndex) return;
    const selection = trackSelection ? selectedRange(rangeStore.getState()) : null;
    const selectionKey = rangeToken(selection);
    if (
      trackSelection
      && (selectionKey === null || selection.start !== startIndex || selection.end !== playbackEnd)
    ) return;
    playbackSelectionRef.current = selectionKey;
    if (countIn) {
      setPlaybackState('counting');
      setCountInBeat(1);
    } else {
      setPlaybackState('playing');
    }
    audioEngine.schedule(
      gridsNow,
      bpm * playbackSpeed,
      safePitchLevel,
      startIndex,
      activeGridStore.setActiveIndex,
      stop,
      {
        endIndex: playbackEnd,
        loop: loopEnabled,
        countIn: countIn
          ? { ...countIn, onCount: setCountInBeat }
          : null,
        onPlaybackStart: countIn
          ? () => {
            setCountInBeat(null);
            setPlaybackState('playing');
          }
          : null,
      },
    );
  }, [
    bpm,
    safePitchLevel,
    stop,
    activeGridStore,
    loopEnabled,
    playbackSpeed,
    rangeStore,
  ]);

  const playFrom = useCallback(async (startIndex = 0, endIndex = null, trackSelection = false) => {
    const ready = await ensureInit();
    if (!ready) return;

    if (countInBars > 0) {
      const totalBeats = countInBars * countInBeatsPerBar;
      startScheduledPlayback(startIndex, endIndex, trackSelection, {
        beats: totalBeats,
        beatsPerBar: countInBeatsPerBar,
        accentEnabled: scoreBeatsPerBar > 0,
        volume: clickVolume,
        gridsPerBeat: clickGridsPerBeat,
      });
      return;
    }
    startScheduledPlayback(startIndex, endIndex, trackSelection);
  }, [
    clickGridsPerBeat,
    clickVolume,
    countInBeatsPerBar,
    countInBars,
    ensureInit,
    startScheduledPlayback,
    scoreBeatsPerBar,
  ]);

  const togglePlayPause = useCallback(async (
    startIndex = 0,
    endIndex = null,
    trackSelection = false,
  ) => {
    if (playbackState === 'counting') {
      stop();
    } else if (playbackState === 'playing') {
      audioEngine.pause();
      setPlaybackState('paused');
    } else if (playbackState === 'paused') {
      audioEngine.resume();
      setPlaybackState('playing');
    } else {
      await playFrom(startIndex, endIndex, trackSelection);
    }
  }, [playbackState, playFrom, stop]);

  const playSingleGrid = useCallback(async (index) => {
    const ready = await ensureInit();
    if (!ready) return;

    // ensureInit() の間に「新規作成」「全消去」等でグリッドが減ることがあり、
    // 解決後の index が gridsRef.current に存在しない場合がある
    const g = gridsRef.current[index];
    if (!g) return;
    audioEngine.playGridDirect(getAudibleKeys(g), safePitchLevel);

    activeGridStore.setActiveIndex(index);
    setTimeout(() => {
      // 単発再生の終了時にだけクリアする。その間に別の再生が始まって
      // activeIndex が別の値になっていたら、それを消してはいけない。
      if (activeGridStore.getActiveIndex() === index) {
        activeGridStore.setActiveIndex(-1);
      }
    }, SINGLE_GRID_PLAY_SEC * 1000);
  }, [safePitchLevel, ensureInit, activeGridStore]);

  // 任意のキー配列を直接鳴らす関数 (鍵盤クリック時のプレビュー用)
  const playPreview = useCallback(async (keys) => {
    const ready = await ensureInit();
    if (!ready) return;
    audioEngine.playGridDirect(keys, safePitchLevel);
  }, [safePitchLevel, ensureInit]);

  return {
    playbackState,
    countInBeat,
    isAutoScroll,
    setIsAutoScroll,
    togglePlayPause,
    stop,
    playSingleGrid,
    playPreview,
  };
}
