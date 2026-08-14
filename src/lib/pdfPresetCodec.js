import {
  DEFAULT_CUSTOM_TEMPO_VALUE,
  DEFAULT_TEMPO_VALUE_MODE_ID,
  KEY_NOTATIONS,
  PDF_FONTS,
  PDF_FONT_WEIGHTS,
  PDF_GRID_GAPS,
  PDF_GRID_NUMBER_DISPLAYS,
  PDF_PAGE_MARGINS,
  PDF_PAGE_NUMBER_FORMATS,
  PDF_PAGE_NUMBER_POSITIONS,
  PDF_PRESETS,
  PDF_RUNNING_HEADERS,
  PDF_FOOTER_CREDITS,
  PDF_SCORE_INFO_DESIGNS,
  PDF_MASTHEAD_DIRECTIONS,
  PDF_SHEET_LAYOUTS,
  PDF_TEMPO_VALUE_MODES,
  keyModeNotationLabel,
  keyTonicPitchClass,
} from '../constants/config.js';
import { normalizePdfPrefs } from './pdfPrefs.js';
import { PDF_GRID_STYLES } from './pdfGridStyle.js';
import {
  MAX_PDF_PRESET_INPUT_LENGTH,
  MAX_PDF_PRESET_COMPRESSED_BYTES,
  MAX_PDF_PRESET_JSON_BYTES,
  MAX_PDF_PRESET_NAME_CODE_POINTS,
  MAX_PDF_PRESET_MEMO_CODE_POINTS,
} from './pdfPresetConstants.js';

export {
  MAX_PDF_PRESET_INPUT_LENGTH,
  MAX_PDF_PRESET_COMPRESSED_BYTES,
  MAX_PDF_PRESET_JSON_BYTES,
  MAX_PDF_PRESET_NAME_CODE_POINTS,
  MAX_PDF_PRESET_MEMO_CODE_POINTS,
} from './pdfPresetConstants.js';

const CODE_PREFIX = 'SKYPDF1';
const CODE_RE = /^SKYPDF1\.[GJ]\.[A-Za-z0-9_-]+$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const CONTROL_CHARACTER_RE = /[\u0000-\u001F\u007F-\u009F]/g;

const EXTERNAL_GROUP_KEYS = {
  design: ['presetId', 'custom', 'gridStyleId', 'gridStyleCustom', 'gridNumberDisplayId'],
  typography: [
    'fontId',
    'fontWeightId',
    'titleFontSizePt',
    'metaFontSizePt',
    'lyricSizePercent',
    'gridNumberSizePercent',
  ],
  scoreInfo: [
    'scoreInfoDesignId',
    'mastheadDirectionId',
    'tempoValueModeId',
    'customTempoValue',
    'keyNotationId',
    'keyModeNotationId',
  ],
  page: [
    'pageNumberFormatId',
    'pageNumberPositionId',
    'pageNumberFontSizePt',
    'runningHeaderId',
    'footerCreditId',
  ],
  paper: ['sheetLayoutId', 'maxRowsPerPage', 'pageMarginId', 'gridGapId'],
};

const BLACK_KEY_NOTATION_BY_PITCH = {
  1: { major: 'flat', minor: 'sharp' },
  3: { major: 'flat', minor: 'flat' },
  6: { major: 'sharp', minor: 'sharp' },
  8: { major: 'flat', minor: 'sharp' },
  10: { major: 'flat', minor: 'flat' },
};

const DIFF_GROUPS = [
  {
    id: 'design',
    label: 'デザイン',
    keys: EXTERNAL_GROUP_KEYS.design,
  },
  {
    id: 'typography',
    label: '文字',
    keys: EXTERNAL_GROUP_KEYS.typography,
  },
  {
    id: 'scoreInfo',
    label: '曲情報',
    keys: EXTERNAL_GROUP_KEYS.scoreInfo,
  },
  {
    id: 'page',
    label: 'ページ',
    keys: EXTERNAL_GROUP_KEYS.page,
  },
  {
    id: 'paper',
    label: '紙面',
    keys: EXTERNAL_GROUP_KEYS.paper,
  },
];

export class PdfPresetCodecError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PdfPresetCodecError';
    this.code = code;
  }
}

