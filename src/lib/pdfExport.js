/**
 * PDF 出力。jsPDF + svg2pdf.js を使う。
 * フォントは public/fonts/ から選択された書体 (PDF_FONTS) を実行時に取得し、
 * base64 化してキャッシュする（初期バンドルを軽くするため）。
 *
 * svg2pdf は <use>/<style>/foreignObject の扱いが不安定なため、
 * ここでは presentation attribute をすべてインラインで指定した
 * プレーンな SVG を生成する。
 */

import { jsPDF } from 'jspdf';
import 'svg2pdf.js'; // jsPDF に doc.svg() を生やす副作用インポート

import {
  pdfConfig,
  GRID_NUMBER_POS,
  GRID_TEXT_CENTER,
  PDF_PRESETS,
  PDF_PAGE_MARGINS,
  PDF_GRID_GAPS,
  DEFAULT_PAGE_MARGIN_ID,
  DEFAULT_GRID_GAP_ID,
  PDF_ROW_SHADING_COLOR,
  rowShadingOpacity,
  shadeRowPalette,
  PDF_SHEET_LAYOUTS,
  DEFAULT_SHEET_LAYOUT_ID,
  DEFAULT_PRESET_ID,
  CUSTOM_PRESET_ID,
  formatPdfKeyName,
  normalizeKeyNotationId,
  normalizeKeyModeNotationId,
  normalizeScoreInfoDesignId,
  resolvePdfScoreInfoDesign,
  normalizeTempoValueModeId,
  sanitizeCustomTempoValue,
  PDF_TEMPO_VALUE_MODES,
  PDF_CONTENT_TOP_SHIFT_PT,
  PDF_FIRST_PAGE_HEADER_TEXT_SHIFT_PT,
  PDF_PAGE_NUMBER_BOTTOM_OFFSET_PT,
  buildPdfPalette,
  resolvePaletteSeed,
} from '../constants/config.js';
import { resolvePdfTypography } from './pdfTypography.js';
import {
  formatPageNumber,
  getPageFurniturePlacement,
  resolvePdfPageFurniture,
} from './pdfPageFurniture.js';
import {
  buildPdfPagePlan,
  deriveCoverBodyTitleAreaPt,
  deriveFirstPageTitleAreaPt,
  getFirstPageHeaderPlacement,
  getFirstPageHeaderMetrics,
  resolveFirstPageHeaderAlignment,
  resolvePdfFirstPageLayout,
} from './pdfFirstPage.js';
import { splitIntoRows, paginateRows, resolveColumnsPerPage } from './layout.js';
import {
  GRID_CELL_SHAPES,
  createCombinedSymbolPath,
  createRoundedDiamondPath,
  gridColorState,
  cellColorState,
} from './gridShapes.js';
import { derivePdfGridEdgePadding, resolvePdfGridStyle } from './pdfGridStyle.js';
import { computeGridBlockSize, resolvePdfDensity } from './pdfDensity.js';
import {
  analyzeScoreLayers,
  getAudibleKeys,
  getOtherLayerKeys,
  getSelectedLayerKeys,
} from './scoreLayers.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const EMPTY_GRID_OPACITY = 0.5;
// 既存テストと呼び出し元のために旧名を保つ。実体は全3揃え方向で共有するmetrics。
export const deriveTitleAreaPt = deriveFirstPageTitleAreaPt;

/**
 * pdfConfig の titleFontSizePt / metaFontSizePt / maxRowsPerPage を options で
 * 上書きしたレイアウト設定を組み立てる。1スロット（1面付けなら用紙全体、
 * 2面付けなら用紙を左右に割ったスロット1つぶん）の幅・高さを
 * slotWidthPt / slotHeightPt として渡すことで、「論理ページ」の座標系を
 * 用紙全体からスロット単体へ差し替えられるようにしている。
 *
 * 導出値（contentWidthPt / contentHeightPt / pageNumberBaselinePt）は
 * pdfConfig 側の getter を使わず、ここで素の値から計算し直す。
 * `{ ...pdfConfig, titleAreaPt: x }` のようにスプレッドすると、getter が
 * その場で pdfConfig 自身の（上書き前の）titleAreaPt から評価されてしまい、
 * 以後 titleAreaPt をいくら変えても contentHeightPt が追従しない
 * （例外も出ず縮尺だけが静かにずれる）。
 */
export function buildLayout(
  options = {},
  slotWidthPt = pdfConfig.pageWidthPt,
  slotHeightPt = pdfConfig.pageHeightPt,
) {
  const titleFontSizePt = options.titleFontSizePt ?? pdfConfig.titleFontSizePt;
  const metaFontSizePt = options.metaFontSizePt ?? pdfConfig.metaFontSizePt;
  const maxRowsPerPage = options.maxRowsPerPage ?? pdfConfig.maxRowsPerPage;
  const scoreInfo = resolvePdfScoreInfoDesign(options);
  const { firstPageLayoutId } = resolvePdfFirstPageLayout(scoreInfo);
  const { runningHeaderId } = resolvePdfPageFurniture(options);
  const titleAreaPt = firstPageLayoutId === 'cover'
    ? deriveCoverBodyTitleAreaPt({
      runningHeaderId,
      pageNumberFontSizePt: options.pageNumberFontSizePt ?? pdfConfig.pageNumberFontSizePt,
      metaFontSizePt,
    })
    : deriveFirstPageTitleAreaPt(
      titleFontSizePt,
      metaFontSizePt,
      scoreInfo.scoreInfoDesignId,
    );
  const density = resolvePdfDensity(options);
  const pageNumberFontSizePt = options.pageNumberFontSizePt ?? pdfConfig.pageNumberFontSizePt;
  const { gridBaseWidth, gridBaseHeight } = pdfConfig;
  const pageWidthPt = slotWidthPt;
  const pageHeightPt = slotHeightPt;

  return {
    pageWidthPt,
    pageHeightPt,
    marginPt: density.marginPt,
    contentTopPt: density.marginPt - PDF_CONTENT_TOP_SHIFT_PT,
    pageNumberFontSizePt,
    gridBaseWidth,
    gridBaseHeight,
    gridHorizontalSpacing: density.gridHorizontalSpacing,
    gridVerticalSpacing: density.gridVerticalSpacing,
    pageMarginId: density.pageMarginId,
    gridGapId: density.gridGapId,
    rowShadingId: density.rowShadingId,
    titleFontSizePt,
    metaFontSizePt,
    maxRowsPerPage,
    firstPageLayoutId,
    ...scoreInfo,
    titleAreaPt,
    contentWidthPt: pageWidthPt - 2 * density.marginPt,
    contentHeightPt: pageHeightPt - 2 * density.marginPt - titleAreaPt,
    pageNumberBaselinePt: pageHeightPt - PDF_PAGE_NUMBER_BOTTOM_OFFSET_PT,
  };
}

/** SVGのクリップ回避用paddingを除いた、実際のグリッド左右端をPDF座標で返す。 */
export function getScaledGridHorizontalBounds({ offsetX, svgWidth, edgePadding, scale }) {
  return {
    leftPt: offsetX + edgePadding * scale,
    rightPt: offsetX + (svgWidth - edgePadding) * scale,
  };
}

// 曲情報デザイン「楽譜」の左右端が縮みすぎないための基準。列数・行数を
// どう変えても、標準余白・標準間隔・6行3列のときのグリッド幅より狭くはしない。
export const SCORE_INFO_MIN_WIDTH_ROWS = 6;
export const SCORE_INFO_MIN_WIDTH_COLUMNS = 3;

/**
 * 上記の基準組み合わせでのグリッド幅（＝曲情報の下限幅）をPDF座標で返す。
 *
 * 余白・間隔・行数・列数は基準値で固定する一方、用紙（スロット）の寸法だけは
 * 引数の layout から取る。2面付けではスロットが狭く、固定ptを下限にすると
 * その紙面の本文領域を越えてしまうため。見出し確保高は pdfConfig の既定値で
 * 固定し、曲名・曲情報の文字サイズ設定で下限そのものが動かないようにする。
 */
