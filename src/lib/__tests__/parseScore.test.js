import { describe, it, expect } from 'vitest';

import {
  createEmptyGrid,
  decodeScoreFileBytes,
  normalizeLoadedScore,
  parseScoreJson,
  ParseError,
  serializeScore,
} from '../parseScore.js';
import {
  EDITOR_JSON_FORMAT_VERSION_V2,
  MAX_SONG_NOTES,
} from '../../constants/config.js';
import { analyzeScoreLayers, getInitialLayer } from '../scoreLayers.js';

/* ============================================================
 * 方針
 * ------------------------------------------------------------
 * このアプリが読み込む楽譜 JSON は攻撃者が自由に中身を作れる。
 * したがってテストは「正しい入力が通ること」ではなく
 * 「どんな入力でも不変条件が破れないこと」を主眼に置く。
 *
 * 仕様には「不正」としか書かれておらず、
 *   (a) ParseError を投げる
 *   (b) 既定値に丸めて受理する
 * のどちらを取るかが未確定な項目がある（bpm の NaN 等）。
 * 実装を推測しないため、そうしたケースは
 * expectRejectedOrSafe() で「投げるか、受理するなら不変条件を満たすか」
 * を検証する。どちらの実装でも通り、
 * 「範囲外の値が素通りする」ことだけは確実に落ちる。
 * ============================================================ */

const MAX_GRIDS = 3000;
const VALID_BITS = [4, 12, 16];

function tryParse(json) {
  try {
    return { ok: true, value: parseScoreJson(json) };
  } catch (error) {
    return { ok: false, error };
  }
}

const parseObj = (obj) => parseScoreJson(JSON.stringify(obj));

function encodeUtf16LeWithBom(text) {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[3 + i * 2] = code >> 8;
  }
  return bytes.buffer;
}

/** 受理された結果が満たしていなければならない不変条件のすべて */
function assertScoreInvariants(score) {
  expect(score).toBeTypeOf('object');
  expect(score).not.toBeNull();

  // bpm
  expect(Number.isFinite(score.bpm)).toBe(true);
  expect(score.bpm).toBeGreaterThanOrEqual(1);
  expect(score.bpm).toBeLessThanOrEqual(999);

  // pitchLevel
  // 実コード確認：Math.max(0, Math.min(v, 11)) によるクランプのみで、
  // 整数化はしていない（3.7 を渡すと 3.7 のまま通る）。
  // よって整数性は要求せず、範囲のみを検証する。
  if ('pitchLevel' in score) {
    expect(typeof score.pitchLevel).toBe('number');
    expect(Number.isNaN(score.pitchLevel)).toBe(false);
    expect(score.pitchLevel).toBeGreaterThanOrEqual(0);
    expect(score.pitchLevel).toBeLessThanOrEqual(11);
  }

  // bitsPerPage
  if ('bitsPerPage' in score) {
    expect(VALID_BITS).toContain(score.bitsPerPage);
  }

  expect(['major', 'minor']).toContain(score.keyMode);

  // 文字列フィールド：200文字上限・制御文字/書式文字なし
  for (const field of ['title', 'author', 'lyricist', 'transcribedBy']) {
    const v = score[field];
    if (v === undefined || v === null) continue;
    expect(v).toBeTypeOf('string');
    expect(v.length).toBeLessThanOrEqual(200);
    expect(v).not.toMatch(/[\p{Cc}\p{Cf}]/u);
  }

  // grids
  expect(Array.isArray(score.grids)).toBe(true);
  expect(score.grids.length).toBeLessThanOrEqual(MAX_GRIDS);

  for (const grid of score.grids) {
    expect(grid).toBeTypeOf('object');
    expect(grid).not.toBeNull();

    expect(Array.isArray(grid.keys)).toBe(true);
    // 注：要素ごとに expect() を呼ぶと、keys が巨大配列のとき
    // （攻撃者が送り得る）Vitest の assertion オーバーヘッドで
    // 著しく遅くなりメモリを圧迫する。.every() で集約してから
    // 1回だけ expect() する。
    const keysValid = grid.keys.every(
      (k) => Number.isInteger(k) && k >= 0 && k <= 14
    );
    expect(keysValid).toBe(true);
    expect(grid.keys.length).toBeLessThanOrEqual(15);
    expect(grid.keys.every((k, i, keys) => i === 0 || keys[i - 1] < k)).toBe(true);

    expect(Array.isArray(grid.layer2Keys)).toBe(true);
    const layer2KeysValid = grid.layer2Keys.every(
      (k) => Number.isInteger(k) && k >= 0 && k <= 14
    );
    expect(layer2KeysValid).toBe(true);
    expect(grid.layer2Keys.length).toBeLessThanOrEqual(15);
    expect(
      grid.layer2Keys.every((k, i, keys) => i === 0 || keys[i - 1] < k)
    ).toBe(true);
    expect(grid.type).toBe(
      grid.keys.length > 0 || grid.layer2Keys.length > 0 ? 'note' : 'empty'
    );

    if (grid.text !== undefined && grid.text !== null) {
      expect(grid.text).toBeTypeOf('string');
      expect(grid.text.length).toBeLessThanOrEqual(100);
      expect(grid.text).not.toMatch(/[\p{Cc}\p{Cf}]/u);
    }

    if (grid.type !== undefined) {
      expect(['note', 'empty']).toContain(grid.type);
    }
  }
}

