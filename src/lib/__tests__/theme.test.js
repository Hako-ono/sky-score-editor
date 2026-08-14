import { describe, expect, it } from 'vitest';
import {
  normalizeThemePreference,
  resolveTheme,
} from '../theme.js';

describe('theme preferences', () => {
  it('defaults unknown values to system', () => {
    expect(normalizeThemePreference(null)).toBe('system');
    expect(normalizeThemePreference('sepia')).toBe('system');
  });

  it('keeps supported preferences and resolves system from the OS theme', () => {
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('dark')).toBe('dark');
    expect(normalizeThemePreference('system')).toBe('system');
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
  });

});
