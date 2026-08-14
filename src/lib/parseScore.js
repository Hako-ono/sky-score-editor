import {
  EDITOR_JSON_FORMAT_VERSION,
  EDITOR_JSON_FORMAT_VERSION_V2,
  DEFAULT_BPM,
  normalizeKeyMode,
  MAX_GRIDS,
  MAX_SONG_NOTES,
  MAX_METADATA_LENGTH,
  MAX_TEXT_LENGTH,
} from '../constants/config.js';
import { createScore } from '../state/scoreShape.js';
import { analyzeScoreLayers } from './scoreLayers.js';

/**
 * 制御文字(改行・タブ等)とゼロ幅文字等の書式文字(Unicode Cf)を除去したうえで、
 * 指定した文字数に切り詰める。文字列でない場合は空文字を返す。
 * 外部ファイルに由来するテキストはすべてこの関数を通すこと。
 *
 * 信頼境界: value は外部ファイル由来で長さに上限がない。正規表現を
 * 文字列全体に当ててから slice すると、上限よりはるかに長い値でも全体を
 * 走査してしまう。先頭からチャンク単位で除去しながら、結果が maxLength に
 * 達したら以降のチャンクは読まずに打ち切る。「先に maxLength 文字だけ
 * slice してから除去する」のは不可（除去で短くなる分、本来繰り上がってくる
 * はずの後続文字が失われ、結果が現在より短くなってしまう）。
 * チャンク境界が高位サロゲートで終わる場合は1文字分伸ばして、サロゲート
 * ペア1つで表される書式文字(Cf)を境界で分断しないようにする
 * （分断すると半分ずつは Cf 単体に該当せず除去されなくなる）。
 */
function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const CHUNK_SIZE = Math.max(maxLength, 1) * 4;
  let result = '';
  let pos = 0;
  while (pos < value.length && result.length < maxLength) {
    let end = Math.min(pos + CHUNK_SIZE, value.length);
    if (end < value.length) {
      const code = value.charCodeAt(end - 1);
      if (code >= 0xd800 && code <= 0xdbff) end += 1;
    }
    result += value.slice(pos, end).replace(/[\p{Cc}\p{Cf}]/gu, '');
    pos = end;
  }
  return result.slice(0, maxLength);
}

export function createEmptyGrid() {
  return { type: 'empty', keys: [], layer2Keys: [], text: '', forceBreakAfter: false };
}

function normalizeKeys(rawKeys) {
  const keys = [];
  if (!Array.isArray(rawKeys)) return keys;

  const seen = new Set();
  for (const key of rawKeys) {
    if (
      Number.isInteger(key) &&
      key >= 0 &&
      key <= 14 &&
      !seen.has(key)
    ) {
      seen.add(key);
      keys.push(key);
      if (keys.length === 15) break;
    }
  }
  keys.sort((a, b) => a - b);
  return keys;
}

function normalizeGrid(raw, includeLayer2Keys) {
  // 信頼境界: keys / layer2Keys はそれぞれ外部ファイル由来で件数に
  // 上限がない。Setで既出判定しながら1回の走査で重複を除去し、有効値が
  // 15種類揃った時点で打ち切る。両配列は別々に正規化し、元レイヤーの所属を
  // 混ぜない。
  const keys = normalizeKeys(raw.keys);
  const layer2Keys = includeLayer2Keys ? normalizeKeys(raw.layer2Keys) : [];
  // type は両レイヤーの和集合を唯一の根拠として導出する。raw.type は参照しない。
  // 編集側の TOGGLE_KEY（scoreReducer.js）も keys から type を導出しており、
  // ここで raw.type を優先すると外部ファイルの { type: 'empty', keys: [...] }
  // のような不整合な組み合わせで鍵が握りつぶされ、音が無言で消える。
  const type = keys.length > 0 || layer2Keys.length > 0 ? 'note' : 'empty';
  return {
    type,
    keys,
    layer2Keys,
    text: sanitizeText(raw.text, MAX_TEXT_LENGTH),
    forceBreakAfter:
      typeof raw.forceBreakAfter === 'boolean' ? raw.forceBreakAfter : false,
  };
}

