import { describe, expect, it } from 'vitest';

import {
  classifyPlaybackFollowTransition,
  computePlaybackFollowTarget,
} from '../playbackFollow.js';

describe('classifyPlaybackFollowTransition', () => {
  it.each([
    { previousRowIndex: 0, nextRowIndex: 0, expected: null },
    { previousRowIndex: 2, nextRowIndex: 2, expected: null },
    { previousRowIndex: -1, nextRowIndex: 0, expected: 'entry' },
    { previousRowIndex: undefined, nextRowIndex: 3, expected: 'entry' },
    { previousRowIndex: '2', nextRowIndex: 3, expected: 'entry' },
    { previousRowIndex: 1, nextRowIndex: 2, expected: 'row-change' },
    { previousRowIndex: 0, nextRowIndex: 1.5, expected: null },
    { previousRowIndex: 0, nextRowIndex: -1, expected: null },
    { previousRowIndex: 0, nextRowIndex: '1', expected: null },
    { previousRowIndex: 0, nextRowIndex: Infinity, expected: null },
  ])(
    'previous=$previousRowIndex, next=$nextRowIndex は $expected を返す',
    ({ previousRowIndex, nextRowIndex, expected }) => {
      expect(classifyPlaybackFollowTransition(previousRowIndex, nextRowIndex)).toBe(expected);
    },
  );
});

describe('computePlaybackFollowTarget', () => {
  it('初回でも行全体が現在の表示領域に収まるなら、旧安全余白の外でも移動しない', () => {
    expect(
      computePlaybackFollowTarget({
        rowTop: 100,
        rowPitch: 100,
        scrollY: 0,
        viewportHeight: 1000,
        currentHeaderBottom: 100,
        stickyHeaderHeight: 100,
        preserveIfFullyVisible: true,
      }),
    ).toBeNull();
  });

  it('初回に行の一部が再生バーの背後に隠れていると固定位置を返す', () => {
    expect(
      computePlaybackFollowTarget({
        rowTop: 550,
        rowPitch: 100,
        scrollY: 500,
        viewportHeight: 1000,
        currentHeaderBottom: 100,
        stickyHeaderHeight: 100,
        preserveIfFullyVisible: true,
      }),
    ).toBe(122);
  });

  it('初回に行が画面下へ外れていると固定位置を返す', () => {
    expect(
      computePlaybackFollowTarget({
        rowTop: 1450,
        rowPitch: 100,
        scrollY: 500,
        viewportHeight: 1000,
        currentHeaderBottom: 100,
        stickyHeaderHeight: 100,
        preserveIfFullyVisible: true,
      }),
    ).toBe(1022);
  });

  it('行変更では行が完全表示されていても固定位置を返す', () => {
    expect(
      computePlaybackFollowTarget({
        rowTop: 700,
        rowPitch: 100,
        scrollY: 0,
        viewportHeight: 1000,
        currentHeaderBottom: 100,
        stickyHeaderHeight: 100,
        preserveIfFullyVisible: false,
      }),
    ).toBe(272);
  });

  it.each([
    {
      label: 'desktop',
      rowTop: 1600,
      rowPitch: 240,
      scrollY: 400,
      viewportHeight: 900,
      currentHeaderBottom: 64,
      stickyHeaderHeight: 64,
    },
    {
      label: 'mobile',
      rowTop: 2400,
      rowPitch: 130,
      scrollY: 900,
      viewportHeight: 780,
      currentHeaderBottom: 118,
      stickyHeaderHeight: 118,
    },
  ])('$label は行の中心を表示領域の42%位置へ置く', (input) => {
    const target = computePlaybackFollowTarget({
      ...input,
      preserveIfFullyVisible: false,
    });
    const rowCenterViewportY = input.rowTop - target + input.rowPitch / 2;
    const clampedStickyHeight = Math.min(input.viewportHeight, input.stickyHeaderHeight);
    const usableHeight = input.viewportHeight - clampedStickyHeight;
    const expectedAnchor = clampedStickyHeight + usableHeight * 0.42;

    expect(rowCenterViewportY).toBeCloseTo(expectedAnchor, 10);
  });

  it('負のtargetは0へクランプする', () => {
    expect(
      computePlaybackFollowTarget({
        rowTop: 0,
        rowPitch: 100,
        scrollY: 0,
        viewportHeight: 1000,
        currentHeaderBottom: 0,
        stickyHeaderHeight: 0,
        preserveIfFullyVisible: false,
      }),
    ).toBe(0);
  });

  it('header bottomとheightをviewport内へクランプする', () => {
    expect(
      computePlaybackFollowTarget({
        rowTop: -50,
        rowPitch: 100,
        scrollY: 0,
        viewportHeight: 1000,
        currentHeaderBottom: -100,
        stickyHeaderHeight: 100,
        preserveIfFullyVisible: true,
      }),
    ).toBe(0);

    expect(
      computePlaybackFollowTarget({
        rowTop: 500,
        rowPitch: 100,
        scrollY: 0,
        viewportHeight: 1000,
        currentHeaderBottom: 2000,
        stickyHeaderHeight: -100,
        preserveIfFullyVisible: false,
      }),
    ).toBe(130);

    expect(
      computePlaybackFollowTarget({
        rowTop: 500,
        rowPitch: 100,
        scrollY: 0,
        viewportHeight: 1000,
        currentHeaderBottom: 0,
        stickyHeaderHeight: 2000,
        preserveIfFullyVisible: false,
      }),
    ).toBeNull();
  });

  it.each([
    ['rowTop', '100'],
    ['rowTop', NaN],
    ['scrollY', Infinity],
    ['currentHeaderBottom', '100'],
    ['stickyHeaderHeight', -Infinity],
    ['rowPitch', 0],
    ['rowPitch', -1],
    ['rowPitch', '100'],
    ['viewportHeight', 0],
    ['viewportHeight', -1],
    ['viewportHeight', '1000'],
  ])('%s=%s はnullを返す', (key, value) => {
    expect(
      computePlaybackFollowTarget({
        rowTop: 500,
        rowPitch: 100,
        scrollY: 0,
        viewportHeight: 1000,
        currentHeaderBottom: 0,
        stickyHeaderHeight: 0,
        preserveIfFullyVisible: false,
        [key]: value,
      }),
    ).toBeNull();
  });
});
