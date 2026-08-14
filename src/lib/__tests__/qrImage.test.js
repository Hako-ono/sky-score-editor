import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_QR_IMAGE_FILE_BYTES,
  MAX_QR_IMAGE_LONG_EDGE,
  MAX_QR_IMAGE_PIXELS,
  QrImageError,
  createQrImageLoader,
  fitQrImageDimensions,
  loadQrImageFile,
} from '../qrImage.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubCanvas() {
  const imageData = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => imageData),
  };
  const document = {
    createElement: vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    })),
  };
  vi.stubGlobal('document', document);
  return { context, document, imageData };
}

describe('qrImage', () => {
  it('長辺・総画素の境界を満たし、巨大画像を2048px以下へ縮小する', () => {
    expect(fitQrImageDimensions(MAX_QR_IMAGE_LONG_EDGE, MAX_QR_IMAGE_LONG_EDGE))
      .toMatchObject({ width: 2048, height: 2048 });
    expect(fitQrImageDimensions(4096, 1024)).toMatchObject({ width: 2048, height: 512 });
    expect(fitQrImageDimensions(4096, 4096)).toMatchObject({ width: 2048, height: 2048 });
    expect(fitQrImageDimensions(5000, 1000).width).toBe(2048);

    const result = fitQrImageDimensions(100_000, 100_000);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(MAX_QR_IMAGE_LONG_EDGE);
    expect(result.width * result.height).toBeLessThanOrEqual(MAX_QR_IMAGE_PIXELS);
  });

  it('createImageBitmapを第一経路に使い、MIME空欄でも実デコードできれば許可する', async () => {
    const { context } = stubCanvas();
    const close = vi.fn();
    const createImageBitmap = vi.fn(async () => ({ width: 20, height: 10, close }));
    vi.stubGlobal('createImageBitmap', createImageBitmap);

    const result = await loadQrImageFile({
      size: MAX_QR_IMAGE_FILE_BYTES,
      type: '',
      name: 'not-trusted-by-extension.txt',
    });

    expect(createImageBitmap).toHaveBeenCalledOnce();
    expect(result.width).toBe(20);
    expect(result.height).toBe(10);
    expect(context.getImageData).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('10MiB超過と非対応MIMEはデコード前に拒否する', async () => {
    const createImageBitmap = vi.fn();
    vi.stubGlobal('createImageBitmap', createImageBitmap);

    await expect(loadQrImageFile({ size: MAX_QR_IMAGE_FILE_BYTES + 1, type: 'image/png' }))
      .rejects.toThrowError(expect.objectContaining({ code: 'file-too-large' }));
    await expect(loadQrImageFile({ size: 1, type: 'image/gif' }))
      .rejects.toThrowError(expect.objectContaining({ code: 'unsupported-type' }));
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('新しいファイル選択が古い非同期結果を破棄する', async () => {
    const { context } = stubCanvas();
    const deferred = new Map();
    vi.stubGlobal('createImageBitmap', vi.fn((file) => new Promise((resolve) => {
      deferred.set(file.name, resolve);
    })));
    const loader = createQrImageLoader();
    const first = loader.load({ size: 1, type: 'image/png', name: 'first' });
    const second = loader.load({ size: 1, type: 'image/png', name: 'second' });

    deferred.get('second')({ width: 2, height: 2, close: vi.fn() });
    await expect(second).resolves.toEqual(expect.objectContaining({ width: 2, height: 2 }));
    deferred.get('first')({ width: 1, height: 1, close: vi.fn() });
    await expect(first).resolves.toBeNull();
    expect(context.getImageData).toHaveBeenCalledTimes(2);
  });

  it('画像デコード失敗をQR未検出とは別のQrImageErrorにする', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      throw new Error('broken');
    }));
    await expect(loadQrImageFile({ size: 1, type: 'image/png' }))
      .rejects.toThrowError(new QrImageError('decode-failed', '画像を読み取れませんでした。'));
  });
});