/**
 * 読み込んだ楽譜データを正規化する。
 *
 * @param {object} data 外部ファイル由来の未検証データ。
 * @param {string} [trustedWarning] アプリ内部で生成した警告文(呼び出し元が
 *   parseSongNotes 等で組み立てた、固定テンプレート+件数のみの安全な文字列)。
 *   data.warning はここでは一切参照しない。外部ファイルが warning
 *   フィールドに何を書いていても、表示される警告文は
 *   (1) この trustedWarning と (2) このあとのグリッド数切り詰め時に
 *   本関数自身が生成するメッセージ、の2つに由来するものだけになる。
 */
export function normalizeLoadedScore(
  data,
  trustedWarning = '',
  { includeLayer2Keys = true } = {},
) {
  // 信頼境界: data.grids は外部ファイル由来で件数に上限がない。
  // filter().map() で全件を正規化してから MAX_GRIDS で切り詰めると、
  // 最終的に捨てる分まで含めて全オブジェクトを構築してしまう。
  // 非オブジェクトはカウントせず読み飛ばし、正規化できたものだけを数えて
  // MAX_GRIDS+1 件に達した時点で走査を打ち切る（+1件許すのは、下の
  // `grids.length > MAX_GRIDS` を成立させて切り詰め警告を出すため）。
  let grids;
  if (Array.isArray(data.grids)) {
    grids = [];
    for (const g of data.grids) {
      if (!g || typeof g !== 'object') continue;
      grids.push(normalizeGrid(g, includeLayer2Keys));
      if (grids.length > MAX_GRIDS) break;
    }
  } else {
    grids = [createEmptyGrid()];
  }

  let warningMessage = trustedWarning;

  if (grids.length > MAX_GRIDS) {
    grids = grids.slice(0, MAX_GRIDS);
    const msg = `グリッド数が上限(${MAX_GRIDS})を超えたため切り詰めました。`;
    warningMessage = warningMessage ? `${warningMessage} ${msg}` : msg;
  }

  let bpm = typeof data.bpm === 'number' && data.bpm > 0 ? data.bpm : DEFAULT_BPM;
  bpm = Math.max(1, Math.min(bpm, 999));

  // pitchLevel は半音単位のトランスポーズ量であり、非整数値は音楽的に意味を持たない
  // （audioEngine で midi + pitchLevel として使われる）ため、丸めてからクランプする。
  let pitchLevel =
    typeof data.pitchLevel === 'number' && Number.isFinite(data.pitchLevel)
      ? Math.round(data.pitchLevel)
      : 0;
  pitchLevel = Math.max(0, Math.min(pitchLevel, 11));
  const keyMode = normalizeKeyMode(data.keyMode);

  let bitsPerPage = typeof data.bitsPerPage === 'number' ? data.bitsPerPage : 16;
  if (![4, 12, 16].includes(bitsPerPage)) bitsPerPage = 16;

  // warning は score のフィールドではなく「この読み込みで起きたこと」の
  // 付随情報なので、createScore の9フィールドには含めず外側で付ける。
  return {
    ...createScore({
      grids,
      bpm,
      title: sanitizeText(data.title, MAX_METADATA_LENGTH),
      pitchLevel,
      keyMode,
      author: sanitizeText(data.author, MAX_METADATA_LENGTH),
      lyricist: sanitizeText(data.lyricist, MAX_METADATA_LENGTH),
      transcribedBy: sanitizeText(data.transcribedBy, MAX_METADATA_LENGTH),
      bitsPerPage,
    }),
    warning: warningMessage,
  };
}

function loadEditorJson(data) {
  if (!Array.isArray(data.grids)) {
    throw new ParseError("JSON に 'grids' 配列が含まれていません。");
  }

  // data.warning は normalizeLoadedScore に一切渡さない(trustedWarning省略 = '')。
  // v1はlayer2Keysを知らない形式なので、余分なフィールドがあっても元レイヤー1
  // のkeysだけを採用して、未知の所属を保存データへ混ぜない。
  return normalizeLoadedScore(data, '', {
    includeLayer2Keys: data.formatVersion === EDITOR_JSON_FORMAT_VERSION_V2,
  });
}

