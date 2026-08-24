/**
 * 保存ファイル名の組み立て。JSON・PDF・PNG(ZIP)・PDFプリセットQRの4経路が
 * 同じ規則を使う。
 *
 * 曲名は利用者が自由に入力でき、読み込んだ楽譜JSON由来でもある。
 * 読み込む楽譜JSONは、攻撃者が自由に作れるファイルとして扱う。
 * `a.download` や共有シートへ素のまま渡すと、パス区切りでの脱出や、双方向
 * 制御文字による拡張子の偽装が成立しうるため、必ずここを通す。
 */

// 曲名部分に許す長さ。ファイル名全体（接頭辞＋日時＋拡張子）を足しても
// 一般的な255バイト制限に収まる範囲で、曲名が読み取れる程度に取る。
export const MAX_FILENAME_TITLE_CODE_POINTS = 40;

// 表示用文字列（PDFの `/Title`）の上限。ファイル名より緩くてよいが、
// 際限なくPDFへ書き込ませないために上限自体は設ける。
export const MAX_DISPLAY_TEXT_CODE_POINTS = 120;

// Windows で使えない文字と制御文字。除去（`_` への置換ではない）とするのは、
// 記号を落としても曲名の読みは残るのに対し、置換すると `_` だけが並ぶため。
const PATH_CHARACTER_RE = /[<>:"/\\|?*\u0000-\u001F\u007F-\u009F]/g;

// 制御文字のみ（パス区切りは残す）。
const CONTROL_CHARACTER_RE = /[\u0000-\u001F\u007F-\u009F]/g;

// 双方向制御文字。表示上の文字順を反転でき、`gnp.exe` を `exe.png` に
// 見せかける類の偽装に使える。
const BIDI_CONTROL_RE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

// Windows は末尾のドットと空白を黙って落とすため、あらかじめ削る。
const EDGE_TRIM_RE = /^[._\s]+|[._\s]+$/gu;

// Windows の予約デバイス名。拡張子が付いていても予約のままなので、
// 最初のドットより前で判定する。
const RESERVED_BASENAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/iu;

/**
 * 任意の文字列をファイル名の一部として安全な形へ落とす。
 *
 * @param {unknown} value
 * @param {{ fallback?: string, maxCodePoints?: number }} [options]
 * @returns {string} 空にはならない（すべて落ちた場合は fallback）
 */
export function sanitizeFilenamePart(value, options = {}) {
  const fallback = options.fallback ?? 'Untitled';
  const maxCodePoints = options.maxCodePoints ?? MAX_FILENAME_TITLE_CODE_POINTS;

  const source = typeof value === 'string' ? value : '';
  const cleaned = source
    .normalize('NFC')
    .replace(PATH_CHARACTER_RE, '')
    .replace(BIDI_CONTROL_RE, '')
    .replace(/\s+/gu, '_')
    .replace(EDGE_TRIM_RE, '');

  // サロゲートペアを割らないよう、コードポイント単位で数えて切る。
  // 切った跡に `_` や `.` が残ることがあるので、もう一度端を削る。
  const truncated = [...cleaned]
    .slice(0, maxCodePoints)
    .join('')
    .replace(EDGE_TRIM_RE, '');

  if (!truncated) return fallback;
  return RESERVED_BASENAME_RE.test(truncated) ? `_${truncated}` : truncated;
}

/**
 * ファイル名に使う日時。ローカル時刻で `YYYYMMDD-HHMMSS`。
 * 日と時刻の区切りだけ `-` にしているのは、年月日と時分秒の境目を
 * 読み取れるようにするため。
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function filenameTimestamp(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.valueOf()) ? date : new Date(0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}${p(d.getSeconds())}`;
}

/**
 * PDFの `/Title` メタデータなど、ファイル名ではない表示用の文字列。
 * ファイル名と違ってパス区切りや空白はそのまま残してよいが、制御文字と
 * 双方向制御文字だけは落とす（ビューアのタブ名として表示されるため）。
 *
 * @param {unknown} value
 * @param {string} fallback 空になったときに返す文字列
 * @returns {string}
 */
export function sanitizeDisplayText(value, fallback) {
  const source = typeof value === 'string' ? value : '';
  const cleaned = source
    .normalize('NFC')
    .replace(CONTROL_CHARACTER_RE, '')
    .replace(BIDI_CONTROL_RE, '')
    .trim();
  return [...cleaned].slice(0, MAX_DISPLAY_TEXT_CODE_POINTS).join('').trim() || fallback;
}

/**
 * 楽譜の保存ファイル名。`Sky_曲名_20260825-143012.pdf` の形。
 *
 * 曲名を前寄りに置くのは、共有シートやモバイルのダウンロード一覧のように
 * 名前が途中で省略される場所でも曲名が見えるようにするため。
 *
 * @param {unknown} title 曲名。未入力・記号のみのときは `Untitled` になる
 * @param {string} extension 拡張子（ドットなし）
 * @param {Date} [date]
 * @returns {string}
 */
export function buildScoreFilename(title, extension, date = new Date()) {
  return `Sky_${sanitizeFilenamePart(title)}_${filenameTimestamp(date)}.${extension}`;
}
