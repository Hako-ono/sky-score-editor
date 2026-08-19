/**
 * PDF出力設定をlocalStorageへ保存する薄いラッパーと、保存値・共有値の
 * 両方から使う純粋な正規化をまとめる。楽譜JSONとは別の設定として扱う。
 */

import {
  PDF_PREFS_STORAGE_KEY,
  PDF_PRESETS,
  PDF_SHEET_LAYOUTS,
  DEFAULT_PRESET_ID,
  DEFAULT_FONT_ID,
  DEFAULT_FONT_WEIGHT_ID,
  DEFAULT_GRID_NUMBER_DISPLAY_ID,
  DEFAULT_SHEET_LAYOUT_ID,
  DEFAULT_SCORE_INFO_DESIGN_ID,
  DEFAULT_MASTHEAD_DIRECTION_ID,
  DEFAULT_TEMPO_VALUE_MODE_ID,
  DEFAULT_CUSTOM_TEMPO_VALUE,
  DEFAULT_PAGE_MARGIN_ID,
  DEFAULT_GRID_GAP_ID,
  DEFAULT_COLUMNS_PER_PAGE_ID,
  DEFAULT_ROW_SHADING_ID,
  DEFAULT_KEY_NOTATION_ID,
  DEFAULT_KEY_MODE_NOTATION_ID,
  CUSTOM_PRESET_ID,
  PDF_LAYOUT_RANGES,
  DEFAULT_PNG_DPI,
  DEFAULT_PREVIEW_AUTO_UPDATE,
  getDefaultLyricSizePercent,
  normalizeKeyNotationId,
  normalizeKeyModeNotationId,
  resolvePdfScoreInfoDesign,
  normalizeTempoValueModeId,
  sanitizeCustomTempoValue,
  sanitizeCustomSeed,
  sanitizeCustomTokens,
  normalizePngDpi,
  normalizePreviewAutoUpdate,
  pdfConfig,
} from '../constants/config.js';
import { resolvePdfTypography } from './pdfTypography.js';
import { getLanguage } from '../i18n/index.js';
import { resolvePdfPageFurniture } from './pdfPageFurniture.js';
import { resolvePdfDensity } from './pdfDensity.js';
import {
  DEFAULT_PDF_GRID_STYLE_CUSTOM,
  DEFAULT_PDF_GRID_STYLE_ID,
  PDF_GRID_STYLES,
  sanitizePdfGridStyleCustom,
} from './pdfGridStyle.js';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function defaults() {
  return {
    presetId: DEFAULT_PRESET_ID,
    fontId: DEFAULT_FONT_ID,
    fontWeightId: DEFAULT_FONT_WEIGHT_ID,
    titleFontSizePt: pdfConfig.titleFontSizePt,
    metaFontSizePt: pdfConfig.metaFontSizePt,
    maxRowsPerPage: pdfConfig.maxRowsPerPage,
    lyricSizePercent: 100,
    gridNumberSizePercent: 100,
    gridNumberDisplayId: DEFAULT_GRID_NUMBER_DISPLAY_ID,
    pageNumberFontSizePt: pdfConfig.pageNumberFontSizePt,
    sheetLayoutId: DEFAULT_SHEET_LAYOUT_ID,
    columnsPerPageId: DEFAULT_COLUMNS_PER_PAGE_ID,
    rowShadingId: DEFAULT_ROW_SHADING_ID,
    scoreInfoDesignId: DEFAULT_SCORE_INFO_DESIGN_ID,
    mastheadDirectionId: DEFAULT_MASTHEAD_DIRECTION_ID,
    tempoValueModeId: DEFAULT_TEMPO_VALUE_MODE_ID,
    customTempoValue: DEFAULT_CUSTOM_TEMPO_VALUE,
    pageMarginId: DEFAULT_PAGE_MARGIN_ID,
    gridGapId: DEFAULT_GRID_GAP_ID,
    keyNotationId: DEFAULT_KEY_NOTATION_ID,
    keyModeNotationId: DEFAULT_KEY_MODE_NOTATION_ID,
    pngDpi: DEFAULT_PNG_DPI,
    previewAutoUpdate: DEFAULT_PREVIEW_AUTO_UPDATE,
    ...resolvePdfPageFurniture(),
    gridStyleId: DEFAULT_PDF_GRID_STYLE_ID,
    gridStyleCustom: { ...DEFAULT_PDF_GRID_STYLE_CUSTOM },
    // 詳細モードを開く前でも既定値が要るため、printの種色を初期値とする。
    custom: sanitizeCustomSeed(undefined),
    // 「詳細色2」は無指定が既定。キーが無いトークンは導出値のまま使う
    customTokens: {},
  };
}

function sanitizeGridStyleId(value, fallback) {
  return value === 'custom' || Object.prototype.hasOwnProperty.call(PDF_GRID_STYLES, value)
    ? value
    : fallback;
}

/**
 * 任意入力を、許可されたキーだけを持つ完全なpdfPrefsへ正規化する。
 * 各設定の既存resolverを通すことで、欠落・型違い・範囲外をキー単位で
 * 既定値へ戻し、古い保存形式の移行も同じ経路に集約する。
 */