/**
 * 「ParseError を投げる」か「受理するなら不変条件を満たす」かのどちらか。
 * 少なくとも、汚れた値が素通りすることはない。
 */
function expectRejectedOrSafe(json) {
  const r = tryParse(json);
  if (r.ok) {
    assertScoreInvariants(r.value);
    return r.value;
  }
  expect(r.error).toBeInstanceOf(ParseError);
  return null;
}

/** 必ず ParseError を投げなければならないもの */
function expectParseError(json) {
  const r = tryParse(json);
  expect(r.ok, `受理されてはならない入力が受理された: ${String(json).slice(0, 80)}`).toBe(false);
  expect(r.error).toBeInstanceOf(ParseError);
  return r.error;
}

/* ============================================================
 * 正常系
 * ============================================================ */

describe('正常系', () => {
  it('createEmptyGrid は両レイヤーの空配列を持つ', () => {
    expect(createEmptyGrid()).toEqual({
      type: 'empty',
      keys: [],
      layer2Keys: [],
      text: '',
      forceBreakAfter: false,
    });
  });

  it('BOM付きUTF-16LEの元楽譜ファイルを復号できる', () => {
    const json = JSON.stringify([
      {
        name: 'シャボン玉',
        bpm: 120,
        songNotes: [{ time: 0, key: '2Key2' }],
      },
    ]);
    const text = decodeScoreFileBytes(encodeUtf16LeWithBom(json));
    const score = parseScoreJson(text);

    expect(score.title).toBe('シャボン玉');
    expect(score.grids[0].keys).toEqual([]);
    expect(score.grids[0].layer2Keys).toEqual([2]);
  });

  it('UTF-8の元楽譜ファイルは従来どおり復号できる', () => {
    const json = JSON.stringify([{ bpm: 120, songNotes: [{ time: 0, key: '1Key4' }] }]);
    const text = decodeScoreFileBytes(new globalThis.TextEncoder().encode(json).buffer);

    expect(parseScoreJson(text).grids[0].keys).toEqual([4]);
  });

  it('形式1：元楽譜形式（songNotes 配列）を解釈できる', () => {
    const score = parseObj([
      {
        name: 'Test Song',
        bpm: 120,
        songNotes: [
          { time: 0, key: '1Key0' },
          { time: 500, key: '1Key7' },
          { time: 1000, key: '1Key14' },
        ],
      },
    ]);

    assertScoreInvariants(score);
    expect(score.bpm).toBe(120);
    expect(score.lyricist).toBe('');
    expect(score.grids.length).toBeGreaterThan(0);

    // 0 / 7 / 14 がすべて拾えていること
    const allKeys = score.grids.flatMap((g) => g.keys);
    expect(allKeys).toContain(0);
    expect(allKeys).toContain(7);
    expect(allKeys).toContain(14);
  });

  it('形式1：1KeyN と 2KeyN を別レイヤーとして保持する', () => {
    const score = parseObj([
      {
        bpm: 120,
        songNotes: [
          { time: 0, key: '2Key0' },
          { time: 0, key: '2Key2' },
          { time: 0, key: '1Key2' },
          { time: 0, key: '1Key4' },
          { time: 0, key: '1Key7' },
        ],
      },
    ]);

    assertScoreInvariants(score);
    expect(score.grids).toHaveLength(1);
    expect(score.grids[0].keys).toEqual([2, 4, 7]);
    expect(score.grids[0].layer2Keys).toEqual([0, 2]);
    expect(score.warning).toBe('');
  });

  it('元レイヤー2だけの元形式は2レイヤー目のみを使い、初期選択2になる', () => {
    const score = parseObj([
      { bpm: 120, songNotes: [{ time: 0, key: '2Key9' }] },
    ]);

    expect(analyzeScoreLayers(score.grids)).toEqual({
      hasLayer1: false,
      hasLayer2: true,
      usesTwoLayers: false,
    });
    expect(getInitialLayer(score.grids)).toBe(2);
  });

  it('形式2：エディタ形式を解釈できる', () => {
    const score = parseObj({
      formatVersion: 'sky-editor-v1',
      title: 'タイトル',
      author: '作曲者',
      lyricist: '作詞者',
      transcribedBy: '採譜者',
      bpm: 90,
      bitsPerPage: 12,
      pitchLevel: 3,
      keyMode: 'minor',
      grids: [
        { type: 'note', keys: [0, 5], text: 'あ', forceBreakAfter: false },
        { type: 'empty', keys: [], text: '', forceBreakAfter: true },
      ],
    });

    assertScoreInvariants(score);
    expect(score.title).toBe('タイトル');
    expect(score.author).toBe('作曲者');
    expect(score.lyricist).toBe('作詞者');
    expect(score.transcribedBy).toBe('採譜者');
    expect(score.bpm).toBe(90);
    expect(score.bitsPerPage).toBe(12);
    expect(score.pitchLevel).toBe(3);
    expect(score.keyMode).toBe('minor');
    expect(score.grids).toHaveLength(2);
    expect(score.grids[0].keys).toEqual([0, 5]);
  });

  it('編集JSON v1はlayer2Keysを元レイヤー1へ混ぜず無視する', () => {
    const score = parseObj({
      formatVersion: 'sky-editor-v1',
      bpm: 120,
      grids: [{ type: 'note', keys: [1], layer2Keys: [2], text: '', forceBreakAfter: false }],
    });

    expect(score.grids[0].keys).toEqual([1]);
    expect(score.grids[0].layer2Keys).toEqual([]);
  });

  it('編集JSON v2は両レイヤーを正規化して読み込む', () => {
    const score = parseObj({
      formatVersion: EDITOR_JSON_FORMAT_VERSION_V2,
      bpm: 120,
      grids: [
        { type: 'empty', keys: [3, 3], layer2Keys: [7, 2, 7], text: '', forceBreakAfter: false },
        { type: 'empty', keys: [], layer2Keys: [4], text: '', forceBreakAfter: false },
      ],
    });

    expect(score.grids).toEqual([
      { type: 'note', keys: [3], layer2Keys: [2, 7], text: '', forceBreakAfter: false },
      { type: 'note', keys: [], layer2Keys: [4], text: '', forceBreakAfter: false },
    ]);
  });

  it('旧下書き形式を正規化するとlayer2Keysが空配列になる', () => {
    const score = normalizeLoadedScore({
      bpm: 120,
      grids: [{ type: 'note', keys: [1], text: '', forceBreakAfter: false }],
    });

    expect(score.grids[0].layer2Keys).toEqual([]);
    expect(score.lyricist).toBe('');
    expect(score.keyMode).toBe('major');
  });
});

