import { useCallback, useEffect, useRef } from 'react';
import { focusMountedCaret } from '../lib/rangeFocus.js';
import { resolveCaretTargetAtPoint } from '../lib/rangePointer.js';
import { usePointerAutoScroll } from './usePointerAutoScroll.js';

export const CARET_TOUCH_DIRECTION_THRESHOLD_PX = 6;

export function classifyCaretSlotTouchIntent(deltaX, deltaY) {
  if (Math.hypot(deltaX, deltaY) < CARET_TOUCH_DIRECTION_THRESHOLD_PX) {
    return 'pending';
  }
  return Math.abs(deltaX) > Math.abs(deltaY) ? 'selection' : 'scroll';
}

function findTouch(touches, identifier) {
  for (let index = 0; index < touches.length; index += 1) {
    if (touches[index].identifier === identifier) return touches[index];
  }
  return null;
}

/**
 * 空の隙間から始まるタッチだけを一覧全体で受け持つ。各CaretSlotへ
 * non-passiveなリスナーを増やさず、横選択と縦スクロールを最初の動きで分ける。
 */
export function useCaretSlotTouchDrag(canvasRef, rangeStore, gridStore) {
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(null);

  const moveSelection = useCallback((clientX, clientY) => {
    const gesture = gestureRef.current;
    if (gesture?.intent !== 'selection') return;
    const target = resolveCaretTargetAtPoint(
      clientX,
      clientY,
      gridStore,
      gesture.fixedCaretIndex,
    );
    if (!target) return;
    rangeStore.setSelectionFromCarets(
      gesture.fixedCaretIndex,
      target.index,
      target.index === gridStore.getGridCount() ? 'after' : target.placement,
    );
  }, [gridStore, rangeStore]);
  const { update: updateSelection, stop: stopSelection } = usePointerAutoScroll(moveSelection);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const clearGesture = (focusCaret = false) => {
      const gesture = gestureRef.current;
      stopSelection();
      gestureRef.current = null;
      if (!gesture || gesture.intent !== 'selection') return;
      suppressClickRef.current = {
        slot: gesture.slot,
        expiresAt: Date.now() + 750,
      };
      if (focusCaret) {
        const { caretIndex, caretPlacement } = rangeStore.getState();
        focusMountedCaret(caretIndex, caretPlacement);
      }
    };

    const handleTouchStart = (event) => {
      suppressClickRef.current = null;
      if (event.touches.length !== 1) {
        clearGesture();
        return;
      }
      const slot = event.target.closest?.('[data-caret-slot]');
      if (!slot || slot.classList.contains('has-handle')) {
        clearGesture();
        return;
      }
      const touch = event.touches[0];
      const fixedCaretIndex = Number(slot.dataset.caretIndex);
      if (
        !Number.isInteger(fixedCaretIndex)
        || fixedCaretIndex < 0
        || fixedCaretIndex > gridStore.getGridCount()
      ) {
        clearGesture();
        return;
      }
      gestureRef.current = {
        identifier: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        fixedCaretIndex,
        intent: 'pending',
        slot,
      };
    };

    const handleTouchMove = (event) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.intent === 'scroll') return;
      const touch = findTouch(event.touches, gesture.identifier);
      if (!touch) return;

      if (gesture.intent === 'selection') {
        if (event.cancelable) event.preventDefault();
        updateSelection(touch.clientX, touch.clientY);
        return;
      }

      const intent = classifyCaretSlotTouchIntent(
        touch.clientX - gesture.startX,
        touch.clientY - gesture.startY,
      );
      if (intent === 'pending') return;
      gesture.intent = intent;
      if (intent === 'scroll') return;

      if (event.cancelable) event.preventDefault();
      updateSelection(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (event) => {
      const gesture = gestureRef.current;
      if (!gesture || !findTouch(event.changedTouches, gesture.identifier)) return;
      clearGesture(true);
    };

    const handleClickCapture = (event) => {
      const suppression = suppressClickRef.current;
      if (!suppression) return;
      suppressClickRef.current = null;
      if (
        Date.now() <= suppression.expiresAt
        && event.target.closest?.('[data-caret-slot]') === suppression.slot
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    canvas.addEventListener('click', handleClickCapture, true);
    return () => {
      clearGesture();
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
      canvas.removeEventListener('click', handleClickCapture, true);
    };
  }, [canvasRef, gridStore, rangeStore, stopSelection, updateSelection]);
}
