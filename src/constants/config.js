/**
 * アプリ全体で共有する定数と、画面/PDF 両方で使うグリッド幾何情報。
 * 元アプリの HTML テンプレートに埋め込まれていた座標・記号配置をここへ集約した。
 */

export const EDITOR_JSON_FORMAT_VERSION = 'sky-editor-v1';
export const EDITOR_JSON_FORMAT_VERSION_V2 = 'sky-editor-v2';
export const DEFAULT_BPM = 120;
export const DRAFT_STORAGE_KEY = 'sky-score-editor:draft:v3';
// PDF出力の配色・書体設定。楽譜の属性ではなく出力側の好みなので、
// 楽譜JSON（draft含む）とは別のキーに独立して持つ。
export const PDF_PREFS_STORAGE_KEY = 'sky-score-editor:pdf-prefs:v1';
// `?debug=1` の計測をリロードをまたいで見るための一時置き場。DEBUG_ENABLED の
// ときしか読み書きしない（タブを閉じれば消える sessionStorage）。
export const DEBUG_METRICS_STORAGE_KEY = 'sky-score-editor:debug-metrics:v1';
export const MAX_GRIDS = 3000;
// 信頼境界: 元形式の songNotes は、Map/Setやソートを構築する前に
// 配列の件数を確認する。MAX_GRIDSとは独立した固定値として、上限変更時に
// 入力処理の負荷を自動で拡大させない。
export const MAX_SONG_NOTES = 50_000;
// 信頼境界: title/author/lyricist/transcribedBy/text の文字数上限。
// parseScore.js（読み込み経路）と scoreReducer.js（state書き込み経路）の
// 両方から参照するため、どちらにも属さないこの定数置き場に置く。
export const MAX_METADATA_LENGTH = 200;
export const MAX_TEXT_LENGTH = 100;

/** PDF本文の余白プリセット。値ではなくidをpdf-prefsへ保存する。 */
export const PDF_PAGE_MARGINS = {
  narrow: { label: '狭い', marginPt: 24 },
  standard: { label: '標準', marginPt: 40 },
  wide: { label: '広い', marginPt: 64 },
};

export const DEFAULT_PAGE_MARGIN_ID = 'standard';

/** PDF内のグリッド間隔プリセット。横・縦を別々に自由入力させない。 */
export const PDF_GRID_GAPS = {
  tight: { label: '詰める', horizontalPt: 12, verticalPt: 45 },
  standard: { label: '標準', horizontalPt: 30, verticalPt: 80 },
  loose: { label: '広げる', horizontalPt: 56, verticalPt: 130 },
};

export const DEFAULT_GRID_GAP_ID = 'standard';

// marginPt の選択にかかわらず、ページ番号は用紙下端から18ptの位置に置く。
export const PDF_PAGE_NUMBER_BOTTOM_OFFSET_PT = 18;

// 下端のページ装飾は動かさず、見出しと本文だけを上余白内へ少し寄せる。
export const PDF_CONTENT_TOP_SHIFT_PT = 8;

// 区切り線と本文を保ったまま、先頭ページの曲情報だけを少し上へ寄せる。
export const PDF_FIRST_PAGE_HEADER_TEXT_SHIFT_PT = 8;

/** 楽譜レイアウト設定 */
export const layoutConfig = {
  gridBaseWidth: 350,
  gridBaseHeight: 275,
};

/** PDF 出力設定 (A4 縦) */
export const pdfConfig = {
  pageWidthPt: 595.28,
  pageHeightPt: 841.89,
  marginPt: PDF_PAGE_MARGINS[DEFAULT_PAGE_MARGIN_ID].marginPt,
  // 見出し（曲名＋曲情報）用に上部へ確保する高さ。2ページ目以降は見出しを
  // 描かないが、確保する高さは全ページで揃える。ページごとに本文の領域が
  // 変わると縮尺（contentHeightPt / svgHeight）も変わり、グリッドの大きさが
  // ページ間で食い違うため。
  titleAreaPt: 80,
  titleFontSizePt: 20,
  metaFontSizePt: 9, // 作曲者・作詞者・譜面作成者・BPM・拍子・キー
  pageNumberFontSizePt: 10,
  maxRowsPerPage: 6,
  gridBaseWidth: layoutConfig.gridBaseWidth,
  gridBaseHeight: layoutConfig.gridBaseHeight,
  gridHorizontalSpacing: PDF_GRID_GAPS[DEFAULT_GRID_GAP_ID].horizontalPt,
  gridVerticalSpacing: PDF_GRID_GAPS[DEFAULT_GRID_GAP_ID].verticalPt,
  get contentWidthPt() {
    return this.pageWidthPt - 2 * this.marginPt;
  },
  get contentHeightPt() {
    return this.pageHeightPt - 2 * this.marginPt - this.titleAreaPt;
  },
  // 本文の下端は marginPt の位置で終わるため、ページ番号は下余白の中に置く。
  get pageNumberBaselinePt() {
    return this.pageHeightPt - PDF_PAGE_NUMBER_BOTTOM_OFFSET_PT;
  },
};

