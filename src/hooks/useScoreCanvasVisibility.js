import { useLayoutEffect, useRef, useState } from 'react';

function normalizeBottomInset(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function scoreCanvasInitialVisibility(node, bottomInset, viewport = window) {
  const rect = node.getBoundingClientRect();
  const viewportHeight = viewport.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = viewport.innerWidth || document.documentElement.clientWidth;
  const visibleBottom = Math.max(0, viewportHeight - normalizeBottomInset(bottomInset));
  return rect.height > 0
    && rect.width > 0
    && rect.bottom > 0
    && rect.top < visibleBottom
    && rect.right > 0
    && rect.left < viewportWidth;
}

export function useScoreCanvasVisibility(enabled, bottomInset, onBeforeHide) {
  const [snapshot, setSnapshot] = useState({ ready: false, visible: false });
  const visibleRef = useRef(false);
  const beforeHideRef = useRef(onBeforeHide);
  beforeHideRef.current = onBeforeHide;

  useLayoutEffect(() => {
    const commit = (visible) => {
      if (!visible && visibleRef.current) beforeHideRef.current?.();
      visibleRef.current = visible;
      setSnapshot((current) => (
        current.ready && current.visible === visible
          ? current
          : { ready: true, visible }
      ));
    };

    const node = enabled ? document.querySelector('.score-canvas') : null;
    if (!node) {
      commit(false);
      return undefined;
    }

    const measuredInset = normalizeBottomInset(bottomInset);
    commit(scoreCanvasInitialVisibility(node, measuredInset));
    if (typeof window.IntersectionObserver !== 'function') return undefined;

    const observer = new window.IntersectionObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === node);
      if (entry) commit(Boolean(entry.isIntersecting));
    }, {
      rootMargin: `0px 0px -${measuredInset}px 0px`,
      threshold: 0,
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [bottomInset, enabled]);

  return {
    isScoreCanvasVisibilityReady: snapshot.ready,
    isScoreCanvasVisible: snapshot.visible,
  };
}
