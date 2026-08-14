export const THEME_PREFERENCES = ['system', 'light', 'dark'];

export function normalizeThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : 'system';
}

export function resolveTheme(preference, systemTheme) {
  return preference === 'system' ? systemTheme : preference;
}
