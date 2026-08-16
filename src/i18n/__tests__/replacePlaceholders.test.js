import { describe, expect, it } from 'vitest';

import { replacePlaceholders } from '../replacePlaceholders.js';

describe('replacePlaceholders', () => {
  it('プレースホルダが無い文字列はそのまま返す', () => {
    const text = 'そのままの文章';

    expect(replacePlaceholders(text, { link: 'リンク' })).toBe(text);
  });

  it('複数のプレースホルダを指定した値へ置き換える', () => {
    expect(replacePlaceholders('前{first}中{second}後', {
      first: '<a>',
      second: '</a>',
    })).toEqual(['前', '<a>', '中', '</a>', '後']);
  });

  it('未知のプレースホルダは文字列として残す', () => {
    expect(replacePlaceholders('前{known}中{unknown}後', { known: '既知' }))
      .toEqual(['前', '既知', '中', '{unknown}', '後']);
  });
});
