import { MAX_GRIDS, MAX_TEXT_LENGTH } from '../constants/config.js';

function cloneKeys(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const keys = [];
  for (const key of value) {
    if (!Number.isInteger(key) || key < 0 || key > 14 || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
    if (keys.length === 15) break;
  }
  return keys.sort((a, b) => a - b);
}

/** 内部クリップボードへ置くグリッドを、外部入力と同じ上限内へ複製する。 */
export function cloneGridForClipboard(value) {
  const grid = value && typeof value === 'object' ? value : {};
  const keys = cloneKeys(grid.keys);
  const layer2Keys = cloneKeys(grid.layer2Keys);
  return {
    type: keys.length > 0 || layer2Keys.length > 0 ? 'note' : 'empty',
    keys,
    layer2Keys,
    text: String(grid.text ?? '').slice(0, MAX_TEXT_LENGTH),
    forceBreakAfter: grid.forceBreakAfter === true,
  };
}

/** 両端を含む連続範囲を最大グリッド数の内側で複製する。 */
export function copyGridRange(grids, firstIndex, lastIndex) {
  if (!Array.isArray(grids) || grids.length === 0) return [];
  if (!Number.isInteger(firstIndex) || !Number.isInteger(lastIndex)) return [];
  const start = Math.max(0, Math.min(firstIndex, lastIndex));
  const end = Math.min(grids.length - 1, Math.max(firstIndex, lastIndex));
  if (start > end) return [];

  const copied = [];
  for (let index = start; index <= end && copied.length < MAX_GRIDS; index += 1) {
    copied.push(cloneGridForClipboard(grids[index]));
  }
  return copied;
}

