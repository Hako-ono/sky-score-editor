import { describe, it, expect } from 'vitest';

import {
  getCustomSeedDetailKeys,
  getCustomSeedLabel,
  getCustomTokenRows,
  getCustomTokenLabel,
} from '../Toolbar.jsx';
import { CUSTOM_TOKEN_KEYS } from '../../constants/config.js';

describe('Toolbarの詳細色表示', () => {
  it('単層では詳細色を3項目に固定する', () => {
    expect(getCustomSeedDetailKeys(false)).toEqual(['surface', 'accent', 'accentLine']);
    expect(getCustomSeedLabel('accent', false)).toBe('押鍵面');
    expect(getCustomSeedLabel('accentLine', false)).toBe('押鍵枠');
  });

  it('二層では第1・第2の面と枠を5項目で表示する', () => {
    expect(getCustomSeedDetailKeys(true)).toEqual([
      'surface', 'accent', 'accentLine', 'accent2', 'accentLine2',
    ]);
    expect(getCustomSeedLabel('accent', true)).toBe('押鍵面1');
    expect(getCustomSeedLabel('accentLine', true)).toBe('押鍵枠1');
    expect(getCustomSeedLabel('accent2', true)).toBe('押鍵面2');
    expect(getCustomSeedLabel('accentLine2', true)).toBe('押鍵枠2');
  });
});

describe('Toolbarの詳細色2（上級者向け）', () => {
  it('1段目は3分割・2段目は2分割の2段に分ける', () => {
    expect(getCustomTokenRows(false)).toEqual([
      ['title', 'outerFrame', 'number'],
      ['symbol', 'symbolHighlight'],
    ]);
    expect(getCustomTokenLabel('symbolHighlight', false)).toBe('押鍵記号');
  });

  it('二層では2段目に押鍵記号2を足し、1・2に分けて表示する', () => {
    expect(getCustomTokenRows(true)).toEqual([
      ['title', 'outerFrame', 'number'],
      ['symbol', 'symbolHighlight', 'symbolHighlight2'],
    ]);
    expect(getCustomTokenLabel('symbolHighlight', true)).toBe('押鍵記号1');
    expect(getCustomTokenLabel('symbolHighlight2', true)).toBe('押鍵記号2');
  });

  it('種色で指定できるトークンは詳細色2に含めない', () => {
    // 二重に指定できる欄があると、どちらが効くのか利用者にも実装にも曖昧になる
    const shown = getCustomTokenRows(true).flat();
    for (const key of ['bg', 'ink', 'line', 'surface', 'accent', 'accentLine']) {
      expect(shown).not.toContain(key);
    }
  });

  it('CUSTOM_TOKEN_KEYS のトークンをすべて表示する（保存できて触れない色を作らない）', () => {
    expect(getCustomTokenRows(true).flat().sort()).toEqual([...CUSTOM_TOKEN_KEYS].sort());
  });
});
