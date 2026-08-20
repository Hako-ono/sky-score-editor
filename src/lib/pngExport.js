/**
 * PNG出力。生成経路は従来のPDFと同じ（jsPDF + svg2pdf.js）ものを流用し、
 * `buildPdfBlob` で得たPDFのBlobを `pdfRaster.js`（pdf.js）でクライアント
 * サイドにラスタライズしてPNG化する。複数ページは自前実装の無圧縮ZIP
 * （`zipStore.js`）でまとめる。
 *
 * SVGから直接ラスタライズしない理由：1ページの見た目は「SVG本体（グリッド）＋
 * doc.textによる曲名・柱・ノンブル＋doc.addImageによる背景画像」の合成であり、
 * SVG単体では再現できない。PDFを唯一の正とし、PNGはその忠実なラスタ化に徹する。
 */

import { t } from '../i18n/index.js';
import { buildPdfBlob } from './pdfExport.js';
import { openPdfForRaster } from './pdfRaster.js';
import { createStoreZipBlob } from './zipStore.js';
import { normalizePngDpi } from '../constants/config.js';
import { tryShareFile } from './webShare.js';

// 生成したPNGの合計バイト数の上限。超えたら中止してエラーを返す。実測値では
// なく、実機での確認を経て見直す前提の仮の値。
// 最後まで作ってから落ちるより、途中で止めるほうがiPhoneでは安全なため、
// ページを積み増すたびに確認する。
export const MAX_PNG_TOTAL_BYTES = 200 * 1024 * 1024;

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(
    d.getHours(),
  )}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// pdfExport.js の yieldToBrowser と同じ理由：canvasの描画・toBlob(PNGエンコード)は
// ページ数に比例してメインスレッドを占有するため、ページごとに明示的に
// ブラウザへ処理を譲る。
function yieldToBrowser() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error(t('ui.app.pngFailed', { message: 'toBlob() failed' })));
      }
    }, 'image/png');
  });
}

// `openOrDownloadPdfBlob`（pdfExport.js）は先に window.open を試すが、PNG/ZIPで
// 同じことをするとタブの挙動がブラウザ依存になるため使い回さない。
// <a download> をクリックするだけの、より単純な手順にする。
//
// iOSのスタンドアロンPWAでは <a download> が別ページへ遷移したように見える
// （詳細は webShare.js）ため、その文脈でだけ共有シートを先に試す。
// @returns {Promise<boolean>} 共有シートに渡せた場合 true
async function downloadBlob(blob, filename, mimeType) {
  if (await tryShareFile(blob, filename, mimeType)) return true;
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  return false;
}

function pageFileName(pageIndex, pageCount) {
  const digits = pageCount >= 1000 ? 4 : 3;
  return `page_${String(pageIndex + 1).padStart(digits, '0')}.png`;
}

/**
 * @param {*} score exportPdf/buildPdfBlob と同じ形。
 * @param {*} options exportPdf/buildPdfBlob と同じ形に加え、`pngDpi`
 *   （96|150|200、既定150）を持つ。
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<{ filename: string, pageCount: number, shared: boolean }>}
 */
export async function exportPng(score, options, onProgress = () => {}) {
  const dpi = normalizePngDpi(options?.pngDpi);
  const scale = dpi / 72; // PDFの1ptが1/72inchのため

  // PNG出力はPDFの組み立てとラスタライズの2段構成で、どちらもページ単位の
  // ループになる。1段目の進捗をPDF向けの文言のまま流すと「PNGを生成」を
  // 押したのに「PDFページ n/N」と出るうえ、カウンタが2周する理由も伝わらない。
  // 段階を明示した専用の文言へ差し替える。
  const { blob: pdfBlob } = await buildPdfBlob(
    score,
    options,
    onProgress,
    'ui.progress.pngBuilding',
  );

  let raster = null;
  const canvas = document.createElement('canvas');
  try {
    raster = await openPdfForRaster(pdfBlob);
    const { pageCount } = raster;

    const pngBlobs = [];
    let totalBytes = 0;

    for (let i = 0; i < pageCount; i += 1) {
      onProgress(t('ui.progress.pngRendering', { page: i + 1, total: pageCount }));
      await raster.renderPage(i, canvas, scale);
      const pngBlob = await canvasToPngBlob(canvas);

      totalBytes += pngBlob.size;
      if (totalBytes > MAX_PNG_TOTAL_BYTES) {
        throw new Error(t('ui.app.pngTooLarge'));
      }
      pngBlobs.push(pngBlob);

      await yieldToBrowser();
    }

    const stamp = timestamp();
    if (pageCount === 1) {
      const filename = `sky_score_${stamp}.png`;
      const shared = await downloadBlob(pngBlobs[0], filename, 'image/png');
      return { filename, pageCount, shared };
    }

    onProgress(t('ui.progress.pngZipping'));
    const entries = pngBlobs.map((blob, i) => ({
      name: pageFileName(i, pageCount),
      blob,
    }));
    const zipBlob = await createStoreZipBlob(entries);
    const filename = `sky_score_${stamp}.zip`;
    const shared = await downloadBlob(zipBlob, filename, 'application/zip');
    return { filename, pageCount, shared };
  } finally {
    if (raster) {
      await raster.destroy();
    }
    // iOSでのcanvasメモリ解放。
    canvas.width = 0;
    canvas.height = 0;
  }
}
