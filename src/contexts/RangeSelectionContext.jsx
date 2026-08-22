import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from 'react';
import { createRangeSelectionStore } from '../lib/rangeSelectionStore.js';

const RangeSelectionContext = createContext(null);

export function RangeSelectionProvider({ children }) {
  const storeRef = useRef(null);
  if (!storeRef.current) storeRef.current = createRangeSelectionStore();
  return (
    <RangeSelectionContext.Provider value={storeRef.current}>
      {children}
    </RangeSelectionContext.Provider>
  );
}

export function useRangeSelectionStore() {
  const store = useContext(RangeSelectionContext);
  if (!store) throw new Error('useRangeSelectionStore は RangeSelectionProvider の内側で使ってください。');
  return store;
}

export function useRangeSelectionState() {
  const store = useRangeSelectionStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}

export function useRangeActionBarOpen() {
  const store = useRangeSelectionStore();
  const getSnapshot = useCallback(() => store.getState().actionBarOpen, [store]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}

export function useRangeGridFlags(index) {
  const store = useRangeSelectionStore();
  const subscribe = useCallback(
    (callback) => store.subscribeIndex(index, callback),
    [index, store],
  );
  const getSnapshot = useCallback(() => store.getGridFlags(index), [index, store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
