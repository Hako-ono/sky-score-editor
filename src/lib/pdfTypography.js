import {
  DEFAULT_FONT_ID,
  DEFAULT_FONT_WEIGHT_ID,
  DEFAULT_GRID_NUMBER_DISPLAY_ID,
  PDF_FONTS,
  PDF_FONT_WEIGHTS,
  PDF_GRID_NUMBER_DISPLAYS,
  PDF_LAYOUT_RANGES,
  getDefaultLyricSizePercent,
  pdfConfig,
} from '../constants/config.js';
import { getLanguage } from '../i18n/index.js';

const DEFAULT_LYRIC_MIN_FONT_SIZE_PT = 10;
const DEFAULT_LYRIC_MAX_FONT_SIZE_PT = 45;
const DEFAULT_GRID_NUMBER_FONT_SIZE_PT = 11;

export const PDF_FONT_IDS_BY_LANGUAGE = {
  ja: ['gothic', 'mincho', 'rounded'],
  en: ['dmSans'],
  'zh-Hans': ['sarasaSC'],
  'zh-Hant-TW': ['taipeiTC'],
  'zh-Hant-HK': ['chironHK'],
  ko: ['wantedSans'],
  th: ['plexThaiLooped'],
  vi: ['beVietnamPro'],
  ru: ['golosText'],
};

export const DEFAULT_PDF_FONT_ID_BY_LANGUAGE = {
  ja: 'gothic',
  en: 'dmSans',
  'zh-Hans': 'sarasaSC',
  'zh-Hant-TW': 'taipeiTC',
  'zh-Hant-HK': 'chironHK',
  ko: 'wantedSans',
  th: 'plexThaiLooped',
  vi: 'beVietnamPro',
  ru: 'golosText',
};

function normalizePdfFontLanguage(language) {
  if (Object.prototype.hasOwnProperty.call(PDF_FONT_IDS_BY_LANGUAGE, language)) {
    return language;
  }
  if (language === 'zh-Hant') return 'zh-Hant-TW';
  return 'ja';
}

export function getPdfFontIdsForLanguage(language) {
  return PDF_FONT_IDS_BY_LANGUAGE[normalizePdfFontLanguage(language)];
}

export function getDefaultPdfFontIdForLanguage(language) {
  return DEFAULT_PDF_FONT_ID_BY_LANGUAGE[normalizePdfFontLanguage(language)];
}

function intInRange(value, range, fallback) {
  if (!Number.isInteger(value) || value < range.min || value > range.max) {
    return fallback;
  }
  return value;
}

/**
 * 書体とウェイトを1つの登録情報へ解決する。フォントファイルは
 * 同時に複数保持せず、呼び出し側がこの戻り値だけをPDFへ渡す。
 */
export function resolvePdfFont(fontId, fontWeightId, language = null) {
  const isKnownFont = Object.prototype.hasOwnProperty.call(PDF_FONTS, fontId);
  const safeFontId = language === null
    ? (isKnownFont ? fontId : DEFAULT_FONT_ID)
    : isKnownFont && getPdfFontIdsForLanguage(language).includes(fontId)
      ? fontId
      : getDefaultPdfFontIdForLanguage(language);
  const safeWeightId = Object.prototype.hasOwnProperty.call(PDF_FONT_WEIGHTS, fontWeightId)
    ? fontWeightId
    : DEFAULT_FONT_WEIGHT_ID;
  const family = PDF_FONTS[safeFontId];
  const selected = family[safeWeightId];

  return {
    fontId: safeFontId,
    fontWeightId: safeWeightId,
    flatGlyph: family.flatGlyph,
    file: selected.file,
    name: selected.name,
  };
}

/**
 * PDFの文字設定と、描画側が使う実効サイズをキーごとに解決する。
 * localStorage経由だけでなくexportPdf()の直接呼び出しもこの関数を通すため、
 * 不正な値がjsPDFやSVGへ到達しない。
 */
export function resolvePdfTypography(options = {}) {
  const source = options ?? {};
  const language = Object.prototype.hasOwnProperty.call(source, 'language')
    ? source.language
    : getLanguage();
  const font = resolvePdfFont(source.fontId, source.fontWeightId, language);
  const titleFontSizePt = intInRange(
    source.titleFontSizePt,
    PDF_LAYOUT_RANGES.titleFontSizePt,
    pdfConfig.titleFontSizePt,
  );
  const metaFontSizePt = intInRange(
    source.metaFontSizePt,
    PDF_LAYOUT_RANGES.metaFontSizePt,
    pdfConfig.metaFontSizePt,
  );
  const lyricSizePercent = intInRange(
    source.lyricSizePercent,
    PDF_LAYOUT_RANGES.lyricSizePercent,
    getDefaultLyricSizePercent(language),
  );
  const gridNumberSizePercent = intInRange(
    source.gridNumberSizePercent,
    PDF_LAYOUT_RANGES.gridNumberSizePercent,
    100,
  );
  const gridNumberDisplayId = Object.prototype.hasOwnProperty.call(
    PDF_GRID_NUMBER_DISPLAYS,
    source.gridNumberDisplayId,
  )
    ? source.gridNumberDisplayId
    : DEFAULT_GRID_NUMBER_DISPLAY_ID;
  const pageNumberFontSizePt = intInRange(
    source.pageNumberFontSizePt,
    PDF_LAYOUT_RANGES.pageNumberFontSizePt,
    pdfConfig.pageNumberFontSizePt,
  );
  const maxRowsPerPage = intInRange(
    source.maxRowsPerPage,
    PDF_LAYOUT_RANGES.maxRowsPerPage,
    pdfConfig.maxRowsPerPage,
  );

  return {
    ...font,
    waveDashGlyph: PDF_FONTS[font.fontId].waveDashGlyph,
    titleFontSizePt,
    metaFontSizePt,
    lyricSizePercent,
    gridNumberSizePercent,
    gridNumberDisplayId,
    pageNumberFontSizePt,
    maxRowsPerPage,
    lyricMinFontSizePt: (DEFAULT_LYRIC_MIN_FONT_SIZE_PT * lyricSizePercent) / 100,
    lyricMaxFontSizePt: (DEFAULT_LYRIC_MAX_FONT_SIZE_PT * lyricSizePercent) / 100,
    gridNumberFontSizePt: (DEFAULT_GRID_NUMBER_FONT_SIZE_PT * gridNumberSizePercent) / 100,
  };
}
