import { useCallback, useEffect, useRef, useState } from 'react';
import {
  resolveCaretTargetAtPoint,
  resolveGridIndexAtPoint,
} from '../lib/rangePointer.js';
import {
  keepDraggedCaretSeparated,
  selectedRange,
} from '../lib/rangeSelectionStore.js';
import { usePointerAutoScroll } from './usePointerAutoScroll.js';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

export function useRangeSelectionGesture({
  index,
  rangeStore,
  gridStore,
  ignoreInteractive = true,
}) {
  const timerRef = useRef(null);
  const pointerRef = useRef(null);
  const activeRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [isPressing, setIsPressing] = useState(false);

  const moveSelection = useCallback((clientX, clientY) => {
    const pointer = pointerRef.current;
    if (pointer?.mode === 'boundary') {
      const target = resolveCaretTargetAtPoint(
        clientX,
        clientY,
        gridStore,
        pointer.fixedCaretIndex,
      );
      if (!target) return;
      const nextCaretIndex = keepDraggedCaretSeparated(
        pointer.fixedCaretIndex,
        target.index,
        pointer.movingCaretIndex,
        gridStore.getGridCount(),
      );
      pointer.movingCaretIndex = nextCaretIndex;
      rangeStore.setSelectionFromCarets(
        pointer.fixedCaretIndex,
        nextCaretIndex,
        nextCaretIndex === gridStore.getGridCount() ? 'after' : target.placement,
      );
      return;
    }
    const targetIndex = resolveGridIndexAtPoint(clientX, clientY, gridStore);
    if (targetIndex >= 0) {
      rangeStore.setSelectionFromOriginGrid(index, targetIndex);
    }
  }, [gridStore, index, rangeStore]);
  const { update: updateAutoScroll, stop: stopAutoScroll } = usePointerAutoScroll(moveSelection);

  const preventTouchMove = useCallback((event) => {
    if (activeRef.current) event.preventDefault();
  }, []);

  const removeTouchGuard = useCallback(() => {
    document.removeEventListener('touchmove', preventTouchMove);
  }, [preventTouchMove]);

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (!activeRef.current) pointerRef.current = null;
    setIsPressing(false);
  }, []);

  const finish = useCallback((event) => {
    cancelPending();
    stopAutoScroll();
    removeTouchGuard();
    if (activeRef.current && event) {
      if (suppressClickRef.current) event.preventDefault();
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
    activeRef.current = false;
    pointerRef.current = null;
  }, [cancelPending, removeTouchGuard, stopAutoScroll]);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    stopAutoScroll();
    removeTouchGuard();
  }, [removeTouchGuard, stopAutoScroll]);

  const onPointerDown = useCallback((event) => {
    if (
      event.button !== 0
      || event.target.closest('[data-caret-slot]')
      || (ignoreInteractive && event.target.closest(
        'button, [role="button"], input, textarea, select, a',
      ))
    ) return;
    finish();
    suppressClickRef.current = false;
    const range = selectedRange(rangeStore.getState());
    const isStartBoundary = range?.start === index;
    const isEndBoundary = range?.end === index;
    if (range && (isStartBoundary || isEndBoundary)) {
      const rect = event.currentTarget.getBoundingClientRect();
      const moveStartBoundary = isStartBoundary && isEndBoundary
        ? event.clientX < rect.left + rect.width / 2
        : isStartBoundary;
      const movingCaretIndex = moveStartBoundary ? range.start : range.end + 1;
      const fixedCaretIndex = moveStartBoundary ? range.end + 1 : range.start;
      pointerRef.current = {
        mode: 'boundary',
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        target: event.currentTarget,
        fixedCaretIndex,
        movingCaretIndex,
      };
      activeRef.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      document.addEventListener('touchmove', preventTouchMove, { passive: false });
      return;
    }
    pointerRef.current = {
      mode: 'origin',
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      x: event.clientX,
      y: event.clientY,
      target: event.currentTarget,
    };
    setIsPressing(true);
    timerRef.current = setTimeout(() => {
      const pointer = pointerRef.current;
      timerRef.current = null;
      if (!pointer) return;
      activeRef.current = true;
      suppressClickRef.current = true;
      setIsPressing(false);
      pointer.target.setPointerCapture?.(pointer.pointerId);
      document.addEventListener('touchmove', preventTouchMove, { passive: false });
      rangeStore.startSelection(index, true);
    }, LONG_PRESS_MS);
  }, [finish, ignoreInteractive, index, preventTouchMove, rangeStore]);

  const onPointerMove = useCallback((event) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (!activeRef.current) {
      const movedDirectly = Math.abs(event.clientX - pointer.x) > MOVE_TOLERANCE_PX
        || Math.abs(event.clientY - pointer.y) > MOVE_TOLERANCE_PX;
      if (pointer.pointerType === 'mouse' && movedDirectly) {
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = null;
        activeRef.current = true;
        suppressClickRef.current = true;
        setIsPressing(false);
        pointer.target.setPointerCapture?.(pointer.pointerId);
        rangeStore.startSelection(index, true);
        event.preventDefault();
        updateAutoScroll(event.clientX, event.clientY);
        return;
      }
      if (
        Math.abs(event.clientX - pointer.x) > MOVE_TOLERANCE_PX
        || Math.abs(event.clientY - pointer.y) > MOVE_TOLERANCE_PX
      ) cancelPending();
      return;
    }
    if (
      pointer.mode === 'boundary'
      && !suppressClickRef.current
      && Math.abs(event.clientX - pointer.x) <= MOVE_TOLERANCE_PX
      && Math.abs(event.clientY - pointer.y) <= MOVE_TOLERANCE_PX
    ) return;
    suppressClickRef.current = true;
    event.preventDefault();
    updateAutoScroll(event.clientX, event.clientY);
  }, [cancelPending, index, rangeStore, updateAutoScroll]);

  const consumeClick = useCallback((event) => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }, []);

  return {
    isPressing,
    consumeClick,
    gestureProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onContextMenu: (event) => {
        if (timerRef.current !== null || activeRef.current) event.preventDefault();
      },
    },
  };
}
