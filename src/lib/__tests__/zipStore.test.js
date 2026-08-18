import { describe, it, expect } from 'vitest';

import { createStoreZipBlob } from '../zipStore.js';

async function toDataView(blob) {
  const buffer = await blob.arrayBuffer();
  return new DataView(buffer);
}

function textBlob(text) {
  return new Blob([text]);
}

describe('createStoreZipBlob', () => {
  it('CRC-32の既知ベクタ："123456789" → 0xCBF43926', async () => {
    const blob = await createStoreZipBlob([{ name: 'a.txt', blob: textBlob('123456789') }]);
    const view = await toDataView(blob);
    expect(view.getUint32(14, true)).toBe(0xcbf43926);
  });

  it('空配列 → 22バイト、EOCDシグネチャのみ', async () => {
    const blob = await createStoreZipBlob([]);
    expect(blob.size).toBe(22);
    const view = await toDataView(blob);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
    expect(view.getUint16(8, true)).toBe(0); // このディスク上のエントリ数
    expect(view.getUint16(10, true)).toBe(0); // 総エントリ数
    expect(view.getUint32(12, true)).toBe(0); // セントラルディレクトリのサイズ
    expect(view.getUint32(16, true)).toBe(0); // セントラルディレクトリのオフセット
  });

  it('1エントリ → ローカルヘッダの各フィールドとセントラルディレクトリのオフセットが正しい', async () => {
    const name = 'page_001.png';
    const content = 'dummy-png-bytes';
    const blob = await createStoreZipBlob([{ name, blob: textBlob(content) }]);
    const view = await toDataView(blob);

    // ローカルファイルヘッダ
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(8, true)).toBe(0); // method = store
    expect(view.getUint32(18, true)).toBe(content.length); // compressed size
    expect(view.getUint32(22, true)).toBe(content.length); // uncompressed size
    expect(view.getUint16(26, true)).toBe(name.length); // file name length

    const localHeaderSize = 30 + name.length;
    const centralOffset = localHeaderSize + content.length;

    // セントラルディレクトリヘッダ
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    expect(view.getUint32(centralOffset + 42, true)).toBe(0); // 対応するローカルヘッダのオフセット = 0
  });

  it('2エントリ → 2つ目のセントラルディレクトリが指すオフセットが一致する', async () => {
    const name1 = 'page_001.png';
    const content1 = 'first-entry-bytes';
    const name2 = 'page_002.png';
    const content2 = 'second-entry-bytes-longer';
    const blob = await createStoreZipBlob([
      { name: name1, blob: textBlob(content1) },
      { name: name2, blob: textBlob(content2) },
    ]);
    const view = await toDataView(blob);

    const localHeader1Size = 30 + name1.length;
    const expectedSecondLocalOffset = localHeader1Size + content1.length;

    const localHeader2Size = 30 + name2.length;
    const centralDirectoryStart =
      expectedSecondLocalOffset + localHeader2Size + content2.length;

    const centralHeader1Size = 46 + name1.length;
    const secondCentralHeaderOffset = centralDirectoryStart + centralHeader1Size;

    expect(view.getUint32(secondCentralHeaderOffset, true)).toBe(0x02014b50);
    expect(view.getUint32(secondCentralHeaderOffset + 42, true)).toBe(expectedSecondLocalOffset);
  });

  it('EOCDの総エントリ数・セントラルディレクトリのサイズとオフセットが実データと整合する', async () => {
    const entries = [
      { name: 'a.png', blob: textBlob('aaaa') },
      { name: 'bb.png', blob: textBlob('bbbbbb') },
      { name: 'ccc.png', blob: textBlob('cc') },
    ];
    const blob = await createStoreZipBlob(entries);
    const view = await toDataView(blob);

    const eocdOffset = blob.size - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);

    const entryCount = view.getUint16(eocdOffset + 10, true);
    expect(entryCount).toBe(entries.length);

    const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
    const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

    // セントラルディレクトリの直後にEOCDが続くこと
    expect(centralDirectoryOffset + centralDirectorySize).toBe(eocdOffset);

    // セントラルディレクトリの先頭から各エントリのシグネチャを辿れること
    let cursor = centralDirectoryOffset;
    for (const entry of entries) {
      expect(view.getUint32(cursor, true)).toBe(0x02014b50);
      const nameLength = view.getUint16(cursor + 28, true);
      expect(nameLength).toBe(entry.name.length);
      cursor += 46 + nameLength;
    }
    expect(cursor).toBe(eocdOffset);
  });

  it('非ASCIIのファイル名で throw する', async () => {
    await expect(
      createStoreZipBlob([{ name: '楽譜.png', blob: textBlob('x') }]),
    ).rejects.toThrow();
  });

  it('エントリ数が65535を超えると throw する', async () => {
    const entries = new Array(65536).fill(null).map((_, i) => ({ name: `${i}`, blob: null }));
    await expect(createStoreZipBlob(entries)).rejects.toThrow();
  });
});
