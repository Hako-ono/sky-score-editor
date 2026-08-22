export const RANGE_SELECTED = 1;
export const RANGE_SELECTING = 8;
export const RANGE_SELECTION_START = 64;
export const RANGE_SELECTION_END = 128;

const INITIAL_STATE = Object.freeze({
  selectionAnchorCaretIndex: -1,
  caretIndex: 0,
  caretPlacement: 'before',
  transientSelectionIndex: -1,
  actionBarOpen: true,
  showExtendHint: false,
  extendHintLearned: false,
  clipboard: Object.freeze([]),
});

function isGridIndex(value) {
  return Number.isInteger(value) && value >= 0;
}

function isCaretPlacement(value) {
  return value === 'before' || value === 'after';
}

export function orderedRange(firstIndex, lastIndex) {
  if (!isGridIndex(firstIndex) || !isGridIndex(lastIndex)) return null;
  return {
    start: Math.min(firstIndex, lastIndex),
    end: Math.max(firstIndex, lastIndex),
  };
}

export function selectedRange(state) {
  const transientIndex = state?.transientSelectionIndex;
  if (isGridIndex(transientIndex)) {
    return { start: transientIndex, end: transientIndex };
  }
  const anchor = state?.selectionAnchorCaretIndex;
  const head = state?.caretIndex;
  if (!isGridIndex(anchor) || !isGridIndex(head) || anchor === head) return null;
  return {
    start: Math.min(anchor, head),
    end: Math.max(anchor, head) - 1,
  };
}

/**
 * 置換箇所より後ろのキャレット境界だけを件数差ぶん移す。
 * 境界が削除範囲の内側にある場合は、置換内容の直後へ畳む。
 */
export function adjustCaretBoundaryForReplacement(
  caretIndex,
  startIndex,
  removedCount,
  insertedCount,
) {
  if (
    !isGridIndex(caretIndex)
    || !isGridIndex(startIndex)
    || !Number.isInteger(removedCount)
    || removedCount < 0
    || !Number.isInteger(insertedCount)
    || insertedCount < 0
  ) return caretIndex;
  if (caretIndex <= startIndex) return caretIndex;
  const removedEnd = startIndex + removedCount;
  if (caretIndex >= removedEnd) return caretIndex + insertedCount - removedCount;
  return startIndex + insertedCount;
}

/**
 * 選択境界のドラッグ中だけ、可動側が固定側と同じ隙間へ重なって
 * 選択解除になるのを防ぐ。固定側を越えた後は反対側の1件選択へ
 * 切り替えられるよう、重なった瞬間だけ直前の側へ1境界ぶん戻す。
 */
export function keepDraggedCaretSeparated(
  fixedCaretIndex,
  targetCaretIndex,
  previousCaretIndex,
  gridCount,
) {
  if (
    !isGridIndex(fixedCaretIndex)
    || !isGridIndex(targetCaretIndex)
    || !isGridIndex(previousCaretIndex)
    || !Number.isInteger(gridCount)
    || gridCount <= 0
    || targetCaretIndex !== fixedCaretIndex
  ) return targetCaretIndex;

  const previousDirection = previousCaretIndex < fixedCaretIndex ? -1 : 1;
  const previousSide = fixedCaretIndex + previousDirection;
  if (previousSide >= 0 && previousSide <= gridCount) return previousSide;
  return fixedCaretIndex === 0 ? 1 : fixedCaretIndex - 1;
}

export function resolvePlaybackRange(state, gridCount) {
  if (!Number.isInteger(gridCount) || gridCount <= 0) return null;
  const selection = selectedRange(state);
  if (selection) {
    if (selection.start >= gridCount) return null;
    return {
      start: selection.start,
      end: Math.min(selection.end, gridCount - 1),
      tracksSelection: true,
    };
  }
  if (!isGridIndex(state?.caretIndex) || state.caretIndex >= gridCount) return null;
  return {
    start: state.caretIndex,
    end: gridCount - 1,
    tracksSelection: false,
  };
}

function contains(range, index) {
  return range !== null && index >= range.start && index <= range.end;
}

export function rangeGridFlags(state, index) {
  if (!isGridIndex(index)) return 0;
  const selection = selectedRange(state);
  let flags = selection ? RANGE_SELECTING : 0;
  if (contains(selection, index)) flags |= RANGE_SELECTED;
  if (selection?.start === index) flags |= RANGE_SELECTION_START;
  if (selection?.end === index) flags |= RANGE_SELECTION_END;
  return flags;
}

