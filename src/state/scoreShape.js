/**
 * `score` の形をここ1か所だけで定義する。
 *
 * これまで `score` を組み立てる object literal が scoreReducer.js /
 * parseScore.js / App.jsx の計5か所に散っており、フィールドの存在と
 * 並び順が「たまたま」揃っていることに依存していた（App.jsx が
 * JSON.stringify(score) の一致で未保存判定をしているため、キーの
 * 挿入順が変わると読み込み直後から「未保存の変更があります」が
 * 出続けるようになる）。
 *
 * `parseScore.js`（lib）と `scoreReducer.js`（state）の両方からこのファイルを
 * import する必要があるが、scoreReducer.js は既に parseScore.js から
 * createEmptyGrid を import しているため、逆向き（parseScore.js →
 * scoreReducer.js）の import は循環参照になる。このファイルはどちらにも
 * 依存しない中立な置き場として src/state/ に置く。
 */

import { DEFAULT_BPM, DEFAULT_KEY_MODE } from '../constants/config.js';

/** score が持つフィールドのすべてと、その並び順。 */
export const SCORE_FIELDS = [
  'grids',
  'bpm',
  'title',
  'pitchLevel',
  'keyMode',
  'author',
  'lyricist',
  'transcribedBy',
  'bitsPerPage',
];

/**
 * partial から SCORE_FIELDS の9フィールドだけを取り出し、無いキーは
 * 既定値で埋めた新しい score を返す。partial にある余分なキー（例えば
 * normalizeLoadedScore が返す warning）は含めない。
 */
export function createScore(partial = {}) {
  return {
    grids: partial.grids ?? [],
    bpm: partial.bpm ?? DEFAULT_BPM,
    title: partial.title ?? '',
    pitchLevel: partial.pitchLevel ?? 0,
    keyMode: partial.keyMode ?? DEFAULT_KEY_MODE,
    author: partial.author ?? '',
    lyricist: partial.lyricist ?? '',
    transcribedBy: partial.transcribedBy ?? '',
    bitsPerPage: partial.bitsPerPage ?? 16,
  };
}

/**
 * 未保存判定の比較用に score を文字列化する。SCORE_FIELDS の順で明示的に
 * 値を並べてから JSON.stringify するため、渡された score オブジェクト
 * 自体のキーの挿入順には依存しない（JSON.stringify(score) と違い、
 * 同じ内容ならキー順が違っても同じ文字列になる）。
 */
export function serializeScoreForCompare(score) {
  return JSON.stringify(SCORE_FIELDS.map((field) => score[field]));
}
