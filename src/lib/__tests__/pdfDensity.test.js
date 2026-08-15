import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COLUMNS_PER_PAGE_ID,
  DEFAULT_ROW_SHADING_ID,
  DEFAULT_GRID_GAP_ID,
  DEFAULT_PAGE_MARGIN_ID,
} from '../../constants/config.js';
import { computeGridBlockSize, resolvePdfDensity } from '../pdfDensity.js';

describe('resolvePdfDensity', () => {
  it('未指定・未知のidは標準値へ戻る', () => {
    expect(resolvePdfDensity()).toEqual({
      pageMarginId: DEFAULT_PAGE_MARGIN_ID,
      gridGapId: DEFAULT_GRID_GAP_ID,
      columnsPerPageId: DEFAULT_COLUMNS_PER_PAGE_ID,
      rowShadingId: DEFAULT_ROW_SHADING_ID,
      marginPt: 40,
      gridHorizontalSpacing: 30,
      gridVerticalSpacing: 80,
    });
    expect(resolvePdfDensity({
      pageMarginId: 'unknown',
      gridGapId: 42,
      columnsPerPageId: 'col9',
      rowShadingId: 'odd',
    })).toEqual(resolvePdfDensity());
  });

  it('余白と間隔を独立して解決する', () => {
    expect(resolvePdfDensity({ pageMarginId: 'wide', gridGapId: 'tight' })).toEqual({
      pageMarginId: 'wide',
      gridGapId: 'tight',
      columnsPerPageId: DEFAULT_COLUMNS_PER_PAGE_ID,
      rowShadingId: DEFAULT_ROW_SHADING_ID,
      marginPt: 64,
      gridHorizontalSpacing: 12,
      gridVerticalSpacing: 45,
    });
  });

  it('列数・網掛けのidは余白・間隔と独立に保つ', () => {
    expect(resolvePdfDensity({ columnsPerPageId: 'col8' })).toEqual({
      ...resolvePdfDensity(),
      columnsPerPageId: 'col8',
    });
    expect(resolvePdfDensity({ rowShadingId: 'even' })).toEqual({
      ...resolvePdfDensity(),
      rowShadingId: 'even',
    });
  });
});

describe('computeGridBlockSize', () => {
  const base = {
    gridBaseWidth: 350,
    gridBaseHeight: 275,
  };

  it('0行・1行では間隔を加えない', () => {
    expect(
      computeGridBlockSize({ ...base, columns: 4, rows: 0, gridHorizontalSpacing: 30, gridVerticalSpacing: 80 }),
    ).toEqual({
      rawSvgWidth: 1490,
      rawSvgHeight: 0,
      svgWidth: 1490,
      svgHeight: 0,
      columnPitch: 380,
      rowPitch: 355,
      edgePadding: 0,
    });
    expect(
      computeGridBlockSize({ ...base, columns: 4, rows: 1, gridHorizontalSpacing: 30, gridVerticalSpacing: 80 }),
    ).toEqual({
      rawSvgWidth: 1490,
      rawSvgHeight: 275,
      svgWidth: 1490,
      svgHeight: 275,
      columnPitch: 380,
      rowPitch: 355,
      edgePadding: 0,
    });
  });

  it('3列・4列と3段階の間隔を同じ式で計算する', () => {
    expect(
      computeGridBlockSize({ ...base, columns: 3, rows: 2, gridHorizontalSpacing: 12, gridVerticalSpacing: 45 }),
    ).toEqual({
      rawSvgWidth: 1074,
      rawSvgHeight: 595,
      svgWidth: 1074,
      svgHeight: 595,
      columnPitch: 362,
      rowPitch: 320,
      edgePadding: 0,
    });
    expect(
      computeGridBlockSize({ ...base, columns: 4, rows: 6, gridHorizontalSpacing: 56, gridVerticalSpacing: 130 }),
    ).toEqual({
      rawSvgWidth: 1568,
      rawSvgHeight: 2300,
      svgWidth: 1568,
      svgHeight: 2300,
      columnPitch: 406,
      rowPitch: 405,
      edgePadding: 0,
    });
  });

  it('パディングはpitchを変えず、寸法の両端へだけ加える', () => {
    expect(
      computeGridBlockSize({
        ...base,
        columns: 2,
        rows: 2,
        gridHorizontalSpacing: 30,
        gridVerticalSpacing: 80,
        edgePadding: 6,
      }),
    ).toEqual({
      rawSvgWidth: 730,
      rawSvgHeight: 630,
      svgWidth: 742,
      svgHeight: 642,
      columnPitch: 380,
      rowPitch: 355,
      edgePadding: 6,
    });
  });
});
