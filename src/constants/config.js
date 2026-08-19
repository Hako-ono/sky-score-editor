import { t } from '../i18n/index.js';

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
  narrow: { marginPt: 24 },
  standard: { marginPt: 40 },
  wide: { marginPt: 64 },
};

export const DEFAULT_PAGE_MARGIN_ID = 'standard';

/** PDF内のグリッド間隔プリセット。横・縦を別々に自由入力させない。 */
export const PDF_GRID_GAPS = {
  tight: { horizontalPt: 12, verticalPt: 45 },
  standard: { horizontalPt: 30, verticalPt: 80 },
  loose: { horizontalPt: 56, verticalPt: 130 },
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
    isDark: false,
    seed: {
      bg: '#FFFFFF', ink: '#212529', line: '#ADB5BD',
      surface: '#E9ECEF', accent: '#F2C078', accentLine: '#A65D0B',
      accent2: '#78AAF2', accentLine2: '#0B54A6',
    },
  },
  springLight: {
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
    isDark: true,
    seed: {
      bg: '#33262F', ink: '#F5E9EE', line: '#806573',
      surface: '#43323D', accent: '#EE9FBF', accentLine: '#FFD6E4',
    },
  },
  summerLight: {
    isDark: false,
    seed: {
      bg: '#EFF8FD', ink: '#0F3A57', line: '#93BFDA',
      surface: '#D8E9F6', accent: '#F5BE2E', accentLine: '#9E6208',
    },
  },
  summerDark: {
    isDark: true,
    seed: {
      bg: '#1E3336', ink: '#E2EFE8', line: '#5E807C',
      surface: '#2B4448', accent: '#E9E169', accentLine: '#FBF7C0',
    },
  },
  autumnLight: {
    isDark: false,
    seed: {
      bg: '#FDFAF3', ink: '#40301F', line: '#C2A47D',
      surface: '#F1E4D0', accent: '#E8925A', accentLine: '#B85C2A',
    },
  },
  autumnDark: {
    isDark: true,
    seed: {
      bg: '#33261D', ink: '#F5E9DA', line: '#836B52',
      surface: '#43342A', accent: '#EDAC68', accentLine: '#FFDFB2',
    },
  },
  winterLight: {
    isDark: false,
    seed: {
      bg: '#FAFCFE', ink: '#263440', line: '#A9BDCB',
      surface: '#E6EDF3', accent: '#9DCBEC', accentLine: '#3D7FB5',
    },
  },
  winterDark: {
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

/**
 * #RRGGBB を HSL へ分解する。hue は 0〜1（度ではない）。
 * 色相回転と、簡易配色からの押鍵色の導出（deriveSeedFromSimple）が共有する。
 */
export function hexToHsl(hex) {
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

  return { h: hue, s: saturation, l: lightness };
}

/**
 * HSL を #RRGGBB へ戻す。HSL からの変換は定義上つねに sRGB 内へ収まるため、
 * 色域外へ出た色を戻す処理は要らない（OkLCh 等を使うなら別途必要になる）。
 */
export function hslToHex({ h, s, l }) {
  let hue = h % 1;
  if (hue < 0) hue += 1;
  const saturation = Math.min(1, Math.max(0, s));
  const lightness = Math.min(1, Math.max(0, l));

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

/** #RRGGBB の色相をHSL上で回転する。第2色の既定値を一か所で導出する。 */
export function rotateHueHex(hex, degrees) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex({ h: h + degrees / 360, s, l });
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

/**
 * 種色から、PDF描画で使う14トークンを組み立てる。
 *
 * preset.overrides は最後に展開するので、`sanitizeCustomTokens` を通した
 * 「詳細色2」の指定があるトークンだけが導出値を上書きする。
 */
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
 * 曲情報の項目を隔てる「1単位ぶんの空き」。
 *
 * 全角スペース(U+3000)は使わない。和文・中文・韓文の書体では約1emだが、
 * DM Sans / IBM Plex Sans Thai Looped / Be Vietnam Pro / Golos Text には
 * 収録されておらず、そのまま使うと区切りが約1/5の幅に潰れるため。
 *
 * 半角スペースの送り幅は埋め込み8書体で0.22〜0.28emに収まっており、
 * 4個ならどの書体でも0.88〜1.12emとほぼ1emになる。書体ごとに分岐せず、
 * この1つの定数だけで全言語の間隔を揃える（詰めたい・広げたいときは
 * ここの個数だけを変える）。
 */
export const SCORE_INFO_SPACE_UNIT = '    ';

/**
 * PDF埋め込みフォントの選択肢。idを書体名ではなく意味ベース
 * （gothic/mincho/rounded）にしているのは、将来フォントの実体を
 * 差し替えても利用者の localStorage に残った値が無効にならないため。
 */
export const PDF_FONTS = {
  gothic: {
    flatGlyph: '♭',
    waveDashGlyph: '〜',
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
    // Shippori MinchoはU+266Dを持たないため、PDFでは欠落しないASCII表記に落とす。
    flatGlyph: 'b',
    waveDashGlyph: '〜',
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
    flatGlyph: '♭',
    waveDashGlyph: '〜',
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
  dmSans: {
    flatGlyph: 'b',
    waveDashGlyph: '~',
    regular: {
      name: 'DM Sans',
      file: 'DMSans-Regular.ttf',
    },
    bold: {
      name: 'DM Sans Bold',
      file: 'DMSans-Bold.ttf',
    },
    approxMB: 0.08,
  },
  sarasaSC: {
    flatGlyph: '♭',
    waveDashGlyph: '〜',
    regular: {
      name: 'Sarasa Gothic SC',
      file: 'SarasaGothicSC-Regular.ttf',
    },
    bold: {
      name: 'Sarasa Gothic SC Bold',
      file: 'SarasaGothicSC-Bold.ttf',
    },
    approxMB: 24.0,
  },
  taipeiTC: {
    flatGlyph: '♭',
    waveDashGlyph: '〜',
    regular: {
      name: 'Taipei Sans TC',
      file: 'TaipeiSansTC-Regular.ttf',
    },
    bold: {
      name: 'Taipei Sans TC Bold',
      file: 'TaipeiSansTC-Bold.ttf',
    },
    approxMB: 20.7,
  },
  chironHK: {
    flatGlyph: '♭',
    waveDashGlyph: '〜',
    regular: {
      name: 'Chiron Hei HK',
      file: 'ChironHeiHK-Regular.ttf',
    },
    bold: {
      name: 'Chiron Hei HK Bold',
      file: 'ChironHeiHK-Bold.ttf',
    },
    approxMB: 14.4,
  },
  wantedSans: {
    flatGlyph: 'b',
    waveDashGlyph: '~',
    regular: {
      name: 'Wanted Sans',
      file: 'WantedSans-Regular.ttf',
    },
    bold: {
      name: 'Wanted Sans Bold',
      file: 'WantedSans-Bold.ttf',
    },
    approxMB: 2.4,
  },
  plexThaiLooped: {
    // この書体はU+266D/U+301Cを持たないため、既存のASCII代替規則を使う。
    flatGlyph: 'b',
    waveDashGlyph: '~',
    regular: {
      name: 'IBM Plex Sans Thai Looped',
      file: 'IBMPlexSansThaiLooped-Regular.ttf',
    },
    bold: {
      name: 'IBM Plex Sans Thai Looped Bold',
      file: 'IBMPlexSansThaiLooped-Bold.ttf',
    },
    approxMB: 0.13,
  },
  beVietnamPro: {
    // この書体はU+266D/U+301Cを持たないため、既存のASCII代替規則を使う。
    flatGlyph: 'b',
    waveDashGlyph: '~',
    regular: {
      name: 'Be Vietnam Pro',
      file: 'BeVietnamPro-Regular.ttf',
    },
    bold: {
      name: 'Be Vietnam Pro Bold',
      file: 'BeVietnamPro-Bold.ttf',
    },
    approxMB: 0.13,
  },
  golosText: {
    // この書体はU+266D/U+301Cを持たないため、既存のASCII代替規則を使う。
    flatGlyph: 'b',
    waveDashGlyph: '~',
    regular: {
      name: 'Golos Text',
      file: 'GolosText-Regular.ttf',
    },
    bold: {
      name: 'Golos Text Bold',
      file: 'GolosText-Bold.ttf',
    },
    approxMB: 0.06,
  },
};

export const DEFAULT_FONT_ID = 'gothic';
export const PDF_FONT_WEIGHTS = {
  regular: {},
  bold: {},
};
export const DEFAULT_FONT_WEIGHT_ID = 'regular';

/** カスタム配色の8キー。pdfPrefs.js / pdfExport.js の両方から参照する。 */
export const CUSTOM_SEED_KEYS = [
  'bg', 'ink', 'line', 'surface', 'accent', 'accentLine', 'accent2', 'accentLine2',
];

/**
 * 種色（8色）では指定できない描画トークン。UIでは「詳細色2（上級者向け）」
 * としてまとめる。
 *
 * `title` は種色 `ink` と同値、残り5つは `buildPdfPalette` が `PRESET_MIX` で
 * 混色して作るため、いずれも8色のどれを動かしても単独では狙った色にできない。
 * ここに値があるときだけ `buildPdfPalette` の `overrides` として上書きし、
 * **キーが無いトークンは従来どおり導出値のまま**にする（既定値を持たせて
 * しまうと、種色を変えても追従しなくなるため）。
 *
 * `symbolHighlight2` はレイヤー2を使う楽譜でしか描かれないので、UI側だけ
 * 出し分ける（保存・共有は常に6キーぶんの枠を持つ）。
 */
export const CUSTOM_TOKEN_KEYS = [
  'title', 'outerFrame', 'symbol', 'number', 'symbolHighlight', 'symbolHighlight2',
];

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * 「詳細色2」の上書き指定を検証する。seed と違い**既定値へは落とさず、
 * 不正なキーは取り除く**（無指定と同じ＝導出値を使う、という意味になる）。
 * 未知のキーも落とすので、細工された保存値・共有URLから任意のトークンを
 * 生やされることはない。
 */
export function sanitizeCustomTokens(tokens) {
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) return {};
  const out = {};
  for (const key of CUSTOM_TOKEN_KEYS) {
    const value = tokens[key];
    if (typeof value === 'string' && HEX_COLOR_RE.test(value)) out[key] = value;
  }
  return out;
}

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
 * 簡易配色の3色から押鍵の色（accent/accentLine）を作るための係数。
 *
 * 9プリセットをHSLで測ると、accentの色相は「lineと同系」5件（springDark /
 * autumnLight / autumnDark / winterLight / winterDark、lineとの色相差 -21〜+8度）
 * と「lineの反対側」4件（print / springLight / summerLight / summerDark、同 -82〜-172度）
 * の2群に割れる。ここが混ざっていたために、かつては「accentは導出できない」と
 * 結論していた。この係数は同系側5件から逆算したもので、
 * 反対側の4件の色相は再現しない（補色側は選択肢として後から足す）。
 *
 * accentLineの色相はどのプリセットでもaccentと一致する（HSLで差4度以内）。
 * 明度だけがbgと反対方向へ動いており、accentさえ決まれば構造的に導ける。
 * 「accentをinkへ寄せた線形混色」で作ろうとして失敗したのは、RGB上で混ぜると
 * 色相と彩度が同時に崩れるためであって、導出そのものが不可能なわけではない。
 */
export const SIMPLE_ACCENT_MIX = {
  // lineがこれより低彩度なら色相に意味がない（無彩色の色相は0＝赤になってしまう）
  // ので導出せず、呼び出し側が持つ現在の値を残す
  minLineSaturation: 0.08,
  // accentの彩度：lineの彩度を強める倍率と上下限（実測のline比は1.9〜7.5）
  accentSaturationScale: 3.0,
  accentSaturationMin: 0.50,
  accentSaturationMax: 0.85,
  // accentの明度：明色ではlineと同じ。暗色では紙面が暗いぶんink方向へ寄せる
  accentLightnessToInkDark: 0.60,
  // accentLineの明度：accentからink方向へ寄せる比率
  accentLineLightnessToInk: { light: 0.55, dark: 0.85 },
  // accentLineの彩度：accentの彩度に掛ける倍率
  accentLineSaturationScale: { light: 0.80, dark: 1.25 },
  // lineとinkの明度が近い配色でも押鍵の枠が面に埋もれないための最小の明度差
  minLightnessGap: 0.10,
};

/**
 * 簡易配色の3色からaccent/accentLineを導出する。lineが無彩色に近く色相を
 * 決められない場合は null を返し、呼び出し側に現在の値を残させる。
 */
function deriveAccentFromSimple(simple) {
  const line = hexToHsl(simple.line);
  if (line.s < SIMPLE_ACCENT_MIX.minLineSaturation) return null;

  const ink = hexToHsl(simple.ink);
  const dark = isDarkSeedBg(simple.bg);
  const tone = dark ? 'dark' : 'light';

  const saturation = Math.min(
    SIMPLE_ACCENT_MIX.accentSaturationMax,
    Math.max(SIMPLE_ACCENT_MIX.accentSaturationMin, line.s * SIMPLE_ACCENT_MIX.accentSaturationScale),
  );
  const accentLightness = dark
    ? line.l + SIMPLE_ACCENT_MIX.accentLightnessToInkDark * (ink.l - line.l)
    : line.l;

  // 枠は必ず紙面と反対方向へ離す。inkとaccentの明度が偶然近い配色でも、
  // 押鍵の枠が面と同化して見えなくなることがないようにする
  const gap = SIMPLE_ACCENT_MIX.minLightnessGap;
  const toInk = accentLightness
    + SIMPLE_ACCENT_MIX.accentLineLightnessToInk[tone] * (ink.l - accentLightness);
  const accentLineLightness = dark
    ? Math.max(toInk, accentLightness + gap)
    : Math.min(toInk, accentLightness - gap);

  return {
    accent: hslToHex({ h: line.h, s: saturation, l: accentLightness }),
    accentLine: hslToHex({
      h: line.h,
      s: saturation * SIMPLE_ACCENT_MIX.accentLineSaturationScale[tone],
      l: accentLineLightness,
    }),
  };
}

/**
 * 簡易モードの3色（bg/ink/line）から、6種seedの残り3つ（surface/accent/
 * accentLine）と第2色を補って完全なseedにする。
 *
 * surfaceはbg/lineから導出する（上のSIMPLE_SURFACE_MIX_RATIO参照）。
 * accent/accentLineはlineと同系の色相で導出する（上のSIMPLE_ACCENT_MIX参照）。
 * 第2色はaccent/accentLineのHSL補色で、PDF出力側 buildPdfPalette と同じ規則。
 * lineが無彩色に近い場合だけ、accent以下4色は base（呼び出し側が持つ現在の
 * custom seed）をそのまま引き継ぐ。
 *
 * 呼び出し側は bg / ink / line のどれかが変わったときにこの関数を呼ぶこと。
 * 簡易側を触れば詳細側（surface・accent・accentLine・第2色）が上書きされるのは
 * 意図した挙動である（詳細モードで手で調整していても上書きされる）。
 */
export function deriveSeedFromSimple(simple, base) {
  const accents = deriveAccentFromSimple(simple);
  if (!accents) {
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
  return {
    bg: simple.bg,
    ink: simple.ink,
    line: simple.line,
    surface: mixHex(simple.bg, simple.line, SIMPLE_SURFACE_MIX_RATIO),
    accent: accents.accent,
    accentLine: accents.accentLine,
    accent2: complementHex(accents.accent),
    accentLine2: complementHex(accents.accentLine),
  };
}

/**
 * パレット合成に使う種色を決める。presetId が 'custom' のときだけ
 * options.custom を使う。背景画像の有無は種色に影響しない（背景画像は
 * 背景色の上に重ねて描かれるため、色は利用者が自由に選べる）。
 *
 * pdfExport.js（実際の出力）と Toolbar.jsx（スウォッチ・入力欄のプレビュー）の
 * 両方がこの関数を使う。以前は同じルールが2箇所に別々に（不完全に）実装
 * されており、スウォッチと出力が食い違う不整合があった。
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
  return baseSeed;
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

/**
 * PNG出力の解像度。scale = dpi / 72（PDFの1ptが1/72inchであるため）。
 * 300dpiはA4で2480x3508px≒35MB/枚(RGBA)になり、iOSのcanvas面積上限に
 * 触れるため用意しない。pngExport.js とToolbar.jsxの両方がここを参照する。
 */
export const PNG_DPI_OPTIONS = [96, 150, 200];
export const DEFAULT_PNG_DPI = 150;

export function normalizePngDpi(value) {
  const numeric = Number(value);
  return PNG_DPI_OPTIONS.includes(numeric) ? numeric : DEFAULT_PNG_DPI;
}

/**
 * サイト内PDFプレビュー（`pdfPreview.js`）の自動更新オン/オフ。
 * `pdfPrefs.js` の `defaults()`/`normalizePdfPrefs()`/`serializePdfPrefs()`
 * が参照する。`EXTERNAL_GROUPS`（共有URL/QR）には含めない
 * （`pngDpi` と同じ扱い）。
 */
export const DEFAULT_PREVIEW_AUTO_UPDATE = true;

/**
 * 明示的な `false` だけを `false` として扱う（それ以外はすべて既定値
 * `true` へ寄せる）。こうすることで、このキーが無い旧保存値・旧下書きを
 * 読んでも既定の `true` になる。
 */
export function normalizePreviewAutoUpdate(value) {
  return value === false ? false : DEFAULT_PREVIEW_AUTO_UPDATE;
}

/**
 * 歌詞の既定サイズ割合を言語ごとに変える必要があるのは、タイ文字だけが
 * 上下に記号を積み重ねるためである。グリッド内で歌詞に使える高さは
 * 鍵盤セル下端(205)からグリッド枠下端(gridBaseHeight=275)までの70単位しかなく、
 * 上下3単位ずつのクリアランスを引くと64単位になる。IBM Plex Sans Thai Looped の
 * 字形を実測すると、上母音＋声調の積み上げと、尾のある字＋下母音の組み合わせで
 * 最大1.976em を占める。64 / 1.976 = 32.38pt が収まる上限で、これは既定の
 * 上限45pt に対して71.9%にあたる。切り上げると上限を超えるため71%とする。
 *
 * 上限を強制せず既定値だけ下げているのは、はみ出しても出力自体は成立し、
 * どこまで許容するかは利用者が決めてよいため（Toolbar.jsx が既定値を超えた
 * ときだけ注意書きを出す）。
 */
export const LYRIC_SIZE_PERCENT_BY_LANGUAGE = {
  th: 71,
};

export const DEFAULT_LYRIC_SIZE_PERCENT = 100;

export function getDefaultLyricSizePercent(language) {
  return Object.prototype.hasOwnProperty.call(LYRIC_SIZE_PERCENT_BY_LANGUAGE, language)
    ? LYRIC_SIZE_PERCENT_BY_LANGUAGE[language]
    : DEFAULT_LYRIC_SIZE_PERCENT;
}

/**
 * 表示言語を切り替えたときの歌詞サイズを返す。
 *
 * 端末の言語設定がタイ語でない利用者（英語端末を使うタイ語話者など）は、
 * 初回表示が別言語になるため、手動でタイ語へ切り替えた時点では既に他言語の
 * 既定値が保存されている。そのまま据え置くと、実用上の上限である71%を
 * 自分で入力してもらうことになるため、切替時にも既定値を追従させる。
 *
 * ただし追従させるのは「切替前の言語の既定値のまま使っていた場合」だけとする。
 * 利用者が自分で決めた値は、言語を切り替えただけで失わせない。
 * 既定値そのものを選んでいた場合は「触っていない」と区別できないが、
 * その場合も新しい既定値へ移すのが望ましい挙動なので問題にならない。
 */
export function resolveLyricSizePercentOnLanguageChange(
  currentPercent,
  previousLanguage,
  nextLanguage,
) {
  const previousDefault = getDefaultLyricSizePercent(previousLanguage);
  const nextDefault = getDefaultLyricSizePercent(nextLanguage);
  if (previousDefault === nextDefault) return currentPercent;
  return currentPercent === previousDefault ? nextDefault : currentPercent;
}

/** PDFグリッド番号の表示設定。番号の有無はグリッド寸法とは分離する。 */
export const PDF_GRID_NUMBER_DISPLAYS = {
  show: {},
  none: {},
};

export const DEFAULT_GRID_NUMBER_DISPLAY_ID = 'show';

/**
 * 用紙1枚あたりのページ数（面付け）。1面付け（現状のまま。A4縦）と
 * 2面付け（A4横1枚に現在のA4縦ページを左右2つ並べる）の2つだけ
 * （任意のN面付けには一般化しない）。
 */
export const PDF_SHEET_LAYOUTS = {
  single: {},
  double: {},
};

export const DEFAULT_SHEET_LAYOUT_ID = 'single';

/**
 * PDF本文の1行あたりの列数。`auto` は拍子から決める従来の挙動
 * （`columnsForBits`。4拍子・拍子なしは4列、3拍子は3列）で、固定値を選ぶと
 * 拍子にかかわらずその列数で折り返す。
 *
 * 列数を増やしてもグリッドブロック全体の縮尺が下がるだけで紙面からはみ出さない
 * （縮尺は `contentWidthPt / svgWidth` と `contentHeightPt / svgHeight` の
 * 小さい方。行数・余白・グリッド間隔の組み合わせも同じ1つの式で吸収される）。
 * 一方、列数を減らすと行数＝論理ページ数が増える。下限を2列に留めているのは、
 * 1列にすると3000グリッドで行数が3000になり、ページ数の課題を一段深くする
 * ため。
 *
 * idに数字だけを使うと Object.entries が整数キーを先頭へ並べ替え、selectの
 * 先頭が `auto` でなくなる。表示順を保つため接頭辞付きのidにしている。
 */
export const PDF_COLUMNS_PER_PAGE = {
  auto: { columns: null },
  col2: { columns: 2 },
  col3: { columns: 3 },
  col4: { columns: 4 },
  col5: { columns: 5 },
  col6: { columns: 6 },
  col7: { columns: 7 },
  col8: { columns: 8 },
};

export const DEFAULT_COLUMNS_PER_PAGE_ID = 'auto';

export function normalizeColumnsPerPageId(value) {
  return Object.prototype.hasOwnProperty.call(PDF_COLUMNS_PER_PAGE, value)
    ? value
    : DEFAULT_COLUMNS_PER_PAGE_ID;
}

/**
 * 偶数行の網掛け。行が多い紙面でも、どこまでが同じ行かを追いやすくするための
 * 補助であり、既定は無効。
 */
export const PDF_ROW_SHADINGS = {
  none: {},
  even: {},
};

export const DEFAULT_ROW_SHADING_ID = 'none';

export function normalizeRowShadingId(value) {
  return Object.prototype.hasOwnProperty.call(PDF_ROW_SHADINGS, value)
    ? value
    : DEFAULT_ROW_SHADING_ID;
}

/**
 * 網掛けは紙面色から作った中間色ではなく、黒の半透明を重ねて描く。
 * 背景画像の上でも同じ「暗くする」効果になり、画像を塗りつぶさない。ただし
 * 暗い紙面色では同じ半透明度だと差が出ないので、明暗で2段階だけ持つ
 * （判定は既存の isDarkSeedBg と共有する）。
 */
export const PDF_ROW_SHADING_COLOR = '#000000';
export const PDF_ROW_SHADING_OPACITY = { light: 0.1, dark: 0.36 };

export function rowShadingOpacity(pageBackground) {
  return isDarkSeedBg(pageBackground)
    ? PDF_ROW_SHADING_OPACITY.dark
    : PDF_ROW_SHADING_OPACITY.light;
}

/**
 * 網掛け行のためのパレット。帯は塗りの背後にあり、半透明な鍵盤の面（通常鍵・
 * 押鍵）には効かないため、行全体が同じだけ暗く見えるよう面の色にも同じ黒を
 * 同じ割合で混ぜる（半透明を重ねたのと同じ結果になる）。
 *
 * 枠線・記号・番号・歌詞は暗くしない。面と一緒に暗くすると、行の中での
 * コントラストは変わらないまま全体が沈むだけで、可読性が落ちるため。
 */
export function shadeRowPalette(palette, opacity) {
  const shade = (color) => mixHex(color, PDF_ROW_SHADING_COLOR, opacity);
  return {
    ...palette,
    cellFill: shade(palette.cellFill),
    cellFillHighlight: shade(palette.cellFillHighlight),
    cellFillHighlight2: shade(palette.cellFillHighlight2),
  };
}
export const PDF_FIRST_PAGE_LAYOUTS = {
  editorial: {},
  classic: {},
  right: {},
  cover: {},
};

export const DEFAULT_FIRST_PAGE_LAYOUT_ID = 'classic';

/** 旧PDF設定を新しい完成組版へ移行するために残す形式id。 */
export const PDF_SCORE_INFO_FORMATS = {
  standard: {},
  combined: {},
  itemized: {},
  twoColumn: {},
};

export const DEFAULT_SCORE_INFO_FORMAT_ID = 'standard';

export function normalizeScoreInfoFormatId(value) {
  return Object.prototype.hasOwnProperty.call(PDF_SCORE_INFO_FORMATS, value)
    ? value
    : DEFAULT_SCORE_INFO_FORMAT_ID;
}

/** 位置を含めて完成させたPDF曲情報デザイン。 */
export const PDF_SCORE_INFO_DESIGNS = {
  score: {},
  masthead: {},
  specSheet: {},
  cover: {},
};

export const PDF_MASTHEAD_DIRECTIONS = {
  left: {},
  right: {},
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
  quarter: { divisor: 4 },
  half: { divisor: 2 },
  custom: {},
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
  currentTotal: {},
  current: {},
  none: {},
};

export const PDF_PAGE_NUMBER_POSITIONS = {
  bottomCenter: {},
  bottomLeft: {},
  bottomRight: {},
  bottomOuter: {},
  bottomInner: {},
};

export const PDF_RUNNING_HEADERS = {
  none: {},
  title: {},
};

export const PDF_FOOTER_CREDITS = {
  none: {},
  transcribedBy: {},
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
  major: {},
  minor: {},
};

export const DEFAULT_KEY_MODE = 'major';

/** PDFだけに適用する黒鍵キーの表記方法。 */
export const KEY_NOTATIONS = {
  both: {},
  sharp: {},
  flat: {},
};

export const DEFAULT_KEY_NOTATION_ID = 'both';

/** PDFのキー名へ付ける調性表記。表示ラベルと接尾辞は現在の調性で切り替える。 */
export const KEY_MODE_NOTATIONS = {
  compact: {
    major: { suffix: '', separator: '', repeatForAlternatives: true },
    minor: { suffix: 'm', separator: '', repeatForAlternatives: true },
  },
  english: {
    major: { suffix: 'major', separator: ' ', repeatForAlternatives: false },
    minor: { suffix: 'minor', separator: ' ', repeatForAlternatives: false },
  },
  japanese: {
    major: { suffix: 'メジャー', separator: ' ', repeatForAlternatives: false },
    minor: { suffix: 'マイナー', separator: ' ', repeatForAlternatives: false },
  },
  traditional: {
    major: { suffix: '長調', separator: '', repeatForAlternatives: false },
    minor: { suffix: '短調', separator: '', repeatForAlternatives: false },
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

/** 日本語固有の調性表記は、非日本語UIでは短縮表記へ解決する。 */
export function resolveKeyModeNotationIdForLanguage(value, language = 'ja') {
  const safeNotationId = normalizeKeyModeNotationId(value);
  if (language !== 'ja' && ['japanese', 'traditional'].includes(safeNotationId)) {
    return DEFAULT_KEY_MODE_NOTATION_ID;
  }
  return safeNotationId;
}

export function keyModeNotationLabel(
  keyMode = DEFAULT_KEY_MODE,
  keyModeNotationId = DEFAULT_KEY_MODE_NOTATION_ID,
) {
  const safeKeyMode = normalizeKeyMode(keyMode);
  const safeNotationId = normalizeKeyModeNotationId(keyModeNotationId);
  return t(`pdf.keyModeNotation.${safeNotationId}.${safeKeyMode}`);
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
