import {
  DEFAULT_CUSTOM_TEMPO_VALUE,
  DEFAULT_TEMPO_VALUE_MODE_ID,
  KEY_NOTATIONS,
  normalizeKeyMode,
  normalizeKeyModeNotationId,
  resolveKeyModeNotationIdForLanguage,
  keyTonicPitchClass,
} from '../constants/config.js';
import { t } from '../i18n/index.js';
import { normalizePdfPrefs } from './pdfPrefs.js';
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

// 外部形式のversionは、コード接頭辞の数字と揃える。
const EXTERNAL_FORMAT_VERSION = 2;
const CODE_PREFIX = 'SKYPDF2';
const CODE_RE = /^SKYPDF2\.[GJ]\.[A-Za-z0-9_-]+$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const CONTROL_CHARACTER_RE = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * 外部形式（version 2）の唯一の定義表。groupと各設定へ短いコードを与える。
 *
 * version 1 は意味の読める長いキー名（`"columnsPerPageId"` 等）をそのまま
 * 並べていたが、設定が増えるにつれQRが大きくなり、`qr@0.6.0` のデコーダが
 * 読み取りに失敗する領域（QRサイズ129以上）へ入った。キー名は1回しか
 * 出現せずgzipの繰り返し圧縮が効かないため、短縮がそのまま圧縮後のサイズに
 * 効く。
 *
 * **一度決めたコードは変えないこと。** 値の意味はコードではなく内部キー名の
 * 側にあり、コードを付け替えると、既に書き出された設定URL・QRが黙って別の
 * 設定として読まれる。設定を足すときは同じgroup内の未使用コードを新たに使う。
 */
const EXTERNAL_GROUPS = [
  {
    id: 'design',
    code: 'd',
    keys: {
      presetId: 'p',
      custom: 'c',
      gridStyleId: 'g',
      gridStyleCustom: 'k',
      gridNumberDisplayId: 'n',
    },
  },
  {
    id: 'typography',
    code: 't',
    keys: {
      fontId: 'f',
      fontWeightId: 'w',
      titleFontSizePt: 't',
      metaFontSizePt: 'm',
      lyricSizePercent: 'l',
      gridNumberSizePercent: 'n',
    },
  },
  {
    id: 'scoreInfo',
    code: 'i',
    keys: {
      scoreInfoDesignId: 'd',
      mastheadDirectionId: 'h',
      tempoValueModeId: 't',
      customTempoValue: 'c',
      keyNotationId: 'k',
      keyModeNotationId: 'm',
    },
  },
  {
    id: 'page',
    code: 'p',
    keys: {
      pageNumberFormatId: 'f',
      pageNumberPositionId: 'p',
      pageNumberFontSizePt: 's',
      runningHeaderId: 'h',
      footerCreditId: 'c',
    },
  },
  {
    id: 'paper',
    code: 'a',
    keys: {
      sheetLayoutId: 's',
      maxRowsPerPage: 'r',
      columnsPerPageId: 'c',
      rowShadingId: 'z',
      pageMarginId: 'm',
      gridGapId: 'g',
    },
  },
];

/**
 * カスタム配色（8色）とカスタム形状（6値）は、キー名を持たない固定順の配列で
 * 持ち運ぶ。この2つだけで version 1 のJSONの4分の1を占めていた。
 * **並び順を入れ替えないこと**（色や寸法が入れ替わって読まれる）。
 */
const CUSTOM_SEED_ORDER = [
  'bg', 'ink', 'line', 'surface', 'accent', 'accentLine', 'accent2', 'accentLine2',
];
const GRID_STYLE_CUSTOM_ORDER = [
  'outerRadius', 'cellRadius', 'symbolRadius',
  'outerStrokeWidth', 'cellStrokeWidth', 'symbolStrokeWidth',
];
// 8色すべてが #RRGGBB 形式なので、先頭の # を外して運ぶ。
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

const BLACK_KEY_NOTATION_BY_PITCH = {
  1: { major: 'flat', minor: 'sharp' },
  3: { major: 'flat', minor: 'flat' },
  6: { major: 'sharp', minor: 'sharp' },
  8: { major: 'flat', minor: 'sharp' },
  10: { major: 'flat', minor: 'flat' },
};

