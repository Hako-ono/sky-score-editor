import { describe, expect, it } from 'vitest';

import {
  RAPID_TOUCH_SCROLL_MIN_SPEED_PX_PER_SEC,
  shouldUseRapidScrollPlaceholders,
} from '../rapidScroll.js';

const base = {
  isMobile: true,
  hasTouchScrollSession: true,
  playbackState: 'stopped',
  hasEditableFocus: false,
  speedPxPerSec: RAPID_TOUCH_SCROLL_MIN_SPEED_PX_PER_SEC,
};

describe('shouldUseRapidScrollPlaceholders', () => {
  it('モバイルの高速タッチスクロールだけを軽量表示にする', () => {
    expect(shouldUseRapidScrollPlaceholders(base)).toBe(true);
    expect(shouldUseRapidScrollPlaceholders({
      ...base,
      speedPxPerSec: RAPID_TOUCH_SCROLL_MIN_SPEED_PX_PER_SEC - 1,
    })).toBe(false);
  });

  it('タッチ起点でないスクロールとデスクトップを対象外にする', () => {
    expect(shouldUseRapidScrollPlaceholders({
      ...base,
      hasTouchScrollSession: false,
    })).toBe(false);
    expect(shouldUseRapidScrollPlaceholders({ ...base, isMobile: false })).toBe(false);
  });

  it('再生中・一時停止中・カウントイン中は表示を変えない', () => {
    for (const playbackState of ['playing', 'paused', 'counting']) {
      expect(shouldUseRapidScrollPlaceholders({ ...base, playbackState })).toBe(false);
    }
  });

  it('入力欄にフォーカスがある場合と不正な速度を対象外にする', () => {
    expect(shouldUseRapidScrollPlaceholders({ ...base, hasEditableFocus: true })).toBe(false);
    for (const speedPxPerSec of [NaN, Infinity, -1, null, undefined]) {
      expect(shouldUseRapidScrollPlaceholders({ ...base, speedPxPerSec })).toBe(false);
    }
  });
});
