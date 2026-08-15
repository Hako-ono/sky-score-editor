import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PDF_QR_DISPLAY_SIZE,
  PDF_QR_MAX_DPR,
  PDF_QR_OPTIONS,
  PDF_QR_CARD_COMPACT_HEIGHT,
  PDF_QR_CARD_EMPTY_HEIGHT,
  PDF_QR_CARD_HEIGHT,
  PDF_QR_CARD_QR_SIZE,
  PDF_QR_CARD_QR_X,
  PDF_QR_CARD_QR_Y,
  PDF_QR_CARD_WIDTH,
  PdfQrError,
  buildPdfPresetQrCardCanvas,
  buildPdfPresetQrFilename,
  decodePdfQrImageData,
  drawPdfQrMatrix,
  generatePdfQrMatrix,
  qrMatrixToImageData,
  savePdfPresetQrCard,
} from '../pdfQr.js';
import { encodePdfPreset, buildPdfPresetUrl } from '../pdfPresetCodec.js';
import {
  MAX_PDF_PRESET_NAME_CODE_POINTS,
  MAX_PDF_PRESET_MEMO_CODE_POINTS,
} from '../pdfPresetConstants.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pdfQr', () => {
  it('raw行列を白黒ImageDataへ変換し、同じqr packageで元URLを読める', async () => {
    const code = await encodePdfPreset({ name: 'QR', prefs: {} });
    const url = buildPdfPresetUrl(code, { origin: 'https://example.test' }, '/app/');
    const matrix = generatePdfQrMatrix(url);
    const imageData = qrMatrixToImageData(matrix, 4);

    expect(imageData.width).toBe(imageData.height);
    expect(imageData.data[0]).toBe(255);
    expect(decodePdfQrImageData(imageData, { origin: 'https://example.test' })).toEqual({
      text: url,
      code,
    });
  });

  /*
   * `qr@0.6.0` のデコーダは、QRが大きくなると1モジュール4pxで描いた綺麗な
   * 画像でも読み取りに失敗することがある（実測：サイズ121以下では0/25、
   * 129以上では2/25が失敗）。
   * 設定を増やしてもその領域へ入らないことを、名前・メモを最大長の
   * 最悪ケースで固定する。**通らなくなったら上限を上げるのではなく
   * 外部形式（pdfPresetCodec.js）を短くすること。**
   */
  it('名前とメモが最大長でも、QRは読み取りが安定するサイズに収まる', async () => {
    const code = await encodePdfPreset({
      name: 'あ'.repeat(MAX_PDF_PRESET_NAME_CODE_POINTS),
      memo: 'あ'.repeat(MAX_PDF_PRESET_MEMO_CODE_POINTS),
      prefs: {},
    });
    const url = buildPdfPresetUrl(code, { origin: 'https://example.test' }, '/app/');
    const matrix = generatePdfQrMatrix(url);

    expect(matrix.length).toBeLessThanOrEqual(121);
    expect(decodePdfQrImageData(
      qrMatrixToImageData(matrix, 4),
      { origin: 'https://example.test' },
    )).toEqual({ text: url, code });
  });

  it('quartile、quiet zone 4、512 CSS px基準、DPR上限2をwrapperで固定する', () => {
    expect(PDF_QR_OPTIONS).toEqual({ ecc: 'quartile', border: 4, scale: 1 });
    const matrix = generatePdfQrMatrix('SKYPDF2.J.eyJ2ZXJzaW9uIjoxfQ');
    const context = {
      imageSmoothingEnabled: true,
      fillStyle: '',
      fillRect: vi.fn(),
    };
    const canvas = {
      style: {},
      getContext: vi.fn(() => context),
    };

    const result = drawPdfQrMatrix(canvas, matrix, {
      cssSize: PDF_QR_DISPLAY_SIZE,
      devicePixelRatio: 4,
    });

    expect(result.dpr).toBe(PDF_QR_MAX_DPR);
    expect(canvas.width).toBe(PDF_QR_DISPLAY_SIZE * PDF_QR_MAX_DPR);
    expect(canvas.style.width).toBe('512px');
    // 狭い画面ではCSSのmax-widthとintrinsic aspect ratioに追従させる。
    // inline heightを固定すると横幅だけ縮み、QRが縦長に歪む。
    expect(canvas.style.height).toBeUndefined();
    expect(context.imageSmoothingEnabled).toBe(false);
    expect(context.fillRect).toHaveBeenCalled();
  });

  it('任意文字列、設定コードのないURL、別origin URLは設定として受理しない', () => {
    const inputs = [
      { text: 'https://example.test/#hello', expected: 'not-pdf-preset' },
      { text: 'https://example.test/#pdf-preset=not-a-setting-code', expected: 'not-pdf-preset' },
      { text: 'https://other.test/#pdf-preset=SKYPDF2.J.eA', expected: 'foreign-origin' },
    ];
    for (const { text, expected } of inputs) {
      const imageData = qrMatrixToImageData(generatePdfQrMatrix(text), 4);
      expect(() => decodePdfQrImageData(imageData, { origin: 'https://example.test' }))
        .toThrowError(expect.objectContaining({ code: expected }));
    }
  });

  it('入力上限を超えるQR文字列を生成しない', () => {
    expect(() => generatePdfQrMatrix('x'.repeat(8_193)))
      .toThrowError(expect.objectContaining({ code: 'input-too-large' }));
  });

  it('カードは名前・メモをCanvasの文字として扱い、PNG保存名からパス文字を除去する', async () => {
    const textCalls = [];
    const context = {
      imageSmoothingEnabled: true,
      fillStyle: '',
      textAlign: '',
      textBaseline: '',
      font: '',
      fillRect: vi.fn(),
      fillText: vi.fn((value) => textCalls.push(value)),
      measureText: vi.fn((value) => ({ width: [...value].length * 8 })),
    };
    const canvas = {
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback, type) => callback(new Blob(['png'], { type }))),
    };
    const card = buildPdfPresetQrCardCanvas({
      matrix: [[false, true], [true, false]],
      name: '<script>alert(1)</script>',
      memo: '<script>memo</script>',
      canvas,
    });

    expect(card).toBe(canvas);
    expect(textCalls).toContain('<script>alert(1)</script>');
    expect(textCalls).toContain('<script>memo</script>');
    expect(textCalls).toContain('Sky楽譜エディター');
    expect(textCalls).not.toContain('PDF SETTINGS');
    expect(textCalls).not.toContain('保存・共有');
    expect(canvas.height).toBe(PDF_QR_CARD_HEIGHT);
    expect(canvas.innerHTML).toBeUndefined();

    const saved = await savePdfPresetQrCard(canvas, 'a/b\\c', new Date(2026, 7, 14, 9, 5, 3));
    expect(saved.blob.type).toBe('image/png');
    expect(saved.filename).toBe('sky-pdf-preset-abc-20260814-090503.png');
    expect(buildPdfPresetQrFilename('x:y', new Date(0))).toMatch(/^sky-pdf-preset-xy-/u);
  });

  it('メモが空ならMEMO欄を描かず、カードを短くする', () => {
    const textCalls = [];
    const context = {
      imageSmoothingEnabled: true,
      fillStyle: '',
      textAlign: '',
      textBaseline: '',
      font: '',
      fillRect: vi.fn(),
      fillText: vi.fn((value) => textCalls.push(value)),
      measureText: vi.fn((value) => ({ width: [...value].length * 8 })),
    };
    const canvas = { getContext: vi.fn(() => context) };

    buildPdfPresetQrCardCanvas({
      matrix: [[false, true], [true, false]],
      name: '名前だけのプリセット',
      memo: '   ',
      canvas,
    });

    expect(canvas.height).toBe(PDF_QR_CARD_COMPACT_HEIGHT);
    expect(textCalls).toContain('PRESET');
    expect(textCalls).not.toContain('MEMO');
    expect(textCalls).not.toContain('（メモなし）');
  });

  it('名前とメモが空ならカード下部の情報欄を描かない', () => {
    const textCalls = [];
    const context = {
      imageSmoothingEnabled: true,
      fillStyle: '',
      textAlign: '',
      textBaseline: '',
      font: '',
      fillRect: vi.fn(),
      fillText: vi.fn((value) => textCalls.push(value)),
      measureText: vi.fn((value) => ({ width: [...value].length * 8 })),
    };
    const canvas = { getContext: vi.fn(() => context) };

    buildPdfPresetQrCardCanvas({
      matrix: [[false, true], [true, false]],
      name: '',
      memo: '',
      canvas,
    });

    expect(canvas.height).toBe(PDF_QR_CARD_EMPTY_HEIGHT);
    expect(textCalls).not.toContain('PRESET');
    expect(textCalls).not.toContain('MEMO');
    expect(textCalls).not.toContain('（名前なし）');
    expect(textCalls).not.toContain('（メモなし）');
  });

  it('カードへ描いたQR領域は、同じURLを再び読み取れる', async () => {
    const code = await encodePdfPreset({ name: 'card', prefs: {} });
    const url = buildPdfPresetUrl(code, { origin: 'https://example.test' }, '/app/');
    const pixels = new Uint8ClampedArray(PDF_QR_CARD_WIDTH * PDF_QR_CARD_HEIGHT * 4);
    const context = {
      imageSmoothingEnabled: true,
      fillStyle: '',
      textAlign: '',
      textBaseline: '',
      font: '',
      fillRect: vi.fn((x, y, width, height) => {
        const value = context.fillStyle === '#000000' ? 0 : 255;
        for (let row = y; row < y + height; row += 1) {
          for (let column = x; column < x + width; column += 1) {
            const offset = (row * PDF_QR_CARD_WIDTH + column) * 4;
            pixels[offset] = value;
            pixels[offset + 1] = value;
            pixels[offset + 2] = value;
            pixels[offset + 3] = 255;
          }
        }
      }),
      fillText: vi.fn(),
      measureText: vi.fn((value) => ({ width: [...value].length * 8 })),
    };
    const canvas = { getContext: vi.fn(() => context) };
    buildPdfPresetQrCardCanvas({ text: url, name: 'card', memo: 'memo', canvas });

    expect(decodePdfQrImageData({
      width: PDF_QR_CARD_WIDTH,
      height: PDF_QR_CARD_HEIGHT,
      data: pixels,
    }, {
      origin: 'https://example.test',
    })).toEqual({ text: url, code });

    const qrPixels = new Uint8ClampedArray(PDF_QR_CARD_QR_SIZE * PDF_QR_CARD_QR_SIZE * 4);
    for (let row = 0; row < PDF_QR_CARD_QR_SIZE; row += 1) {
      for (let column = 0; column < PDF_QR_CARD_QR_SIZE; column += 1) {
        const sourceOffset = (
          (row + PDF_QR_CARD_QR_Y) * PDF_QR_CARD_WIDTH + column + PDF_QR_CARD_QR_X
        ) * 4;
        const targetOffset = (row * PDF_QR_CARD_QR_SIZE + column) * 4;
        qrPixels[targetOffset] = pixels[sourceOffset];
        qrPixels[targetOffset + 1] = pixels[sourceOffset + 1];
        qrPixels[targetOffset + 2] = pixels[sourceOffset + 2];
        qrPixels[targetOffset + 3] = pixels[sourceOffset + 3];
      }
    }
    expect(decodePdfQrImageData({
      width: PDF_QR_CARD_QR_SIZE,
      height: PDF_QR_CARD_QR_SIZE,
      data: qrPixels,
    }, {
      origin: 'https://example.test',
    })).toEqual({ text: url, code });
  });

  it('PDF QRのcodecエラーは利用者向けPdfQrErrorとして返す', () => {
    expect(() => drawPdfQrMatrix(null, [[true]])).toThrowError(PdfQrError);
  });
});