export function deriveScoreInfoMinWidthPt(layout) {
  const gap = PDF_GRID_GAPS[DEFAULT_GRID_GAP_ID];
  const marginPt = PDF_PAGE_MARGINS[DEFAULT_PAGE_MARGIN_ID].marginPt;
  const { rawSvgWidth, rawSvgHeight } = computeGridBlockSize({
    columns: SCORE_INFO_MIN_WIDTH_COLUMNS,
    rows: SCORE_INFO_MIN_WIDTH_ROWS,
    gridBaseWidth: layout.gridBaseWidth,
    gridBaseHeight: layout.gridBaseHeight,
    gridHorizontalSpacing: gap.horizontalPt,
    gridVerticalSpacing: gap.verticalPt,
  });
  const contentWidthPt = layout.pageWidthPt - 2 * marginPt;
  const contentHeightPt = layout.pageHeightPt - 2 * marginPt - pdfConfig.titleAreaPt;
  if (rawSvgWidth <= 0 || rawSvgHeight <= 0) return 0;
  const scale = Math.min(contentWidthPt / rawSvgWidth, contentHeightPt / rawSvgHeight);
  return rawSvgWidth * scale;
}

/**
 * グリッド左右端が下限より狭いときだけ、中心を保ったまま下限幅まで広げる。
 * 上限は現在の本文領域幅で頭打ちにする（広い余白・2面付けでは基準幅の方が
 * 広くなりうるため、そのまま使うと曲情報が余白へはみ出す）。
 */
export function expandBoundsToMinWidth(bounds, minWidthPt, { marginPt, pageWidthPt }) {
  const contentWidthPt = pageWidthPt - 2 * marginPt;
  const width = bounds.rightPt - bounds.leftPt;
  const targetWidth = Math.min(minWidthPt, contentWidthPt);
  if (!Number.isFinite(targetWidth) || targetWidth <= width) return bounds;

  // グリッドは本文領域の中央に置かれるため、通常は中心を保つだけで収まるが、
  // はみ出す位置関係になった場合は本文領域の内側へ寄せる（紙面外へ文字を
  // 逃がさないことを、呼び出し元の前提ではなくこの関数で保証する）。
  const center = (bounds.leftPt + bounds.rightPt) / 2;
  const leftLimit = marginPt;
  const rightLimit = pageWidthPt - marginPt;
  const leftPt = Math.min(
    Math.max(center - targetWidth / 2, leftLimit),
    rightLimit - targetWidth,
  );
  return { leftPt, rightPt: leftPt + targetWidth };
}

/**
 * 用紙1枚（物理ページ）のジオメトリと、そこに収まる「スロット」（論理ページ
 * 1つぶんの領域）の原点を組み立てる。1面付けはスロット=用紙全体で
 * 従来と完全に同じ（`slotOrigins: [{x:0,y:0}]`）。2面付けは横向きA4用紙
 * （＝縦向きA4の幅と高さを入れ替えた物理サイズ。同じ紙を90度回しただけ
 * なので寸法は一致する）を左右2スロットに割る。
 *
 * この関数はスロットの生の物理サイズ（マージン抜き）だけを返す。
 * 余白は buildLayout（marginPt を content の内側に確保する）が唯一の
 * 発生源であり、ここでは一切差し引かない。
 * （かつては左余白＋中央ガター＋右余白の3つぶんを ここで先に差し引いた
 * うえで、buildLayout 側でもスロットを「1ページ」とみなして重ねて
 * marginPt を差し引いていたため、2面付けのコンテンツ領域が意図の約8割
 * まで縮んでいた。marginPt を差し引く場所を buildLayout の1箇所に
 * 一本化して解消した。）
 *
 * 副作用として、2スロットが接する中央のガターは
 * 「左スロットの右マージン＋右スロットの左マージン」＝ marginPt の2倍に
 * なる（外周の余白は marginPt のまま）。中央だけやや広い余白になるが、
 * 印刷物として不自然ではなく、複雑な特別扱いを増やすよりこちらを取る。
 */
export function buildSheetGeometry(sheetLayoutId) {
  const { pageWidthPt, pageHeightPt } = pdfConfig;

  if (sheetLayoutId === 'double') {
    const sheetWidthPt = pageHeightPt;
    const sheetHeightPt = pageWidthPt;
    const slotsPerSheet = 2;
    const slotWidthPt = sheetWidthPt / slotsPerSheet;
    const slotHeightPt = sheetHeightPt;
    const slotOrigins = Array.from({ length: slotsPerSheet }, (_, i) => ({
      x: i * slotWidthPt,
      y: 0,
    }));
    return {
      orientation: 'landscape',
      sheetWidthPt,
      sheetHeightPt,
      slotsPerSheet,
      slotWidthPt,
      slotHeightPt,
      slotOrigins,
    };
  }

  return {
    orientation: 'portrait',
    sheetWidthPt: pageWidthPt,
    sheetHeightPt: pageHeightPt,
    slotsPerSheet: 1,
    slotWidthPt: pageWidthPt,
    slotHeightPt: pageHeightPt,
    slotOrigins: [{ x: 0, y: 0 }],
  };
}

// しっぽり明朝は base64 化すると約11MBの文字列になる。3書体ぶんを保持すると
// 約19MBが常駐し、大きな譜面のDOMと競合してiPhoneで落ちるため、
// 直近に使った1つだけを持つ。
let fontCache = { file: null, base64: null };

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk),
    );
  }
  return btoa(binary);
}