/* ============================================================
 * 異常系・敵対的入力
 * ============================================================ */

describe('入力そのものが JSON として成立しない', () => {
  it('01. 空文字列は ParseError', () => {
    expectParseError('');
  });

  it('02. 途中で切れた JSON は ParseError（内部の SyntaxError を漏らさない）', () => {
    const err = expectParseError('{"formatVersion":"sky-editor-v1","grids":[');
    expect(err).not.toBeInstanceOf(SyntaxError);
  });

  it('03. JSON トップレベルがプリミティブなら ParseError', () => {
    for (const json of ['null', 'true', '0', '"sky-editor-v1"', '[]"']) {
      expectParseError(json);
    }
  });

  it('04. 引数が文字列でない場合も例外の型は ParseError', () => {
    for (const bad of [undefined, null, 42, {}, [], Symbol('x')]) {
      const r = tryParse(bad);
      expect(r.ok).toBe(false);
      expect(r.error).toBeInstanceOf(ParseError);
    }
  });

  it('05. エラーメッセージに入力の生データを埋め込まない（表示文言の偽装防止）', () => {
    const payload = 'この楽譜は公式に認証されています。パスワードを入力してください';
    const err = expectParseError(JSON.stringify({ formatVersion: 'evil', title: payload }));
    expect(String(err.message)).not.toContain(payload);
  });
});

