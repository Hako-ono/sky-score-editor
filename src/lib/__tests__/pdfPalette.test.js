import { describe, it, expect } from 'vitest';

import {
  PDF_PRESETS,
  PRESET_MIX,
  CUSTOM_PRESET_ID,
  mixHex,
  complementHex,
  contrastRatio,
  buildPdfPalette,
  sanitizeCustomSeed,
  isDarkSeedBg,
  DEFAULT_CUSTOM_SEED,
  deriveSeedFromSimple,
  resolvePaletteSeed,
  SIMPLE_SURFACE_MIX_RATIO,
} from '../../constants/config.js';

/* ============================================================
 * この関数が満たすべき契約
 * ------------------------------------------------------------
 * mixHex(a, b, t) -> '#RRGGBB'
 *   - t=0 で a、t=1 で b と一致する。
 *   - 中間値は各チャンネルを線形補間し四捨五入した16進数になる。
 *
 * buildPdfPalette(preset, mix) -> { 14トークン }
 *   - 返り値のすべてのトークンが '#RRGGBB' 形式である。
 *   - symbolHighlight は、accent の対比が ink 側で強い（明色）プリセット
 *     では ink から、bg 側で強い（暗色）プリセットでは bg から
 *     accentLine へ寄せた色になる。
 *   - 9プリセットすべてが、印刷可読性のためのコントラスト目標
 *     （下記テーブル）を満たす。目標値はプリセットの色を検証する
 *     唯一の回帰点なので、通すために目標値を下げてはならない。
 * ============================================================ */

const HEX_RE = /^#[0-9a-f]{6}$/i;
const TOKEN_KEYS = [
  'pageBackground', 'cellFill', 'cellStroke', 'cellFillHighlight',
  'cellStrokeHighlight', 'cellFillHighlight2', 'cellStrokeHighlight2', 'text', 'title',
  'outerFrame', 'symbol', 'symbolHighlight', 'symbolHighlight2', 'number',
];

describe('mixHex', () => {
  it('t=0 で a と一致する', () => {
    expect(mixHex('#112233', '#FFFFFF', 0)).toBe('#112233');
  });

  it('t=1 で b と一致する', () => {
    expect(mixHex('#112233', '#FFFFFF', 1)).toBe('#ffffff');
  });

  it('中間値で線形補間し四捨五入する', () => {
    // 0x00 と 0x0A の中間 (t=0.5) は 5 (四捨五入なし) になる
    expect(mixHex('#000000', '#0A0A0A', 0.5)).toBe('#050505');
    // 丸めの確認: 0 -> 3 へ t=1/3 は 1.0 = 1
    expect(mixHex('#000000', '#030303', 1 / 3)).toBe('#010101');
  });
});

describe('buildPdfPalette', () => {
  it.each(Object.entries(PDF_PRESETS))('%s: 14トークンすべてが #RRGGBB 形式である', (_id, preset) => {
    const palette = buildPdfPalette(preset);
    expect(Object.keys(palette).sort()).toEqual([...TOKEN_KEYS].sort());
    for (const key of TOKEN_KEYS) {
      expect(palette[key], `${key} が不正な形式: ${palette[key]}`).toMatch(HEX_RE);
    }
  });

  it('明色プリセット (print) では symbolHighlight が ink 側から引かれる', () => {
    const preset = PDF_PRESETS.print;
    const palette = buildPdfPalette(preset);
    const expected = mixHex(preset.seed.ink, preset.seed.accentLine, PRESET_MIX.symbolHighlight);
    expect(palette.symbolHighlight).toBe(expected);
  });

  it('暗色プリセット (winterDark) では symbolHighlight が bg 側から引かれる', () => {
    const preset = PDF_PRESETS.winterDark;
    const palette = buildPdfPalette(preset);
    const expected = mixHex(preset.seed.bg, preset.seed.accentLine, PRESET_MIX.symbolHighlight);
    expect(palette.symbolHighlight).toBe(expected);
  });

  it.each(Object.entries(PDF_PRESETS))(
    '%s: 第2色は明示値またはaccentのHSL補色を決定的に使う',
    (_id, preset) => {
      const palette = buildPdfPalette(preset);
      expect(palette.cellFillHighlight2).toBe(
        preset.seed.accent2 ?? complementHex(preset.seed.accent),
      );
      expect(palette.cellStrokeHighlight2).toBe(
        preset.seed.accentLine2 ?? complementHex(preset.seed.accentLine),
      );
    },
  );

  it('印刷用の第2色は計画書の固定値である', () => {
    const palette = buildPdfPalette(PDF_PRESETS.print);
    expect(palette.cellFillHighlight2).toBe('#78AAF2');
    expect(palette.cellStrokeHighlight2).toBe('#0B54A6');
  });

  it('第2記号も第1記号と同じ混色規則を使う', () => {
    const preset = PDF_PRESETS.print;
    const palette = buildPdfPalette(preset);
    const expected = mixHex(
      preset.seed.ink,
      preset.seed.accentLine2,
      PRESET_MIX.symbolHighlight,
    );
    expect(palette.symbolHighlight2).toBe(expected);
  });

});

