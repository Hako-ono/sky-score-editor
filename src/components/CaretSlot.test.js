import { describe, expect, it } from 'vitest';
import {
  shouldDeferCaretDragToCanvas,
  shouldPlaceCaretFromClick,
} from './CaretSlot.jsx';

describe('shouldPlaceCaretFromClick', () => {
  it('タッチでは不可視の隙間からも見えているつまみからもキャレットを置ける', () => {
    expect(shouldPlaceCaretFromClick(false, 'touch', 1)).toBe(true);
    expect(shouldPlaceCaretFromClick(true, 'touch', 1)).toBe(true);
  });

  it('マウスとキーボードからのキャレット移動はそのまま通す', () => {
    expect(shouldPlaceCaretFromClick(true, 'mouse', 1)).toBe(true);
    expect(shouldPlaceCaretFromClick(true, '', 0)).toBe(true);
  });
});

describe('shouldDeferCaretDragToCanvas', () => {
  it('一覧側へ委ねるのは、キャレットの立っていない隙間からのタッチドラッグだけ', () => {
    expect(shouldDeferCaretDragToCanvas(false, 'touch')).toBe(true);
    expect(shouldDeferCaretDragToCanvas(true, 'touch')).toBe(false);
    expect(shouldDeferCaretDragToCanvas(false, 'mouse')).toBe(false);
  });
});