describe('keys（0〜14 の整数のみ）', () => {
  it('06. 範囲外・非整数・非数値は除外される', () => {
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        bitsPerPage: 16,
        pitchLevel: 0,
        grids: [
          {
            type: 'note',
            keys: [-1, 0, 3.5, 14, 15, 100, -0.0001, 1e309, '5', null, true, [], {}],
            text: '',
            forceBreakAfter: false,
          },
        ],
      })
    );
    if (!score) return;
    expect(score.grids[0].keys).toEqual([0, 14]);
  });

  it('07. JSON 由来の NaN/Infinity 表現（1e999, -1e999）を通さない', () => {
    expectRejectedOrSafe(
      '{"formatVersion":"sky-editor-v1","bpm":120,"grids":[{"type":"note","keys":[1e999,-1e999,7],"text":"","forceBreakAfter":false}]}'
    );
  });

  it('08. keys が配列でない（文字列・数値・オブジェクト）', () => {
    for (const keys of ['0123456789', 7, { 0: 1, length: 1 }, null]) {
      expectRejectedOrSafe(
        JSON.stringify({
          formatVersion: 'sky-editor-v1',
          bpm: 120,
          grids: [{ type: 'note', keys, text: '', forceBreakAfter: false }],
        })
      );
    }
  });

  it('09. keys が巨大配列でもキー数が 15 を超えて残らない（重複キーを含む）', () => {
    const keys = Array.from({ length: 100000 }, (_, i) => i % 20);
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        grids: [{ type: 'note', keys, text: '', forceBreakAfter: false }],
      })
    );
    if (!score) return;
    // 要確認：重複除去まで仕様に含めるかは未確定。
    // ここでは「0〜14 の整数以外が残らない」ことのみを保証する。
    // 注：巨大配列に対して要素ごとに expect() を呼ぶと Vitest の
    // オーバーヘッドで著しく遅くなる（実測: OOM に至った）ため、
    // .every() で集約してから 1回だけ expect() する。
    const allValid = score.grids[0].keys.every(
      (k) => Number.isInteger(k) && k >= 0 && k <= 14
    );
    expect(allValid).toBe(true);
  });

  it('10. 形式1の key 文字列の偽装（範囲外・未対応レイヤー・大小文字違い等）', () => {
    // 注：正規表現は /^[12]Key(\d+)$/ なので "1Key007" は parseInt により
    // 7 として有効に扱われる（先頭ゼロは許容）。これは仕様通りであり、
    // このテストでは「0〜14 の整数以外が残らないこと」だけを検証する。
    const score = expectRejectedOrSafe(
      JSON.stringify([
        {
          bpm: 120,
          songNotes: [
            { time: 0, key: '1Key15' },
            { time: 100, key: '1Key-1' },
            { time: 200, key: '2Key15' },
            { time: 300, key: '3Key0' },
            { time: 400, key: '2key0' },
            { time: 500, key: '1Key007' },
            { time: 600, key: '1KeyNaN' },
            { time: 700, key: '1Key' },
            { time: 800, key: '' },
            { time: 900, key: null },
            { time: 1000, key: { toString: '1Key0' } },
            { time: 1100, key: '1Key3' },
          ],
        },
      ])
    );
    if (!score) return;
    const allKeys = score.grids.flatMap((g) => g.keys);
    for (const k of allKeys) {
      expect(Number.isInteger(k) && k >= 0 && k <= 14).toBe(true);
    }
    expect(allKeys).not.toContain(15);
    expect(score.warning).toContain('10 個の無効なノートをスキップしました。');
  });

  it('11. 形式1の time が負・NaN 表現・巨大値・文字列でも破綻しない', () => {
    // 注：1e999 は JS リテラルの時点で Infinity になり、
    // JSON.stringify(Infinity) は仕様上 null に変換される。
    // つまりこのケースは「time: null」として送られるが、
    // 結果的に無効ノートとして扱われるかは同じなので有効なテストのまま。
    for (const time of [-1, 1e999, '0', null, 9007199254740993]) {
      expectRejectedOrSafe(
        JSON.stringify([{ bpm: 120, songNotes: [{ time, key: '1Key0' }] }])
      );
    }
  });

  it('12. songNotes が配列でない／欠落している', () => {
    for (const songNotes of [undefined, null, 'x', 0, {}]) {
      expectRejectedOrSafe(JSON.stringify([{ bpm: 120, songNotes }]));
    }
  });
});

describe('bpm（1〜999 にクランプ）', () => {
  it('13. 0以下・NaN・Infinity・非数値は不正として扱われる', () => {
    for (const bpm of [0, -1, -999, null, 'a', '120', {}, [], true]) {
      expectRejectedOrSafe(
        JSON.stringify({ formatVersion: 'sky-editor-v1', bpm, grids: [] })
      );
    }
    // NaN / Infinity は JSON リテラルとして書けないので生の JSON で送る
    expectRejectedOrSafe('{"formatVersion":"sky-editor-v1","bpm":1e999,"grids":[]}');
    expectRejectedOrSafe('{"formatVersion":"sky-editor-v1","bpm":-1e999,"grids":[]}');
  });

  it('14. 上振れはクランプされる（999 を超えない）', () => {
    const score = expectRejectedOrSafe(
      JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 1000000, grids: [] })
    );
    if (score) expect(score.bpm).toBe(999);
  });

  it('15. JSON の重複キーで後勝ちを狙う攻撃（bpm を二度書く）', () => {
    // 検証を通した後の値が採用される実装だと 0 が残りうる
    expectRejectedOrSafe('{"formatVersion":"sky-editor-v1","bpm":120,"bpm":0,"grids":[]}');
  });
});

describe('pitchLevel / bitsPerPage', () => {
  it('16. pitchLevel は 0〜11 にクランプされる', () => {
    for (const pitchLevel of [-1, -100, 12, 99, 3.7, '5', null, 1e999]) {
      expectRejectedOrSafe(
        JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, pitchLevel, grids: [] })
      );
    }
  });

  it('17. bitsPerPage は 4/12/16 以外なら 16 に丸められる', () => {
    for (const bitsPerPage of [0, -16, 8, 15.9, 1000, '16', null, true, 1e999]) {
      const score = expectRejectedOrSafe(
        JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, bitsPerPage, grids: [] })
      );
      if (score) expect(score.bitsPerPage).toBe(16);
    }
  });

  it('18. 妥当な 4/12/16 はそのまま保持される', () => {
    for (const bits of VALID_BITS) {
      const score = expectRejectedOrSafe(
        JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, bitsPerPage: bits, grids: [] })
      );
      if (score) expect(score.bitsPerPage).toBe(bits);
    }
  });
});