function throwCodecError(code, message) {
  throw new PdfPresetCodecError(code, message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeSharedText(value, maxCodePoints, fieldName) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(CONTROL_CHARACTER_RE, '');
  if ([...cleaned].length > maxCodePoints) {
    throwCodecError(
      'field-too-large',
      `${fieldName}が長すぎます。`,
    );
  }
  return cleaned;
}

function encodeUtf8(value) {
  return new globalThis.TextEncoder().encode(value);
}

function decodeUtf8(bytes) {
  try {
    return new globalThis.TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throwCodecError('invalid-utf8', '設定データの文字コードが正しくありません。');
  }
}

function bytesToBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    const chunk = bytes.subarray(start, Math.min(start + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  let encoded;
  try {
    encoded = globalThis.btoa(binary);
  } catch {
    throwCodecError('base64-encode-failed', '設定コードを作成できませんでした。');
  }
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value) {
  if (!BASE64URL_RE.test(value) || value.length % 4 === 1) {
    throwCodecError('invalid-base64', '設定コードのデータが正しくありません。');
  }

  const estimatedBytes = Math.floor((value.length * 6) / 8);
  if (estimatedBytes > MAX_PDF_PRESET_COMPRESSED_BYTES) {
    throwCodecError('compressed-too-large', '設定コードのデータが大きすぎます。');
  }

  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (value.length % 4)) % 4);
  let binary;
  try {
    binary = globalThis.atob(padded);
  } catch {
    throwCodecError('invalid-base64', '設定コードのデータが正しくありません。');
  }
  if (binary.length > MAX_PDF_PRESET_COMPRESSED_BYTES) {
    throwCodecError('compressed-too-large', '設定コードのデータが大きすぎます。');
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function assertInputLength(value) {
  if (typeof value !== 'string') {
    throwCodecError('invalid-input', '設定コードを読み取れませんでした。');
  }
  if (value.length > MAX_PDF_PRESET_INPUT_LENGTH) {
    throwCodecError('input-too-large', '設定コードが長すぎます。');
  }
}

function validateCodeSyntax(code) {
  if (!CODE_RE.test(code)) {
    throwCodecError('invalid-code', '設定コードの形式が正しくありません。');
  }
}

function validateDecodeParts(parts) {
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX || !['G', 'J'].includes(parts[1])) {
    throwCodecError('invalid-code', '設定コードの形式が正しくありません。');
  }
}

async function readStreamBytes(stream, maxBytes = Infinity) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value instanceof Uint8Array
        ? result.value
        : new Uint8Array(result.value);
      total += chunk.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // 上限超過のエラーを優先し、cancelの実装差を吸収する。
        }
        throwCodecError('json-too-large', '展開後の設定データが大きすぎます。');
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function gzipBytes(bytes) {
  const stream = new globalThis.Blob([bytes]).stream()
    .pipeThrough(new globalThis.CompressionStream('gzip'));
  return readStreamBytes(stream);
}

async function gunzipBytes(bytes) {
  if (typeof globalThis.DecompressionStream !== 'function') {
    throwCodecError(
      'unsupported-browser',
      'この設定コードの展開には新しいブラウザが必要です。',
    );
  }
  try {
    const stream = new globalThis.Blob([bytes]).stream()
      .pipeThrough(new globalThis.DecompressionStream('gzip'));
    return await readStreamBytes(stream, MAX_PDF_PRESET_JSON_BYTES);
  } catch (error) {
    if (error instanceof PdfPresetCodecError) throw error;
    throwCodecError('invalid-gzip', '設定コードを展開できませんでした。');
  }
}

