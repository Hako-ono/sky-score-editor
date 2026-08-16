import {
  DEFAULT_FIRST_PAGE_LAYOUT_ID,
  DEFAULT_SCORE_INFO_DESIGN_ID,
  PDF_FIRST_PAGE_LAYOUTS,
  normalizeScoreInfoDesignId,
  scoreInfoDesignToFirstPageLayoutId,
} from '../constants/config.js';

const COVER_BODY_BASE_TITLE_AREA_PT = 18;
const COVER_BODY_HEADER_PADDING_PT = 8;
const HEADER_TITLE_BASELINE_OFFSET_PT = -1;
const HEADER_BOTTOM_PADDING_PER_META_PT = 2;
// ベースライン間隔から見た目の余白を作るための曲名ディセンダの概算比率。
const SCORE_TITLE_DESCENDER_RATIO = 0.15;
// ベースライン間隔から見た目の余白を作るための作者欄アセンダの概算比率。
const SCORE_META_ASCENDER_RATIO = 0.85;

function knownId(value) {
  return Object.prototype.hasOwnProperty.call(PDF_FIRST_PAGE_LAYOUTS, value)
    ? value
    : DEFAULT_FIRST_PAGE_LAYOUT_ID;
}

/** 保存値・直接呼び出しのどちらからも1ページ目の構成を解決する。 */
export function resolvePdfFirstPageLayout(options = {}) {
  if (options.scoreInfoDesignId !== undefined) {
    return {
      firstPageLayoutId: scoreInfoDesignToFirstPageLayoutId(
        options.scoreInfoDesignId,
        options.mastheadDirectionId,
      ),
    };
  }
  return { firstPageLayoutId: knownId(options.firstPageLayoutId) };
}

/** 1ページ目の見出しを左・中央・右のいずれかへ揃える。 */
export function resolveFirstPageHeaderAlignment(firstPageLayoutId) {
  const safeLayoutId = knownId(firstPageLayoutId);
  if (safeLayoutId === 'editorial') return 'left';
  if (safeLayoutId === 'right') return 'right';
  return 'center';
}

/** アンカー座標とjsPDFのalign値を同じ純粋な規則から導出する。 */
export function getFirstPageHeaderPlacement(
  alignment,
  { pageWidthPt, marginPt } = {},
) {
  const safeAlignment = alignment === 'left' || alignment === 'right'
    ? alignment
    : 'center';
  const anchorX = safeAlignment === 'left'
    ? marginPt
    : safeAlignment === 'right'
    ? pageWidthPt - marginPt
    : pageWidthPt / 2;
  return { anchorX, align: safeAlignment };
}

function headerMetaLine1GapPt(titleFontSizePt, metaFontSizePt) {
  return Math.round(titleFontSizePt * 0.25 + metaFontSizePt * 1.2);
}

function headerMetaLine2GapPt(metaFontSizePt) {
  return Math.round(metaFontSizePt * (11 / 9));
}

function scoreTitleVisibleGapPt(titleFontSizePt, metaFontSizePt) {
  return Math.round(titleFontSizePt * SCORE_TITLE_DESCENDER_RATIO)
    + headerMetaLine2GapPt(metaFontSizePt)
    + Math.round(metaFontSizePt * SCORE_META_ASCENDER_RATIO);
}

/** 作者欄との距離から、楽譜デザインの曲名を持ち上げる量を線形補間する。 */
export function calculateScoreTitleLiftPt({
  distancePt,
  triggerDistancePt,
  maxLiftPt,
  hasAuthorInfo = true,
}) {
  if (!hasAuthorInfo || !Number.isFinite(distancePt)) return 0;
  if (!Number.isFinite(maxLiftPt) || maxLiftPt <= 0) return 0;
  if (!Number.isFinite(triggerDistancePt) || triggerDistancePt <= 0) {
    return distancePt <= 0 ? maxLiftPt : 0;
  }
  if (distancePt <= 0) return maxLiftPt;
  if (distancePt >= triggerDistancePt) return 0;
  return maxLiftPt * ((triggerDistancePt - distancePt) / triggerDistancePt);
}

