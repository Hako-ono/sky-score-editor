/**
 * 「score + options → 1ページぶんのラスタ画像」だけを責務にする薄い
 * オーケストレータ。`buildPdfBlob(..., previewOnly=true)` →
 * `openPdfForRaster` → `renderPage` の3手で、PDF自体の組み立て（jsPDF /
 * svg2pdf.js）とラスタ化（pdf.js）にはまったく手を加えない。
 *
 * SVGから直接プレビューを描く案・プレビュー専用の描画コードを別に持つ案は
 * いずれも却下済み。1ページの見た目は
 * 「SVG本体＋doc.textによる曲名・柱・ノンブル＋doc.addImageによる背景画像」の
 * 合成であり、PDFを唯一の正としてそのラスタ化に徹する。
 *
 * `pdfExport.js`（jsPDF/svg2pdf.js）も pdfjs-dist（`pdfRaster.js`経由）も
 * ここで動的 import する。呼び出し側（`PdfPreview.jsx`）がこのモジュール
 * 自体を静的importしても、この境界でコード分割されることに変わりはない
 * （`App.jsx`の`handleExportPdf`/`handleExportPng`と同じ方針）。
 */

// renderPdfPreview / renderPdfPreviewFromBlob それぞれ専用の世代カウンタ。
// 常時プレビュー（自動更新）と拡大表示（1回だけ再生成）は呼び出しの性質が
// 違うため別々に持つ。自動更新中に前の呼び出しが完了する前に次の変更が
// 来ることがあり、完了時に自分が最新でなければ結果を破棄する。破棄する
// 場合も `raster.destroy()` は必ず呼ぶ（各関数のfinally節）。
let latestPreviewCallId = 0;
let latestBlobCallId = 0;

// scale=1のviewport実測（＝用紙のpt幅）を取るためだけの使い捨てcanvas。
// 呼び出しのたびに新規作成せず、モジュール内で1枚を使い回す
// （呼び出し側が持つ本来の表示用canvasはこの計測では汚さない）。
let probeCanvas = null;
function getProbeCanvas() {
  if (!probeCanvas) probeCanvas = document.createElement('canvas');
  return probeCanvas;
}

// 同じcanvasへ向けてpdf.jsの page.render() を2つ同時に走らせると
// "Cannot use the same canvas during multiple render() operations." で
// 例外になる。世代カウンタは「古い呼び出しの結果を使わない」ことしか
// 保証せず、「古い呼び出しのrenderPageが実行中に新しい呼び出しの
// renderPageが割り込む」こと自体は防げない（例：拡大表示を開いた直後に
// blobが差し替わり、同じ拡大表示用canvasへ2つの呼び出しがほぼ同時に
// 描こうとする）。canvas単位で直列化し、前の呼び出しの完了（成功・失敗を
// 問わず）を待ってから次を呼ぶことで防ぐ。
const canvasRenderChains = new WeakMap();
function runExclusiveOnCanvas(canvas, task) {
  const previous = canvasRenderChains.get(canvas) ?? Promise.resolve();
  const settled = previous.catch(() => {});
  const chained = settled.then(task);
  canvasRenderChains.set(canvas, chained.catch(() => {}));
  return chained;
}

// iOSのcanvas面積上限に対する余裕を見た既定値。目的が異なる呼び出し側
// （拡大表示等）はこの既定に頼らず、目的に応じた値を明示すること。
const DEFAULT_MAX_LONG_SIDE_PX = 2000;

/**
 * scale=1で一度描き、その結果のpx幅・高さ（＝用紙のpt幅・高さ）を読む。
 * probeはモジュール内で1枚を使い回すため、常時プレビューと拡大表示の
 * 呼び出しが重なるとこの共有canvasへの描画も競合しうる。
 *
 * probe.width/heightの読み出しは、renderExclusiveOnCanvasに渡す
 * タスクの「内側」で行うこと。外側（awaitの後）で読むと、直列化された
 * 描画自体は競合しなくても、自分の描画完了とこの読み出しの間に次の
 * 呼び出し（別のrenderPdfPreview/renderPdfPreviewFromBlob）の描画が
 * 割り込んでprobeを上書きし、他人の寸法を読んでしまうことがある
 * （常時プレビューのcanvasが1×0という異常な大きさになる不具合の原因だった）。
 */
async function measureNaturalPagePt(raster) {
  const probe = getProbeCanvas();
  return runExclusiveOnCanvas(probe, async () => {
    await raster.renderPage(0, probe, 1);
    return { naturalWidthPt: probe.width, naturalHeightPt: probe.height };
  });
}

