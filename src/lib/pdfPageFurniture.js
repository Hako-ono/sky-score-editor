import {
  PDF_PAGE_NUMBER_FORMATS,
  PDF_PAGE_NUMBER_POSITIONS,
  PDF_RUNNING_HEADERS,
  PDF_FOOTER_CREDITS,
  DEFAULT_PAGE_NUMBER_FORMAT_ID,
  DEFAULT_PAGE_NUMBER_POSITION_ID,
  DEFAULT_RUNNING_HEADER_ID,
  DEFAULT_FOOTER_CREDIT_ID,
} from '../constants/config.js';

function knownId(values, value, fallback) {
  return Object.prototype.hasOwnProperty.call(values, value) ? value : fallback;
}

/** PDFページ装飾の設定を、保存値・直接呼び出しのどちらからも同じ規則で解決する。 */
export function resolvePdfPageFurniture(options = {}) {
  return {
    pageNumberFormatId: knownId(
      PDF_PAGE_NUMBER_FORMATS,
      options.pageNumberFormatId,
      DEFAULT_PAGE_NUMBER_FORMAT_ID,
    ),
    pageNumberPositionId: knownId(
      PDF_PAGE_NUMBER_POSITIONS,
      options.pageNumberPositionId,
      DEFAULT_PAGE_NUMBER_POSITION_ID,
    ),
    runningHeaderId: knownId(
      PDF_RUNNING_HEADERS,
      options.runningHeaderId,
      DEFAULT_RUNNING_HEADER_ID,
    ),
    footerCreditId: knownId(
      PDF_FOOTER_CREDITS,
      options.footerCreditId,
      DEFAULT_FOOTER_CREDIT_ID,
    ),
  };
}

function safePageIndex(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function safePageCount(value, pageIndex) {
  return Number.isInteger(value) && value > 0 ? value : pageIndex + 1;
}

/** 論理ページ番号を設定された形式へ変換する。 */
export function formatPageNumber(formatId, pageIndex, pageCount) {
  const { pageNumberFormatId } = resolvePdfPageFurniture({ pageNumberFormatId: formatId });
  if (pageNumberFormatId === 'none') return '';

  const safeIndex = safePageIndex(pageIndex);
  const current = safeIndex + 1;
  const total = safePageCount(pageCount, safeIndex);
  return pageNumberFormatId === 'current' ? String(current) : `${current} / ${total}`;
}

function sideX(side, pageWidthPt, marginPt) {
  if (side === 'left') return { align: 'left', x: marginPt };
  if (side === 'right') return { align: 'right', x: pageWidthPt - marginPt };
  return { align: 'center', x: pageWidthPt / 2 };
}

function getOuterSide(pageIndex, slotIndex, slotsPerSheet) {
  if (slotsPerSheet === 2) return slotIndex === 0 ? 'left' : 'right';
  return safePageIndex(pageIndex) % 2 === 0 ? 'right' : 'left';
}

function getInnerSide(pageIndex, slotIndex, slotsPerSheet) {
  return getOuterSide(pageIndex, slotIndex, slotsPerSheet) === 'left'
    ? 'right'
    : 'left';
}

/** ページ番号とフッターの左右揃え・ローカルx座標を返す。 */
export function getPageFurniturePlacement({
  pageNumberPositionId,
  pageIndex = 0,
  slotIndex = 0,
  slotsPerSheet = 1,
  pageWidthPt,
  marginPt,
}) {
  const { pageNumberPositionId: positionId } = resolvePdfPageFurniture({
    pageNumberPositionId,
  });
  const pageNumberSide = positionId === 'bottomOuter'
    ? getOuterSide(pageIndex, slotIndex, slotsPerSheet)
    : positionId === 'bottomInner'
    ? getInnerSide(pageIndex, slotIndex, slotsPerSheet)
    : positionId === 'bottomLeft'
    ? 'left'
    : positionId === 'bottomRight'
    ? 'right'
    : 'center';
  const footerSide = pageNumberSide === 'center'
    ? 'left'
    : pageNumberSide === 'left'
    ? 'right'
    : 'left';

  return {
    pageNumber: sideX(pageNumberSide, pageWidthPt, marginPt),
    footer: sideX(footerSide, pageWidthPt, marginPt),
  };
}
