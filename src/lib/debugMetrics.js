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
  scoreFileBytes: null,
  scoreReadLastMs: null,
  scoreParseLastMs: null,
  scoreLoadLastMs: null,
  draftCharsLast: null,
  draftUtf8BytesLast: null,
  draftSaveLastMs: null,
  draftSaveSucceeded: null,
  playbackScheduleLastMs: null,
  playbackScheduleMaxMs: null,
  playbackScheduledGridCount: null,
  playbackScheduledEventCount: null,
  playbackScheduledAsLoop: null,
  playbackStopLastMs: null,
  playbackStopMaxMs: null,
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
  scrollSpeedLastPxPerSec: null,
  scrollSpeedMaxPxPerSec: null,
  scrollSampledAtMs: null,
  scrollFrameLastMs: null,
  scrollFrameMaxMs: null,
  scrollFrameSampleCount: 0,
  scrollLongFrameCount: 0,
  scrollActiveDurationMs: 0,
  renderedRowStart: null,
  renderedRowEnd: null,
  renderedGridStart: null,
  renderedGridEnd: null,
  renderedGridCount: null,
  rangeUpdatesPerSec: 0,
  rangeUpdatesMaxPerSec: 0,
  rangeSwappedLast: null,
  rangeSwappedMax: null,
  rangeSwappedTotal: 0,
  rapidScrollPlaceholderActive: false,
  rapidScrollPlaceholderActivationCount: 0,
  // 直近 MAX_RECENT_RECORDS 件の計測（リングバッファ）。強制リロードで
  // メモリ上の値が失われる前に sessionStorage へ書き出す対象
  recentSetGrids: [],
  recentPlayback: [],
};

const MAX_RECENT_RECORDS = 20;
const SCROLL_ACTIVE_WINDOW_MS = 250;
export const LONG_SCROLL_FRAME_MS = 50;

let previousScrollSample = null;
let previousRenderedRange = null;
const rangeUpdateTimestamps = [];

function finiteNumberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeIntegerOrNull(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function pruneRangeUpdateTimestamps(nowMs) {
  const cutoff = nowMs - 1_000;
  while (rangeUpdateTimestamps.length > 0 && rangeUpdateTimestamps[0] <= cutoff) {
    rangeUpdateTimestamps.shift();
  }
  debugMetrics.rangeUpdatesPerSec = rangeUpdateTimestamps.length;
}

/**
 * 連続するスクロールrAF間の速度とフレーム間隔を求める。250msを超えて
 * 途切れた場合は別のスクロール操作として扱い、停止時間を長いフレームへ数えない。
 */
export function computeVirtualScrollSample({
  previousTimestamp,
  previousScrollY,
  timestamp,
  scrollY,
}) {
  if (!Number.isFinite(timestamp) || !Number.isFinite(scrollY)) return null;
  if (!Number.isFinite(previousTimestamp) || !Number.isFinite(previousScrollY)) {
    return { speedPxPerSec: 0, frameMs: null };
  }

  const frameMs = timestamp - previousTimestamp;
  if (frameMs <= 0 || frameMs > SCROLL_ACTIVE_WINDOW_MS) {
    return { speedPxPerSec: 0, frameMs: null };
  }

  return {
    speedPxPerSec: Math.abs(scrollY - previousScrollY) * 1_000 / frameMs,
    frameMs,
  };
}

/** 半開区間で表した前後の描画範囲から、出入りしたグリッドの合計を返す。 */
export function countVirtualRangeSwaps(previousStart, previousEnd, nextStart, nextEnd) {
  const values = [previousStart, previousEnd, nextStart, nextEnd];
  if (!values.every((value) => Number.isInteger(value) && value >= 0)) return 0;
  if (previousEnd < previousStart || nextEnd < nextStart) return 0;

  const previousCount = Math.max(0, previousEnd - previousStart);
  const nextCount = Math.max(0, nextEnd - nextStart);
  const overlap = Math.max(0, Math.min(previousEnd, nextEnd) - Math.max(previousStart, nextStart));
  return previousCount + nextCount - (2 * overlap);
}

export function computeLongScrollFrameRatio(longFrameCount, frameSampleCount) {
  if (!Number.isInteger(longFrameCount) || longFrameCount < 0) return 0;
  if (!Number.isInteger(frameSampleCount) || frameSampleCount <= 0) return 0;
  return Math.min(1, longFrameCount / frameSampleCount);
}

export function recordVirtualScrollFrame(timestamp, scrollY) {
  if (!DEBUG_ENABLED) return;

  const sample = computeVirtualScrollSample({
    previousTimestamp: previousScrollSample?.timestamp,
    previousScrollY: previousScrollSample?.scrollY,
    timestamp,
    scrollY,
  });
  if (!sample) return;

  previousScrollSample = { timestamp, scrollY };
  debugMetrics.scrollSampledAtMs = timestamp;
  debugMetrics.scrollSpeedLastPxPerSec = sample.speedPxPerSec;
  if (
    debugMetrics.scrollSpeedMaxPxPerSec === null
    || sample.speedPxPerSec > debugMetrics.scrollSpeedMaxPxPerSec
  ) {
    debugMetrics.scrollSpeedMaxPxPerSec = sample.speedPxPerSec;
  }

  if (sample.frameMs === null) return;
  debugMetrics.scrollFrameSampleCount += 1;
  debugMetrics.scrollActiveDurationMs += sample.frameMs;
  debugMetrics.scrollFrameLastMs = sample.frameMs;
  if (
    debugMetrics.scrollFrameMaxMs === null
    || sample.frameMs > debugMetrics.scrollFrameMaxMs
  ) {
    debugMetrics.scrollFrameMaxMs = sample.frameMs;
  }
  if (sample.frameMs > LONG_SCROLL_FRAME_MS) {
    debugMetrics.scrollLongFrameCount += 1;
  }
}

export function recordVirtualizedRenderMetrics({
  timestamp,
  startRow,
  endRow,
  gridStart,
  gridEnd,
  gridCount,
}) {
  if (!DEBUG_ENABLED) return;

  debugMetrics.renderedRowStart = startRow;
  debugMetrics.renderedRowEnd = endRow;
  debugMetrics.renderedGridStart = gridStart;
  debugMetrics.renderedGridEnd = gridEnd;
  debugMetrics.renderedGridCount = gridCount;

  const nextRange = { startRow, endRow, gridStart, gridEnd };
  if (
    previousRenderedRange
    && previousRenderedRange.startRow === startRow
    && previousRenderedRange.endRow === endRow
    && previousRenderedRange.gridStart === gridStart
    && previousRenderedRange.gridEnd === gridEnd
  ) return;

  if (previousRenderedRange && gridStart !== null && gridEnd !== null) {
    const swapped = previousRenderedRange.gridStart === null || previousRenderedRange.gridEnd === null
      ? gridCount
      : countVirtualRangeSwaps(
          previousRenderedRange.gridStart,
          previousRenderedRange.gridEnd,
          gridStart,
          gridEnd,
        );
    debugMetrics.rangeSwappedLast = swapped;
    debugMetrics.rangeSwappedTotal += swapped;
    if (debugMetrics.rangeSwappedMax === null || swapped > debugMetrics.rangeSwappedMax) {
      debugMetrics.rangeSwappedMax = swapped;
    }
  }
  previousRenderedRange = nextRange;

  if (!Number.isFinite(timestamp)) return;
  rangeUpdateTimestamps.push(timestamp);
  pruneRangeUpdateTimestamps(timestamp);
  if (debugMetrics.rangeUpdatesPerSec > debugMetrics.rangeUpdatesMaxPerSec) {
    debugMetrics.rangeUpdatesMaxPerSec = debugMetrics.rangeUpdatesPerSec;
  }
}

export function recordRapidScrollPlaceholder(active) {
  if (!DEBUG_ENABLED) return;
  const nextActive = active === true;
  if (nextActive && !debugMetrics.rapidScrollPlaceholderActive) {
    debugMetrics.rapidScrollPlaceholderActivationCount += 1;
  }
  debugMetrics.rapidScrollPlaceholderActive = nextActive;
}

export function getDebugMetricsSnapshot(nowMs = performance.now()) {
  if (Number.isFinite(nowMs)) pruneRangeUpdateTimestamps(nowMs);
  const scrollIsActive = Number.isFinite(nowMs)
    && debugMetrics.scrollSampledAtMs !== null
    && nowMs - debugMetrics.scrollSampledAtMs <= SCROLL_ACTIVE_WINDOW_MS;
  return {
    ...debugMetrics,
    scrollLongFrameRatio: computeLongScrollFrameRatio(
      debugMetrics.scrollLongFrameCount,
      debugMetrics.scrollFrameSampleCount,
    ),
    scrollSpeedCurrentPxPerSec: scrollIsActive
      ? debugMetrics.scrollSpeedLastPxPerSec
      : 0,
  };
}

function pushRecentPlayback(record) {
  debugMetrics.recentPlayback.push(record);
  if (debugMetrics.recentPlayback.length > MAX_RECENT_RECORDS) {
    debugMetrics.recentPlayback.shift();
  }
}

export function recordScoreLoadMetrics({ fileBytes, readMs, parseMs, totalMs }) {
  if (!DEBUG_ENABLED) return;
  debugMetrics.scoreFileBytes = fileBytes;
  debugMetrics.scoreReadLastMs = readMs;
  debugMetrics.scoreParseLastMs = parseMs;
  debugMetrics.scoreLoadLastMs = totalMs;
}

export function recordDraftSaveMetrics({ chars, utf8Bytes, durationMs, succeeded }) {
  if (!DEBUG_ENABLED) return;
  debugMetrics.draftCharsLast = chars;
  debugMetrics.draftUtf8BytesLast = utf8Bytes;
  debugMetrics.draftSaveLastMs = durationMs;
  debugMetrics.draftSaveSucceeded = succeeded;
}

export function recordPlaybackScheduleMetrics({
  durationMs,
  gridCount,
  eventCount,
  loop,
}) {
  if (!DEBUG_ENABLED) return;
  debugMetrics.playbackScheduleLastMs = durationMs;
  if (
    debugMetrics.playbackScheduleMaxMs === null
    || durationMs > debugMetrics.playbackScheduleMaxMs
  ) {
    debugMetrics.playbackScheduleMaxMs = durationMs;
  }
  debugMetrics.playbackScheduledGridCount = gridCount;
  debugMetrics.playbackScheduledEventCount = eventCount;
  debugMetrics.playbackScheduledAsLoop = loop;
  pushRecentPlayback({ type: 'schedule', durationMs, gridCount, eventCount, loop });
}

export function recordPlaybackStopMetrics(durationMs) {
  if (!DEBUG_ENABLED) return;
  debugMetrics.playbackStopLastMs = durationMs;
  if (debugMetrics.playbackStopMaxMs === null || durationMs > debugMetrics.playbackStopMaxMs) {
    debugMetrics.playbackStopMaxMs = durationMs;
  }
  pushRecentPlayback({ type: 'stop', durationMs });
}

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
    const current = getDebugMetricsSnapshot();
    sessionStorage.setItem(
      DEBUG_METRICS_STORAGE_KEY,
      JSON.stringify({
        maxNotifyMs: debugMetrics.setGridsMaxMs,
        maxPaintMs: debugMetrics.setGridsPaintMaxMs,
        maxChangedCount: debugMetrics.changedCountMax,
        recent: debugMetrics.recentSetGrids,
        scoreLoad: {
          fileBytes: debugMetrics.scoreFileBytes,
          readMs: debugMetrics.scoreReadLastMs,
          parseMs: debugMetrics.scoreParseLastMs,
          totalMs: debugMetrics.scoreLoadLastMs,
        },
        draftSave: {
          chars: debugMetrics.draftCharsLast,
          utf8Bytes: debugMetrics.draftUtf8BytesLast,
          durationMs: debugMetrics.draftSaveLastMs,
          succeeded: debugMetrics.draftSaveSucceeded,
        },
        maxPlaybackScheduleMs: debugMetrics.playbackScheduleMaxMs,
        maxPlaybackStopMs: debugMetrics.playbackStopMaxMs,
        recentPlayback: debugMetrics.recentPlayback,
        virtualization: {
          scrollSpeedCurrentPxPerSec: current.scrollSpeedCurrentPxPerSec,
          scrollSpeedMaxPxPerSec: current.scrollSpeedMaxPxPerSec,
          scrollFrameLastMs: current.scrollFrameLastMs,
          scrollFrameMaxMs: current.scrollFrameMaxMs,
          scrollFrameSampleCount: current.scrollFrameSampleCount,
          scrollLongFrameCount: current.scrollLongFrameCount,
          scrollLongFrameRatio: current.scrollLongFrameRatio,
          scrollActiveDurationMs: current.scrollActiveDurationMs,
          renderedRowStart: current.renderedRowStart,
          renderedRowEnd: current.renderedRowEnd,
          renderedGridStart: current.renderedGridStart,
          renderedGridEnd: current.renderedGridEnd,
          renderedGridCount: current.renderedGridCount,
          rangeUpdatesPerSec: current.rangeUpdatesPerSec,
          rangeUpdatesMaxPerSec: current.rangeUpdatesMaxPerSec,
          rangeSwappedLast: current.rangeSwappedLast,
          rangeSwappedMax: current.rangeSwappedMax,
          rangeSwappedTotal: current.rangeSwappedTotal,
          rapidScrollPlaceholderActive: current.rapidScrollPlaceholderActive,
          rapidScrollPlaceholderActivationCount: current.rapidScrollPlaceholderActivationCount,
        },
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
      scoreLoad: data.scoreLoad && typeof data.scoreLoad === 'object'
        ? data.scoreLoad
        : null,
      draftSave: data.draftSave && typeof data.draftSave === 'object'
        ? data.draftSave
        : null,
      maxPlaybackScheduleMs: typeof data.maxPlaybackScheduleMs === 'number'
        ? data.maxPlaybackScheduleMs
        : null,
      maxPlaybackStopMs: typeof data.maxPlaybackStopMs === 'number'
        ? data.maxPlaybackStopMs
        : null,
      recentPlayback: Array.isArray(data.recentPlayback)
        ? data.recentPlayback.filter((record) => record && typeof record === 'object')
        : [],
      virtualization: data.virtualization && typeof data.virtualization === 'object'
        ? {
            scrollSpeedCurrentPxPerSec: finiteNumberOrNull(
              data.virtualization.scrollSpeedCurrentPxPerSec,
            ),
            scrollSpeedMaxPxPerSec: finiteNumberOrNull(
              data.virtualization.scrollSpeedMaxPxPerSec,
            ),
            scrollFrameLastMs: finiteNumberOrNull(data.virtualization.scrollFrameLastMs),
            scrollFrameMaxMs: finiteNumberOrNull(data.virtualization.scrollFrameMaxMs),
            scrollFrameSampleCount: nonNegativeIntegerOrNull(
              data.virtualization.scrollFrameSampleCount,
            ),
            scrollLongFrameCount: nonNegativeIntegerOrNull(
              data.virtualization.scrollLongFrameCount,
            ),
            scrollLongFrameRatio: finiteNumberOrNull(
              data.virtualization.scrollLongFrameRatio,
            ),
            scrollActiveDurationMs: finiteNumberOrNull(
              data.virtualization.scrollActiveDurationMs,
            ),
            renderedRowStart: nonNegativeIntegerOrNull(data.virtualization.renderedRowStart),
            renderedRowEnd: nonNegativeIntegerOrNull(data.virtualization.renderedRowEnd),
            renderedGridStart: nonNegativeIntegerOrNull(data.virtualization.renderedGridStart),
            renderedGridEnd: nonNegativeIntegerOrNull(data.virtualization.renderedGridEnd),
            renderedGridCount: nonNegativeIntegerOrNull(data.virtualization.renderedGridCount),
            rangeUpdatesPerSec: nonNegativeIntegerOrNull(
              data.virtualization.rangeUpdatesPerSec,
            ),
            rangeUpdatesMaxPerSec: nonNegativeIntegerOrNull(
              data.virtualization.rangeUpdatesMaxPerSec,
            ),
            rangeSwappedLast: nonNegativeIntegerOrNull(data.virtualization.rangeSwappedLast),
            rangeSwappedMax: nonNegativeIntegerOrNull(data.virtualization.rangeSwappedMax),
            rangeSwappedTotal: nonNegativeIntegerOrNull(
              data.virtualization.rangeSwappedTotal,
            ),
            rapidScrollPlaceholderActive:
              data.virtualization.rapidScrollPlaceholderActive === true,
            rapidScrollPlaceholderActivationCount: nonNegativeIntegerOrNull(
              data.virtualization.rapidScrollPlaceholderActivationCount,
            ),
          }
        : null,
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
