import { describe, it, expect } from 'vitest';

import {
  getCustomSeedDetailKeys,
  getCustomSeedLabel,
} from '../Toolbar.jsx';

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
