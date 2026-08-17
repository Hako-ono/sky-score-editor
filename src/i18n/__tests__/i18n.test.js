import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../dict/ja.js', () => ({
  default: {
    ui: {
      test: {
        greeting: 'こんにちは、{name}さん',
      },
    },
    pdf: {},
  },
}));

vi.mock('../dict/zh-Hant-TW.js', () => ({
  default: {
    ui: {
      test: {
        traditional: '繁体字辞書の値',
      },
    },
    pdf: {},
  },
}));

vi.mock('../dict/zh-Hant-HK.js', () => ({
  default: {
    ui: {},
    pdf: {},
  },
}));

import {
  detectLanguage,
  getLanguage,
  initializeLanguage,
  LANGUAGE_STORAGE_KEY,
  setLanguage,
  setLanguagePreference,
  t,
} from '../index.js';

afterEach(() => {
  setLanguage('ja');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function installLocalStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  const storage = {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    removeItem: vi.fn((key) => values.delete(key)),
  };
  vi.stubGlobal('localStorage', storage);
  return storage;
}

describe('i18n', () => {
  it('既定言語はjaである', () => {
    expect(getLanguage()).toBe('ja');
  });

  it('ドット区切りのキーで辞書を参照できる', () => {
    expect(t('ui.test.greeting', { name: '星の子' })).toBe('こんにちは、星の子さん');
  });

  it('値を文字列化してプレースホルダーへ埋め込める', () => {
    expect(t('ui.test.greeting', { name: 3 })).toBe('こんにちは、3さん');
  });

  it('保存キーが無ければ自動判定へ従う', () => {
    installLocalStorage();

    expect(initializeLanguage(['ko-KR'])).toBe('ko');
    expect(getLanguage()).toBe('ko');
  });

  it('有効な保存値があれば自動判定より優先する', () => {
    installLocalStorage({ [LANGUAGE_STORAGE_KEY]: 'en' });

    expect(initializeLanguage(['ko-KR'])).toBe('en');
    expect(getLanguage()).toBe('en');
  });

  it('無効な保存値は自動判定へ戻る', () => {
    installLocalStorage({ [LANGUAGE_STORAGE_KEY]: 'not-supported' });

    expect(initializeLanguage(['ko-KR'])).toBe('ko');
    expect(getLanguage()).toBe('ko');
  });

  it('手動設定を保存し、自動へ戻すと保存キーを削除する', () => {
    const storage = installLocalStorage();

    expect(setLanguagePreference('en')).toBe('en');
    expect(storage.setItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY, 'en');

    expect(setLanguagePreference('auto', ['ko-KR'])).toBe('ko');
    expect(storage.removeItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY);
  });

  it('localStorageが例外を投げても言語処理は継続する', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => { throw new Error('blocked'); }),
      setItem: vi.fn(() => { throw new Error('blocked'); }),
      removeItem: vi.fn(() => { throw new Error('blocked'); }),
    });

    expect(() => initializeLanguage(['en-US'])).not.toThrow();
    expect(() => setLanguagePreference('ko')).not.toThrow();
    expect(() => setLanguagePreference('auto', ['ja-JP'])).not.toThrow();
    expect(getLanguage()).toBe('ja');
  });

  it('現在の言語にないキーは日本語辞書へフォールバックする', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setLanguage('en');

    expect(t('ui.test.greeting', { name: '星の子' })).toBe('こんにちは、星の子さん');
    expect(warn).not.toHaveBeenCalled();
  });

  it('台湾・香港の繁体字言語はzh-Hant辞書を共有する', () => {
    setLanguage('zh-Hant-HK');

    expect(t('ui.test.traditional')).toBe('繁体字辞書の値');
  });

  it('未定義キーは警告を出してキー文字列を返す', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(t('ui.missing.label')).toBe('ui.missing.label');
    expect(warn).toHaveBeenCalledWith('[i18n] Missing translation key: ui.missing.label');
  });

  it.each([
    [['ja-JP'], 'ja'],
    [['en-US'], 'en'],
    [['ko-KR'], 'ko'],
    [['th'], 'th'],
    [['th-TH'], 'th'],
    [['vi'], 'vi'],
    [['vi-VN'], 'vi'],
    [['ru'], 'ru'],
    [['ru-RU'], 'ru'],
    [['ru-UA'], 'ru'],
    [['zh-CN'], 'zh-Hans'],
    [['zh-TW'], 'zh-Hant-TW'],
    [['zh-HK'], 'zh-Hant-HK'],
    [['zh-MO'], 'zh-Hant-HK'],
    [['zh-SG'], 'zh-Hans'],
    [['zh-Hans-HK'], 'zh-Hans'],
    [['zh-Hant-CN'], 'zh-Hant-TW'],
    [['zh-Hant'], 'zh-Hant-TW'],
    [['zh'], 'zh-Hans'],
    [['fr-FR'], 'ja'],
    [[], 'ja'],
    [['fr', 'en'], 'en'],
  ])('候補から表示言語を判定する: %j -> %s', (candidates, expected) => {
    expect(detectLanguage(candidates)).toBe(expected);
  });
});