/**
 * 1ページ目を canvas へ描く。canvas は呼び出し側が用意して使い回す
 * （このモジュールの中で `document.createElement('canvas')` を毎回作らない）。
 *
 * @param {*} score `buildPdfBlob` と同じ形
 * @param {*} options `buildPdfBlob` と同じ形（`{ ...pdfPrefs, language,
 *          backgroundImage, selectedLayer }`。呼び出し側が
 *          `handleExportPdf`/`handleExportPng` と同一の式で組み立てる想定）
 * @param {HTMLCanvasElement} canvas
 * @param {{ maxLongSidePx?: number }} [config] 目標の長辺ピクセル数の上限
 * @returns {Promise<{ widthPx: number, heightPx: number, blob: Blob } | null>}
 *          世代遅れ（呼び出し中により新しい呼び出しが発生した）ため
 *          結果を破棄したときは `null` を返す。失敗時は例外を投げる
 *          （枠内へのエラー表示は呼び出し側＝`PdfPreview.jsx`の責務）。
 *          `blob` は拡大表示（`renderPdfPreviewFromBlob`）が同じPDFを
 *          再生成せずに使い回すためのもの。
 */
export async function renderPdfPreview(
  score,
  options,
  canvas,
  { maxLongSidePx = DEFAULT_MAX_LONG_SIDE_PX } = {},
) {
  const callId = (latestPreviewCallId += 1);

  const [{ buildPdfBlob }, { openPdfForRaster }] = await Promise.all([
    import('./pdfExport.js'),
    import('./pdfRaster.js'),
  ]);

  // onProgressには何もしない関数を渡す（プレビューでトーストを出さない）。
  // pageProgressKeyは既定値のままでよい
  // （onProgressが呼ばれないので中身は使われない）。previewOnly=trueで
  // 「bodySlotsにpageIndex===0を含む最初の物理ページ」だけを描かせる。
  const { blob } = await buildPdfBlob(score, options, () => {}, undefined, true);

  if (callId !== latestPreviewCallId) return null;

  const raster = await openPdfForRaster(blob);
  try {
    if (callId !== latestPreviewCallId) return null;

    // 目標ピクセル幅は「枠のCSS表示幅 × devicePixelRatio（2で頭打ち）」。
    // devicePixelRatioを無視して素直に掛けるとiOSのcanvas面積上限を
    // 超えうるため、長辺がmaxLongSidePxを超えないよう追加でクランプする。
    const { naturalWidthPt, naturalHeightPt } = await measureNaturalPagePt(raster);

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidthPx = canvas.clientWidth || canvas.width || naturalWidthPt;
    let scale = (cssWidthPx * devicePixelRatio) / naturalWidthPt;
    const longSidePx = Math.max(naturalWidthPt, naturalHeightPt) * scale;
    if (longSidePx > maxLongSidePx) {
      scale *= maxLongSidePx / longSidePx;
    }

    if (callId !== latestPreviewCallId) return null;

    await runExclusiveOnCanvas(canvas, async () => {
      // 順番が回ってきた時点で世代遅れなら、古い内容を一瞬でも描かず
      // そのまま何もしない。
      if (callId !== latestPreviewCallId) return;
      await raster.renderPage(0, canvas, scale);
    });

    if (callId !== latestPreviewCallId) return null;

    return { widthPx: canvas.width, heightPx: canvas.height, blob };
  } finally {
    // finally節で例外を投げない（PNG出力で「生成は成功するのに失敗
    // メッセージが出る」不具合を作り込んだのと同じ形になるため）。
    // destroy()自体の失敗は本来の結果／エラーを覆さないよう握りつぶす。
    try {
      await raster.destroy();
    } catch {
      // 握りつぶす（上記コメントの理由）。
    }
  }
}

/**
 * 拡大表示（`PdfPreviewOverlay.jsx`）向け。`renderPdfPreview` が返した
 * `Blob` をそのまま再利用し、`buildPdfBlob` からやり直さない
 * （同じPDFを2回組み立てない）。目標の長辺ピクセル数は呼び出し側
 * （fit時の表示サイズ・devicePixelRatio・拡大余地から）が決めて渡す。
 *
 * @param {Blob} blob `renderPdfPreview` が返したもの
 * @param {HTMLCanvasElement} canvas
 * @param {{ targetLongSidePx: number }} config
 * @returns {Promise<{ widthPx: number, heightPx: number } | null>}
 *          世代遅れのときは `null`。失敗時は例外を投げる。
 */
export async function renderPdfPreviewFromBlob(blob, canvas, { targetLongSidePx }) {
  const callId = (latestBlobCallId += 1);

  const { openPdfForRaster } = await import('./pdfRaster.js');

  if (callId !== latestBlobCallId) return null;

  const raster = await openPdfForRaster(blob);
  try {
    if (callId !== latestBlobCallId) return null;

    const { naturalWidthPt, naturalHeightPt } = await measureNaturalPagePt(raster);
    const naturalLongSidePt = Math.max(naturalWidthPt, naturalHeightPt);
    const scale = targetLongSidePx / naturalLongSidePt;

    if (callId !== latestBlobCallId) return null;

    await runExclusiveOnCanvas(canvas, async () => {
      if (callId !== latestBlobCallId) return;
      await raster.renderPage(0, canvas, scale);
    });

    if (callId !== latestBlobCallId) return null;

    return { widthPx: canvas.width, heightPx: canvas.height };
  } finally {
    try {
      await raster.destroy();
    } catch {
      // 握りつぶす（renderPdfPreviewと同じ理由）。
    }
  }
}
