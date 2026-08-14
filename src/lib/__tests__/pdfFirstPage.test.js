import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FIRST_PAGE_LAYOUT_ID,
} from '../../constants/config.js';
import {
  buildPdfPagePlan,
  deriveCoverBodyTitleAreaPt,
  deriveEditorialTitleAreaPt,
  deriveFirstPageTitleAreaPt,
  getFirstPageHeaderMetrics,
  getFirstPageHeaderPlacement,
  getEditorialHeaderMetrics,
  resolveFirstPageHeaderAlignment,
  resolvePdfFirstPageLayout,
} from '../pdfFirstPage.js';

const bodyGeometry = {
  orientation: 'landscape',
  slotsPerSheet: 2,
  sheetWidthPt: 841.89,
  sheetHeightPt: 595.28,
};
const coverGeometry = {
  orientation: 'portrait',
  slotsPerSheet: 1,
  sheetWidthPt: 595.28,
  sheetHeightPt: 841.89,
};

describe('resolvePdfFirstPageLayout', () => {
  it('未指定・未知idはclassicへ戻る', () => {
    expect(resolvePdfFirstPageLayout()).toEqual({
      firstPageLayoutId: DEFAULT_FIRST_PAGE_LAYOUT_ID,
    });
    expect(resolvePdfFirstPageLayout({ firstPageLayoutId: 'unknown' })).toEqual({
      firstPageLayoutId: DEFAULT_FIRST_PAGE_LAYOUT_ID,
    });
  });

  it('editorial・right・coverを受け付ける', () => {
    expect(resolvePdfFirstPageLayout({ firstPageLayoutId: 'editorial' })).toEqual({
      firstPageLayoutId: 'editorial',
    });
    expect(resolvePdfFirstPageLayout({ firstPageLayoutId: 'right' })).toEqual({
      firstPageLayoutId: 'right',
    });
    expect(resolvePdfFirstPageLayout({ firstPageLayoutId: 'cover' })).toEqual({
      firstPageLayoutId: 'cover',
    });
  });
});

describe('editorial header metrics', () => {
  it('描画座標から本文の共通確保高を導出する', () => {
    const metrics = getEditorialHeaderMetrics(15, 9);
    expect(metrics.titleAreaPt).toBe(deriveEditorialTitleAreaPt(15, 9));
    expect(metrics.authorY).toBeLessThan(metrics.titleY);
    expect(metrics.titleY).toBeLessThan(metrics.metaY);
    expect(metrics.titleY).toBeLessThan(metrics.lineY);
    expect(metrics.titleAreaPt).toBeGreaterThan(metrics.lineY);
  });

  it('楽譜の曲名を作詞行の直上、演奏情報を譜面作成行の直下へ置く', () => {
    const metrics = getFirstPageHeaderMetrics(15, 9, 'score');
    expect(metrics.metaYs[1] - metrics.titleY).toBe(10);
    expect(metrics.metaYs[3] - metrics.metaYs[2]).toBe(10);

    const defaultMetrics = getFirstPageHeaderMetrics(20, 9, 'score');
    expect(defaultMetrics.metaYs[1] - defaultMetrics.titleY).toBe(11);
    expect(defaultMetrics.metaYs[3] - defaultMetrics.metaYs[2]).toBe(10);
  });

  it('完成組版から固定位置を導出し、マストヘッドだけ左右を切り替える', () => {
    expect(resolvePdfFirstPageLayout({ scoreInfoDesignId: 'score' })).toEqual({
      firstPageLayoutId: 'classic',
    });
    expect(resolvePdfFirstPageLayout({ scoreInfoDesignId: 'specSheet' })).toEqual({
      firstPageLayoutId: 'classic',
    });
    expect(resolvePdfFirstPageLayout({
      scoreInfoDesignId: 'masthead',
      mastheadDirectionId: 'left',
    })).toEqual({ firstPageLayoutId: 'editorial' });
    expect(resolvePdfFirstPageLayout({
      scoreInfoDesignId: 'masthead',
      mastheadDirectionId: 'right',
    })).toEqual({ firstPageLayoutId: 'right' });
    expect(resolvePdfFirstPageLayout({ scoreInfoDesignId: 'cover' })).toEqual({
      firstPageLayoutId: 'cover',
    });
  });

  it('楽譜は作者3行＋演奏1行、帳票はラベル込み4行、マストヘッドは1行のmetricsを返す', () => {
    expect(getFirstPageHeaderMetrics(15, 9, 'score').metaYs).toHaveLength(4);
    expect(getFirstPageHeaderMetrics(15, 9, 'specSheet').metaYs).toHaveLength(4);
    expect(getFirstPageHeaderMetrics(15, 9, 'masthead').metaYs).toHaveLength(1);
  });

  it('文字サイズが大きいほど確保高も大きくなる', () => {
    expect(deriveEditorialTitleAreaPt(24, 14)).toBeGreaterThan(
      deriveEditorialTitleAreaPt(15, 9),
    );
  });

  it('editorial互換metricsは左・中央・右で共有するmetricsと同じになる', () => {
    expect(getEditorialHeaderMetrics(15, 9)).toEqual({
      titleY: getFirstPageHeaderMetrics(15, 9).titleY,
      authorY: getFirstPageHeaderMetrics(15, 9).metaY1,
      metaY: getFirstPageHeaderMetrics(15, 9).metaY2,
      lineY: getFirstPageHeaderMetrics(15, 9).lineY,
      titleAreaPt: deriveFirstPageTitleAreaPt(15, 9),
    });
  });
});

