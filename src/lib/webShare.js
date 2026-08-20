/**
 * iOSのスタンドアロンPWA（ホーム画面から起動した状態）にはダウンロード
 * マネージャのUIが無く、`<a download>` のdownload属性が無視されてファイルを
 * 開いたページへ遷移したように見える（PDFプレビュー用の `window.open` も
 * 同様に、アプリから抜けて別ページへ遷移したように見える）。Web Share APIの
 * 共有シートを経由すればページ遷移を挟まずに保存できるため、この文脈でだけ
 * 優先して使う。通常のブラウザタブでは既存の直接ダウンロードのほうが操作が
 * 1手少ないため、スタンドアロン表示のときだけ切り替える。
 */

// iOS Safariのホーム画面起動を示す非標準プロパティ（`navigator.standalone`）と
// `display-mode: standalone` の両方を見る。どちらか一方が未実装のブラウザでも
// 拾えるようにするための冗長化であり、優劣はない。
export function isStandaloneDisplay() {
  const navigatorRef = globalThis.navigator;
  if (navigatorRef && navigatorRef.standalone === true) {
    return true;
  }
  const windowRef = globalThis.window;
  if (windowRef && typeof windowRef.matchMedia === 'function') {
    try {
      return windowRef.matchMedia('(display-mode: standalone)').matches;
    } catch {
      return false;
    }
  }
  return false;
}

function canUseWebShare(file) {
  const navigatorRef = globalThis.navigator;
  return isStandaloneDisplay()
    && !!navigatorRef
    && typeof navigatorRef.share === 'function'
    && typeof navigatorRef.canShare === 'function'
    && navigatorRef.canShare({ files: [file] });
}

/**
 * 可能ならWeb Share APIの共有シートにファイルを渡す。使えない場合・共有自体が
 * 失敗した場合は false を返し、呼び出し元は従来の直接ダウンロードへ
 * フォールバックする。ユーザーが共有シートを閉じた場合（AbortError）は
 * 明示的なキャンセルとして true を返し、フォールバックのダウンロードを
 * 重ねて出さない。
 * @param {Blob} blob
 * @param {string} filename
 * @param {string} mimeType
 * @returns {Promise<boolean>}
 */
export async function tryShareFile(blob, filename, mimeType) {
  const FileRef = globalThis.File;
  if (typeof FileRef !== 'function') return false;

  let file;
  try {
    file = new FileRef([blob], filename, { type: mimeType });
  } catch {
    return false;
  }
  if (!canUseWebShare(file)) return false;

  try {
    await globalThis.navigator.share({ files: [file] });
    return true;
  } catch (error) {
    if (error && error.name === 'AbortError') return true;
    return false;
  }
}
