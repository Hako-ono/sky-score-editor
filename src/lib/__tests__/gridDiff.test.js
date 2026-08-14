import { describe, it, expect } from 'vitest';

import { diffGrids } from '../gridDiff.js';

function makeGrid(overrides = {}) {
  return { keys: [], text: '', forceBreakAfter: false, ...overrides };
}

describe('diffGrids', () => {
  it('同一参照なら変化なし', () => {
    const grids = [makeGrid(), makeGrid()];
    expect(diffGrids(grids, grids)).toEqual({ changedIndices: [], structureChanged: false });
  });

  it('1件だけ差し替えると、その index だけ changed・structureChanged は false', () => {
    const prev = [makeGrid(), makeGrid(), makeGrid()];
    const next = [prev[0], makeGrid({ text: 'a' }), prev[2]];
    expect(diffGrids(prev, next)).toEqual({ changedIndices: [1], structureChanged: false });
  });

  it('forceBreakAfter だけ変更すると changed かつ structureChanged: true', () => {
    const prev = [makeGrid({ forceBreakAfter: false })];
    const next = [makeGrid({ forceBreakAfter: true })];
    expect(diffGrids(prev, next)).toEqual({ changedIndices: [0], structureChanged: true });
  });

  it('末尾に1件追加すると structureChanged: true になり、追加された index が changed に入る', () => {
    const prev = [makeGrid(), makeGrid()];
    const next = [prev[0], prev[1], makeGrid()];
    const result = diffGrids(prev, next);
    expect(result.structureChanged).toBe(true);
    expect(result.changedIndices).toEqual([2]);
  });

  it('先頭に1件挿入すると全 index が changed になる', () => {
    const prev = [makeGrid(), makeGrid()];
    const next = [makeGrid(), prev[0], prev[1]];
    const result = diffGrids(prev, next);
    expect(result.structureChanged).toBe(true);
    expect(result.changedIndices).toEqual([0, 1, 2]);
  });

  it('3000件のうち中央1件だけ差し替えると changedIndices の長さは1', () => {
    const prev = Array.from({ length: 3000 }, () => makeGrid());
    const next = prev.slice();
    next[1500] = makeGrid({ text: 'changed' });
    const result = diffGrids(prev, next);
    expect(result.changedIndices).toHaveLength(1);
    expect(result.changedIndices).toEqual([1500]);
    expect(result.structureChanged).toBe(false);
  });

  it('縮んだとき、消えた index も changedIndices に含まれる', () => {
    const prev = [makeGrid(), makeGrid(), makeGrid()];
    const next = [prev[0]];
    const result = diffGrids(prev, next);
    expect(result.structureChanged).toBe(true);
    expect(result.changedIndices).toEqual([1, 2]);
  });

  it('prevGrids が undefined なら全件 changed', () => {
    const next = [makeGrid(), makeGrid(), makeGrid()];
    const result = diffGrids(undefined, next);
    expect(result.structureChanged).toBe(true);
    expect(result.changedIndices).toEqual([0, 1, 2]);
  });

  it('prevGrids が null でも全件 changed', () => {
    const next = [makeGrid()];
    const result = diffGrids(null, next);
    expect(result.structureChanged).toBe(true);
    expect(result.changedIndices).toEqual([0]);
  });
});
