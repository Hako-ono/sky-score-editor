import { describe, expect, it } from 'vitest';

import {
  analyzeScoreLayers,
  getAudibleKeys,
  getInitialLayer,
  getKeyTogglePreviewKeys,
  getKeyLayerMembership,
  getOtherLayerKeys,
  getSelectedLayerKeys,
  shouldUseSecondHighlightColor,
} from '../scoreLayers.js';

const emptyGrid = () => ({ keys: [], layer2Keys: [] });

describe('scoreLayers', () => {
  it('譜面全体のレイヤー使用状況を判定する', () => {
    expect(analyzeScoreLayers([emptyGrid(), { keys: [2], layer2Keys: [] }])).toEqual({
      hasLayer1: true,
      hasLayer2: false,
      usesTwoLayers: false,
    });
    expect(analyzeScoreLayers([{ keys: [], layer2Keys: [4] }])).toEqual({
      hasLayer1: false,
      hasLayer2: true,
      usesTwoLayers: false,
    });
    expect(analyzeScoreLayers([{ keys: [0], layer2Keys: [] }, { keys: [], layer2Keys: [1] }])).toEqual({
      hasLayer1: true,
      hasLayer2: true,
      usesTwoLayers: true,
    });
    expect(analyzeScoreLayers([emptyGrid()])).toEqual({
      hasLayer1: false,
      hasLayer2: false,
      usesTwoLayers: false,
    });
  });

  it('読込直後の初期レイヤーは1優先で、2だけなら2になる', () => {
    expect(getInitialLayer([{ keys: [0], layer2Keys: [1] }])).toBe(1);
    expect(getInitialLayer([{ keys: [], layer2Keys: [1] }])).toBe(2);
    expect(getInitialLayer([emptyGrid()])).toBe(1);
  });

  it('単層譜面は初期レイヤーから切り替えた間だけ画面用の色2を使う', () => {
    expect(shouldUseSecondHighlightColor(false, 1, 1)).toBe(false);
    expect(shouldUseSecondHighlightColor(false, 2, 1)).toBe(true);
    expect(shouldUseSecondHighlightColor(false, 2, 2)).toBe(false);
    expect(shouldUseSecondHighlightColor(false, 1, 2)).toBe(true);
    expect(shouldUseSecondHighlightColor(true, 2, 1)).toBe(false);
  });

  it('選択中・非選択の配列を譜面全体の選択値から取得する', () => {
    const grid = { keys: [1, 5], layer2Keys: [2, 5] };

    expect(getSelectedLayerKeys(grid, 1)).toEqual([1, 5]);
    expect(getOtherLayerKeys(grid, 1)).toEqual([2, 5]);
    expect(getSelectedLayerKeys(grid, 2)).toEqual([2, 5]);
    expect(getOtherLayerKeys(grid, 2)).toEqual([1, 5]);
  });

  it('鍵盤編集の試聴は追加した1鍵だけを返し、削除時は鳴らさない', () => {
    const grid = { keys: [1, 5], layer2Keys: [2, 5] };

    expect(getKeyTogglePreviewKeys(grid, 3, 1)).toEqual([3]);
    expect(getKeyTogglePreviewKeys(grid, 1, 1)).toEqual([]);
    expect(getKeyTogglePreviewKeys(grid, 1, 2)).toEqual([1]);
    expect(getKeyTogglePreviewKeys(grid, 2, 2)).toEqual([]);
    expect(getKeyTogglePreviewKeys(null, 3, 1)).toEqual([]);
    expect(getKeyTogglePreviewKeys(grid, 15, 1)).toEqual([]);
    expect(getKeyTogglePreviewKeys(grid, 3, 3)).toEqual([]);
  });

  it('両レイヤーの和集合を重複除去・昇順で返す', () => {
    expect(getAudibleKeys({ keys: [7, 1, 7], layer2Keys: [4, 1] })).toEqual([1, 4, 7]);
    expect(getAudibleKeys({ keys: [], layer2Keys: [] })).toEqual([]);
  });

  it('鍵ごとの所属を選択側基準で4状態に分類する', () => {
    const grid = { keys: [1, 5], layer2Keys: [2, 5] };

    expect(getKeyLayerMembership(grid, 1, 1)).toBe('selected');
    expect(getKeyLayerMembership(grid, 2, 1)).toBe('other');
    expect(getKeyLayerMembership(grid, 5, 1)).toBe('both');
    expect(getKeyLayerMembership(grid, 9, 1)).toBe('none');
    expect(getKeyLayerMembership(grid, 1, 2)).toBe('other');
    expect(getKeyLayerMembership(grid, 2, 2)).toBe('selected');
  });
});