describe('first-page header alignment', () => {
  it.each([
    ['editorial', 'left'],
    ['classic', 'center'],
    ['right', 'right'],
    ['cover', 'center'],
    ['unknown', 'center'],
  ])('%sを%s揃えへ解決する', (layoutId, expected) => {
    expect(resolveFirstPageHeaderAlignment(layoutId)).toBe(expected);
  });

  it('揃え方向からローカルanchor XとjsPDF alignを導出する', () => {
    expect(getFirstPageHeaderPlacement('left', { pageWidthPt: 600, marginPt: 40 })).toEqual({
      anchorX: 40,
      align: 'left',
    });
    expect(getFirstPageHeaderPlacement('center', { pageWidthPt: 600, marginPt: 40 })).toEqual({
      anchorX: 300,
      align: 'center',
    });
    expect(getFirstPageHeaderPlacement('right', { pageWidthPt: 600, marginPt: 40 })).toEqual({
      anchorX: 560,
      align: 'right',
    });
    expect(getFirstPageHeaderPlacement('invalid', { pageWidthPt: 600, marginPt: 40 })).toEqual({
      anchorX: 300,
      align: 'center',
    });
  });

  it('左・中央・右は見出しのmetricsを共有し、anchor Xとalignだけを変える', () => {
    const metrics = getFirstPageHeaderMetrics(15, 9);
    const placements = ['editorial', 'classic', 'right'].map((layoutId) => {
      const alignment = resolveFirstPageHeaderAlignment(layoutId);
      return {
        metrics,
        placement: getFirstPageHeaderPlacement(alignment, {
          pageWidthPt: 600,
          marginPt: 40,
        }),
      };
    });

    expect(placements.map(({ metrics: value }) => value)).toEqual([
      metrics,
      metrics,
      metrics,
    ]);
    expect(placements.map(({ placement }) => placement)).toEqual([
      { anchorX: 40, align: 'left' },
      { anchorX: 300, align: 'center' },
      { anchorX: 560, align: 'right' },
    ]);
  });
});

