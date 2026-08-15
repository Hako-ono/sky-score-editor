import { describe, it, expect } from 'vitest';

import {
  DEFAULT_PRESET_ID,
  DEFAULT_FONT_ID,
  DEFAULT_FONT_WEIGHT_ID,
  DEFAULT_GRID_NUMBER_DISPLAY_ID,
  DEFAULT_SHEET_LAYOUT_ID,
  DEFAULT_SCORE_INFO_DESIGN_ID,
  DEFAULT_MASTHEAD_DIRECTION_ID,
  DEFAULT_TEMPO_VALUE_MODE_ID,
  DEFAULT_CUSTOM_TEMPO_VALUE,
  DEFAULT_PAGE_MARGIN_ID,
  DEFAULT_GRID_GAP_ID,
  DEFAULT_KEY_NOTATION_ID,
  DEFAULT_KEY_MODE_NOTATION_ID,
  pdfConfig,
} from '../../constants/config.js';
import {
  MAX_PDF_PRESET_INPUT_LENGTH,
  MAX_PDF_PRESET_JSON_BYTES,
  buildPdfPresetDiff,
  buildPdfPresetUrl,
  decodePdfPresetCode,
  encodePdfPreset,
  extractPdfPresetCode,
  resolveImportedKeyNotationId,
} from '../pdfPresetCodec.js';
import { normalizePdfPrefs } from '../pdfPrefs.js';
import {
  DEFAULT_PDF_GRID_STYLE_CUSTOM,
  DEFAULT_PDF_GRID_STYLE_ID,
} from '../pdfGridStyle.js';

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function makeJsonCode(value) {
  const bytes = new globalThis.TextEncoder().encode(JSON.stringify(value));
  return `SKYPDF2.J.${bytesToBase64Url(bytes)}`;
}

async function makeGzipCode(text) {
  const stream = new globalThis.Blob([new globalThis.TextEncoder().encode(text)])
    .stream()
    .pipeThrough(new globalThis.CompressionStream('gzip'));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
    total += result.value.byteLength;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return `SKYPDF2.G.${bytesToBase64Url(bytes)}`;
}

async function withoutCompressionStream(callback) {
  const original = globalThis.CompressionStream;
  globalThis.CompressionStream = undefined;
  try {
    return await callback();
  } finally {
    globalThis.CompressionStream = original;
  }
}

const DEFAULT_PREFS = normalizePdfPrefs(undefined);

const FULL_PREFS = normalizePdfPrefs({
  presetId: 'winterDark',
  fontId: 'mincho',
  fontWeightId: 'bold',
  titleFontSizePt: 24,
  metaFontSizePt: 14,
  maxRowsPerPage: 12,
  lyricSizePercent: 130,
  gridNumberSizePercent: 140,
  gridNumberDisplayId: 'none',
  pageNumberFontSizePt: 14,
  sheetLayoutId: 'double',
  columnsPerPageId: 'col8',
  rowShadingId: 'even',
  scoreInfoDesignId: 'masthead',
  mastheadDirectionId: 'right',
  tempoValueModeId: 'custom',
  customTempoValue: 999,
  pageMarginId: 'wide',
  gridGapId: 'loose',
  keyNotationId: 'flat',
  keyModeNotationId: 'traditional',
  pageNumberFormatId: 'current',
  pageNumberPositionId: 'bottomOuter',
  runningHeaderId: 'title',
  footerCreditId: 'transcribedBy',
  gridStyleId: 'custom',
  gridStyleCustom: {
    outerRadius: 30,
    cellRadius: 30,
    symbolRadius: 16,
    outerStrokeWidth: 6,
    cellStrokeWidth: 5,
    symbolStrokeWidth: 6,
  },
  custom: {
    bg: '#101010',
    ink: '#F0F0F0',
    line: '#202020',
    surface: '#303030',
    accent: '#E0A020',
    accentLine: '#C08010',
    accent2: '#2060E0',
    accentLine2: '#1050C0',
  },
});

