import { createContext, useContext, useRef, useSyncExternalStore } from 'react';

// 拡大表示中のグリッド番号を App の useState に置くと、スワイプ・Enter で
// 番号が変わるたびに ScoreCanvas 配下の全 GridCard の props 比較が発生する
// （activeGrid について解消した問題と同じ構図）。そのため
// ActiveGridContext と同じく React の外側で状態を持つ pub-sub ストアにする。
// 購読者は GridOverlay 1つだけなので、index ごとの購読は不要。
function createExpandedGridStore() {
  let expandedIndex = -1;
  const listeners = new Set();

  return {
    getExpandedIndex() {
      return expandedIndex;
    },
    setExpandedIndex(nextIndex) {
      if (nextIndex === expandedIndex) return;
      expandedIndex = nextIndex;
      listeners.forEach((callback) => callback());
    },
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}

const ExpandedGridContext = createContext(null);

export function ExpandedGridProvider({ children }) {
  // Provider 自身は React state を持たない（= expandedIndex が変わっても
  // Provider は再レンダーされず、children の再評価を引き起こさない）。
  const storeRef = useRef(null);
  if (!storeRef.current) storeRef.current = createExpandedGridStore();

  return (
    <ExpandedGridContext.Provider value={storeRef.current}>
      {children}
    </ExpandedGridContext.Provider>
  );
}

export function useExpandedGridStore() {
  const store = useContext(ExpandedGridContext);
  if (!store) {
    throw new Error('useExpandedGridStore は ExpandedGridProvider の内側で使ってください。');
  }
  return store;
}

/** 拡大表示中のグリッド番号そのものを購読する（GridOverlay 用） */
export function useExpandedGridIndex() {
  const store = useExpandedGridStore();
  return useSyncExternalStore(store.subscribe, store.getExpandedIndex);
}