/**
 * 15 鍵の記号種別。Sky の楽器レイアウト (3 行 × 5 列) に対応。
 *  - 'cd' : 円 + ひし形 (四隅と中央)
 *  - 'd'  : ひし形
 *  - 'c'  : 円
 * インデックスは 0〜14。元 HTML の btn-0〜btn-14 の記号と一致させている。
 */
export const SYMBOL_TYPES = [
  'cd', 'd', 'c', 'd', 'c', // 0-4
  'c', 'd', 'cd', 'd', 'c', // 5-9
  'c', 'd', 'c', 'd', 'cd', // 10-14
];

/** グリッド内側の余白 (元テンプレートの translate(5,5) に相当) */
const INNER_OFFSET = 5;
const CELL_SIZE = 60;
const COL_X = [30, 100, 170, 240, 310];
const ROW_Y = [30, 100, 170];

/**
 * 15 ボタンの座標を生成する。cx/cy は記号の中心、rectX/rectY はセル枠の左上。
 * 画面 SVG と PDF SVG の両方でこの配列を使う。
 */
export const BUTTON_POSITIONS = SYMBOL_TYPES.map((type, index) => {
  const col = index % 5;
  const row = Math.floor(index / 5);
  const cx = INNER_OFFSET + COL_X[col];
  const cy = INNER_OFFSET + ROW_Y[row];
  return {
    index,
    type,
    cx,
    cy,
    rectX: cx - CELL_SIZE / 2,
    rectY: cy - CELL_SIZE / 2,
    cellSize: CELL_SIZE,
  };
});

/** グリッド内テキスト(歌詞など)の表示位置。番号は左下、テキストは中央下。 */
export const GRID_NUMBER_POS = { x: INNER_OFFSET + 0, y: INNER_OFFSET + 250 };
export const GRID_TEXT_CENTER = { x: INNER_OFFSET + 165, y: INNER_OFFSET + 238 };

/** 記号の形状値（ひし形の中心から頂点までの距離、頂点列、円の半径） */
export const DIAMOND_HALF_SIZE = 25;
export const DIAMOND_POINTS = '0,-25 25,0 0,25 -25,0';
export const CIRCLE_RADIUS = 18;
// 半透明時に交差部分が二重描画されないよう、円とひし形を1回のstrokeで描く。
export const COMBINED_SYMBOL_PATH =
  'M 0 -25 L 25 0 L 0 25 L -25 0 Z M 18 0 A 18 18 0 1 0 -18 0 A 18 18 0 1 0 18 0';

/**
 * PDF配色プリセットの種色（seed）。印刷用1種＋四季×明暗8種の計9種。
 * 各プリセットは bg/ink/line/surface/accent/accentLine の6色を基本とし、
 * 必要なプリセットだけ accent2/accentLine2 を明示できる。残りのトークンは
 * buildPdfPalette() が共通の比率で導出する（9×14個の16進数を個別に保守しないため）。
 *
 * 色そのものはコントラスト比を検証済みの確定値。
 * 目分量で変更しないこと。
 */
export const PDF_PRESETS = {
  print: {
    label: '印刷用',
    isDark: false,
    seed: {
      bg: '#FFFFFF', ink: '#212529', line: '#ADB5BD',
      surface: '#E9ECEF', accent: '#F2C078', accentLine: '#A65D0B',
      accent2: '#78AAF2', accentLine2: '#0B54A6',
    },
  },
  springLight: {
    label: '春・淡',
    isDark: false,
    seed: {
      bg: '#FAFCF2', ink: '#35402B', line: '#B2C795',
      surface: '#E9F1DA', accent: '#F7AEC8', accentLine: '#CF5F8C',
      // HSL補色のままでは通常面・通常枠との差が目標を下回るため、
      // 色相の方向性を保った暗めの第2色を明示する。
      accent2: '#52A67D', accentLine2: '#2A8B63',
    },
  },
  springDark: {
    label: '春・宵',
    isDark: true,
    seed: {
      bg: '#33262F', ink: '#F5E9EE', line: '#806573',
      surface: '#43323D', accent: '#EE9FBF', accentLine: '#FFD6E4',
    },
  },
  summerLight: {
    label: '夏・涼',
    isDark: false,
    seed: {
      bg: '#EFF8FD', ink: '#0F3A57', line: '#93BFDA',
      surface: '#D8E9F6', accent: '#F5BE2E', accentLine: '#9E6208',
    },
  },
  summerDark: {
    label: '夏・夜',
    isDark: true,
    seed: {
      bg: '#1E3336', ink: '#E2EFE8', line: '#5E807C',
      surface: '#2B4448', accent: '#E9E169', accentLine: '#FBF7C0',
    },
  },
  autumnLight: {
    label: '秋・実',
    isDark: false,
    seed: {
      bg: '#FDFAF3', ink: '#40301F', line: '#C2A47D',
      surface: '#F1E4D0', accent: '#E8925A', accentLine: '#B85C2A',
    },
  },
  autumnDark: {
    label: '秋・暮',
    isDark: true,
    seed: {
      bg: '#33261D', ink: '#F5E9DA', line: '#836B52',
      surface: '#43342A', accent: '#EDAC68', accentLine: '#FFDFB2',
    },
  },
  winterLight: {
    label: '冬・雪',
    isDark: false,
    seed: {
      bg: '#FAFCFE', ink: '#263440', line: '#A9BDCB',
      surface: '#E6EDF3', accent: '#9DCBEC', accentLine: '#3D7FB5',
    },
  },
  winterDark: {
    label: '冬・凛',
    isDark: true,
    seed: {
      bg: '#232C39', ink: '#E9F0F8', line: '#64788E',
      surface: '#313C4C', accent: '#ABC9EC', accentLine: '#DFEBFA',
    },
  },
};

