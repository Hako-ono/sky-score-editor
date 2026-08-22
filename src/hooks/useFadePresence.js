import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const FLOATING_FADE_DURATION_MS = 180;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

export function floatingFadeClassName(shown) {
  return `floating-fade ${shown ? 'is-visible' : 'is-hidden'}`;
}

/**
 * 浮遊UIをフェードアウト完了までDOMへ残し、その後に取り除く。
 * 非表示へ切り替わった描画では即座に is-hidden を付けるため、
 * 消えかけの要素がクリックを受ける時間を作らない。
 */
export function useFadePresence(visible) {
  const reducedMotion = usePrefersReducedMotion();
  const [shouldRender, setShouldRender] = useState(Boolean(visible));
  const [shown, setShown] = useState(false);
  const frameRef = useRef(0);
  const timerRef = useRef(0);

  useLayoutEffect(() => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    frameRef.current = 0;
    timerRef.current = 0;

    if (visible) {
      setShouldRender(true);
      if (reducedMotion) {
        setShown(true);
      } else {
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = 0;
          setShown(true);
        });
      }
    } else {
      setShown(false);
      if (reducedMotion) {
        setShouldRender(false);
      } else {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = 0;
          setShouldRender(false);
        }, FLOATING_FADE_DURATION_MS);
      }
    }

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      frameRef.current = 0;
      timerRef.current = 0;
    };
  }, [reducedMotion, visible]);

  return {
    shouldRender,
    fadeClassName: floatingFadeClassName(shown),
  };
}
