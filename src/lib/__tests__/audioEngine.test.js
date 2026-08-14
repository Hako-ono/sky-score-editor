import { afterEach, describe, expect, it, vi } from 'vitest';

import { audioEngine } from '../audioEngine.js';

const originalEngineState = {
  Tone: audioEngine.Tone,
  sampler: audioEngine.sampler,
  isReady: audioEngine.isReady,
  transposeSemitones: audioEngine.transposeSemitones,
  stopFallbackId: audioEngine.stopFallbackId,
};

afterEach(() => {
  audioEngine.Tone = originalEngineState.Tone;
  audioEngine.sampler = originalEngineState.sampler;
  audioEngine.isReady = originalEngineState.isReady;
  audioEngine.transposeSemitones = originalEngineState.transposeSemitones;
  audioEngine.stopFallbackId = originalEngineState.stopFallbackId;
});

describe('AudioEngine.schedule', () => {
  it('表示更新より50ms遅く発音し、曲末も同じ量だけ後ろへ揃える', () => {
    const scheduled = [];
    const transport = {
      stop: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
      scheduleOnce: vi.fn((callback, time) => scheduled.push({ callback, time })),
    };
    const draw = {
      cancel: vi.fn(),
      schedule: vi.fn(),
    };
    const context = { lookAhead: 0.1, currentTime: 0 };
    const sampler = {
      releaseAll: vi.fn(),
      triggerAttackRelease: vi.fn(),
    };

    audioEngine.Tone = {
      Frequency: vi.fn((midi) => ({ toNote: () => `note-${midi}` })),
      getContext: () => context,
      getDraw: () => draw,
      getTransport: () => transport,
    };
    audioEngine.sampler = sampler;

    const onUpdateIndex = vi.fn();
    audioEngine.schedule(
      [{ keys: [0] }],
      120,
      0,
      0,
      onUpdateIndex,
      vi.fn(),
    );

    expect(scheduled).toHaveLength(2);
    expect(scheduled[0].time).toBe(0);
    expect(scheduled[1].time).toBeCloseTo(0.55);

    scheduled[0].callback(10);

    expect(sampler.triggerAttackRelease).toHaveBeenCalledWith(['note-60'], 0.5, 10.05);
    expect(draw.schedule).toHaveBeenCalledWith(expect.any(Function), 10);
    expect(onUpdateIndex).not.toHaveBeenCalled();
  });

  it('2レイヤーの重複鍵を通し再生で1音にまとめる', () => {
    const scheduled = [];
    const transport = {
      stop: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
      scheduleOnce: vi.fn((callback, time) => scheduled.push({ callback, time })),
    };
    const draw = { cancel: vi.fn(), schedule: vi.fn() };
    const context = { lookAhead: 0.1, currentTime: 0 };
    const sampler = { releaseAll: vi.fn(), triggerAttackRelease: vi.fn() };

    audioEngine.Tone = {
      Frequency: vi.fn((midi) => ({ toNote: () => `note-${midi}` })),
      getContext: () => context,
      getDraw: () => draw,
      getTransport: () => transport,
    };
    audioEngine.sampler = sampler;

    audioEngine.schedule(
      [{ keys: [0, 2], layer2Keys: [0, 1] }],
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
    );

    scheduled[0].callback(10);

    expect(sampler.triggerAttackRelease).toHaveBeenCalledWith(
      ['note-60', 'note-62', 'note-64'],
      0.5,
      10.05,
    );
  });

  it('単独再生・プレビューへ重複鍵が渡っても1音にまとめる', () => {
    const sampler = { triggerAttackRelease: vi.fn() };
    audioEngine.isReady = true;
    audioEngine.sampler = sampler;
    audioEngine.Tone = {
      Frequency: vi.fn((midi) => ({ toNote: () => `note-${midi}` })),
      now: vi.fn(() => 4),
    };

    audioEngine.playGridDirect([2, 0, 2, 0], 0);

    expect(sampler.triggerAttackRelease).toHaveBeenCalledWith(
      ['note-60', 'note-64'],
      expect.any(Number),
      4.02,
    );
  });
});
