import { MAX_PDF_PRESET_INPUT_LENGTH } from './pdfPresetConstants.js';

/** URL hashから設定共有値を取り出す。値は上限以内のときだけ返す。 */
export function readPdfPresetFragment(locationLike = globalThis.location) {
  const hash = typeof locationLike?.hash === 'string' ? locationLike.hash : '';
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  if (!params.has('pdf-preset')) return null;
  const value = params.get('pdf-preset') ?? '';
  if (value.length > MAX_PDF_PRESET_INPUT_LENGTH) {
    return { value: '', tooLarge: true, remainingHash: null };
  }
  params.delete('pdf-preset');
  const remainingHash = params.toString();
  return {
    value,
    tooLarge: false,
    remainingHash: remainingHash ? `#${remainingHash}` : '',
  };
}