const DIFF_GROUPS = EXTERNAL_GROUPS.map(({ id, keys }) => ({
  id,
  keys: Object.keys(keys),
}));

export class PdfPresetCodecError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PdfPresetCodecError';
    this.code = code;
  }
}

function throwCodecError(code, messageKey = code, params = {}) {
  throw new PdfPresetCodecError(
    code,
    t(`ui.pdfPresetCodec.error.${messageKey}`, params),
  );
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeSharedText(value, maxCodePoints, fieldNameKey) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(CONTROL_CHARACTER_RE, '');
  if ([...cleaned].length > maxCodePoints) {
    throwCodecError(
      'field-too-large',
      'field-too-large',
      { field: t(`ui.pdfPresetCodec.field.${fieldNameKey}`) },
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
    throwCodecError('invalid-utf8');
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
    throwCodecError('base64-encode-failed');
  }
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value) {
  if (!BASE64URL_RE.test(value) || value.length % 4 === 1) {
    throwCodecError('invalid-base64');
  }

  const estimatedBytes = Math.floor((value.length * 6) / 8);
  if (estimatedBytes > MAX_PDF_PRESET_COMPRESSED_BYTES) {
    throwCodecError('compressed-too-large');
  }

  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (value.length % 4)) % 4);
  let binary;
  try {
    binary = globalThis.atob(padded);
  } catch {
    throwCodecError('invalid-base64');
  }
  if (binary.length > MAX_PDF_PRESET_COMPRESSED_BYTES) {
    throwCodecError('compressed-too-large');
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function assertInputLength(value) {
  if (typeof value !== 'string') {
    throwCodecError('invalid-input');
  }
  if (value.length > MAX_PDF_PRESET_INPUT_LENGTH) {
    throwCodecError('input-too-large');
  }
}

function validateCodeSyntax(code) {
  if (!CODE_RE.test(code)) {
    throwCodecError('invalid-code');
  }
}

function validateDecodeParts(parts) {
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX || !['G', 'J'].includes(parts[1])) {
    throwCodecError('invalid-code');
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
        throwCodecError('json-too-large');
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
    throwCodecError('unsupported-browser');
  }
  try {
    const stream = new globalThis.Blob([bytes]).stream()
      .pipeThrough(new globalThis.DecompressionStream('gzip'));
    return await readStreamBytes(stream, MAX_PDF_PRESET_JSON_BYTES);
  } catch (error) {
    if (error instanceof PdfPresetCodecError) throw error;
    throwCodecError('invalid-gzip');
  }
}

function encodeCustomSeed(seed) {
  if (!isPlainObject(seed)) return undefined;
  return CUSTOM_SEED_ORDER.map((key) => (
    HEX_COLOR_RE.test(seed[key]) ? String(seed[key]).slice(1) : seed[key]
  ));
}

function decodeCustomSeed(value) {
  if (!Array.isArray(value)) return value;
  // 値そのものの検証は sanitizeCustomSeed（config.js）に任せ、ここは
  // 「固定順の配列をキー名へ戻す」ことだけを行う。
  return Object.fromEntries(CUSTOM_SEED_ORDER.map((key, index) => [
    key,
    typeof value[index] === 'string' ? `#${value[index]}` : value[index],
  ]));
}

function encodeGridStyleCustom(custom) {
  if (!isPlainObject(custom)) return undefined;
  return GRID_STYLE_CUSTOM_ORDER.map((key) => custom[key]);
}

function decodeGridStyleCustom(value) {
  if (!Array.isArray(value)) return value;
  return Object.fromEntries(
    GRID_STYLE_CUSTOM_ORDER.map((key, index) => [key, value[index]]),
  );
}

/** 内部キー名の設定から、外部コードだけを持つ入れ子オブジェクトへ変換する。 */
function buildExternalSettings(prefs) {
  const settings = {};
  for (const group of EXTERNAL_GROUPS) {
    const encoded = {};
    for (const [key, code] of Object.entries(group.keys)) {
      encoded[code] = key === 'custom'
        ? encodeCustomSeed(prefs[key])
        : key === 'gridStyleCustom'
          ? encodeGridStyleCustom(prefs[key])
          : prefs[key];
    }
    settings[group.code] = encoded;
  }
  return settings;
}