describe('PDF_PRESETS のコントラスト目標', () => {
  const checks = [
    ['歌詞 / 紙面', (p) => contrastRatio(p.text, p.pageBackground), 4.5],
    ['番号 / 紙面', (p) => contrastRatio(p.number, p.pageBackground), 3.0],
    ['記号 / 通常セル', (p) => contrastRatio(p.symbol, p.cellFill), 3.0],
    ['記号 / 押鍵セル', (p) => contrastRatio(p.symbolHighlight, p.cellFillHighlight), 3.0],
    ['記号2 / 押鍵セル2', (p) => contrastRatio(p.symbolHighlight2, p.cellFillHighlight2), 3.0],
    ['押鍵面 / 通常面', (p) => contrastRatio(p.cellFillHighlight, p.cellFill), 1.30],
    ['押鍵面2 / 通常面', (p) => contrastRatio(p.cellFillHighlight2, p.cellFill), 1.30],
    ['押鍵枠 / 通常枠', (p) => contrastRatio(p.cellStrokeHighlight, p.cellStroke), 1.35],
    ['押鍵枠2 / 通常枠', (p) => contrastRatio(p.cellStrokeHighlight2, p.cellStroke), 1.35],
    ['外枠 / 紙面', (p) => contrastRatio(p.outerFrame, p.pageBackground), 1.15],
  ];

  for (const [presetId, preset] of Object.entries(PDF_PRESETS)) {
    const palette = buildPdfPalette(preset);
    describe(presetId, () => {
      it.each(checks)('%s は目標以上のコントラスト比を持つ', (_label, getRatio, target) => {
        expect(getRatio(palette)).toBeGreaterThanOrEqual(target);
      });
    });
  }
});

/* ============================================================
 * sanitizeCustomSeed(custom, fallback) -> { bg, ink, line, surface, accent, accentLine, accent2, accentLine2 }
 *   - #RRGGBB形式の文字列はそのまま使う。
 *   - 不正な値（文字列でない・形式違反）・キー欠落は、そのキーだけ
 *     fallback（既定は PDF_PRESETS.print.seed）へ落ちる。
 * isDarkSeedBg(bg) -> boolean
 *   - PDF_PRESETSの明色プリセットのbgでfalse、暗色プリセットのbgでtrue。
 * ============================================================ */
