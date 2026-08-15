import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PDF_GRID_STYLE_CUSTOM,
  DEFAULT_PDF_GRID_STYLE_ID,
  PDF_GRID_STYLES,
  PDF_GRID_STYLE_CUSTOM_RANGES,
  derivePdfGridEdgePadding,
  resolvePdfGridStyle,
  sanitizePdfGridStyleCustom,
} from '../pdfGridStyle.js';

const STYLE_KEYS = [
  'outerRadius',
  'cellRadius',
  'symbolRadius',
  'outerStrokeWidth',
  'cellStrokeWidth',
  'symbolStrokeWidth',
];

describe('PDFグリッドスタイルのプリセット', () => {
  it.each(Object.entries(PDF_GRID_STYLES))('%s は6つの形状値を持つ', (_id, style) => {
    expect(Object.keys(style).sort()).toEqual(['label', ...STYLE_KEYS].sort());
  });

  it('標準値は現在のPDF描画値と一致する', () => {
    expect(resolvePdfGridStyle({ gridStyleId: DEFAULT_PDF_GRID_STYLE_ID })).toEqual({
      id: 'standard',
      outerRadius: 5,
      cellRadius: 5,
      symbolRadius: 0,
      outerStrokeWidth: 1,
      cellStrokeWidth: 1,
      symbolStrokeWidth: 2.5,
    });
  });

  it('ふんわりだけ記号の角丸3を使う', () => {
    expect(PDF_GRID_STYLES.soft.label).toBe('ふんわり');
    expect(resolvePdfGridStyle({ gridStyleId: 'soft' }).symbolRadius).toBe(3);
    expect(resolvePdfGridStyle({ gridStyleId: 'standard' }).symbolRadius).toBe(0);
    expect(resolvePdfGridStyle({ gridStyleId: 'bold' }).symbolRadius).toBe(0);
    expect(resolvePdfGridStyle({ gridStyleId: 'minimal' }).symbolRadius).toBe(0);
  });

  it('未知のidは標準へフォールバックする', () => {
    expect(resolvePdfGridStyle({ gridStyleId: 'unknown' })).toEqual({
      id: 'standard',
      ...DEFAULT_PDF_GRID_STYLE_CUSTOM,
    });
  });
});

describe('sanitizePdfGridStyleCustom', () => {
  it('全キーの境界値を受け入れる', () => {
    const value = Object.fromEntries(
      Object.entries(PDF_GRID_STYLE_CUSTOM_RANGES).map(([key, range]) => [
        key,
        range.max,
      ]),
    );
    expect(sanitizePdfGridStyleCustom(value)).toEqual(value);
  });

  it('刻みに合わない値・範囲外・非数値・NaNをキーごとに標準へ戻す', () => {
    const result = sanitizePdfGridStyleCustom({
      outerRadius: 0.5,
      cellRadius: 31,
      symbolRadius: 17,
      outerStrokeWidth: 1.25,
      cellStrokeWidth: '1',
      symbolStrokeWidth: NaN,
    });
    expect(result).toEqual(DEFAULT_PDF_GRID_STYLE_CUSTOM);
  });

  it('欠落・null・配列でも標準値を返す', () => {
    expect(sanitizePdfGridStyleCustom()).toEqual(DEFAULT_PDF_GRID_STYLE_CUSTOM);
    expect(sanitizePdfGridStyleCustom(null)).toEqual(DEFAULT_PDF_GRID_STYLE_CUSTOM);
    expect(sanitizePdfGridStyleCustom([])).toEqual(DEFAULT_PDF_GRID_STYLE_CUSTOM);
  });

  it('入力オブジェクトを変更しない', () => {
    const input = { ...DEFAULT_PDF_GRID_STYLE_CUSTOM, outerRadius: 12 };
    const before = { ...input };
    sanitizePdfGridStyleCustom(input);
    expect(input).toEqual(before);
  });
});

describe('resolvePdfGridStyle', () => {
  it('customでは検証済みのカスタム値を返し、idはcustomのままにする', () => {
    const custom = { ...DEFAULT_PDF_GRID_STYLE_CUSTOM, outerRadius: 30 };
    expect(resolvePdfGridStyle({ gridStyleId: 'custom', gridStyleCustom: custom })).toEqual({
      id: 'custom',
      ...custom,
    });
  });

  it('プリセット選択時は保存済みcustomを上書きしない', () => {
    const custom = { ...DEFAULT_PDF_GRID_STYLE_CUSTOM, outerRadius: 30 };
    expect(resolvePdfGridStyle({ gridStyleId: 'soft', gridStyleCustom: custom })).toEqual({
      id: 'soft',
      outerRadius: PDF_GRID_STYLES.soft.outerRadius,
      cellRadius: PDF_GRID_STYLES.soft.cellRadius,
      symbolRadius: PDF_GRID_STYLES.soft.symbolRadius,
      outerStrokeWidth: PDF_GRID_STYLES.soft.outerStrokeWidth,
      cellStrokeWidth: PDF_GRID_STYLES.soft.cellStrokeWidth,
      symbolStrokeWidth: PDF_GRID_STYLES.soft.symbolStrokeWidth,
    });
  });
});

describe('derivePdfGridEdgePadding', () => {
  it('標準・最小・最大線幅から安全域を導出する', () => {
    expect(derivePdfGridEdgePadding(resolvePdfGridStyle({ gridStyleId: 'standard' }))).toBe(6);
    expect(derivePdfGridEdgePadding(resolvePdfGridStyle({ gridStyleId: 'minimal' }))).toBe(5);
    expect(derivePdfGridEdgePadding(resolvePdfGridStyle({
      gridStyleId: 'custom',
      gridStyleCustom: {
        ...DEFAULT_PDF_GRID_STYLE_CUSTOM,
        outerStrokeWidth: 6,
        cellStrokeWidth: 5,
        symbolStrokeWidth: 6,
      },
    }))).toBe(7);
  });
});