describe('deriveCoverBodyTitleAreaPt', () => {
  it('柱が無い表紙本文は18ptを使う', () => {
    expect(deriveCoverBodyTitleAreaPt({
      runningHeaderId: 'none',
      pageNumberFontSizePt: 14,
      metaFontSizePt: 14,
    })).toBe(18);
  });

  it('柱のサイズが大きいときだけ確保高を増やす', () => {
    expect(deriveCoverBodyTitleAreaPt({
      runningHeaderId: 'title',
      pageNumberFontSizePt: 14,
      metaFontSizePt: 14,
    })).toBe(22);
    expect(deriveCoverBodyTitleAreaPt({
      runningHeaderId: 'title',
      pageNumberFontSizePt: 8,
      metaFontSizePt: 9,
    })).toBe(18);
  });
});

describe('buildPdfPagePlan', () => {
  it.each([
    ['classic', 1, 1, 1, 'body'],
    ['editorial', 3, 2, 2, 'body'],
    ['cover', 1, 1, 2, 'cover'],
    ['cover', 3, 2, 3, 'cover'],
    ['cover', 4, 2, 3, 'cover'],
  ])('%s・%s論理ページの物理ページ順を作る', (
    firstPageLayoutId,
    logicalPageCount,
    bodyPageCount,
    expectedPageCount,
    firstKind,
  ) => {
    const plan = buildPdfPagePlan({
      firstPageLayoutId,
      sheetGeometry: bodyGeometry,
      coverGeometry,
      logicalPageCount,
    });
    expect(plan).toHaveLength(expectedPageCount);
    expect(plan[0].kind).toBe(firstKind);
    expect(plan.at(-1).kind).toBe('body');
    expect(plan.filter((page) => page.kind === 'body')).toHaveLength(bodyPageCount);
  });

  it('空本文でも表紙だけを計画できる（exportPdf側では先に拒否する）', () => {
    expect(buildPdfPagePlan({
      firstPageLayoutId: 'cover',
      sheetGeometry: bodyGeometry,
      coverGeometry,
      logicalPageCount: 0,
    })).toEqual([{
      kind: 'cover',
      sheetIndex: null,
      geometry: coverGeometry,
      coverSlotIndex: 0,
      bodySlots: [],
    }]);
  });

  it('表紙の向きと本文の向きを分ける', () => {
    const plan = buildPdfPagePlan({
      firstPageLayoutId: 'cover',
      sheetGeometry: bodyGeometry,
      coverGeometry,
      logicalPageCount: 1,
    });
    expect(plan[0].geometry.orientation).toBe('portrait');
    expect(plan[1].geometry.orientation).toBe('landscape');
  });

  it('2面付けの表紙は左に表紙、右に本文1ページ目を置く', () => {
    const plan = buildPdfPagePlan({
      firstPageLayoutId: 'cover',
      sheetGeometry: bodyGeometry,
      coverGeometry: bodyGeometry,
      logicalPageCount: 1,
      coverIncludesFirstBodyPage: true,
    });
    expect(plan[0]).toEqual({
      kind: 'cover',
      sheetIndex: 0,
      geometry: bodyGeometry,
      coverSlotIndex: 0,
      bodySlots: [{ slotIndex: 1, pageIndex: 0 }],
    });
    expect(plan[0].geometry.orientation).toBe('landscape');
    expect(plan[0].geometry.slotsPerSheet).toBe(2);
    expect(plan).toHaveLength(1);
  });

  it('2面付けの表紙後は本文2ページ目から続ける', () => {
    const plan = buildPdfPagePlan({
      firstPageLayoutId: 'cover',
      sheetGeometry: bodyGeometry,
      coverGeometry: bodyGeometry,
      logicalPageCount: 4,
      coverIncludesFirstBodyPage: true,
    });
    expect(plan).toHaveLength(3);
    expect(plan[0].bodySlots).toEqual([{ slotIndex: 1, pageIndex: 0 }]);
    expect(plan[1].bodySlots).toEqual([
      { slotIndex: 0, pageIndex: 1 },
      { slotIndex: 1, pageIndex: 2 },
    ]);
    expect(plan[2].bodySlots).toEqual([{ slotIndex: 0, pageIndex: 3 }]);
  });
});
