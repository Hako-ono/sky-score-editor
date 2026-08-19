import { describe, it, expect } from 'vitest';
import {
  sanitizeForPdf,
  truncateToUnitWidth,
  deriveTitleAreaPt,
  buildLayout,
  buildSheetGeometry,
  buildPageSvg,
  buildMusicCredit,
  buildHeaderCredit,
  buildMetaLeft,
  buildScoreInfoRows,
  getSpecItemCenterRatios,
  getScaledGridHorizontalBounds,
  deriveScoreInfoMinWidthPt,
  expandBoundsToMinWidth,
  resolvePdfTempoValue,
  selectPreviewPhysicalPageIndex,
} from '../pdfExport.js';
import { buildPdfPagePlan } from '../pdfFirstPage.js';
import {
  PDF_PRESETS,
  PDF_SCORE_INFO_DESIGNS,
  PITCH_CLASSES,
  SCORE_INFO_SPACE_UNIT,
  keyDisplayName,
  keyTonicPitchClass,
  hasEnharmonicKeyName,
  formatPdfKeyName,
  keyModeNotationLabel,
  normalizeKeyMode,
  normalizeKeyNotationId,
  normalizeKeyModeNotationId,
  normalizeScoreInfoDesignId,
  buildPdfPalette,
  pdfConfig,
} from '../../constants/config.js';
import { resolvePdfTypography } from '../pdfTypography.js';
import { resolvePdfGridStyle } from '../pdfGridStyle.js';
import { t } from '../../i18n/index.js';