function buildExternalSettings(prefs) {
  return {
    design: {
      presetId: prefs.presetId,
      custom: prefs.custom,
      gridStyleId: prefs.gridStyleId,
      gridStyleCustom: prefs.gridStyleCustom,
      gridNumberDisplayId: prefs.gridNumberDisplayId,
    },
    typography: {
      fontId: prefs.fontId,
      fontWeightId: prefs.fontWeightId,
      titleFontSizePt: prefs.titleFontSizePt,
      metaFontSizePt: prefs.metaFontSizePt,
      lyricSizePercent: prefs.lyricSizePercent,
      gridNumberSizePercent: prefs.gridNumberSizePercent,
    },
    scoreInfo: {
      scoreInfoDesignId: prefs.scoreInfoDesignId,
      mastheadDirectionId: prefs.mastheadDirectionId,
      tempoValueModeId: prefs.tempoValueModeId,
      customTempoValue: prefs.customTempoValue,
      keyNotationId: prefs.keyNotationId,
      keyModeNotationId: prefs.keyModeNotationId,
    },
    page: {
      pageNumberFormatId: prefs.pageNumberFormatId,
      pageNumberPositionId: prefs.pageNumberPositionId,
      pageNumberFontSizePt: prefs.pageNumberFontSizePt,
      runningHeaderId: prefs.runningHeaderId,
      footerCreditId: prefs.footerCreditId,
    },
    paper: {
      sheetLayoutId: prefs.sheetLayoutId,
      maxRowsPerPage: prefs.maxRowsPerPage,
      pageMarginId: prefs.pageMarginId,
      gridGapId: prefs.gridGapId,
    },
  };
}

function readExternalSettings(settings) {
  if (!isPlainObject(settings)) {
    throwCodecError('invalid-settings', '設定データの形式が正しくありません。');
  }

  const flat = {};
  for (const [group, keys] of Object.entries(EXTERNAL_GROUP_KEYS)) {
    const source = settings[group];
    if (!isPlainObject(source)) {
      throwCodecError('invalid-settings-group', '設定データの形式が正しくありません。');
    }
    for (const key of keys) flat[key] = source[key];
  }
  return flat;
}

/**
 * 読み込み先の楽譜に合わせて、そのまま引き継げない設定を解決する。
 * ♩の値は共有元の楽譜のBPMを前提にした数値なので、別の楽譜へ持ち込むと
 * テンポ表記だけが実際と食い違う。カスタム値もBPM÷2も引き継がず、
 * BPM値から求め直す既定（BPM÷4）へ戻す。
 */
function applyImportContext(prefs, scoreContext) {
  return {
    ...prefs,
    keyNotationId: resolveImportedKeyNotationId(
      prefs?.keyNotationId,
      scoreContext?.pitchLevel,
      scoreContext?.keyMode,
    ),
    tempoValueModeId: DEFAULT_TEMPO_VALUE_MODE_ID,
    customTempoValue: DEFAULT_CUSTOM_TEMPO_VALUE,
  };
}

function parseEnvelope(jsonText, scoreContext) {
  let envelope;
  try {
    envelope = JSON.parse(jsonText);
  } catch {
    throwCodecError('invalid-json', '設定データのJSONが正しくありません。');
  }
  if (!isPlainObject(envelope)) {
    throwCodecError('invalid-json', '設定データの形式が正しくありません。');
  }
  if (envelope.version !== 1) {
    throwCodecError('unsupported-version', '新しいバージョンの設定です。');
  }

  const flat = readExternalSettings(envelope.settings);
  const importedPrefs = normalizePdfPrefs(applyImportContext(flat, scoreContext));

  return {
    version: 1,
    name: sanitizeSharedText(envelope.name, MAX_PDF_PRESET_NAME_CODE_POINTS, '名前'),
    memo: sanitizeSharedText(envelope.memo, MAX_PDF_PRESET_MEMO_CODE_POINTS, 'メモ'),
    prefs: importedPrefs,
  };
}

/**
 * PDF設定を意味のある外部キー名のenvelopeへ固定順で変換する。
 * CompressionStreamが使える環境では常にgzip形式を返す。
 */
export async function encodePdfPreset({ name, memo, prefs } = {}) {
  const normalizedPrefs = normalizePdfPrefs(prefs);
  const envelope = {
    version: 1,
    name: sanitizeSharedText(name, MAX_PDF_PRESET_NAME_CODE_POINTS, '名前'),
    memo: sanitizeSharedText(memo, MAX_PDF_PRESET_MEMO_CODE_POINTS, 'メモ'),
    settings: buildExternalSettings(normalizedPrefs),
  };
  const jsonBytes = encodeUtf8(JSON.stringify(envelope));
  if (jsonBytes.byteLength > MAX_PDF_PRESET_JSON_BYTES) {
    throwCodecError('json-too-large', '設定データが大きすぎます。');
  }

  let mode = 'J';
  let payload = jsonBytes;
  if (typeof globalThis.CompressionStream === 'function') {
    mode = 'G';
    payload = await gzipBytes(jsonBytes);
  }
  if (payload.byteLength > MAX_PDF_PRESET_COMPRESSED_BYTES) {
    throwCodecError('compressed-too-large', '設定コードのデータが大きすぎます。');
  }

  const code = `${CODE_PREFIX}.${mode}.${bytesToBase64Url(payload)}`;
  if (code.length > MAX_PDF_PRESET_INPUT_LENGTH) {
    throwCodecError('input-too-large', '設定コードが長すぎます。');
  }
  return code;
}