describe('pdf preset codec', () => {
  it('既定設定をgzipでencode-decodeできる', async () => {
    const code = await encodePdfPreset({ name: '既定', memo: '確認用', prefs: DEFAULT_PREFS });
    expect(code.startsWith('SKYPDF2.G.')).toBe(true);
    await expect(decodePdfPresetCode(code, { pitchLevel: 0, keyMode: 'major' }))
      .resolves.toEqual({ version: 2, name: '既定', memo: '確認用', prefs: DEFAULT_PREFS });
  });

  it('全設定の値を5groupへ変換し、decode後に保持する', async () => {
    const code = await withoutCompressionStream(() => encodePdfPreset({
      name: '全設定',
      memo: '全項目',
      prefs: FULL_PREFS,
    }));
    const raw = globalThis.atob(code.split('.')[2].replace(/-/g, '+').replace(/_/g, '/'));
    const envelope = JSON.parse(raw);

    // 外部形式は短いコードだけを持つ（QRを小さく保つため）
    expect(Object.keys(envelope)).toEqual(['v', 'n', 'm', 's']);
    expect(envelope.v).toBe(2);
    expect(Object.keys(envelope.s)).toEqual(['d', 't', 'i', 'p', 'a']);
    expect(envelope.s.d).toEqual({
      p: 'winterDark',
      // カスタム配色は固定順の8要素・先頭の # なしで運ぶ
      c: [
        '101010', 'F0F0F0', '202020', '303030',
        'E0A020', 'C08010', '2060E0', '1050C0',
      ],
      g: 'custom',
      // カスタム形状は固定順の6要素
      k: [
        FULL_PREFS.gridStyleCustom.outerRadius,
        FULL_PREFS.gridStyleCustom.cellRadius,
        FULL_PREFS.gridStyleCustom.symbolRadius,
        FULL_PREFS.gridStyleCustom.outerStrokeWidth,
        FULL_PREFS.gridStyleCustom.cellStrokeWidth,
        FULL_PREFS.gridStyleCustom.symbolStrokeWidth,
      ],
      n: 'none',
    });
    expect(envelope.s.t).toEqual({
      f: 'mincho',
      w: 'bold',
      t: 24,
      m: 14,
      l: 130,
      n: 140,
    });
    expect(envelope.s.i).toEqual({
      d: 'masthead',
      h: 'right',
      t: 'custom',
      c: 999,
      k: 'flat',
      m: 'traditional',
    });
    expect(envelope.s.p).toEqual({
      f: 'current',
      p: 'bottomOuter',
      s: 14,
      h: 'title',
      c: 'transcribedBy',
    });
    expect(envelope.s.a).toEqual({
      s: 'double',
      r: 12,
      c: 'col8',
      z: 'even',
      m: 'wide',
      g: 'loose',
    });

    const decoded = await decodePdfPresetCode(code, { pitchLevel: 0, keyMode: 'major' });
    expect(decoded.name).toBe('全設定');
    expect(decoded.memo).toBe('全項目');
    // ♩の値だけは読み込み先の楽譜のBPMから求め直すため、既定へ戻す
    expect(decoded.prefs).toEqual({
      ...FULL_PREFS,
      tempoValueModeId: DEFAULT_TEMPO_VALUE_MODE_ID,
      customTempoValue: DEFAULT_CUSTOM_TEMPO_VALUE,
    });
  });

  it('同じ入力から同じ設定コードを生成する', async () => {
    const input = { name: '同じ', memo: '同じ', prefs: FULL_PREFS };
    expect(await encodePdfPreset(input)).toBe(await encodePdfPreset(input));
  });

  it('J形式を受理し、CompressionStreamがない環境でもdecodeできる', async () => {
    const code = await withoutCompressionStream(() => encodePdfPreset({
      name: 'J形式',
      memo: '',
      prefs: DEFAULT_PREFS,
    }));
    expect(code.startsWith('SKYPDF2.J.')).toBe(true);
    await expect(decodePdfPresetCode(code)).resolves.toMatchObject({
      name: 'J形式',
      prefs: DEFAULT_PREFS,
    });
  });

  it('制御文字を除去し、名前とメモをUnicode code pointsで制限する', async () => {
    const code = await withoutCompressionStream(() => encodePdfPreset({
      name: 'A\u0000B\nC',
      memo: '😀'.repeat(30),
      prefs: DEFAULT_PREFS,
    }));
    const decoded = await decodePdfPresetCode(code);
    expect(decoded.name).toBe('ABC');
    expect(decoded.memo).toBe('😀'.repeat(30));
    await expect(encodePdfPreset({ name: '😀'.repeat(31), prefs: DEFAULT_PREFS }))
      .rejects.toMatchObject({ code: 'field-too-large' });
  });

  it('JSONへ楽譜情報・背景画像・未知の入力キーを混入させない', async () => {
    const code = await withoutCompressionStream(() => encodePdfPreset({
      name: '名前',
      memo: 'メモ',
      prefs: {
        ...DEFAULT_PREFS,
        title: '曲名',
        grids: [{ keys: [1, 2, 3] }],
        backgroundImage: { dataUrl: 'data:image/png;base64,x' },
        backgroundImageOpacity: 0.3,
      },
    }));
    const raw = globalThis.atob(code.split('.')[2]);
    expect(raw).not.toContain('曲名');
    expect(raw).not.toContain('backgroundImage');
    expect(raw).not.toContain('grids');
  });

  it('不正prefix・未知version・不正base64・壊れたgzip・壊れたJSONを区別して拒否する', async () => {
    await expect(decodePdfPresetCode('BAD.G.AA'))
      .rejects.toMatchObject({ code: 'invalid-code' });
    // 旧version（SKYPDF1）と将来のversionは、どちらも読めないものとして断る
    await expect(decodePdfPresetCode('SKYPDF1.G.AA'))
      .rejects.toMatchObject({ code: 'unsupported-version' });
    await expect(decodePdfPresetCode('SKYPDF3.G.AA'))
      .rejects.toMatchObject({ code: 'unsupported-version' });
    await expect(decodePdfPresetCode('SKYPDF2.J.!'))
      .rejects.toMatchObject({ code: 'invalid-base64' });
    await expect(decodePdfPresetCode('SKYPDF2.G.AA'))
      .rejects.toMatchObject({ code: 'invalid-gzip' });
    await expect(decodePdfPresetCode(makeJsonCode({ v: 2, s: {} })))
      .rejects.toMatchObject({ code: 'invalid-settings-group' });
  });

  it('入力・展開後JSONの上限を超えたら処理を止める', async () => {
    await expect(decodePdfPresetCode('x'.repeat(MAX_PDF_PRESET_INPUT_LENGTH + 1)))
      .rejects.toMatchObject({ code: 'input-too-large' });

    const hugeJson = JSON.stringify({ padding: '0123456789'.repeat(2_000) });
    expect(new globalThis.TextEncoder().encode(hugeJson).byteLength)
      .toBeGreaterThan(MAX_PDF_PRESET_JSON_BYTES);
    const hugeCode = await makeGzipCode(hugeJson);
    await expect(decodePdfPresetCode(hugeCode))
      .rejects.toMatchObject({ code: 'json-too-large' });
  });

  it('G形式の展開に対応しないブラウザを利用者向けエラーにする', async () => {
    const code = await encodePdfPreset({ prefs: DEFAULT_PREFS });
    const original = globalThis.DecompressionStream;
    globalThis.DecompressionStream = undefined;
    try {
      await expect(decodePdfPresetCode(code))
        .rejects.toMatchObject({ code: 'unsupported-browser' });
    } finally {
      globalThis.DecompressionStream = original;
    }
  });

  it('null・配列・prototype系の未知キーを設定へ取り込まない', async () => {
    const envelope = JSON.parse(`{
      "v": 2,
      "n": "安全",
      "m": "",
      "s": {
        "d": {"p":"print","__proto__":{"polluted":true}},
        "t": {"f":"gothic"},
        "i": {},
        "p": {},
        "a": {}
      },
      "__proto__": {"polluted":true}
    }`);
    const decoded = await decodePdfPresetCode(makeJsonCode(envelope));
    expect(decoded.prefs).toEqual(DEFAULT_PREFS);
    expect(decoded.prefs).not.toHaveProperty('polluted');
    await expect(decodePdfPresetCode(makeJsonCode({
      v: 2,
      s: {
        d: null,
        t: {},
        i: {},
        p: {},
        a: {},
      },
    }))).rejects.toMatchObject({ code: 'invalid-settings-group' });
  });
});

