import decodeQR from 'qr/decode.js';
import encodeQR from 'qr';
import {
  extractPdfPresetCode,
  decodePdfPresetCode,
  MAX_PDF_PRESET_INPUT_LENGTH,
  MAX_PDF_PRESET_NAME_CODE_POINTS,
  MAX_PDF_PRESET_MEMO_CODE_POINTS,
} from './pdfPresetCodec.js';

export const PDF_QR_DISPLAY_SIZE = 512;
export const PDF_QR_MAX_DPR = 2;
export const PDF_QR_CARD_WIDTH = 640;
export const PDF_QR_CARD_QR_SIZE = 512;
export const PDF_QR_CARD_QR_X = (PDF_QR_CARD_WIDTH - PDF_QR_CARD_QR_SIZE) / 2;
export const PDF_QR_CARD_QR_Y = 148;
export const PDF_QR_OPTIONS = Object.freeze({
  ecc: 'quartile',
  border: 4,
  scale: 1,
});

const PATH_CHARACTER_RE = /[<>:"/\\|?*\u0000-\u001F\u007F-\u009F]/g;
const CONTROL_CHARACTER_RE = /[\u0000-\u001F\u007F-\u009F]/g;

export class PdfQrError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PdfQrError';
    this.code = code;
  }
}

function throwPdfQrError(code, message) {
  throw new PdfQrError(code, message);
}

function assertQrText(text) {
  if (typeof text !== 'string' || text.length > MAX_PDF_PRESET_INPUT_LENGTH) {
    throwPdfQrError('input-too-large', 'QRコードに入れる設定URLが長すぎます。');
  }
}

function assertSquareMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throwPdfQrError('invalid-matrix', 'QRコードの行列が正しくありません。');
  }
  const size = matrix.length;
  for (const row of matrix) {
    if (!Array.isArray(row) || row.length !== size || row.some((cell) => typeof cell !== 'boolean')) {
      throwPdfQrError('invalid-matrix', 'QRコードの行列が正しくありません。');
    }
  }
  return size;
}

/** qr packageの出力形式と設定をここへ隔離する。 */
export function generatePdfQrMatrix(text) {
  assertQrText(text);
  try {
    return encodeQR(text, 'raw', {
      ecc: 'quartile',
      border: 4,
      scale: 1,
    });
  } catch {
    throwPdfQrError('encode-failed', 'QRコードを作成できませんでした。設定コードをコピーしてください。');
  }
}

function normalizeDpr(value) {
  const dpr = Number(value);
  return Number.isFinite(dpr) && dpr > 0 ? Math.min(PDF_QR_MAX_DPR, dpr) : 1;
}

/** QR行列を白黒RGBAのImageData互換値へ変換する。 */
export function qrMatrixToImageData(matrix, moduleScale = 1) {
  const size = assertSquareMatrix(matrix);
  if (!Number.isSafeInteger(moduleScale) || moduleScale < 1) {
    throwPdfQrError('invalid-scale', 'QRコードの倍率が正しくありません。');
  }
  const width = size * moduleScale;
  if (!Number.isSafeInteger(width) || width > 4096) {
    throwPdfQrError('image-too-large', 'QRコードの画像サイズが大きすぎます。');
  }
  const data = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y += 1) {
    const sourceY = Math.floor(y / moduleScale);
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.floor(x / moduleScale);
      const value = matrix[sourceY][sourceX] ? 0 : 255;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { width, height: width, data };
}

function drawMatrix(ctx, matrix, x, y, areaSize) {
  const size = assertSquareMatrix(matrix);
  const moduleScale = Math.floor(areaSize / size);
  if (moduleScale < 1) {
    throwPdfQrError('draw-failed', 'QRコードを表示できるサイズがありません。');
  }
  const qrSize = moduleScale * size;
  const offset = Math.floor((areaSize - qrSize) / 2);
  ctx.fillStyle = '#000000';
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (matrix[row][column]) {
        ctx.fillRect(x + offset + column * moduleScale, y + offset + row * moduleScale, moduleScale, moduleScale);
      }
    }
  }
  return { moduleScale, qrSize };
}

