import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { audioEngine } from '../lib/audioEngine.js';
import { SINGLE_GRID_PLAY_SEC } from '../constants/config.js';
import { useActiveGridStore } from '../contexts/ActiveGridContext.jsx';
import { getAudibleKeys } from '../lib/scoreLayers.js';

export function usePlayback(grids, bpm, pitchLevel, showStatus, dismissStatus) {
  const [playbackState, setPlaybackState] = useState('stopped');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const safePitchLevel = pitchLevel || 0;
  // activeGrid は再生中1グリッドごとに変わるため、useState ではなく
  // React の外側で管理するストア（ActiveGridContext）に置く。
  // ここで useState にすると、変化のたびに usePlayback の呼び出し元
  // （App）まで再評価が波及してしまう。
  const activeGridStore = useActiveGridStore();

  // playFrom / playSingleGrid はイベントハンドラからしか呼ばれず、イベントは
  // commit 後に処理されるため ref で十分。依存配列から grids を外すことで、
  // 1文字打つたびに grids の参照が変わっても playFrom / playSingleGrid の
  // 識別子が変わらなくなり、これらを props として受け取る全 GridCard の
  // memo が素通りしなくなる。
  const gridsRef = useRef(grids);
  useEffect(() => {
    gridsRef.current = grids;
  }, [grids]);

  const stop = useCallback(() => {
    audioEngine.stop();
    setPlaybackState('stopped');
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
      }
    });
    return unsubscribe;
  }, []);

  // レンダリングのたびに grids 全体の配列生成と JSON.stringify を行わないよう、
  // grids が変わったときだけ再計算する。
  const keysSignature = useMemo(
    () => JSON.stringify(grids.map(g => getAudibleKeys(g))),
    [grids],
  );

  useEffect(() => {
    stop();
    return stop;
  }, [keysSignature, bpm, stop]);

  // Transport に登録済みのイベントは発火時にエンジンのキーを読むため、
  // 一時停止中・再生中にキーが変わっても次のグリッドから反映される。
  useEffect(() => {
    audioEngine.setTranspose(safePitchLevel);
  }, [safePitchLevel]);

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

  const playFrom = useCallback(async (startIndex = 0) => {
    const ready = await ensureInit();
    if (!ready) return;

    setPlaybackState('playing');
    audioEngine.schedule(gridsRef.current, bpm, safePitchLevel, startIndex, activeGridStore.setActiveIndex, stop);
  }, [bpm, safePitchLevel, stop, ensureInit, activeGridStore]);

  const togglePlayPause = useCallback(async () => {
    if (playbackState === 'playing') {
      audioEngine.pause();
      setPlaybackState('paused');
    } else if (playbackState === 'paused') {
      audioEngine.resume();
      setPlaybackState('playing');
    } else {
      await playFrom(0);
    }
  }, [playbackState, playFrom]);

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
    isAutoScroll,
    setIsAutoScroll,
    togglePlayPause,
    stop,
    playFrom,
    playSingleGrid,
    playPreview,
  };
}