export const DEFAULT_PRESET_ID = 'print';
// カスタム配色を選んでいることを示す presetId。PDF_PRESETS には持たせない
// （seed をそのまま利用者が差し替える枠であり、コントラスト検証済みの
// 確定値ではないため）。
export const CUSTOM_PRESET_ID = 'custom';

/** buildPdfPalette() が種色から描画トークンを導出する際の混色比率。 */
export const PRESET_MIX = {
  outerFrame: 0.35,      // line → bg
  symbol: 0.45,          // line → ink
  number: 0.55,          // line → ink
  symbolHighlight: 0.20, // 対比が立つ側 → accentLine
};

/** a を b へ t（0〜1）だけ寄せた色。 */
export function mixHex(a, b, t) {
  const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const v = (i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t);
  return '#' + [0, 1, 2].map((i) => v(i).toString(16).padStart(2, '0')).join('');
}

/** #RRGGBB の色相をHSL上で回転する。第2色の既定値を一か所で導出する。 */
export function rotateHueHex(hex, degrees) {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);
    if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
    else if (max === green) hue = ((blue - red) / delta + 2) / 6;
    else hue = ((red - green) / delta + 4) / 6;
  }

  hue = (hue + degrees / 360) % 1;
  if (hue < 0) hue += 1;

  const hueToRgb = (p, q, t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channels = saturation === 0
    ? [lightness, lightness, lightness]
    : [hueToRgb(p, q, hue + 1 / 3), hueToRgb(p, q, hue), hueToRgb(p, q, hue - 1 / 3)];
  return `#${channels
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0').toUpperCase())
    .join('')}`;
}

export function complementHex(hex) {
  return rotateHueHex(hex, 180);
}

