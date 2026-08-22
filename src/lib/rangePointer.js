const EDGE_SCROLL_ZONE_PX = 72;
const MAX_EDGE_SCROLL_PX = 8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function elementsAtPoint(clientX, clientY) {
  if (typeof document.elementsFromPoint !== 'function') return [];
  return document.elementsFromPoint(clientX, clientY);
}

function directGridElement(clientX, clientY) {
  return elementsAtPoint(clientX, clientY)
    .map((candidate) => candidate.closest?.('[data-grid-index]'))
    .find(Boolean);
}

function directGridIndex(clientX, clientY, gridCount) {
  const element = directGridElement(clientX, clientY);
  const index = Number(element?.dataset.gridIndex);
  return Number.isInteger(index) && index >= 0 && index < gridCount ? index : -1;
}

export function resolveNearestCaretAtPoint(clientX, clientY, gridStore) {
  const gridCount = gridStore.getGridCount();
  if (gridCount <= 0) return null;
  const slot = elementsAtPoint(clientX, clientY)
    .map((candidate) => candidate.closest?.('[data-caret-slot]'))
    .find(Boolean);
  const slotIndex = Number(slot?.dataset.caretIndex);
  if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex <= gridCount) {
    return {
      index: slotIndex,
      placement: slot?.dataset.caretPlacement === 'after' ? 'after' : 'before',
    };
  }

  const gridIndex = resolveGridIndexAtPoint(clientX, clientY, gridStore);
  if (gridIndex < 0) return null;
  const directGrid = directGridElement(clientX, clientY);
  let midpointX;
  if (directGrid) {
    const rect = directGrid.getBoundingClientRect();
    midpointX = rect.left + rect.width / 2;
  } else {
    const canvas = document.querySelector('.score-canvas');
    const row = gridStore.getRows().find((candidate) => candidate.includes(gridIndex));
    const columnIndex = row?.indexOf(gridIndex) ?? 0;
    const columns = Math.max(1, gridStore.getColumns());
    const rect = canvas?.getBoundingClientRect();
    midpointX = rect
      ? rect.left + ((columnIndex + 0.5) / columns) * rect.width
      : clientX;
  }
  const index = clientX < midpointX ? gridIndex : gridIndex + 1;
  return {
    index,
    placement: index === gridCount ? 'after' : 'before',
  };
}

/**
 * 指が仮想化領域の外へ出ても、実測済みの行ピッチと行構造から対象indexを求める。
 * 横位置だけはマウント中の行のセル中心を基準にし、強制改行で短い行では末尾へ丸める。
 */
export function resolveGridIndexAtPoint(clientX, clientY, gridStore) {
  const gridCount = gridStore.getGridCount();
  if (gridCount <= 0) return -1;
  const direct = directGridIndex(clientX, clientY, gridCount);
  if (direct >= 0) return direct;

  const canvas = document.querySelector('.score-canvas');
  const rows = gridStore.getRows();
  const rowPitch = gridStore.getRowPitch();
  if (!canvas || rows.length === 0 || !(rowPitch > 0)) return -1;

  const canvasRect = canvas.getBoundingClientRect();
  const canvasTop = canvasRect.top + window.scrollY;
  const documentY = clientY + window.scrollY;
  const rowIndex = clamp(Math.floor((documentY - canvasTop) / rowPitch), 0, rows.length - 1);
  const row = rows[rowIndex];
  if (!row || row.length === 0) return -1;

  const mountedRows = [...canvas.querySelectorAll(':scope > .score-row')];
  const referenceRow = mountedRows.reduce((best, candidate) => (
    candidate.children.length > (best?.children.length ?? 0) ? candidate : best
  ), null);
  const centers = referenceRow
    ? [...referenceRow.querySelectorAll(':scope > .score-cell')]
      .map((cell) => {
        const rect = cell.getBoundingClientRect();
        return rect.left + rect.width / 2;
      })
    : [];

  let columnIndex;
  if (centers.length > 0) {
    columnIndex = centers.reduce((nearest, center, index) => (
      Math.abs(center - clientX) < Math.abs(centers[nearest] - clientX) ? index : nearest
    ), 0);
  } else {
    const columns = Math.max(1, gridStore.getColumns());
    const fraction = canvasRect.width > 0 ? (clientX - canvasRect.left) / canvasRect.width : 0;
    columnIndex = Math.floor(clamp(fraction, 0, 0.999999) * columns);
  }

  return row[Math.min(columnIndex, row.length - 1)];
}

export function resolveCaretTargetAtPoint(clientX, clientY, gridStore, fixedCaretIndex) {
  const slot = elementsAtPoint(clientX, clientY)
    .map((candidate) => candidate.closest?.('[data-caret-slot]'))
    .find(Boolean);
  const directCaretIndex = Number(slot?.dataset.caretIndex);
  if (Number.isInteger(directCaretIndex)) {
    return {
      index: directCaretIndex,
      placement: slot.dataset.caretPlacement === 'after' ? 'after' : 'before',
    };
  }

  const gridIndex = resolveGridIndexAtPoint(clientX, clientY, gridStore);
  if (gridIndex < 0) return null;
  const index = gridIndex < fixedCaretIndex ? gridIndex : gridIndex + 1;
  return {
    index,
    placement: index === gridStore.getGridCount() ? 'after' : 'before',
  };
}

export function edgeScrollDelta(clientY, viewportHeight) {
  if (!(viewportHeight > 0)) return 0;
  if (clientY < EDGE_SCROLL_ZONE_PX) {
    return -MAX_EDGE_SCROLL_PX * clamp(
      (EDGE_SCROLL_ZONE_PX - clientY) / EDGE_SCROLL_ZONE_PX,
      0,
      1,
    );
  }
  const lowerEdge = viewportHeight - EDGE_SCROLL_ZONE_PX;
  if (clientY > lowerEdge) {
    return MAX_EDGE_SCROLL_PX * clamp(
      (clientY - lowerEdge) / EDGE_SCROLL_ZONE_PX,
      0,
      1,
    );
  }
  return 0;
}
