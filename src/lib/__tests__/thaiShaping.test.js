import { describe, expect, it } from 'vitest';

import { shapeThai } from '../thaiShaping.js';

describe('タイ語のPDF向け最小シェイパー', () => {
  it('規則A: 上母音の直後の声調記号を上へ移動する', () => {
    expect(shapeThai('ที่')).toEqual([
      { text: 'ที', dx: 0, dy: 0 },
      { text: '่', dx: 0, dy: -0.34 },
    ]);
  });

  it('規則B: 上に伸びる土台の上記号を右へ移動する', () => {
    expect(shapeThai('ปิ')).toEqual([
      { text: 'ป', dx: 0, dy: 0 },
      { text: 'ิ', dx: 0.58, dy: 0 },
    ]);
  });

  it('規則C: 下に尾のある土台の下母音を下へ移動する', () => {
    expect(shapeThai('ญุ')).toEqual([
      { text: 'ญ', dx: 0, dy: 0 },
      { text: 'ุ', dx: 0, dy: 0.24 },
    ]);
  });

  it('規則に該当しない通常のタイ語は1要素で返す', () => {
    expect(shapeThai('ประเทศไทย')).toEqual([
      { text: 'ประเทศไทย', dx: 0, dy: 0 },
    ]);
    expect(shapeThai('ท่า')).toEqual([
      { text: 'ท่า', dx: 0, dy: 0 },
    ]);
  });

  it('タイ文字を含まない日本語・英語はそのまま1要素で返す', () => {
    expect(shapeThai('日本語')).toEqual([{ text: '日本語', dx: 0, dy: 0 }]);
    expect(shapeThai('English')).toEqual([{ text: 'English', dx: 0, dy: 0 }]);
  });
});
