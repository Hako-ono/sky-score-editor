import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from 'react';

import { diffGrids } from '../lib/gridDiff.js';
import { splitIntoRows } from '../lib/layout.js';
import { computeRowOffsetY } from '../lib/virtualRows.js';
import { DEBUG_ENABLED } from '../lib/debugFlag.js';
import { recordSetGridsMetrics } from '../lib/debugMetrics.js';

// rows（number[][]、各行に入る index の配列）は先頭から昇順に並んだ
// 連続区間の集まりである（splitIntoRows の生成規則）。ある index が
// どの行に属するかは、各行の最後の要素と比較しながら前から探せば求まる。
// rowCount は MAX_GRIDS 由来で有界（forceBreakAfter により最大 3000 行程度）
// のため、線形走査で十分。
function findRowIndexForGridIndex(rows, gridIndex) {
  if (!Number.isInteger(gridIndex) || gridIndex < 0) return -1;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.length > 0 && gridIndex <= row[row.length - 1]) return i;
  }
  return -1;
}

// GridCard がテキスト編集のたびに props で grid を受け取ると、変更していない
// グリッドまで含めて ScoreCanvas 配下の全要素が作り直される。ActiveGridContext と
// 同じ理由（コメント参照）で、grids を React の外側の pub-sub ストアに持たせ、
// 各 GridCard は自分の index にだけ購読する。
//
// 配列そのものを返す API（getGrids() 等）は作らない。配列を外へ出すと、購読を
// 経由せずレンダー中に読む呼び出し元が生まれ、useSyncExternalStore が防いでいる
// 不整合（tearing）を持ち込むことになる。ScoreCanvas が必要とするのは
// 「どの index がどの行に入るか」だけであり、それは getRows() が返す。
function createScoreGridsStore() {
  // 初回の setGrids が来るまで undefined。diffGrids(undefined, ...) は
  // 「全 index changed・structureChanged: true」を返す（初回供給の扱い）。
  let grids;
  let columns;
  let rows = [];
  // ScoreCanvas が実測して書き込むまでの暫定値（デスクトップの
  // .grid-card から概算した値）。GridOverlay の
  // 復帰スクロールや GridCard の Enter/Tab は、ScoreCanvas の最初の
  // useLayoutEffect（measure）より後にしかユーザー操作で呼ばれ得ないため、
  // 実運用でこの暫定値が使われることはないはずだが、フォールバックとして
  // 置いておく。
  let rowPitch = 260;
  let canvasTop = 0;
  // 「保留フォーカス」：画面外（未マウント）の index へ移動するとき、
  // スクロールでその行をマウントさせた後、実際に自分自身へ focus() する
  // のは GridCard/GridCardCompact 自身の役目にする。
  let pendingFocusIndex = -1;
  const indexListeners = new Map(); // index -> Set<() => void>
  const rowsListeners = new Set();
  const pendingFocusListeners = new Map(); // index -> Set<() => void>

  function notifyIndex(index) {
    const set = indexListeners.get(index);
    if (set) set.forEach((callback) => callback());
  }

  function notifyPendingFocus(index) {
    const set = pendingFocusListeners.get(index);
    if (set) set.forEach((callback) => callback());
  }

  // splitIntoRows が返す { grid, index } は grid 自体を含むが、ここで必要なのは
  // index だけ（grid は GridCard が useGrid(index) で自分で引く）。
  function computeRows(nextGrids, nextColumns) {
    return splitIntoRows(nextGrids, nextColumns).map((row) =>
      row.map((cell) => cell.index),
    );
  }

  function getRowLayoutForGridIndex(gridIndex) {
    const rowIndex = findRowIndexForGridIndex(rows, gridIndex);
    if (rowIndex < 0) return null;
    return {
      rowIndex,
      rowTop: computeRowOffsetY({ rowIndex, canvasTop, rowPitch }),
      rowPitch,
    };
  }

  return {
    getGrid(index) {
      return grids ? grids[index] : undefined;
    },
    getRows() {
      return rows;
    },
    setGrids(nextGrids, nextColumns) {
      // 診断オーバレイ（?debug=1）用の計測。フラグが立っていないときは
      // performance.now() の呼び出し自体を通らないようにし、通常利用の
      // 経路にコストを乗せない。
      const t0 = DEBUG_ENABLED ? performance.now() : 0;

      const { changedIndices, structureChanged } = diffGrids(grids, nextGrids);
      const columnsChanged = nextColumns !== columns;
      grids = nextGrids;
      columns = nextColumns;
      // rows は「同じ参照であること」が useSyncExternalStore の getSnapshot の
      // 安定性を担保するため、構造・columns のどちらも変わっていなければ
      // 作り直さない。index の通知より前に確定させることで、後続の
      // notifyIndex 呼び出し（同期的に GridCard 等を再レンダーさせうる）が
      // 走る時点で rows・grids の両方が既に最新になっている状態を保証する。
      if (structureChanged || columnsChanged) {
        rows = computeRows(nextGrids, nextColumns);
        rowsListeners.forEach((callback) => callback());
      }
      changedIndices.forEach(notifyIndex);

      // 「通知のみ」の値（従来どおり）と、「次のペイントまで」の値の両方を残す。
      // 前者は diffGrids・通知の予約だけを含み、GridCard の実際の再レンダーと
      // DOMコミットは useLayoutEffect の外（呼び出し元の外）で起きるため含まない。
      if (DEBUG_ENABLED) {
        recordSetGridsMetrics(t0, performance.now() - t0, changedIndices.length);
      }
    },
    subscribeIndex(index, callback) {
      let set = indexListeners.get(index);
      if (!set) {
        set = new Set();
        indexListeners.set(index, set);
      }
      set.add(callback);
      // ActiveGridContext.jsx と同じ二重呼び出しガード（コメント参照）。
      let unsubscribed = false;
      return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        set.delete(callback);
        if (set.size === 0) indexListeners.delete(index);
      };
    },
    subscribeRows(callback) {
      rowsListeners.add(callback);
      return () => rowsListeners.delete(callback);
    },

    // ---- 仮想化後のフォーカス移動・拡大表示の復帰スクロール ----
    //
    // rowPitch・canvasTop はブラウザでの実測値（layout.js 由来の rows とは
    // 別の関心事）で、書き手は ScoreCanvas だけ。
    setLayoutMetrics(nextRowPitch, nextCanvasTop) {
      rowPitch = nextRowPitch;
      canvasTop = nextCanvasTop;
    },
    getRowPitch() {
      return rowPitch;
    },
    // grid indexから行番号と現在の実測値を一度に返す。自動追尾では、行番号と
    // 座標を別々に求めると同じrowsを二度線形走査するため、読み取りをまとめる。
    getRowLayout(gridIndex) {
      return getRowLayoutForGridIndex(gridIndex);
    },
    getPendingFocusIndex() {
      return pendingFocusIndex;
    },
    // gridIndex を含む行の文書内Y座標（上端）。行が見つからなければ null
    // （範囲外の index。呼び出し側はスクロール・保留フォーカスの予約を
    // 諦める判断に使う）。
    getRowOffsetY(gridIndex) {
      const layout = getRowLayoutForGridIndex(gridIndex);
      return layout ? layout.rowTop : null;
    },
    // 画面外（未マウント）の index へフォーカスを移したいとき、スクロール
    // 側が予約する。実際の focus() 呼び出しは、その行がマウントされたとき
    // 対象の GridCard/GridCardCompact 自身が「自分が保留対象か」を
    // subscribePendingFocus 経由で見て行う。
    requestFocus(nextIndex) {
      if (nextIndex === pendingFocusIndex) return;
      const prevIndex = pendingFocusIndex;
      pendingFocusIndex = nextIndex;
      // isPendingFocus の値が変わりうるのは「以前の保留対象」と
      // 「これから保留対象になる番号」の2件だけ（ActiveGridContext と同じ理由）
      notifyPendingFocus(prevIndex);
      notifyPendingFocus(nextIndex);
    },
    // フォーカスできた側が呼ぶ。別の保留要求で既に上書きされていた場合は
    // 何もしない（新しい要求を誤って取り消さないため）。
    clearPendingFocus(index) {
      if (pendingFocusIndex !== index) return;
      pendingFocusIndex = -1;
      notifyPendingFocus(index);
    },
    subscribePendingFocus(index, callback) {
      let set = pendingFocusListeners.get(index);
      if (!set) {
        set = new Set();
        pendingFocusListeners.set(index, set);
      }
      set.add(callback);
      let unsubscribed = false;
      return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        set.delete(callback);
        if (set.size === 0) pendingFocusListeners.delete(index);
      };
    },
  };
}