export function createRangeSelectionStore() {
  let state = INITIAL_STATE;
  const listeners = new Set();
  const indexListeners = new Map();

  function commit(nextState) {
    if (nextState === state) return;
    const previous = state;
    state = Object.freeze(nextState);
    indexListeners.forEach((callbacks, index) => {
      if (rangeGridFlags(previous, index) !== rangeGridFlags(state, index)) {
        callbacks.forEach((callback) => callback());
      }
    });
    listeners.forEach((callback) => callback());
  }

  function setSelectionFromCarets(
    anchorCaretIndex,
    headCaretIndex,
    placement = 'before',
    showExtendHint = false,
  ) {
    if (
      !isGridIndex(anchorCaretIndex)
      || !isGridIndex(headCaretIndex)
      || !isCaretPlacement(placement)
    ) return;
    if (anchorCaretIndex === headCaretIndex) {
      setCaret(headCaretIndex, placement);
      return;
    }
    const rangeCount = Math.abs(headCaretIndex - anchorCaretIndex);
    const learned = state.extendHintLearned || rangeCount > 1;
    commit({
      ...state,
      selectionAnchorCaretIndex: anchorCaretIndex,
      caretIndex: headCaretIndex,
      caretPlacement: placement,
      showExtendHint: showExtendHint && !learned && rangeCount === 1,
      extendHintLearned: learned,
    });
  }

  function startSelection(index, showExtendHint = false) {
    if (!isGridIndex(index)) return;
    setSelectionFromOriginGrid(index, index, showExtendHint);
  }

  function setSelectionFromOriginGrid(originIndex, targetIndex, showExtendHint = false) {
    if (!isGridIndex(originIndex) || !isGridIndex(targetIndex)) return;
    setSelectionFromCarets(
      targetIndex < originIndex ? originIndex + 1 : originIndex,
      targetIndex < originIndex ? targetIndex : targetIndex + 1,
      'before',
      showExtendHint,
    );
  }

  function setSelection(firstIndex, lastIndex) {
    if (!orderedRange(firstIndex, lastIndex)) return;
    setSelectionFromCarets(
      lastIndex < firstIndex ? firstIndex + 1 : firstIndex,
      lastIndex < firstIndex ? lastIndex : lastIndex + 1,
    );
  }

  function selectIndex(index) {
    if (!isGridIndex(index)) return;
    const range = selectedRange(state);
    if (!range) {
      startSelection(index);
      return;
    }
    if (index === range.start && range.start === range.end) {
      setCaret(range.start, 'before');
      return;
    }
    if (index === range.start) {
      setSelection(range.start, range.start);
      return;
    }
    if (index < range.start) {
      setSelection(index, range.end);
      return;
    }
    if (index > range.end) {
      setSelection(range.start, index);
      return;
    }
    setSelectionFromOriginGrid(range.start, index);
  }

  function setCaret(index, placement = 'before') {
    if (!isGridIndex(index) || !isCaretPlacement(placement)) return;
    if (
      state.selectionAnchorCaretIndex === -1
      && state.caretIndex === index
      && state.caretPlacement === placement
    ) return;
    commit({
      ...state,
      selectionAnchorCaretIndex: -1,
      caretIndex: index,
      caretPlacement: placement,
      showExtendHint: false,
    });
  }

  return {
    getState() {
      return state;
    },
    getClipboardCount() {
      return state.clipboard.length;
    },
    getGridFlags(index) {
      return rangeGridFlags(state, index);
    },
    startSelection,
    selectIndex,
    extendSelectionToGrid(index) {
      if (!isGridIndex(index)) return;
      if (selectedRange(state)) {
        selectIndex(index);
        return;
      }
      const anchor = state.caretIndex;
      const head = index < anchor ? index : index + 1;
      setSelectionFromCarets(anchor, head);
    },
    setSelectionFromCarets,
    setSelectionFromOriginGrid,
    activateSelectionBoundary(boundaryIndex) {
      const range = selectedRange(state);
      if (!range || !isGridIndex(boundaryIndex)) return;
      const startBoundary = range.start;
      const endBoundary = range.end + 1;
      if (boundaryIndex === startBoundary) {
        setSelectionFromCarets(endBoundary, startBoundary);
      } else if (boundaryIndex === endBoundary) {
        setSelectionFromCarets(startBoundary, endBoundary);
      }
    },
    setSelection,
    setCaret,
    setTransientSelection(index) {
      if (!isGridIndex(index) || state.transientSelectionIndex === index) return;
      commit({
        ...state,
        transientSelectionIndex: index,
        showExtendHint: false,
      });
    },
    clearTransientSelection() {
      if (state.transientSelectionIndex < 0) return;
      commit({ ...state, transientSelectionIndex: -1 });
    },
    adjustForReplacement(startIndex, removedCount, insertedCount, nextGridCount) {
      if (
        !isGridIndex(startIndex)
        || !Number.isInteger(removedCount)
        || removedCount < 0
        || !Number.isInteger(insertedCount)
        || insertedCount < 0
        || !Number.isInteger(nextGridCount)
        || nextGridCount < 0
      ) return;
      let nextAnchor = state.selectionAnchorCaretIndex;
      if (nextAnchor >= 0) {
        nextAnchor = adjustCaretBoundaryForReplacement(
          nextAnchor,
          startIndex,
          removedCount,
          insertedCount,
        );
      }
      const nextCaret = adjustCaretBoundaryForReplacement(
        state.caretIndex,
        startIndex,
        removedCount,
        insertedCount,
      );
      if (nextAnchor === nextCaret) nextAnchor = -1;
      commit({
        ...state,
        selectionAnchorCaretIndex: nextAnchor,
        caretIndex: nextCaret,
        caretPlacement: nextCaret === nextGridCount ? 'after' : state.caretPlacement,
        showExtendHint: nextAnchor < 0 ? false : state.showExtendHint,
      });
    },
    moveCaretBy(direction, gridCount) {
      if (
        (direction !== -1 && direction !== 1)
        || !Number.isInteger(gridCount)
        || gridCount < 0
      ) return -1;

      const selection = selectedRange(state);
      const nextIndex = selection
        ? (direction < 0 ? selection.start : selection.end + 1)
        : Math.max(0, Math.min(gridCount, state.caretIndex + direction));
      setCaret(nextIndex, nextIndex === gridCount ? 'after' : 'before');
      return nextIndex;
    },
    extendCaretSelectionBy(direction, gridCount) {
      if (
        (direction !== -1 && direction !== 1)
        || !Number.isInteger(gridCount)
        || gridCount <= 0
      ) return -1;

      const selection = selectedRange(state);
      const anchorCaretIndex = selection ? state.selectionAnchorCaretIndex : state.caretIndex;
      let nextCaretIndex = Math.max(0, Math.min(gridCount, state.caretIndex + direction));
      if (!selection && nextCaretIndex === anchorCaretIndex) return -1;
      setSelectionFromCarets(
        anchorCaretIndex,
        nextCaretIndex,
        nextCaretIndex === gridCount ? 'after' : 'before',
      );
      return nextCaretIndex;
    },
    openActionBar() {
      if (state.actionBarOpen) return;
      commit({ ...state, actionBarOpen: true });
    },
    closeActionBar() {
      if (!state.actionBarOpen) return;
      commit({ ...state, actionBarOpen: false });
    },
    setClipboard(clipboard) {
      if (!Array.isArray(clipboard) || clipboard.length === 0) return;
      commit({
        ...state,
        clipboard: Object.freeze([...clipboard]),
      });
    },
    clearSelection() {
      if (!selectedRange(state)) return;
      commit({
        ...state,
        selectionAnchorCaretIndex: -1,
        caretPlacement: 'before',
        showExtendHint: false,
      });
    },
    reconcileGridCount(gridCount) {
      if (!Number.isInteger(gridCount) || gridCount <= 0) {
        commit({
          ...INITIAL_STATE,
          clipboard: state.clipboard,
          extendHintLearned: state.extendHintLearned,
        });
        return;
      }
      let nextSelectionAnchorCaret = state.selectionAnchorCaretIndex > gridCount
        ? gridCount
        : state.selectionAnchorCaretIndex;
      const nextCaret = Math.min(state.caretIndex, gridCount);
      const nextTransientSelection = state.transientSelectionIndex >= gridCount
        ? -1
        : state.transientSelectionIndex;
      if (nextSelectionAnchorCaret === nextCaret) nextSelectionAnchorCaret = -1;
      const nextCaretPlacement = nextCaret === gridCount ? 'after' : state.caretPlacement;
      if (
        nextSelectionAnchorCaret === state.selectionAnchorCaretIndex
        && nextCaret === state.caretIndex
        && nextTransientSelection === state.transientSelectionIndex
        && nextCaretPlacement === state.caretPlacement
      ) return;
      commit({
        ...state,
        selectionAnchorCaretIndex: nextSelectionAnchorCaret,
        caretIndex: nextCaret,
        transientSelectionIndex: nextTransientSelection,
        caretPlacement: nextCaretPlacement,
        showExtendHint: nextSelectionAnchorCaret < 0 ? false : state.showExtendHint,
      });
    },
    reset() {
      commit({ ...INITIAL_STATE, extendHintLearned: state.extendHintLearned });
    },
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    subscribeIndex(index, callback) {
      let callbacks = indexListeners.get(index);
      if (!callbacks) {
        callbacks = new Set();
        indexListeners.set(index, callbacks);
      }
      callbacks.add(callback);
      let unsubscribed = false;
      return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        callbacks.delete(callback);
        if (callbacks.size === 0) indexListeners.delete(index);
      };
    },
  };
}
