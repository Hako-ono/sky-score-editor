import { describe, it, expect } from 'vitest';

import { scoreReducer, initialScore } from '../../state/scoreReducer.js';
import { serializeScore, parseScoreJson } from '../parseScore.js';
import { MAX_GRIDS } from '../../constants/config.js';

/* ============================================================
 * reducer への書き込みに検証を入れる
 * ------------------------------------------------------------
 * これまで上限値のチェックは「外部ファイルを読み込む経路」
 * （parseScore.js の sanitizeText）にしかなく、reducer は
 * action の値をそのまま格納していた。曲名に300文字入れて
 * 「JSONを保存」すると、保存はできるがその同じファイルを
 * 開き直すと200文字に切られる、という往復欠損が起きる。
 * 「往復テスト」がこの一連のテストの本体。
 * ============================================================ */

describe('曲情報フィールドの文字数上限', () => {
  it('SET_TITLE に300文字入れると200文字に切られる', () => {
    const state = scoreReducer(initialScore, { type: 'SET_TITLE', title: 'a'.repeat(300) });
    expect(state.title).toHaveLength(200);
  });

  it('SET_AUTHOR に300文字入れると200文字に切られる', () => {
    const state = scoreReducer(initialScore, { type: 'SET_AUTHOR', author: 'a'.repeat(300) });
    expect(state.author).toHaveLength(200);
  });

  it('SET_LYRICIST に300文字入れると200文字に切られる', () => {
    const state = scoreReducer(initialScore, {
      type: 'SET_LYRICIST',
      lyricist: 'a'.repeat(300),
    });
    expect(state.lyricist).toHaveLength(200);
  });

  it('SET_TRANSCRIBED_BY に300文字入れると200文字に切られる', () => {
    const state = scoreReducer(initialScore, {
      type: 'SET_TRANSCRIBED_BY',
      transcribedBy: 'a'.repeat(300),
    });
    expect(state.transcribedBy).toHaveLength(200);
  });
});

describe('SET_TEXT の文字数上限', () => {
  it('150文字入れると100文字に切られる', () => {
    const state = {
      ...initialScore,
      grids: [{ type: 'empty', keys: [], text: '', forceBreakAfter: false }],
    };
    const next = scoreReducer(state, { type: 'SET_TEXT', gridIndex: 0, text: 'あ'.repeat(150) });
    expect(next.grids[0].text).toHaveLength(100);
  });
});

describe('TOGGLE_KEY は指定された絶対レイヤーだけを編集する', () => {
  const state = {
    ...initialScore,
    grids: [{
      type: 'note',
      keys: [1, 5],
      layer2Keys: [2, 5],
      text: '',
      forceBreakAfter: false,
    }],
  };

  it('レイヤー1を切り替えてもレイヤー2の所属を変えない', () => {
    const next = scoreReducer(state, {
      type: 'TOGGLE_KEY', gridIndex: 0, keyIndex: 1, layer: 1,
    });

    expect(next.grids[0].keys).toEqual([5]);
    expect(next.grids[0].layer2Keys).toEqual([2, 5]);
    expect(next.grids[0].type).toBe('note');
  });

  it('レイヤー2へ新しい鍵を追加し、既存のレイヤー1を維持する', () => {
    const next = scoreReducer(state, {
      type: 'TOGGLE_KEY', gridIndex: 0, keyIndex: 9, layer: 2,
    });

    expect(next.grids[0].keys).toEqual([1, 5]);
    expect(next.grids[0].layer2Keys).toEqual([2, 5, 9]);
  });

  it('両レイヤーの最後の鍵を片側ずつ削除してもtypeを和集合から導出する', () => {
    const oneLayer = {
      ...state,
      grids: [{ ...state.grids[0], keys: [5], layer2Keys: [] }],
    };
    const empty = scoreReducer(oneLayer, {
      type: 'TOGGLE_KEY', gridIndex: 0, keyIndex: 5, layer: 1,
    });
    expect(empty.grids[0].type).toBe('empty');

    const otherLayerRemains = scoreReducer(state, {
      type: 'TOGGLE_KEY', gridIndex: 0, keyIndex: 5, layer: 1,
    });
    expect(otherLayerRemains.grids[0].type).toBe('note');
    expect(otherLayerRemains.grids[0].layer2Keys).toEqual([2, 5]);
  });

  it.each([
    { layer: 0, keyIndex: 1 },
    { layer: 3, keyIndex: 1 },
    { layer: 1, keyIndex: -1 },
    { layer: 2, keyIndex: 15 },
    { layer: 1, keyIndex: 1.5 },
  ])('不正なlayer/keyIndexは状態を変更しない: %p', (action) => {
    const next = scoreReducer(state, { type: 'TOGGLE_KEY', gridIndex: 0, ...action });
    expect(next).toBe(state);
  });
});

