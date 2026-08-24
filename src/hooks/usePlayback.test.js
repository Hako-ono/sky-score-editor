import { describe, expect, it } from 'vitest';
import { caretToken, shouldStopForRangeChange } from './usePlayback.js';

describe('caretToken', () => {
  it('位置と placement の両方が変わったことを見分けられる', () => {
    expect(caretToken({ caretIndex: 3, caretPlacement: 'before' }))
      .toBe(caretToken({ caretIndex: 3, caretPlacement: 'before' }));
    expect(caretToken({ caretIndex: 3, caretPlacement: 'before' }))
      .not.toBe(caretToken({ caretIndex: 4, caretPlacement: 'before' }));
    expect(caretToken({ caretIndex: 3, caretPlacement: 'before' }))
      .not.toBe(caretToken({ caretIndex: 3, caretPlacement: 'after' }));
  });
});

describe('shouldStopForRangeChange', () => {
  it('停止中のキャレット移動では停止しない', () => {
    expect(shouldStopForRangeChange({
      isStopped: true,
      scheduledSelection: null,
      currentSelectionToken: null,
      caretMoved: true,
    })).toBe(false);
  });

  it('再生中・一時停止中にキャレットを置き直したら停止する', () => {
    expect(shouldStopForRangeChange({
      isStopped: false,
      scheduledSelection: null,
      currentSelectionToken: null,
      caretMoved: true,
    })).toBe(true);
  });

  it('キャレットが動いていなければ再生は続く', () => {
    expect(shouldStopForRangeChange({
      isStopped: false,
      scheduledSelection: null,
      currentSelectionToken: null,
      caretMoved: false,
    })).toBe(false);
  });

  it('選択再生中に選択が変わった場合はキャレットが動いていなくても停止する', () => {
    expect(shouldStopForRangeChange({
      isStopped: false,
      scheduledSelection: '2:5',
      currentSelectionToken: '2:6',
      caretMoved: false,
    })).toBe(true);
    expect(shouldStopForRangeChange({
      isStopped: false,
      scheduledSelection: '2:5',
      currentSelectionToken: null,
      caretMoved: false,
    })).toBe(true);
  });

  it('選択再生中でも選択が同じままなら停止しない', () => {
    expect(shouldStopForRangeChange({
      isStopped: false,
      scheduledSelection: '2:5',
      currentSelectionToken: '2:5',
      caretMoved: false,
    })).toBe(false);
  });
});