describe('pdf preset key context and URL helpers', () => {
  it.each([
    [1, 'major', 'sharp', 'flat'],
    [1, 'major', 'flat', 'flat'],
    [3, 'major', 'sharp', 'flat'],
    [6, 'major', 'flat', 'sharp'],
    [8, 'major', 'sharp', 'flat'],
    [10, 'major', 'sharp', 'flat'],
    [4, 'minor', 'flat', 'sharp'],
    [6, 'minor', 'sharp', 'flat'],
    [9, 'minor', 'flat', 'sharp'],
    [11, 'minor', 'sharp', 'sharp'],
  ])('黒鍵主音の表記をpitchLevel=%i/keyMode=%sで解決する', (
    pitchLevel,
    keyMode,
    incoming,
    expected,
  ) => {
    expect(resolveImportedKeyNotationId(incoming, pitchLevel, keyMode)).toBe(expected);
    expect(resolveImportedKeyNotationId('both', pitchLevel, keyMode)).toBe('both');
  });

  it('自然音ではsharp/flatを保持する', () => {
    expect(resolveImportedKeyNotationId('sharp', 0, 'major')).toBe('sharp');
    expect(resolveImportedKeyNotationId('flat', 0, 'major')).toBe('flat');
  });

  it('調性表記idはmajor/minorの読込先が変わっても保持する', async () => {
    for (const keyMode of ['major', 'minor']) {
      for (const keyModeNotationId of ['compact', 'english', 'japanese', 'traditional']) {
        const decoded = await withoutCompressionStream(() => encodePdfPreset({
          prefs: { ...DEFAULT_PREFS, keyModeNotationId },
        })).then((code) => decodePdfPresetCode(code, { pitchLevel: 0, keyMode }));
        expect(decoded.prefs.keyModeNotationId).toBe(keyModeNotationId);
      }
    }
  });

  it('♩の値はcustom・halfのいずれもBPM値÷4へ戻して読み込む', async () => {
    for (const tempo of [
      { tempoValueModeId: 'custom', customTempoValue: 120 },
      { tempoValueModeId: 'half', customTempoValue: DEFAULT_CUSTOM_TEMPO_VALUE },
    ]) {
      const code = await encodePdfPreset({ prefs: { ...DEFAULT_PREFS, ...tempo } });
      const decoded = await decodePdfPresetCode(code, { pitchLevel: 0, keyMode: 'major' });
      expect(decoded.prefs.tempoValueModeId).toBe(DEFAULT_TEMPO_VALUE_MODE_ID);
      expect(decoded.prefs.customTempoValue).toBe(DEFAULT_CUSTOM_TEMPO_VALUE);

      // 既定のまま読み込む側では、♩の値は変わらないので差分に出ない
      expect(buildPdfPresetDiff(
        DEFAULT_PREFS,
        { ...DEFAULT_PREFS, ...tempo },
        { pitchLevel: 0, keyMode: 'major' },
      ).find((section) => section.id === 'scoreInfo').changes).toEqual([]);
    }

    // 自分がカスタム値を使っている場合は、既定へ戻ることを差分に出す
    expect(buildPdfPresetDiff(
      { ...DEFAULT_PREFS, tempoValueModeId: 'custom', customTempoValue: 120 },
      DEFAULT_PREFS,
      { pitchLevel: 0, keyMode: 'major' },
    ).find((section) => section.id === 'scoreInfo').changes).toEqual([
      { key: 'tempoValueModeId', label: '♩の値', current: 'カスタム', imported: 'BPM値 ÷ 4' },
      { key: 'customTempoValue', label: 'カスタム値', current: '120', imported: '30' },
    ]);
  });

  it('設定コード単体と共有URLからcodeだけを抽出する', async () => {
    const code = await encodePdfPreset({ prefs: DEFAULT_PREFS });
    const url = buildPdfPresetUrl(code, { origin: 'https://example.test' }, '/sky/');
    expect(url).toBe(`https://example.test/sky/#pdf-preset=${code}`);
    expect(extractPdfPresetCode(code)).toBe(code);
    expect(extractPdfPresetCode(url)).toBe(code);
    expect(extractPdfPresetCode('https://example.test/sky/')).toBeNull();
    expect(extractPdfPresetCode('not a code')).toBeNull();
  });

  it('5sectionの差分を既存定義の表示ラベルで返す', () => {
    const imported = {
      ...DEFAULT_PREFS,
      presetId: 'winterDark',
      fontId: 'mincho',
      scoreInfoDesignId: 'cover',
      keyNotationId: 'sharp',
      maxRowsPerPage: 12,
    };
    const diff = buildPdfPresetDiff(
      DEFAULT_PREFS,
      imported,
      { pitchLevel: 1, keyMode: 'major' },
    );
    expect(diff.map((section) => section.id)).toEqual([
      'design', 'typography', 'scoreInfo', 'page', 'paper',
    ]);
    expect(diff.find((section) => section.id === 'design').changes).toEqual([
      { key: 'presetId', label: '配色', current: '印刷用', imported: '冬・凛' },
    ]);
    expect(diff.find((section) => section.id === 'typography').changes).toEqual([
      { key: 'fontId', label: '書体', current: 'ゴシック', imported: '明朝' },
    ]);
    expect(diff.find((section) => section.id === 'scoreInfo').changes).toEqual([
      { key: 'scoreInfoDesignId', label: '曲情報デザイン', current: '楽譜', imported: '表紙' },
      { key: 'keyNotationId', label: 'キー表記', current: '併記', imported: '♭' },
    ]);
    expect(diff.find((section) => section.id === 'paper').changes).toEqual([
      { key: 'maxRowsPerPage', label: '1ページの行数', current: '6行', imported: '12行' },
    ]);
    expect(diff.find((section) => section.id === 'page').changes).toEqual([]);
    expect(diff.every((section) => 'id' in section && 'label' in section && 'changes' in section))
      .toBe(true);
  });
});

