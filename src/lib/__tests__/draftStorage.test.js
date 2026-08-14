import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadDraft, saveDraft } from '../draftStorage.js';
import { DRAFT_STORAGE_KEY } from '../../constants/config.js';

// vite.config.js に test.environment の指定は無く、vitest は既定の node 環境で
// 動いている。localStorage が存在しないため、最小のスタブを globalThis に載せる。
function createLocalStorageStub() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

describe('loadDraft', () => {
  let originalLocalStorage;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = createLocalStorageStub();
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  it('grids が空配列の下書きに対して null を返す', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ grids: [], bpm: 120 }));
    expect(loadDraft()).toBeNull();
  });

  it('grids が1件以上ある下書きをそのまま返す', () => {
    const data = {
      grids: [{ keys: [1], layer2Keys: [2], text: '' }],
      bpm: 120,
      title: 'test',
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
    expect(loadDraft()).toEqual(data);
  });

  it('saveDraft はdraft:v3のグリッドへlayer2Keysをそのまま保存する', () => {
    const score = {
      grids: [{ keys: [1], layer2Keys: [2], text: '', forceBreakAfter: false }],
      bpm: 120,
      title: 'test',
    };

    expect(saveDraft(score)).toBe(true);
    expect(loadDraft().grids[0].layer2Keys).toEqual([2]);
  });

  it('grids が配列でない場合に null を返す（既存挙動の保護）', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ grids: 'not-an-array' }));
    expect(loadDraft()).toBeNull();
  });

  it('JSON として壊れた値に対して null を返す（既存挙動の保護）', () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, '{ this is not valid json');
    expect(loadDraft()).toBeNull();
  });
});
