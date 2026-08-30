import { useEffect, useState } from 'react';

import { audioEngine } from '../lib/audioEngine.js';
import {
  attachDebugErrorListeners,
  getDebugMetricsSnapshot,
  persistDebugMetricsSnapshot,
  loadPersistedDebugMetricsSnapshot,
} from '../lib/debugMetrics.js';

const POLL_INTERVAL_MS = 250; // 4回/秒程度。オーバレイ自身が負荷源にならないよう毎フレーム更新はしない

function formatMs(ms) {
  return ms === null ? '—' : `${ms.toFixed(1)}ms`;
}

function formatCount(n) {
  return n === null ? '—' : `${n}件`;
}

function formatBytes(bytes) {
  if (bytes === null || typeof bytes !== 'number') return '—';
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function formatChars(chars) {
  if (chars === null || typeof chars !== 'number') return '—';
  return `${chars.toLocaleString()}文字`;
}

function formatSpeed(speed) {
  return speed === null || typeof speed !== 'number'
    ? '—'
    : `${Math.round(speed).toLocaleString()}px/s`;
}

function formatRatio(ratio) {
  return ratio === null || typeof ratio !== 'number'
    ? '—'
    : `${(ratio * 100).toFixed(1)}%`;
}

function formatDuration(ms) {
  return ms === null || typeof ms !== 'number'
    ? '—'
    : `${(ms / 1_000).toFixed(1)}秒`;
}

function formatRange(start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return '—';
  return `${start.toLocaleString()}–${(end - 1).toLocaleString()}`;
}

/**
 * `?debug=1` のときだけ App.jsx からマウントされる、実機の内部状態を見るための
 * 診断オーバレイ。既存の再生・購読の仕組みには一切手を入れず、読み出すだけ。
 */
export default function DebugOverlay({ playbackState, gridCount }) {
  const [snapshot, setSnapshot] = useState(() => audioEngine.getDebugSnapshot());
  const [metrics, setMetrics] = useState(() => getDebugMetricsSnapshot());
  // 強制リロードでメモリ上の値は失われるため、前回セッションの最後の記録を
  // sessionStorage から一度だけ読む（マウント後の値と混ざらないよう state 化はしない）
  const [previousSession] = useState(() => loadPersistedDebugMetricsSnapshot());

  useEffect(() => {
    attachDebugErrorListeners();
    const id = setInterval(() => {
      setSnapshot(audioEngine.getDebugSnapshot());
      setMetrics(getDebugMetricsSnapshot());
      // 書き出しは計測経路（setGrids）ではなくここから。JSON.stringify を
      // 毎回の setGrids で行うと計測自体が負荷源になるため
      persistDebugMetricsSnapshot();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="debug-overlay" role="status" aria-label="診断オーバレイ">
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">AudioContext</span>
        <span className="debug-overlay__value">{snapshot.audioContextState ?? '未初期化'}</span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">Transportイベント</span>
        <span className="debug-overlay__value">{formatCount(snapshot.transportEventCount)}</span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">Transport</span>
        <span className="debug-overlay__value">
          {snapshot.transportState ?? '未初期化'}
          {snapshot.transportSeconds !== null ? ` / ${snapshot.transportSeconds.toFixed(2)}s` : ''}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">playbackState</span>
        <span className="debug-overlay__value">{playbackState}</span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">グリッド数</span>
        <span className="debug-overlay__value">{gridCount}</span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">スクロール</span>
        <span className="debug-overlay__value">
          速度 {formatSpeed(metrics.scrollSpeedCurrentPxPerSec)} / 最大{' '}
          {formatSpeed(metrics.scrollSpeedMaxPxPerSec)} / フレーム{' '}
          {formatMs(metrics.scrollFrameLastMs)} / 最大 {formatMs(metrics.scrollFrameMaxMs)} /{' '}
          &gt;50ms {formatCount(metrics.scrollLongFrameCount)}
          （{formatRatio(metrics.scrollLongFrameRatio)}） / 総数{' '}
          {formatCount(metrics.scrollFrameSampleCount)} / 計測{' '}
          {formatDuration(metrics.scrollActiveDurationMs)}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">仮想描画</span>
        <span className="debug-overlay__value">
          {formatCount(metrics.renderedGridCount)} / グリッド{' '}
          {formatRange(metrics.renderedGridStart, metrics.renderedGridEnd)} / 行{' '}
          {formatRange(metrics.renderedRowStart, metrics.renderedRowEnd)}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">範囲更新</span>
        <span className="debug-overlay__value">
          {metrics.rangeUpdatesPerSec}/秒 / 最大 {metrics.rangeUpdatesMaxPerSec}/秒 / 入替{' '}
          {formatCount(metrics.rangeSwappedLast)} / 最大 {formatCount(metrics.rangeSwappedMax)} / 累計{' '}
          {formatCount(metrics.rangeSwappedTotal)}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">高速時軽量表示</span>
        <span className="debug-overlay__value">
          {metrics.rapidScrollPlaceholderActive ? 'ON' : 'OFF'} / 起動{' '}
          {formatCount(metrics.rapidScrollPlaceholderActivationCount)}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">読込</span>
        <span className="debug-overlay__value">
          {formatBytes(metrics.scoreFileBytes)} / 読出 {formatMs(metrics.scoreReadLastMs)} /
          解析 {formatMs(metrics.scoreParseLastMs)} / 全体 {formatMs(metrics.scoreLoadLastMs)}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">下書き保存</span>
        <span className="debug-overlay__value">
          {formatChars(metrics.draftCharsLast)} / UTF-8 {formatBytes(metrics.draftUtf8BytesLast)} /{' '}
          {formatMs(metrics.draftSaveLastMs)} /{' '}
          {metrics.draftSaveSucceeded === null
            ? '—'
            : metrics.draftSaveSucceeded ? '成功' : '失敗'}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">再生予約</span>
        <span className="debug-overlay__value">
          直近 {formatMs(metrics.playbackScheduleLastMs)} / 最大{' '}
          {formatMs(metrics.playbackScheduleMaxMs)} / {formatCount(metrics.playbackScheduledGridCount)}
          {' / '}{formatCount(metrics.playbackScheduledEventCount)}
          {metrics.playbackScheduledAsLoop === null
            ? ''
            : metrics.playbackScheduledAsLoop ? ' / ループ' : ' / 通常'}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">再生停止</span>
        <span className="debug-overlay__value">
          直近 {formatMs(metrics.playbackStopLastMs)} / 最大 {formatMs(metrics.playbackStopMaxMs)}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">setGrids(通知)</span>
        <span className="debug-overlay__value">
          直近 {formatMs(metrics.setGridsLastMs)} / 最大 {formatMs(metrics.setGridsMaxMs)}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">setGrids(ペイントまで)</span>
        <span className="debug-overlay__value">
          直近 {formatMs(metrics.setGridsPaintLastMs)} / 最大 {formatMs(metrics.setGridsPaintMaxMs)}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__key">通知件数</span>
        <span className="debug-overlay__value">
          直近 {formatCount(metrics.changedCountLast)} / 最大 {formatCount(metrics.changedCountMax)}
        </span>
      </div>
      <div className="debug-overlay__row debug-overlay__row--error">
        <span className="debug-overlay__key">直近エラー</span>
        <span className="debug-overlay__value">{metrics.lastErrorMessage ?? 'なし'}</span>
      </div>
      {previousSession && (
        <>
          <div className="debug-overlay__row">
            <span className="debug-overlay__key">前回セッション最大値</span>
            <span className="debug-overlay__value">
              通知 {formatMs(previousSession.maxNotifyMs)} / ペイント{' '}
              {formatMs(previousSession.maxPaintMs)} / 通知件数{' '}
              {formatCount(previousSession.maxChangedCount)}
            </span>
          </div>
          <div className="debug-overlay__row">
            <span className="debug-overlay__key">前回再生最大値</span>
            <span className="debug-overlay__value">
              予約 {formatMs(previousSession.maxPlaybackScheduleMs)} / 停止{' '}
              {formatMs(previousSession.maxPlaybackStopMs)}
            </span>
          </div>
          <div className="debug-overlay__row">
            <span className="debug-overlay__key">前回読込・下書き</span>
            <span className="debug-overlay__value">
              読込 {formatBytes(previousSession.scoreLoad?.fileBytes)} / 全体{' '}
              {formatMs(previousSession.scoreLoad?.totalMs ?? null)} / 下書き{' '}
              {formatChars(previousSession.draftSave?.chars)} / UTF-8{' '}
              {formatBytes(previousSession.draftSave?.utf8Bytes)} /{' '}
              {formatMs(previousSession.draftSave?.durationMs ?? null)}
            </span>
          </div>
          {previousSession.virtualization && (
            <>
              <div className="debug-overlay__row">
                <span className="debug-overlay__key">前回スクロール</span>
                <span className="debug-overlay__value">
                  末尾 {formatSpeed(previousSession.virtualization.scrollSpeedCurrentPxPerSec)} /
                  最大 {formatSpeed(previousSession.virtualization.scrollSpeedMaxPxPerSec)} /
                  フレーム最大 {formatMs(previousSession.virtualization.scrollFrameMaxMs)} /
                  &gt;50ms {formatCount(previousSession.virtualization.scrollLongFrameCount)}
                  （{formatRatio(previousSession.virtualization.scrollLongFrameRatio)}） / 総数{' '}
                  {formatCount(previousSession.virtualization.scrollFrameSampleCount)} / 計測{' '}
                  {formatDuration(previousSession.virtualization.scrollActiveDurationMs)}
                </span>
              </div>
              <div className="debug-overlay__row">
                <span className="debug-overlay__key">前回仮想範囲</span>
                <span className="debug-overlay__value">
                  {formatCount(previousSession.virtualization.renderedGridCount)} / グリッド{' '}
                  {formatRange(
                    previousSession.virtualization.renderedGridStart,
                    previousSession.virtualization.renderedGridEnd,
                  )} / 行{' '}
                  {formatRange(
                    previousSession.virtualization.renderedRowStart,
                    previousSession.virtualization.renderedRowEnd,
                  )} / 更新最大 {previousSession.virtualization.rangeUpdatesMaxPerSec ?? '—'}/秒 /
                  入替最大 {formatCount(previousSession.virtualization.rangeSwappedMax)} / 累計{' '}
                  {formatCount(previousSession.virtualization.rangeSwappedTotal)} / 軽量表示起動{' '}
                  {formatCount(
                    previousSession.virtualization.rapidScrollPlaceholderActivationCount,
                  )}
                </span>
              </div>
            </>
          )}
          <div className="debug-overlay__row">
            <span className="debug-overlay__key">前回セッション末尾</span>
            <span className="debug-overlay__value">
              {previousSession.recent.length === 0
                ? 'なし'
                : previousSession.recent
                    .slice(-3)
                    .map(
                      (r) =>
                        `通知${formatMs(r.notifyMs)}/ペイント${formatMs(r.paintMs)}/${formatCount(r.changedCount)}`,
                    )
                    .join(' → ')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
