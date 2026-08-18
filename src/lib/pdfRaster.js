/**
 * PDF の Blob を受け取り、指定ページを canvas に描くだけの薄いモジュール。
 * PNG化・ZIP化はここでは行わない（`pngExport.js` の責務）。将来サイト内
 * プレビュー機能から再利用できるよう、「PDF Blob → canvas」だけに絞っている。
 *
 * pdfjs-dist は動的 import で読み込む（初期バンドルに含めない）。
 *
 * CSP（`public/_headers` の `script-src 'self'` に `unsafe-eval` 無し、
 * `font-src 'self'` に data:/blob: 無し）を変更せずに使うため、
 * `getDocument` には以下を渡す：
 * - `disableFontFace: true`：埋め込みフォントを `@font-face`（data:/blob:）
 *   経由で注入させず、パス描画（ビルトインの代替レンダラ）に倒す。
 * - `cMapUrl` / `standardFontDataUrl` は渡さない。これにより
 *   `useWorkerFetch` の既定値が false になり（`cMapUrl`/`standardFontDataUrl`/
 *   `wasmUrl` がすべて揃っている場合のみ true になる仕様のため）、
 *   ワーカー内からの追加フェッチが発生しない。
 *
 * `isEvalSupported` は pdfjs-dist@6.2.108 の `getDocument` オプションに
 * 存在しない（型定義・ソースのいずれにも見当たらず、`new Function` /
 * `eval` の使用箇所も見つからなかった）ため渡していない。CSPの
 * `script-src 'self'`（`unsafe-eval` 無し）に抵触しないかは、
 * ブラウザ実機（Console の CSP violation 有無）で裏を取ること。
 */

let pdfjsLibPromise = null;

async function loadPdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjsLib = await import('pdfjs-dist');
      // CDN 等の外部URLを使わず、Vite にワーカー本体をバンドルさせる。
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url,
      ).href;
      return pdfjsLib;
    })();
  }
  return pdfjsLibPromise;
}

/**
 * PDFのBlobを開き、ページ数と「1ページをcanvasに描く関数」を返す。
 *
 * @param {Blob} pdfBlob
 * @returns {Promise<{
 *   pageCount: number,
 *   renderPage: (pageIndex: number, canvas: HTMLCanvasElement, scale: number) => Promise<void>,
 *   destroy: () => Promise<void>,
 * }>}
 */
export async function openPdfForRaster(pdfBlob) {
  const pdfjsLib = await loadPdfjsLib();

  // getDocument に渡す ArrayBuffer はワーカーへ転送され detach される
  // 可能性があるため、都度 Blob から作り直す（Blob 自体は呼び出し元が
  // 保持しているものをそのまま使う）。
  const data = await pdfBlob.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data,
    disableFontFace: true,
  });
  const pdfDocument = await loadingTask.promise;

  return {
    pageCount: pdfDocument.numPages,

    async renderPage(pageIndex, canvas, scale) {
      const page = await pdfDocument.getPage(pageIndex + 1); // pdf.js は1始まり
      try {
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const canvasContext = canvas.getContext('2d');

        const renderTask = page.render({ canvasContext, canvas, viewport });
        await renderTask.promise;
      } finally {
        page.cleanup();
      }
    },

    // `destroy()` は PDFDocumentProxy（pdfDocument）ではなく
    // PDFDocumentLoadingTask（loadingTask）が持つメソッド（型定義で確認済み）。
    // pdfDocument.destroy() は存在せず呼ぶと TypeError になる。
    async destroy() {
      await loadingTask.destroy();
    },
  };
}
