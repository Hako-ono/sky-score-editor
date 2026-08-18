import { describe, it, expect, beforeEach } from 'vitest';

import { setLanguage } from '../../i18n/index.js';
import {
  getDefaultLyricSizePercent,
  layoutConfig,
  resolveLyricSizePercentOnLanguageChange,
} from '../../constants/config.js';
import { normalizePdfPrefs } from '../pdfPrefs.js';
import {
  DEFAULT_PDF_FONT_ID_BY_LANGUAGE,
  PDF_FONT_IDS_BY_LANGUAGE,
  getDefaultPdfFontIdForLanguage,
  getPdfFontIdsForLanguage,
  resolvePdfFont,
  resolvePdfTypography,
} from '../pdfTypography.js';

describe('言語別PDF書体レジストリ', () => {
  beforeEach(() => {
    setLanguage('ja');
  });

  it('言語ごとの書体一覧と既定値を持つ', () => {
    expect(PDF_FONT_IDS_BY_LANGUAGE).toEqual({
      ja: ['gothic', 'mincho', 'rounded'],
      en: ['dmSans'],
      'zh-Hans': ['sarasaSC'],
      'zh-Hant-TW': ['taipeiTC'],
      'zh-Hant-HK': ['chironHK'],
      ko: ['wantedSans'],
      th: ['plexThaiLooped'],
      vi: ['beVietnamPro'],
      ru: ['golosText'],
      pt: ['dmSans'],
      es: ['dmSans'],
      id: ['dmSans'],
    });
    for (const [language, fontIds] of Object.entries(PDF_FONT_IDS_BY_LANGUAGE)) {
      expect(fontIds).toContain(DEFAULT_PDF_FONT_ID_BY_LANGUAGE[language]);
      expect(getPdfFontIdsForLanguage(language)).toEqual(fontIds);
      expect(getDefaultPdfFontIdForLanguage(language)).toBe(
        DEFAULT_PDF_FONT_ID_BY_LANGUAGE[language],
      );
    }
  });

  it('言語に無い保存済み書体は出力時だけその言語の既定値へ解決する', () => {
    expect(resolvePdfFont('gothic', 'bold', 'en')).toMatchObject({
      fontId: 'dmSans',
      file: 'DMSans-Bold.ttf',
    });
    expect(resolvePdfFont('sarasaSC', 'regular', 'zh-Hant-HK')).toMatchObject({
      fontId: 'chironHK',
      file: 'ChironHeiHK-Regular.ttf',
    });
    expect(resolvePdfFont('gothic', 'bold', 'th')).toMatchObject({
      fontId: 'plexThaiLooped',
      file: 'IBMPlexSansThaiLooped-Bold.ttf',
    });
    expect(resolvePdfFont('gothic', 'regular', 'vi')).toMatchObject({
      fontId: 'beVietnamPro',
      file: 'BeVietnamPro-Regular.ttf',
    });
    expect(resolvePdfFont('gothic', 'bold', 'ru')).toMatchObject({
      fontId: 'golosText',
      file: 'GolosText-Bold.ttf',
    });
    expect(resolvePdfFont('gothic', 'bold', 'pt')).toMatchObject({
      fontId: 'dmSans',
      file: 'DMSans-Bold.ttf',
    });
    expect(resolvePdfFont('golosText', 'regular', 'ru')).toMatchObject({
      fontId: 'golosText',
      file: 'GolosText-Regular.ttf',
    });
  });

  it('保存層は表示言語に関係なく既知のfontIdを保持する', () => {
    setLanguage('en');

    expect(normalizePdfPrefs({ fontId: 'gothic', fontWeightId: 'bold' })).toMatchObject({
      fontId: 'gothic',
      fontWeightId: 'bold',
    });
  });

  it('言語別書体のRegular/Boldを有効なファイルへ解決する', () => {
    for (const [language, fontIds] of Object.entries(PDF_FONT_IDS_BY_LANGUAGE)) {
      for (const fontId of fontIds) {
        for (const fontWeightId of ['regular', 'bold']) {
          expect(resolvePdfFont(fontId, fontWeightId, language).file).toMatch(/\.ttf$/u);
        }
      }
    }
  });
});