function parseSongNotes(songNotes) {
  const notesByTime = new Map();
  let invalidCount = 0;
  let timeAnomaly = false;
  let maxTime = -1;

  songNotes.forEach((note, i) => {
    if (
      !note ||
      typeof note !== 'object' ||
      typeof note.time !== 'number' ||
      !Number.isFinite(note.time) || // Infinity や NaN を弾く
      typeof note.key !== 'string'
    ) {
      invalidCount += 1;
      return;
    }
    const { time } = note;
    if (time < maxTime && !timeAnomaly) timeAnomaly = true;
    maxTime = Math.max(maxTime, time);

    const m = note.key.match(/^([12])Key(\d+)$/);
    const layer = m ? Number(m[1]) : NaN;
    const parsedKeyIndex = m ? parseInt(m[2], 10) : NaN;
    if (
      (layer === 1 || layer === 2) &&
      Number.isInteger(parsedKeyIndex) &&
      parsedKeyIndex >= 0 &&
      parsedKeyIndex <= 14
    ) {
      if (!notesByTime.has(time)) {
        notesByTime.set(time, { keys: new Set(), layer2Keys: new Set() });
      }
      const chord = notesByTime.get(time);
      (layer === 1 ? chord.keys : chord.layer2Keys).add(parsedKeyIndex);
    } else {
      invalidCount += 1;
    }
  });

  const chords = Array.from(notesByTime.entries())
    .filter(([, chord]) => chord.keys.size > 0 || chord.layer2Keys.size > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([time, chord]) => ({
      time,
      keys: Array.from(chord.keys).sort((a, b) => a - b),
      layer2Keys: Array.from(chord.layer2Keys).sort((a, b) => a - b),
    }));

  const warnings = [];
  if (invalidCount > 0) {
    warnings.push(`${invalidCount} 個の無効なノートをスキップしました。`);
  }
  if (timeAnomaly) {
    warnings.push('楽譜データ内で時間の逆行が検出されました。');
  }
  return { chords, warning: warnings.join(' ') };
}

function chordsToGrids(chords, bpm) {
  const grids = [];
  let truncated = false;

  if (chords.length === 0) return { grids, truncated };

  const gridDurationMs = 60000 / bpm;
  let previousTime = 0;

  // 信頼境界: songNotes はコード数Nに対して最大65N個のグリッド生成を
  // 要求しうる(1コードあたり最大64個の空グリッド+コード自身)。
  // normalizeLoadedScoreのMAX_GRIDS切り詰めはこの配列を作りきった後に走るため、
  // ここで生成自体をMAX_GRIDS+1件に達した時点で打ち切る。ちょうどMAX_GRIDS件で
  // 止めると normalizeLoadedScore の `grids.length > MAX_GRIDS` が成立しなくなり、
  // 切り詰め警告が出せなくなるため、+1件までは許して打ち切る。
  for (let chordIndex = 0; chordIndex < chords.length; chordIndex += 1) {
    const chord = chords[chordIndex];
    const deltaTime = chord.time - previousTime;
    if (deltaTime >= gridDurationMs / 2) {
      const numSlots = Math.round(deltaTime / gridDurationMs);
      let emptyToAdd =
        chordIndex === 0 ? Math.max(0, numSlots) : Math.max(0, numSlots - 1);

      if (emptyToAdd > 64) {
        emptyToAdd = 64;
        truncated = true;
      }

      for (let i = 0; i < emptyToAdd; i += 1) {
        if (grids.length > MAX_GRIDS) break;
        grids.push(createEmptyGrid());
      }
    }
    if (grids.length > MAX_GRIDS) break;
    grids.push({
      type: 'note',
      keys: chord.keys,
      layer2Keys: chord.layer2Keys,
      text: '',
      forceBreakAfter: false,
    });
    previousTime = chord.time;
  }

  return { grids, truncated };
}

