import { DEBUG_ENABLED } from './debugFlag.js';
import { DEBUG_METRICS_STORAGE_KEY } from '../constants/config.js';

/**
 * `?debug=1` オーバレイ専用の計測置き場。
 *
 * React state にしない理由：ここへの書き込みのたびに再レンダーを起こすと、
 * グリッド購読の性能設計（ScoreGridsContext.jsx の index 単位購読）に
 * 手を入れることになってしまう。オーバレイ側が自分のポーリング周期
 * （4回/秒）で読みに来るだけの、ただのモジュールスコープの入れ物にする。
 */
export const debugMetrics = {
  lastErrorMessage: null,
  // diffGrids のループと購読者への通知（＝再レンダーの予約）だけを含む値。
  // GridCard の実際の再レンダー・DOMコミットは含まない（下記 setGridsPaint* 参照）
  setGridsLastMs: null,
  setGridsMaxMs: null,
  // setGrids の開始から次のペイントまで（rAFを2回入れ子にして計測）。
  // GridCard の再レンダー・差分計算・DOMコミットの実コストを含む
  setGridsPaintLastMs: null,
  setGridsPaintMaxMs: null,
  changedCountLast: null,
  changedCountMax: null,
  // 直近 MAX_RECENT_RECORDS 件の計測（リングバッファ）。強制リロードで
  // メモリ上の値が失われる前に sessionStorage へ書き出す対象
  recentSetGrids: [],
};

const MAX_RECENT_RECORDS = 20;

// 同一フレーム内（正確には、前回の計測が完了するまでの間）に setGrids が
// 複数回呼ばれても、ペイント計測の rAF チェーンを二重に走らせないためのガード。
// 最初に測定を始めた呼び出しの t0 を採用し、以降の呼び出しは通知のみ記録する。
let paintMeasuring = false;

/**
 * `ScoreGridsContext.jsx` の `setGrids` から呼ぶ。フラグが立っていなければ何もしない。
 * @param {number} t0 setGrids 開始時点の performance.now()
 * @param {number} notifyMs diffGrids と購読者への通知だけにかかった ms（従来の値）
 * @param {number} changedCount その回の changedIndices.length
 */
export function recordSetGridsMetrics(t0, notifyMs, changedCount) {
  if (!DEBUG_ENABLED) return;

  debugMetrics.setGridsLastMs = notifyMs;
  if (debugMetrics.setGridsMaxMs === null || notifyMs > debugMetrics.setGridsMaxMs) {
    debugMetrics.setGridsMaxMs = notifyMs;
  }
  debugMetrics.changedCountLast = changedCount;
  if (debugMetrics.changedCountMax === null || changedCount > debugMetrics.changedCountMax) {
    debugMetrics.changedCountMax = changedCount;
  }

  const record = { notifyMs, changedCount, paintMs: null };
  debugMetrics.recentSetGrids.push(record);
  if (debugMetrics.recentSetGrids.length > MAX_RECENT_RECORDS) {
    debugMetrics.recentSetGrids.shift();
  }

  if (paintMeasuring) return; // 進行中の計測がこの回のぶんもまとめて測る
  paintMeasuring = true;
  requestAnimationFrame(() => {
    // 1回目のrAFはコミット後・描画前に走る。描画完了まで含めるには2回必要
    requestAnimationFrame(() => {
      const paintMs = performance.now() - t0;
      record.paintMs = paintMs;
      debugMetrics.setGridsPaintLastMs = paintMs;
      if (debugMetrics.setGridsPaintMaxMs === null || paintMs > debugMetrics.setGridsPaintMaxMs) {
        debugMetrics.setGridsPaintMaxMs = paintMs;
      }
      paintMeasuring = false;
    });
  });
}

/**
 * 直近の計測をリロードをまたいで見られるよう sessionStorage へ書き出す。
 * `setGrids` の中からではなく、オーバレイのポーリング（250ms周期）から呼ぶこと。
 * 計測経路（setGrids）で毎回 JSON.stringify すると、計測自体が負荷源になるため。
 */
export function persistDebugMetricsSnapshot() {
  if (!DEBUG_ENABLED) return;
  try {
    sessionStorage.setItem(
      DEBUG_METRICS_STORAGE_KEY,
      JSON.stringify({
        maxNotifyMs: debugMetrics.setGridsMaxMs,
        maxPaintMs: debugMetrics.setGridsPaintMaxMs,
        maxChangedCount: debugMetrics.changedCountMax,
        recent: debugMetrics.recentSetGrids,
      }),
    );
  } catch {
    // プライベートブラウズ・容量超過は握り潰す（pdfPrefs.js 等と同じ扱い）
  }
}

/**
 * 前回セッションの最後の記録を読み出す。壊れたJSON・null・型違いで
 * 落ちないよう、pdfPrefs.js / draftStorage.js と同じ形で防御する。
 * フラグが立っていないときは sessionStorage に一切触れない。
 */
export function loadPersistedDebugMetricsSnapshot() {
  if (!DEBUG_ENABLED) return null;
  try {
    const raw = sessionStorage.getItem(DEBUG_METRICS_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

    const recent = Array.isArray(data.recent)
      ? data.recent
          .filter((r) => r && typeof r === 'object')
          .map((r) => ({
            notifyMs: typeof r.notifyMs === 'number' ? r.notifyMs : null,
            paintMs: typeof r.paintMs === 'number' ? r.paintMs : null,
            changedCount: typeof r.changedCount === 'number' ? r.changedCount : null,
          }))
      : [];

    return {
      maxNotifyMs: typeof data.maxNotifyMs === 'number' ? data.maxNotifyMs : null,
      maxPaintMs: typeof data.maxPaintMs === 'number' ? data.maxPaintMs : null,
      maxChangedCount: typeof data.maxChangedCount === 'number' ? data.maxChangedCount : null,
      recent,
    };
  } catch {
    return null;
  }
}

let listenersAttached = false;

/**
 * `window.onerror` / `unhandledrejection` を購読する。オーバレイ表示のためだけに使い、
 * 既存の `ErrorBoundary`（React ツリー内のレンダーエラー捕捉）には触れない。
 * `addEventListener` を使うのは、代入だと既存のハンドラを上書きしてしまいうるため。
 */
export function attachDebugErrorListeners() {
  if (!DEBUG_ENABLED || listenersAttached) return;
  listenersAttached = true;
  window.addEventListener('error', (event) => {
    debugMetrics.lastErrorMessage = event.message || String(event.error);
  });
  window.addEventListener('unhandledrejection', (event) => {
    debugMetrics.lastErrorMessage = `unhandledrejection: ${event.reason}`;
  });
}
