import { afterEach, describe, expect, it, vi } from 'vitest';

import { audioEngine } from '../audioEngine.js';

const originalEngineState = {
  Tone: audioEngine.Tone,
  sampler: audioEngine.sampler,
  isReady: audioEngine.isReady,
  transposeSemitones: audioEngine.transposeSemitones,
  tempoBpm: audioEngine.tempoBpm,
  playbackSession: audioEngine.playbackSession,
  stopFallbackId: audioEngine.stopFallbackId,
  metronomeSynth: audioEngine.metronomeSynth,
  metronomeEnabled: audioEngine.metronomeEnabled,
  metronomeVolume: audioEngine.metronomeVolume,
  metronomeBeatsPerBar: audioEngine.metronomeBeatsPerBar,
  metronomeGridsPerBeat: audioEngine.metronomeGridsPerBeat,
  metronomeAccentEnabled: audioEngine.metronomeAccentEnabled,
  triggerMetronome: audioEngine.triggerMetronome,
};

function createHarness({ drawImmediately = false } = {}) {
  const once = [];
  const repeated = [];
  const persistent = [];
  const transport = {
    PPQ: 192,
    bpm: { value: 120 },
    loop: false,
    loopStart: null,
    loopEnd: null,
    stop: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    start: vi.fn(),
    scheduleOnce: vi.fn((callback, time) => once.push({ callback, time })),
    scheduleRepeat: vi.fn((callback, interval, startTime, duration) => {
      repeated.push({ callback, interval, startTime, duration });
    }),
    schedule: vi.fn((callback, time) => persistent.push({ callback, time })),
    getTicksAtTime(time) {
      return time * this.bpm.value * this.PPQ / 60;
    },
  };
  const draw = {
    cancel: vi.fn(),
    schedule: vi.fn((callback) => {
      if (drawImmediately) callback();
    }),
  };
  const context = { lookAhead: 0.1, currentTime: 0 };
  const sampler = { releaseAll: vi.fn(), triggerAttackRelease: vi.fn() };

  audioEngine.Tone = {
    Frequency: vi.fn((midi) => ({ toNote: () => `note-${midi}` })),
    getContext: () => context,
    getDraw: () => draw,
    getTransport: () => transport,
  };
  audioEngine.sampler = sampler;

  return { once, repeated, persistent, transport, draw, context, sampler };
}

function invokeGrid(repeated, position, { bpm = 120, startTicks = 0 } = {}) {
  const ticks = startTicks + position * 192;
  const seconds = ticks * 60 / (bpm * 192);
  repeated[0].callback(seconds);
}

afterEach(() => {
  audioEngine.clearStopFallback();
  Object.assign(audioEngine, originalEngineState);
});

