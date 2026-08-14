import { describe, it, expect } from 'vitest';

import {
  GRID_CELL_SHAPES,
  createCombinedSymbolPath,
  createRoundedDiamondPath,
  gridColorState,
  cellColorState,
} from '../gridShapes.js';
import { SYMBOL_TYPES } from '../../constants/config.js';

describe('GRID_CELL_SHAPES', () => {
  it('要素数が15である', () => {
    expect(GRID_CELL_SHAPES).toHaveLength(15);
  });

  it('各要素の記号の種類が SYMBOL_TYPES と一致し、cdも1つの複合pathである', () => {
    GRID_CELL_SHAPES.forEach((cell, i) => {
      expect(cell.symbols).toHaveLength(1);
      const expectedKind = SYMBOL_TYPES[i] === 'cd'
        ? 'path'
        : SYMBOL_TYPES[i] === 'd'
        ? 'polygon'
        : 'circle';
      expect(cell.symbols[0].kind).toBe(expectedKind);
    });
  });

  it('呼び出しをまたいで同じ参照である（定数であることの担保）', async () => {
    const mod = await import('../gridShapes.js');
    expect(mod.GRID_CELL_SHAPES).toBe(GRID_CELL_SHAPES);
  });
});

describe('cellColorState', () => {
  it('該当indexが押されていれば highlight', () => {
    expect(cellColorState([3], 3)).toBe('highlight');
  });

  it('該当indexが押されていなければ plain', () => {
    expect(cellColorState([3], 4)).toBe('plain');
  });
});

describe('gridColorState', () => {
  it('無音かつ無歌詞なら empty', () => {
    expect(gridColorState([])).toBe('empty');
  });

  it('keysが1件以上なら filled', () => {
    expect(gridColorState([0])).toBe('filled');
  });

  it('歌詞だけでも filled', () => {
    expect(gridColorState([], '歌詞')).toBe('filled');
  });
});

describe('角丸記号のパス', () => {
  it('角丸0では従来のひし形を返す', () => {
    expect(createRoundedDiamondPath(0)).toBe('M 0 -25 L 25 0 L 0 25 L -25 0 Z');
  });

  it('角丸を指定すると4頂点を曲線にする', () => {
    const path = createRoundedDiamondPath(8);
    expect(path.match(/ Q /g)).toHaveLength(4);
    expect(path).toContain('Q 0 -25');
    expect(path).toMatch(/ Z$/);
  });

  it('複合記号は角丸時もひし形と円を1つのパスに保つ', () => {
    const path = createCombinedSymbolPath(8);
    expect(path.match(/ Q /g)).toHaveLength(4);
    expect(path.match(/ A 18 18 /g)).toHaveLength(2);
    expect(path).toContain('Z M 18 0');
  });

  it('不正値は角丸0へ戻し、巨大値は形状が交差しない上限へ丸める', () => {
    expect(createRoundedDiamondPath(NaN)).toBe(createRoundedDiamondPath(0));
    expect(createRoundedDiamondPath(-1)).toBe(createRoundedDiamondPath(0));
    expect(createRoundedDiamondPath(100)).toBe(createRoundedDiamondPath(25 / Math.SQRT2));
  });
});
