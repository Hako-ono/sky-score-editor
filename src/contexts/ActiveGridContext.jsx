import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from 'react';

// 再生中は1グリッドごとに activeIndex が変わる。これを通常の useState/props で
// 親コンポーネントまで伝えると、変化のたびに親配下の全 GridCard が再評価される。
// そのため React の外側で状態を持つ pub-sub ストアにし、購読側は自分に関係する
// 通知が来たときだけ再レンダーする（useSyncExternalStore を使うのはそのため）。
function createActiveGridStore() {
  let activeIndex = -1;
  const indexListeners = new Map(); // index -> Set<() => void>
  const anyListeners = new Set();

  function notifyIndex(index) {
    const set = indexListeners.get(index);
    if (set) set.forEach((callback) => callback());
  }

  return {
    getActiveIndex() {
      return activeIndex;
    },
    setActiveIndex(nextIndex) {
      if (nextIndex === activeIndex) return;
      const prevIndex = activeIndex;
      activeIndex = nextIndex;
      // isActive の値が変わりうるのは「以前アクティブだった番号」と
      // 「これからアクティブになる番号」の2件だけなので、その購読者だけに通知する。
      notifyIndex(prevIndex);
      notifyIndex(nextIndex);
      anyListeners.forEach((callback) => callback());
    },
    subscribeIndex(index, callback) {
      let set = indexListeners.get(index);
      if (!set) {
        set = new Set();
        indexListeners.set(index, set);
      }
      set.add(callback);
      // 現時点でReactがcleanupを二重に呼ぶ経路は無いが、将来の変更に対する
      // 保険として二重呼び出しガードを入れる。ガードが無いと、2回目の呼び出しが
      // 古いsetをクロージャで抱えたまま実行され、その間に同じindexへ後から
      // 登録された別のSetをMapから誤って削除してしまう。
      let unsubscribed = false;
      return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        set.delete(callback);
        if (set.size === 0) indexListeners.delete(index);
      };
    },
    subscribeAny(callback) {
      anyListeners.add(callback);
      return () => anyListeners.delete(callback);
    },
  };
}

const ActiveGridContext = createContext(null);

export function ActiveGridProvider({ children }) {
  // Provider 自身は React state を持たない（= activeIndex が変わっても
  // Provider は再レンダーされず、children の再評価を引き起こさない）。
  const storeRef = useRef(null);
  if (!storeRef.current) storeRef.current = createActiveGridStore();

  return (
    <ActiveGridContext.Provider value={storeRef.current}>
      {children}
    </ActiveGridContext.Provider>
  );
}

export function useActiveGridStore() {
  const store = useContext(ActiveGridContext);
  if (!store) {
    throw new Error('useActiveGridStore は ActiveGridProvider の内側で使ってください。');
  }
  return store;
}

/** 自分の index が現在アクティブかどうかだけを購読する（GridCard 用） */
export function useIsActiveGrid(index) {
  const store = useActiveGridStore();
  // useSyncExternalStore は subscribe / getSnapshot が毎レンダーで新しい
  // 関数だと再購読を繰り返すため、useIsMobile.js と同じ理由で固定する
  // （そちらはモジュールスコープの関数、こちらは store/index に依存するため
  // useCallback で固定する）。
  const subscribe = useCallback(
    (callback) => store.subscribeIndex(index, callback),
    [store, index],
  );
  const getSnapshot = useCallback(
    () => store.getActiveIndex() === index,
    [store, index],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** アクティブ番号そのものを購読する（自動スクロール用） */
export function useActiveGridIndex() {
  const store = useActiveGridStore();
  return useSyncExternalStore(store.subscribeAny, store.getActiveIndex);
}
