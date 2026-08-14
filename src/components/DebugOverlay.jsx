import { useEffect, useState } from 'react';

import { audioEngine } from '../lib/audioEngine.js';
import {
  attachDebugErrorListeners,
  debugMetrics,
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

/**
 * `?debug=1` のときだけ App.jsx からマウントされる、実機の内部状態を見るための
 * 診断オーバレイ。既存の再生・購読の仕組みには一切手を入れず、読み出すだけ。
 */
export default function DebugOverlay({ playbackState, gridCount }) {
  const [snapshot, setSnapshot] = useState(() => audioEngine.getDebugSnapshot());
  const [metrics, setMetrics] = useState(() => ({ ...debugMetrics }));
  // 強制リロードでメモリ上の値は失われるため、前回セッションの最後の記録を
  // sessionStorage から一度だけ読む（マウント後の値と混ざらないよう state 化はしない）
  const [previousSession] = useState(() => loadPersistedDebugMetricsSnapshot());

  useEffect(() => {
    attachDebugErrorListeners();
    const id = setInterval(() => {
      setSnapshot(audioEngine.getDebugSnapshot());
      setMetrics({ ...debugMetrics });
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
