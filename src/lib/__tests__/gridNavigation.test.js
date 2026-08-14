import { describe, it, expect } from 'vitest';

import {
  clampExpandedIndex,
  stepExpandedIndex,
  resolveSwipe,
  shouldStartDrag,
  dampDragOffset,
  SWIPE_THRESHOLD_PX,
  SWIPE_DRAG_ACTIVATE_PX,
} from '../gridNavigation.js';

describe('clampExpandedIndex', () => {
  it('範囲内の整数はそのまま返す', () => {
    expect(clampExpandedIndex(0, 5)).toBe(0);
    expect(clampExpandedIndex(2, 5)).toBe(2);
    expect(clampExpandedIndex(4, 5)).toBe(4);
  });

  it('-1 (拡大表示なし) はそのまま -1', () => {
    expect(clampExpandedIndex(-1, 5)).toBe(-1);
  });

  it('gridCount と同値・それ以上は範囲外', () => {
    expect(clampExpandedIndex(5, 5)).toBe(-1);
    expect(clampExpandedIndex(100, 5)).toBe(-1);
  });

  it('小数は -1', () => {
    expect(clampExpandedIndex(1.5, 5)).toBe(-1);
  });

  it('NaN は -1', () => {
    expect(clampExpandedIndex(NaN, 5)).toBe(-1);
  });

  it('文字列は -1', () => {
    expect(clampExpandedIndex('2', 5)).toBe(-1);
  });

  it('undefined は -1', () => {
    expect(clampExpandedIndex(undefined, 5)).toBe(-1);
  });

  it('gridCount が 0・負数・非数なら常に -1', () => {
    expect(clampExpandedIndex(0, 0)).toBe(-1);
    expect(clampExpandedIndex(0, -3)).toBe(-1);
    expect(clampExpandedIndex(0, NaN)).toBe(-1);
    expect(clampExpandedIndex(0, undefined)).toBe(-1);
  });
});

describe('stepExpandedIndex', () => {
  it('中間からの前後移動', () => {
    expect(stepExpandedIndex(2, 5, 1)).toBe(3);
    expect(stepExpandedIndex(2, 5, -1)).toBe(1);
  });

  it('先頭で前へ進むと null', () => {
    expect(stepExpandedIndex(0, 5, -1)).toBeNull();
  });

  it('末尾で次へ進むと null', () => {
    expect(stepExpandedIndex(4, 5, 1)).toBeNull();
  });

  it('1件しかないときは前後とも null', () => {
    expect(stepExpandedIndex(0, 1, 1)).toBeNull();
    expect(stepExpandedIndex(0, 1, -1)).toBeNull();
  });

  it('delta が 1 / -1 以外なら null', () => {
    expect(stepExpandedIndex(2, 5, 2)).toBeNull();
    expect(stepExpandedIndex(2, 5, 0)).toBeNull();
  });

  it('index が範囲外なら null', () => {
    expect(stepExpandedIndex(-1, 5, 1)).toBeNull();
    expect(stepExpandedIndex(10, 5, 1)).toBeNull();
  });
});

describe('resolveSwipe', () => {
  it('しきい値ちょうど手前は 0 (スワイプとみなさない)', () => {
    expect(resolveSwipe(-(SWIPE_THRESHOLD_PX - 1), 0)).toBe(0);
  });

  it('しきい値ちょうどは有効', () => {
    expect(resolveSwipe(-SWIPE_THRESHOLD_PX, 0)).toBe(1);
  });

  it('しきい値を超えると有効', () => {
    expect(resolveSwipe(-(SWIPE_THRESHOLD_PX + 10), 0)).toBe(1);
  });

  it('左へ払うと次へ (1)', () => {
    expect(resolveSwipe(-60, 0)).toBe(1);
  });

  it('右へ払うと前へ (-1)', () => {
    expect(resolveSwipe(60, 0)).toBe(-1);
  });

  it('縦の動きが横の1.2倍を超えていれば 0', () => {
    expect(resolveSwipe(50, 50)).toBe(0);
  });

  it('NaN・非有限は 0', () => {
    expect(resolveSwipe(NaN, 0)).toBe(0);
    expect(resolveSwipe(60, Infinity)).toBe(0);
    expect(resolveSwipe(undefined, 0)).toBe(0);
  });
});

describe('shouldStartDrag', () => {
  it('しきい値未満は false', () => {
    expect(shouldStartDrag(SWIPE_DRAG_ACTIVATE_PX - 1, 0)).toBe(false);
  });

  it('しきい値ちょうどは false (絶対値が縦を上回る必要がある)', () => {
    // absDx <= absDy と同値 (dy=0) なので、ちょうどでも縦条件次第
    expect(shouldStartDrag(SWIPE_DRAG_ACTIVATE_PX, 0)).toBe(true);
  });

  it('しきい値を超えると true', () => {
    expect(shouldStartDrag(SWIPE_DRAG_ACTIVATE_PX + 5, 0)).toBe(true);
  });

  it('縦の動きが横以上なら false (縦スクロールとみなす)', () => {
    expect(shouldStartDrag(10, 10)).toBe(false);
    expect(shouldStartDrag(10, 20)).toBe(false);
  });

  it('負方向でも横優位なら true', () => {
    expect(shouldStartDrag(-20, 2)).toBe(true);
  });

  it('NaN・非有限は false', () => {
    expect(shouldStartDrag(NaN, 0)).toBe(false);
    expect(shouldStartDrag(20, Infinity)).toBe(false);
    expect(shouldStartDrag(undefined, 0)).toBe(false);
  });
});

describe('dampDragOffset', () => {
  it('canMove が true ならそのまま返す', () => {
    expect(dampDragOffset(50, true)).toBe(50);
    expect(dampDragOffset(-50, true)).toBe(-50);
  });

  it('canMove が false なら 0.3 倍に減衰する', () => {
    expect(dampDragOffset(50, false)).toBeCloseTo(15);
    expect(dampDragOffset(-50, false)).toBeCloseTo(-15);
  });

  it('0 はそのまま 0', () => {
    expect(dampDragOffset(0, true)).toBe(0);
    expect(dampDragOffset(0, false)).toBe(0);
  });

  it('NaN・非有限は 0', () => {
    expect(dampDragOffset(NaN, true)).toBe(0);
    expect(dampDragOffset(Infinity, false)).toBe(0);
    expect(dampDragOffset(undefined, true)).toBe(0);
  });
});
