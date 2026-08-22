const SCORE_EDITING_FLOATING_FOCUS_SELECTOR = [
  '.range-action-bar',
  '.range-action-bar__expand',
  '.history-fab',
].join(', ');

export function isScoreEditingFloatingFocus(element) {
  return Boolean(element?.closest?.(SCORE_EDITING_FLOATING_FOCUS_SELECTOR));
}

export function focusMountedCaret(
  insertIndex,
  placement,
  { defer = true, preventScroll = false } = {},
) {
  const focus = () => {
    const preferred = document.getElementById(`caret-${placement}-${insertIndex}`);
    const target = preferred?.classList.contains('has-handle')
      ? preferred
      : document.querySelector(
        `.caret-slot.has-handle[data-caret-index="${insertIndex}"]`,
      );
    if (!target) return false;
    if (preventScroll) target.focus({ preventScroll: true });
    else target.focus();
    return true;
  };

  if (defer) {
    requestAnimationFrame(focus);
    return true;
  }
  return focus();
}