describe('keyMode', () => {
  it('major / minor は保持し、欠落・不正値は major に戻す', () => {
    for (const keyMode of ['major', 'minor']) {
      const score = parseObj({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        keyMode,
        grids: [],
      });
      expect(score.keyMode).toBe(keyMode);
    }

    for (const keyMode of ['dorian', '', null, 1, {}, []]) {
      const score = parseObj({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        keyMode,
        grids: [],
      });
      expect(score.keyMode).toBe('major');
    }
  });
});

describe('grids 上限 3000', () => {
  it('19. 3001件は 3000件に切り詰められる', () => {
    const grids = Array.from({ length: 3001 }, () => ({
      type: 'note',
      keys: [0],
      text: '',
      forceBreakAfter: false,
    }));
    const score = expectRejectedOrSafe(
      JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, grids })
    );
    if (score) expect(score.grids).toHaveLength(MAX_GRIDS);
  });

  it('20. 境界値：3000件はそのまま通る', () => {
    const grids = Array.from({ length: 3000 }, () => ({
      type: 'note',
      keys: [0],
      text: '',
      forceBreakAfter: false,
    }));
    const score = expectRejectedOrSafe(
      JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, grids })
    );
    if (score) expect(score.grids).toHaveLength(3000);
  });

  it('21. grids が配列でない／要素が null や配列', () => {
    for (const grids of [null, 'x', 0, {}, { length: 5 }]) {
      expectRejectedOrSafe(JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, grids }));
    }
    expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        grids: [null, 0, 'note', [], { type: 'note', keys: [0] }],
      })
    );
  });

  it('22. type が note/empty 以外、forceBreakAfter が非 boolean', () => {
    expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        grids: [
          { type: 'script', keys: [0], text: '', forceBreakAfter: 'true' },
          { type: null, keys: [0], text: '', forceBreakAfter: 1 },
          { keys: [0], text: '', forceBreakAfter: {} },
        ],
      })
    );
  });
});

describe('文字列フィールドの汚染', () => {
  it('23. title/author/lyricist/transcribedBy は 200文字上限', () => {
    const long = 'あ'.repeat(5000);
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        title: long,
        author: long,
        lyricist: long,
        transcribedBy: long,
        grids: [],
      })
    );
    if (score) {
      expect(score.title.length).toBe(200);
      expect(score.author.length).toBe(200);
      expect(score.lyricist.length).toBe(200);
      expect(score.transcribedBy.length).toBe(200);
    }
  });

  it('24. 制御文字・ゼロ幅文字・双方向制御文字（RLO）を除去する', () => {
    const dirty = 'A\u0000B\nC\tD\u200BE\u202EF\uFEFFG\u001BH';
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        title: dirty,
        author: dirty,
        lyricist: dirty,
        transcribedBy: dirty,
        grids: [{ type: 'note', keys: [0], text: dirty, forceBreakAfter: false }],
      })
    );
    if (score) {
      expect(score.title).toBe('ABCDEFGH');
      expect(score.lyricist).toBe('ABCDEFGH');
      expect(score.grids[0].text).toBe('ABCDEFGH');
    }
  });

  it('25. 改行を使った偽の警告文の注入（表示欄の乗っ取り）', () => {
    const fake = '正規の楽譜\n\n【警告】このアプリは古いです。更新版は http://evil.example から';
    const score = expectRejectedOrSafe(
      JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, title: fake, grids: [] })
    );
    if (score) expect(score.title).not.toMatch(/[\r\n]/);
  });

  it('26. title 等が文字列でない（数値・オブジェクト・配列・関数風）', () => {
    for (const title of [123, null, [], { toString: 'x' }, true]) {
      expectRejectedOrSafe(
        JSON.stringify({
          formatVersion: 'sky-editor-v1',
          bpm: 120,
          title,
          lyricist: title,
          grids: [],
        })
      );
    }
  });

  it('27. 各グリッドの text は 100文字上限', () => {
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        grids: [{ type: 'note', keys: [0], text: 'x'.repeat(10000), forceBreakAfter: false }],
      })
    );
    if (score) expect(score.grids[0].text.length).toBe(100);
  });

  it('28. text が非文字列でも文字列以外を返さない', () => {
    for (const text of [0, null, [], {}, true]) {
      expectRejectedOrSafe(
        JSON.stringify({
          formatVersion: 'sky-editor-v1',
          bpm: 120,
          grids: [{ type: 'note', keys: [0], text, forceBreakAfter: false }],
        })
      );
    }
  });
});

describe('warning 素通しの遮断', () => {
  it('29. トップレベルの warning は絶対に採用しない', () => {
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        warning: 'この楽譜は公式に検証済みです。安心してご利用ください',
        grids: [],
      })
    );
    if (score && score.warning !== undefined) {
      expect(score.warning).not.toContain('公式に検証済み');
    }
  });

  it('30. 各グリッドや入れ子に仕込んだ warning も採用しない', () => {
    const payload = '偽の警告テキスト';
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        warnings: [payload],
        meta: { warning: payload },
        grids: [{ type: 'note', keys: [0], text: '', forceBreakAfter: false, warning: payload }],
      })
    );
    if (score) {
      expect(JSON.stringify(score)).not.toContain(payload);
    }
  });

  it('31. 形式1（配列）側に warning を紛れ込ませても採用しない', () => {
    const payload = 'DO_NOT_SHOW_ME';
    const score = expectRejectedOrSafe(
      JSON.stringify([
        { bpm: 120, warning: payload, songNotes: [{ time: 0, key: '1Key0' }] },
      ])
    );
    if (score) expect(JSON.stringify(score)).not.toContain(payload);
  });
});

