import { useCallback, useRef } from 'react';
import { resolveNearestCaretAtPoint } from '../lib/rangePointer.js';
import { usePointerAutoScroll } from './usePointerAutoScroll.js';

const DRAG_THRESHOLD_PX = 10;
const LONG_PRESS_MS = 500;
const CONTENT_SELECTOR = [
  '[data-grid-index]',
  '.note-grid-svg',
  '.grid-card__text',
  '.grid-card__number',
  'button',
  'input',
  'textarea',
  'select',
  'a',
  '[contenteditable="true"]',
  // カード間の専用スロット以外では、行のpaddingや行間を選択起点にしない。
  '.score-canvas',
].join(', ');

export function isDesktopRangeDragExcluded(target) {
  const caretSlot = target?.closest?.('.caret-slot');
  if (caretSlot) {
    // 隙間の受け口もbuttonだが、不可視時は一覧面のドラッグ起点として扱う。
    // 表示中のキャレットだけはCaretSlot自身の境界ドラッグを優先する。
    return caretSlot.classList.contains('has-handle');
  }
  return Boolean(target?.closest?.(CONTENT_SELECTOR));
}

export function useDesktopRangeDrag(rangeStore, gridStore) {
  const pointerRef = useRef(null);
  const suppressClickRef = useRef(false);

  const moveSelection = useCallback((clientX, clientY) => {
    const pointer = pointerRef.current;
    if (!pointer) return;
    const target = resolveNearestCaretAtPoint(clientX, clientY, gridStore);
    if (!target) return;
    rangeStore.setSelectionFromCarets(pointer.startIndex, target.index, target.placement);
  }, [gridStore, rangeStore]);
  const { update, stop } = usePointerAutoScroll(moveSelection);

  const finish = useCallback((event) => {
    const pointer = pointerRef.current;
    if (!pointer || (event && pointer.pointerId !== event.pointerId)) return;
    stop();
    if (event && pointer.dragging && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointer.dragging) suppressClickRef.current = true;
    pointerRef.current = null;
  }, [stop]);

  return {
    onPointerDown(event) {
      if (
        event.pointerType !== 'mouse'
        || event.button !== 0
        || event.shiftKey
        || isDesktopRangeDragExcluded(event.target)
      ) return;
      const target = resolveNearestCaretAtPoint(event.clientX, event.clientY, gridStore);
      if (!target) return;
      suppressClickRef.current = false;
      rangeStore.setCaret(target.index, target.placement);
      pointerRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startIndex: target.index,
        startedAt: Date.now(),
        hasLongPressReceiver: Boolean(event.target.closest('.grid-card__header')),
        dragging: false,
      };
      event.preventDefault();
    },
    onPointerMove(event) {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      if (!pointer.dragging) {
        const moved = Math.hypot(
          event.clientX - pointer.startX,
          event.clientY - pointer.startY,
        );
        if (moved <= DRAG_THRESHOLD_PX) return;
        if (pointer.hasLongPressReceiver && Date.now() - pointer.startedAt >= LONG_PRESS_MS) {
          pointerRef.current = null;
          return;
        }
        pointer.dragging = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      update(event.clientX, event.clientY);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onClickCapture(event) {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
