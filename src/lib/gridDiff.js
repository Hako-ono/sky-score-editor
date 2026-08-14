/* ============================================================
 * この関数が満たすべき契約
 * ------------------------------------------------------------
 * diffGrids(prevGrids, nextGrids) -> { changedIndices: number[], structureChanged: boolean }
 *   - prevGrids が null / undefined なら、nextGrids の全 index を changed とし、
 *     structureChanged: true を返す（初回供給）。
 *   - prevGrids === nextGrids（同一参照）なら changedIndices: []、
 *     structureChanged: false を返す。
 *   - 長さが違えば structureChanged: true。changedIndices は
 *     新旧の長い方の長さまでを対象にする（縮んだときに消えた index の
 *     購読者へも通知するため）。
 *   - 各 i について prevGrids[i] !== nextGrids[i] なら changed。
 *   - changed の中で forceBreakAfter が変わっていれば structureChanged: true。
 *   - 1回のループで判定する（3000件を何度も舐めない）。
 * ============================================================ */

export function diffGrids(prevGrids, nextGrids) {
  const nextLength = nextGrids ? nextGrids.length : 0;

  if (!prevGrids) {
    const changedIndices = new Array(nextLength);
    for (let i = 0; i < nextLength; i += 1) changedIndices[i] = i;
    return { changedIndices, structureChanged: true };
  }

  if (prevGrids === nextGrids) {
    return { changedIndices: [], structureChanged: false };
  }

  const prevLength = prevGrids.length;
  let structureChanged = prevLength !== nextLength;
  const length = Math.max(prevLength, nextLength);
  const changedIndices = [];

  for (let i = 0; i < length; i += 1) {
    const prevGrid = prevGrids[i];
    const nextGrid = nextGrids[i];
    if (prevGrid !== nextGrid) {
      changedIndices.push(i);
      if (prevGrid?.forceBreakAfter !== nextGrid?.forceBreakAfter) {
        structureChanged = true;
      }
    }
  }

  return { changedIndices, structureChanged };
}
