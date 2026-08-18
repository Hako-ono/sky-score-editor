import ja from './dict/ja.js';
import en from './dict/en.js';
import zhHans from './dict/zh-Hans.js';
import zhHantTW from './dict/zh-Hant-TW.js';
import zhHantHK from './dict/zh-Hant-HK.js';
import ko from './dict/ko.js';
import th from './dict/th.js';
import vi from './dict/vi.js';
import ru from './dict/ru.js';
import pt from './dict/pt.js';
import es from './dict/es.js';
import id from './dict/id.js';

const DEFAULT_LANGUAGE = 'ja';
export const LANGUAGE_STORAGE_KEY = 'sky-score-editor:lang:v1';
export const SUPPORTED_LANGUAGES = [
  'ja',
  'en',
  'zh-Hans',
  'zh-Hant-TW',
  'zh-Hant-HK',
  'ko',
  'th',
  'vi',
  'ru',
  'pt',
  'es',
  'id',
];
export const LANGUAGE_AUTO = 'auto';
export const LANGUAGE_OPTIONS = [
  { value: LANGUAGE_AUTO },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'zh-Hant-TW', label: '繁體中文（台灣）' },
  { value: 'zh-Hant-HK', label: '繁體中文（香港）' },
  { value: 'ko', label: '한국어' },
  { value: 'th', label: 'ไทย' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'ru', label: 'Русский' },
  { value: 'pt', label: 'Português' },
  { value: 'es', label: 'Español' },
  { value: 'id', label: 'Bahasa Indonesia' },
];
const dictionaries = {
  ja,
  en,
  'zh-Hans': zhHans,
  'zh-Hant-TW': zhHantTW,
  'zh-Hant-HK': zhHantHK,
  ko,
  th,
  vi,
  ru,
  pt,
  es,
  id,
};
const fallbackLanguagesByLanguage = {
  ja: ['ja'],
  en: ['en', 'ja'],
  'zh-Hans': ['zh-Hans', 'ja'],
  'zh-Hant-TW': ['zh-Hant-TW', 'ja'],
  'zh-Hant-HK': ['zh-Hant-HK', 'zh-Hant-TW', 'ja'],
  ko: ['ko', 'ja'],
  th: ['th', 'ja'],
  vi: ['vi', 'ja'],
  ru: ['ru', 'ja'],
  pt: ['pt', 'ja'],
  es: ['es', 'ja'],
  id: ['id', 'ja'],
};
let currentLanguage = DEFAULT_LANGUAGE;
const ZH_TAIWAN_REGIONS = new Set(['tw']);
const ZH_HONG_KONG_REGIONS = new Set(['hk', 'mo']);
const ZH_SIMPLIFIED_REGIONS = new Set(['cn', 'sg']);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isSupportedLanguage(language) {
  return typeof language === 'string' && hasOwn(fallbackLanguagesByLanguage, language);
}

function readStoredLanguage() {
  try {
    const storedLanguage = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(storedLanguage) ? storedLanguage : null;
  } catch {
    return null;
  }
}

export function getLanguagePreference() {
  return readStoredLanguage();
}

function writeStoredLanguage(language) {
  try {
    globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorageが使えない環境でも言語切替自体は適用する
  }
}

function removeStoredLanguage() {
  try {
    globalThis.localStorage?.removeItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // localStorageが使えない環境でも自動判定への切替自体は適用する
  }
}

function resolveKey(dictionary, key) {
  return key.split('.').reduce((value, part) => {
    if (!value || typeof value !== 'object' || !hasOwn(value, part)) return undefined;
    return value[part];
  }, dictionary);
}

function getDefaultLanguageCandidates() {
  const browserNavigator = globalThis.navigator;
  if (!browserNavigator) return [];
  if (Array.isArray(browserNavigator.languages) && browserNavigator.languages.length > 0) {
    return browserNavigator.languages;
  }
  if (typeof browserNavigator.language === 'string' && browserNavigator.language) {
    return [browserNavigator.language];
  }
  return [];
}

function parseLanguageTag(candidate) {
  if (typeof candidate !== 'string') return null;
  const tag = candidate.trim().replace(/_/g, '-');
  if (!tag) return null;
  const primary = tag.split('-')[0].toLowerCase();
  const hasSupportedPrimary = SUPPORTED_LANGUAGES.some((language) => (
    language === primary || language.startsWith(`${primary}-`)
  ));
  if (!hasSupportedPrimary) return null;
  return { primary, tag };
}

