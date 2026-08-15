import { describe, expect, it } from 'vitest';
import { MAX_PDF_PRESET_INPUT_LENGTH } from '../pdfPresetCodec.js';
import { readPdfPresetFragment } from '../pdfPresetUrl.js';

describe('pdfPresetUrl', () => {
  it('pdf-presetだけを読み取り、他のhash parameterを残す', () => {
    expect(readPdfPresetFragment({ hash: '#foo=1&pdf-preset=SKYPDF2.J.eA&bar=日本語' }))
      .toEqual({ value: 'SKYPDF2.J.eA', tooLarge: false, remainingHash: '#foo=1&bar=%E6%97%A5%E6%9C%AC%E8%AA%9E' });
  });

  it('上限超過値はメモリへ取り込まず、URLからも自動削除しない', () => {
    expect(readPdfPresetFragment({ hash: `#pdf-preset=${'x'.repeat(MAX_PDF_PRESET_INPUT_LENGTH + 1)}` }))
      .toEqual({ value: '', tooLarge: true, remainingHash: null });
  });

  it('設定fragmentが無ければ何もしない', () => {
    expect(readPdfPresetFragment({ hash: '#foo=1' })).toBeNull();
  });
});
