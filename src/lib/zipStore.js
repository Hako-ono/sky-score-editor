/**
 * store（無圧縮）専用の最小限のZIPライタ。
 *
 * 圧縮ライブラリ（JSZip / fflate / pako）を使わない理由：PNGのIDATは既に
 * DEFLATE済みで再圧縮の利得がほぼ無いこと、およびライブラリ実装では全ページの
 * バイト列をJSヒープ上に同時に持つ必要があり、iPhoneのメモリ制約に対して
 * 打つ手が無いこと。ここでは各エントリの本体を `Blob` のまま `new Blob([...])`
 * へ渡して連結するため、PNG本体をバイト列としてヒープに載せる必要がない
 * （CRC-32計算のために一時的に読むだけで、読み終えたら参照を捨てる）。
 *
 * ZIP64は実装しない。エントリ数・サイズが境界を超えたら throw する。
 * ファイル名はASCIIのみを許可する（UTF-8フラグの解釈は解凍側でばらつき、
 * 日本語・タイ語の曲名を入れると文字化けの原因になるため。曲名は `.zip`
 * 自体のファイル名にだけ使う）。
 */

const MAX_ENTRIES = 65535;
const MAX_UINT32 = 0xffffffff;

// CRC-32（IEEE 802.3、反転多項式 0xEDB88320）のテーブルをモジュールスコープで
// 1回だけ作って使い回す。
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * @param {Uint8Array} bytes
 * @returns {number} CRC-32（符号なし32bit）
 */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isAscii(name) {
  for (let i = 0; i < name.length; i += 1) {
    if (name.charCodeAt(i) > 0x7f) return false;
  }
  return true;
}

function asciiBytes(name) {
  const bytes = new Uint8Array(name.length);
  for (let i = 0; i < name.length; i += 1) {
    bytes[i] = name.charCodeAt(i);
  }
  return bytes;
}

/**
 * DOS形式のlast mod time / dateを`Date`から作る（再現性は不要）。
 * @param {Date} date
 * @returns {{ time: number, date: number }}
 */
function toDosDateTime(date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function assertWithinUint32(value, label) {
  if (value > MAX_UINT32) {
    throw new Error(`createStoreZipBlob: ${label} が上限（4GB）を超えています`);
  }
}

/**
 * ローカルファイルヘッダ（30バイト＋ファイル名）を組み立てる。
 * @returns {Uint8Array}
 */
function buildLocalFileHeader({ nameBytes, crc, size, dosTime, dosDate }) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true); // version needed
  view.setUint16(6, 0, true); // general purpose flag
  view.setUint16(8, 0, true); // compression method = store
  view.setUint16(10, dosTime, true);
  view.setUint16(12, dosDate, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true); // compressed size = 元サイズ
  view.setUint32(22, size, true); // uncompressed size
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true); // extra field length
  header.set(nameBytes, 30);
  return header;
}

/**
 * セントラルディレクトリヘッダ（46バイト＋ファイル名）を組み立てる。
 * @returns {Uint8Array}
 */
function buildCentralDirectoryHeader({ nameBytes, crc, size, dosTime, dosDate, localHeaderOffset }) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true); // version made by
  view.setUint16(6, 20, true); // version needed
  view.setUint16(8, 0, true); // flag
  view.setUint16(10, 0, true); // method
  view.setUint16(12, dosTime, true);
  view.setUint16(14, dosDate, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true); // extra field length
  view.setUint16(32, 0, true); // file comment length
  view.setUint16(34, 0, true); // disk number start
  view.setUint16(36, 0, true); // internal file attributes
  view.setUint32(38, 0, true); // external file attributes
  view.setUint32(42, localHeaderOffset, true);
  header.set(nameBytes, 46);
  return header;
}

/**
 * EOCD（22バイト）を組み立てる。
 * @returns {Uint8Array}
 */
function buildEocd({ entryCount, centralDirectorySize, centralDirectoryOffset }) {
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true); // このディスク番号
  view.setUint16(6, 0, true); // セントラルディレクトリ開始ディスク
  view.setUint16(8, entryCount, true); // このディスク上のエントリ数
  view.setUint16(10, entryCount, true); // 総エントリ数
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true); // コメント長
  return eocd;
}

/**
 * @param {Array<{ name: string, blob: Blob }>} entries
 * @returns {Promise<Blob>} application/zip
 */
export async function createStoreZipBlob(entries) {
  if (entries.length > MAX_ENTRIES) {
    throw new Error(
      `createStoreZipBlob: エントリ数が上限（${MAX_ENTRIES}）を超えています（ZIP64は未対応）`,
    );
  }

  const now = toDosDateTime(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  let centralDirectorySize = 0;

  for (const entry of entries) {
    if (!isAscii(entry.name)) {
      throw new Error(`createStoreZipBlob: ファイル名にASCII以外の文字が含まれています: ${entry.name}`);
    }

    const size = entry.blob.size;
    assertWithinUint32(size, `エントリ ${entry.name} のサイズ`);

    // CRC-32計算のためにエントリごとに1回だけバイト列を読み、
    // 使い終えたらすぐ参照を捨てる（同時に2エントリぶんを保持しない）。
    const bytes = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(bytes);

    const nameBytes = asciiBytes(entry.name);
    const localHeader = buildLocalFileHeader({
      nameBytes,
      crc,
      size,
      dosTime: now.time,
      dosDate: now.date,
    });

    assertWithinUint32(offset, 'ローカルファイルヘッダのオフセット');
    const centralHeader = buildCentralDirectoryHeader({
      nameBytes,
      crc,
      size,
      dosTime: now.time,
      dosDate: now.date,
      localHeaderOffset: offset,
    });

    localParts.push(localHeader, entry.blob);
    centralParts.push(centralHeader);
    centralDirectorySize += centralHeader.length;
    offset += localHeader.length + size;
  }

  assertWithinUint32(offset, '総バイト数');
  const centralDirectoryOffset = offset;
  const eocd = buildEocd({
    entryCount: entries.length,
    centralDirectorySize,
    centralDirectoryOffset,
  });

  return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}
