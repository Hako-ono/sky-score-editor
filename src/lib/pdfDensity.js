/**
 * PDF本文の余白・グリッド間隔を解決する純粋な設定関数。
 * UI、localStorage、PDF出力の各経路で同じ実効値を使うために分離している。
 */

import {
  PDF_PAGE_MARGINS,
  PDF_GRID_GAPS,
  DEFAULT_PAGE_MARGIN_ID,
  DEFAULT_GRID_GAP_ID,
} from '../constants/config.js';

function knownId(values, value, fallback) {
  return Object.prototype.hasOwnProperty.call(values, value) ? value : fallback;
}

/** 保存値・直接呼び出しのどちらからも、既知のidだけを採用する。 */
export function resolvePdfDensity(options = {}) {
  const pageMarginId = knownId(
    PDF_PAGE_MARGINS,
    options.pageMarginId,
    DEFAULT_PAGE_MARGIN_ID,
  );
  const gridGapId = knownId(PDF_GRID_GAPS, options.gridGapId, DEFAULT_GRID_GAP_ID);
  const margin = PDF_PAGE_MARGINS[pageMarginId];
  const gap = PDF_GRID_GAPS[gridGapId];

  return {
    pageMarginId,
    gridGapId,
    marginPt: margin.marginPt,
    gridHorizontalSpacing: gap.horizontalPt,
    gridVerticalSpacing: gap.verticalPt,
  };
}

/**
 * グリッドの列数・行数と実効間隔から、SVGブロックの寸法を求める。
 * SVG生成とドキュメント全体の縮尺計算の唯一の計算元にする。
 */
export function computeGridBlockSize({
  columns,
  rows,
  gridBaseWidth,
  gridBaseHeight,
  gridHorizontalSpacing,
  gridVerticalSpacing,
  edgePadding = 0,
}) {
  const columnPitch = gridBaseWidth + gridHorizontalSpacing;
  const rowPitch = gridBaseHeight + gridVerticalSpacing;
  const rawSvgWidth =
    columns * gridBaseWidth + Math.max(0, columns - 1) * gridHorizontalSpacing;
  const rawSvgHeight =
    rows * gridBaseHeight + Math.max(0, rows - 1) * gridVerticalSpacing;
  const safeEdgePadding = Number.isFinite(edgePadding) && edgePadding >= 0
    ? edgePadding
    : 0;
  return {
    rawSvgWidth,
    rawSvgHeight,
    svgWidth: rawSvgWidth + 2 * safeEdgePadding,
    svgHeight: rawSvgHeight + 2 * safeEdgePadding,
    columnPitch,
    rowPitch,
    edgePadding: safeEdgePadding,
  };
}
