import { useCallback, useEffect, useRef } from 'react';
import { edgeScrollDelta } from '../lib/rangePointer.js';

export function usePointerAutoScroll(onPoint) {
  const onPointRef = useRef(onPoint);
  const pointRef = useRef(null);
  const frameRef = useRef(null);
  onPointRef.current = onPoint;

  const stop = useCallback(() => {
    pointRef.current = null;
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const runFrame = useCallback(() => {
    const point = pointRef.current;
    if (!point) {
      frameRef.current = null;
      return;
    }
    const delta = edgeScrollDelta(point.clientY, window.innerHeight);
    if (delta === 0) {
      frameRef.current = null;
      return;
    }
    window.scrollBy({ top: delta, behavior: 'auto' });
    onPointRef.current(point.clientX, point.clientY);
    frameRef.current = requestAnimationFrame(runFrame);
  }, []);

  const update = useCallback((clientX, clientY) => {
    pointRef.current = { clientX, clientY };
    onPointRef.current(clientX, clientY);
    if (
      frameRef.current === null
      && edgeScrollDelta(clientY, window.innerHeight) !== 0
    ) {
      frameRef.current = requestAnimationFrame(runFrame);
    }
  }, [runFrame]);

  useEffect(() => stop, [stop]);
  return { update, stop };
}