describe('構造的な攻撃', () => {
  it('32. __proto__ / constructor / prototype によるプロトタイプ汚染', () => {
    const json =
      '{"formatVersion":"sky-editor-v1","bpm":120,"grids":[],' +
      '"__proto__":{"polluted":"yes"},' +
      '"constructor":{"prototype":{"polluted2":"yes"}}}';
    tryParse(json);
    expect({}.polluted).toBeUndefined();
    expect({}.polluted2).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it('33. grid 単位でのプロトタイプ汚染', () => {
    const json =
      '{"formatVersion":"sky-editor-v1","bpm":120,"grids":[' +
      '{"type":"note","keys":[0],"text":"","forceBreakAfter":false,' +
      '"__proto__":{"forceBreakAfter":true}}]}';
    tryParse(json);
    expect({}.forceBreakAfter).toBeUndefined();
  });

  it('34. formatVersion の偽装・欠落・型違い', () => {
    for (const formatVersion of [
      'sky-editor-v3',
      'SKY-EDITOR-V1',
      'sky-editor-v1\u0000',
      ' sky-editor-v1',
      '',
      null,
      1,
      { toString: 'sky-editor-v1' },
    ]) {
      expectRejectedOrSafe(JSON.stringify({ formatVersion, bpm: 120, grids: [] }));
    }
  });

  it('35. 深いネストで再帰的処理を狙う（スタック枯渇させない）', () => {
    const depth = 20000;
    const json =
      '{"formatVersion":"sky-editor-v1","bpm":120,"grids":[],"junk":' +
      '['.repeat(depth) +
      ']'.repeat(depth) +
      '}';
    const r = tryParse(json);
    if (!r.ok) expect(r.error).toBeInstanceOf(ParseError);
  }, 10000);

  it('36. 形式1と形式2を混在させた曖昧な入力', () => {
    expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        songNotes: [{ time: 0, key: '1Key0' }],
        grids: [{ type: 'note', keys: [14], text: '', forceBreakAfter: false }],
      })
    );
  });

  it('37. 空の grids／空の配列トップレベルでも例外の型は ParseError に統一される', () => {
    const r1 = tryParse(JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, grids: [] }));
    if (!r1.ok) expect(r1.error).toBeInstanceOf(ParseError);
    const r2 = tryParse('[]');
    if (!r2.ok) expect(r2.error).toBeInstanceOf(ParseError);
  });

  it('38. 同じ入力を二度解析しても結果が変わらない（内部状態を持たない）', () => {
    const json = JSON.stringify({
      formatVersion: 'sky-editor-v1',
      bpm: 120,
      keyMode: 'minor',
      bitsPerPage: 12,
      pitchLevel: 3,
      title: 'A',
      grids: [{ type: 'note', keys: [0, 20, 5], text: 'x', forceBreakAfter: false }],
    });
    const a = tryParse(json);
    const b = tryParse(json);
    expect(a.ok).toBe(b.ok);
    if (a.ok) expect(a.value).toEqual(b.value);
  });
});

/* ============================================================
 * 信頼境界: songNotes からのグリッド生成量の打ち切り（生成中）
 * ============================================================ */

describe('songNotes からのグリッド生成量の打ち切り', () => {
  it('39. 5000コードを64スロットずつ離して配置してもMAX_GRIDSに切り詰められる', () => {
    const bpm = 120;
    const gridDurationMs = 60000 / bpm;
    // 1コード目は time:0 で previousTime との差分が出ないようにし、
    // 2コード目以降を64スロット超離すことで chordsToGrids に
    // 1コードあたり最大64個の空グリッドを積ませる。
    // 65件×5000コード分をすべて作りきってから切り詰める実装だと
    // このテスト自体が極めて重くなるため、打ち切り自体を確認する。
    const songNotes = Array.from({ length: 5000 }, (_, i) => ({
      time: i * gridDurationMs * 66,
      key: '1Key0',
    }));
    const score = expectRejectedOrSafe(JSON.stringify([{ bpm, songNotes }]));
    if (!score) return;
    expect(score.grids).toHaveLength(MAX_GRIDS);
  });

  it('40. 同上の入力で「上限を超えたため切り詰めました」の警告が出る（既存の警告経路が保たれていること）', () => {
    const bpm = 120;
    const gridDurationMs = 60000 / bpm;
    const songNotes = Array.from({ length: 5000 }, (_, i) => ({
      time: i * gridDurationMs * 66,
      key: '1Key0',
    }));
    const score = expectRejectedOrSafe(JSON.stringify([{ bpm, songNotes }]));
    if (!score) return;
    expect(score.warning).toContain('グリッド数が上限(3000)を超えたため切り詰めました。');
  });
});