describe('sanitizeCustomSeed', () => {
  it('全キーが正しい#RRGGBBならそのまま返す', () => {
    const custom = {
      bg: '#111111', ink: '#222222', line: '#333333',
      surface: '#444444', accent: '#555555', accentLine: '#666666',
      accent2: '#777777', accentLine2: '#888888',
    };
    expect(sanitizeCustomSeed(custom)).toEqual(custom);
  });

  it('不正な形式のキーだけ fallback に落ちる', () => {
    const result = sanitizeCustomSeed({
      bg: '#111111',
      ink: 'not-a-color',
      line: '#12345', // 桁不足
      surface: 123, // 文字列でない
      // accent, accentLine は欠落
    });
    expect(result.bg).toBe('#111111');
    expect(result.ink).toBe(PDF_PRESETS.print.seed.ink);
    expect(result.line).toBe(PDF_PRESETS.print.seed.line);
    expect(result.surface).toBe(PDF_PRESETS.print.seed.surface);
    expect(result.accent).toBe(PDF_PRESETS.print.seed.accent);
    expect(result.accentLine).toBe(PDF_PRESETS.print.seed.accentLine);
    expect(result.accent2).toBe(complementHex(result.accent));
    expect(result.accentLine2).toBe(complementHex(result.accentLine));
  });

  it('旧形式で欠落した第2色はサニタイズ済み第1色から補色導出する', () => {
    const result = sanitizeCustomSeed({
      accent: '#123456',
      accentLine: '#654321',
    });
    expect(result.accent2).toBe(complementHex(result.accent));
    expect(result.accentLine2).toBe(complementHex(result.accentLine));
  });

  it('第2色も項目単位で既定の第2色へ戻す', () => {
    const result = sanitizeCustomSeed({
      accent: '#123456',
      accentLine: '#654321',
      accent2: 'invalid',
      accentLine2: 42,
    });
    expect(result.accent2).toBe(PDF_PRESETS.print.seed.accent2);
    expect(result.accentLine2).toBe(PDF_PRESETS.print.seed.accentLine2);
  });

  it('custom が undefined / null / 配列でも全キーが fallback に落ちる', () => {
    expect(sanitizeCustomSeed(undefined)).toEqual(PDF_PRESETS.print.seed);
    expect(sanitizeCustomSeed(null)).toEqual(PDF_PRESETS.print.seed);
    expect(sanitizeCustomSeed(['#111111'])).toEqual(PDF_PRESETS.print.seed);
  });

  // 既定値の情報源は DEFAULT_CUSTOM_SEED の1つだけ（未保存時の初期値・
  // 不正値のフォールバック・UIの「既定の色に戻す」が全部これを見る）
  it('既定のフォールバック先は DEFAULT_CUSTOM_SEED である', () => {
    expect(DEFAULT_CUSTOM_SEED).toEqual(PDF_PRESETS.print.seed);
    expect(sanitizeCustomSeed(undefined)).toEqual(DEFAULT_CUSTOM_SEED);
  });

  it('大文字・小文字どちらの16進数も許容する', () => {
    const result = sanitizeCustomSeed({ bg: '#AbCdEf' });
    expect(result.bg).toBe('#AbCdEf');
  });

  it('fallback を明示指定するとそちらを使う', () => {
    const fallback = PDF_PRESETS.winterDark.seed;
    const result = sanitizeCustomSeed({}, fallback);
    expect(result).toEqual({
      ...fallback,
      accent2: complementHex(fallback.accent),
      accentLine2: complementHex(fallback.accentLine),
    });
  });
});

describe('isDarkSeedBg', () => {
  it.each(Object.entries(PDF_PRESETS))('%s の isDark と一致する', (_id, preset) => {
    expect(isDarkSeedBg(preset.seed.bg)).toBe(preset.isDark);
  });
});

/* ============================================================
 * deriveSeedFromSimple({ bg, ink, line }, base) -> 8キーのseed
 *   - bg/ink/lineはそのまま。
 *   - surfaceは mixHex(bg, line, SIMPLE_SURFACE_MIX_RATIO) で導出する。
 *   - accent/accentLineはbaseからそのまま引き継ぐ（導出しない）。
 *   - 9プリセットのbg/ink/lineから逆算したsurfaceは、実際のsurfaceを
 *     チャンネルごとの最大誤差8以内で再現する（実測して固定した許容誤差）。
 * ============================================================ */
function maxChannelDistance(a, b) {
  const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return Math.max(...[0, 1, 2].map((i) => Math.abs(ch(a, i) - ch(b, i))));
}

describe('deriveSeedFromSimple', () => {
  it('bg/ink/lineはそのまま、surfaceは指定の比率でmixHexした値になる', () => {
    const base = PDF_PRESETS.winterDark.seed;
    const simple = { bg: '#111111', ink: '#eeeeee', line: '#333333' };
    const result = deriveSeedFromSimple(simple, base);
    expect(result.bg).toBe(simple.bg);
    expect(result.ink).toBe(simple.ink);
    expect(result.line).toBe(simple.line);
    expect(result.surface).toBe(mixHex(simple.bg, simple.line, SIMPLE_SURFACE_MIX_RATIO));
  });

  it('accent/accentLineはbaseからそのまま引き継ぐ（導出しない）', () => {
    const base = PDF_PRESETS.autumnDark.seed;
    const simple = { bg: '#000000', ink: '#ffffff', line: '#808080' };
    const result = deriveSeedFromSimple(simple, base);
    expect(result.accent).toBe(base.accent);
    expect(result.accentLine).toBe(base.accentLine);
    expect(result.accent2).toBe(base.accent2);
    expect(result.accentLine2).toBe(base.accentLine2);
  });

  it.each(Object.entries(PDF_PRESETS))(
    '%s: プリセットのbg/ink/lineから逆算したsurfaceは、実際のsurfaceをチャンネル誤差8以内で再現する',
    (_id, preset) => {
      const { bg, ink, line, surface } = preset.seed;
      const result = deriveSeedFromSimple({ bg, ink, line }, preset.seed);
      expect(maxChannelDistance(result.surface, surface)).toBeLessThanOrEqual(8);
    },
  );
});

