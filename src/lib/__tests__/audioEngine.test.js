import { afterEach, describe, expect, it, vi } from 'vitest';

import { audioEngine } from '../audioEngine.js';

const originalEngineState = {
  Tone: audioEngine.Tone,
  sampler: audioEngine.sampler,
  isReady: audioEngine.isReady,
  transposeSemitones: audioEngine.transposeSemitones,
  stopFallbackId: audioEngine.stopFallbackId,
  metronomeSynth: audioEngine.metronomeSynth,
  metronomeEnabled: audioEngine.metronomeEnabled,
  metronomeVolume: audioEngine.metronomeVolume,
  metronomeBeatsPerBar: audioEngine.metronomeBeatsPerBar,
  metronomeAccentEnabled: audioEngine.metronomeAccentEnabled,
};

afterEach(() => {
  audioEngine.Tone = originalEngineState.Tone;
  audioEngine.sampler = originalEngineState.sampler;
  audioEngine.isReady = originalEngineState.isReady;
  audioEngine.transposeSemitones = originalEngineState.transposeSemitones;
  audioEngine.stopFallbackId = originalEngineState.stopFallbackId;
  audioEngine.metronomeSynth = originalEngineState.metronomeSynth;
  audioEngine.metronomeEnabled = originalEngineState.metronomeEnabled;
  audioEngine.metronomeVolume = originalEngineState.metronomeVolume;
  audioEngine.metronomeBeatsPerBar = originalEngineState.metronomeBeatsPerBar;
  audioEngine.metronomeAccentEnabled = originalEngineState.metronomeAccentEnabled;
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

  it('ループは指定範囲だけを永続イベントとして登録し、解除後は範囲末尾で止める', () => {
    const once = [];
    const recurring = [];
    const transport = {
      stop: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
      schedule: vi.fn((callback, time) => recurring.push({ callback, time })),
      scheduleOnce: vi.fn((callback, time) => once.push({ callback, time })),
      loop: false,
      loopStart: null,
      loopEnd: null,
    };
    const draw = { cancel: vi.fn(), schedule: vi.fn() };
    const context = { lookAhead: 0.1, currentTime: 0 };
    audioEngine.Tone = {
      Frequency: vi.fn((midi) => ({ toNote: () => `note-${midi}` })),
      getContext: () => context,
      getDraw: () => draw,
      getTransport: () => transport,
    };
    audioEngine.sampler = { releaseAll: vi.fn(), triggerAttackRelease: vi.fn() };

    audioEngine.schedule(
      [{ keys: [0] }, { keys: [1] }, { keys: [2] }, { keys: [3] }],
      120,
      0,
      1,
      vi.fn(),
      vi.fn(),
      { endIndex: 2, loop: true },
    );

    expect(recurring.map(({ time }) => time)).toEqual([0, 0.5]);
    expect(once.map(({ time }) => time)).toEqual([1.05]);
    expect(transport.loop).toBe(true);
    expect(transport.loopStart).toBe(0);
    expect(transport.loopEnd).toBe(1);
  });

  it('カウントイン付きループはカウントを周回範囲へ含めない', () => {
    const once = [];
    const recurring = [];
    const transport = {
      stop: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
      scheduleOnce: vi.fn((callback, time) => once.push({ callback, time })),
      schedule: vi.fn((callback, time) => recurring.push({ callback, time })),
      loop: false,
      loopStart: null,
      loopEnd: null,
    };
    audioEngine.Tone = {
      Frequency: vi.fn((midi) => ({ toNote: () => `note-${midi}` })),
      getContext: () => ({ lookAhead: 0.1, currentTime: 0 }),
      getDraw: () => ({ cancel: vi.fn(), schedule: vi.fn() }),
      getTransport: () => transport,
    };
    audioEngine.sampler = { releaseAll: vi.fn(), triggerAttackRelease: vi.fn() };

    audioEngine.schedule(
      [{ keys: [0] }, { keys: [1] }],
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
      { loop: true, countIn: { beats: 4, beatsPerBar: 4, volume: 'medium' } },
    );

    expect(once.map(({ time }) => time)).toEqual([0, 2, 4, 6, 9.05]);
    expect(recurring.map(({ time }) => time)).toEqual([8, 8.5]);
    expect(transport.loopStart).toBe(8);
    expect(transport.loopEnd).toBe(9);
  });

  it('ループ解除を再生停止やイベント破棄なしでTransportへ反映する', () => {
    const transport = { loop: true };
    audioEngine.Tone = { getTransport: () => transport };

    audioEngine.disableLoop();

    expect(transport.loop).toBe(false);
  });

  it('非ループの範囲再生は範囲末尾で停止を予約する', () => {
    const scheduled = [];
    const transport = {
      stop: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
      scheduleOnce: vi.fn((callback, time) => scheduled.push({ callback, time })),
    };
    const draw = { cancel: vi.fn(), schedule: vi.fn() };
    audioEngine.Tone = {
      Frequency: vi.fn((midi) => ({ toNote: () => `note-${midi}` })),
      getContext: () => ({ lookAhead: 0.1, currentTime: 0 }),
      getDraw: () => draw,
      getTransport: () => transport,
    };
    audioEngine.sampler = { releaseAll: vi.fn(), triggerAttackRelease: vi.fn() };

    audioEngine.schedule(
      [{ keys: [0] }, { keys: [1] }, { keys: [2] }],
      120,
      0,
      1,
      vi.fn(),
      vi.fn(),
      { endIndex: 1 },
    );

    expect(scheduled).toHaveLength(2);
    expect(scheduled[0].time).toBe(0);
    expect(scheduled[1].time).toBeCloseTo(0.55);
  });

  it('メトロノームは4グリッドごとに鳴り、小節先頭だけ高くする', () => {
    const scheduled = [];
    const synth = {
      volume: { value: 0 },
      triggerAttackRelease: vi.fn(),
      toDestination() { return this; },
    };
    const transport = {
      stop: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
      scheduleOnce: vi.fn((callback, time) => scheduled.push({ callback, time })),
    };
    class SynthMock {
      constructor() { return synth; }
    }
    audioEngine.Tone = {
      Synth: SynthMock,
      Frequency: vi.fn((midi) => ({ toNote: () => `note-${midi}` })),
      getContext: () => ({ lookAhead: 0.1, currentTime: 0 }),
      getDraw: () => ({ cancel: vi.fn(), schedule: vi.fn() }),
      getTransport: () => transport,
    };
    audioEngine.sampler = { releaseAll: vi.fn(), triggerAttackRelease: vi.fn() };
    audioEngine.metronomeSynth = null;
    audioEngine.setMetronomeConfig({ enabled: true, volume: 'high', beatsPerBar: 3 });

    audioEngine.schedule(
      Array.from({ length: 9 }, () => ({ keys: [] })),
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
    );
    scheduled.slice(0, 9).forEach(({ callback }, index) => callback(10 + index * 0.5));

    expect(synth.triggerAttackRelease.mock.calls).toEqual([
      [1320, 0.045, 10.05],
      [920, 0.045, 12.05],
      [920, 0.045, 14.05],
    ]);
    expect(synth.volume.value).toBe(-10);

    synth.triggerAttackRelease.mockClear();
    scheduled.length = 0;
    audioEngine.setMetronomeConfig({ enabled: true, volume: 'high', beatsPerBar: 0 });
    audioEngine.schedule(
      Array.from({ length: 5 }, () => ({ keys: [] })),
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
    );
    scheduled.slice(0, 5).forEach(({ callback }, index) => callback(20 + index * 0.5));
    expect(synth.triggerAttackRelease.mock.calls).toEqual([
      [920, 0.045, 20.05],
      [920, 0.045, 22.05],
    ]);
  });

  it('カウントインと本再生を同じTransportへ先に予約し、音の位相を揃える', () => {
    const scheduled = [];
    const synth = {
      volume: { value: 0 },
      triggerAttackRelease: vi.fn(),
      toDestination() { return this; },
    };
    const draw = { cancel: vi.fn(), schedule: vi.fn((callback) => callback()) };
    const transport = {
      stop: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
      scheduleOnce: vi.fn((callback, time) => scheduled.push({ callback, time })),
    };
    class SynthMock {
      constructor() { return synth; }
    }
    audioEngine.Tone = {
      Synth: SynthMock,
      Frequency: vi.fn((midi) => ({ toNote: () => `note-${midi}` })),
      getContext: () => ({ lookAhead: 0.1, currentTime: 0 }),
      getDraw: () => draw,
      getTransport: () => transport,
    };
    audioEngine.sampler = { releaseAll: vi.fn(), triggerAttackRelease: vi.fn() };
    audioEngine.metronomeSynth = null;
    const onCount = vi.fn();
    const onPlaybackStart = vi.fn();

    audioEngine.schedule(
      [{ keys: [0] }],
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
      {
        countIn: { beats: 6, beatsPerBar: 3, volume: 'low', onCount },
        onPlaybackStart,
      },
    );

    expect(scheduled.map(({ time }) => time)).toEqual([0, 2, 4, 6, 8, 10, 12, 12.55]);
    scheduled.slice(0, 6).forEach(({ callback }, index) => callback(index * 2));
    expect(onCount.mock.calls.flat()).toEqual([1, 2, 3, 1, 2, 3]);
    expect(synth.triggerAttackRelease.mock.calls).toEqual([
      [1320, 0.045, 0.05],
      [920, 0.045, 2.05],
      [920, 0.045, 4.05],
      [1320, 0.045, 6.05],
      [920, 0.045, 8.05],
      [920, 0.045, 10.05],
    ]);

    scheduled[6].callback(22);
    expect(onPlaybackStart).toHaveBeenCalledOnce();
    expect(audioEngine.sampler.triggerAttackRelease).toHaveBeenCalledWith(
      ['note-60'],
      0.5,
      22.05,
    );

    scheduled.length = 0;
    synth.triggerAttackRelease.mockClear();
    const unaccentedCount = vi.fn();
    audioEngine.schedule(
      [{ keys: [] }],
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
      {
        countIn: {
          beats: 4,
          beatsPerBar: 4,
          accentEnabled: false,
          volume: 'low',
          onCount: unaccentedCount,
        },
      },
    );
    scheduled.slice(0, 4).forEach(({ callback }, index) => callback(index * 2));
    expect(unaccentedCount.mock.calls.flat()).toEqual([1, 2, 3, 4]);
    expect(synth.triggerAttackRelease.mock.calls).toEqual([
      [920, 0.045, 0.05],
      [920, 0.045, 2.05],
      [920, 0.045, 4.05],
      [920, 0.045, 6.05],
    ]);
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