/**
 * 設定コードを検証・展開し、現在の楽譜を文脈にした完全なpdfPrefsを返す。
 * G形式の展開はchunk単位で上限を監視し、全展開後の切り詰めを行わない。
 */
export async function decodePdfPresetCode(code, scoreContext) {
  assertInputLength(code);
  const normalizedCode = code.trim();
  const parts = normalizedCode.split('.');
  if (parts.length === 3 && /^SKYPDF\d+$/u.test(parts[0]) && parts[0] !== CODE_PREFIX) {
    throwCodecError('unsupported-version', '新しいバージョンの設定です。');
  }
  validateDecodeParts(parts);

  const payload = base64UrlToBytes(parts[2]);
  let jsonBytes;
  if (parts[1] === 'G') {
    jsonBytes = await gunzipBytes(payload);
  } else {
    if (payload.byteLength > MAX_PDF_PRESET_JSON_BYTES) {
      throwCodecError('json-too-large', '設定データが大きすぎます。');
    }
    jsonBytes = payload;
  }
  return parseEnvelope(decodeUtf8(jsonBytes), scoreContext);
}

/**
 * 設定コード単体、またはURLのhashからコードだけを抽出する。
 * URLを開いたり通信したりせず、認識できない入力はnullを返す。
 */
export function extractPdfPresetCode(text) {
  assertInputLength(text);
  const value = text.trim();
  if (CODE_RE.test(value)) return value;

  const hashIndex = value.indexOf('#');
  if (hashIndex < 0) return null;
  const fragment = value.slice(hashIndex + 1);
  const candidate = new URLSearchParams(fragment).get('pdf-preset');
  return candidate && CODE_RE.test(candidate) ? candidate : null;
}

/** 現在のアプリのoriginとbase URLから、設定共有用のURLを組み立てる。 */
export function buildPdfPresetUrl(code, locationLike, baseUrl) {
  assertInputLength(code);
  const normalizedCode = code.trim();
  validateCodeSyntax(normalizedCode);
  if (!locationLike || typeof locationLike.origin !== 'string') {
    throwCodecError('invalid-location', '設定共有URLを作成できませんでした。');
  }

  const path = typeof baseUrl === 'string' && baseUrl ? baseUrl : '/';
  let url;
  try {
    url = new URL(path, locationLike.origin);
  } catch {
    throwCodecError('invalid-location', '設定共有URLを作成できませんでした。');
  }
  if (url.origin !== locationLike.origin) {
    throwCodecError('invalid-location', '設定共有URLを作成できませんでした。');
  }
  url.hash = `pdf-preset=${normalizedCode}`;
  return url.toString();
}

/** 設定コードの読込先楽譜に合わせて、黒鍵の単独表記を解決する。 */
export function resolveImportedKeyNotationId(incomingId, pitchLevel, keyMode) {
  const safeIncoming = Object.prototype.hasOwnProperty.call(KEY_NOTATIONS, incomingId)
    ? incomingId
    : 'both';
  if (safeIncoming === 'both') return safeIncoming;

  const pitchClass = keyTonicPitchClass(pitchLevel, keyMode);
  const blackKeyRule = BLACK_KEY_NOTATION_BY_PITCH[pitchClass];
  if (!blackKeyRule) return safeIncoming;
  return blackKeyRule[keyMode === 'minor' ? 'minor' : 'major'];
}

