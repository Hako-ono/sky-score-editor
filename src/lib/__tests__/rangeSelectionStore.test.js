import { describe, expect, it, vi } from 'vitest';
import {
  adjustCaretBoundaryForReplacement,
  createRangeSelectionStore,
  keepDraggedCaretSeparated,
  RANGE_SELECTED,
  RANGE_SELECTION_END,
  RANGE_SELECTION_START,
  RANGE_SELECTING,
  resolvePlaybackRange,
  selectedRange,
} from '../rangeSelectionStore.js';

describe('rangeSelectionStore', () => {
  it('置換位置より後ろのキャレット境界だけを件数差で補正する', () => {
    expect(adjustCaretBoundaryForReplacement(2, 2, 1, 0)).toBe(2);
    expect(adjustCaretBoundaryForReplacement(3, 2, 1, 0)).toBe(2);
    expect(adjustCaretBoundaryForReplacement(8, 2, 1, 3)).toBe(10);
    expect(adjustCaretBoundaryForReplacement(4, 2, 4, 1)).toBe(3);
  });

  it('拡大表示の一時選択は通常の選択とキャレットを上書きしない', () => {
    const store = createRangeSelectionStore();
    store.setSelection(2, 4);
    const { selectionAnchorCaretIndex, caretIndex, caretPlacement } = store.getState();

    store.setTransientSelection(7);
    expect(selectedRange(store.getState())).toEqual({ start: 7, end: 7 });
    expect(store.getGridFlags(7)).toBe(
      RANGE_SELECTED | RANGE_SELECTING | RANGE_SELECTION_START | RANGE_SELECTION_END,
    );
    expect(store.getState()).toMatchObject({
      selectionAnchorCaretIndex,
      caretIndex,
      caretPlacement,
    });

    store.clearTransientSelection();
    expect(selectedRange(store.getState())).toEqual({ start: 2, end: 4 });
  });

  it('拡大表示中の置換では控えている選択境界を補正する', () => {
    const store = createRangeSelectionStore();
    store.setSelectionFromCarets(8, 4);
    store.setTransientSelection(2);
    store.adjustForReplacement(2, 1, 0, 11);
    expect(selectedRange(store.getState())).toEqual({ start: 2, end: 2 });

    store.clearTransientSelection();
    expect(store.getState()).toMatchObject({
      selectionAnchorCaretIndex: 7,
      caretIndex: 3,
    });
    expect(selectedRange(store.getState())).toEqual({ start: 3, end: 6 });
  });

  it('起点から逆方向を含む連続範囲を選択する', () => {
    const store = createRangeSelectionStore();
    store.startSelection(5);
    store.selectIndex(2);
    expect(selectedRange(store.getState())).toEqual({ start: 2, end: 5 });
    expect(store.getGridFlags(5)).toBe(
      RANGE_SELECTED | RANGE_SELECTING | RANGE_SELECTION_END,
    );
    expect(store.getGridFlags(3)).toBe(RANGE_SELECTED | RANGE_SELECTING);
    expect(store.getGridFlags(1)).toBe(RANGE_SELECTING);
  });

  it('選択範囲の前後端を各グリッドのフラグで公開する', () => {
    const store = createRangeSelectionStore();
    store.setSelection(6, 3);
    expect(store.getGridFlags(3) & RANGE_SELECTION_START).toBeTruthy();
    expect(store.getGridFlags(6) & RANGE_SELECTION_END).toBeTruthy();
    expect(store.getGridFlags(4) & (RANGE_SELECTION_START | RANGE_SELECTION_END)).toBeFalsy();
  });

  it('複数選択の先頭は1件へ縮め、単一選択の同じグリッドで解除する', () => {
    const store = createRangeSelectionStore();
    store.startSelection(4);
    store.selectIndex(7);
    expect(selectedRange(store.getState())).toEqual({ start: 4, end: 7 });

    store.selectIndex(4);
    expect(selectedRange(store.getState())).toEqual({ start: 4, end: 4 });

    store.selectIndex(4);
    expect(selectedRange(store.getState())).toBeNull();
    expect(store.getState().caretIndex).toBe(4);
  });

  it('範囲外は既存範囲を保って拡大し、範囲内は先頭から押した場所までへ縮める', () => {
    const store = createRangeSelectionStore();
    store.setSelection(14, 11);
    store.selectIndex(8);
    expect(selectedRange(store.getState())).toEqual({ start: 8, end: 14 });

    store.selectIndex(12);
    expect(selectedRange(store.getState())).toEqual({ start: 8, end: 12 });

    store.selectIndex(16);
    expect(selectedRange(store.getState())).toEqual({ start: 8, end: 16 });
    expect(store.getState().caretIndex).toBe(17);
  });

  it('境界ドラッグは固定側へ重なっても直前側の1件選択を保ち、追い越せる', () => {
    expect(keepDraggedCaretSeparated(4, 4, 1, 8)).toBe(3);
    expect(keepDraggedCaretSeparated(4, 4, 7, 8)).toBe(5);
    expect(keepDraggedCaretSeparated(4, 6, 3, 8)).toBe(6);
    expect(keepDraggedCaretSeparated(0, 0, 0, 8)).toBe(1);
    expect(keepDraggedCaretSeparated(8, 8, 8, 8)).toBe(7);
  });

  it('キャレット直接ドラッグは固定側へ重なると選択を解除する', () => {
    const store = createRangeSelectionStore();
    store.setSelectionFromCarets(2, 6);
    store.setSelectionFromCarets(2, 2);
    expect(selectedRange(store.getState())).toBeNull();
    expect(store.getState()).toMatchObject({
      selectionAnchorCaretIndex: -1,
      caretIndex: 2,
    });
  });

  it('隙間を指すキャレットへ移ると選択だけを解除し、クリップボードを保つ', () => {
    const store = createRangeSelectionStore();
    store.setSelection(2, 4);
    store.setClipboard([{ text: 'A' }]);
    store.setCaret(7, 'after');
    expect(store.getState()).toMatchObject({
      selectionAnchorCaretIndex: -1,
      caretIndex: 7,
      caretPlacement: 'after',
    });
    expect(store.getClipboardCount()).toBe(1);
  });

  it('キャレットを左右へ1グリッドずつ動かし、先頭と末尾で止める', () => {
    const store = createRangeSelectionStore();
    expect(store.moveCaretBy(-1, 4)).toBe(0);
    expect(store.moveCaretBy(1, 4)).toBe(1);
    expect(store.moveCaretBy(1, 4)).toBe(2);
    store.setCaret(4, 'after');
    expect(store.moveCaretBy(1, 4)).toBe(4);
    expect(store.getState().caretPlacement).toBe('after');
  });

  it('選択中の左右移動は選択端へキャレットを畳む', () => {
    const store = createRangeSelectionStore();
    store.setSelection(2, 5);
    expect(store.moveCaretBy(-1, 8)).toBe(2);
    expect(selectedRange(store.getState())).toBeNull();
    store.setSelection(2, 5);
    expect(store.moveCaretBy(1, 8)).toBe(6);
  });

  it('選択中は選択範囲、選択なしではキャレット直後から末尾を再生範囲にする', () => {
    const store = createRangeSelectionStore();
    store.setCaret(3);
    expect(resolvePlaybackRange(store.getState(), 8)).toEqual({
      start: 3,
      end: 7,
      tracksSelection: false,
    });
    store.setSelection(6, 2);
    expect(resolvePlaybackRange(store.getState(), 8)).toEqual({
      start: 2,
      end: 6,
      tracksSelection: true,
    });
  });

  it('末尾キャレットの直後にグリッドが無ければ再生範囲を作らない', () => {
    const store = createRangeSelectionStore();
    store.setCaret(8, 'after');
    expect(resolvePlaybackRange(store.getState(), 8)).toBeNull();
  });

  it('Shift＋左右でキャレットを範囲へ伸ばし、固定側へ重ねると解除する', () => {
    const store = createRangeSelectionStore();
    store.setCaret(4);
    expect(store.extendCaretSelectionBy(-1, 8)).toBe(3);
    expect(selectedRange(store.getState())).toEqual({ start: 3, end: 3 });
    expect(store.extendCaretSelectionBy(-1, 8)).toBe(2);
    expect(selectedRange(store.getState())).toEqual({ start: 2, end: 3 });
    expect(store.extendCaretSelectionBy(1, 8)).toBe(3);
    expect(store.extendCaretSelectionBy(1, 8)).toBe(4);
    expect(selectedRange(store.getState())).toBeNull();
    expect(store.extendCaretSelectionBy(1, 8)).toBe(5);
    expect(selectedRange(store.getState())).toEqual({ start: 4, end: 4 });
  });

  it('逆向きの選択解除では最後に動かした始点側へキャレットを残す', () => {
    const store = createRangeSelectionStore();
    store.setSelection(6, 3);
    store.clearSelection();
    expect(store.getState()).toMatchObject({
      caretIndex: 3,
    });
  });

  it('たたんだ操作バーはキャレット操作では開き直さない', () => {
    const store = createRangeSelectionStore();
    store.setCaret(2);
    store.closeActionBar();
    expect(store.getState().actionBarOpen).toBe(false);
    store.setCaret(2);
    expect(store.getState().actionBarOpen).toBe(false);
    store.openActionBar();
    expect(store.getState().actionBarOpen).toBe(true);
    store.closeActionBar();
    store.reset();
    expect(store.getState().actionBarOpen).toBe(true);
  });

  it('Shift＋クリック相当の操作でキャレットから終点までを選ぶ', () => {
    const store = createRangeSelectionStore();
    store.setCaret(3);
    store.extendSelectionToGrid(4);
    expect(selectedRange(store.getState())).toEqual({ start: 3, end: 4 });
    store.extendSelectionToGrid(5);
    expect(selectedRange(store.getState())).toEqual({ start: 3, end: 5 });
    store.extendSelectionToGrid(4);
    expect(selectedRange(store.getState())).toEqual({ start: 3, end: 4 });
  });

  it('長押し直後だけ伸ばし方の案内を出し、2件以上へ伸ばした後は再表示しない', () => {
    const store = createRangeSelectionStore();
    store.startSelection(2, true);
    expect(store.getState().showExtendHint).toBe(true);
    store.setSelectionFromOriginGrid(2, 4);
    expect(store.getState()).toMatchObject({
      showExtendHint: false,
      extendHintLearned: true,
    });
    store.clearSelection();
    store.startSelection(6, true);
    expect(store.getState().showExtendHint).toBe(false);
  });

  it('長押しスライドは起点へ戻っても1件選択を保つ', () => {
    const store = createRangeSelectionStore();
    store.startSelection(4, true);
    store.setSelectionFromOriginGrid(4, 7);
    store.setSelectionFromOriginGrid(4, 4);
    expect(selectedRange(store.getState())).toEqual({ start: 4, end: 4 });
    expect(store.getState()).toMatchObject({
      showExtendHint: false,
      extendHintLearned: true,
    });
  });

  it('左右どちらの境界も動く側に切り替えられ、固定側を追い越せる', () => {
    const store = createRangeSelectionStore();
    store.setSelection(2, 5);
    store.activateSelectionBoundary(2);
    expect(store.getState()).toMatchObject({
      selectionAnchorCaretIndex: 6,
      caretIndex: 2,
    });
    store.setSelectionFromCarets(6, 8);
    expect(selectedRange(store.getState())).toEqual({ start: 6, end: 7 });
  });

  it('index購読は選択境界を含め、見た目が変わるグリッドだけへ通知する', () => {
    const store = createRangeSelectionStore();
    const inside = vi.fn();
    const outside = vi.fn();
    store.subscribeIndex(2, inside);
    store.subscribeIndex(9, outside);
    store.startSelection(2);
    inside.mockClear();
    outside.mockClear();
    store.selectIndex(4);
    // 2番は1件選択時の終点でもあったため、終端境界が外れる更新を受け取る。
    expect(inside).toHaveBeenCalledOnce();
    expect(outside).not.toHaveBeenCalled();
    store.selectIndex(9);
    expect(outside).toHaveBeenCalledOnce();
  });

  it('クリップボードを更新しても現在の選択範囲を保つ', () => {
    const store = createRangeSelectionStore();
    store.setSelection(2, 4);
    store.setClipboard([{ text: 'A' }]);
    expect(selectedRange(store.getState())).toEqual({ start: 2, end: 4 });
    expect(store.getClipboardCount()).toBe(1);
  });

  it('選択解除ではクリップボードを消さない', () => {
    const store = createRangeSelectionStore();
    store.setSelection(2, 3);
    store.setClipboard([{ text: 'A' }]);
    store.clearSelection();
    expect(store.getClipboardCount()).toBe(1);
  });

  it('グリッド数が減った場合は選択とキャレットを上限へ収める', () => {
    const store = createRangeSelectionStore();
    store.setSelection(8, 12);
    store.reconcileGridCount(9);
    expect(store.getState().caretIndex).toBe(9);
    expect(store.getState().caretPlacement).toBe('after');
  });
});
