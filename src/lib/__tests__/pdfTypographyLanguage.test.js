import { describe, it, expect, beforeEach } from 'vitest';

import { setLanguage } from '../../i18n/index.js';
import { normalizePdfPrefs } from '../pdfPrefs.js';
import {
  DEFAULT_PDF_FONT_ID_BY_LANGUAGE,
  PDF_FONT_IDS_BY_LANGUAGE,
  getDefaultPdfFontIdForLanguage,
  getPdfFontIdsForLanguage,
  resolvePdfFont,
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