/** 外部コードの設定を内部キー名の平坦なオブジェクトへ戻す。 */
function readExternalSettings(settings) {
  if (!isPlainObject(settings)) {
    throwCodecError('invalid-settings');
  }

  const flat = {};
  for (const group of EXTERNAL_GROUPS) {
    const source = settings[group.code];
    if (!isPlainObject(source)) {
      throwCodecError('invalid-settings-group');
    }
    for (const [key, code] of Object.entries(group.keys)) {
      const value = source[code];
      flat[key] = key === 'custom'
        ? decodeCustomSeed(value)
        : key === 'gridStyleCustom'
          ? decodeGridStyleCustom(value)
          : value;
    }
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
    throwCodecError('invalid-json');
  }
  if (!isPlainObject(envelope)) {
    throwCodecError('invalid-json', 'invalid-json-format');
  }
  if (envelope.v !== EXTERNAL_FORMAT_VERSION) {
    throwCodecError('unsupported-version');
  }

  const flat = readExternalSettings(envelope.s);
  const importedPrefs = normalizePdfPrefs(applyImportContext(flat, scoreContext));

  return {
    version: EXTERNAL_FORMAT_VERSION,
    name: sanitizeSharedText(envelope.n, MAX_PDF_PRESET_NAME_CODE_POINTS, 'name'),
    memo: sanitizeSharedText(envelope.m, MAX_PDF_PRESET_MEMO_CODE_POINTS, 'memo'),
    prefs: importedPrefs,
  };
}

/**
 * PDF設定を短い外部コードのenvelopeへ固定順で変換する。
 * CompressionStreamが使える環境では常にgzip形式を返す。
 */