describe('言語別の歌詞サイズ既定値', () => {
  beforeEach(() => {
    setLanguage('ja');
  });

  it('タイ語だけ既定値を下げ、他言語は100%のままにする', () => {
    expect(getDefaultLyricSizePercent('th')).toBe(71);
    for (const language of [
      'ja', 'en', 'zh-Hans', 'zh-Hant-TW', 'zh-Hant-HK', 'ko', 'vi', 'ru', 'pt', 'es', 'id',
    ]) {
      expect(getDefaultLyricSizePercent(language)).toBe(100);
    }
  });

  it('未知の言語とnullは100%へ落ちる', () => {
    expect(getDefaultLyricSizePercent(null)).toBe(100);
    expect(getDefaultLyricSizePercent('xx')).toBe(100);
  });

  it('既定値は現在のグリッド寸法で収まる上限を超えない', () => {
    // 鍵盤セル下端205からグリッド枠下端275までの70単位から、上下3単位ずつの
    // クリアランスを引いた64単位に、実測した最大の字面1.976emが収まること。
    const usableUnits = layoutConfig.gridBaseHeight - 205 - 3 * 2;
    const maxThaiInkEm = 1.976;
    const maxFontSizePt = usableUnits / maxThaiInkEm;
    const defaultLyricMaxPt = (45 * getDefaultLyricSizePercent('th')) / 100;

    expect(defaultLyricMaxPt).toBeLessThanOrEqual(maxFontSizePt);
  });

  it('歌詞サイズの指定が無いときだけ言語別の既定値を使う', () => {
    expect(resolvePdfTypography({ language: 'th' }).lyricSizePercent).toBe(71);
    expect(resolvePdfTypography({ language: 'ja' }).lyricSizePercent).toBe(100);
    // 明示された値は言語に関係なくそのまま使う（保存値を書き換えない）
    expect(resolvePdfTypography({ language: 'th', lyricSizePercent: 100 }).lyricSizePercent)
      .toBe(100);
    expect(resolvePdfTypography({ language: 'ja', lyricSizePercent: 71 }).lyricSizePercent)
      .toBe(71);
  });

  it('保存層は言語を見ずに100%を既定値として扱う', () => {
    setLanguage('th');

    expect(normalizePdfPrefs({}).lyricSizePercent).toBe(100);
    expect(normalizePdfPrefs({ lyricSizePercent: 120 }).lyricSizePercent).toBe(120);
  });
});

describe('言語切替時の歌詞サイズの追従', () => {
  it('切替前の既定値のままなら新しい言語の既定値へ移す', () => {
    // 端末が英語のタイ語話者が、手動でタイ語へ切り替えた場合
    expect(resolveLyricSizePercentOnLanguageChange(100, 'en', 'th')).toBe(71);
    expect(resolveLyricSizePercentOnLanguageChange(100, 'ja', 'th')).toBe(71);
    // タイ語から戻る場合も同じ規則で戻す
    expect(resolveLyricSizePercentOnLanguageChange(71, 'th', 'ja')).toBe(100);
    expect(resolveLyricSizePercentOnLanguageChange(71, 'th', 'vi')).toBe(100);
  });

  it('利用者が決めた値は言語を切り替えても書き換えない', () => {
    expect(resolveLyricSizePercentOnLanguageChange(120, 'ja', 'th')).toBe(120);
    expect(resolveLyricSizePercentOnLanguageChange(70, 'ja', 'th')).toBe(70);
    expect(resolveLyricSizePercentOnLanguageChange(90, 'th', 'ja')).toBe(90);
  });

  it('既定値が同じ言語どうしの切替では何も変えない', () => {
    for (const percent of [70, 100, 130]) {
      expect(resolveLyricSizePercentOnLanguageChange(percent, 'ja', 'en')).toBe(percent);
      expect(resolveLyricSizePercentOnLanguageChange(percent, 'ko', 'ru')).toBe(percent);
    }
  });

  it('同じ言語への切替では何も変えない', () => {
    expect(resolveLyricSizePercentOnLanguageChange(71, 'th', 'th')).toBe(71);
    expect(resolveLyricSizePercentOnLanguageChange(100, 'ja', 'ja')).toBe(100);
  });
});
