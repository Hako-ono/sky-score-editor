import {
  DEFAULT_FONT_ID,
  DEFAULT_FONT_WEIGHT_ID,
  DEFAULT_GRID_NUMBER_DISPLAY_ID,
  PDF_FONTS,
  PDF_FONT_WEIGHTS,
  PDF_GRID_NUMBER_DISPLAYS,
  PDF_LAYOUT_RANGES,
  pdfConfig,
} from '../constants/config.js';

const DEFAULT_LYRIC_MIN_FONT_SIZE_PT = 10;
const DEFAULT_LYRIC_MAX_FONT_SIZE_PT = 45;
const DEFAULT_GRID_NUMBER_FONT_SIZE_PT = 11;

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
export function resolvePdfFont(fontId, fontWeightId) {
  const safeFontId = Object.prototype.hasOwnProperty.call(PDF_FONTS, fontId)
    ? fontId
    : DEFAULT_FONT_ID;
  const safeWeightId = Object.prototype.hasOwnProperty.call(PDF_FONT_WEIGHTS, fontWeightId)
    ? fontWeightId
    : DEFAULT_FONT_WEIGHT_ID;
  const family = PDF_FONTS[safeFontId];
  const selected = family[safeWeightId];

  return {
    fontId: safeFontId,
    fontWeightId: safeWeightId,
    label: family.label,
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
  const font = resolvePdfFont(source.fontId, source.fontWeightId);
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
    100,
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