export function normalizePdfPrefs(value) {
  const source = isRecord(value) ? value : {};
  const fallback = defaults();
  // 保存層は表示言語を持たないため、既知のfontIdを言語別の既定値へ
  // 置き換えず、共有URL・localStorageの値をそのまま保持する。
  const typography = resolvePdfTypography({ ...source, language: null });
  const pageFurniture = resolvePdfPageFurniture(source);
  const density = resolvePdfDensity(source);
  const scoreInfo = resolvePdfScoreInfoDesign(source);

  return {
    presetId:
      source.presetId === CUSTOM_PRESET_ID ||
      Object.prototype.hasOwnProperty.call(PDF_PRESETS, source.presetId)
        ? source.presetId
        : fallback.presetId,
    fontId: typography.fontId,
    fontWeightId: typography.fontWeightId,
    titleFontSizePt: typography.titleFontSizePt,
    metaFontSizePt: typography.metaFontSizePt,
    maxRowsPerPage: typography.maxRowsPerPage,
    lyricSizePercent: typography.lyricSizePercent,
    gridNumberSizePercent: typography.gridNumberSizePercent,
    gridNumberDisplayId: typography.gridNumberDisplayId,
    pageNumberFontSizePt: typography.pageNumberFontSizePt,
    sheetLayoutId: Object.prototype.hasOwnProperty.call(PDF_SHEET_LAYOUTS, source.sheetLayoutId)
      ? source.sheetLayoutId
      : fallback.sheetLayoutId,
    columnsPerPageId: density.columnsPerPageId,
    rowShadingId: density.rowShadingId,
    ...scoreInfo,
    tempoValueModeId: normalizeTempoValueModeId(source.tempoValueModeId),
    customTempoValue: sanitizeCustomTempoValue(source.customTempoValue),
    pageMarginId: density.pageMarginId,
    gridGapId: density.gridGapId,
    keyNotationId: normalizeKeyNotationId(source.keyNotationId),
    keyModeNotationId: normalizeKeyModeNotationId(source.keyModeNotationId),
    pngDpi: normalizePngDpi(source.pngDpi),
    previewAutoUpdate: normalizePreviewAutoUpdate(source.previewAutoUpdate),
    ...pageFurniture,
    gridStyleId: sanitizeGridStyleId(source.gridStyleId, fallback.gridStyleId),
    gridStyleCustom: sanitizePdfGridStyleCustom(source.gridStyleCustom),
    custom: sanitizeCustomSeed(source.custom),
    customTokens: sanitizeCustomTokens(source.customTokens),
  };
}

/**
 * 正規化済み設定から保存・共有に許可するキーだけを、固定順で構築する。
 * spreadで入力オブジェクトを返さないことで、背景画像などの一時値を混ぜない。
 */
export function serializePdfPrefs(prefs) {
  const normalized = normalizePdfPrefs(prefs);
  return {
    presetId: normalized.presetId,
    fontId: normalized.fontId,
    fontWeightId: normalized.fontWeightId,
    titleFontSizePt: normalized.titleFontSizePt,
    metaFontSizePt: normalized.metaFontSizePt,
    maxRowsPerPage: normalized.maxRowsPerPage,
    lyricSizePercent: normalized.lyricSizePercent,
    gridNumberSizePercent: normalized.gridNumberSizePercent,
    gridNumberDisplayId: normalized.gridNumberDisplayId,
    pageNumberFontSizePt: normalized.pageNumberFontSizePt,
    sheetLayoutId: normalized.sheetLayoutId,
    columnsPerPageId: normalized.columnsPerPageId,
    rowShadingId: normalized.rowShadingId,
    scoreInfoDesignId: normalized.scoreInfoDesignId,
    mastheadDirectionId: normalized.mastheadDirectionId,
    tempoValueModeId: normalized.tempoValueModeId,
    customTempoValue: normalized.customTempoValue,
    pageMarginId: normalized.pageMarginId,
    gridGapId: normalized.gridGapId,
    keyNotationId: normalized.keyNotationId,
    keyModeNotationId: normalized.keyModeNotationId,
    pngDpi: normalized.pngDpi,
    previewAutoUpdate: normalized.previewAutoUpdate,
    pageNumberFormatId: normalized.pageNumberFormatId,
    pageNumberPositionId: normalized.pageNumberPositionId,
    runningHeaderId: normalized.runningHeaderId,
    footerCreditId: normalized.footerCreditId,
    gridStyleId: normalized.gridStyleId,
    gridStyleCustom: normalized.gridStyleCustom,
    custom: normalized.custom,
    customTokens: normalized.customTokens,
  };
}

/** 保存済み設定をJSON parse後に純粋な正規化へ渡す薄いラッパー。 */
function hasStoredLyricSizePercent(source) {
  if (!isRecord(source)) return false;
  const { min, max } = PDF_LAYOUT_RANGES.lyricSizePercent;
  const value = source.lyricSizePercent;
  return Number.isInteger(value) && value >= min && value <= max;
}

export function loadPdfPrefs() {
  let stored;
  try {
    const raw = localStorage.getItem(PDF_PREFS_STORAGE_KEY);
    stored = raw ? JSON.parse(raw) : undefined;
  } catch {
    stored = undefined;
  }

  const prefs = normalizePdfPrefs(stored);
  // 歌詞サイズだけは、保存値が無いときに限り表示言語の既定値を入れる
  // （タイ文字は上下に記号を積むため、既定の100%ではグリッドからはみ出す。
  // 根拠は config.js の LYRIC_SIZE_PERCENT_BY_LANGUAGE 参照）。
  // 保存値がある場合は言語を切り替えても書き換えない。日本語UIで決めた値が
  // 別言語UIへ移っただけで失われると、戻したときに復元できないため。
  if (!hasStoredLyricSizePercent(stored)) {
    prefs.lyricSizePercent = getDefaultLyricSizePercent(getLanguage());
  }
  return prefs;
}

/** localStorageの利用可否をUI経路から切り離す薄いラッパー。 */
export function savePdfPrefs(prefs) {
  try {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify(serializePdfPrefs(prefs)),
    );
  } catch {
    // プライベートブラウズ・容量超過では今回のPDF生成だけを妨げない。
  }
}