/** 表示用Canvasへ、整数module倍率のQRを白背景で描く。 */
export function drawPdfQrMatrix(canvas, matrix, {
  cssSize = PDF_QR_DISPLAY_SIZE,
  devicePixelRatio = globalThis.devicePixelRatio,
} = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throwPdfQrError('draw-failed', 'QRコードを表示できませんでした。');
  }
  const size = Number(cssSize);
  if (!Number.isFinite(size) || size < 1) {
    throwPdfQrError('draw-failed', 'QRコードの表示サイズが正しくありません。');
  }
  assertSquareMatrix(matrix);
  const dpr = normalizeDpr(devicePixelRatio);
  const pixelSize = Math.max(1, Math.round(size * dpr));
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  if (canvas.style) {
    canvas.style.width = `${size}px`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throwPdfQrError('draw-failed', 'QRコードを表示できませんでした。');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, pixelSize, pixelSize);
  const result = drawMatrix(ctx, matrix, 0, 0, pixelSize);
  return { canvas, dpr, pixelSize, ...result };
}

function isSameOriginPresetUrl(text, locationLike) {
  const trimmed = text.trim();
  if (!trimmed.includes('#')) return true;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return true;
  }
  if (!url.origin || !locationLike || typeof locationLike.origin !== 'string') return true;
  return url.origin === locationLike.origin;
}

export function isPdfPresetTextSameOrigin(text, locationLike = globalThis.location) {
  return isSameOriginPresetUrl(text, locationLike);
}

/** ImageData互換値をqr packageへ渡し、同一オリジンの設定URLだけを受理する。 */
export function decodePdfQrImageData(imageData, locationLike = globalThis.location) {
  if (!imageData || !Number.isSafeInteger(imageData.width) || !Number.isSafeInteger(imageData.height)) {
    throwPdfQrError('qr-not-found', '画像からQRコードを読み取れませんでした。');
  }
  let text;
  try {
    text = decodeQR(imageData);
  } catch {
    throwPdfQrError('qr-not-found', '画像からQRコードを読み取れませんでした。');
  }
  let code;
  try {
    code = extractPdfPresetCode(text);
  } catch {
    throwPdfQrError('not-pdf-preset', 'PDF設定のQRコードではありません。');
  }
  if (!code) {
    throwPdfQrError('not-pdf-preset', 'PDF設定のQRコードではありません。');
  }
  if (!isSameOriginPresetUrl(text, locationLike)) {
    throwPdfQrError('foreign-origin', '別のサイトの設定URLは読み込めません。');
  }
  return { text, code };
}

/** QR画像の読取と設定codecの検証をまとめた入口。 */
export async function decodePdfPresetQrImageData(imageData, scoreContext, locationLike = globalThis.location) {
  const { text, code } = decodePdfQrImageData(imageData, locationLike);
  return {
    ...await decodePdfPresetCode(code, scoreContext),
    code,
    text,
  };
}

/* カードの意匠は画面（src/styles/index.css）のトークンに合わせる。
   別配色にすると、同じサイトから出た画像に見えなくなる。 */
const CARD_SURFACE = '#FFFFFF';
const CARD_BORDER = '#E3E7EF';
const CARD_PRIMARY = '#3B5BDB';
const CARD_ACCENT = '#F2C078';
const CARD_TEXT = '#1F2733';
const CARD_TEXT_MUTED = '#6B7480';
const CARD_TEXT_BODY = '#4A5261';
/* 画面表示と同じ書体。未読込のときだけ後段のフォールバックが使われる。 */
const CARD_FONT_STACK = "'Noto Sans JP', system-ui, sans-serif";

const CARD_CONTENT_LEFT = 56;
const CARD_ACCENT_HEIGHT = 6;
const CARD_TITLE_TOP = 50;
const CARD_HEADER_RULE_Y = 104;
const CARD_CAPTION_TOP = 690;
const CARD_CAPTION_BOTTOM = 706;
const CARD_RULE_GAP = 38;
const CARD_RULE_Y = CARD_CAPTION_BOTTOM + CARD_RULE_GAP;
const CARD_DETAILS_TOP = CARD_RULE_Y + 36;
const CARD_LABEL_ADVANCE = 18;
const CARD_NAME_LEADING = 26;
const CARD_MEMO_LEADING = 20;
const CARD_MEMO_GAP = 14;
const CARD_PADDING_BOTTOM = 40;

/** 行数から高さを出す。折り返した名前・メモがカード外へ出ないようにするため。 */
function measureCardHeight(nameLineCount, memoLineCount) {
  if (nameLineCount < 1 && memoLineCount < 1) return CARD_RULE_Y;
  let y = CARD_DETAILS_TOP;
  if (nameLineCount > 0) y += CARD_LABEL_ADVANCE + CARD_NAME_LEADING * nameLineCount;
  if (memoLineCount > 0) {
    if (nameLineCount > 0) y += CARD_MEMO_GAP;
    y += CARD_LABEL_ADVANCE + CARD_MEMO_LEADING * memoLineCount;
  }
  return y + CARD_PADDING_BOTTOM;
}

