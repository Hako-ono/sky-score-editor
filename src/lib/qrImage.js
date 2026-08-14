export const MAX_QR_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_QR_IMAGE_LONG_EDGE = 2_048;
export const MAX_QR_IMAGE_PIXELS = 4_194_304;
export const QR_IMAGE_MIME_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const QR_IMAGE_MIME_SET = new Set(QR_IMAGE_MIME_TYPES);

export class QrImageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QrImageError';
    this.code = code;
  }
}

function throwQrImageError(code, message) {
  throw new QrImageError(code, message);
}

/** 元画像の縦横比を保ったまま、長辺・総画素数の両上限へ収める。 */
export function fitQrImageDimensions(rawWidth, rawHeight) {
  const width = Number(rawWidth);
  const height = Number(rawHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throwQrImageError('invalid-dimensions', '画像のサイズを確認できませんでした。');
  }
  const scale = Math.min(
    1,
    MAX_QR_IMAGE_LONG_EDGE / Math.max(width, height),
    Math.sqrt(MAX_QR_IMAGE_PIXELS / (width * height)),
  );
  let fittedWidth = Math.max(1, Math.floor(width * scale));
  let fittedHeight = Math.max(1, Math.floor(height * scale));
  while (Math.max(fittedWidth, fittedHeight) > MAX_QR_IMAGE_LONG_EDGE
    || fittedWidth * fittedHeight > MAX_QR_IMAGE_PIXELS) {
    if (fittedWidth >= fittedHeight) fittedWidth -= 1;
    else fittedHeight -= 1;
  }
  return { width: fittedWidth, height: fittedHeight, scale };
}

function validateFile(file) {
  if (!file || typeof file !== 'object') {
    throwQrImageError('invalid-file', '画像ファイルを選んでください。');
  }
  const size = Number(file.size);
  if (Number.isFinite(size) && size > MAX_QR_IMAGE_FILE_BYTES) {
    throwQrImageError('file-too-large', '画像ファイルが大きすぎます（上限10MiB）。');
  }
  if (typeof file.type === 'string' && file.type && !QR_IMAGE_MIME_SET.has(file.type.toLowerCase())) {
    throwQrImageError('unsupported-type', 'PNG、JPEG、またはWebP画像を選んでください。');
  }
}

function readFileAsDataUrl(file) {
  if (typeof globalThis.FileReader !== 'function') {
    throwQrImageError('decode-failed', '画像を読み取れませんでした。');
  }
  return new Promise((resolve, reject) => {
    const reader = new globalThis.FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new QrImageError('decode-failed', '画像を読み取れませんでした。'));
    };
    reader.onerror = () => reject(new QrImageError('decode-failed', '画像を読み取れませんでした。'));
    reader.onabort = () => reject(new QrImageError('decode-failed', '画像を読み取れませんでした。'));
    reader.readAsDataURL(file);
  });
}

function decodeDataUrl(dataUrl) {
  if (typeof globalThis.Image !== 'function') {
    throwQrImageError('decode-failed', '画像を読み取れませんでした。');
  }
  return new Promise((resolve, reject) => {
    const image = new globalThis.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new QrImageError('decode-failed', '画像を読み取れませんでした。'));
    image.src = dataUrl;
  });
}

async function decodeSource(file) {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      return { source: await globalThis.createImageBitmap(file), isBitmap: true };
    } catch {
      throw new QrImageError('decode-failed', '画像を読み取れませんでした。');
    }
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    return { source: await decodeDataUrl(dataUrl), isBitmap: false };
  } catch (error) {
    if (error instanceof QrImageError) throw error;
    throw new QrImageError('decode-failed', '画像を読み取れませんでした。');
  }
}

/** 画像を縮小してImageData互換値へ変換する。data URLや画素列を保持しない。 */
export async function loadQrImageFile(file) {
  validateFile(file);
  const decoded = await decodeSource(file);
  const source = decoded.source;
  try {
    const sourceWidth = decoded.isBitmap ? source.width : source.naturalWidth;
    const sourceHeight = decoded.isBitmap ? source.height : source.naturalHeight;
    const dimensions = fitQrImageDimensions(sourceWidth, sourceHeight);
    if (!globalThis.document || typeof globalThis.document.createElement !== 'function') {
      throwQrImageError('canvas-failed', '画像を処理できませんでした。');
    }
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throwQrImageError('canvas-failed', '画像を処理できませんでした。');
    try {
      context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
      const imageData = context.getImageData(0, 0, dimensions.width, dimensions.height);
      return { ...dimensions, imageData };
    } catch {
      throwQrImageError('canvas-failed', '画像を処理できませんでした。');
    }
  } finally {
    if (decoded.isBitmap && source && typeof source.close === 'function') source.close();
  }
}

/** 新しいファイル選択が来たら、古い非同期処理の結果をnullへ捨てる。 */
export function createQrImageLoader() {
  let requestId = 0;
  return {
    async load(file) {
      const currentId = ++requestId;
      const result = await loadQrImageFile(file);
      return currentId === requestId ? result : null;
    },
    cancel() {
      requestId += 1;
    },
  };
}