/** WCAG の相対輝度。カスタム配色の明暗判定（isDarkSeedBg）とも共有する。 */
export function relativeLuminance(h) {
  const c = [0, 1, 2]
    .map((i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) / 255)
    .map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG の相対輝度比。 */
export function contrastRatio(a, b) {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * カスタム配色の bg が暗色かどうか。既存プリセットの `isDark` フラグと
 * 同じ用途（Toolbar.jsx の暗色向け注意書きの出し分け）に使う。
 * 9プリセットの実測では明色bgが0.92〜1.0、暗色bgが0.02〜0.03と大きく
 * 離れているため、0.5 を閾値にすれば全プリセットの isDark と一致する。
 */
export function isDarkSeedBg(bg) {
  return relativeLuminance(bg) < 0.5;
}

/** 種色から、PDF描画で使う14トークンを組み立てる。 */
export function buildPdfPalette(preset, mix = PRESET_MIX) {
  const s = preset.seed;
  const accent2 = s.accent2 ?? complementHex(s.accent);
  const accentLine2 = s.accentLine2 ?? complementHex(s.accentLine);
  // 押鍵セルの記号は、面の色に対して対比が立つ側（文字色か紙面色）から引く。
  // これにより暗色プリセットでは記号が暗くなり、押した鍵だけが光って見える。
  const base = contrastRatio(s.accent, s.ink) >= contrastRatio(s.accent, s.bg)
    ? s.ink
    : s.bg;
  const base2 = contrastRatio(accent2, s.ink) >= contrastRatio(accent2, s.bg)
    ? s.ink
    : s.bg;
  return {
    pageBackground: s.bg,
    cellFill: s.surface,
    cellStroke: s.line,
    cellFillHighlight: s.accent,
    cellStrokeHighlight: s.accentLine,
    cellFillHighlight2: accent2,
    cellStrokeHighlight2: accentLine2,
    text: s.ink,
    title: s.ink,
    outerFrame: mixHex(s.line, s.bg, mix.outerFrame),
    symbol: mixHex(s.line, s.ink, mix.symbol),
    symbolHighlight: mixHex(base, s.accentLine, mix.symbolHighlight),
    symbolHighlight2: mixHex(base2, accentLine2, mix.symbolHighlight),
    number: mixHex(s.line, s.ink, mix.number),
    ...preset.overrides,
  };
}

/**
 * PDF埋め込みフォントの選択肢。idを書体名ではなく意味ベース
 * （gothic/mincho/rounded）にしているのは、将来フォントの実体を
 * 差し替えても利用者の localStorage に残った値が無効にならないため。
 */
export const PDF_FONTS = {
  gothic: {
    label: 'ゴシック',
    flatGlyph: '♭',
    regular: {
      name: 'Zen Kaku Gothic New',
      file: 'ZenKakuGothicNew-Regular.ttf',
    },
    bold: {
      name: 'Zen Kaku Gothic New Bold',
      file: 'ZenKakuGothicNew-Bold.ttf',
    },
    approxMB: 2.3,
  },
  mincho: {
    label: '明朝',
    // Shippori MinchoはU+266Dを持たないため、PDFでは欠落しないASCII表記に落とす。
    flatGlyph: 'b',
    regular: {
      name: 'Shippori Mincho',
      file: 'ShipporiMincho-Regular.ttf',
    },
    bold: {
      name: 'Shippori Mincho Bold',
      file: 'ShipporiMincho-Bold.ttf',
    },
    approxMB: 8.3,
  },
  rounded: {
    label: '丸ゴシック',
    flatGlyph: '♭',
    regular: {
      name: 'Zen Maru Gothic',
      file: 'ZenMaruGothic-Regular.ttf',
    },
    bold: {
      name: 'Zen Maru Gothic Bold',
      file: 'ZenMaruGothic-Bold.ttf',
    },
    approxMB: 3.7,
  },
};

export const DEFAULT_FONT_ID = 'gothic';
export const PDF_FONT_WEIGHTS = {
  regular: { label: '標準' },
  bold: { label: '太字' },
};
export const DEFAULT_FONT_WEIGHT_ID = 'regular';

/** カスタム配色の8キー。pdfPrefs.js / pdfExport.js の両方から参照する。 */
export const CUSTOM_SEED_KEYS = [
  'bg', 'ink', 'line', 'surface', 'accent', 'accentLine', 'accent2', 'accentLine2',
];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * カスタム配色の既定値。print の種色（コントラスト比検証済み）をそのまま使う。
 * 未保存時の初期値（pdfPrefs.js）・不正値のフォールバック先（sanitizeCustomSeed）・
 * UIの「既定の色に戻す」（Toolbar.jsx）が、いずれもこの1つを情報源にする。
 * 中身を書き換えると PDF_PRESETS.print まで壊れるため、複製して使うこと。
 */
export const DEFAULT_CUSTOM_SEED = PDF_PRESETS.print.seed;

/**
 * カスタム配色の seed を検証する。キーごとにフォールバックする既存の
 * 流儀（pdfPrefs.js の presetId/fontId 等と同じ）に従い、`#RRGGBB` 形式で
 * ない値・文字列でない値・キー欠落はそのキーだけ fallback へ落とす
 * （オブジェクト全体は捨てない）。第2色が保存されていない旧設定では、
 * 正規化後の accent / accentLine から補色を導出する。
 */
export function sanitizeCustomSeed(custom, fallback = DEFAULT_CUSTOM_SEED) {
  const out = {};
  const isCustomObject = custom && typeof custom === 'object' && !Array.isArray(custom);
  const baseKeys = ['bg', 'ink', 'line', 'surface', 'accent', 'accentLine'];
  for (const key of baseKeys) {
    const v = custom && custom[key];
    out[key] = typeof v === 'string' && HEX_COLOR_RE.test(v) ? v : fallback[key];
  }
  const fallbackAccent2 = typeof fallback.accent2 === 'string' && HEX_COLOR_RE.test(fallback.accent2)
    ? fallback.accent2
    : complementHex(out.accent);
  const fallbackAccentLine2 = typeof fallback.accentLine2 === 'string'
    && HEX_COLOR_RE.test(fallback.accentLine2)
    ? fallback.accentLine2
    : complementHex(out.accentLine);
  const hasAccent2 = isCustomObject && Object.prototype.hasOwnProperty.call(custom, 'accent2');
  const hasAccentLine2 = isCustomObject
    && Object.prototype.hasOwnProperty.call(custom, 'accentLine2');
  out.accent2 = isCustomObject && !hasAccent2
    ? complementHex(out.accent)
    : typeof custom?.accent2 === 'string' && HEX_COLOR_RE.test(custom.accent2)
      ? custom.accent2
      : fallbackAccent2;
  out.accentLine2 = isCustomObject && !hasAccentLine2
    ? complementHex(out.accentLine)
    : typeof custom?.accentLine2 === 'string' && HEX_COLOR_RE.test(custom.accentLine2)
      ? custom.accentLine2
      : fallbackAccentLine2;
  return out;
}

// bg/line から surface を導出する比率。9プリセットの実データから逆算した値
// （各プリセットのR/G/B別で0.19〜0.30に収まる）。mixHex(bg, line, 0.23) は
// 9プリセットのsurfaceをチャンネルごとの最大誤差8（autumnLightで発生）以内で
// 再現する（pdfPalette.test.js で検証）。
export const SIMPLE_SURFACE_MIX_RATIO = 0.23;

/**
 * 簡易モードの3色（bg/ink/line）から、6種seedの残り3つ（surface/accent/
 * accentLine）を補って完全なseedにする。
 *
 * surfaceはbg/lineから導出できる（上のSIMPLE_SURFACE_MIX_RATIO参照）。
 * accent/accentLineと第2色は手で設計または補色導出された値で、単純な混色では再現できないこと
 * を確認済み（「accentをinkへ寄せたもの」という仮説で9プリセットから係数を
 * 逆算したところ-2.57〜2.43とばらつき一致しなかった。同じ仮説を再提案
 * しないこと）。そのため base（呼び出し側が持つ現在のcustom seed）から
 * そのまま引き継ぐ。
 *
 * 呼び出し側は bg か line が変わったときだけこの関数を呼ぶこと。ink だけの
 * 変更で呼ぶと、詳細モードで手で調整したsurfaceが無関係な変更のたびに
 * 上書きされる（bg/lineが変わらない限り再計算結果自体は変わらないが、
 * 「何が原因でsurfaceが変わったか」を呼び出し側のコードから追えるようにする
 * ため、いつ呼ぶかは呼び出し側の責務にしてある）。
 */
export function deriveSeedFromSimple(simple, base) {
  return {
    bg: simple.bg,
    ink: simple.ink,
    line: simple.line,
    surface: mixHex(simple.bg, simple.line, SIMPLE_SURFACE_MIX_RATIO),
    accent: base.accent,
    accentLine: base.accentLine,
    accent2: base.accent2,
    accentLine2: base.accentLine2,
  };
}

/**
 * パレット合成に使う種色を決める。背景画像があるときだけ bg を白に固定する。
 * 保存されたカスタム値そのものは
 * 書き換えず、options（呼び出し元の pdfPrefs 由来）はそのまま、ここで作る
 * 新しいオブジェクトにだけ反映する。presetId が 'custom' のときだけ
 * options.custom を使う。
 *
 * pdfExport.js（実際の出力）と Toolbar.jsx（スウォッチ・入力欄のプレビュー）の
 * 両方がこの関数を使う。以前は同じルールが2箇所に別々に（不完全に）実装
 * されており、スウォッチだけ白固定が反映されない不整合があった。
 * **Toolbar.jsx から pdfExport.js を import しないこと**
 * （jsPDF/svg2pdf を巻き込むため）。共有する純関数の置き場はこの config.js。
 */
export function resolvePaletteSeed(options) {
  const rawSeed =
    options.presetId === CUSTOM_PRESET_ID
      ? sanitizeCustomSeed(options.custom)
      : PDF_PRESETS[options.presetId].seed;
  // PDF側はbuildPdfPalette内で補完できるが、Toolbarは種色を直接スウォッチへ
  // 渡すため、ここで第2色まで揃えた実効seedを返す。プリセットが第2色を
  // 明示していない場合も、PDFと同じHSL補色を表示する。
  const baseSeed = {
    ...rawSeed,
    accent2: rawSeed.accent2 ?? complementHex(rawSeed.accent),
    accentLine2: rawSeed.accentLine2 ?? complementHex(rawSeed.accentLine),
  };
  return options.backgroundImage ? { ...baseSeed, bg: '#FFFFFF' } : baseSeed;
}

/**
 * PDFの文字・レイアウト設定の許容範囲。既定値は pdfConfig 側の値を使う。
 * pdfTypography.js の検証と Toolbar.jsx の入力欄の両方がこの定数を参照する
 * （MOBILE_MEDIA_QUERY と同じく、二重管理を避けるため）。
 */
export const PDF_LAYOUT_RANGES = {
  titleFontSizePt: { min: 10, max: 24 },
  metaFontSizePt: { min: 6, max: 14 },
  maxRowsPerPage: { min: 3, max: 12 },
  lyricSizePercent: { min: 70, max: 130 },
  gridNumberSizePercent: { min: 70, max: 140 },
  pageNumberFontSizePt: { min: 8, max: 14 },
};

/** PDFグリッド番号の表示設定。番号の有無はグリッド寸法とは分離する。 */
export const PDF_GRID_NUMBER_DISPLAYS = {
  show: { label: '表示' },
  none: { label: 'なし' },
};

export const DEFAULT_GRID_NUMBER_DISPLAY_ID = 'show';

/**
 * 用紙1枚あたりのページ数（面付け）。1面付け（現状のまま。A4縦）と
 * 2面付け（A4横1枚に現在のA4縦ページを左右2つ並べる）の2つだけ
 * （任意のN面付けには一般化しない）。
 */
export const PDF_SHEET_LAYOUTS = {
  single: { label: '1面付け' },
  double: { label: '2面付け' },
};

export const DEFAULT_SHEET_LAYOUT_ID = 'single';

/** 旧PDF設定の読み込みと内部のページ計画で使うレイアウトid。 */
export const PDF_FIRST_PAGE_LAYOUTS = {
  editorial: { label: '左揃え' },
  classic: { label: '中央揃え' },
  right: { label: '右揃え' },
  cover: { label: '独立表紙' },
};

export const DEFAULT_FIRST_PAGE_LAYOUT_ID = 'classic';

/** 旧PDF設定を新しい完成組版へ移行するために残す形式id。 */
export const PDF_SCORE_INFO_FORMATS = {
  standard: { label: '標準' },
  combined: { label: 'まとめて表示' },
  itemized: { label: '項目ごとに表示' },
  twoColumn: { label: '2列で表示' },
};

export const DEFAULT_SCORE_INFO_FORMAT_ID = 'standard';

export function normalizeScoreInfoFormatId(value) {
  return Object.prototype.hasOwnProperty.call(PDF_SCORE_INFO_FORMATS, value)
    ? value
    : DEFAULT_SCORE_INFO_FORMAT_ID;
}

/** 位置を含めて完成させたPDF曲情報デザイン。 */
export const PDF_SCORE_INFO_DESIGNS = {
  score: { label: '楽譜' },
  masthead: { label: 'シンプル' },
  specSheet: { label: '詳細' },
  cover: { label: '表紙' },
};

export const PDF_MASTHEAD_DIRECTIONS = {
  left: { label: '左' },
  right: { label: '右' },
};

export const DEFAULT_SCORE_INFO_DESIGN_ID = 'score';
export const DEFAULT_MASTHEAD_DIRECTION_ID = 'left';

export function normalizeScoreInfoDesignId(value) {
  return Object.prototype.hasOwnProperty.call(PDF_SCORE_INFO_DESIGNS, value)
    ? value
    : DEFAULT_SCORE_INFO_DESIGN_ID;
}

export function normalizeMastheadDirectionId(value) {
  return Object.prototype.hasOwnProperty.call(PDF_MASTHEAD_DIRECTIONS, value)
    ? value
    : DEFAULT_MASTHEAD_DIRECTION_ID;
}

/**
 * 新設定を正規化し、未移行の「形式×位置」は最も近い完成組版へ畳み込む。
 * 旧2列形式は専用デザインを持たないため、一覧性を担う帳票へ移す。
 */
export function resolvePdfScoreInfoDesign(options = {}) {
  if (Object.prototype.hasOwnProperty.call(
    PDF_SCORE_INFO_DESIGNS,
    options.scoreInfoDesignId,
  )) {
    return {
      scoreInfoDesignId: options.scoreInfoDesignId,
      mastheadDirectionId: normalizeMastheadDirectionId(options.mastheadDirectionId),
    };
  }

  if (options.firstPageLayoutId === 'cover') {
    return {
      scoreInfoDesignId: 'cover',
      mastheadDirectionId: DEFAULT_MASTHEAD_DIRECTION_ID,
    };
  }

  const legacyFormatId = normalizeScoreInfoFormatId(options.scoreInfoFormatId);
  if (legacyFormatId === 'combined') {
    return {
      scoreInfoDesignId: 'masthead',
      mastheadDirectionId: options.firstPageLayoutId === 'right' ? 'right' : 'left',
    };
  }
  if (legacyFormatId === 'itemized' || legacyFormatId === 'twoColumn') {
    return {
      scoreInfoDesignId: 'specSheet',
      mastheadDirectionId: DEFAULT_MASTHEAD_DIRECTION_ID,
    };
  }
  return {
    scoreInfoDesignId: DEFAULT_SCORE_INFO_DESIGN_ID,
    mastheadDirectionId: DEFAULT_MASTHEAD_DIRECTION_ID,
  };
}

export function scoreInfoDesignToFirstPageLayoutId(
  scoreInfoDesignId,
  mastheadDirectionId = DEFAULT_MASTHEAD_DIRECTION_ID,
) {
  const safeDesignId = normalizeScoreInfoDesignId(scoreInfoDesignId);
  if (safeDesignId === 'cover') return 'cover';
  if (safeDesignId === 'masthead') {
    return normalizeMastheadDirectionId(mastheadDirectionId) === 'right'
      ? 'right'
      : 'editorial';
  }
  return 'classic';
}

/** PDF曲情報の四分音符へ表示する値の求め方。 */
export const PDF_TEMPO_VALUE_MODES = {
  quarter: { label: 'BPM値 ÷ 4', divisor: 4 },
  half: { label: 'BPM値 ÷ 2', divisor: 2 },
  custom: { label: 'カスタム' },
};

export const DEFAULT_TEMPO_VALUE_MODE_ID = 'quarter';
export const DEFAULT_CUSTOM_TEMPO_VALUE = 30;
export const PDF_CUSTOM_TEMPO_VALUE_RANGE = { min: 0.01, max: 999, step: 0.01 };

export function normalizeTempoValueModeId(value) {
  return Object.prototype.hasOwnProperty.call(PDF_TEMPO_VALUE_MODES, value)
    ? value
    : DEFAULT_TEMPO_VALUE_MODE_ID;
}

export function sanitizeCustomTempoValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_CUSTOM_TEMPO_VALUE;
  const { min, max } = PDF_CUSTOM_TEMPO_VALUE_RANGE;
  if (numeric < min || numeric > max) return DEFAULT_CUSTOM_TEMPO_VALUE;
  return Math.round(numeric * 100) / 100;
}

/** PDFのページ装飾設定。選択肢は自由入力にせず、既知のidだけを受け付ける。 */
export const PDF_PAGE_NUMBER_FORMATS = {
  currentTotal: { label: 'n / N' },
  current: { label: 'n' },
  none: { label: 'なし' },
};

export const PDF_PAGE_NUMBER_POSITIONS = {
  bottomCenter: { label: '中央' },
  bottomLeft: { label: '左' },
  bottomRight: { label: '右' },
  bottomOuter: { label: '見開き外側' },
  bottomInner: { label: '見開き内側' },
};

export const PDF_RUNNING_HEADERS = {
  none: { label: 'なし' },
  title: { label: '曲名' },
};

export const PDF_FOOTER_CREDITS = {
  none: { label: 'なし' },
  transcribedBy: { label: '譜面作成者' },
};

export const DEFAULT_PAGE_NUMBER_FORMAT_ID = 'currentTotal';
export const DEFAULT_PAGE_NUMBER_POSITION_ID = 'bottomCenter';
export const DEFAULT_RUNNING_HEADER_ID = 'none';
export const DEFAULT_FOOTER_CREDIT_ID = 'none';

/** * 15鍵のCメジャースケール(C4〜C6)に対応するMIDIノート番号
 * 左上(0)=C4(60), 右下(14)=C6(84)
 */
export const GRID_MIDI_NOTES = [
  60, 62, 64, 65, 67, // 上段: C4, D4, E4, F4, G4
  69, 71, 72, 74, 76, // 中段: A4, B4, C5, D5, E5
  77, 79, 81, 83, 84  // 下段: F5, G5, A5, B5, C6
];

/** 同じ15鍵の音集合を長調／相対短調のどちらとして表記するか。 */
export const KEY_MODES = {
  major: { label: 'メジャー' },
  minor: { label: 'マイナー' },
};

export const DEFAULT_KEY_MODE = 'major';

/** PDFだけに適用する黒鍵キーの表記方法。 */
export const KEY_NOTATIONS = {
  both: { label: '併記' },
  sharp: { label: '#' },
  flat: { label: '♭' },
};

export const DEFAULT_KEY_NOTATION_ID = 'both';

/** PDFのキー名へ付ける調性表記。表示ラベルと接尾辞は現在の調性で切り替える。 */
export const KEY_MODE_NOTATIONS = {
  compact: {
    major: { label: 'なし', suffix: '', separator: '', repeatForAlternatives: true },
    minor: { label: 'm', suffix: 'm', separator: '', repeatForAlternatives: true },
  },
  english: {
    major: { label: 'major', suffix: 'major', separator: ' ', repeatForAlternatives: false },
    minor: { label: 'minor', suffix: 'minor', separator: ' ', repeatForAlternatives: false },
  },
  japanese: {
    major: { label: 'メジャー', suffix: 'メジャー', separator: ' ', repeatForAlternatives: false },
    minor: { label: 'マイナー', suffix: 'マイナー', separator: ' ', repeatForAlternatives: false },
  },
  traditional: {
    major: { label: '長調(日本式)', suffix: '長調', separator: '', repeatForAlternatives: false },
    minor: { label: '短調(日本式)', suffix: '短調', separator: '', repeatForAlternatives: false },
  },
};

export const DEFAULT_KEY_MODE_NOTATION_ID = 'compact';

const SHARP_PITCH_CLASSES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

const FLAT_PITCH_CLASSES = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B',
];

