import { useEffect } from 'react';

/**
 * キーボードショートカット。
 *  Ctrl/Cmd+Z        → undo
 *  Ctrl/Cmd+Shift+Z / Ctrl+Y → redo
 *  Ctrl/Cmd+S        → JSON 保存 (ブラウザ保存ダイアログは抑止)
 *  Ctrl/Cmd+C/X/V    → 選択範囲のコピー／カット、キャレットへの貼り付け
 *  Delete/Backspace  → 選択範囲の削除
 *  Space             → 再生／一時停止
 *  Home/End          → 先頭／末尾（Shiftで範囲選択）
 *  Ctrl/Cmd+A        → 全グリッドを選択
 *  Ctrl/Cmd+←/→      → 前／次のフレーズ先頭へ移動
 * 入力要素では保存を除く編集・再生ショートカットを素通りさせ、
 * テキスト編集や空白入力などのネイティブ挙動を優先する。
 */
export function handleKeyboardShortcut(e, {
  onUndo,
  onRedo,
  onSave,
  onCopy,
  onCut,
  onDelete,
  onPaste,
  onTogglePlayback,
  onMoveToBoundary,
  onSelectAll,
  onMovePhrase,
}) {
  const key = e.key.toLowerCase();
  const target = e.target;
  const isTextField =
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable);

  if (!isTextField && (key === 'delete' || key === 'backspace')) {
    if (onDelete && onDelete() !== false) e.preventDefault();
    return;
  }

  const mod = e.ctrlKey || e.metaKey;
  if (mod && key === 's') {
    e.preventDefault();
    onSave?.();
    return;
  }
  if (isTextField) return;

  if (!mod && !e.altKey && (e.code === 'Space' || key === ' ')) {
    if (!e.repeat && onTogglePlayback) {
      e.preventDefault();
      onTogglePlayback();
    }
    return;
  }
  if (!mod && !e.altKey && (key === 'home' || key === 'end')) {
    if (onMoveToBoundary && onMoveToBoundary(key === 'end', e.shiftKey) !== false) {
      e.preventDefault();
    }
    return;
  }
  if (!mod) return;

  if (key === 'a') {
    if (onSelectAll && onSelectAll() !== false) e.preventDefault();
    return;
  }
  if (!e.shiftKey && !e.altKey && (key === 'arrowleft' || key === 'arrowright')) {
    if (onMovePhrase && onMovePhrase(key === 'arrowright' ? 1 : -1) !== false) {
      e.preventDefault();
    }
    return;
  }

  if (key === 'c') {
    if (onCopy && onCopy() !== false) e.preventDefault();
    return;
  }
  if (key === 'x') {
    if (onCut && onCut() !== false) e.preventDefault();
    return;
  }
  if (key === 'v') {
    if (onPaste && onPaste() !== false) e.preventDefault();
    return;
  }
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    onUndo?.();
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault();
    onRedo?.();
  }
}

export function useKeyboardShortcuts(actions) {
  const {
    onUndo,
    onRedo,
    onSave,
    onCopy,
    onCut,
    onDelete,
    onPaste,
    onTogglePlayback,
    onMoveToBoundary,
    onSelectAll,
    onMovePhrase,
  } = actions;
  useEffect(() => {
    const handler = (event) => {
      handleKeyboardShortcut(event, {
        onUndo,
        onRedo,
        onSave,
        onCopy,
        onCut,
        onDelete,
        onPaste,
        onTogglePlayback,
        onMoveToBoundary,
        onSelectAll,
        onMovePhrase,
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    onUndo,
    onRedo,
    onSave,
    onCopy,
    onCut,
    onDelete,
    onPaste,
    onTogglePlayback,
    onMoveToBoundary,
    onSelectAll,
    onMovePhrase,
  ]);
}
