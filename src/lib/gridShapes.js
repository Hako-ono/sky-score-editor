/**
 * 15鍵グリッドの描画記述。画面（NoteGridSvg.jsx）と PDF（pdfExport.js）が
 * それぞれ別々に組み立てていた「セル枠の矩形」「記号（円/ひし形）」の形状定義を
 * ここへ一本化する。色の解決はこのファイルの責務にしない
 * （画面はCSS変数、PDFはpaletteから引く。テーマ切替のたびに画面側が
 * インライン属性を書き換えて3000枚再レンダーする事態を避けるため）。
 */

import {
  BUTTON_POSITIONS,
  CIRCLE_RADIUS,
  COMBINED_SYMBOL_PATH,
  DIAMOND_HALF_SIZE,
  DIAMOND_POINTS,
} from '../constants/config.js';

export const CELL_CORNER_RADIUS = 5;
export const GRID_STROKE_WIDTH = { cell: 1, symbol: 2.5 };

const MAX_DIAMOND_CORNER_RADIUS = DIAMOND_HALF_SIZE / Math.SQRT2;

function formatPathNumber(value) {
  return String(Number(value.toFixed(3)));
}

/**
 * ひし形の4頂点を二次ベジェ曲線で丸めた閉じたパスを返す。
 * cornerRadius は斜辺に沿った接点までの距離として扱う。
 */
export function createRoundedDiamondPath(cornerRadius = 0) {
  const radius = typeof cornerRadius === 'number' && Number.isFinite(cornerRadius)
    ? Math.min(Math.max(cornerRadius, 0), MAX_DIAMOND_CORNER_RADIUS)
    : 0;
  if (radius === 0) return 'M 0 -25 L 25 0 L 0 25 L -25 0 Z';

  const offset = radius / Math.SQRT2;
  const near = DIAMOND_HALF_SIZE - offset;
  const o = formatPathNumber(offset);
  const n = formatPathNumber(near);
  const negativeOffset = formatPathNumber(-offset);
  const negativeNear = formatPathNumber(-near);
  return [
    `M ${negativeOffset} ${negativeNear}`,
    `Q 0 -${DIAMOND_HALF_SIZE} ${o} ${negativeNear}`,
    `L ${n} ${negativeOffset}`,
    `Q ${DIAMOND_HALF_SIZE} 0 ${n} ${o}`,
    `L ${o} ${n}`,
    `Q 0 ${DIAMOND_HALF_SIZE} ${negativeOffset} ${n}`,
    `L ${negativeNear} ${o}`,
    `Q -${DIAMOND_HALF_SIZE} 0 ${negativeNear} ${negativeOffset}`,
    'Z',
  ].join(' ');
}

/** 円と角丸ひし形を1回のstrokeで描ける複合パスとして返す。 */
export function createCombinedSymbolPath(cornerRadius = 0) {
  if (cornerRadius === 0) return COMBINED_SYMBOL_PATH;
  return `${createRoundedDiamondPath(cornerRadius)} M ${CIRCLE_RADIUS} 0 A ${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 1 0 -${CIRCLE_RADIUS} 0 A ${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 1 0 ${CIRCLE_RADIUS} 0`;
}

// NoteGridSvg は最大3000×15回描画されるため、レンダーごとに配列やオブジェクトを
// 作らないようモジュールスコープで1回だけ組み立てる。frame / symbols の座標は
// セル中心 (cx, cy) からの相対値（config.js の座標定義は動かさない）。
export const GRID_CELL_SHAPES = BUTTON_POSITIONS.map((b) => {
  const symbols = [];
  if (b.type === 'cd') {
    symbols.push({ kind: 'path', d: COMBINED_SYMBOL_PATH });
  } else if (b.type === 'd') {
    symbols.push({ kind: 'polygon', points: DIAMOND_POINTS });
  } else if (b.type === 'c') {
    symbols.push({ kind: 'circle', cx: 0, cy: 0, r: CIRCLE_RADIUS });
  }
  return {
    index: b.index,
    cx: b.cx,
    cy: b.cy,
    frame: {
      x: -b.cellSize / 2,
      y: -b.cellSize / 2,
      width: b.cellSize,
      height: b.cellSize,
    },
    symbols,
  };
});

/** 無音かつ無歌詞のグリッドかどうか（PDF側専用。画面側はCSSの祖先セレクタで解決する）。 */
export function gridColorState(keys, text = '') {
  return (keys && keys.length > 0) || text ? 'filled' : 'empty';
}

/** 割り当てを作らない軽量な押鍵判定。3000×15回呼ばれるため includes だけを返す。 */
export function cellColorState(keys, index) {
  return keys.includes(index) ? 'highlight' : 'plain';
}