describe('songNotes の入力件数上限', () => {
  it('上限ちょうどの有効なノートは受理し、同一コードへ正規化する', () => {
    const songNotes = Array.from({ length: MAX_SONG_NOTES }, (_, i) => ({
      time: 0,
      key: `1Key${i % 15}`,
    }));
    const score = parseObj([{ bpm: 120, songNotes }]);

    expect(score.grids).toHaveLength(1);
    expect(score.grids[0].keys).toEqual(Array.from({ length: 15 }, (_, i) => i));
  });

  it('上限を1件超えた入力は固定メッセージで拒否する', () => {
    const songNotes = Array.from({ length: MAX_SONG_NOTES + 1 }, () => ({
      time: 0,
      key: '1Key0',
    }));
    const error = expectParseError(JSON.stringify([{ bpm: 120, songNotes }]));

    expect(error.message).toBe('songNotes の件数が上限（50000件）を超えています。');
  });

  it('全件無効でも上限超過を先に検出する', () => {
    const songNotes = Array.from({ length: MAX_SONG_NOTES + 1 }, () => null);
    const error = expectParseError(JSON.stringify([{ bpm: 120, songNotes }]));

    expect(error.message).toBe('songNotes の件数が上限（50000件）を超えています。');
  });

  it('エディタ形式の余分な songNotes はこの上限の対象にしない', () => {
    const score = parseObj({
      formatVersion: 'sky-editor-v1',
      bpm: 120,
      songNotes: Array.from({ length: MAX_SONG_NOTES + 1 }, () => null),
      grids: [{ type: 'note', keys: [0], text: '', forceBreakAfter: false }],
    });

    expect(score.grids).toHaveLength(1);
    expect(score.grids[0].keys).toEqual([0]);
  });
});

/* ============================================================
 * keys の重複除去（1パスで既出判定しながら集める）
 * ============================================================ */

/* ============================================================
 * grids / sanitizeText の1パス打ち切り
 * ============================================================ */

describe('grids の1パス打ち切り（正規化しながらMAX_GRIDS+1で走査を止める）', () => {
  it('44. 5000件すべて有効なら3000件に切り詰められ、上限超過の警告が出る', () => {
    const grids = Array.from({ length: 5000 }, () => ({
      type: 'note',
      keys: [0],
      text: '',
      forceBreakAfter: false,
    }));
    const score = expectRejectedOrSafe(
      JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, grids })
    );
    if (!score) return;
    expect(score.grids).toHaveLength(MAX_GRIDS);
    expect(score.warning).toContain(`グリッド数が上限(${MAX_GRIDS})を超えたため切り詰めました。`);
  });

  it('45. 先頭のnull/数値/文字列はカウントされずに読み飛ばされ、後続の有効なグリッドが3000件揃う', () => {
    // null / 0 / 'note' は typeof が 'object' でないため読み飛ばされ、3001件の
    // カウントに含まれない。先に3001件で切ってから非オブジェクトを除く実装だと、
    // その分だけ有効なグリッドが目減りして3000件に届かなくなる（このテストで検出できる）。
    // [] は typeof が 'object' の配列であり、既存テスト21と同じ扱いで有効な
    // （keysを持たない）グリッド1件としてカウントされる。
    const junk = [null, 0, 'note', []];
    const grids = [
      ...junk,
      ...Array.from({ length: 5000 }, () => ({
        type: 'note',
        keys: [0],
        text: '',
        forceBreakAfter: false,
      })),
    ];
    const score = expectRejectedOrSafe(
      JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, grids })
    );
    if (!score) return;
    expect(score.grids).toHaveLength(MAX_GRIDS);
    const noteCount = score.grids.filter(
      (g) => g.keys.length === 1 && g.keys[0] === 0
    ).length;
    // [] 由来の空グリッド1件を除いた残り2999件が note グリッドであること
    expect(noteCount).toBe(MAX_GRIDS - 1);
  });
});

describe('sanitizeText のチャンク単位打ち切り', () => {
  it('46. 制御文字と通常文字を交互に5000文字並べても200文字上限の結果は変わらない', () => {
    let dirty = '';
    for (let i = 0; i < 5000; i += 1) {
      dirty += i % 2 === 0 ? '\u0000' : 'A';
    }
    const score = expectRejectedOrSafe(
      JSON.stringify({ formatVersion: 'sky-editor-v1', bpm: 120, title: dirty, grids: [] })
    );
    if (!score) return;
    expect(score.title.length).toBe(200);
    expect(score.title).toBe('A'.repeat(200));
  });
});

