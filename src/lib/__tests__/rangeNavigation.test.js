import { describe, expect, it } from 'vitest';
import { findPhraseCaret } from '../rangeNavigation.js';

const grids = (breaks) => Array.from({ length: 10 }, (_, index) => ({
  forceBreakAfter: breaks.includes(index),
}));

describe('findPhraseCaret', () => {
  it('現在位置より前後にある強制改行直後のキャレットへ移る', () => {
    const score = grids([2, 6]);
    expect(findPhraseCaret(score, 5, -1)).toBe(3);
    expect(findPhraseCaret(score, 5, 1)).toBe(7);
    expect(findPhraseCaret(score, 7, -1)).toBe(3);
  });

  it('最初のフレーズでは先頭へ戻り、次のフレーズが無ければ移動しない', () => {
    const score = grids([2]);
    expect(findPhraseCaret(score, 2, -1)).toBe(0);
    expect(findPhraseCaret(score, 3, 1)).toBe(-1);
    expect(findPhraseCaret(score, 0, -1)).toBe(-1);
  });

  it('末尾の強制改行は空のフレーズ先頭として扱わない', () => {
    expect(findPhraseCaret(grids([9]), 5, 1)).toBe(-1);
  });
});
