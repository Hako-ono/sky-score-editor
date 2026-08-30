import { describe, expect, it } from 'vitest';

import {
  computeLongScrollFrameRatio,
  computeVirtualScrollSample,
  countVirtualRangeSwaps,
} from '../debugMetrics.js';

describe('computeLongScrollFrameRatio', () => {
  it('長いフレーム数を総サンプル数に対する比率へ変換する', () => {
    expect(computeLongScrollFrameRatio(12, 80)).toBe(0.15);
  });

  it('サンプルが無い場合と不正値は0へ倒す', () => {
    expect(computeLongScrollFrameRatio(0, 0)).toBe(0);
    expect(computeLongScrollFrameRatio(-1, 10)).toBe(0);
  });

  it('壊れた記録で100%を超えない', () => {
    expect(computeLongScrollFrameRatio(11, 10)).toBe(1);
  });
});

describe('computeVirtualScrollSample', () => {
  it('最初のサンプルは速度0で、フレーム間隔を計測しない', () => {
    expect(computeVirtualScrollSample({
      previousTimestamp: undefined,
      previousScrollY: undefined,
      timestamp: 100,
      scrollY: 500,
    })).toEqual({ speedPxPerSec: 0, frameMs: null });
  });

  it('連続するrAF間の絶対スクロール速度とフレーム間隔を返す', () => {
    expect(computeVirtualScrollSample({
      previousTimestamp: 100,
      previousScrollY: 500,
      timestamp: 120,
      scrollY: 700,
    })).toEqual({ speedPxPerSec: 10_000, frameMs: 20 });
  });

  it('上向きスクロールも正の速度として返す', () => {
    expect(computeVirtualScrollSample({
      previousTimestamp: 100,
      previousScrollY: 700,
      timestamp: 150,
      scrollY: 500,
    })).toEqual({ speedPxPerSec: 4_000, frameMs: 50 });
  });

  it('250msを超える中断は別操作として扱う', () => {
    expect(computeVirtualScrollSample({
      previousTimestamp: 100,
      previousScrollY: 500,
      timestamp: 351,
      scrollY: 1_500,
    })).toEqual({ speedPxPerSec: 0, frameMs: null });
  });

  it('時刻または位置が有限数でなければ計測しない', () => {
    expect(computeVirtualScrollSample({
      previousTimestamp: 100,
      previousScrollY: 500,
      timestamp: NaN,
      scrollY: 700,
    })).toBeNull();
  });
});

describe('countVirtualRangeSwaps', () => {
  it('同じ範囲なら入れ替えは0件', () => {
    expect(countVirtualRangeSwaps(0, 80, 0, 80)).toBe(0);
  });

  it('一部重なる範囲では、外れた件数と入った件数の合計を返す', () => {
    expect(countVirtualRangeSwaps(0, 80, 20, 100)).toBe(40);
  });

  it('重ならない範囲では両方の件数の合計を返す', () => {
    expect(countVirtualRangeSwaps(0, 80, 200, 260)).toBe(140);
  });

  it('包含関係にある範囲では差分だけを返す', () => {
    expect(countVirtualRangeSwaps(20, 60, 0, 80)).toBe(40);
  });

  it('不正な範囲は0件として扱う', () => {
    expect(countVirtualRangeSwaps(-1, 80, 0, 80)).toBe(0);
    expect(countVirtualRangeSwaps(0.5, 80, 0, 80)).toBe(0);
    expect(countVirtualRangeSwaps(80, 0, 0, 80)).toBe(0);
  });
});