describe('type/keys の優先順位（keysを唯一の根拠とする）', () => {
  it('47. type:"empty" でも keys が非空なら note として keys を保持する', () => {
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        grids: [{ type: 'empty', keys: [0, 1, 2], text: '', forceBreakAfter: false }],
      })
    );
    if (!score) return;
    expect(score.grids[0].type).toBe('note');
    expect(score.grids[0].keys).toEqual([0, 1, 2]);
  });

  it('48. type:"note" でも keys が空なら empty になる', () => {
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        grids: [{ type: 'note', keys: [], text: '', forceBreakAfter: false }],
      })
    );
    if (!score) return;
    expect(score.grids[0].type).toBe('empty');
    expect(score.grids[0].keys).toEqual([]);
  });

  it('49. 読み込み→保存→再読み込みで内容が一致する（往復）', () => {
    const score1 = parseObj({
      formatVersion: 'sky-editor-v1',
      bpm: 120,
      keyMode: 'minor',
      grids: [
        { type: 'empty', keys: [3, 7], text: 'x', forceBreakAfter: true },
        { type: 'note', keys: [], text: '', forceBreakAfter: false },
      ],
    });
    const serialized = serializeScore(score1);
    expect(JSON.parse(serialized).formatVersion).toBe('sky-editor-v1');
    const score2 = parseScoreJson(serialized);
    expect(score2.grids).toEqual(score1.grids);
    expect(score2.keyMode).toBe('minor');
  });

  it('編集JSON v2は保存時に全グリッドのlayer2Keysを配列で出力し、往復できる', () => {
    const score1 = parseObj({
      formatVersion: EDITOR_JSON_FORMAT_VERSION_V2,
      bpm: 120,
      grids: [
        { type: 'note', keys: [1], layer2Keys: [2], text: '', forceBreakAfter: false },
        { type: 'note', keys: [3], layer2Keys: [], text: '', forceBreakAfter: false },
      ],
    });
    const payload = JSON.parse(serializeScore(score1));

    expect(payload.formatVersion).toBe(EDITOR_JSON_FORMAT_VERSION_V2);
    expect(payload.grids.every((grid) => Array.isArray(grid.layer2Keys))).toBe(true);
    expect(parseScoreJson(JSON.stringify(payload))).toEqual(score1);
  });

  it('v2からlayer2Keysがすべて空になると保存形式はv1へ戻る', () => {
    const score = parseObj({
      formatVersion: EDITOR_JSON_FORMAT_VERSION_V2,
      bpm: 120,
      grids: [{ type: 'note', keys: [1], layer2Keys: [2], text: '', forceBreakAfter: false }],
    });
    const withoutLayer2 = {
      ...score,
      grids: score.grids.map((grid) => ({ ...grid, layer2Keys: [] })),
    };
    const payload = JSON.parse(serializeScore(withoutLayer2));

    expect(payload.formatVersion).toBe('sky-editor-v1');
    expect(payload.grids[0]).not.toHaveProperty('layer2Keys');
  });
});

describe('keys の重複除去', () => {
  it('41. 重複したkeysは1回だけ残り、ソートされる', () => {
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        grids: [{ type: 'note', keys: [3, 3, 1, 1, 3], text: '', forceBreakAfter: false }],
      })
    );
    if (!score) return;
    expect(score.grids[0].keys).toEqual([1, 3]);
  });

  it('layer2Keysも重複除去・範囲検証・昇順化される', () => {
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: EDITOR_JSON_FORMAT_VERSION_V2,
        bpm: 120,
        grids: [{
          type: 'empty',
          keys: [],
          layer2Keys: [14, 2, 2, -1, 15, 3.5, 14, 0],
          text: '',
          forceBreakAfter: false,
        }],
      })
    );
    if (!score) return;
    expect(score.grids[0].type).toBe('note');
    expect(score.grids[0].keys).toEqual([]);
    expect(score.grids[0].layer2Keys).toEqual([0, 2, 14]);
  });

  it('巨大なlayer2Keysも正規化後は15種類以下になる', () => {
    const layer2Keys = Array.from({ length: 100000 }, (_, i) => i % 15);
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: EDITOR_JSON_FORMAT_VERSION_V2,
        bpm: 120,
        grids: [{ type: 'note', keys: [], layer2Keys, text: '', forceBreakAfter: false }],
      })
    );
    if (!score) return;
    expect(score.grids[0].layer2Keys).toEqual(Array.from({ length: 15 }, (_, i) => i));
  });

  it('42. 同じ値を100000個含むkeysも重複除去後は15件以下になる', () => {
    const keys = Array.from({ length: 100000 }, () => 5);
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        grids: [{ type: 'note', keys, text: '', forceBreakAfter: false }],
      })
    );
    if (!score) return;
    expect(score.grids[0].keys.length).toBeLessThanOrEqual(15);
  });

  it('43. 重複除去を入れても範囲外(0〜14以外)は漏れない', () => {
    const score = expectRejectedOrSafe(
      JSON.stringify({
        formatVersion: 'sky-editor-v1',
        bpm: 120,
        grids: [
          { type: 'note', keys: [-1, 15, 5, 5, 100, 3.5, 0, 0], text: '', forceBreakAfter: false },
        ],
      })
    );
    if (!score) return;
    expect(score.grids[0].keys).toEqual([0, 5]);
  });
});
