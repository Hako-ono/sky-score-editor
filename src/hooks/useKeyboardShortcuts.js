import { useEffect } from 'react';

/**
 * キーボードショートカット。
 *  Ctrl/Cmd+Z        → undo
 *  Ctrl/Cmd+Shift+Z / Ctrl+Y → redo
 *  Ctrl/Cmd+S        → JSON 保存 (ブラウザ保存ダイアログは抑止)
 * テキスト入力中でも undo/redo はネイティブ挙動を優先させたいので、
 * 入力要素にフォーカスがあるときは undo/redo を素通りさせる。
 */
export function useKeyboardShortcuts({ onUndo, onRedo, onSave }) {
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      const target = e.target;
      const isTextField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }
      if (isTextField) return; // 入力欄では文字編集の undo を優先

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        onRedo?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onUndo, onRedo, onSave]);
}