/* ============================================================
 * resolvePaletteSeed(options) -> seed
 *   - presetId通りの種色をそのまま返す。
 *   - 背景画像の有無は種色に影響しない（背景画像は背景色の上に重ねて
 *     描かれるため、背景色は利用者が自由に選べる）。
 *   - pdfExport.js（実際の出力）と Toolbar.jsx（スウォッチ・入力欄の
 *     プレビュー）の両方がこの関数を使う（以前は別々に実装されていて、
 *     スウォッチと出力が食い違う不整合があった）。
 * ============================================================ */
describe('resolvePaletteSeed', () => {
  it('プリセットの種色と第2色を返す', () => {
    const seed = resolvePaletteSeed({ presetId: 'winterDark', backgroundImage: null });
    expect(seed).toEqual({
      ...PDF_PRESETS.winterDark.seed,
      accent2: complementHex(PDF_PRESETS.winterDark.seed.accent),
      accentLine2: complementHex(PDF_PRESETS.winterDark.seed.accentLine),
    });
  });

  it.each(Object.entries(PDF_PRESETS))('%s: スウォッチ用の第2色まで必ず揃う', (_id, preset) => {
    const seed = resolvePaletteSeed({ presetId: _id, backgroundImage: null });
    expect(seed.accent2).toBe(preset.seed.accent2 ?? complementHex(preset.seed.accent));
    expect(seed.accentLine2).toBe(
      preset.seed.accentLine2 ?? complementHex(preset.seed.accentLine),
    );
  });

  it('custom の種色をそのまま返す', () => {
    const custom = {
      bg: '#101010', ink: '#f0f0f0', line: '#202020',
      surface: '#303030', accent: '#e0a020', accentLine: '#c08010',
      accent2: '#2060E0', accentLine2: '#1050C0',
    };
    const seed = resolvePaletteSeed({ presetId: CUSTOM_PRESET_ID, custom, backgroundImage: null });
    expect(seed).toEqual(custom);
  });

  it('背景画像があっても、プリセットの種色は差し替えない', () => {
    const seed = resolvePaletteSeed({
      presetId: 'winterDark',
      backgroundImage: { dataUrl: 'data:image/jpeg;base64,x', width: 10, height: 10 },
    });
    expect(seed.bg).toBe(PDF_PRESETS.winterDark.seed.bg);
    expect(seed.ink).toBe(PDF_PRESETS.winterDark.seed.ink);
    expect(seed.line).toBe(PDF_PRESETS.winterDark.seed.line);
    expect(seed.surface).toBe(PDF_PRESETS.winterDark.seed.surface);
    expect(seed.accent).toBe(PDF_PRESETS.winterDark.seed.accent);
    expect(seed.accentLine).toBe(PDF_PRESETS.winterDark.seed.accentLine);
  });

  it('背景画像があっても、customの種色は差し替えず、元のcustomオブジェクトも変更しない', () => {
    const custom = {
      bg: '#101010', ink: '#f0f0f0', line: '#202020',
      surface: '#303030', accent: '#e0a020', accentLine: '#c08010',
    };
    const seed = resolvePaletteSeed({
      presetId: CUSTOM_PRESET_ID,
      custom,
      backgroundImage: { dataUrl: 'data:image/jpeg;base64,x', width: 10, height: 10 },
    });
    expect(seed.bg).toBe('#101010');
    expect(seed.ink).toBe(custom.ink);
    expect(custom.bg).toBe('#101010'); // 呼び出し元のcustomは書き換わらない
  });

  it('presetId が custom で custom が壊れた形式のときは、キーごとに既定値へフォールバックする', () => {
    const seed = resolvePaletteSeed({
      presetId: CUSTOM_PRESET_ID,
      custom: { bg: 'not-a-color' },
      backgroundImage: { dataUrl: 'data:image/jpeg;base64,x', width: 10, height: 10 },
    });
    expect(seed.bg).toBe(PDF_PRESETS.print.seed.bg);
    expect(seed.ink).toBe(PDF_PRESETS.print.seed.ink);
  });
});