const JAPANESE_SHARP_PITCH_CLASSES = [
  'ハ', '嬰ハ', 'ニ', '嬰ニ', 'ホ', 'ヘ', '嬰ヘ', 'ト', '嬰ト', 'イ', '嬰イ', 'ロ',
];

const JAPANESE_FLAT_PITCH_CLASSES = [
  'ハ', '変ニ', 'ニ', '変ホ', 'ホ', 'ヘ', '変ト', 'ト', '変イ', 'イ', '変ロ', 'ロ',
];

/** トランスポーズ量に対応する長調の表示名。既存の参照先との互換名として残す。 */
export const PITCH_CLASSES = SHARP_PITCH_CLASSES.map((sharpName, index) => {
  const flatName = FLAT_PITCH_CLASSES[index];
  return sharpName === flatName ? sharpName : `${sharpName} / ${flatName}`;
});

export function normalizeKeyMode(value) {
  return Object.prototype.hasOwnProperty.call(KEY_MODES, value)
    ? value
    : DEFAULT_KEY_MODE;
}

export function normalizeKeyNotationId(value) {
  return Object.prototype.hasOwnProperty.call(KEY_NOTATIONS, value)
    ? value
    : DEFAULT_KEY_NOTATION_ID;
}

export function normalizeKeyModeNotationId(value) {
  return Object.prototype.hasOwnProperty.call(KEY_MODE_NOTATIONS, value)
    ? value
    : DEFAULT_KEY_MODE_NOTATION_ID;
}