function getExplicitRegion(tag) {
  return tag
    .toLowerCase()
    .split('-')
    .slice(1)
    .find((subtag) => /^[a-z]{2}$/u.test(subtag) || /^\d{3}$/u.test(subtag)) ?? null;
}

function getExplicitScript(tag) {
  return tag
    .toLowerCase()
    .split('-')
    .slice(1)
    .find((subtag) => /^[a-z]{4}$/u.test(subtag)) ?? null;
}

function resolveChineseLanguage(tag) {
  const explicitRegion = getExplicitRegion(tag);
  const explicitScript = getExplicitScript(tag);
  if (explicitScript === 'hans') return 'zh-Hans';
  if (explicitScript === 'hant') {
    return ZH_HONG_KONG_REGIONS.has(explicitRegion)
      ? 'zh-Hant-HK'
      : 'zh-Hant-TW';
  }
  if (ZH_TAIWAN_REGIONS.has(explicitRegion)) return 'zh-Hant-TW';
  if (ZH_HONG_KONG_REGIONS.has(explicitRegion)) return 'zh-Hant-HK';
  if (ZH_SIMPLIFIED_REGIONS.has(explicitRegion)) return 'zh-Hans';

  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Locale === 'function') {
      const locale = new Intl.Locale(tag).maximize();
      if (locale.script === 'Hant') {
        return ZH_HONG_KONG_REGIONS.has(locale.region?.toLowerCase())
          ? 'zh-Hant-HK'
          : 'zh-Hant-TW';
      }
      if (locale.script === 'Hans') return 'zh-Hans';
    }
  } catch {
    // 古いブラウザや不正なタグでは、下の固定対応表へ進む
  }

  const lowerTag = tag.toLowerCase();
  const subtags = lowerTag.split('-');
  if (subtags.includes('hant')) return 'zh-Hant-TW';
  return 'zh-Hans';
}

export function detectLanguage(candidates = getDefaultLanguageCandidates()) {
  const candidateList = Array.isArray(candidates) ? candidates : [candidates];
  for (const candidate of candidateList) {
    const parsed = parseLanguageTag(candidate);
    if (!parsed) continue;
    if (parsed.primary === 'ja') return 'ja';
    if (parsed.primary === 'en') return 'en';
    if (parsed.primary === 'ko') return 'ko';
    if (parsed.primary === 'th') return 'th';
    if (parsed.primary === 'vi') return 'vi';
    if (parsed.primary === 'ru') return 'ru';
    if (parsed.primary === 'pt') return 'pt';
    if (parsed.primary === 'es') return 'es';
    if (parsed.primary === 'id') return 'id';
    if (parsed.primary === 'zh') return resolveChineseLanguage(parsed.tag);
  }
  return DEFAULT_LANGUAGE;
}

export function t(key, params = {}) {
  const languagesToSearch = fallbackLanguagesByLanguage[currentLanguage]
    ?? fallbackLanguagesByLanguage[DEFAULT_LANGUAGE];
  let value;
  for (const language of languagesToSearch) {
    value = typeof key === 'string' ? resolveKey(dictionaries[language], key) : undefined;
    if (typeof value === 'string') break;
  }

  if (typeof value !== 'string') {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing translation key: ${String(key)}`);
    }
    return String(key);
  }

  return value.replace(/\{([^{}]+)\}/g, (match, name) => {
    if (!params || typeof params !== 'object' || !hasOwn(params, name)) return match;
    return String(params[name]);
  });
}

export function setLanguage(language) {
  currentLanguage = isSupportedLanguage(language)
    ? language
    : DEFAULT_LANGUAGE;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = currentLanguage;
  }
  return currentLanguage;
}

export function initializeLanguage(candidates) {
  const storedLanguage = readStoredLanguage();
  return setLanguage(storedLanguage ?? detectLanguage(candidates));
}

export function setLanguagePreference(language, candidates) {
  if (isSupportedLanguage(language)) {
    writeStoredLanguage(language);
    return setLanguage(language);
  }

  removeStoredLanguage();
  return setLanguage(detectLanguage(candidates));
}

export function getLanguage() {
  return currentLanguage;
}
