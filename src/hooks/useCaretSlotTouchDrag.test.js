import { describe, expect, it } from 'vitest';
import {
  CARET_TOUCH_DIRECTION_THRESHOLD_PX,
  classifyCaretSlotTouchIntent,
} from './useCaretSlotTouchDrag.js';

describe('classifyCaretSlotTouchIntent', () => {
  it('しきい値に満たない動きでは向きを決めない', () => {
    expect(classifyCaretSlotTouchIntent(3, 4)).toBe('pending');
    expect(classifyCaretSlotTouchIntent(CARET_TOUCH_DIRECTION_THRESHOLD_PX - 0.1, 0))
      .toBe('pending');
  });

  it('最初の動きが横向きなら選択とみなす', () => {
    expect(classifyCaretSlotTouchIntent(6, 0)).toBe('selection');
    expect(classifyCaretSlotTouchIntent(-8, 3)).toBe('selection');
  });

  it('縦向き、および斜め45度はスクロールに任せる', () => {
    expect(classifyCaretSlotTouchIntent(2, 7)).toBe('scroll');
    expect(classifyCaretSlotTouchIntent(6, 6)).toBe('scroll');
  });
});
