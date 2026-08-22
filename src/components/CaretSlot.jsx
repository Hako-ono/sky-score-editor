import { memo, useCallback, useRef } from 'react';
import { useT } from '../i18n/LanguageContext.jsx';
import {
  useRangeSelectionState,
  useRangeSelectionStore,
} from '../contexts/RangeSelectionContext.jsx';
import { useScoreGridsStore } from '../contexts/ScoreGridsContext.jsx';
import { selectedRange } from '../lib/rangeSelectionStore.js';
import { resolveCaretTargetAtPoint } from '../lib/rangePointer.js';
import { focusMountedCaret } from '../lib/rangeFocus.js';
import { usePointerAutoScroll } from '../hooks/usePointerAutoScroll.js';

export function shouldPlaceCaretFromClick() {
  return true;
}

export function shouldDeferCaretDragToCanvas(hasHandle, pointerType) {
  return pointerType === 'touch' && !hasHandle;
}

/**
 * 可視行の隙間だけに置くキャレットの受け口。
 * 折り返し位置は同じinsertIndexを行末(after)と次行頭(before)の2か所で持つため、
 * placementも状態へ残して紫線が両方へ出ないようにする。
 */
function CaretSlot({ insertIndex, placement, gridCount, isRowStart = false }) {
  const t = useT();
  const state = useRangeSelectionState();
  const rangeStore = useRangeSelectionStore();
  const gridStore = useScoreGridsStore();
  const dragRef = useRef({
    pointerId: null,
    pointerType: '',
    moved: false,
    startX: 0,
    startY: 0,
    fixedCaretIndex: -1,
  });
  const range = selectedRange(state);

  const isSelectionStart = range !== null
    && placement === 'before'
    && insertIndex === range.start;
  const isSelectionEnd = range !== null
    && insertIndex === range.end + 1
    && (placement === 'after' || !isRowStart);
  const isSelectionBoundary = isSelectionStart || isSelectionEnd;

  const edgePlacementMatches = insertIndex === 0
    ? placement === 'before'
    : insertIndex === gridCount
      ? placement === 'after'
      : state.caretPlacement === placement;
  const isCaret = range === null
    && state.caretIndex === insertIndex
    && edgePlacementMatches;
  const isVisible = isCaret || isSelectionStart || isSelectionEnd;
  const hasHandle = isCaret || isSelectionBoundary;
  const labelKey = isSelectionStart
    ? 'ui.range.caretStart'
    : isSelectionEnd
      ? 'ui.range.caretEnd'
      : 'ui.range.caretLabel';
  const label = t(labelKey);

  const moveFromPoint = useCallback((clientX, clientY) => {
    const fixedCaretIndex = dragRef.current.fixedCaretIndex;
    const target = resolveCaretTargetAtPoint(clientX, clientY, gridStore, fixedCaretIndex);
    if (!target) return;
    const nextCaretIndex = target.index;
    dragRef.current.moved = true;
    rangeStore.setSelectionFromCarets(
      fixedCaretIndex,
      nextCaretIndex,
      nextCaretIndex === gridCount ? 'after' : target.placement,
    );
  }, [gridCount, gridStore, rangeStore]);
  const { update: updateDrag, stop: stopDrag } = usePointerAutoScroll(moveFromPoint);

  return (
    <button
      id={`caret-${placement}-${insertIndex}`}
      type="button"
      className={`caret-slot caret-slot--${placement}${
        isRowStart ? ' caret-slot--row-start' : ''
      }${isVisible ? ' is-visible' : ''}${hasHandle ? ' has-handle' : ''}${
        isSelectionStart ? ' is-selection-start' : ''
      }${isSelectionEnd ? ' is-selection-end' : ''}`}
      data-caret-slot=""
      data-caret-index={insertIndex}
      data-caret-placement={placement}
      tabIndex={hasHandle ? 0 : -1}
      aria-hidden={isVisible ? undefined : true}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        if (dragRef.current.moved) {
          dragRef.current.moved = false;
          return;
        }
        if (!shouldPlaceCaretFromClick(
          hasHandle,
          dragRef.current.pointerType,
          event.detail,
        )) return;
        rangeStore.setCaret(insertIndex, placement);
        event.currentTarget.focus();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const nextIndex = event.shiftKey
          ? rangeStore.extendCaretSelectionBy(direction, gridCount)
          : rangeStore.moveCaretBy(direction, gridCount);
        if (nextIndex >= 0) {
          focusMountedCaret(nextIndex, nextIndex === gridCount ? 'after' : 'before');
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // 空の隙間からのタッチはScoreCanvasの単一リスナーで方向を決める。
        // 表示中のハンドルとマウスは、ここで従来どおり即座に掴む。
        if (shouldDeferCaretDragToCanvas(hasHandle, event.pointerType)) {
          dragRef.current.moved = false;
          dragRef.current.pointerType = 'touch';
          return;
        }
        event.preventDefault();
        const currentRange = selectedRange(rangeStore.getState());
        const fixedCaretIndex = currentRange && isSelectionBoundary
          ? (insertIndex === currentRange.start ? currentRange.end + 1 : currentRange.start)
          : insertIndex;
        dragRef.current = {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          moved: false,
          startX: event.clientX,
          startY: event.clientY,
          fixedCaretIndex,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (dragRef.current.pointerId !== event.pointerId) return;
        if (
          !dragRef.current.moved
          && Math.abs(event.clientX - dragRef.current.startX) <= 3
          && Math.abs(event.clientY - dragRef.current.startY) <= 3
        ) return;
        dragRef.current.moved = true;
        event.preventDefault();
        updateDrag(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (dragRef.current.pointerId !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        stopDrag();
        dragRef.current.pointerId = null;
        if (dragRef.current.moved) {
          const { caretIndex, caretPlacement } = rangeStore.getState();
          focusMountedCaret(caretIndex, caretPlacement);
        } else {
          rangeStore.setCaret(insertIndex, placement);
          event.currentTarget.focus();
        }
      }}
      onPointerCancel={(event) => {
        if (dragRef.current.pointerId === event.pointerId) {
          stopDrag();
          dragRef.current.pointerId = null;
          dragRef.current.moved = false;
        }
      }}
    >
      {hasHandle && <span className="caret-slot__handle" aria-hidden="true" />}
    </button>
  );
}

export default memo(CaretSlot);
