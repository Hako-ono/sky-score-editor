import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  edgeScrollDelta,
  resolveCaretTargetAtPoint,
  resolveGridIndexAtPoint,
  resolveNearestCaretAtPoint,
} from '../rangePointer.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function virtualGridStore() {
  return {
    getGridCount: () => 12,
    getRows: () => [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
    ],
    getRowPitch: () => 100,
    getColumns: () => 4,
  };
}

function stubVirtualCanvas() {
  const canvas = {
    getBoundingClientRect: () => ({ top: 200, left: 100, width: 400 }),
    querySelectorAll: () => [],
  };
  vi.stubGlobal('document', {
    elementsFromPoint: () => [],
    querySelector: () => canvas,
  });
  vi.stubGlobal('window', { scrollY: 100 });
}

describe('rangePointer', () => {
  it('画面端への近さに応じて上下の自動スクロール量を返す', () => {
    expect(edgeScrollDelta(360, 720)).toBe(0);
    expect(edgeScrollDelta(0, 720)).toBe(-8);
    expect(edgeScrollDelta(720, 720)).toBe(8);
    expect(edgeScrollDelta(36, 720)).toBe(-4);
  });

  it('未マウント行でも行ピッチと列数から対象グリッドを求める', () => {
    stubVirtualCanvas();
    expect(resolveGridIndexAtPoint(250, 350, virtualGridStore())).toBe(5);
    expect(resolveGridIndexAtPoint(490, 550, virtualGridStore())).toBe(11);
  });

  it('未マウント行のグリッド位置を固定側と比較してキャレット境界へ変換する', () => {
    stubVirtualCanvas();
    expect(resolveCaretTargetAtPoint(250, 350, virtualGridStore(), 8)).toEqual({
      index: 5,
      placement: 'before',
    });
    expect(resolveCaretTargetAtPoint(490, 550, virtualGridStore(), 2)).toEqual({
      index: 12,
      placement: 'after',
    });
  });

  it('カードの左右どちらを押したかで最寄りのキャレット境界を求める', () => {
    const grid = {
      dataset: { gridIndex: '3' },
      getBoundingClientRect: () => ({ left: 100, width: 200 }),
    };
    vi.stubGlobal('document', {
      elementsFromPoint: () => [{ closest: () => grid }],
      querySelector: () => null,
    });
    vi.stubGlobal('window', { scrollY: 0 });
    expect(resolveNearestCaretAtPoint(140, 200, virtualGridStore())).toEqual({
      index: 3,
      placement: 'before',
    });
    expect(resolveNearestCaretAtPoint(260, 200, virtualGridStore())).toEqual({
      index: 4,
      placement: 'before',
    });
  });

  it('行間や未マウント行でも列内の左右から最寄り境界を求める', () => {
    stubVirtualCanvas();
    expect(resolveNearestCaretAtPoint(200, 350, virtualGridStore())).toEqual({
      index: 5,
      placement: 'before',
    });
    expect(resolveNearestCaretAtPoint(490, 550, virtualGridStore())).toEqual({
      index: 12,
      placement: 'after',
    });
  });
});