function loadOriginalJson(data) {
  const songInfo = data[0];

  if (!Array.isArray(songInfo.songNotes)) {
    throw new ParseError('songNotes が配列ではありません。');
  }

  // 信頼境界: 配列長はMap/Set構築やソートより先にO(1)で確認できる。
  // 未ソート入力を途中で切り詰めると曲の一部だけを正常な譜面として扱うため、
  // 超過時は部分結果を作らず拒否する。
  if (songInfo.songNotes.length > MAX_SONG_NOTES) {
    throw new ParseError('songNotes の件数が上限（50000件）を超えています。');
  }

  let bpm = songInfo.bpm;
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
    throw new ParseError('BPM の値が無効です (0 以下または不正な数値)。');
  }
  bpm = Math.max(1, Math.min(bpm, 999));

  let title = typeof songInfo.name === 'string' ? songInfo.name :
              typeof songInfo.title === 'string' ? songInfo.title : '';
  if (title === 'Untitle') title = '';

  let author = typeof songInfo.author === 'string' ? songInfo.author : '';
  if (author === 'Unknown') author = '';

  let transcribedBy = typeof songInfo.transcribedBy === 'string' ? songInfo.transcribedBy : '';
  if (transcribedBy === 'Unknown') transcribedBy = '';

  const bitsPerPage = typeof songInfo.bitsPerPage === 'number' ? songInfo.bitsPerPage : 16;

  const pitchLevel = typeof songInfo.pitchLevel === 'number' ? songInfo.pitchLevel : 0;

  const { chords, warning: parseWarning } = parseSongNotes(songInfo.songNotes);
  const { grids, truncated } = chordsToGrids(chords, bpm);

  let warning = parseWarning || '';
  if (truncated) {
    const msg = '長い休符を短縮しました。';
    warning = warning ? `${warning} ${msg}` : msg;
  }

  if (grids.length === 0) {
    throw new ParseError('有効なノートが 1 つも含まれていません。');
  }

  // ここで渡す warning は parseSongNotes/chordsToGrids が固定テンプレートと
  // 件数だけから組み立てたものであり、外部ファイルの任意文字列ではないため、
  // trustedWarning として渡してよい。
  return normalizeLoadedScore(
    { grids, bpm, title, pitchLevel, author, transcribedBy, bitsPerPage },
    warning,
  );
}

export class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParseError';
  }
}

export function decodeScoreFileBytes(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  // 参照元アプリの.txtはUTF-16LEで書き出される場合がある。BOMがある場合だけ
  // 文字コードを切り替え、BOMなし入力を推測して誤受理する経路は作らない。
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new globalThis.TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  return new globalThis.TextDecoder('utf-8').decode(bytes);
}

export function parseScoreJson(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new ParseError('JSON ファイルの形式が不正です。内容を確認してください。');
  }

  if (
    data &&
    [EDITOR_JSON_FORMAT_VERSION, EDITOR_JSON_FORMAT_VERSION_V2].includes(data.formatVersion) &&
    Array.isArray(data.grids)
  ) {
    return loadEditorJson(data);
  }
  if (
    Array.isArray(data) &&
    data.length > 0 &&
    data[0] &&
    data[0].songNotes &&
    typeof data[0].bpm === 'number'
  ) {
    return loadOriginalJson(data);
  }
  throw new ParseError('対応していない JSON フォーマットです。');
}

export function serializeScore({
  grids,
  bpm,
  title,
  pitchLevel,
  keyMode,
  author,
  lyricist,
  transcribedBy,
  bitsPerPage,
}) {
  const formatVersion = analyzeScoreLayers(grids).hasLayer2
    ? EDITOR_JSON_FORMAT_VERSION_V2
    : EDITOR_JSON_FORMAT_VERSION;
  const payload = {
    formatVersion,
    title: title || '',
    author: author || '',
    lyricist: lyricist || '',
    transcribedBy: transcribedBy || '',
    bpm: bpm || DEFAULT_BPM,
    bitsPerPage: bitsPerPage || 16,
    pitchLevel: pitchLevel || 0,
    keyMode: normalizeKeyMode(keyMode),
    grids: grids.map((g) => {
      const serialized = {
        type: g.type,
        keys: g.keys,
      };
      if (formatVersion === EDITOR_JSON_FORMAT_VERSION_V2) {
        serialized.layer2Keys = Array.isArray(g.layer2Keys) ? g.layer2Keys : [];
      }
      return {
        ...serialized,
        text: g.text,
        forceBreakAfter: g.forceBreakAfter,
      };
    }),
  };
  return JSON.stringify(payload, null, 2);
}