const ScoreGridsContext = createContext(null);

export function ScoreGridsProvider({ children }) {
  // Provider 自身は React state を持たない（grids が変わっても Provider は
  // 再レンダーされず、children の再評価を引き起こさない）。
  const storeRef = useRef(null);
  if (!storeRef.current) storeRef.current = createScoreGridsStore();

  return (
    <ScoreGridsContext.Provider value={storeRef.current}>
      {children}
    </ScoreGridsContext.Provider>
  );
}

export function useScoreGridsStore() {
  const store = useContext(ScoreGridsContext);
  if (!store) {
    throw new Error('useScoreGridsStore は ScoreGridsProvider の内側で使ってください。');
  }
  return store;
}

/** 自分の index が担当するグリッドだけを購読する（GridCard / GridCardCompact 用） */
export function useGrid(index) {
  const store = useScoreGridsStore();
  // subscribe / getSnapshot を毎レンダーで新しい関数にすると useSyncExternalStore が
  // 再購読を繰り返すため、ActiveGridContext.jsx と同じ理由で useCallback で固定する。
  const subscribe = useCallback(
    (callback) => store.subscribeIndex(index, callback),
    [store, index],
  );
  const getSnapshot = useCallback(() => store.getGrid(index), [store, index]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** 行の分かれ方（構造）が変わったときだけ再レンダーしたいコンポーネント用 */
export function useGridRows() {
  const store = useScoreGridsStore();
  return useSyncExternalStore(store.subscribeRows, store.getRows);
}

/**
 * 自分の index が現在の「保留フォーカス」の対象かどうかだけを購読する
 * （GridCard / GridCardCompact 用）。true になったら自分自身へ
 * focus() し、clearPendingFocus(index) を呼んで保留を解除するのは
 * 呼び出し側の役目。
 */
export function useIsPendingFocus(index) {
  const store = useScoreGridsStore();
  const subscribe = useCallback(
    (callback) => store.subscribePendingFocus(index, callback),
    [store, index],
  );
  const getSnapshot = useCallback(
    () => store.getPendingFocusIndex() === index,
    [store, index],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}