export function keyModeNotationLabel(
  keyMode = DEFAULT_KEY_MODE,
  keyModeNotationId = DEFAULT_KEY_MODE_NOTATION_ID,
) {
  const safeKeyMode = normalizeKeyMode(keyMode);
  const safeNotationId = normalizeKeyModeNotationId(keyModeNotationId);
  return KEY_MODE_NOTATIONS[safeNotationId][safeKeyMode].label;
}

export function formatKeyNameWithMode(
  keyName,
  keyMode = DEFAULT_KEY_MODE,
  keyModeNotationId = DEFAULT_KEY_MODE_NOTATION_ID,
) {
  const safeKeyMode = normalizeKeyMode(keyMode);
  const safeNotationId = normalizeKeyModeNotationId(keyModeNotationId);
  const notation = KEY_MODE_NOTATIONS[safeNotationId][safeKeyMode];
  if (!notation.suffix) return keyName;
  if (notation.repeatForAlternatives) {
    return keyName
      .split(' / ')
      .map((name) => `${name}${notation.separator}${notation.suffix}`)
      .join(' / ');
  }
  return `${keyName}${notation.separator}${notation.suffix}`;
}

/**
 * pitchLevelは15鍵の音集合をC基準から移調する量であり、短調でも発音は変えない。
 * 短調の主音だけを相対長調の主音から短3度下（+9半音）として導出する。
 */
