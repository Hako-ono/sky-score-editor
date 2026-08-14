import { describe, it, expect } from 'vitest';

import {
  DEFAULT_FONT_ID,
  DEFAULT_FONT_WEIGHT_ID,
  PDF_FONTS,
  pdfConfig,
} from '../../constants/config.js';
import { resolvePdfFont, resolvePdfTypography } from '../pdfTypography.js';

describe('resolvePdfFont', () => {
  it('既定値はゴシックのRegularである', () => {
    expect(resolvePdfFont()).toEqual({
      fontId: DEFAULT_FONT_ID,
      fontWeightId: DEFAULT_FONT_WEIGHT_ID,
      label: PDF_FONTS.gothic.label,
      flatGlyph: PDF_FONTS.gothic.flatGlyph,
      file: PDF_FONTS.gothic.regular.file,
      name: PDF_FONTS.gothic.regular.name,
    });
  });

  it('書体ごとにBoldのファイルと登録名を解決する', () => {
    for (const [fontId, family] of Object.entries(PDF_FONTS)) {
      expect(resolvePdfFont(fontId, 'bold')).toMatchObject({
        fontId,
        fontWeightId: 'bold',
        flatGlyph: family.flatGlyph,
        file: family.bold.file,
        name: family.bold.name,
      });
      expect(family.bold.file).not.toBe(family.regular.file);
      expect(family.bold.name).not.toBe(family.regular.name);
    }
  });

  it('明朝だけフラットをPDFで欠落させないASCII表記へ落とす', () => {
    expect(resolvePdfFont('gothic', 'regular').flatGlyph).toBe('♭');
    expect(resolvePdfFont('mincho', 'regular').flatGlyph).toBe('b');
    expect(resolvePdfFont('rounded', 'regular').flatGlyph).toBe('♭');
  });

  it('未知の書体とウェイトはそれぞれ既定値へ落ちる', () => {
    expect(resolvePdfFont('unknown', 'heavy')).toMatchObject({
      fontId: DEFAULT_FONT_ID,
      fontWeightId: DEFAULT_FONT_WEIGHT_ID,
      file: PDF_FONTS.gothic.regular.file,
    });
  });
});

describe('resolvePdfTypography', () => {
  it('既定値では曲名20pt・曲情報9ptと既存の派生値を使う', () => {
    expect(resolvePdfTypography()).toMatchObject({
      titleFontSizePt: 20,
      metaFontSizePt: 9,
      lyricSizePercent: 100,
      gridNumberSizePercent: 100,
      gridNumberDisplayId: 'show',
      pageNumberFontSizePt: pdfConfig.pageNumberFontSizePt,
      lyricMinFontSizePt: 10,
      lyricMaxFontSizePt: 45,
      gridNumberFontSizePt: 11,
    });
  });

  it('割合とページ番号サイズの境界値から実効サイズを導出する', () => {
    expect(
      resolvePdfTypography({
        lyricSizePercent: 70,
        gridNumberSizePercent: 140,
        pageNumberFontSizePt: 8,
      }),
    ).toMatchObject({
      lyricMinFontSizePt: 7,
      lyricMaxFontSizePt: 31.5,
      gridNumberFontSizePt: 15.4,
      pageNumberFontSizePt: 8,
    });
  });

  it('不正値はキーごとに既定値へ落ちる', () => {
    expect(
      resolvePdfTypography({
        titleFontSizePt: 9,
        metaFontSizePt: '9',
        lyricSizePercent: 70.5,
        gridNumberSizePercent: 141,
        pageNumberFontSizePt: 15,
        maxRowsPerPage: 2,
      }),
    ).toMatchObject({
      titleFontSizePt: 20,
      metaFontSizePt: 9,
      lyricSizePercent: 100,
      gridNumberSizePercent: 100,
      gridNumberDisplayId: 'show',
      pageNumberFontSizePt: 10,
      maxRowsPerPage: 6,
    });
  });

  it('グリッド番号の表示設定を解決し、未知値は表示へ戻す', () => {
    expect(resolvePdfTypography({ gridNumberDisplayId: 'none' })).toMatchObject({
      gridNumberDisplayId: 'none',
    });
    expect(resolvePdfTypography({ gridNumberDisplayId: 1 })).toMatchObject({
      gridNumberDisplayId: 'show',
    });
  });
});
