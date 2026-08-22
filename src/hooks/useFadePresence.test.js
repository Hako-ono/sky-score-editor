import { describe, expect, it } from 'vitest';
import { floatingFadeClassName } from './useFadePresence.js';

describe('floatingFadeClassName', () => {
  it('表示中は共通の表示クラスを返す', () => {
    expect(floatingFadeClassName(true)).toBe('floating-fade is-visible');
  });

  it('退出中はクリックを止める共通の非表示クラスを返す', () => {
    expect(floatingFadeClassName(false)).toBe('floating-fade is-hidden');
  });
});