export const PDF_QR_CARD_HEIGHT = measureCardHeight(1, 1);
export const PDF_QR_CARD_COMPACT_HEIGHT = measureCardHeight(1, 0);
export const PDF_QR_CARD_EMPTY_HEIGHT = measureCardHeight(0, 0);

function cleanCardText(value, maxCodePoints) {
  if (typeof value !== 'string') return '';
  return [...value.replace(CONTROL_CHARACTER_RE, '')].slice(0, maxCodePoints).join('');
}

/** 小さなラベルは字間を空けて見出しらしくする。未対応環境では字間だけ効かない。 */
function drawCardLabel(ctx, label, x, y) {
  ctx.fillStyle = CARD_TEXT_MUTED;
  ctx.font = `bold 10px ${CARD_FONT_STACK}`;
  ctx.letterSpacing = '2px';
  ctx.fillText(label, x, y);
  ctx.letterSpacing = '0px';
}

function wrapCanvasText(ctx, value, maxWidth) {
  const lines = [];
  let line = '';
  for (const character of value) {
    const candidate = line + character;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

/** 同じ行列から、QRと名前・メモを含む保存用白背景カードを作る。 */
export function buildPdfPresetQrCardCanvas({
  text,
  matrix = generatePdfQrMatrix(text),
  name = '',
  memo = '',
  canvas = null,
} = {}) {
  if (!canvas) {
    if (!globalThis.document || typeof globalThis.document.createElement !== 'function') {
      throwPdfQrError('draw-failed', 'QRカードを作成できませんでした。');
    }
    canvas = globalThis.document.createElement('canvas');
  }
  const width = PDF_QR_CARD_WIDTH;
  const contentLeft = CARD_CONTENT_LEFT;
  const contentWidth = width - contentLeft * 2;
  const title = 'Sky楽譜エディター';
  const safeName = cleanCardText(name, MAX_PDF_PRESET_NAME_CODE_POINTS).trim();
  const safeMemo = cleanCardText(memo, MAX_PDF_PRESET_MEMO_CODE_POINTS).trim();
  const ctx = canvas.getContext('2d');
  if (!ctx) throwPdfQrError('draw-failed', 'QRカードを作成できませんでした。');

  /* 高さは折り返し後の行数から決めるため、先に測ってから canvas を確定する。
     canvas のサイズ変更は描画状態を捨てるので、描画設定はこの後にまとめて置く。 */
  ctx.font = `bold 18px ${CARD_FONT_STACK}`;
  const nameLines = safeName ? wrapCanvasText(ctx, safeName, contentWidth) : [];
  ctx.font = `14px ${CARD_FONT_STACK}`;
  const memoLines = safeMemo ? wrapCanvasText(ctx, safeMemo, contentWidth) : [];
  canvas.width = width;
  canvas.height = measureCardHeight(nameLines.length, memoLines.length);
  const height = canvas.height;

  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'top';
  ctx.fillStyle = CARD_SURFACE;
  ctx.fillRect(0, 0, width, height);

  /* 上端の2色は画面のグリッド強調色（レイヤー1／2）と同じ。 */
  ctx.fillStyle = CARD_PRIMARY;
  ctx.fillRect(0, 0, width - 192, CARD_ACCENT_HEIGHT);
  ctx.fillStyle = CARD_ACCENT;
  ctx.fillRect(width - 192, 0, 192, CARD_ACCENT_HEIGHT);

  /* 白背景へ貼られてもカードの縁が分かるようにする。 */
  ctx.fillStyle = CARD_BORDER;
  ctx.fillRect(0, CARD_ACCENT_HEIGHT, 1, height - CARD_ACCENT_HEIGHT);
  ctx.fillRect(width - 1, CARD_ACCENT_HEIGHT, 1, height - CARD_ACCENT_HEIGHT);
  ctx.fillRect(0, height - 1, width, 1);
  ctx.fillRect(contentLeft, CARD_HEADER_RULE_Y, contentWidth, 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = CARD_TEXT;
  ctx.font = `bold 21px ${CARD_FONT_STACK}`;
  ctx.fillText(title, contentLeft, CARD_TITLE_TOP);
  ctx.textAlign = 'right';
  ctx.fillStyle = CARD_TEXT_MUTED;
  ctx.font = `13px ${CARD_FONT_STACK}`;
  ctx.fillText('PDF出力設定', width - contentLeft, CARD_TITLE_TOP + 8);

  ctx.fillStyle = CARD_SURFACE;
  ctx.fillRect(
    PDF_QR_CARD_QR_X,
    PDF_QR_CARD_QR_Y,
    PDF_QR_CARD_QR_SIZE,
    PDF_QR_CARD_QR_SIZE,
  );
  drawMatrix(
    ctx,
    matrix,
    PDF_QR_CARD_QR_X,
    PDF_QR_CARD_QR_Y,
    PDF_QR_CARD_QR_SIZE,
  );

  ctx.textAlign = 'center';
  ctx.fillStyle = CARD_TEXT_MUTED;
  ctx.font = `12px ${CARD_FONT_STACK}`;
  ctx.fillText('このQRコードからPDF設定を読み込めます', width / 2, CARD_CAPTION_TOP);

  if (nameLines.length === 0 && memoLines.length === 0) return canvas;

  ctx.fillStyle = CARD_BORDER;
  ctx.fillRect(contentLeft, CARD_RULE_Y, contentWidth, 1);
  ctx.textAlign = 'left';

  let y = CARD_DETAILS_TOP;
  if (nameLines.length > 0) {
    drawCardLabel(ctx, 'PRESET', contentLeft, y);
    y += CARD_LABEL_ADVANCE;
    ctx.fillStyle = CARD_TEXT;
    ctx.font = `bold 18px ${CARD_FONT_STACK}`;
    for (const line of nameLines) {
      ctx.fillText(line, contentLeft, y);
      y += CARD_NAME_LEADING;
    }
    y += CARD_MEMO_GAP;
  }
  if (memoLines.length > 0) {
    drawCardLabel(ctx, 'MEMO', contentLeft, y);
    y += CARD_LABEL_ADVANCE;
    ctx.fillStyle = CARD_TEXT_BODY;
    ctx.font = `14px ${CARD_FONT_STACK}`;
    for (const line of memoLines) {
      ctx.fillText(line, contentLeft, y);
      y += CARD_MEMO_LEADING;
    }
  }
  return canvas;
}

function sanitizeFilenamePart(value) {
  const cleaned = typeof value === 'string' ? value.replace(PATH_CHARACTER_RE, '').trim() : '';
  return [...cleaned].slice(0, MAX_PDF_PRESET_NAME_CODE_POINTS).join('') || 'preset';
}

export function buildPdfPresetQrFilename(name, date = new Date()) {
  const timestamp = date instanceof Date && !Number.isNaN(date.valueOf())
    ? date
    : new Date(0);
  const two = (value) => String(value).padStart(2, '0');
  const stamp = `${timestamp.getFullYear()}${two(timestamp.getMonth() + 1)}${two(timestamp.getDate())}-${two(timestamp.getHours())}${two(timestamp.getMinutes())}${two(timestamp.getSeconds())}`;
  return `sky-pdf-preset-${sanitizeFilenamePart(name)}-${stamp}.png`;
}

function canvasToPngBlob(canvas) {
  if (!canvas || typeof canvas.toBlob !== 'function') {
    throwPdfQrError('save-failed', 'QRカードをPNGとして保存できませんでした。');
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new PdfQrError('save-failed', 'QRカードをPNGとして保存できませんでした。'));
    }, 'image/png');
  });
}

/** PNGを作り、ブラウザ上ではダウンロードを開始する。 */
export async function savePdfPresetQrCard(canvas, name, date = new Date()) {
  let blob;
  try {
    blob = await canvasToPngBlob(canvas);
  } catch (error) {
    if (error instanceof PdfQrError) throw error;
    throwPdfQrError('save-failed', 'QRカードをPNGとして保存できませんでした。');
  }
  const filename = buildPdfPresetQrFilename(name, date);
  if (globalThis.document && typeof globalThis.document.createElement === 'function'
    && globalThis.URL && typeof globalThis.URL.createObjectURL === 'function') {
    const link = globalThis.document.createElement('a');
    const objectUrl = globalThis.URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    link.click();
    if (typeof globalThis.URL.revokeObjectURL === 'function') globalThis.URL.revokeObjectURL(objectUrl);
  }
  return { blob, filename };
}
