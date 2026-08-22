import { afterEach, describe, expect, it, vi } from 'vitest';
import { pinnedActionSnapshot } from './usePinnedActionBar.js';
import { focusMountedCaret, isScoreEditingFloatingFocus } from '../lib/rangeFocus.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pinnedActionSnapshot', () => {
  const actionBar = (height = 83.5) => ({
    getBoundingClientRect: vi.fn(() => ({ height })),
  });

  it('センチネルが画面下にある間は固定中として実高を返す', () => {
    expect(pinnedActionSnapshot({
      isIntersecting: false,
      boundingClientRect: { top: 800 },
      rootBounds: { bottom: 800 },
    }, actionBar())).toEqual({ stuck: true, height: 83.5 });
  });

  it('センチネルが画面内に入ると固定解除とする', () => {
    expect(pinnedActionSnapshot({
      isIntersecting: true,
      boundingClientRect: { top: 720 },
      rootBounds: { bottom: 800 },
    }, actionBar())).toEqual({ stuck: false, height: 0 });
  });

  it('センチネルが画面上へ通過した後も固定解除を維持する', () => {
    expect(pinnedActionSnapshot({
      isIntersecting: false,
      boundingClientRect: { top: -1 },
      rootBounds: { bottom: 800 },
    }, actionBar())).toEqual({ stuck: false, height: 0 });
  });

  it('非表示のアクションバーはセンチネルが下にあっても固定中に数えない', () => {
    expect(pinnedActionSnapshot({
      isIntersecting: false,
      boundingClientRect: { top: 900 },
      rootBounds: { bottom: 800 },
    }, { getBoundingClientRect: vi.fn(() => ({ height: 0 })) }))
      .toEqual({ stuck: false, height: 0 });
  });
});

describe('isScoreEditingFloatingFocus', () => {
  it('非表示対象の浮遊UI内にあるフォーカスだけを判定する', () => {
    const floating = { closest: vi.fn(() => ({})) };
    const status = { closest: vi.fn(() => null) };
    expect(isScoreEditingFloatingFocus(floating)).toBe(true);
    expect(isScoreEditingFloatingFocus(status)).toBe(false);
  });

  it('表示を続ける先頭FABはフォーカス退避の対象に含めない', () => {
    const scrollTop = {
      closest: vi.fn((selector) => (selector.includes('.scroll-top-fab') ? {} : null)),
    };
    expect(isScoreEditingFloatingFocus(scrollTop)).toBe(false);
  });
});

describe('focusMountedCaret', () => {
  it('マウント済みキャレットへスクロールさせず同期的にフォーカスできる', () => {
    const target = {
      classList: { contains: vi.fn(() => true) },
      focus: vi.fn(),
    };
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => target),
      querySelector: vi.fn(),
    });

    expect(focusMountedCaret(4, 'before', {
      defer: false,
      preventScroll: true,
    })).toBe(true);
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('仮想化でキャレットが未マウントなら失敗を返す', () => {
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => null),
      querySelector: vi.fn(() => null),
    });
    expect(focusMountedCaret(200, 'before', { defer: false })).toBe(false);
  });
});
