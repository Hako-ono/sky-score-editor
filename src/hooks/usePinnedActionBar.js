import { useCallback, useEffect, useRef, useState } from 'react';

function sameSnapshot(left, right) {
  return left.stuck === right.stuck && left.height === right.height;
}

function actionBarHeight(actionBarNode) {
  const measured = Number(actionBarNode?.getBoundingClientRect?.().height);
  return Number.isFinite(measured) && measured > 0 ? measured : 0;
}

function viewportBottom(entry) {
  const rootBottom = Number(entry?.rootBounds?.bottom);
  if (Number.isFinite(rootBottom)) return rootBottom;
  return window.innerHeight || document.documentElement.clientHeight;
}

export function pinnedActionSnapshot(entry, actionBarNode) {
  const height = actionBarHeight(actionBarNode);
  const sentinelTop = Number(entry?.boundingClientRect?.top);
  const stuck = height > 0
    && !entry?.isIntersecting
    && Number.isFinite(sentinelTop)
    && sentinelTop >= viewportBottom(entry);
  return {
    stuck,
    height: stuck ? height : 0,
  };
}

export function usePinnedActionBar() {
  const [snapshot, setSnapshot] = useState({ stuck: false, height: 0 });
  const actionBarNodeRef = useRef(null);
  const sentinelNodeRef = useRef(null);
  const intersectionObserverRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const stuckRef = useRef(false);

  const commit = useCallback((next) => {
    stuckRef.current = next.stuck;
    setSnapshot((current) => (sameSnapshot(current, next) ? current : next));
  }, []);

  const reconnectIntersectionObserver = useCallback(() => {
    intersectionObserverRef.current?.disconnect();
    intersectionObserverRef.current = null;
    const actionBarNode = actionBarNodeRef.current;
    const sentinelNode = sentinelNodeRef.current;
    if (!actionBarNode || !sentinelNode || typeof window.IntersectionObserver !== 'function') {
      commit({ stuck: false, height: 0 });
      return;
    }

    // observe直後に届く最初の通知も通常の判定へ通す。これによりタブ切替直後も
    // 次のスクロールを待たず、現在位置に合う固定状態へ揃う。
    const observer = new window.IntersectionObserver((entries) => {
      const currentSentinel = sentinelNodeRef.current;
      const currentActionBar = actionBarNodeRef.current;
      const entry = entries.find((candidate) => candidate.target === currentSentinel);
      if (entry && currentActionBar) commit(pinnedActionSnapshot(entry, currentActionBar));
    }, { threshold: [0, 1] });
    intersectionObserverRef.current = observer;
    observer.observe(sentinelNode);
  }, [commit]);

  const actionBarRef = useCallback((element) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    actionBarNodeRef.current = element;

    if (element && typeof window.ResizeObserver === 'function') {
      const observer = new window.ResizeObserver(() => {
        if (!stuckRef.current || actionBarNodeRef.current !== element) return;
        const height = actionBarHeight(element);
        commit(height > 0
          ? { stuck: true, height }
          : { stuck: false, height: 0 });
      });
      resizeObserverRef.current = observer;
      observer.observe(element);
    }
    reconnectIntersectionObserver();
  }, [commit, reconnectIntersectionObserver]);

  const sentinelRef = useCallback((element) => {
    sentinelNodeRef.current = element;
    reconnectIntersectionObserver();
  }, [reconnectIntersectionObserver]);

  useEffect(() => () => {
    intersectionObserverRef.current?.disconnect();
    resizeObserverRef.current?.disconnect();
  }, []);

  return {
    actionBarRef,
    sentinelRef,
    isPinnedActionStuck: snapshot.stuck,
    pinnedActionHeight: snapshot.height,
  };
}
