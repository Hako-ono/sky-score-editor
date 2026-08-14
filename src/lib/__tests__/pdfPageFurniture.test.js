import { describe, it, expect } from 'vitest';
import {
  formatPageNumber,
  getPageFurniturePlacement,
  resolvePdfPageFurniture,
} from '../pdfPageFurniture.js';

const geometry = { pageWidthPt: 600, marginPt: 40 };

describe('resolvePdfPageFurniture', () => {
  it('未知idを項目ごとに既定値へ落とす', () => {
    expect(resolvePdfPageFurniture({
      pageNumberFormatId: 'bad',
      pageNumberPositionId: null,
      runningHeaderId: 1,
      footerCreditId: 'bad',
    })).toEqual({
      pageNumberFormatId: 'currentTotal',
      pageNumberPositionId: 'bottomCenter',
      runningHeaderId: 'none',
      footerCreditId: 'none',
    });
  });
});

describe('formatPageNumber', () => {
  it('n / N形式を論理ページ基準で返す', () => {
    expect(formatPageNumber('currentTotal', 2, 7)).toBe('3 / 7');
  });

  it('現在ページだけ・非表示を返せる', () => {
    expect(formatPageNumber('current', 0, 7)).toBe('1');
    expect(formatPageNumber('none', 0, 7)).toBe('');
  });
});

describe('getPageFurniturePlacement', () => {
  it.each([
    ['bottomCenter', 0, 0, 1, { align: 'center', x: 300 }, { align: 'left', x: 40 }],
    ['bottomLeft', 0, 0, 1, { align: 'left', x: 40 }, { align: 'right', x: 560 }],
    ['bottomRight', 0, 0, 1, { align: 'right', x: 560 }, { align: 'left', x: 40 }],
    ['bottomOuter', 0, 0, 1, { align: 'right', x: 560 }, { align: 'left', x: 40 }],
    ['bottomOuter', 1, 0, 1, { align: 'left', x: 40 }, { align: 'right', x: 560 }],
    ['bottomInner', 0, 0, 1, { align: 'left', x: 40 }, { align: 'right', x: 560 }],
    ['bottomInner', 1, 0, 1, { align: 'right', x: 560 }, { align: 'left', x: 40 }],
    ['bottomOuter', 0, 0, 2, { align: 'left', x: 40 }, { align: 'right', x: 560 }],
    ['bottomOuter', 0, 1, 2, { align: 'right', x: 560 }, { align: 'left', x: 40 }],
    ['bottomInner', 0, 0, 2, { align: 'right', x: 560 }, { align: 'left', x: 40 }],
    ['bottomInner', 0, 1, 2, { align: 'left', x: 40 }, { align: 'right', x: 560 }],
  ])('%sのページ番号とフッターを指定位置へ置く', (
    positionId,
    pageIndex,
    slotIndex,
    slotsPerSheet,
    pageNumber,
    footer,
  ) => {
    const placement = getPageFurniturePlacement({
      ...geometry,
      pageNumberPositionId: positionId,
      pageIndex,
      slotIndex,
      slotsPerSheet,
    });
    expect(placement).toEqual({ pageNumber, footer });
  });
});
