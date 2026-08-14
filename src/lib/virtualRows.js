// グリッド一覧の仮想化：可視行範囲を求める純関数群。
//
// rowCount は攻撃者が自由に作れる楽譜JSON由来の値であり得るため、
// layout.js の
// paginateRows と同じ流儀（無限ループを起こさず、算術だけで求める）で
// 防御的に正規化する。DOM・window は一切参照しない。

// 型判定は厳密に行う（Number() による強制変換をしない）。
// Number(true) === 1 のように、強制変換すると真偽値や数値文字列が
// 正当な値として通ってしまうため。
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// rowCount：0以下・非整数・非有限・数値でない → 0
function normalizeRowCount(value) {
  if (!isFiniteNumber(value) || !Number.isInteger(value) || value <= 0) return 0;
  return value;
}

// scrollY / canvasTop：非有限・数値でない → 0
function normalizeFiniteOrZero(value) {
  return isFiniteNumber(value) ? value : 0;
}

// overscanPx：負・非有限・数値でない → 0
function normalizeOverscan(value) {
  const n = normalizeFiniteOrZero(value);
  return n < 0 ? 0 : n;
}

// rowIndex：負・非有限・数値でない → 0、小数は切り捨て
function normalizeRowIndex(value) {
  const n = normalizeFiniteOrZero(value);
  return n < 0 ? 0 : Math.floor(n);
}

// rowPitch：有効（数値・有限・正）なら1pxへ下限クランプして返す。
// 無効なら null（呼び出し側が用途に応じて扱う：全域フォールバック／0扱い）。
// クランプが無いと極端に小さい値のとき返る行数がrowCountまで伸びてしまう
// （「入力が巨大でも出力が巨大にならない」という防御が破れる）。
// 実際の行ピッチが1pxを下回ることはあり得ないため実用上の副作用はない。
function normalizeRowPitch(value) {
  if (!isFiniteNumber(value) || value <= 0) return null;
  return Math.max(1, value);
}

// lo・hi は常に有限の整数（呼び出し側で保証済み）。value が非有限
// （±Infinity）でも Math.max/Math.min がそのまま範囲内へ収める。
// NaN だけは Math.max/Math.min を素通りしてしまうため個別に弾く。
function clampInt(value, lo, hi) {
  if (Number.isNaN(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}

/**
 * 可視行範囲（行の通し番号の半開区間 [startRow, endRow)）を返す。
 * 副作用を持たない・引数を書き換えない・while ループを書かない。
 */
export function computeVisibleRowRange(input) {
  const {
    scrollY: rawScrollY,
    viewportHeight: rawViewportHeight,
    canvasTop: rawCanvasTop,
    rowPitch: rawRowPitch,
    rowCount: rawRowCount,
    overscanPx: rawOverscanPx,
  } = input ?? {};

  // rowCount を最初に確定させる。異常ならその場で空の範囲を返す。
  // これにより「rowPitch異常なら全域」と「rowCount異常なら空」が
  // 衝突しない（全域 = 0〜0 = 空に収束する）。
  const rowCount = normalizeRowCount(rawRowCount);
  if (rowCount === 0) return { startRow: 0, endRow: 0 };

  const rowPitch = normalizeRowPitch(rawRowPitch);
  const viewportHeight = isFiniteNumber(rawViewportHeight) && rawViewportHeight > 0
    ? rawViewportHeight
    : null;

  // rowPitch / viewportHeight はブラウザ由来・自前計測由来であり、
  // 楽譜JSON由来ではない。異常時は空ではなく全域を返す
  // （空にすると画面が永久に空白になり、大量マウントより悪い）。
  if (rowPitch === null || viewportHeight === null) {
    return { startRow: 0, endRow: rowCount };
  }

  const scrollY = Math.max(0, normalizeFiniteOrZero(rawScrollY));
  const canvasTop = normalizeFiniteOrZero(rawCanvasTop);
  const overscanPx = normalizeOverscan(rawOverscanPx);

  const bandTop = scrollY - overscanPx;
  const bandBottom = scrollY + viewportHeight + overscanPx;

  const startRow = clampInt(Math.floor((bandTop - canvasTop) / rowPitch), 0, rowCount);
  const endRow = clampInt(Math.ceil((bandBottom - canvasTop) / rowPitch), startRow, rowCount);

  return { startRow, endRow };
}

/**
 * 行 rowIndex の文書内Y座標（上端）を返す。正常時は
 * canvasTop + rowIndex * rowPitch。戻り値は必ず有限の数。
 */
export function computeRowOffsetY(input) {
  const {
    rowIndex: rawRowIndex,
    canvasTop: rawCanvasTop,
    rowPitch: rawRowPitch,
  } = input ?? {};

  const rowIndex = normalizeRowIndex(rawRowIndex);
  const canvasTop = normalizeFiniteOrZero(rawCanvasTop);
  const rowPitch = normalizeRowPitch(rawRowPitch) ?? 0;

  const y = canvasTop + rowIndex * rowPitch;
  if (Number.isFinite(y)) return y;
  // 巨大な rowIndex・rowPitch の積で Infinity になりうる。符号を保ったまま
  // 有限の範囲へクランプする（呼び出し側が Infinity を書き戻すのを防ぐ）。
  return y > 0 ? Number.MAX_VALUE : -Number.MAX_VALUE;
}