function valuesEqual(left, right) {
  if (left && typeof left === 'object' && right && typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return Object.is(left, right);
}

function labelFrom(table, value) {
  return table[value]?.label ?? '既定値';
}

function formatDiffValue(key, value, scoreContext) {
  switch (key) {
    case 'presetId':
      return value === 'custom' ? 'カスタム' : labelFrom(PDF_PRESETS, value);
    case 'custom':
      return 'カスタム配色';
    case 'gridStyleId':
      return value === 'custom' ? 'カスタム' : labelFrom(PDF_GRID_STYLES, value);
    case 'gridStyleCustom':
      return 'カスタム形状';
    case 'gridNumberDisplayId':
      return labelFrom(PDF_GRID_NUMBER_DISPLAYS, value);
    case 'fontId':
      return labelFrom(PDF_FONTS, value);
    case 'fontWeightId':
      return labelFrom(PDF_FONT_WEIGHTS, value);
    case 'titleFontSizePt':
    case 'metaFontSizePt':
    case 'pageNumberFontSizePt':
      return `${value}pt`;
    case 'lyricSizePercent':
    case 'gridNumberSizePercent':
      return `${value}%`;
    case 'scoreInfoDesignId':
      return labelFrom(PDF_SCORE_INFO_DESIGNS, value);
    case 'mastheadDirectionId':
      return labelFrom(PDF_MASTHEAD_DIRECTIONS, value);
    case 'tempoValueModeId':
      return labelFrom(PDF_TEMPO_VALUE_MODES, value);
    case 'customTempoValue':
      return String(value);
    case 'keyNotationId':
      return labelFrom(KEY_NOTATIONS, value);
    case 'keyModeNotationId':
      return keyModeNotationLabel(scoreContext?.keyMode, value);
    case 'pageNumberFormatId':
      return labelFrom(PDF_PAGE_NUMBER_FORMATS, value);
    case 'pageNumberPositionId':
      return labelFrom(PDF_PAGE_NUMBER_POSITIONS, value);
    case 'runningHeaderId':
      return labelFrom(PDF_RUNNING_HEADERS, value);
    case 'footerCreditId':
      return labelFrom(PDF_FOOTER_CREDITS, value);
    case 'sheetLayoutId':
      return labelFrom(PDF_SHEET_LAYOUTS, value);
    case 'maxRowsPerPage':
      return `${value}行`;
    case 'pageMarginId':
      return labelFrom(PDF_PAGE_MARGINS, value);
    case 'gridGapId':
      return labelFrom(PDF_GRID_GAPS, value);
    default:
      return '';
  }
}

/** 5つの設定sectionごとに、利用者向けラベルで差分を返す。 */
export function buildPdfPresetDiff(currentPrefs, importedPrefs, scoreContext) {
  const current = normalizePdfPrefs(currentPrefs);
  // 差分は「適用したらどうなるか」なので、読み込み時の解決を通した値と比べる
  const imported = normalizePdfPrefs(applyImportContext(importedPrefs, scoreContext));

  return DIFF_GROUPS.map((group) => {
    const changes = group.keys
      .filter((key) => !valuesEqual(current[key], imported[key]))
      .map((key) => ({
        key,
        label: {
          presetId: '配色',
          custom: 'カスタム配色',
          gridStyleId: 'グリッド形状',
          gridStyleCustom: '形状の詳細',
          gridNumberDisplayId: 'グリッド番号',
          fontId: '書体',
          fontWeightId: 'ウェイト',
          titleFontSizePt: '曲名サイズ',
          metaFontSizePt: '曲情報サイズ',
          lyricSizePercent: '歌詞サイズ',
          gridNumberSizePercent: '番号サイズ',
          scoreInfoDesignId: '曲情報デザイン',
          mastheadDirectionId: 'マストヘッドの向き',
          tempoValueModeId: '♩の値',
          customTempoValue: 'カスタム値',
          keyNotationId: 'キー表記',
          keyModeNotationId: '調性表記',
          pageNumberFormatId: 'ページ番号',
          pageNumberPositionId: 'ページ番号の位置',
          pageNumberFontSizePt: 'ページ番号サイズ',
          runningHeaderId: '柱',
          footerCreditId: 'フッター',
          sheetLayoutId: '面付け',
          maxRowsPerPage: '1ページの行数',
          pageMarginId: '余白',
          gridGapId: 'グリッド間隔',
        }[key],
        current: formatDiffValue(key, current[key], scoreContext),
        imported: formatDiffValue(key, imported[key], scoreContext),
      }));
    return {
      id: group.id,
      label: group.label,
      changed: changes.length > 0,
      changes,
    };
  });
}
