import { describe, expect, it, vi } from 'vitest';
import { isDesktopRangeDragExcluded } from './useDesktopRangeDrag.js';

function caretTarget(hasHandle) {
  const caretSlot = {
    classList: { contains: vi.fn(() => hasHandle) },
  };
  return {
    caretSlot,
    target: {
      closest: vi.fn((selector) => (selector === '.caret-slot' ? caretSlot : null)),
    },
  };
}

describe('isDesktopRangeDragExcluded', () => {
  it('不可視の隙間キャレットはbuttonでも一覧ドラッグの起点にできる', () => {
    const { target } = caretTarget(false);
    expect(isDesktopRangeDragExcluded(target)).toBe(false);
    expect(target.closest).toHaveBeenCalledTimes(1);
  });

  it('表示中のキャレットは専用ドラッグへ残す', () => {
    const { target } = caretTarget(true);
    expect(isDesktopRangeDragExcluded(target)).toBe(true);
  });

  it('通常の操作ボタンは一覧ドラッグから除外する', () => {
    const button = {};
    const target = {
      closest: vi.fn((selector) => (selector === '.caret-slot' ? null : button)),
    };
    expect(isDesktopRangeDragExcluded(target)).toBe(true);
  });

  it('カード内はカード自身のクリック／ドラッグ処理へ任せる', () => {
    const card = {};
    const target = {
      closest: vi.fn((selector) => {
        if (selector === '.caret-slot') return null;
        return selector.includes('[data-grid-index]') ? card : null;
      }),
    };
    expect(isDesktopRangeDragExcluded(target)).toBe(true);
  });

  it('行の上下余白と行間はキャレット移動の対象にしない', () => {
    const canvas = {};
    const target = {
      closest: vi.fn((selector) => {
        if (selector === '.caret-slot') return null;
        return selector.includes('.score-canvas') ? canvas : null;
      }),
    };
    expect(isDesktopRangeDragExcluded(target)).toBe(true);
  });
});