describe('SET_BPM は数値でなければDEFAULT_BPM、そのうえで1〜999にクランプ', () => {
  it.each([0, Number.NaN, 10000, '120', null, undefined])(
    '%p は 1〜999 に収まる',
    (bpm) => {
      const state = scoreReducer(initialScore, { type: 'SET_BPM', bpm });
      expect(state.bpm).toBeGreaterThanOrEqual(1);
      expect(state.bpm).toBeLessThanOrEqual(999);
      expect(Number.isFinite(state.bpm)).toBe(true);
    },
  );

  it('妥当な値はそのまま保持される', () => {
    const state = scoreReducer(initialScore, { type: 'SET_BPM', bpm: 140 });
    expect(state.bpm).toBe(140);
  });
});

describe('SET_BITS_PER_PAGE は [4, 12, 16] 以外なら16にする', () => {
  it('7 は 16 になる', () => {
    const state = scoreReducer(initialScore, { type: 'SET_BITS_PER_PAGE', bitsPerPage: 7 });
    expect(state.bitsPerPage).toBe(16);
  });

  it.each([4, 12, 16])('%p はそのまま保持される', (bitsPerPage) => {
    const state = scoreReducer(initialScore, { type: 'SET_BITS_PER_PAGE', bitsPerPage });
    expect(state.bitsPerPage).toBe(bitsPerPage);
  });
});

describe('SET_KEY_MODE は major / minor だけを保持する', () => {
  it.each(['major', 'minor'])('%s はそのまま保持される', (keyMode) => {
    const state = scoreReducer(initialScore, { type: 'SET_KEY_MODE', keyMode });
    expect(state.keyMode).toBe(keyMode);
  });

  it.each(['dorian', '', null, 1])('%p は major に戻る', (keyMode) => {
    const state = scoreReducer(
      { ...initialScore, keyMode: 'minor' },
      { type: 'SET_KEY_MODE', keyMode },
    );
    expect(state.keyMode).toBe('major');
  });
});

describe('INSERT は MAX_GRIDS で頭打ちになる（編集経路からの上限突破を防ぐ最終防御）', () => {
  function makeGrids(count) {
    return Array.from({ length: count }, () => ({
      type: 'empty',
      keys: [],
      text: '',
      forceBreakAfter: false,
    }));
  }

  it('grids が MAX_GRIDS 件のとき INSERT しても件数が増えない', () => {
    const state = { ...initialScore, grids: makeGrids(MAX_GRIDS) };
    const next = scoreReducer(state, { type: 'INSERT', insertIndex: 0 });
    expect(next.grids).toHaveLength(MAX_GRIDS);
  });

  it('grids が MAX_GRIDS 件のとき INSERT は同一参照を返す（履歴を積まないことの根拠）', () => {
    const state = { ...initialScore, grids: makeGrids(MAX_GRIDS) };
    const next = scoreReducer(state, { type: 'INSERT', insertIndex: 0 });
    expect(next).toBe(state);
  });

  it('grids が MAX_GRIDS - 1 件のときは INSERT が通り MAX_GRIDS 件になる', () => {
    const state = { ...initialScore, grids: makeGrids(MAX_GRIDS - 1) };
    const next = scoreReducer(state, { type: 'INSERT', insertIndex: 0 });
    expect(next.grids).toHaveLength(MAX_GRIDS);
  });

  it('上限到達後も DELETE は通る', () => {
    const state = { ...initialScore, grids: makeGrids(MAX_GRIDS) };
    const next = scoreReducer(state, { type: 'DELETE', gridIndex: 0 });
    expect(next.grids).toHaveLength(MAX_GRIDS - 1);
  });
});

describe('往復テスト：上限を超える入力を保存→再読込しても欠損しない', () => {
  it('上限を超える曲名・作曲者・作詞者・採譜者・歌詞は、reducer で切られた時点の値のまま保存→再読込できる', () => {
    let state = { ...initialScore, grids: [{ type: 'note', keys: [0], text: '', forceBreakAfter: false }] };
    state = scoreReducer(state, { type: 'SET_TITLE', title: 'タ'.repeat(300) });
    state = scoreReducer(state, { type: 'SET_AUTHOR', author: '作'.repeat(300) });
    state = scoreReducer(state, { type: 'SET_LYRICIST', lyricist: '詞'.repeat(300) });
    state = scoreReducer(state, {
      type: 'SET_TRANSCRIBED_BY',
      transcribedBy: '採'.repeat(300),
    });
    state = scoreReducer(state, { type: 'SET_TEXT', gridIndex: 0, text: '歌'.repeat(150) });

    // reducer を経た時点で既に上限内に収まっているはず
    expect(state.title).toHaveLength(200);
    expect(state.author).toHaveLength(200);
    expect(state.lyricist).toHaveLength(200);
    expect(state.transcribedBy).toHaveLength(200);
    expect(state.grids[0].text).toHaveLength(100);

    const json = serializeScore(state);
    const reloaded = parseScoreJson(json);

    // 「JSONを保存」→「楽譜を開く」を経ても、reducer が切った時点の内容から
    // さらに欠ける（=往復で減る）ことがない
    expect(reloaded.title).toBe(state.title);
    expect(reloaded.author).toBe(state.author);
    expect(reloaded.lyricist).toBe(state.lyricist);
    expect(reloaded.transcribedBy).toBe(state.transcribedBy);
    expect(reloaded.grids[0].text).toBe(state.grids[0].text);
  });
});
