/**
 * PDF専用グリッドの形状設定。画面側のグリッド形状・線幅とは分離し、
 * PDFの設定保存とSVG生成が同じ実効値を使うための純粋なモデルにする。
 */

export const PDF_GRID_STYLES = {
  standard: {
    label: '標準',
    outerRadius: 5,
    cellRadius: 5,
    symbolRadius: 0,
    outerStrokeWidth: 1,
    cellStrokeWidth: 1,
    symbolStrokeWidth: 2.5,
  },
  soft: {
    label: 'やわらか',
    outerRadius: 18,
    cellRadius: 14,
    symbolRadius: 3,
    outerStrokeWidth: 1.5,
    cellStrokeWidth: 1.5,
    symbolStrokeWidth: 2.5,
  },
  bold: {
    label: 'どっしり',
    outerRadius: 8,
    cellRadius: 6,
    symbolRadius: 0,
    outerStrokeWidth: 4,
    cellStrokeWidth: 3.5,
    symbolStrokeWidth: 4.5,
  },
  minimal: {
    label: 'すっきり',
    outerRadius: 0,
    cellRadius: 0,
    symbolRadius: 0,
    outerStrokeWidth: 0,
    cellStrokeWidth: 0.75,
    symbolStrokeWidth: 1.5,
  },
};

export const DEFAULT_PDF_GRID_STYLE_ID = 'standard';

export const PDF_GRID_STYLE_CUSTOM_RANGES = {
  outerRadius: { min: 0, max: 30, step: 1 },
  cellRadius: { min: 0, max: 30, step: 1 },
  symbolRadius: { min: 0, max: 16, step: 1 },
  outerStrokeWidth: { min: 0, max: 6, step: 0.5 },
  cellStrokeWidth: { min: 0.5, max: 5, step: 0.5 },
  symbolStrokeWidth: { min: 0.5, max: 6, step: 0.5 },
};

const PDF_GRID_STYLE_KEYS = Object.keys(PDF_GRID_STYLE_CUSTOM_RANGES);

export const DEFAULT_PDF_GRID_STYLE_CUSTOM = {
  outerRadius: PDF_GRID_STYLES[DEFAULT_PDF_GRID_STYLE_ID].outerRadius,
  cellRadius: PDF_GRID_STYLES[DEFAULT_PDF_GRID_STYLE_ID].cellRadius,
  symbolRadius: PDF_GRID_STYLES[DEFAULT_PDF_GRID_STYLE_ID].symbolRadius,
  outerStrokeWidth: PDF_GRID_STYLES[DEFAULT_PDF_GRID_STYLE_ID].outerStrokeWidth,
  cellStrokeWidth: PDF_GRID_STYLES[DEFAULT_PDF_GRID_STYLE_ID].cellStrokeWidth,
  symbolStrokeWidth: PDF_GRID_STYLES[DEFAULT_PDF_GRID_STYLE_ID].symbolStrokeWidth,
};

function isValidStep(value, range) {
  const steps = Math.round((value - range.min) / range.step);
  return Math.abs(value - (range.min + steps * range.step)) < Number.EPSILON;
}

function isValidCustomValue(value, range) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= range.min &&
    value <= range.max &&
    isValidStep(value, range)
  );
}

/**
 * カスタム値をキーごとに検証する。不正な値だけを標準値へ戻し、
 * 呼び出し元の保存オブジェクトは変更しない。
 */
export function sanitizePdfGridStyleCustom(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = {};
  for (const key of PDF_GRID_STYLE_KEYS) {
    const range = PDF_GRID_STYLE_CUSTOM_RANGES[key];
    out[key] = isValidCustomValue(source[key], range)
      ? source[key]
      : DEFAULT_PDF_GRID_STYLE_CUSTOM[key];
  }
  return out;
}

/**
 * プリセットまたはカスタム設定から、PDF描画に使う形状値を1回だけ解決する。
 * 不明なidは標準へ戻し、customの各キーは個別に検証する。
 */
export function resolvePdfGridStyle({ gridStyleId, gridStyleCustom } = {}) {
  if (gridStyleId === 'custom') {
    return {
      id: 'custom',
      ...sanitizePdfGridStyleCustom(gridStyleCustom),
    };
  }

  const hasPreset = Object.prototype.hasOwnProperty.call(PDF_GRID_STYLES, gridStyleId);
  const style = hasPreset ? PDF_GRID_STYLES[gridStyleId] : PDF_GRID_STYLES[DEFAULT_PDF_GRID_STYLE_ID];
  return {
    id: hasPreset ? gridStyleId : DEFAULT_PDF_GRID_STYLE_ID,
    outerRadius: style.outerRadius,
    cellRadius: style.cellRadius,
    symbolRadius: style.symbolRadius,
    outerStrokeWidth: style.outerStrokeWidth,
    cellStrokeWidth: style.cellStrokeWidth,
    symbolStrokeWidth: style.symbolStrokeWidth,
  };
}

/** 解決済みの線幅から、外周strokeを切らないSVG座標系の安全域を求める。 */
export function derivePdfGridEdgePadding(gridStyle) {
  const maxStrokeWidth = Math.max(
    gridStyle.outerStrokeWidth,
    gridStyle.cellStrokeWidth,
    gridStyle.symbolStrokeWidth,
  );
  return Math.ceil(maxStrokeWidth / 2) + 4;
}
