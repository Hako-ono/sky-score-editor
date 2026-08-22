export function findPhraseCaret(grids, caretIndex, direction) {
  if (!Array.isArray(grids) || grids.length === 0) return -1;
  if (!Number.isInteger(caretIndex) || (direction !== -1 && direction !== 1)) return -1;

  const current = Math.max(0, Math.min(caretIndex, grids.length));
  if (direction < 0) {
    let previous = 0;
    for (let index = 0; index < grids.length - 1; index += 1) {
      const phraseCaret = index + 1;
      if (phraseCaret >= current) break;
      if (grids[index]?.forceBreakAfter === true) previous = phraseCaret;
    }
    return previous === current ? -1 : previous;
  }

  for (let index = current; index < grids.length - 1; index += 1) {
    const phraseCaret = index + 1;
    if (phraseCaret > current && grids[index]?.forceBreakAfter === true) return phraseCaret;
  }
  return -1;
}
