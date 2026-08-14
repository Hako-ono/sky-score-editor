/**
 * PDF背景画像の読み込み・ページ解像度への縮小・不透明度合成。画面プレビュー
 * とPDFへの埋め込み（pdfExport.js の drawBackgroundImage が縦横比の計算に
 * width/height を使う）の両方で使う。
 *
 * 利用者が出力のたびにローカルから選ぶファイルであり、localStorage には
 * 保存しない。`URL.createObjectURL`
 * （blob:）は現行CSPの `img-src 'self' data:` で弾かれるため使わず、
 * `FileReader` で `data:` URL 化する（同ケース4）。
 *
 * 読み込み（loadBackgroundImageSource）と不透明度合成（composeBackgroundImage）
 * を分けているのは、不透明度を変えるたびに元ファイルの再デコードが走ると
 * 操作が重くなるため。縮小済み・不透明度100%のsourceを1つだけ
 * 保持しておき、不透明度の変更ではそこから白地へ再合成するだけにする。
 */

// 選んだファイルそのものの上限。極端に大きいファイル（無圧縮画像等）を
// デコードさせる前に弾く事故対策。3000グリッド級譜面で既に消費している
// フォントキャッシュ（最大約19MB、pdfExport.js）と競合しないための
// 余裕を持たせた値で、実測値ではない。
export const MAX_BACKGROUND_IMAGE_BYTES = 20 * 1024 * 1024;

// 縮小後の長辺(px)とJPEG品質。実測値ではなく、実物を見て調整する前提の値。
export const BACKGROUND_IMAGE_MAX_DIMENSION = 1600;
export const BACKGROUND_IMAGE_JPEG_QUALITY = 0.8;

// 不透明度の既定値・範囲・刻み。「文字が読める程度に薄い」側へ寄せた仮置きで、
// 実測値ではない。
export const DEFAULT_BACKGROUND_IMAGE_OPACITY = 0.35;
export const BACKGROUND_IMAGE_OPACITY_MIN = 0.1;
export const BACKGROUND_IMAGE_OPACITY_MAX = 1;
export const BACKGROUND_IMAGE_OPACITY_STEP = 0.05;

/** File を data: URL として読む。blob: は使わない。 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
}

/** data: URL を <img> にデコードする。壊れた画像・非対応形式は reject する。 */
function decodeImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像として読み込めませんでした。'));
    img.src = dataUrl;
  });
}

/**
 * 画像ファイルを読み込み、ページ解像度まで縮小した「合成前」のsourceを返す。
 * 透過を保ったまま（塗りつぶしをしない）canvasへ描画するのは、
 * composeBackgroundImage が呼ばれるたびに毎回異なる背景色・不透明度で
 * 合成し直せるようにするため。
 *
 * @param {File} file
 * @returns {Promise<{ canvas: HTMLCanvasElement, width: number, height: number }>}
 */
export async function loadBackgroundImageSource(file) {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('画像ファイルを選んでください。');
  }
  if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
    const limitMB = Math.floor(MAX_BACKGROUND_IMAGE_BYTES / (1024 * 1024));
    throw new Error(`ファイルが大きすぎます（上限 ${limitMB}MB）。`);
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await decodeImage(dataUrl);

  const srcWidth = img.naturalWidth;
  const srcHeight = img.naturalHeight;
  if (!srcWidth || !srcHeight) {
    throw new Error('画像として読み込めませんでした。');
  }

  const scale = Math.min(1, BACKGROUND_IMAGE_MAX_DIMENSION / Math.max(srcWidth, srcHeight));
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('画像の処理に失敗しました。');
  }
  // ここでは塗りつぶさない。透過PNGの透明部分は、後段の composeBackgroundImage が
  // 呼ばれるたびの backgroundColor で塗り分ける（塗り色・不透明度とも合成の
  // たびに変わりうるため、この段階では確定させない）
  ctx.drawImage(img, 0, 0, width, height);

  return { canvas, width, height };
}

/**
 * loadBackgroundImageSource が返した source を、指定の背景色・不透明度で
 * 白地（等）へ合成し、data:URL(JPEG) にする。元ファイルの再デコードを
 * 行わないため、不透明度を変えるたびに呼んでも軽い。
 *
 * 透過PNGを渡された場合にJPEG化すると透過部分が黒くなるため、合成用
 * canvas を先に backgroundColor で塗りつぶしてから、指定の不透明度で
 * 画像を重ねる。
 *
 * @param {{ canvas: HTMLCanvasElement, width: number, height: number }} source
 * @param {{ backgroundColor?: string, opacity?: number }} [options]
 * @returns {{ dataUrl: string, width: number, height: number }}
 */
export function composeBackgroundImage(source, { backgroundColor = '#FFFFFF', opacity = 1 } = {}) {
  const { canvas: src, width, height } = source;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('画像の処理に失敗しました。');
  }
  const clampedOpacity = Math.min(1, Math.max(0, opacity));
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = clampedOpacity;
  ctx.drawImage(src, 0, 0);
  ctx.globalAlpha = 1;

  try {
    const dataUrl = canvas.toDataURL('image/jpeg', BACKGROUND_IMAGE_JPEG_QUALITY);
    return { dataUrl, width, height };
  } catch {
    // 同一オリジンのcanvasから描画しているためcanvasがtaintedになる
    // ことは通常ないが、ブラウザ側の未知の制約への保険として握り潰す
    throw new Error('画像の処理に失敗しました。');
  }
}
