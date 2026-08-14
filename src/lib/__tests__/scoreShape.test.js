import { describe, it, expect } from 'vitest';

import { createScore, serializeScoreForCompare, SCORE_FIELDS } from '../../state/scoreShape.js';

/* ============================================================
 * score の形を1か所で定義する
 * ------------------------------------------------------------
 * これまで score を組み立てる object literal が5か所に散っており、
 * App.jsx が JSON.stringify(score) の一致で未保存判定をしていたため、
 * キーの挿入順と存在するキーの集合が「正しさ」の一部になっていた。
 * serializeScoreForCompare がキー順に依存しないことがこのテストの本体。
 * ============================================================ */

describe('createScore', () => {
  it('引数なしで9フィールドすべてを既定値で持つ', () => {
    const score = createScore();
    expect(Object.keys(score).sort()).toEqual([...SCORE_FIELDS].sort());
    expect(score.grids).toEqual([]);
    expect(score.title).toBe('');
    expect(score.pitchLevel).toBe(0);
    expect(score.keyMode).toBe('major');
    expect(score.author).toBe('');
    expect(score.lyricist).toBe('');
    expect(score.transcribedBy).toBe('');
    expect(score.bitsPerPage).toBe(16);
  });

  it('空オブジェクトを渡しても9フィールドすべてを既定値で持つ', () => {
    const score = createScore({});
    expect(Object.keys(score).sort()).toEqual([...SCORE_FIELDS].sort());
  });

  it('余分なキー（warning・未知キー）を落とす', () => {
    const score = createScore({ warning: 'x', 未知キー: 1, grids: [], bpm: 100 });
    expect(score).not.toHaveProperty('warning');
    expect(score).not.toHaveProperty('未知キー');
    expect(Object.keys(score).sort()).toEqual([...SCORE_FIELDS].sort());
    expect(score.bpm).toBe(100);
  });

  it('partial に指定した値はそのまま使われる', () => {
    const grids = [{ type: 'note', keys: [0], text: '', forceBreakAfter: false }];
    const score = createScore({
      grids,
      bpm: 140,
      title: 'タイトル',
      pitchLevel: 5,
      keyMode: 'minor',
      author: '作曲者',
      lyricist: '作詞者',
      transcribedBy: '採譜者',
      bitsPerPage: 12,
    });
    expect(score.grids).toBe(grids);
    expect(score.bpm).toBe(140);
    expect(score.title).toBe('タイトル');
    expect(score.pitchLevel).toBe(5);
    expect(score.keyMode).toBe('minor');
    expect(score.author).toBe('作曲者');
    expect(score.lyricist).toBe('作詞者');
    expect(score.transcribedBy).toBe('採譜者');
    expect(score.bitsPerPage).toBe(12);
  });
});

describe('serializeScoreForCompare', () => {
  it('キーの挿入順が違う同内容の2つのscoreに対して同じ文字列を返す', () => {
    const a = {
      grids: [],
      bpm: 120,
      title: 'A',
      pitchLevel: 0,
      keyMode: 'minor',
      author: 'B',
      lyricist: 'C',
      transcribedBy: 'D',
      bitsPerPage: 16,
    };
    // 同じ内容だがキーの挿入順を変えて組み立てる
    const b = {
      bitsPerPage: 16,
      transcribedBy: 'D',
      lyricist: 'C',
      author: 'B',
      keyMode: 'minor',
      pitchLevel: 0,
      title: 'A',
      bpm: 120,
      grids: [],
    };
    // JSON.stringify(a) !== JSON.stringify(b) であることが前提
    // （挿入順が異なれば通常のJSON.stringifyでは一致しない）
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(serializeScoreForCompare(a)).toBe(serializeScoreForCompare(b));
  });

  it('内容の違うscoreに対しては異なる文字列を返す', () => {
    const a = createScore({ title: 'A' });
    const b = createScore({ title: 'B' });
    expect(serializeScoreForCompare(a)).not.toBe(serializeScoreForCompare(b));
  });

  it('createScoreの出力同士でも、キー順が違えば同じになることを確認する', () => {
    const a = createScore({ title: 'あ', bpm: 90 });
    // 同内容をSCORE_FIELDSと逆順に組み立てる
    const b = {};
    for (let i = SCORE_FIELDS.length - 1; i >= 0; i -= 1) {
      const field = SCORE_FIELDS[i];
      b[field] = a[field];
    }
    expect(serializeScoreForCompare(a)).toBe(serializeScoreForCompare(b));
  });
});
