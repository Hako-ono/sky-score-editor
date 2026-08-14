import { useCallback, useReducer, useRef } from 'react';
import {
  scoreReducer,
  initialScore,
  coalesceKey,
} from '../state/scoreReducer.js';

const MAX_HISTORY = 100;

const historyInitial = {
  past: [],
  present: initialScore,
  future: [],
  lastCoalesceKey: null,
};

function historyReducer(state, action) {
  // 履歴を消して状態を差し替える (ファイル読み込み・新規作成・全消去)
  if (action.type === 'RESET') {
    return {
      past: [],
      present: action.present,
      future: [],
      lastCoalesceKey: null,
    };
  }
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
      lastCoalesceKey: null,
    };
  }
  if (action.type === 'REDO') {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      past: [...state.past, state.present],
      present: next,
      future: state.future.slice(1),
      lastCoalesceKey: null,
    };
  }

  // 通常の編集アクション
  const nextPresent = scoreReducer(state.present, action);
  if (nextPresent === state.present) return state; // 変化なし

  const key = coalesceKey(action);
  const shouldCoalesce = key !== null && key === state.lastCoalesceKey;

  const past = shouldCoalesce
    ? state.past // 直前と同種の連続操作 → 履歴を増やさない
    : [...state.past, state.present].slice(-MAX_HISTORY);

  return {
    past,
    present: nextPresent,
    future: [],
    lastCoalesceKey: key,
  };
}

/**
 * 楽譜状態 + undo/redo を提供するフック。
 * onChange は present が変化するたびに呼ばれる (自動保存などに使用)。
 */
export function useUndoableScore() {
  const [state, rawDispatch] = useReducer(historyReducer, historyInitial);

  const dispatch = useCallback((action) => {
    rawDispatch(action);
  }, []);

  const reset = useCallback((present) => {
    rawDispatch({ type: 'RESET', present });
  }, []);

  const undo = useCallback(() => rawDispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => rawDispatch({ type: 'REDO' }), []);

  return {
    score: state.present,
    dispatch,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
