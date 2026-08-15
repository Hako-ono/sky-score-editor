/**
 * グリッド配列を「行」に分割する。1 行あたり columns 個まで並べ、
 * forceBreakAfter が true のグリッドの後は必ず改行する。
 * 画面表示・PDF ページ割りの両方で使う純粋関数。
 */

import {
  PDF_COLUMNS_PER_PAGE,
  normalizeColumnsPerPageId,
} from '../constants/config.js';

/**
 * 列数・行数の指定値を正の整数へ正規化する。
 * columns / maxRows は外部 JSON に由来する値が渡ってくることがあり得るため、
 * 0以下・非有限・数値変換不能な値がそのままループの増分として使われると
 * ループが停止しない、または毎周ゼロ幅の範囲を積み続けて空要素が
 * 混入するおそれがある。そのためループに使う前に必ず正の整数へ倒す。
 */
function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return fallback > 0 ? fallback : 1;
}

/**
 * bitsPerPage から1行あたりの列数を決める。画面（ScoreCanvas.jsx）と
 * PDF（pdfExport.js）の両方が同じ式を独立に持っていたのをここへ一本化した。
 * 3拍子（12）だけ3列にするのは、1行3グリッドが3拍子の区切りとして自然なため。
 * それ以外（4拍子の16、拍子なしの4を含む）は4列にする。
 *
 * bitsPerPage は parseScore.js で [4, 12, 16] に丸められるが、この関数は
 * 外部 JSON 由来の値がそのまま渡ってくる前提（信頼境界）で単独でも
 * 正しく振る舞う必要があるため、12 以外はすべて4列にフォールバックする。
 */
export function columnsForBits(bitsPerPage) {
  return bitsPerPage === 12 ? 3 : 4;
}

/**
 * PDFの「1ページの列数」設定を実際の列数へ解決する。設定UIの表示（Toolbar.jsx）と
 * 出力（pdfExport.js）が同じ値を使えるよう、この唯一の導出元とし、呼び出し側ごとに
 * 「auto なら拍子から」の分岐を書き直さない。
 *
 * 画面のグリッド一覧はこの設定を参照しない（PDF専用の紙面設定であり、
 * 編集中の見え方は拍子のままにしたいため）。
 */
export function resolveColumnsPerPage(columnsPerPageId, bitsPerPage) {
  const { columns } = PDF_COLUMNS_PER_PAGE[normalizeColumnsPerPageId(columnsPerPageId)];
  return columns ?? columnsForBits(bitsPerPage);
}

/**
 * @param {Array} grids
 * @param {number} columns
 * @returns {Array<Array<{ grid: object, index: number }>>} 行の配列
 */
export function splitIntoRows(grids, columns) {
  const rows = [];
  let current = [];
  const cols = normalizePositiveInt(columns, grids.length);

  grids.forEach((grid, index) => {
    current.push({ grid, index });
    const isRowFull = current.length >= cols;
    // forceBreakAfter は外部 JSON 由来の値であり得るため、truthy ではなく
    // 厳密に true の場合のみ改行として扱う。
    if (grid.forceBreakAfter === true || isRowFull) {
      rows.push(current);
      current = [];
    }
  });
  if (current.length > 0) rows.push(current);
  return rows;
}

/**
 * PDF 用: 行の配列を、1 ページ maxRows 行までのページ群へ分割する。
 * @returns {Array<Array<row>>} ページごとの行配列
 */
export function paginateRows(rows, maxRows) {
  const pages = [];
  const step = normalizePositiveInt(maxRows, rows.length);
  for (let i = 0; i < rows.length; i += step) {
    pages.push(rows.slice(i, i + step));
  }
  return pages;
}