export function keyTonicPitchClass(pitchLevel, keyMode = DEFAULT_KEY_MODE) {
  const safePitchLevel = Number.isInteger(pitchLevel) && pitchLevel >= 0 && pitchLevel <= 11
    ? pitchLevel
    : 0;
  return (safePitchLevel + (normalizeKeyMode(keyMode) === 'minor' ? 9 : 0)) % 12;
}

/** ツールバーとPDFで共有する主音名。自然音では表記設定による差は生じない。 */
export function keyDisplayName(
  pitchLevel,
  keyMode = DEFAULT_KEY_MODE,
  keyNotationId = DEFAULT_KEY_NOTATION_ID,
) {
  const pitchClass = keyTonicPitchClass(pitchLevel, keyMode);
  const sharpName = SHARP_PITCH_CLASSES[pitchClass];
  const flatName = FLAT_PITCH_CLASSES[pitchClass];
  const notationId = normalizeKeyNotationId(keyNotationId);
  if (sharpName === flatName || notationId === 'sharp') return sharpName;
  if (notationId === 'flat') return flatName;
  return `${sharpName} / ${flatName}`;
}

/** PDF用の音名と調性表記を一度に組み立てる。日本式だけ音名もイロハ表記へ替える。 */
export function formatPdfKeyName(
  pitchLevel,
  keyMode = DEFAULT_KEY_MODE,
  keyNotationId = DEFAULT_KEY_NOTATION_ID,
  keyModeNotationId = DEFAULT_KEY_MODE_NOTATION_ID,
) {
  const safeKeyMode = normalizeKeyMode(keyMode);
  const safeKeyNotationId = normalizeKeyNotationId(keyNotationId);
  const safeModeNotationId = normalizeKeyModeNotationId(keyModeNotationId);
  let keyName;
  if (safeModeNotationId === 'traditional') {
    const pitchClass = keyTonicPitchClass(pitchLevel, safeKeyMode);
    const sharpName = JAPANESE_SHARP_PITCH_CLASSES[pitchClass];
    const flatName = JAPANESE_FLAT_PITCH_CLASSES[pitchClass];
    if (sharpName === flatName || safeKeyNotationId === 'sharp') keyName = sharpName;
    else if (safeKeyNotationId === 'flat') keyName = flatName;
    else keyName = `${sharpName} / ${flatName}`;
  } else {
    keyName = keyDisplayName(pitchLevel, safeKeyMode, safeKeyNotationId);
  }
  return formatKeyNameWithMode(keyName, safeKeyMode, safeModeNotationId);
}

export function hasEnharmonicKeyName(pitchLevel, keyMode = DEFAULT_KEY_MODE) {
  const pitchClass = keyTonicPitchClass(pitchLevel, keyMode);
  return SHARP_PITCH_CLASSES[pitchClass] !== FLAT_PITCH_CLASSES[pitchClass];
}

export const SINGLE_GRID_PLAY_SEC = 1.5;

/** スマートフォン判定。index.css の @media (max-width: 640px) と必ず同じ値にすること */
export const MOBILE_MEDIA_QUERY = '(max-width: 640px)';
