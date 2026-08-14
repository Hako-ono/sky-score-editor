/* ============================================================
 * この関数が満たすべき契約
 * ------------------------------------------------------------
 * clampExpandedIndex(index, gridCount) -> number
 *   - index が 0 以上 gridCount 未満の整数ならそのまま返す。
 *   - index が整数でない（NaN・小数・文字列・undefined 等）、
 *     または範囲外（負数・gridCount 以上）なら -1 を返す。
 *   - gridCount が正の整数でない（0・負数・非有限・NaN 等）場合、
 *     グリッドが存在しないとみなし常に -1 を返す。
 *   - -1 は「拡大表示しない」を意味する。
 *
 * stepExpandedIndex(index, gridCount, delta) -> number | null
 *   - delta は 1 か -1 のみ受け付ける。それ以外は null。
 *   - index が clampExpandedIndex で -1 になる値（範囲外・非整数）なら null。
 *   - 移動先が範囲外（先頭で -1 側 / 末尾で +1 側）なら null。
 *   - それ以外は移動後のインデックスを返す。
 *
 * resolveSwipe(dx, dy) -> -1 | 0 | 1
 *   - dx・dy は「終了座標 - 開始座標」。
 *   - dx・dy のどちらかが有限数でなければ 0。
 *   - 横方向の移動量が SWIPE_THRESHOLD_PX 未満なら 0（スワイプとみなさない）。
 *   - 縦方向の移動量が横方向の移動量の 1.2 倍を超えていれば 0
 *     （スクロール操作とみなし、移動とみなさない）。
 *   - 左へ払う（dx が負）なら 1（次へ）、右へ払う（dx が正）なら -1（前へ）。
 *
 * shouldStartDrag(dx, dy) -> boolean
 *   - dx・dy のどちらかが有限数でなければ false。
 *   - 横方向の移動量が SWIPE_DRAG_ACTIVATE_PX 未満なら false
 *     （タップや入力欄へのフォーカスを妨げないよう、動き出しの小さな
 *     ぶれは無視する）。
 *   - 横方向の移動量が縦方向の移動量以下なら false（縦スクロールとみなす）。
 *
 * dampDragOffset(dx, canMove) -> number
 *   - dx が有限数でなければ 0。
 *   - canMove が true ならそのまま dx を返す。
 *   - canMove が false なら dx を 0.3 倍にして返す（移動先が無い方向へ
 *     引っ張られたとき、指に「端である」ことを伝えるための減衰）。
 * ============================================================ */

export const SWIPE_THRESHOLD_PX = 40;
/** iOS の画面端スワイプ（戻る）と競合するため、端から始まった操作は拾わない */
export const SWIPE_EDGE_GUARD_PX = 24;
/** ドラッグ追従を開始する最小移動量。これ未満はタップとして扱う */
export const SWIPE_DRAG_ACTIVATE_PX = 8;

export function clampExpandedIndex(index, gridCount) {
  if (!Number.isInteger(gridCount) || gridCount <= 0) return -1;
  if (!Number.isInteger(index)) return -1;
  if (index < 0 || index >= gridCount) return -1;
  return index;
}

export function stepExpandedIndex(index, gridCount, delta) {
  if (delta !== 1 && delta !== -1) return null;
  const current = clampExpandedIndex(index, gridCount);
  if (current < 0) return null;

  const next = current + delta;
  const clampedNext = clampExpandedIndex(next, gridCount);
  if (clampedNext < 0) return null;
  return clampedNext;
}

export function resolveSwipe(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < SWIPE_THRESHOLD_PX) return 0;
  if (absDx <= absDy * 1.2) return 0;

  return dx < 0 ? 1 : -1;
}

export function shouldStartDrag(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < SWIPE_DRAG_ACTIVATE_PX) return false;
  if (absDx <= absDy) return false;

  return true;
}

export function dampDragOffset(dx, canMove) {
  if (!Number.isFinite(dx)) return 0;
  return canMove ? dx : dx * 0.3;
}