export async function encodePdfPreset({ name, memo, prefs } = {}) {
  const normalizedPrefs = normalizePdfPrefs(prefs);
  const envelope = {
    v: EXTERNAL_FORMAT_VERSION,
    n: sanitizeSharedText(name, MAX_PDF_PRESET_NAME_CODE_POINTS, 'name'),
    m: sanitizeSharedText(memo, MAX_PDF_PRESET_MEMO_CODE_POINTS, 'memo'),
    s: buildExternalSettings(normalizedPrefs),
  };
  const jsonBytes = encodeUtf8(JSON.stringify(envelope));
  if (jsonBytes.byteLength > MAX_PDF_PRESET_JSON_BYTES) {
    throwCodecError('json-too-large', 'json-too-large-input');
  }

  let mode = 'J';
  let payload = jsonBytes;
  if (typeof globalThis.CompressionStream === 'function') {
    mode = 'G';
    payload = await gzipBytes(jsonBytes);
  }
  if (payload.byteLength > MAX_PDF_PRESET_COMPRESSED_BYTES) {
    throwCodecError('compressed-too-large');
  }

  const code = `${CODE_PREFIX}.${mode}.${bytesToBase64Url(payload)}`;
  if (code.length > MAX_PDF_PRESET_INPUT_LENGTH) {
    throwCodecError('input-too-large');
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
  // 旧version（SKYPDF1）と将来のversionは、どちらもこの形式では読めない。
  // 読めないまま既定値へ落として黙って別の設定を適用しないよう、明示的に断る。
  if (parts.length === 3 && /^SKYPDF\d+$/u.test(parts[0]) && parts[0] !== CODE_PREFIX) {
    throwCodecError('unsupported-version');
  }
  validateDecodeParts(parts);

  const payload = base64UrlToBytes(parts[2]);
  let jsonBytes;
  if (parts[1] === 'G') {
    jsonBytes = await gunzipBytes(payload);
  } else {
    if (payload.byteLength > MAX_PDF_PRESET_JSON_BYTES) {
      throwCodecError('json-too-large', 'json-too-large-input');
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
    throwCodecError('invalid-location');
  }

  const path = typeof baseUrl === 'string' && baseUrl ? baseUrl : '/';
  let url;
  try {
    url = new URL(path, locationLike.origin);
  } catch {
    throwCodecError('invalid-location');
  }
  if (url.origin !== locationLike.origin) {
    throwCodecError('invalid-location');
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

function diffValueLabel(group, value) {
  return t(`ui.pdfPreset.value.${group}.${value}`);
}

function keyModeNotationDiffValue(value, keyMode) {
  const safeKeyMode = normalizeKeyMode(keyMode);
  const safeNotationId = normalizeKeyModeNotationId(value);
  return t(`ui.pdfPreset.value.keyModeNotation.${safeNotationId}.${safeKeyMode}`);
}

function resolvePdfPresetValuesForLanguage(prefs, scoreContext) {
  return {
    ...prefs,
    keyModeNotationId: resolveKeyModeNotationIdForLanguage(
      prefs.keyModeNotationId,
      scoreContext?.language,
    ),
  };
}

function formatDiffValue(key, value, scoreContext) {
  switch (key) {
    case 'presetId':
      return value === 'custom' ? t('ui.pdfPreset.value.custom') : diffValueLabel('preset', value);
    case 'custom':
      return t('ui.pdfPreset.value.customPalette');
    case 'gridStyleId':
      return value === 'custom'
        ? t('ui.pdfPreset.value.custom')
        : diffValueLabel('gridStyle', value);
    case 'gridStyleCustom':
      return t('ui.pdfPreset.value.customShape');
    case 'gridNumberDisplayId':
      return diffValueLabel('gridNumber', value);
    case 'fontId':
      return diffValueLabel('font', value);
    case 'fontWeightId':
      return diffValueLabel('fontWeight', value);
    case 'titleFontSizePt':
    case 'metaFontSizePt':
    case 'pageNumberFontSizePt':
      return t('ui.pdfPreset.value.points', { value });
    case 'lyricSizePercent':
    case 'gridNumberSizePercent':
      return t('ui.pdfPreset.value.percent', { value });
    case 'scoreInfoDesignId':
      return diffValueLabel('scoreInfoDesign', value);
    case 'mastheadDirectionId':
      return diffValueLabel('mastheadDirection', value);
    case 'tempoValueModeId':
      return diffValueLabel('tempoValueMode', value);
    case 'customTempoValue':
      return String(value);
    case 'keyNotationId':
      return diffValueLabel('keyNotation', value);
    case 'keyModeNotationId':
      return keyModeNotationDiffValue(value, scoreContext?.keyMode);
    case 'pageNumberFormatId':
      return diffValueLabel('pageNumberFormat', value);
    case 'pageNumberPositionId':
      return diffValueLabel('pageNumberPosition', value);
    case 'runningHeaderId':
      return diffValueLabel('runningHeader', value);
    case 'footerCreditId':
      return diffValueLabel('footerCredit', value);
    case 'sheetLayoutId':
      return diffValueLabel('sheetLayout', value);
    case 'maxRowsPerPage':
      return t('ui.pdfPreset.value.rows', { value });
    case 'columnsPerPageId':
      return diffValueLabel('columnsPerPage', value);
    case 'rowShadingId':
      return diffValueLabel('rowShading', value);
    case 'pageMarginId':
      return diffValueLabel('margin', value);
    case 'gridGapId':
      return diffValueLabel('gap', value);
    default:
      return '';
  }
}

/** 5つの設定sectionごとに、利用者向けラベルで差分を返す。 */
export function buildPdfPresetDiff(currentPrefs, importedPrefs, scoreContext) {
  const current = resolvePdfPresetValuesForLanguage(
    normalizePdfPrefs(currentPrefs),
    scoreContext,
  );
  // 差分は「適用したらどうなるか」なので、読み込み時の解決を通した値と比べる
  const imported = resolvePdfPresetValuesForLanguage(
    normalizePdfPrefs(applyImportContext(importedPrefs, scoreContext)),
    scoreContext,
  );

  return DIFF_GROUPS.map((group) => {
    const changes = group.keys
      .filter((key) => !valuesEqual(current[key], imported[key]))
      .map((key) => ({
        key,
        label: t(`ui.pdfPreset.diff.${key}`),
        current: formatDiffValue(key, current[key], scoreContext),
        imported: formatDiffValue(key, imported[key], scoreContext),
      }));
    return {
      id: group.id,
      label: t(`ui.pdfPreset.group.${group.id}`),
      changed: changes.length > 0,
      changes,
    };
  });
}
