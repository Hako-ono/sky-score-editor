import { describe, expect, it, vi } from 'vitest';
import { handleKeyboardShortcut } from './useKeyboardShortcuts.js';

function keyboardEvent(key, overrides = {}) {
  return {
    key,
    code: key === ' ' ? 'Space' : '',
    target: { tagName: 'DIV', isContentEditable: false },
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe('handleKeyboardShortcut', () => {
  it('Spaceで再生を切り替え、キーリピートでは再実行しない', () => {
    const onTogglePlayback = vi.fn();
    const event = keyboardEvent(' ');
    handleKeyboardShortcut(event, { onTogglePlayback });
    expect(onTogglePlayback).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();

    handleKeyboardShortcut(keyboardEvent(' ', { repeat: true }), { onTogglePlayback });
    expect(onTogglePlayback).toHaveBeenCalledOnce();
  });

  it('Home/EndはShiftの有無を境界移動へ渡す', () => {
    const onMoveToBoundary = vi.fn(() => true);
    handleKeyboardShortcut(keyboardEvent('Home'), { onMoveToBoundary });
    handleKeyboardShortcut(keyboardEvent('End', { shiftKey: true }), { onMoveToBoundary });
    expect(onMoveToBoundary).toHaveBeenNthCalledWith(1, false, false);
    expect(onMoveToBoundary).toHaveBeenNthCalledWith(2, true, true);
  });

  it('Ctrl/Cmd+AとCtrl/Cmd+左右を範囲操作へ割り当てる', () => {
    const onSelectAll = vi.fn(() => true);
    const onMovePhrase = vi.fn(() => true);
    handleKeyboardShortcut(keyboardEvent('a', { ctrlKey: true }), { onSelectAll });
    handleKeyboardShortcut(keyboardEvent('ArrowLeft', { metaKey: true }), { onMovePhrase });
    handleKeyboardShortcut(keyboardEvent('ArrowRight', { ctrlKey: true }), { onMovePhrase });
    expect(onSelectAll).toHaveBeenCalledOnce();
    expect(onMovePhrase).toHaveBeenNthCalledWith(1, -1);
    expect(onMovePhrase).toHaveBeenNthCalledWith(2, 1);
  });

  it('歌詞入力欄では新しい再生・移動ショートカットを発火しない', () => {
    const actions = {
      onTogglePlayback: vi.fn(),
      onMoveToBoundary: vi.fn(),
      onSelectAll: vi.fn(),
      onMovePhrase: vi.fn(),
    };
    const input = { tagName: 'TEXTAREA', isContentEditable: false };
    handleKeyboardShortcut(keyboardEvent(' ', { target: input }), actions);
    handleKeyboardShortcut(keyboardEvent('Home', { target: input }), actions);
    handleKeyboardShortcut(keyboardEvent('a', { target: input, ctrlKey: true }), actions);
    handleKeyboardShortcut(keyboardEvent('ArrowRight', { target: input, ctrlKey: true }), actions);
    Object.values(actions).forEach((callback) => expect(callback).not.toHaveBeenCalled());
  });
});
