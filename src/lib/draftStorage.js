/**
 * 作業中の楽譜を localStorage に自動保存し、再訪時に復元するための薄いラッパ。
 * scoreShape.jsで定義した楽譜全体に、保存時刻savedAtだけを加えて保存する。
 */

import { DRAFT_STORAGE_KEY } from '../constants/config.js';
import { DEBUG_ENABLED } from './debugFlag.js';
import { recordDraftSaveMetrics } from './debugMetrics.js';

export function saveDraft(score) {
  const t0 = DEBUG_ENABLED ? performance.now() : 0;
  let payload = null;
  try {
    payload = JSON.stringify({ ...score, savedAt: Date.now() });
    localStorage.setItem(DRAFT_STORAGE_KEY, payload);
    if (DEBUG_ENABLED) {
      const durationMs = performance.now() - t0;
      recordDraftSaveMetrics({
        chars: payload.length,
        utf8Bytes: new Blob([payload]).size,
        durationMs,
        succeeded: true,
      });
    }
    return true;
  } catch {
    if (DEBUG_ENABLED) {
      const durationMs = performance.now() - t0;
      recordDraftSaveMetrics({
        chars: payload?.length ?? null,
        utf8Bytes: payload === null ? null : new Blob([payload]).size,
        durationMs,
        succeeded: false,
      });
    }
    return false; // 容量超過やプライベートモードなどは黙って無視
  }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // grids が空配列の下書きを有効として返すと、復元しても EmptyState のまま
    // 何も起きないボタンが常設される。また既にこの状態の下書きを持っている
    // 利用者がいるため、書き込み側だけを直しても救えず、読み出し側での
    // 防御が要る
    if (!data || !Array.isArray(data.grids) || data.grids.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