/** 楽譜デザインの曲名位置を解決する。本文確保高は曲名位置と独立させる。 */
export function resolveScoreTitlePlacement(
  titleFontSizePt,
  metaFontSizePt,
  distancePt,
  hasAuthorInfo = true,
) {
  const metrics = getFirstPageHeaderMetrics(titleFontSizePt, metaFontSizePt, 'score');
  const compactTitleY = titleFontSizePt + HEADER_TITLE_BASELINE_OFFSET_PT;
  const baseUpperTitleY = Math.max(
    compactTitleY,
    metrics.metaYs[0] - scoreTitleVisibleGapPt(titleFontSizePt, metaFontSizePt),
  );
  const baseLiftPt = Math.max(0, metrics.titleY - baseUpperTitleY);
  const liftPt = calculateScoreTitleLiftPt({
    distancePt,
    triggerDistancePt: headerMetaLine2GapPt(metaFontSizePt),
    maxLiftPt: baseLiftPt,
    hasAuthorInfo,
  });
  const requestedTitleY = metrics.titleY - liftPt;
  const titleY = Math.max(compactTitleY, requestedTitleY);
  return {
    titleY,
    requestedTitleY,
    liftPt,
    upperTitleY: Math.max(compactTitleY, metrics.titleY - baseLiftPt),
    compactTitleY,
    titleAreaPt: metrics.titleAreaPt,
  };
}

/** デザインごとの見出しY座標・水平線・本文確保高を同じ規則から導出する。 */
export function getFirstPageHeaderMetrics(
  titleFontSizePt,
  metaFontSizePt,
  scoreInfoDesignId = DEFAULT_SCORE_INFO_DESIGN_ID,
) {
  const safeDesignId = normalizeScoreInfoDesignId(scoreInfoDesignId);
  const compactTitleY = titleFontSizePt + HEADER_TITLE_BASELINE_OFFSET_PT;
  let titleY = compactTitleY;
  let metaYs;

  if (safeDesignId === 'score') {
    const sideColumnTitleY = titleY + Math.max(6, Math.round(titleFontSizePt * 0.45));
    const metaY1 = sideColumnTitleY
      + headerMetaLine1GapPt(titleFontSizePt, metaFontSizePt);
    const metaGap = headerMetaLine2GapPt(metaFontSizePt);
    const creditYs = Array.from({ length: 3 }, (_, index) => metaY1 + metaGap * index);
    const titleCreditTouchingGap = Math.max(
      7,
      Math.round(metaFontSizePt * 0.8 + titleFontSizePt * 0.2),
    );
    const creditMusicalTouchingGap = Math.max(7, Math.round(metaFontSizePt * 1.1));
    // 中央の曲名と右側の作者欄は横方向に重ならないため、作詞行の直上まで
    // 曲名を下げられる。演奏情報は譜面作成行の下へ独立して置く。
    titleY = creditYs[1] - titleCreditTouchingGap;
    metaYs = [...creditYs, creditYs.at(-1) + creditMusicalTouchingGap];
  } else if (safeDesignId === 'specSheet') {
    titleY += Math.max(2, Math.round(titleFontSizePt * 0.15));
    const metaY1 = titleY + headerMetaLine1GapPt(titleFontSizePt, metaFontSizePt);
    const labelValueGap = Math.max(8, Math.round(metaFontSizePt * 1.05));
    const groupGap = Math.max(11, Math.round(metaFontSizePt * 1.45));
    metaYs = [
      metaY1,
      metaY1 + labelValueGap,
      metaY1 + labelValueGap + groupGap,
      metaY1 + labelValueGap * 2 + groupGap,
    ];
  } else {
    metaYs = [titleY + headerMetaLine1GapPt(titleFontSizePt, metaFontSizePt)];
  }

  const metaY1 = metaYs[0];
  const metaY2 = metaYs[1] ?? null;
  const lastMetaY = metaYs.at(-1);
  const lineY = safeDesignId === 'score'
    ? lastMetaY
    : lastMetaY + Math.max(5, Math.round(metaFontSizePt * 0.65));
  // 楽譜には区切り線がないため、線の前後に使っていた余白を除き、演奏情報の
  // 文字がグリッドへ触れない最小限の余白だけを残す。
  const bottomPadding = safeDesignId === 'score'
    ? Math.max(4, Math.round(metaFontSizePt * 0.45))
    : Math.max(
      7,
      Math.round(HEADER_BOTTOM_PADDING_PER_META_PT * metaFontSizePt * 0.45),
    );
  const titleAreaPt = lineY + bottomPadding;

  return {
    titleY,
    metaY1,
    metaY2,
    metaYs,
    lineY,
    titleAreaPt,
  };
}

