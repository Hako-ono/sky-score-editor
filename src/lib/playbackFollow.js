export const PLAYBACK_FOLLOW_ANCHOR_RATIO = 0.42;

export function classifyPlaybackFollowTransition(previousRowIndex, nextRowIndex) {
  if (!Number.isInteger(nextRowIndex) || nextRowIndex < 0) return null;
  if (previousRowIndex === nextRowIndex) return null;
  if (!Number.isInteger(previousRowIndex) || previousRowIndex < 0) return 'entry';
  return 'row-change';
}

export function computePlaybackFollowTarget({
  rowTop,
  rowPitch,
  scrollY,
  viewportHeight,
  currentHeaderBottom,
  stickyHeaderHeight,
  preserveIfFullyVisible,
} = {}) {
  if (
    !Number.isFinite(rowTop) ||
    !Number.isFinite(scrollY) ||
    !Number.isFinite(currentHeaderBottom) ||
    !Number.isFinite(stickyHeaderHeight) ||
    !Number.isFinite(rowPitch) ||
    rowPitch <= 0 ||
    !Number.isFinite(viewportHeight) ||
    viewportHeight <= 0
  ) {
    return null;
  }

  const clampedHeaderBottom = Math.min(
    viewportHeight,
    Math.max(0, currentHeaderBottom),
  );
  const rowViewportTop = rowTop - scrollY;
  const rowViewportBottom = rowViewportTop + rowPitch;
  if (
    preserveIfFullyVisible === true &&
    rowViewportTop >= clampedHeaderBottom &&
    rowViewportBottom <= viewportHeight
  ) {
    return null;
  }

  const clampedStickyHeaderHeight = Math.min(
    viewportHeight,
    Math.max(0, stickyHeaderHeight),
  );
  const usableHeight = viewportHeight - clampedStickyHeaderHeight;
  if (usableHeight <= 0) return null;

  const anchorViewportY =
    clampedStickyHeaderHeight + usableHeight * PLAYBACK_FOLLOW_ANCHOR_RATIO;
  const target = rowTop + rowPitch / 2 - anchorViewportY;
  return Number.isFinite(target) ? Math.max(0, target) : null;
}