describe('AudioEngine.schedule', () => {
  it('グリッド列を1本のtick反復イベントで予約し、表示より50ms遅く発音する', () => {
    const { repeated, persistent, draw, sampler } = createHarness();
    const onUpdateIndex = vi.fn();

    audioEngine.schedule(
      [{ keys: [0] }, { keys: [1] }],
      120,
      0,
      0,
      onUpdateIndex,
      vi.fn(),
    );

    expect(repeated).toEqual([expect.objectContaining({
      interval: '192i',
      startTime: '0i',
      duration: '384i',
    })]);
    expect(persistent).toEqual([expect.objectContaining({ time: '384i' })]);

    invokeGrid(repeated, 0);
    expect(sampler.triggerAttackRelease).toHaveBeenCalledWith(
      ['note-60'],
      0.5,
      0.05,
    );
    expect(draw.schedule).toHaveBeenCalledWith(expect.any(Function), 0);
    expect(onUpdateIndex).not.toHaveBeenCalled();

    persistent[0].callback(1);
    expect(draw.schedule).toHaveBeenLastCalledWith(expect.any(Function), 1.05);
  });

  it('2レイヤーの重複鍵を通し再生で1音にまとめる', () => {
    const { repeated, sampler } = createHarness();

    audioEngine.schedule(
      [{ keys: [0, 2], layer2Keys: [0, 1] }],
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
    );
    invokeGrid(repeated, 0);

    expect(sampler.triggerAttackRelease).toHaveBeenCalledWith(
      ['note-60', 'note-62', 'note-64'],
      0.5,
      0.05,
    );
  });

  it('ループ範囲を整数tickで設定し、ON/OFFを再予約なしで切り替える', () => {
    const { transport } = createHarness();

    audioEngine.schedule(
      [{ keys: [0] }, { keys: [1] }, { keys: [2] }, { keys: [3] }],
      120,
      0,
      1,
      vi.fn(),
      vi.fn(),
      { endIndex: 2, loop: true },
    );

    expect(transport.loopStart).toBe('0i');
    expect(transport.loopEnd).toBe('384i');
    expect(transport.loop).toBe(true);

    transport.stop.mockClear();
    transport.cancel.mockClear();
    audioEngine.disableLoop();
    expect(transport.loop).toBe(false);
    audioEngine.enableLoop();
    expect(transport.loop).toBe(true);
    expect(transport.stop).not.toHaveBeenCalled();
    expect(transport.cancel).not.toHaveBeenCalled();
  });

  it('カウントイン付きループはカウントを周回範囲へ含めない', () => {
    const { once, repeated, persistent, transport } = createHarness();

    audioEngine.schedule(
      [{ keys: [0] }, { keys: [1] }],
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
      { loop: true, countIn: { beats: 4, beatsPerBar: 4, volume: 'medium' } },
    );

    expect(once.map(({ time }) => time)).toEqual(['0i', '768i', '1536i', '2304i']);
    expect(repeated[0]).toEqual(expect.objectContaining({
      startTime: '3072i',
      duration: '384i',
    }));
    expect(persistent[0].time).toBe('3456i');
    expect(transport.loopStart).toBe('3072i');
    expect(transport.loopEnd).toBe('3456i');
  });

  it('非ループ再生は区間末尾に停止イベントを1件だけ持つ', () => {
    const { persistent } = createHarness();

    audioEngine.schedule(
      [{ keys: [0] }, { keys: [1] }, { keys: [2] }],
      120,
      0,
      1,
      vi.fn(),
      vi.fn(),
      { endIndex: 1 },
    );

    expect(persistent).toEqual([expect.objectContaining({ time: '192i' })]);
  });

  it('10,000グリッドでもTransportへの登録件数を一定に保つ', () => {
    const { once, repeated, persistent } = createHarness();

    audioEngine.schedule(
      Array.from({ length: 10_000 }, () => ({ keys: [] })),
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
    );

    expect(once).toHaveLength(0);
    expect(repeated).toHaveLength(1);
    expect(repeated[0].duration).toBe('1920000i');
    expect(persistent).toHaveLength(1);
  });

  it('メトロノームは区間先頭基準で拍とアクセントを決める', () => {
    const { repeated } = createHarness();
    const triggerMetronome = vi.fn();
    audioEngine.triggerMetronome = triggerMetronome;
    audioEngine.setMetronomeConfig({
      enabled: true,
      volume: 'high',
      beatsPerBar: 3,
      gridsPerBeat: 4,
    });

    audioEngine.schedule(
      Array.from({ length: 9 }, () => ({ keys: [] })),
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
    );
    for (let position = 0; position < 9; position += 1) {
      invokeGrid(repeated, position);
    }

    expect(triggerMetronome.mock.calls).toEqual([
      [0.05, true],
      [2.05, false],
      [4.05, false],
    ]);
  });

  it('拍で割り切れないループでも各周の先頭からクリックを数え直す', () => {
    const { repeated } = createHarness();
    const triggerMetronome = vi.fn();
    audioEngine.triggerMetronome = triggerMetronome;
    audioEngine.setMetronomeConfig({
      enabled: true,
      volume: 'medium',
      beatsPerBar: 4,
      gridsPerBeat: 4,
    });

    audioEngine.schedule(
      Array.from({ length: 6 }, () => ({ keys: [] })),
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
      { endIndex: 5, loop: true },
    );

    for (let pass = 0; pass < 3; pass += 1) {
      for (let position = 0; position < 6; position += 1) {
        invokeGrid(repeated, position);
      }
    }

    expect(triggerMetronome.mock.calls).toEqual([
      [0.05, true], [2.05, false],
      [0.05, true], [2.05, false],
      [0.05, true], [2.05, false],
    ]);
  });

  it('カウントインと本再生を同じtick位相へ予約する', () => {
    const { once, repeated } = createHarness({ drawImmediately: true });
    const triggerMetronome = vi.fn();
    audioEngine.triggerMetronome = triggerMetronome;
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
        countIn: {
          beats: 6,
          beatsPerBar: 3,
          gridsPerBeat: 4,
          volume: 'low',
          onCount,
        },
        onPlaybackStart,
      },
    );

    expect(once.map(({ time }) => time)).toEqual([
      '0i', '768i', '1536i', '2304i', '3072i', '3840i',
    ]);
    expect(repeated[0].startTime).toBe('4608i');
    once.forEach(({ callback }, index) => callback(index * 2));
    expect(onCount.mock.calls.flat()).toEqual([1, 2, 3, 1, 2, 3]);
    expect(triggerMetronome.mock.calls.map(([, accent]) => accent)).toEqual([
      true, false, false, true, false, false,
    ]);

    invokeGrid(repeated, 0, { startTicks: 4608 });
    expect(onPlaybackStart).toHaveBeenCalledOnce();
  });

  it('再生中のBPM変更をイベント再登録なしで次のtickへ反映する', () => {
    const { repeated, transport, sampler } = createHarness();

    audioEngine.schedule(
      [{ keys: [0] }, { keys: [1] }],
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
    );
    transport.stop.mockClear();
    transport.cancel.mockClear();
    transport.scheduleRepeat.mockClear();

    audioEngine.setTempo(60);
    invokeGrid(repeated, 1, { bpm: 60 });

    expect(transport.bpm.value).toBe(60);
    expect(transport.stop).not.toHaveBeenCalled();
    expect(transport.cancel).not.toHaveBeenCalled();
    expect(transport.scheduleRepeat).not.toHaveBeenCalled();
    expect(sampler.triggerAttackRelease).toHaveBeenLastCalledWith(
      ['note-62'],
      1,
      1.05,
    );
  });

  it('ループ境界の停止処理が先読み済みでも、ONなら停止せず解除後の境界で止まる', () => {
    const { persistent, transport, draw } = createHarness();
    const onStop = vi.fn();

    audioEngine.schedule(
      [{ keys: [0] }, { keys: [1] }],
      120,
      0,
      0,
      vi.fn(),
      onStop,
    );

    // Transportの先読みで末尾イベントが発火した後、Drawの実行前にループをONにする。
    persistent[0].callback(1);
    audioEngine.enableLoop();
    draw.schedule.mock.calls[0][0]();
    expect(onStop).not.toHaveBeenCalled();

    audioEngine.disableLoop();
    persistent[0].callback(2);
    draw.schedule.mock.calls[1][0]();
    expect(onStop).toHaveBeenCalledOnce();
    expect(transport.stop).toHaveBeenCalledOnce();
  });

  it('一時停止中のテンポ変更とループONでも停止位置と予約を維持する', () => {
    const { transport } = createHarness();

    audioEngine.schedule(
      [{ keys: [0] }, { keys: [1] }],
      120,
      0,
      0,
      vi.fn(),
      vi.fn(),
    );
    transport.stop.mockClear();
    transport.cancel.mockClear();
    transport.start.mockClear();

    audioEngine.pause();
    audioEngine.setTempo(90);
    audioEngine.enableLoop();
    audioEngine.resume();

    expect(transport.pause).toHaveBeenCalledOnce();
    expect(transport.bpm.value).toBe(90);
    expect(transport.loop).toBe(true);
    expect(transport.start).toHaveBeenCalledOnce();
    expect(transport.stop).not.toHaveBeenCalled();
    expect(transport.cancel).not.toHaveBeenCalled();
  });

  it('カウントイン中の拍子変更を残りのカウントへ反映する', () => {
    const { once } = createHarness({ drawImmediately: true });
    const triggerMetronome = vi.fn();
    audioEngine.triggerMetronome = triggerMetronome;
    const onCount = vi.fn();

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
          gridsPerBeat: 4,
          volume: 'low',
          onCount,
        },
      },
    );
    once[0].callback(0);
    audioEngine.setMetronomeConfig({
      enabled: false,
      volume: 'low',
      beatsPerBar: 3,
      gridsPerBeat: 4,
    });
    once.slice(1).forEach(({ callback }, index) => callback((index + 1) * 2));

    expect(onCount.mock.calls.flat()).toEqual([1, 2, 3, 1]);
    expect(triggerMetronome.mock.calls.map(([, accent]) => accent)).toEqual([
      true, false, false, true,
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