describe('pdf preset defaults are stable', () => {
  it('テスト用既定値が現行pdfPrefsの既定値と一致する', () => {
    expect(DEFAULT_PREFS.presetId).toBe(DEFAULT_PRESET_ID);
    expect(DEFAULT_PREFS.fontId).toBe(DEFAULT_FONT_ID);
    expect(DEFAULT_PREFS.fontWeightId).toBe(DEFAULT_FONT_WEIGHT_ID);
    expect(DEFAULT_PREFS.titleFontSizePt).toBe(pdfConfig.titleFontSizePt);
    expect(DEFAULT_PREFS.metaFontSizePt).toBe(pdfConfig.metaFontSizePt);
    expect(DEFAULT_PREFS.gridNumberDisplayId).toBe(DEFAULT_GRID_NUMBER_DISPLAY_ID);
    expect(DEFAULT_PREFS.sheetLayoutId).toBe(DEFAULT_SHEET_LAYOUT_ID);
    expect(DEFAULT_PREFS.scoreInfoDesignId).toBe(DEFAULT_SCORE_INFO_DESIGN_ID);
    expect(DEFAULT_PREFS.mastheadDirectionId).toBe(DEFAULT_MASTHEAD_DIRECTION_ID);
    expect(DEFAULT_PREFS.tempoValueModeId).toBe(DEFAULT_TEMPO_VALUE_MODE_ID);
    expect(DEFAULT_PREFS.customTempoValue).toBe(DEFAULT_CUSTOM_TEMPO_VALUE);
    expect(DEFAULT_PREFS.pageMarginId).toBe(DEFAULT_PAGE_MARGIN_ID);
    expect(DEFAULT_PREFS.gridGapId).toBe(DEFAULT_GRID_GAP_ID);
    expect(DEFAULT_PREFS.keyNotationId).toBe(DEFAULT_KEY_NOTATION_ID);
    expect(DEFAULT_PREFS.keyModeNotationId).toBe(DEFAULT_KEY_MODE_NOTATION_ID);
    expect(DEFAULT_PREFS.gridStyleId).toBe(DEFAULT_PDF_GRID_STYLE_ID);
    expect(DEFAULT_PREFS.gridStyleCustom).toEqual(DEFAULT_PDF_GRID_STYLE_CUSTOM);
  });
});