async function loadFontBase64(font) {
  if (fontCache.file === font.file) return fontCache.base64;
  const url = `${import.meta.env.BASE_URL}fonts/${font.file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`フォントの取得に失敗しました (${res.status})`);
  const buffer = await res.arrayBuffer();
  // 200 が返っても中身が TTF とは限らない（配信側のフォールバック、
  // 中間プロキシ、途中で切れた応答）。検証より前にキャッシュへ載せると、
  // 壊れた base64 を以後リロードするまで返し続けることになる。
  // 同梱の3書体はいずれも先頭が 0x00010000（実測）。
  if (buffer.byteLength < 4) {
    throw new Error('フォントの取得に失敗しました (形式が不正です)');
  }
  const tag = new DataView(buffer).getUint32(0);
  // 0x74727565 ('true') は古い Mac 形式の TTF。将来の差し替えに備えた保険。
  // ttcf (TrueType Collection) は jsPDF が扱えないため許さない。
  if (tag !== 0x00010000 && tag !== 0x74727565) {
    throw new Error('フォントの取得に失敗しました (形式が不正です)');
  }
  fontCache = { file: font.file, base64: arrayBufferToBase64(buffer) };
  return fontCache.base64;
}

// Zen Kaku Gothic New / Zen Maru Gothic は U+FF5E・U+FF0D の字形を持たない。
// Windows の IME は「〜」を U+FF5E で確定することが多く、そのまま渡すと
// 「曲名～サブ～」のような表記が豆腐になる。描画の直前だけ字形のある符号へ寄せる。
function sanitizeForPdf(text) {
  return String(text).replace(/～/g, '〜').replace(/－/g, '−');
}

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    node.setAttribute(k, String(v));
  });
  return node;
}

/** 1 グリッド分の <g> を生成 (原点はグリッド左上) */
function buildGridGroup(
  doc,
  grid,
  gridNumber,
  palette,
  fontName,
  gridStyle,
  typography,
  layout,
  layerOptions = {},
) {
  const group = el('g', {});
  const usesTwoLayers = layerOptions.usesTwoLayers === true;
  const selectedLayer = layerOptions.selectedLayer === 2 ? 2 : 1;
  const selectedKeys = usesTwoLayers
    ? getSelectedLayerKeys(grid, selectedLayer)
    : getAudibleKeys(grid);
  const otherKeys = usesTwoLayers ? getOtherLayerKeys(grid, selectedLayer) : [];
  const audibleKeys = usesTwoLayers ? getAudibleKeys(grid) : selectedKeys;
  const isEmpty = gridColorState(audibleKeys, grid.text) === 'empty';
  if (isEmpty) group.setAttribute('opacity', EMPTY_GRID_OPACITY);
  const symbolRadius = Number.isFinite(gridStyle.symbolRadius) ? gridStyle.symbolRadius : 0;
  const roundedDiamondPath = symbolRadius === 0
    ? null
    : createRoundedDiamondPath(symbolRadius);
  const combinedSymbolPath = createCombinedSymbolPath(symbolRadius);

  // 外枠。15セルの隙間・番号・歌詞の領域を塗る outerFrameFill を試したが、
  // 見た目の判断により撤回した（背景画像なしでは transparent のまま紙面色が
  // 透ける挙動が正）。トークン自体も config.js から削除済み。背景画像の下地が
  // 読みにくい問題は不透明度の調整で対応する方針とした
  group.appendChild(
    el('rect', {
      x: 0,
      y: 0,
      width: layout.gridBaseWidth,
      height: layout.gridBaseHeight,
      fill: 'none',
      stroke: gridStyle.outerStrokeWidth === 0 ? 'none' : palette.outerFrame,
      'stroke-width': gridStyle.outerStrokeWidth === 0 ? undefined : gridStyle.outerStrokeWidth,
      rx: gridStyle.outerRadius,
      ry: gridStyle.outerRadius,
    }),
  );

  GRID_CELL_SHAPES.forEach((cell) => {
    const isSelected = cellColorState(selectedKeys, cell.index) === 'highlight';
    const isOther = cellColorState(otherKeys, cell.index) === 'highlight';
    // 重複セルは選択中レイヤーを前面に扱う。単層出力では絶対レイヤーを
    // 意識せず可聴キーを押鍵色1へ寄せ、PDFの既存契約を変えない。
    const highlighted2 = usesTwoLayers && !isSelected && isOther;
    const highlighted = isSelected || (!usesTwoLayers && isOther);
    const cellFill = highlighted2
      ? palette.cellFillHighlight2
      : highlighted
      ? palette.cellFillHighlight
      : palette.cellFill;
    const cellStroke = highlighted2
      ? palette.cellStrokeHighlight2
      : highlighted
      ? palette.cellStrokeHighlight
      : palette.cellStroke;
    const symbolColor = highlighted2
      ? palette.symbolHighlight2
      : highlighted
      ? palette.symbolHighlight
      : palette.symbol;

    group.appendChild(
      el('rect', {
        x: cell.cx + cell.frame.x,
        y: cell.cy + cell.frame.y,
        width: cell.frame.width,
        height: cell.frame.height,
        fill: cellFill,
        stroke: cellStroke,
        'stroke-width': gridStyle.cellStrokeWidth,
        rx: gridStyle.cellRadius,
        ry: gridStyle.cellRadius,
      }),
    );

    const symbolGroup = el('g', {
      transform: `translate(${cell.cx}, ${cell.cy})`,
    });
    cell.symbols.forEach((s) => {
      if (s.kind === 'polygon') {
        const attrs = {
          fill: 'none',
          stroke: symbolColor,
          'stroke-width': gridStyle.symbolStrokeWidth,
        };
        symbolGroup.appendChild(symbolRadius === 0
          ? el('polygon', { ...attrs, points: s.points })
          : el('path', { ...attrs, d: roundedDiamondPath }));
      } else if (s.kind === 'circle') {
        symbolGroup.appendChild(
          el('circle', {
            cx: s.cx,
            cy: s.cy,
            r: s.r,
            fill: 'none',
            stroke: symbolColor,
            'stroke-width': gridStyle.symbolStrokeWidth,
          }),
        );
      } else if (s.kind === 'path') {
        symbolGroup.appendChild(
          el('path', {
            d: combinedSymbolPath,
            fill: 'none',
            stroke: symbolColor,
            'stroke-width': gridStyle.symbolStrokeWidth,
          }),
        );
      }
    });
    group.appendChild(symbolGroup);
  });

  // グリッド番号 (左下)
  if (typography.gridNumberDisplayId === 'show') {
    const numberText = el('text', {
      x: GRID_NUMBER_POS.x,
      y: GRID_NUMBER_POS.y,
      'font-family': fontName,
      'font-size': typography.gridNumberFontSizePt,
      fill: palette.number,
      'text-anchor': 'start',
    });
    numberText.textContent = String(gridNumber);
    group.appendChild(numberText);
  }

  // 歌詞などのテキスト (中央下)
  if (grid.text) {
    let text = sanitizeForPdf(grid.text);
    // 実際に紙に出るのは埋め込み書体なので、その metrics で幅を測る。
    // doc.getStringUnitWidth はフォントサイズ1相当の幅（フォントサイズに
    // 依存しない比率）を返すため、*fontSize でそのまま SVG 座標系の幅になる
    // （doc.setFont(fontName) 済みであることが前提。呼び出し元で保証している）。
    const unitWidth = doc.getStringUnitWidth(text);

    let lyric;
    if (!Number.isFinite(unitWidth) || unitWidth <= 0) {
      // fitFontSize と同じく、埋め込み書体が幅を返せない場合がある
      // （コメント参照）。x の計算に NaN/0 が混じると歌詞そのものが
      // 描かれなくなるため、実測を諦めて設定後の上限サイズ（text-anchor=
      // 'middle'・中央位置はsvg2pdfのフォールバック書体実測任せ）に落とす。
      lyric = el('text', {
        x: GRID_TEXT_CENTER.x,
        y: GRID_TEXT_CENTER.y + (typography.lyricMaxFontSizePt * 0.35),
        'font-family': fontName,
        'font-size': typography.lyricMaxFontSizePt,
        fill: palette.text,
        'text-anchor': 'middle',
      });
    } else {
      // 幅300に収まる最大サイズを実測から求める。設定割合は上限・下限の
      // 両方へ同じ割合で適用し、縮小後の実効サイズで省略幅も測る。
      let fontSize = typography.lyricMaxFontSizePt;
      if (unitWidth * fontSize > 300) {
        fontSize = Math.max(
          typography.lyricMinFontSizePt,
          Math.floor(300 / unitWidth),
        );
      }
      // 10ptまで縮めても収まらない極端に長い歌詞は、textLengthで押し込むの
      // ではなく末尾を切り詰める。svg2pdfはtextLengthをブラウザ側の
      // フォールバック書体の実測からcharSpaceへ変換するため、埋め込み書体
      // では字送りが負の値になり、隣接文字と重なって判読不能になる
      // （100文字級の歌詞では字送りが-7pt前後になる）。
      text = truncateToUnitWidth(doc, text, 300 / fontSize);
      const renderedWidth = doc.getStringUnitWidth(text) * fontSize;

      lyric = el('text', {
        // text-anchor='middle' は svg2pdf がフォールバック書体で幅を測って
        // 中央を決めてしまい、埋め込み書体との差の半分だけ左右にずれるため
        // 使わない。'start' にして中央位置を自前で計算する
        x: GRID_TEXT_CENTER.x - renderedWidth / 2,
        y: GRID_TEXT_CENTER.y + (fontSize * 0.35), // サイズに合わせてY位置も微調整
        'font-family': fontName,
        'font-size': fontSize,
        fill: palette.text,
        'text-anchor': 'start',
      });
    }
    lyric.textContent = text;
    group.appendChild(lyric);
  }

  return group;
}

/** 1 ページ分の SVG 要素とサイズを生成 */
export function buildPageSvg(
  doc,
  pageRows,
  columns,
  palette,
  fontName,
  gridStyle,
  typography,
  layout,
  edgePadding = 0,
  layerOptions = {},
) {
  const numRows = pageRows.length;
  const { svgWidth, svgHeight, columnPitch, rowPitch, edgePadding: safeEdgePadding } = computeGridBlockSize({
    columns,
    rows: numRows,
    gridBaseWidth: layout.gridBaseWidth,
    gridBaseHeight: layout.gridBaseHeight,
    gridHorizontalSpacing: layout.gridHorizontalSpacing,
    gridVerticalSpacing: layout.gridVerticalSpacing,
    edgePadding,
  });

  const svg = el('svg', {
    xmlns: SVG_NS,
    width: svgWidth,
    height: svgHeight,
    viewBox: `0 0 ${svgWidth} ${svgHeight}`,
  });

  // 偶数行は「そのページの中で上から2・4・6…行目」で数える。ページごとに
  // 同じ見え方になり、改行マークで行数が変わっても紙面の途中で反転しない。
  const isShadedRow = (rowIndex) => layout.rowShadingId === 'even' && rowIndex % 2 === 1;
  const shadingOpacity = rowShadingOpacity(palette.pageBackground);
  // 帯は鍵盤の面（半透明）には効かないため、網掛け行のグリッドは面の色を
  // 同じ割合だけ暗くして、行全体が一様に沈んで見えるようにする。
  const shadedPalette = layout.rowShadingId === 'even'
    ? shadeRowPalette(palette, shadingOpacity)
    : palette;

  // 網掛けはグリッドより前に置く（後ろから重ねると記号や歌詞も沈む）。
  if (layout.rowShadingId === 'even') {
    pageRows.forEach((_row, rowIndex) => {
      if (!isShadedRow(rowIndex)) return;
      const bandTop = Math.max(
        0,
        safeEdgePadding + rowIndex * rowPitch - layout.gridVerticalSpacing / 2,
      );
      const bandBottom = Math.min(
        svgHeight,
        safeEdgePadding + rowIndex * rowPitch + layout.gridBaseHeight
          + layout.gridVerticalSpacing / 2,
      );
      svg.appendChild(
        el('rect', {
          x: 0,
          y: bandTop,
          width: svgWidth,
          height: bandBottom - bandTop,
          fill: PDF_ROW_SHADING_COLOR,
          opacity: shadingOpacity,
        }),
      );
    });
  }

  pageRows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = safeEdgePadding + colIndex * columnPitch;
      const y = safeEdgePadding + rowIndex * rowPitch;
      const group = buildGridGroup(
        doc,
        cell.grid,
        cell.index + 1,
        isShadedRow(rowIndex) ? shadedPalette : palette,
        fontName,
        gridStyle,
        typography,
        layout,
        layerOptions,
      );
      group.setAttribute('transform', `translate(${x}, ${y})`);
      svg.appendChild(group);
    });
  });

  return { svg, svgWidth, svgHeight };
}

/** 用紙全面を塗る。ヘッダとグリッドより先に描く必要がある。 */
function drawPageBackground(doc, palette, sheetGeometry) {
  doc.setFillColor(palette.pageBackground);
  doc.rect(0, 0, sheetGeometry.sheetWidthPt, sheetGeometry.sheetHeightPt, 'F');
}

// addImageに明示のaliasを渡すための固定文字列。同一の画像データを渡す限り
// jsPDFはコンテンツのハッシュで自動的に共有するが（実測で確認済み）、alias明示は
// 安全側の保険として推奨されている。1回のexportPdf呼び出しでは背景画像は
// 常に同一のdata:URLなので、固定値でよい。
const BACKGROUND_IMAGE_ALIAS = 'pdf-background-image';

/**
 * 背景画像を用紙全面に「用紙を覆うように拡大して中央でトリミング」して描く。
 * 背景色の上、本文（見出し・グリッド・ページ番号）より先に描く必要がある。
 * 呼び出し側は用紙ごとに1回だけ呼ぶこと（不変条件7。2面付けでスロットごとに
 * 2回描くと用紙の継ぎ目に不要な塗り重ねが生じる）。
 *
 * data:URL は呼び出しのたびに新しく作らず、options.backgroundImage.dataUrl
 * をそのまま毎回渡す（App.jsx 側で画像選択時に1回だけ生成し、以後は
 * 使い回す設計になっている）。
 */
function drawBackgroundImage(doc, backgroundImage, sheetGeometry) {
  if (!backgroundImage) return;
  const { dataUrl, width: imgWidth, height: imgHeight } = backgroundImage;
  if (!imgWidth || !imgHeight) return;

  const { sheetWidthPt, sheetHeightPt } = sheetGeometry;
  const coverScale = Math.max(sheetWidthPt / imgWidth, sheetHeightPt / imgHeight);
  const drawWidth = imgWidth * coverScale;
  const drawHeight = imgHeight * coverScale;
  const x = (sheetWidthPt - drawWidth) / 2;
  const y = (sheetHeightPt - drawHeight) / 2;

  doc.addImage(dataUrl, 'JPEG', x, y, drawWidth, drawHeight, BACKGROUND_IMAGE_ALIAS);
}

/**
 * maxUnitWidth（フォントサイズ1相当の幅）に収まるまで末尾を落とし、
 * 落とした場合は「…」を付けて返す。下限サイズまで縮めても収まらない文字列を
 * そのまま描くと、align の指定ごと紙面外へ流れて先頭と末尾が印刷されない。
 *
 * 幅の測定を doc.getStringUnitWidth に統一しているのは、フォントサイズに
 * 依存しない比率で比較できるため（呼び出し側が setFontSize の前後どちらでも
 * 同じ結果になる）。doc.setFont(fontName) 済みであることが前提。
 *
 * 分割は Array.from で符号位置単位に行う。slice だとサロゲートペアを
 * 断ち割って不正な文字を残しうる。
 */
export function truncateToUnitWidth(doc, text, maxUnitWidth) {
  if (!Number.isFinite(maxUnitWidth) || maxUnitWidth <= 0) return '';

  const fullWidth = doc.getStringUnitWidth(text);
  // fitFontSize と同じ方針：測れないなら縮めない（NaN/0 ガード）
  if (!Number.isFinite(fullWidth) || fullWidth <= 0) return text;
  if (fullWidth <= maxUnitWidth) return text;

  const chars = Array.from(text);
  for (let n = chars.length; n >= 0; n -= 1) {
    const candidate = `${chars.slice(0, n).join('')}…`;
    const width = doc.getStringUnitWidth(candidate);
    if (Number.isFinite(width) && width > 0 && width <= maxUnitWidth) {
      return candidate;
    }
  }
  return '';
}

/**
 * maxWidth に収まる最大のフォントサイズ（basePt 以下・minPt 以上）。
 * jsPDF の文字幅はフォントサイズに比例するため、比から一度で求まる。
 * 埋め込み書体で getTextWidth が幅を返せなかった場合は basePt のままにする
 * （縮めないだけで、はみ出す以外の実害は出ない）。
 */
function fitFontSize(doc, text, maxWidth, basePt, minPt) {
  doc.setFontSize(basePt);
  const width = doc.getTextWidth(text);
  if (!Number.isFinite(width) || width <= 0 || width <= maxWidth) return basePt;
  return Math.max(minPt, Math.floor((basePt * maxWidth) / width));
}

const SCORE_INFO_SEPARATOR = '　　　';
const SCORE_INFO_COMPACT_SEPARATOR = '　 ';
const TEMPO_NOTE = '♩';
// 埋め込み3書体にU+2669が無いため、同程度の送り幅だけを測る代替文字を使う。
const TEMPO_NOTE_MEASURE_GLYPH = 'M';

export function resolvePdfTempoValue(bpm, tempoValueModeId, customTempoValue) {
  const safeModeId = normalizeTempoValueModeId(tempoValueModeId);
  if (safeModeId === 'custom') return sanitizeCustomTempoValue(customTempoValue);
  return bpm / PDF_TEMPO_VALUE_MODES[safeModeId].divisor;
}

function buildCreditItems(score) {
  return [
    score.author ? `作曲: ${sanitizeForPdf(score.author)}` : '',
    score.lyricist ? `作詞: ${sanitizeForPdf(score.lyricist)}` : '',
    score.transcribedBy ? `譜面作成: ${sanitizeForPdf(score.transcribedBy)}` : '',
  ];
}

function buildCreditValues(score) {
  return [score.author, score.lyricist, score.transcribedBy]
    .map((value) => (value ? sanitizeForPdf(value) : ''));
}

function buildMusicalItemSlots(
  { bpm, bitsPerPage, pitchLevel, keyMode },
  flatGlyph = '♭',
  keyNotationId = 'both',
  keyModeNotationId = 'compact',
  tempoValueModeId = 'quarter',
  customTempoValue = 30,
) {
  const tempoValue = resolvePdfTempoValue(bpm, tempoValueModeId, customTempoValue);
  const tempo = `${TEMPO_NOTE} = ${tempoValue}`;
  const meter = bitsPerPage === 16 ? '4拍子' : bitsPerPage === 12 ? '3拍子' : '';
  const key = formatPdfKeyName(
    pitchLevel,
    keyMode,
    keyNotationId,
    keyModeNotationId,
  )
    .replaceAll('♭', flatGlyph);
  return { tempo, meter, key };
}

function buildMusicalItems(...args) {
  const { tempo, meter, key } = buildMusicalItemSlots(...args);
  return [tempo, meter, key].filter(Boolean);
}

/** 曲情報行（テンポ・拍子・キー）。 */
export function buildMetaLeft(
  score,
  flatGlyph = '♭',
  keyNotationId = 'both',
  keyModeNotationId = 'compact',
  tempoValueModeId = 'quarter',
  customTempoValue = 30,
) {
  return buildMusicalItems(
    score,
    flatGlyph,
    keyNotationId,
    keyModeNotationId,
    tempoValueModeId,
    customTempoValue,
  ).join(SCORE_INFO_SEPARATOR);
}

export function buildMusicCredit(score) {
  return buildCreditItems(score).slice(0, 2).filter(Boolean).join(SCORE_INFO_SEPARATOR);
}

export function buildHeaderCredit(score) {
  return buildCreditItems(score).filter(Boolean).join(SCORE_INFO_SEPARATOR);
}

function buildSpecGroup(labels, values) {
  const visibleItems = labels
    .map((label, index) => ({ label, value: values[index] }))
    .filter(({ value }) => Boolean(value));
  return {
    labels: visibleItems.map(({ label }) => label),
    values: visibleItems.map(({ value }) => value),
  };
}

/** 詳細デザインの各行を、表示件数に応じて均整の取れた位置へ置く。 */
export function getSpecItemCenterRatios(itemCount) {
  if (itemCount === 1) return [0.5];
  if (itemCount === 2) return [1 / 3, 2 / 3];
  if (itemCount === 3) return [1 / 6, 1 / 2, 5 / 6];
  return [];
}

/** 3つの本文内デザインと独立表紙が共有する曲情報の意味構造を組み立てる。 */
export function buildScoreInfoRows(
  score,
  scoreInfoDesignId = 'score',
  flatGlyph = '♭',
  keyNotationId = 'both',
  keyModeNotationId = 'compact',
  tempoValueModeId = 'quarter',
  customTempoValue = 30,
) {
  const safeDesignId = normalizeScoreInfoDesignId(scoreInfoDesignId);
  const credits = buildCreditItems(score);
  const creditValues = buildCreditValues(score);
  const musicalSlots = buildMusicalItemSlots(
    score,
    flatGlyph,
    keyNotationId,
    keyModeNotationId,
    tempoValueModeId,
    customTempoValue,
  );
  if (safeDesignId === 'masthead') {
    const texts = [
      ...credits,
      musicalSlots.tempo,
      musicalSlots.meter,
      musicalSlots.key,
    ].filter(Boolean);
    return [{
      kind: 'line',
      tone: 'muted',
      texts,
      text: texts.join(SCORE_INFO_SEPARATOR),
    }];
  }
  if (safeDesignId === 'specSheet') {
    const creditGroup = buildSpecGroup(
      ['作曲', '作詞', '譜面作成'],
      creditValues,
    );
    const musicalGroup = buildSpecGroup(
      ['テンポ', '拍子', 'キー'],
      [musicalSlots.tempo, musicalSlots.meter, musicalSlots.key],
    );
    return [
      { kind: 'specLabels', texts: creditGroup.labels },
      { kind: 'specValues', texts: creditGroup.values },
      { kind: 'specLabels', texts: musicalGroup.labels },
      { kind: 'specValues', texts: musicalGroup.values },
    ];
  }
  const musicalLine = [
    musicalSlots.tempo,
    musicalSlots.meter,
    musicalSlots.key,
  ].filter(Boolean).join(SCORE_INFO_COMPACT_SEPARATOR);
  const visibleCredits = credits.filter(Boolean);
  const bottomAlignedCredits = [
    ...Array(credits.length - visibleCredits.length).fill(''),
    ...visibleCredits,
  ];
  return [
    ...bottomAlignedCredits.map((credit) => ({ kind: 'columns', texts: ['', credit] })),
    { kind: 'columns', texts: [musicalLine, ''] },
  ];
}

function drawTiltedNoteHead(doc, centerX, centerY, radiusX, radiusY) {
  const angle = -22 * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tangent = 0.5522847498;
  const point = (alongMajor, alongMinor) => [
    centerX + alongMajor * cos - alongMinor * sin,
    centerY + alongMajor * sin + alongMinor * cos,
  ];
  const [rightX, rightY] = point(radiusX, 0);
  const [bottomX, bottomY] = point(0, radiusY);
  const [leftX, leftY] = point(-radiusX, 0);
  const [topX, topY] = point(0, -radiusY);

  doc.moveTo(rightX, rightY);
  doc.curveTo(
    ...point(radiusX, tangent * radiusY),
    ...point(tangent * radiusX, radiusY),
    bottomX,
    bottomY,
  );
  doc.curveTo(
    ...point(-tangent * radiusX, radiusY),
    ...point(-radiusX, tangent * radiusY),
    leftX,
    leftY,
  );
  doc.curveTo(
    ...point(-radiusX, -tangent * radiusY),
    ...point(-tangent * radiusX, -radiusY),
    topX,
    topY,
  );
  doc.curveTo(
    ...point(tangent * radiusX, -radiusY),
    ...point(radiusX, -tangent * radiusY),
    rightX,
    rightY,
  );
  doc.close();
  doc.fill();
}

function drawQuarterNote(doc, x, baselineY, advanceWidth, fontSize, color) {
  const headRadiusX = Math.min(advanceWidth * 0.28, fontSize * 0.18);
  const headRadiusY = fontSize * 0.11;
  const headX = x + advanceWidth * 0.42;
  const headY = baselineY - fontSize * 0.08;
  const angle = -22 * (Math.PI / 180);
  const stemX = headX + headRadiusX * Math.cos(angle) * 0.82;
  const stemBottomY = headY + headRadiusX * Math.sin(angle) * 0.82;

  doc.setFillColor(color);
  doc.setDrawColor(color);
  doc.setLineWidth(Math.max(0.45, fontSize * 0.065));
  drawTiltedNoteHead(doc, headX, headY, headRadiusX, headRadiusY);
  doc.line(stemX, stemBottomY, stemX, stemBottomY - fontSize * 0.62);
}

function drawTextWithQuarterNotes(doc, text, sourceText, x, y, align, fontSize, color) {
  const chars = Array.from(text);
  const sourceChars = Array.from(sourceText);
  const noteIndices = chars
    .map((char, index) => (
      char === TEMPO_NOTE_MEASURE_GLYPH && sourceChars[index] === TEMPO_NOTE ? index : -1
    ))
    .filter((index) => index >= 0);

  if (noteIndices.length === 0) {
    doc.text(text, x, y, { align });
    return;
  }

  const textWidth = doc.getStringUnitWidth(text) * fontSize;
  const startX = align === 'center'
    ? x - textWidth / 2
    : align === 'right'
      ? x - textWidth
      : x;
  let segmentStart = 0;

  noteIndices.forEach((noteIndex) => {
    const prefix = chars.slice(0, noteIndex).join('');
    const segment = chars.slice(segmentStart, noteIndex).join('');
    const noteX = startX + doc.getStringUnitWidth(prefix) * fontSize;
    if (segment) {
      const segmentX = startX
        + doc.getStringUnitWidth(chars.slice(0, segmentStart).join('')) * fontSize;
      doc.text(segment, segmentX, y);
    }
    drawQuarterNote(
      doc,
      noteX,
      y,
      doc.getStringUnitWidth(TEMPO_NOTE_MEASURE_GLYPH) * fontSize,
      fontSize,
      color,
    );
    segmentStart = noteIndex + 1;
  });

  const tail = chars.slice(segmentStart).join('');
  if (tail) {
    const tailX = startX
      + doc.getStringUnitWidth(chars.slice(0, segmentStart).join('')) * fontSize;
    doc.text(tail, tailX, y);
  }
}

function drawHeaderText(
  doc,
  { text, fontName, fontSize, color, maxWidth, minFontSize, x, y, align },
) {
  // svg2pdfの後や別の行の描画後にも、行ごとの意図した描画状態を確実にする。
  doc.setFont(fontName);
  doc.setFontSize(fontSize);
  doc.setTextColor(color);
  if (!text) return;

  const measuredText = text.replaceAll(TEMPO_NOTE, TEMPO_NOTE_MEASURE_GLYPH);
  const fittedFontSize = fitFontSize(doc, measuredText, maxWidth, fontSize, minFontSize);
  doc.setFontSize(fittedFontSize);
  drawTextWithQuarterNotes(
    doc,
    truncateToUnitWidth(doc, measuredText, maxWidth / fittedFontSize),
    text,
    x,
    y,
    align,
    fittedFontSize,
    color,
  );
}

function drawScoreInfoRow(
  doc,
  row,
  {
    fontName,
    fontSize,
    color,
    pageWidthPt,
    marginPt,
    contentWidthPt,
    origin,
    y,
    placement,
    mutedColor,
    columnLeftPt = marginPt,
    columnRightPt = pageWidthPt - marginPt,
  },
) {
  if (row.kind === 'specLabels' || row.kind === 'specValues') {
    const cellWidth = contentWidthPt / 3;
    const cellPadding = Math.min(6, cellWidth * 0.04);
    const isLabel = row.kind === 'specLabels';
    const centerRatios = getSpecItemCenterRatios(row.texts.length);
    row.texts.forEach((text, index) => {
      drawHeaderText(doc, {
        text,
        fontName,
        fontSize: isLabel ? Math.max(6, fontSize * 0.72) : fontSize,
        color: isLabel ? mutedColor : color,
        maxWidth: cellWidth - cellPadding * 2,
        minFontSize: 6,
        x: origin.x + marginPt + contentWidthPt * centerRatios[index],
        y,
        align: 'center',
      });
    });
    return;
  }

  if (row.kind === 'columns') {
    const columnGap = 12;
    const columnWidth = (columnRightPt - columnLeftPt - columnGap) / 2;
    drawHeaderText(doc, {
      text: row.texts[0],
      fontName,
      fontSize,
      color,
      maxWidth: columnWidth,
      minFontSize: 6,
      x: origin.x + columnLeftPt,
      y,
      align: 'left',
    });
    drawHeaderText(doc, {
      text: row.texts[1],
      fontName,
      fontSize,
      color,
      maxWidth: columnWidth,
      minFontSize: 6,
      x: origin.x + columnRightPt,
      y,
      align: 'right',
    });
    return;
  }

  drawHeaderText(doc, {
    text: row.text,
    fontName,
    fontSize,
    color: row.tone === 'muted' ? mutedColor : color,
    maxWidth: contentWidthPt,
    minFontSize: 6,
    x: origin.x + placement.anchorX,
    y,
    align: placement.align,
  });
}

/** 先頭論理ページへ選択された完成組版で見出しを描く。 */
function drawFirstPageHeader(
  doc,
  palette,
  fontName,
  score,
  layout,
  origin,
  firstPageLayoutId,
  flatGlyph,
  keyNotationId,
  keyModeNotationId,
  scoreInfoDesignId,
  tempoValueModeId,
  customTempoValue,
  gridHorizontalBounds,
) {
  const {
    pageWidthPt,
    marginPt,
    contentTopPt,
    contentWidthPt,
    titleFontSizePt,
    metaFontSizePt,
  } = layout;
  const alignment = resolveFirstPageHeaderAlignment(firstPageLayoutId);
  const placement = getFirstPageHeaderPlacement(alignment, { pageWidthPt, marginPt });
  const safeDesignId = normalizeScoreInfoDesignId(scoreInfoDesignId);
  const metrics = getFirstPageHeaderMetrics(
    titleFontSizePt,
    metaFontSizePt,
    safeDesignId,
  );
  const anchorX = origin.x + placement.anchorX;
  const textBaseY = origin.y + contentTopPt - PDF_FIRST_PAGE_HEADER_TEXT_SHIFT_PT;
  const dividerBaseY = origin.y + contentTopPt;

  drawHeaderText(doc, {
    text: score.title ? sanitizeForPdf(score.title) : '',
    fontName,
    fontSize: titleFontSizePt,
    color: palette.title,
    maxWidth: contentWidthPt,
    minFontSize: 9,
    x: anchorX,
    y: textBaseY + metrics.titleY,
    align: placement.align,
  });
  const scoreInfoRows = buildScoreInfoRows(
    score,
    safeDesignId,
    flatGlyph,
    keyNotationId,
    keyModeNotationId,
    tempoValueModeId,
    customTempoValue,
  );
  scoreInfoRows.forEach((row, index) => {
    drawScoreInfoRow(doc, row, {
      fontName,
      fontSize: metaFontSizePt,
      color: palette.title,
      pageWidthPt,
      marginPt,
      contentWidthPt,
      origin,
      y: textBaseY + metrics.metaYs[index],
      placement,
      mutedColor: palette.number,
      columnLeftPt: safeDesignId === 'score'
        ? gridHorizontalBounds.leftPt
        : marginPt,
      columnRightPt: safeDesignId === 'score'
        ? gridHorizontalBounds.rightPt
        : pageWidthPt - marginPt,
    });
  });

  if (safeDesignId === 'masthead') {
    doc.setDrawColor(palette.outerFrame);
    doc.setLineWidth(0.7);
    doc.line(
      origin.x + marginPt,
      dividerBaseY + metrics.lineY,
      origin.x + pageWidthPt - marginPt,
      dividerBaseY + metrics.lineY,
    );
  }
}

function getCoverMetrics(layout) {
  const titleY = layout.pageHeightPt * 0.38;
  const creditY = titleY + Math.max(layout.titleFontSizePt * 1.8, layout.metaFontSizePt * 2.5);
  const lowerY = layout.pageHeightPt - layout.marginPt - layout.metaFontSizePt * 0.35;
  return { titleY, creditY, lowerY };
}

/** 独立表紙を描く。本文のグリッドやページ装飾は表紙へ持ち込まない。 */
function drawCover(
  doc,
  palette,
  fontName,
  score,
  layout,
  origin = { x: 0, y: 0 },
  flatGlyph = '♭',
  keyNotationId = 'both',
  keyModeNotationId = 'compact',
  tempoValueModeId = 'quarter',
  customTempoValue = 30,
) {
  const { marginPt, contentWidthPt } = layout;
  const { titleY, creditY, lowerY } = getCoverMetrics(layout);
  const centerX = origin.x + layout.pageWidthPt / 2;
  const leftX = origin.x + marginPt;
  const rightX = origin.x + layout.pageWidthPt - marginPt;
  const titleOriginY = origin.y + titleY;
  const creditOriginY = origin.y + creditY;
  const lowerOriginY = origin.y + lowerY;

  doc.setFont(fontName);
  doc.setTextColor(palette.title);

  if (score.title) {
    const title = sanitizeForPdf(score.title);
    const titleFontSize = fitFontSize(doc, title, contentWidthPt, layout.titleFontSizePt, 9);
    doc.setFontSize(titleFontSize);
    doc.text(
      truncateToUnitWidth(doc, title, contentWidthPt / titleFontSize),
      centerX,
      titleOriginY,
      { align: 'center' },
    );
  }

  const musicCredit = buildMusicCredit(score);
  drawHeaderText(doc, {
    text: musicCredit,
    fontName,
    fontSize: layout.metaFontSizePt,
    color: palette.title,
    maxWidth: contentWidthPt,
    minFontSize: 6,
    x: centerX,
    y: creditOriginY,
    align: 'center',
  });

  const metaLeft = buildMetaLeft(
    score,
    flatGlyph,
    keyNotationId,
    keyModeNotationId,
    tempoValueModeId,
    customTempoValue,
  );
  const transcribedBy = score.transcribedBy
    ? `譜面作成: ${sanitizeForPdf(score.transcribedBy)}`
    : '';
  const lowerGap = 12;
  const lowerMaxWidth = metaLeft && transcribedBy
    ? (contentWidthPt - lowerGap) / 2
    : contentWidthPt;
  drawHeaderText(doc, {
    text: metaLeft,
    fontName,
    fontSize: layout.metaFontSizePt,
    color: palette.text,
    maxWidth: lowerMaxWidth,
    minFontSize: 6,
    x: leftX,
    y: lowerOriginY,
    align: 'left',
  });
  drawHeaderText(doc, {
    text: transcribedBy,
    fontName,
    fontSize: layout.metaFontSizePt,
    color: palette.text,
    maxWidth: lowerMaxWidth,
    minFontSize: 6,
    x: rightX,
    y: lowerOriginY,
    align: 'right',
  });
}

/** 2ページ目以降の上中央に置く曲名の柱。 */
function drawRunningHeader(
  doc,
  palette,
  fontName,
  score,
  pageIndex,
  furniture,
  layout,
  firstPageLayoutId,
  origin = { x: 0, y: 0 },
) {
  if (
    (pageIndex === 0 && firstPageLayoutId !== 'cover') ||
    furniture.runningHeaderId !== 'title' ||
    !score.title
  ) return;

  const fontSize = Math.min(layout.pageNumberFontSizePt, layout.metaFontSizePt);
  const title = sanitizeForPdf(score.title);
  doc.setFont(fontName);
  doc.setFontSize(fontSize);
  doc.setTextColor(palette.number);
  const truncated = truncateToUnitWidth(doc, title, layout.contentWidthPt / fontSize);
  doc.text(
    truncated,
    origin.x + layout.pageWidthPt / 2,
    origin.y + layout.contentTopPt + fontSize,
    { align: 'center' },
  );
}

/** 譜面作成者のクレジットをページ番号と反対側の下端へ置く。 */
function drawFooterCredit(
  doc,
  palette,
  fontName,
  score,
  furniture,
  pageIndex,
  slotIndex,
  slotsPerSheet,
  layout,
  origin = { x: 0, y: 0 },
) {
  if (furniture.footerCreditId !== 'transcribedBy' || !score.transcribedBy) return;

  const fontSize = layout.pageNumberFontSizePt;
  const text = `譜面作成: ${sanitizeForPdf(score.transcribedBy)}`;
  const placement = getPageFurniturePlacement({
    pageNumberPositionId: furniture.pageNumberPositionId,
    pageIndex,
    slotIndex,
    slotsPerSheet,
    pageWidthPt: layout.pageWidthPt,
    marginPt: layout.marginPt,
  });
  doc.setFont(fontName);
  doc.setFontSize(fontSize);
  doc.setTextColor(palette.number);
  const truncated = truncateToUnitWidth(doc, text, (layout.contentWidthPt * 0.4) / fontSize);
  doc.text(
    truncated,
    origin.x + placement.footer.x,
    origin.y + layout.pageNumberBaselinePt,
    { align: placement.footer.align },
  );
}

/**
 * 設定された位置・形式のページ番号。
 * doc.svg() が描画状態を変えている可能性があるため、書体をここで指定し直す。
 */
function drawPageNumber(
  doc,
  palette,
  fontName,
  pageIndex,
  pageCount,
  furniture,
  slotIndex,
  slotsPerSheet,
  layout,
  origin = { x: 0, y: 0 },
) {
  const text = formatPageNumber(furniture.pageNumberFormatId, pageIndex, pageCount);
  if (!text) return;

  const placement = getPageFurniturePlacement({
    pageNumberPositionId: furniture.pageNumberPositionId,
    pageIndex,
    slotIndex,
    slotsPerSheet,
    pageWidthPt: layout.pageWidthPt,
    marginPt: layout.marginPt,
  });
  doc.setFont(fontName);
  doc.setFontSize(layout.pageNumberFontSizePt);
  doc.setTextColor(palette.number);
  doc.text(
    text,
    origin.x + placement.pageNumber.x,
    origin.y + layout.pageNumberBaselinePt,
    { align: placement.pageNumber.align },
  );
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(
    d.getHours(),
  )}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// svg2pdf の Promise は解決後に次のマイクロタスクへ連鎖するため、await だけでは
// 長い譜面の全ページ処理中に描画や入力処理へ戻れない。タイマーを1回挟み、PDFの
// 中身を変えずにブラウザへイベント処理の機会を渡す。
function yieldToBrowser() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// jsPDF は画像リソースの出力時に内部の圧縮フィルターを変更するため、同じ
// インスタンスを再出力してはいけない。プレビュー不能時も最初に作ったBlobを
// そのままダウンロードし、2回目のPDF組み立てを避ける。
function openOrDownloadPdfBlob(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank');
  if (win) {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return true;
  }

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  return false;
}

/**
 * PDF を生成して新規タブでプレビュー / もしくはダウンロード。
 * @param {{ grids: Array, title: string, bpm: number, author: string,
 *          lyricist: string, transcribedBy: string, bitsPerPage: number,
 *          pitchLevel: number, keyMode?: 'major'|'minor' }} score
 * @param {{ presetId: string, fontId: string, fontWeightId?: 'regular'|'bold',
 *          titleFontSizePt?: number,
 *          metaFontSizePt?: number, maxRowsPerPage?: number,
 *          lyricSizePercent?: number, gridNumberSizePercent?: number,
 *          gridNumberDisplayId?: 'show'|'none',
 *          pageNumberFontSizePt?: number,
 *          sheetLayoutId?: 'single'|'double',
 *          columnsPerPageId?: 'auto'|'col2'|'col3'|'col4'|'col5'|'col6'|'col7'|'col8',
 *          rowShadingId?: 'none'|'even',
 *          scoreInfoDesignId?: 'score'|'masthead'|'specSheet'|'cover',
 *          mastheadDirectionId?: 'left'|'right',
 *          tempoValueModeId?: 'quarter'|'half'|'custom',
 *          customTempoValue?: number,
 *          keyNotationId?: 'both'|'sharp'|'flat',
 *          keyModeNotationId?: 'compact'|'english'|'japanese'|'traditional',
 *          pageMarginId?: 'narrow'|'standard'|'wide',
 *          gridGapId?: 'tight'|'standard'|'loose',
 *          pageNumberFormatId?: 'currentTotal'|'current'|'none',
 *          pageNumberPositionId?: 'bottomCenter'|'bottomLeft'|'bottomRight'|'bottomOuter'|'bottomInner',
 *          runningHeaderId?: 'none'|'title',
 *          footerCreditId?: 'none'|'transcribedBy',
 *          custom?: { bg, ink, line, surface, accent, accentLine, accent2,
 *          accentLine2 },
 *          selectedLayer?: 1 | 2,
 *          backgroundImage?: { dataUrl: string, width: number,
 *          height: number } | null }} options
 *          custom は presetId === 'custom' のときだけ参照される。
 *          backgroundImage は src/lib/backgroundImage.js の戻り値をそのまま
 *          渡す想定（localStorageには保存しない値なので pdfPrefs.js は
 *          関与しない。App.jsx が options へ合流させる）。背景画像は背景色の
 *          上に重ねて描かれ、配色（bg）には影響しない。
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<{ filename: string, opened: boolean }>}
 */
export async function exportPdf(score, options, onProgress = () => {}) {
  const { grids, bitsPerPage } = score;
  if (!grids || grids.length === 0) {
    throw new Error('PDF を生成するためのデータがありません。');
  }

  const rawOptions = options ?? {};
  const typography = resolvePdfTypography(rawOptions);
  const furniture = resolvePdfPageFurniture(rawOptions);
  const scoreInfo = resolvePdfScoreInfoDesign(rawOptions);
  const firstPage = resolvePdfFirstPageLayout(scoreInfo);
  const density = resolvePdfDensity(rawOptions);
  const safePresetId =
    rawOptions.presetId === CUSTOM_PRESET_ID ||
    Object.prototype.hasOwnProperty.call(PDF_PRESETS, rawOptions.presetId)
      ? rawOptions.presetId
      : DEFAULT_PRESET_ID;
  const safeOptions = {
    ...rawOptions,
    presetId: safePresetId,
    fontId: typography.fontId,
    fontWeightId: typography.fontWeightId,
    titleFontSizePt: typography.titleFontSizePt,
    metaFontSizePt: typography.metaFontSizePt,
    maxRowsPerPage: typography.maxRowsPerPage,
    lyricSizePercent: typography.lyricSizePercent,
    gridNumberSizePercent: typography.gridNumberSizePercent,
    gridNumberDisplayId: typography.gridNumberDisplayId,
    pageNumberFontSizePt: typography.pageNumberFontSizePt,
    pageMarginId: density.pageMarginId,
    gridGapId: density.gridGapId,
    columnsPerPageId: density.columnsPerPageId,
    rowShadingId: density.rowShadingId,
    ...scoreInfo,
    tempoValueModeId: normalizeTempoValueModeId(rawOptions.tempoValueModeId),
    customTempoValue: sanitizeCustomTempoValue(rawOptions.customTempoValue),
    keyNotationId: normalizeKeyNotationId(rawOptions.keyNotationId),
    keyModeNotationId: normalizeKeyModeNotationId(rawOptions.keyModeNotationId),
    ...furniture,
  };

  // 形状設定は外部から直接呼ばれる経路でも安全な既定値へ正規化し、
  // 以後のページ・グリッドループでは同じ実効値だけを使う。
  const gridStyle = resolvePdfGridStyle(safeOptions);
  const edgePadding = derivePdfGridEdgePadding(gridStyle);

  // presetId が 'custom' のときだけ利用者指定の種色を使う。sanitizeCustomSeed
  // は exportPdf を直接呼ぶ経路（pdfPrefs.js を経由しない呼び出し）への保険
  // として、ここでもキーごとに検証する（sheetLayoutId と同じ二重防御）。
  const seed = resolvePaletteSeed(safeOptions);
  const preset =
    safeOptions.presetId === CUSTOM_PRESET_ID
      ? { seed }
      : { ...PDF_PRESETS[safeOptions.presetId], seed };
  const palette = buildPdfPalette(preset);
  // レイヤーの有無はscoreから再計算する。呼び出し側の表示状態をそのまま
  // 信頼すると、単層JSONに二層用の配色を誤適用できるため。
  const { usesTwoLayers } = analyzeScoreLayers(grids);
  const layerOptions = {
    usesTwoLayers,
    selectedLayer: rawOptions.selectedLayer === 2 ? 2 : 1,
  };
  const font = typography;

  onProgress(`${font.label}を読み込んでいます...`);
  const fontBase64 = await loadFontBase64(typography);

  // 1面付け／2面付けの2つだけ（任意のN面付けには一般化しない）。
  // 不正な値は1面付けへフォールバックする（既定値の落とし先はpdfPrefs.js側で
  // 既に検証済みだが、exportPdfを直接呼ぶ経路への保険として二重に持つ）。
  const sheetLayoutId = Object.prototype.hasOwnProperty.call(
    PDF_SHEET_LAYOUTS,
    safeOptions.sheetLayoutId,
  )
    ? safeOptions.sheetLayoutId
    : DEFAULT_SHEET_LAYOUT_ID;
  const sheetGeometry = buildSheetGeometry(sheetLayoutId);
  // double＋coverでは本文と同じ横向き用紙の左右スロットへ表紙を配置する。
  // single＋coverだけ独立したA4縦表紙になる。
  const coverGeometry =
    firstPage.firstPageLayoutId === 'cover' && sheetLayoutId === 'double'
      ? sheetGeometry
      : buildSheetGeometry('single');
  const coverIncludesFirstBodyPage =
    firstPage.firstPageLayoutId === 'cover' && sheetLayoutId === 'double';

  // 3000グリッドではSVG由来の反復描画命令がPDFの大半を占めるため、内容
  // ストリームを圧縮する。描画順や座標には影響しない。
  const doc = new jsPDF({
    orientation: firstPage.firstPageLayoutId === 'cover'
      ? coverGeometry.orientation
      : sheetGeometry.orientation,
    unit: 'pt',
    format: 'a4',
    compress: true,
  });
  try {
    doc.addFileToVFS(font.file, fontBase64);
    doc.addFont(font.file, font.name, 'normal');
  } catch (err) {
    // addFont の検証(TTFFont.open)が投げた場合、fontCache には検証前の
    // base64 が残ったままになる。次回呼び出しでも同じ壊れた値を返し続けない
    // よう、キャッシュを空に戻してから再スローする
    fontCache = { file: null, base64: null };
    throw err;
  }
  doc.setFont(font.name);

  // layout は「論理ページ（=スロット）1つぶん」の座標系。1面付けなら
  // スロット=用紙全体で従来と同一。2面付けなら用紙を左右に割った
  // スロット1つぶんの大きさになり、全スロット・全ページで共通の1つの
  // layoutを使い回す（不変条件2：見出し確保高を全ページで揃える）。
  const layout = buildLayout(safeOptions, sheetGeometry.slotWidthPt, sheetGeometry.slotHeightPt);

  // 列数を増やしても紙面からはみ出さないのは、下で求める縮尺が幅と高さの
  // 両方を見て小さい方だけを採るため。ここで列数だけを差し替えれば、行数・余白・
  // グリッド間隔との組み合わせは既存の1つの縮尺計算がそのまま吸収する。
  const columns = resolveColumnsPerPage(safeOptions.columnsPerPageId, bitsPerPage);
  const rows = splitIntoRows(grids, columns);
  const pages = paginateRows(rows, layout.maxRowsPerPage);
  const pagePlan = buildPdfPagePlan({
    firstPageLayoutId: firstPage.firstPageLayoutId,
    sheetGeometry,
    coverGeometry,
    logicalPageCount: pages.length,
    coverIncludesFirstBodyPage,
  });
  const coverLayout = firstPage.firstPageLayoutId === 'cover'
    ? buildLayout(safeOptions, coverGeometry.slotWidthPt, coverGeometry.slotHeightPt)
    : null;

  // オフスクリーン領域に一時的に配置して getBBox を安定させる
  const holder = document.createElement('div');
  holder.style.cssText =
    'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden;';
  document.body.appendChild(holder);

  // 縮尺は全ページ共通で1回だけ求める。ページごとに求めると、行数の少ない
  // ページ（典型的には最終ページ）だけ高さに余裕が生まれて縮尺が大きくなり、
  // グリッドの大きさがページ間で食い違う。基準はドキュメント内で最も行数の
  // 多いページの高さとする（総行数が maxRowsPerPage 未満の譜面まで
  // 不必要に小さく描かないため）。
  const maxRowsInDoc = Math.max(...pages.map((page) => page.length));
  const tallestBlock = computeGridBlockSize({
    columns,
    rows: maxRowsInDoc,
    gridBaseWidth: layout.gridBaseWidth,
    gridBaseHeight: layout.gridBaseHeight,
    gridHorizontalSpacing: layout.gridHorizontalSpacing,
    gridVerticalSpacing: layout.gridVerticalSpacing,
    edgePadding,
  });
  const { svgWidth, svgHeight: tallestSvgHeight } = tallestBlock;
  const scale = Math.min(
    layout.contentWidthPt / svgWidth,
    layout.contentHeightPt / tallestSvgHeight,
  );
  const offsetX =
    layout.marginPt + (layout.contentWidthPt - svgWidth * scale) / 2;
  const offsetY = layout.contentTopPt + layout.titleAreaPt;
  // 曲情報デザイン「楽譜」はこの左右端へ揃える。列数を増やす・行数を
  // 増やすとグリッド幅は狭くなるが、曲情報の行だけは基準幅より狭くしない。
  const gridHorizontalBounds = expandBoundsToMinWidth(
    getScaledGridHorizontalBounds({ offsetX, svgWidth, edgePadding, scale }),
    deriveScoreInfoMinWidthPt(layout),
    layout,
  );

  try {
    for (let physicalPageIndex = 0; physicalPageIndex < pagePlan.length; physicalPageIndex += 1) {
      const physicalPage = pagePlan[physicalPageIndex];
      if (physicalPageIndex > 0) {
        // 不変条件3：埋め込み書体のmetricsをbuildGridGroupが読むため、
        // 用紙を追加するたびに向きと書体を明示的に戻す。
        doc.addPage('a4', physicalPage.geometry.orientation);
        doc.setFont(font.name);
      }
      // 背景色→背景画像の順で用紙全体に1回だけ描く（スロットごとに2回描かない。
      // 不変条件7）。本文（見出し・グリッド・ページ番号）より先に描く
      drawPageBackground(doc, palette, physicalPage.geometry);
      drawBackgroundImage(doc, safeOptions.backgroundImage, physicalPage.geometry);

      if (physicalPage.kind === 'cover') {
        drawCover(
          doc,
          palette,
          font.name,
          score,
          coverLayout,
          coverGeometry.slotOrigins[physicalPage.coverSlotIndex],
          font.flatGlyph,
          safeOptions.keyNotationId,
          safeOptions.keyModeNotationId,
          safeOptions.tempoValueModeId,
          safeOptions.customTempoValue,
        );
      }

      const bodySlots = physicalPage.bodySlots ?? [];
      for (const { slotIndex, pageIndex: p } of bodySlots) {
        onProgress(`PDF ページ ${p + 1} / ${pages.length} を生成中...`);
        const origin = physicalPage.geometry.slotOrigins[slotIndex];
        const slotsPerSheet = physicalPage.geometry.slotsPerSheet;

        // 曲名や曲情報は先頭論理ページにだけ置く。表紙付きでは本文先頭に
        // 大見出しを置かず、柱が有効なら下のdrawRunningHeaderで描く。
        if (p === 0 && firstPage.firstPageLayoutId !== 'cover') {
          drawFirstPageHeader(
            doc,
            palette,
            font.name,
            score,
            layout,
            origin,
            firstPage.firstPageLayoutId,
            font.flatGlyph,
            safeOptions.keyNotationId,
            safeOptions.keyModeNotationId,
            safeOptions.scoreInfoDesignId,
            safeOptions.tempoValueModeId,
            safeOptions.customTempoValue,
            gridHorizontalBounds,
          );
        }

        // buildGridGroup が doc.getStringUnitWidth で埋め込み書体の metrics を
        // 読むため、この時点で doc.setFont(font.name) 済みであることが前提
        // （sheetIndex===0 は上でdoc生成直後、それ以外は直前の addPage 後の
        // doc.setFont で保証。スロット2つ目以降も同じ用紙内なので保証は続く）
        const { svg, svgHeight } = buildPageSvg(
          doc,
          pages[p],
          columns,
          palette,
          font.name,
          gridStyle,
          typography,
          layout,
          edgePadding,
          layerOptions,
        );
        holder.appendChild(svg);

        await doc.svg(svg, {
          x: origin.x + offsetX,
          y: origin.y + offsetY,
          width: svgWidth * scale,
          height: svgHeight * scale,
        });

        holder.removeChild(svg);

        // 本文の描画後に柱・フッター・ページ番号を描き、本文に隠れないようにする。
        drawRunningHeader(
          doc,
          palette,
          font.name,
          score,
          p,
          furniture,
          layout,
          firstPage.firstPageLayoutId,
          origin,
        );
        drawFooterCredit(
          doc,
          palette,
          font.name,
          score,
          furniture,
          p,
          slotIndex,
          slotsPerSheet,
          layout,
          origin,
        );
        drawPageNumber(
          doc,
          palette,
          font.name,
          p,
          pages.length,
          furniture,
          slotIndex,
          slotsPerSheet,
          layout,
          origin,
        );

        // svg2pdfの処理はページ数に比例してメインスレッドを占有する。論理ページ
        // ごとに明示的に譲ることで、進捗表示・ブラウザの応答確認を止めない。
        await yieldToBrowser();
      }

      if (physicalPage.kind === 'cover' && bodySlots.length === 0) {
        await yieldToBrowser();
      }
    }
  } finally {
    document.body.removeChild(holder);
  }

  const filename = `sky_score_${timestamp()}.pdf`;
  const blob = doc.output('blob');
  return { filename, opened: openOrDownloadPdfBlob(blob, filename) };
}