function createSvgElement(name) {
  return {
    nodeName: name,
    attributes: {},
    children: [],
    textContent: '',
    setAttribute(attribute, value) {
      this.attributes[attribute] = String(value);
    },
    getAttribute(attribute) {
      return this.attributes[attribute];
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
}

function withSvgDocument(callback) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElementNS: (_namespace, name) => createSvgElement(name),
  };
  try {
    return callback();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

// 曲情報の区切り。実装と同じ単位定数から組み立てて、間隔を変えたときに
// 期待値を書き換えなくて済むようにする（幅の妥当性は専用のテストで見る）。
const SEPARATOR = SCORE_INFO_SPACE_UNIT.repeat(3);
const COMPACT_SEPARATOR = `${SCORE_INFO_SPACE_UNIT} `;

// truncateToUnitWidth は doc.getStringUnitWidth(fontSize=1相当の幅) しか
// 使わないため、最小のスタブで足りる。1文字1幅の単純なスタブ。
function stubDoc(widthPerChar = (s) => Array.from(s).length) {
  return { getStringUnitWidth: widthPerChar };
}

describe('truncateToUnitWidth', () => {
  it('収まる文字列はそのまま返る', () => {
    const doc = stubDoc();
    expect(truncateToUnitWidth(doc, 'abc', 10)).toBe('abc');
  });

  it('収まらない文字列は「…」付きで返り、その幅が maxUnitWidth 以下になる', () => {
    const doc = stubDoc();
    const result = truncateToUnitWidth(doc, 'abcdefghij', 5);
    expect(result.endsWith('…')).toBe(true);
    expect(doc.getStringUnitWidth(result)).toBeLessThanOrEqual(5);
  });

  it('サロゲートペア（絵文字など）を含む文字列で、壊れた半端な符号単位が残らない', () => {
    const doc = stubDoc();
    const text = `${'😀'.repeat(5)}abcde`;
    const result = truncateToUnitWidth(doc, text, 3);
    // Array.from の符号位置単位で構成されているはずなので、
    // 文字列として再度 Array.from しても長さが変わらない（壊れた片割れが無い）
    const chars = Array.from(result);
    expect(chars.join('')).toBe(result);
  });

  it('maxUnitWidth が 0 / 負 / NaN のとき空文字が返る', () => {
    const doc = stubDoc();
    expect(truncateToUnitWidth(doc, 'abc', 0)).toBe('');
    expect(truncateToUnitWidth(doc, 'abc', -1)).toBe('');
    expect(truncateToUnitWidth(doc, 'abc', NaN)).toBe('');
  });

  it('getStringUnitWidth が NaN / 0 を返すスタブでは、元の文字列がそのまま返る', () => {
    const nanDoc = stubDoc(() => NaN);
    expect(truncateToUnitWidth(nanDoc, 'abcdefghij', 5)).toBe('abcdefghij');

    const zeroDoc = stubDoc(() => 0);
    expect(truncateToUnitWidth(zeroDoc, 'abcdefghij', 5)).toBe('abcdefghij');
  });
});

describe('PDFの曲情報クレジット', () => {
  it('作曲者・作詞者・譜面作成者を既定の順序とラベルで組み立てる', () => {
    const score = {
      author: '作曲者',
      lyricist: '作詞者',
      transcribedBy: '譜面作成者',
    };

    expect(buildMusicCredit(score)).toBe(`作曲: 作曲者${SEPARATOR}作詞: 作詞者`);
    expect(buildHeaderCredit(score)).toBe(
      `作曲: 作曲者${SEPARATOR}作詞: 作詞者${SEPARATOR}譜面作成: 譜面作成者`,
    );
  });

  it('空欄は区切りごと省略し、作詞者だけでも表示できる', () => {
    expect(buildMusicCredit({ lyricist: '作詞者' })).toBe('作詞: 作詞者');
    expect(buildHeaderCredit({ lyricist: '作詞者' })).toBe('作詞: 作詞者');
  });

  it('区切りに全角スペースを使わず、全書体で同じ空きにする', () => {
    // U+3000 は DM Sans / IBM Plex Sans Thai Looped / Be Vietnam Pro /
    // Golos Text に無く、混ぜると同じ設定で言語ごとに幅が変わってしまう。
    const score = {
      bpm: 120,
      bitsPerPage: 16,
      pitchLevel: 0,
      keyMode: 'major',
      author: '作曲者',
      lyricist: '作詞者',
      transcribedBy: '譜面作成者',
    };
    const texts = [
      buildMusicCredit(score),
      buildHeaderCredit(score),
      buildMetaLeft(score),
      ...buildScoreInfoRows(score, 'score').flatMap((row) => row.texts),
      ...buildScoreInfoRows(score, 'masthead').flatMap((row) => row.texts),
    ];

    for (const text of texts) {
      expect(text).not.toContain('　');
    }
  });

  it('区切りの空きは単位定数だけで決まる', () => {
    const score = { author: '作曲者', lyricist: '作詞者' };
    const separator = SCORE_INFO_SPACE_UNIT.repeat(3);

    expect(buildMusicCredit(score)).toBe(`作曲: 作曲者${separator}作詞: 作詞者`);
    expect(buildHeaderCredit(score)).toBe(`作曲: 作曲者${separator}作詞: 作詞者`);
  });

  it('単位はどの埋め込み書体でもほぼ1emになる個数にする', () => {
    // 半角スペースの送り幅の実測範囲（埋め込み8書体で0.22〜0.28em）。
    // 個数を変えるときは、この範囲で0.85〜1.15emに収まることを確認する。
    const minSpaceEm = 0.22;
    const maxSpaceEm = 0.28;
    const count = SCORE_INFO_SPACE_UNIT.length;

    expect(SCORE_INFO_SPACE_UNIT).toBe(' '.repeat(count));
    expect(count * minSpaceEm).toBeGreaterThan(0.85);
    expect(count * maxSpaceEm).toBeLessThan(1.15);
  });

  it('4デザインを完成組版の名前で定義し、未知idは楽譜へ戻す', () => {
    expect(Object.keys(PDF_SCORE_INFO_DESIGNS).map((id) => t(`pdf.scoreInfoDesign.${id}`))).toEqual([
      '楽譜',
      'シンプル',
      '詳細',
      '表紙',
    ]);
    expect(normalizeScoreInfoDesignId('specSheet')).toBe('specSheet');
    expect(normalizeScoreInfoDesignId('freeform')).toBe('score');
  });

  it('楽譜・シンプル・詳細の意味構造を組み立てる', () => {
    const score = {
      author: '作曲者',
      lyricist: '作詞者',
      transcribedBy: '譜面作成者',
      bpm: 120,
      bitsPerPage: 16,
      pitchLevel: 0,
      keyMode: 'major',
    };
    expect(buildScoreInfoRows(score, 'score')).toEqual([
      {
        kind: 'columns',
        texts: ['', '作曲: 作曲者'],
      },
      {
        kind: 'columns',
        texts: ['', '作詞: 作詞者'],
      },
      {
        kind: 'columns',
        texts: ['', '譜面作成: 譜面作成者'],
      },
      {
        kind: 'columns',
        texts: [`♩ = 30${COMPACT_SEPARATOR}4拍子${COMPACT_SEPARATOR}C`, ''],
      },
    ]);
    expect(buildScoreInfoRows(score, 'masthead')).toEqual([{
      kind: 'line',
      tone: 'muted',
      texts: [
        '作曲: 作曲者',
        '作詞: 作詞者',
        '譜面作成: 譜面作成者',
        '♩ = 30',
        '4拍子',
        'C',
      ],
      text: `作曲: 作曲者${SEPARATOR}作詞: 作詞者${SEPARATOR}譜面作成: 譜面作成者${SEPARATOR}♩ = 30${SEPARATOR}4拍子${SEPARATOR}C`,
    }]);
    expect(buildScoreInfoRows(score, 'specSheet')).toEqual([
      {
        kind: 'specLabels',
        texts: ['作曲', '作詞', '譜面作成'],
      },
      {
        kind: 'specValues',
        texts: ['作曲者', '作詞者', '譜面作成者'],
      },
      {
        kind: 'specLabels',
        texts: ['テンポ', '拍子', 'キー'],
      },
      {
        kind: 'specValues',
        texts: ['♩ = 30', '4拍子', 'C'],
      },
    ]);
  });

  it('曲情報の空欄は形式を変えても省略し、既存のPDF字形サニタイズを通す', () => {
    const rows = buildScoreInfoRows({
      author: '作～曲',
      lyricist: '',
      transcribedBy: '',
      bpm: 90,
      bitsPerPage: 12,
      pitchLevel: 0,
    }, 'masthead');
    expect(rows[0].texts).toEqual(['作曲: 作〜曲', '♩ = 22.5', '3拍子', 'C']);
  });

  it('波ダッシュの代替字を書体ごとの指定へ置き換える', () => {
    expect(sanitizeForPdf('作～曲〜', '~')).toBe('作~曲~');
    expect(sanitizeForPdf('作～曲〜')).toBe('作〜曲〜');
    expect(buildScoreInfoRows({
      author: '作～曲',
      lyricist: '',
      transcribedBy: '',
      bpm: 90,
      bitsPerPage: 12,
      pitchLevel: 0,
    }, 'masthead', '♭', 'both', 'compact', 'quarter', 30, '~')[0].texts[0])
      .toBe('作曲: 作~曲');
  });

  it('PDF出力前に文字列をNFCへ正規化する', () => {
    expect(sanitizeForPdf('e\u0301')).toBe('é');
    expect(sanitizeForPdf('か\u3099')).toBe('が');
  });

  it('詳細では未入力項目のラベルと値を同時に省略する', () => {
    expect(buildScoreInfoRows({
      author: '',
      lyricist: '作詞者',
      transcribedBy: '',
      bpm: 100,
      bitsPerPage: 0,
      pitchLevel: 0,
      keyMode: 'major',
    }, 'specSheet')).toEqual([
      { kind: 'specLabels', texts: ['作詞'] },
      { kind: 'specValues', texts: ['作詞者'] },
      { kind: 'specLabels', texts: ['テンポ', 'キー'] },
      { kind: 'specValues', texts: ['♩ = 25', 'C'] },
    ]);
  });

  it('楽譜では空欄を除いた作者情報を3段目へ下詰めし、演奏情報をその下へまとめる', () => {
    expect(buildScoreInfoRows({
      author: '',
      lyricist: '作詞者',
      transcribedBy: '',
      bpm: 100,
      bitsPerPage: 0,
      pitchLevel: 0,
      keyMode: 'major',
    }, 'score')).toEqual([
      { kind: 'columns', texts: ['', ''] },
      { kind: 'columns', texts: ['', ''] },
      { kind: 'columns', texts: ['', '作詞: 作詞者'] },
      { kind: 'columns', texts: [`♩ = 25${COMPACT_SEPARATOR}C`, ''] },
    ]);
  });

  it.each([
    [
      { author: '作曲者', lyricist: '', transcribedBy: '譜面作成者' },
      ['', '作曲: 作曲者', '譜面作成: 譜面作成者'],
    ],
    [
      { author: '作曲者', lyricist: '作詞者', transcribedBy: '' },
      ['', '作曲: 作曲者', '作詞: 作詞者'],
    ],
    [
      { author: '作曲者', lyricist: '', transcribedBy: '' },
      ['', '', '作曲: 作曲者'],
    ],
  ])('作者欄の空欄パターン %# を順序を保ったまま下端へ揃える', (credits, expected) => {
    const rows = buildScoreInfoRows({
      ...credits,
      bpm: 120,
      bitsPerPage: 16,
      pitchLevel: 0,
    }, 'score');
    expect(rows.slice(0, 3).map(({ texts }) => texts[1])).toEqual(expected);
  });
});

describe('getSpecItemCenterRatios', () => {
  it('詳細の1〜3項目を中央・3分点・3列中央へ配置する', () => {
    expect(getSpecItemCenterRatios(0)).toEqual([]);
    expect(getSpecItemCenterRatios(1)).toEqual([0.5]);
    expect(getSpecItemCenterRatios(2)).toEqual([1 / 3, 2 / 3]);
    expect(getSpecItemCenterRatios(3)).toEqual([1 / 6, 1 / 2, 5 / 6]);
    expect(getSpecItemCenterRatios(4)).toEqual([]);
  });
});

describe('getScaledGridHorizontalBounds', () => {
  it('SVGの余白を除いたグリッド外枠の左右端を返す', () => {
    expect(getScaledGridHorizontalBounds({
      offsetX: 40,
      svgWidth: 742,
      edgePadding: 6,
      scale: 0.5,
    })).toEqual({ leftPt: 43, rightPt: 408 });
  });
});

/* ============================================================
 * 曲情報デザイン「楽譜」の左右端の下限
 * ------------------------------------------------------------
 * 左右端は実際のグリッド外枠へ揃えるが、列数・行数を増やすと
 * グリッドが小さくなり曲情報の行まで細くなる。標準余白・標準間隔の
 * 6行3列のときのグリッド幅を下限とし、それより短くはならない。
 * 下限は用紙（スロット）寸法からその都度求め、曲名・曲情報の文字サイズ
 * 設定では変わらない。
 * ============================================================ */

describe('deriveScoreInfoMinWidthPt', () => {
  it('標準余白・標準間隔の6行3列のグリッド幅と一致する', () => {
    const layout = buildLayout({ maxRowsPerPage: 6 });
    // 6行3列は高さ側が効くため、縮尺は contentHeightPt / rawSvgHeight。
    const scale = (841.89 - 2 * 40 - pdfConfig.titleAreaPt) / (6 * 275 + 5 * 80);
    expect(deriveScoreInfoMinWidthPt(layout)).toBeCloseTo((3 * 350 + 2 * 30) * scale, 6);
  });

  it('曲名・曲情報の文字サイズ設定では下限が動かない', () => {
    const base = deriveScoreInfoMinWidthPt(buildLayout());
    expect(deriveScoreInfoMinWidthPt(buildLayout({ titleFontSizePt: 24, metaFontSizePt: 14 })))
      .toBeCloseTo(base, 6);
    expect(deriveScoreInfoMinWidthPt(buildLayout({ maxRowsPerPage: 12 }))).toBeCloseTo(base, 6);
  });

  it('2面付けの狭いスロットでは下限もそのスロットに合わせて狭くなる', () => {
    const sheet = buildSheetGeometry('double');
    const doubleLayout = buildLayout({}, sheet.slotWidthPt, sheet.slotHeightPt);
    expect(deriveScoreInfoMinWidthPt(doubleLayout))
      .toBeLessThan(deriveScoreInfoMinWidthPt(buildLayout()));
  });
});

describe('expandBoundsToMinWidth', () => {
  const layout = buildLayout();

  it('下限より狭いときだけ、中心を保ったまま広げる', () => {
    const narrow = expandBoundsToMinWidth(
      { leftPt: 250, rightPt: 350 },
      200,
      layout,
    );
    expect(narrow).toEqual({ leftPt: 200, rightPt: 400 });
    expect((narrow.leftPt + narrow.rightPt) / 2).toBe(300);
  });

  it('下限以上の幅はそのまま返す', () => {
    const wide = { leftPt: 40, rightPt: 555 };
    expect(expandBoundsToMinWidth(wide, 200, layout)).toBe(wide);
  });

  it('本文領域より広い下限では、本文領域の幅で頭打ちにする', () => {
    const wideMargin = buildLayout({ pageMarginId: 'wide' });
    const result = expandBoundsToMinWidth(
      { leftPt: 290, rightPt: 300 },
      10000,
      wideMargin,
    );
    expect(result.rightPt - result.leftPt).toBeCloseTo(wideMargin.contentWidthPt, 6);
    expect(result.leftPt).toBeCloseTo(wideMargin.marginPt, 6);
    expect(result.rightPt).toBeCloseTo(wideMargin.pageWidthPt - wideMargin.marginPt, 6);
  });
});

describe('キー表示', () => {
  it('黒鍵のキーは一般的な異名同音を併記する', () => {
    expect(PITCH_CLASSES).toEqual([
      'C',
      'C# / D♭',
      'D',
      'D# / E♭',
      'E',
      'F',
      'F# / G♭',
      'G',
      'G# / A♭',
      'A',
      'A# / B♭',
      'B',
    ]);
  });

  it('マイナーでは同じ15鍵の主音を短3度下として表示する', () => {
    expect(Array.from({ length: 12 }, (_, pitchLevel) => (
      keyDisplayName(pitchLevel, 'minor')
    ))).toEqual([
      'A',
      'A# / B♭',
      'B',
      'C',
      'C# / D♭',
      'D',
      'D# / E♭',
      'E',
      'F',
      'F# / G♭',
      'G',
      'G# / A♭',
    ]);
    expect(keyTonicPitchClass(0, 'major')).toBe(0);
    expect(keyTonicPitchClass(0, 'minor')).toBe(9);
  });

  it('黒鍵だけ併記・シャープ・フラットを切り替えられる', () => {
    expect(keyDisplayName(4, 'minor', 'both')).toBe('C# / D♭');
    expect(keyDisplayName(4, 'minor', 'sharp')).toBe('C#');
    expect(keyDisplayName(4, 'minor', 'flat')).toBe('D♭');
    expect(keyDisplayName(0, 'minor', 'sharp')).toBe('A');
    expect(keyDisplayName(0, 'minor', 'flat')).toBe('A');

    expect(hasEnharmonicKeyName(1, 'major')).toBe(true);
    expect(hasEnharmonicKeyName(0, 'major')).toBe(false);
    expect(hasEnharmonicKeyName(4, 'minor')).toBe(true);
    expect(hasEnharmonicKeyName(0, 'minor')).toBe(false);
  });

  it('未知の調性・表記idはメジャー・併記・短縮表記へ戻す', () => {
    expect(normalizeKeyMode('dorian')).toBe('major');
    expect(normalizeKeyNotationId('auto')).toBe('both');
    expect(normalizeKeyModeNotationId('german')).toBe('compact');
    expect(keyDisplayName(1, 'dorian', 'auto')).toBe('C# / D♭');
  });

  it('調性表記の選択肢は現在のメジャー／マイナーに追従する', () => {
    expect(['compact', 'english', 'japanese', 'traditional'].map(
      (id) => keyModeNotationLabel('major', id),
    )).toEqual(['なし', 'major', 'メジャー', '長調(日本式)']);
    expect(['compact', 'english', 'japanese', 'traditional'].map(
      (id) => keyModeNotationLabel('minor', id),
    )).toEqual(['m', 'minor', 'マイナー', '短調(日本式)']);
  });

  it('既定の短縮表記はメジャーで接尾辞なし、マイナーで各音名へmを付ける', () => {
    const score = { bpm: 120, bitsPerPage: 16, pitchLevel: 4, keyMode: 'minor' };
    expect(buildMetaLeft(score))
      .toBe(`♩ = 30${SEPARATOR}4拍子${SEPARATOR}C#m / D♭m`);
    expect(buildMetaLeft(score, '♭', 'sharp'))
      .toBe(`♩ = 30${SEPARATOR}4拍子${SEPARATOR}C#m`);
    expect(buildMetaLeft(score, '♭', 'flat'))
      .toBe(`♩ = 30${SEPARATOR}4拍子${SEPARATOR}D♭m`);
    expect(buildMetaLeft(score, 'b', 'flat'))
      .toBe(`♩ = 30${SEPARATOR}4拍子${SEPARATOR}Dbm`);
    expect(buildMetaLeft({ ...score, keyMode: 'major' }))
      .toBe(`♩ = 30${SEPARATOR}4拍子${SEPARATOR}E`);
  });

  it('英語・カタカナの調性表記を切り替えられる', () => {
    const score = { bpm: 90, bitsPerPage: 12, pitchLevel: 0, keyMode: 'minor' };
    expect(buildMetaLeft(score, '♭', 'both', 'english'))
      .toBe(`♩ = 22.5${SEPARATOR}3拍子${SEPARATOR}A minor`);
    expect(buildMetaLeft(score, '♭', 'both', 'japanese'))
      .toBe(`♩ = 22.5${SEPARATOR}3拍子${SEPARATOR}A マイナー`);
    expect(buildMetaLeft({ ...score, keyMode: 'major' }, '♭', 'both', 'english'))
      .toBe(`♩ = 22.5${SEPARATOR}3拍子${SEPARATOR}C major`);
    expect(buildMetaLeft({ ...score, keyMode: 'major' }, '♭', 'both', 'japanese'))
      .toBe(`♩ = 22.5${SEPARATOR}3拍子${SEPARATOR}C メジャー`);
  });

  it('♩の値はBPM÷4・BPM÷2・カスタムを切り替えられる', () => {
    const score = { bitsPerPage: 16, pitchLevel: 0, keyMode: 'major' };
    expect(buildMetaLeft({ ...score, bpm: 121 })).toContain('♩ = 30.25');
    expect(buildMetaLeft({ ...score, bpm: 122 })).toContain('♩ = 30.5');
    expect(buildMetaLeft({ ...score, bpm: 123 })).toContain('♩ = 30.75');
    expect(buildMetaLeft(
      { ...score, bpm: 121 }, '♭', 'both', 'compact', 'half', 30,
    )).toContain('♩ = 60.5');
    expect(buildMetaLeft(
      { ...score, bpm: 121 }, '♭', 'both', 'compact', 'custom', 72.25,
    )).toContain('♩ = 72.25');
    expect(resolvePdfTempoValue(120, 'unknown', 99)).toBe(30);
    expect(resolvePdfTempoValue(120, 'custom', 1000)).toBe(30);
  });

  it('日本式ではイロハ音名と嬰／変をキー表記に合わせる', () => {
    expect([1, 3, 6, 8, 10].map((pitchLevel) => (
      formatPdfKeyName(pitchLevel, 'major', 'both', 'traditional')
    ))).toEqual([
      '嬰ハ / 変ニ長調',
      '嬰ニ / 変ホ長調',
      '嬰ヘ / 変ト長調',
      '嬰ト / 変イ長調',
      '嬰イ / 変ロ長調',
    ]);
    expect(formatPdfKeyName(6, 'major', 'both', 'traditional'))
      .toBe('嬰ヘ / 変ト長調');
    expect(formatPdfKeyName(6, 'major', 'sharp', 'traditional')).toBe('嬰ヘ長調');
    expect(formatPdfKeyName(6, 'major', 'flat', 'traditional')).toBe('変ト長調');
    expect(formatPdfKeyName(9, 'minor', 'both', 'traditional'))
      .toBe('嬰ヘ / 変ト短調');
    expect(formatPdfKeyName(0, 'major', 'both', 'traditional')).toBe('ハ長調');
    expect(formatPdfKeyName(0, 'minor', 'both', 'traditional')).toBe('イ短調');
  });

  it('旧データ・旧PDF設定は接尾辞なしのメジャーとしてPDFへ出す', () => {
    expect(buildMetaLeft({ bpm: 120, bitsPerPage: 16, pitchLevel: 1 }))
      .toBe(`♩ = 30${SEPARATOR}4拍子${SEPARATOR}C# / D♭`);
  });
});

describe('deriveTitleAreaPt', () => {
  it('既定値（titleFontSizePt=20, metaFontSizePt=9）で pdfConfig.titleAreaPt と一致する', () => {
    expect(
      deriveTitleAreaPt(pdfConfig.titleFontSizePt, pdfConfig.metaFontSizePt),
    ).toBe(pdfConfig.titleAreaPt);
  });

  it('文字サイズが大きいほど確保高も大きくなる', () => {
    const base = deriveTitleAreaPt(15, 9);
    expect(deriveTitleAreaPt(24, 9)).toBeGreaterThan(base);
    expect(deriveTitleAreaPt(15, 14)).toBeGreaterThan(base);
  });

  it('各デザインの行数と余白に合わせて本文の確保高を変える', () => {
    const score = deriveTitleAreaPt(15, 9, 'score');
    expect(deriveTitleAreaPt(15, 9, 'masthead')).toBeLessThan(score);
    expect(deriveTitleAreaPt(15, 9, 'specSheet')).toBeGreaterThan(score);
    expect(deriveTitleAreaPt(15, 9, 'freeform')).toBe(score);
  });
});

describe('buildSheetGeometry', () => {
  it('1面付け（single）はスロット=用紙全体で、従来の1ページぶんの寸法と一致する', () => {
    const geo = buildSheetGeometry('single');
    expect(geo.orientation).toBe('portrait');
    expect(geo.sheetWidthPt).toBe(pdfConfig.pageWidthPt);
    expect(geo.sheetHeightPt).toBe(pdfConfig.pageHeightPt);
    expect(geo.slotsPerSheet).toBe(1);
    expect(geo.slotWidthPt).toBe(pdfConfig.pageWidthPt);
    expect(geo.slotHeightPt).toBe(pdfConfig.pageHeightPt);
    expect(geo.slotOrigins).toEqual([{ x: 0, y: 0 }]);
  });

  it('未知のsheetLayoutIdはsingleと同じ扱いになる（exportPdf側のフォールバックとは別に、幾何計算自体も安全側に倒れる）', () => {
    const geo = buildSheetGeometry('triple');
    expect(geo.slotsPerSheet).toBe(1);
  });

  it('2面付け（double）は横向きA4用紙を左右2スロットに割り、寸法が揃う', () => {
    const geo = buildSheetGeometry('double');
    expect(geo.orientation).toBe('landscape');
    // 横向きA4は縦向きA4の幅と高さを入れ替えた物理サイズ（同じ紙を90度回しただけ）
    expect(geo.sheetWidthPt).toBe(pdfConfig.pageHeightPt);
    expect(geo.sheetHeightPt).toBe(pdfConfig.pageWidthPt);
    expect(geo.slotsPerSheet).toBe(2);
    expect(geo.slotOrigins).toHaveLength(2);

    // 全スロットの大きさが揃っている（不変条件1の前提）
    expect(geo.slotWidthPt).toBeGreaterThan(0);
    expect(geo.slotHeightPt).toBeGreaterThan(0);

    // buildSheetGeometry はスロットの生の物理サイズだけを返し、余白は一切
    // 差し引かない（marginPt を差し引くのは buildLayout の役目に一本化して
    // ある。ここでさらに marginPt を差し引くと、buildLayout 側の
    // 差し引きと二重になりコンテンツ領域が不当に狭くなっていた）。
    // 左右のスロットは隙間なく隣接し、用紙幅をちょうど2等分する。
    const [left, right] = geo.slotOrigins;
    expect(left).toEqual({ x: 0, y: 0 });
    expect(right).toEqual({ x: geo.slotWidthPt, y: 0 });
    expect(geo.slotWidthPt).toBeCloseTo(geo.sheetWidthPt / 2, 6);
    expect(geo.slotHeightPt).toBe(geo.sheetHeightPt);
  });
});

describe('selectPreviewPhysicalPageIndex', () => {
  const single = buildSheetGeometry('single');
  const double = buildSheetGeometry('double');

  it('表紙なしは物理0（本文0を含む唯一のページ）', () => {
    const plan = buildPdfPagePlan({
      firstPageLayoutId: 'classic',
      sheetGeometry: single,
      coverGeometry: single,
      logicalPageCount: 3,
    });
    expect(selectPreviewPhysicalPageIndex(plan)).toBe(0);
  });

  it('表紙あり＋1面付けは物理1（表紙の次の「2ページ目」）', () => {
    const plan = buildPdfPagePlan({
      firstPageLayoutId: 'cover',
      sheetGeometry: single,
      coverGeometry: single,
      logicalPageCount: 2,
    });
    expect(plan[0].kind).toBe('cover');
    expect(plan[0].bodySlots).toEqual([]);
    expect(selectPreviewPhysicalPageIndex(plan)).toBe(1);
  });

  it('表紙あり＋2面付けは物理0（表紙と本文1ページ目が同居した1枚）', () => {
    const plan = buildPdfPagePlan({
      firstPageLayoutId: 'cover',
      sheetGeometry: double,
      coverGeometry: double,
      logicalPageCount: 2,
      coverIncludesFirstBodyPage: true,
    });
    expect(plan[0].kind).toBe('cover');
    expect(plan[0].bodySlots).toEqual([{ slotIndex: 1, pageIndex: 0 }]);
    expect(selectPreviewPhysicalPageIndex(plan)).toBe(0);
  });

  it('該当ページが1枚も無い場合は物理0へフォールバックする', () => {
    expect(selectPreviewPhysicalPageIndex([{ kind: 'cover', bodySlots: [] }])).toBe(0);
  });
});

describe('buildLayout', () => {
  it('既定値は余白・間隔を維持し、本文上端だけを8pt上へ寄せる', () => {
    const layout = buildLayout();
    expect(layout.marginPt).toBe(40);
    expect(layout.contentTopPt).toBe(32);
    expect(layout.gridHorizontalSpacing).toBe(30);
    expect(layout.gridVerticalSpacing).toBe(80);
    expect(layout.contentWidthPt).toBeCloseTo(515.28, 6);
    expect(layout.contentHeightPt).toBeCloseTo(681.89, 6);
    expect(layout.pageNumberBaselinePt).toBeCloseTo(823.89, 6);
  });

  it('余白と間隔を独立してレイアウトへ反映する', () => {
    const layout = buildLayout({ pageMarginId: 'wide', gridGapId: 'tight' });
    expect(layout.marginPt).toBe(64);
    expect(layout.contentTopPt).toBe(56);
    expect(layout.gridHorizontalSpacing).toBe(12);
    expect(layout.gridVerticalSpacing).toBe(45);
    expect(layout.contentWidthPt).toBeCloseTo(467.28, 6);
    expect(layout.contentHeightPt).toBeCloseTo(633.89, 6);
    // ページ番号だけは本文余白によらず、用紙下端から18ptを保つ。
    expect(layout.pageNumberBaselinePt).toBeCloseTo(823.89, 6);
  });

  it('未知のidは既定値へ戻る', () => {
    const layout = buildLayout({ pageMarginId: 'large', gridGapId: 'wide' });
    expect(layout.marginPt).toBe(40);
    expect(layout.gridHorizontalSpacing).toBe(30);
    expect(layout.gridVerticalSpacing).toBe(80);
  });

  it('マストヘッドは左右で共通の確保高を使い、他デザインとは独立する', () => {
    const score = buildLayout({ scoreInfoDesignId: 'score' });
    const left = buildLayout({ scoreInfoDesignId: 'masthead', mastheadDirectionId: 'left' });
    const right = buildLayout({ scoreInfoDesignId: 'masthead', mastheadDirectionId: 'right' });
    const specSheet = buildLayout({ scoreInfoDesignId: 'specSheet' });
    expect(right.titleAreaPt).toBe(left.titleAreaPt);
    expect(left.titleAreaPt).toBeLessThan(score.titleAreaPt);
    expect(specSheet.titleAreaPt).toBeGreaterThan(score.titleAreaPt);
  });
});

describe('buildPageSvg', () => {
  const palette = buildPdfPalette(PDF_PRESETS.print);
  const gridStyle = resolvePdfGridStyle({ gridStyleId: 'standard' });
  const typography = resolvePdfTypography();
  const layout = buildLayout();
  const pageRows = [[
    { grid: { keys: [0], text: '歌詞' }, index: 0 },
    { grid: { keys: [1], text: '歌詞' }, index: 1 },
  ]];

  it('SVGの四辺へパディングを加え、グリッドをパディング位置から並べる', () => {
    const result = withSvgDocument(() => buildPageSvg(
      { getStringUnitWidth: (text) => Array.from(text).length },
      pageRows,
      2,
      palette,
      'PDF-Font',
      gridStyle,
      typography,
      layout,
      6,
    ));

    expect(result.svg.getAttribute('width')).toBe('742');
    expect(result.svg.getAttribute('height')).toBe('287');
    expect(result.svg.getAttribute('viewBox')).toBe('0 0 742 287');
    expect(result.svg.children[0].getAttribute('transform')).toBe('translate(6, 6)');
    expect(result.svg.children[1].getAttribute('transform')).toBe('translate(386, 6)');
  });

  // 「1ページの列数」で最大の8列を選んでも、最終列がSVGの右端をパディングの
  // 内側で終わること（列が増えても全体幅が同じ式から出てくること）を固定する。
  it('8列でも最終列の右端がSVGの幅とパディングに収まる', () => {
    const edgePadding = 6;
    const eightColumns = [Array.from({ length: 8 }, (_, index) => ({
      grid: { keys: [], layer2Keys: [], text: '' },
      index,
    }))];
    const result = withSvgDocument(() => buildPageSvg(
      stubDoc(),
      eightColumns,
      8,
      palette,
      'PDF-Font',
      gridStyle,
      typography,
      layout,
      edgePadding,
    ));

    const lastX = edgePadding + 7 * (layout.gridBaseWidth + layout.gridHorizontalSpacing);
    expect(result.svg.children[7].getAttribute('transform')).toBe(`translate(${lastX}, ${edgePadding})`);
    expect(lastX + layout.gridBaseWidth + edgePadding)
      .toBe(Number(result.svg.getAttribute('width')));
  });

  it('番号なしでは番号textだけを省き、歌詞textは残す', () => {
    const result = withSvgDocument(() => buildPageSvg(
      { getStringUnitWidth: (text) => Array.from(text).length },
      pageRows,
      2,
      palette,
      'PDF-Font',
      gridStyle,
      { ...typography, gridNumberDisplayId: 'none' },
      layout,
      6,
    ));

    expect(result.svg.children[0].children
      .filter((child) => child.nodeName === 'text')
      .map((child) => child.textContent)).toEqual(['歌詞']);
  });

  function cellRects(result) {
    return result.svg.children[0].children
      .filter((child) => child.nodeName === 'rect')
      .slice(1);
  }

  /* ----------------------------------------------------------
   * 偶数行の網掛け
   * 既定（無効）では何も足さない。有効のときは、そのページの2・4・6…行目の
   * 背後へ黒の半透明の帯を「グリッドより前に」置く（後ろから重ねると記号や
   * 歌詞が沈む）。帯はブロックの上下端をはみ出さない。
   * -------------------------------------------------------- */
  function shadedLayout(options) {
    return buildLayout({ rowShadingId: 'even', ...options });
  }

  function threeRows() {
    return [0, 1, 2].map((rowIndex) => [
      { grid: { keys: [], layer2Keys: [], text: '' }, index: rowIndex },
    ]);
  }

  function bandRects(result) {
    return result.svg.children.filter(
      (child) => child.nodeName === 'rect' && child.getAttribute('opacity') !== null,
    );
  }

  it('既定では網掛けの帯を描かない', () => {
    const result = withSvgDocument(() => buildPageSvg(
      stubDoc(), threeRows(), 1, palette, 'PDF-Font', gridStyle, typography, buildLayout(), 0,
    ));
    expect(bandRects(result)).toHaveLength(0);
  });

  it('有効のとき、2行目だけの帯をグリッドより前に置く', () => {
    const layoutWithShading = shadedLayout();
    const result = withSvgDocument(() => buildPageSvg(
      stubDoc(), threeRows(), 1, palette, 'PDF-Font', gridStyle, typography, layoutWithShading, 0,
    ));

    const bands = bandRects(result);
    expect(bands).toHaveLength(1);
    // 帯はSVGの先頭（＝すべてのグリッドより前）にある
    expect(result.svg.children[0]).toBe(bands[0]);
    expect(bands[0].getAttribute('fill')).toBe('#000000');
    expect(Number(bands[0].getAttribute('width'))).toBe(
      Number(result.svg.getAttribute('width')),
    );

    const rowPitch = layoutWithShading.gridBaseHeight + layoutWithShading.gridVerticalSpacing;
    expect(Number(bands[0].getAttribute('y')))
      .toBeCloseTo(rowPitch - layoutWithShading.gridVerticalSpacing / 2, 6);
    expect(Number(bands[0].getAttribute('height')))
      .toBeCloseTo(layoutWithShading.gridBaseHeight + layoutWithShading.gridVerticalSpacing, 6);
  });

  it('最終行が偶数行でも帯はブロックの下端を越えない', () => {
    const layoutWithShading = shadedLayout();
    const result = withSvgDocument(() => buildPageSvg(
      stubDoc(),
      threeRows().slice(0, 2),
      1,
      palette,
      'PDF-Font',
      gridStyle,
      typography,
      layoutWithShading,
      0,
    ));

    const [band] = bandRects(result);
    const svgHeight = Number(result.svg.getAttribute('height'));
    expect(Number(band.getAttribute('y')) + Number(band.getAttribute('height')))
      .toBeCloseTo(svgHeight, 6);
  });

  it('網掛け行では鍵盤の面が同じ割合だけ暗くなり、枠・記号は変わらない', () => {
    const rows = [
      [{ grid: { keys: [0], layer2Keys: [], text: '' }, index: 0 }],
      [{ grid: { keys: [0], layer2Keys: [], text: '' }, index: 1 }],
    ];
    const result = withSvgDocument(() => buildPageSvg(
      stubDoc(), rows, 1, palette, 'PDF-Font', gridStyle, typography, shadedLayout(), 0,
    ));

    const grids = result.svg.children.filter((child) => child.nodeName === 'g');
    const fills = grids.map((group) => cellRects({ svg: { children: [group] } })
      .map((rect) => rect.getAttribute('fill')));
    const strokes = grids.map((group) => cellRects({ svg: { children: [group] } })
      .map((rect) => rect.getAttribute('stroke')));

    // 1行目は素のパレット、2行目（偶数行）は暗くした面
    expect(fills[0]).toContain(palette.cellFill);
    expect(fills[1]).not.toContain(palette.cellFill);
    expect(fills[1].every((fill) => fill !== undefined && fill !== null)).toBe(true);
    // 押鍵の面も暗くする
    expect(fills[0]).toContain(palette.cellFillHighlight);
    expect(fills[1]).not.toContain(palette.cellFillHighlight);
    // 枠線は両方の行で同じ
    expect(strokes[1]).toEqual(strokes[0]);
  });

  it('暗い紙面色では帯の半透明度を上げる', () => {
    const dark = buildPdfPalette(PDF_PRESETS.winterDark);
    const light = withSvgDocument(() => buildPageSvg(
      stubDoc(), threeRows(), 1, palette, 'PDF-Font', gridStyle, typography, shadedLayout(), 0,
    ));
    const shaded = withSvgDocument(() => buildPageSvg(
      stubDoc(), threeRows(), 1, dark, 'PDF-Font', gridStyle, typography, shadedLayout(), 0,
    ));

    expect(Number(bandRects(shaded)[0].getAttribute('opacity')))
      .toBeGreaterThan(Number(bandRects(light)[0].getAttribute('opacity')));
  });

  it('無音かつ無歌詞のグリッドは通常色のまま全体を50%不透明にする', () => {
    const result = withSvgDocument(() => buildPageSvg(
      stubDoc(),
      [[{ grid: { keys: [], layer2Keys: [], text: '' }, index: 0 }]],
      2,
      palette,
      'PDF-Font',
      gridStyle,
      typography,
      layout,
    ));
    const group = result.svg.children[0];
    const rects = cellRects(result);
    const symbol = group.children.find((child) => child.nodeName === 'g').children[0];
    const number = group.children.find(
      (child) => child.nodeName === 'text' && child.textContent === '1',
    );

    expect(group.getAttribute('opacity')).toBe('0.5');
    expect(group.children[0].getAttribute('stroke')).toBe(palette.outerFrame);
    expect(rects[0].getAttribute('fill')).toBe(palette.cellFill);
    expect(rects[0].getAttribute('stroke')).toBe(palette.cellStroke);
    expect(symbol.nodeName).toBe('path');
    expect(symbol.getAttribute('stroke')).toBe(palette.symbol);
    expect(number.getAttribute('fill')).toBe(palette.number);
  });

  it('歌詞だけのグリッドは空扱いせず通常の不透明度にする', () => {
    const result = withSvgDocument(() => buildPageSvg(
      stubDoc(),
      [[{ grid: { keys: [], layer2Keys: [], text: '歌詞' }, index: 0 }]],
      2,
      palette,
      'PDF-Font',
      gridStyle,
      typography,
      layout,
    ));

    expect(result.svg.children[0].getAttribute('opacity')).toBeUndefined();
  });

  it('記号の角丸を通常ひし形と円＋ひし形の複合パスへ反映する', () => {
    const roundedStyle = resolvePdfGridStyle({
      gridStyleId: 'custom',
      gridStyleCustom: { ...gridStyle, symbolRadius: 8 },
    });
    const result = withSvgDocument(() => buildPageSvg(
      stubDoc(),
      [[{ grid: { keys: [0, 1, 2], text: '' }, index: 0 }]],
      2,
      palette,
      'PDF-Font',
      roundedStyle,
      typography,
      layout,
    ));
    const symbolGroups = result.svg.children[0].children
      .filter((child) => child.nodeName === 'g');
    const combined = symbolGroups[0].children[0];
    const diamond = symbolGroups[1].children[0];
    const circle = symbolGroups[2].children[0];

    expect(combined.nodeName).toBe('path');
    expect(combined.getAttribute('d').match(/ Q /g)).toHaveLength(4);
    expect(combined.getAttribute('d').match(/ A 18 18 /g)).toHaveLength(2);
    expect(symbolGroups[0].children).toHaveLength(1);
    expect(diamond.nodeName).toBe('path');
    expect(diamond.getAttribute('d').match(/ Q /g)).toHaveLength(4);
    expect(circle.nodeName).toBe('circle');
  });

  it('二層譜面は選択側を色1、非選択側を色2、重複を選択側へ描く', () => {
    const pageRowsWithLayers = [[{
      grid: { keys: [0], layer2Keys: [0, 1] },
      index: 0,
    }]];

    const selectedLayer1 = withSvgDocument(() => buildPageSvg(
      stubDoc(),
      pageRowsWithLayers,
      2,
      palette,
      'PDF-Font',
      gridStyle,
      typography,
      layout,
      0,
      { usesTwoLayers: true, selectedLayer: 1 },
    ));
    const layer1Rects = cellRects(selectedLayer1);
    expect(layer1Rects[0].getAttribute('fill')).toBe(palette.cellFillHighlight);
    expect(layer1Rects[1].getAttribute('fill')).toBe(palette.cellFillHighlight2);

    const selectedLayer2 = withSvgDocument(() => buildPageSvg(
      stubDoc(),
      pageRowsWithLayers,
      2,
      palette,
      'PDF-Font',
      gridStyle,
      typography,
      layout,
      0,
      { usesTwoLayers: true, selectedLayer: 2 },
    ));
    const layer2Rects = cellRects(selectedLayer2);
    expect(layer2Rects[0].getAttribute('fill')).toBe(palette.cellFillHighlight);
    expect(layer2Rects[1].getAttribute('fill')).toBe(palette.cellFillHighlight);
  });

  it('単層譜面は絶対レイヤーや選択レイヤーに関係なく既存の色1契約を使う', () => {
    const result = withSvgDocument(() => buildPageSvg(
      stubDoc(),
      [[{ grid: { keys: [0], layer2Keys: [1] }, index: 0 }]],
      2,
      palette,
      'PDF-Font',
      gridStyle,
      typography,
      layout,
      0,
      { usesTwoLayers: false, selectedLayer: 2 },
    ));
    const rects = cellRects(result);
    expect(rects[1].getAttribute('fill')).toBe(palette.cellFillHighlight);
  });
});

// resolvePaletteSeed のテストは、置き場を config.js（Toolbar.jsx との共有元）へ
// 移したのに合わせて pdfPalette.test.js へ移動した。
