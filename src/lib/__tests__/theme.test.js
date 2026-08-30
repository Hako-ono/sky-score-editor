import { describe, expect, it } from 'vitest';
import {
  normalizeThemePreference,
  resolveTheme,
} from '../theme.js';

describe('テーマ設定', () => {
  it('未知の値はシステム追従へ丸める', () => {
    expect(normalizeThemePreference(null)).toBe('system');
    expect(normalizeThemePreference('sepia')).toBe('system');
  });

  it('対応する設定は保ち、システム追従はOSのテーマから解決する', () => {
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('dark')).toBe('dark');
    expect(normalizeThemePreference('system')).toBe('system');
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
  });

});