export function deriveFirstPageTitleAreaPt(
  titleFontSizePt,
  metaFontSizePt,
  scoreInfoDesignId = DEFAULT_SCORE_INFO_DESIGN_ID,
) {
  return getFirstPageHeaderMetrics(
    titleFontSizePt,
    metaFontSizePt,
    scoreInfoDesignId,
  ).titleAreaPt;
}

/** 後方互換の名前。実体は左・中央・右共通のmetricsである。 */
export function getEditorialHeaderMetrics(titleFontSizePt, metaFontSizePt) {
  const metrics = getFirstPageHeaderMetrics(titleFontSizePt, metaFontSizePt);
  return {
    titleY: metrics.titleY,
    authorY: metrics.metaY1,
    metaY: metrics.metaY2,
    lineY: metrics.lineY,
    titleAreaPt: metrics.titleAreaPt,
  };
}

export function deriveEditorialTitleAreaPt(titleFontSizePt, metaFontSizePt) {
  return deriveFirstPageTitleAreaPt(titleFontSizePt, metaFontSizePt);
}

/** 表紙後の本文上部を、柱の有無とサイズに応じて共通値へ解決する。 */
export function deriveCoverBodyTitleAreaPt({
  runningHeaderId,
  pageNumberFontSizePt,
  metaFontSizePt,
}) {
  if (runningHeaderId !== 'title') return COVER_BODY_BASE_TITLE_AREA_PT;
  const headerFontSizePt = Math.min(pageNumberFontSizePt, metaFontSizePt);
  return Math.max(COVER_BODY_BASE_TITLE_AREA_PT, headerFontSizePt + COVER_BODY_HEADER_PADDING_PT);
}

function buildBodyPage({ sheetIndex, geometry, logicalPageBaseIndex, logicalPageCount }) {
  const bodySlots = Array.from({ length: geometry.slotsPerSheet }, (_, slotIndex) => ({
    slotIndex,
    pageIndex: logicalPageBaseIndex + slotIndex,
  })).filter(({ pageIndex }) => pageIndex < logicalPageCount);

  return {
    kind: 'body',
    sheetIndex,
    geometry,
    bodySlots,
  };
}

/**
 * 表紙を含む物理ページの順序を組み立てる。bodySlotsに論理ページと物理スロットの
 * 対応を持たせ、2面付けの表紙＋本文1ページ目も同じ描画ループで扱えるようにする。
 */
export function buildPdfPagePlan({
  firstPageLayoutId,
  sheetGeometry,
  coverGeometry,
  logicalPageCount,
  coverIncludesFirstBodyPage = false,
}) {
  const safeLayoutId = knownId(firstPageLayoutId);
  const safePageCount = Number.isInteger(logicalPageCount) && logicalPageCount > 0
    ? logicalPageCount
    : 0;
  const sheetCount = Math.ceil(safePageCount / sheetGeometry.slotsPerSheet);
  const bodyPages = Array.from({ length: sheetCount }, (_, sheetIndex) => buildBodyPage({
    sheetIndex,
    geometry: sheetGeometry,
    logicalPageBaseIndex: sheetIndex * sheetGeometry.slotsPerSheet,
    logicalPageCount: safePageCount,
  }));

  if (safeLayoutId !== 'cover') return bodyPages;

  if (coverIncludesFirstBodyPage && sheetGeometry.slotsPerSheet > 1) {
    const remainingPageCount = Math.max(0, safePageCount - 1);
    const remainingSheetCount = Math.ceil(remainingPageCount / sheetGeometry.slotsPerSheet);
    const remainingBodyPages = Array.from({ length: remainingSheetCount }, (_, index) => (
      buildBodyPage({
        sheetIndex: index + 1,
        geometry: sheetGeometry,
        logicalPageBaseIndex: (index + 1) * sheetGeometry.slotsPerSheet - 1,
        logicalPageCount: safePageCount,
      })
    ));

    return [
      {
        kind: 'cover',
        sheetIndex: 0,
        geometry: coverGeometry,
        coverSlotIndex: 0,
        bodySlots: safePageCount > 0 ? [{ slotIndex: 1, pageIndex: 0 }] : [],
      },
      ...remainingBodyPages,
    ];
  }

  return [
    {
      kind: 'cover',
      sheetIndex: null,
      geometry: coverGeometry,
      coverSlotIndex: 0,
      bodySlots: [],
    },
    ...bodyPages,
  ];
}
