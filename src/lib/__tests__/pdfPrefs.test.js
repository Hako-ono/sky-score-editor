import { describe, it, expect, beforeEach } from 'vitest';

import {
  PDF_PREFS_STORAGE_KEY,
  PDF_PRESETS,
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
  CUSTOM_PRESET_ID,
  pdfConfig,
  complementHex,
} from '../../constants/config.js';
import { loadPdfPrefs, savePdfPrefs } from '../pdfPrefs.js';
import {
  DEFAULT_PDF_GRID_STYLE_CUSTOM,
  DEFAULT_PDF_GRID_STYLE_ID,
} from '../pdfGridStyle.js';

/* ============================================================
 * この関数が満たすべき契約
 * ------------------------------------------------------------
 * loadPdfPrefs() -> { presetId, fontId, titleFontSizePt, metaFontSizePt,
 *                      maxRowsPerPage, fontWeightId, lyricSizePercent,
 *                      gridNumberSizePercent, pageNumberFontSizePt,
 *                      gridNumberDisplayId,
 *                      sheetLayoutId, pageMarginId, gridGapId, gridStyleId,
 *                      scoreInfoDesignId, mastheadDirectionId,
 *                      gridStyleCustom, custom }
 *   - 未保存・壊れたJSON・null・配列は既定値
 *     { print, gothic, 20, 9, 6, single, PDF_PRESETS.print.seed } に落ちる。
 *   - PDF_PRESETS / PDF_FONTS / PDF_SHEET_LAYOUTS に存在しないid・型が違う値は、
 *     そのキーだけ既定値に落ちる（オブジェクト全体は捨てない）。presetId は
 *     'custom'（PDF_PRESETSには存在しない）も正常値として受け付ける。
 *   - titleFontSizePt/metaFontSizePt/maxRowsPerPage は PDF_LAYOUT_RANGES の
 *     範囲外・非数値・非整数のとき、そのキーだけ既定値に落ちる。
 *   - custom（8色のseed）は sanitizeCustomSeed によりキーごとに検証され、
 *     #RRGGBB形式でない値・文字列でない値・キー欠落はそのキーだけ
 *     PDF_PRESETS.print.seed へ落ちる。
 *   - 知らないキーが混ざっていても既知のキーの値はそのまま使う。
 *   - 旧バージョン（新キーが無い prefs）を読んでも既定値で動く。
 * savePdfPrefs(prefs)
 *   - gridStyleCustom は6キーを個別に検証し、不正値を標準値へ戻す。
 *   - presetId / fontId / titleFontSizePt / metaFontSizePt / maxRowsPerPage /
 *     sheetLayoutId / pageMarginId / gridGapId / gridStyleId / gridStyleCustom /
 *     custom だけを保存する。
 *   - 保存の失敗（容量超過・プライベートブラウズ）は例外を投げず握り潰す。
 * ============================================================ */

// このアプリの vitest はデフォルト(node)環境で動く（pdfPalette.test.js と
// 同じ方針でDOM無し純関数を対象にする）ため、localStorage は自前で
// 最小限のモックを用意する。実ブラウザのlocalStorageのAPI形状のみ模倣する。
function createMockStorage() {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = createMockStorage();
});

const DEFAULTS = {
  presetId: DEFAULT_PRESET_ID,
  fontId: DEFAULT_FONT_ID,
  fontWeightId: DEFAULT_FONT_WEIGHT_ID,
  titleFontSizePt: pdfConfig.titleFontSizePt,
  metaFontSizePt: pdfConfig.metaFontSizePt,
  maxRowsPerPage: pdfConfig.maxRowsPerPage,
  lyricSizePercent: 100,
  gridNumberSizePercent: 100,
  gridNumberDisplayId: DEFAULT_GRID_NUMBER_DISPLAY_ID,
  pageNumberFontSizePt: pdfConfig.pageNumberFontSizePt,
  sheetLayoutId: DEFAULT_SHEET_LAYOUT_ID,
  scoreInfoDesignId: DEFAULT_SCORE_INFO_DESIGN_ID,
  mastheadDirectionId: DEFAULT_MASTHEAD_DIRECTION_ID,
  tempoValueModeId: DEFAULT_TEMPO_VALUE_MODE_ID,
  customTempoValue: DEFAULT_CUSTOM_TEMPO_VALUE,
  pageMarginId: DEFAULT_PAGE_MARGIN_ID,
  gridGapId: DEFAULT_GRID_GAP_ID,
  keyNotationId: DEFAULT_KEY_NOTATION_ID,
  keyModeNotationId: DEFAULT_KEY_MODE_NOTATION_ID,
  pageNumberFormatId: 'currentTotal',
  pageNumberPositionId: 'bottomCenter',
  runningHeaderId: 'none',
  footerCreditId: 'none',
  gridStyleId: DEFAULT_PDF_GRID_STYLE_ID,
  gridStyleCustom: DEFAULT_PDF_GRID_STYLE_CUSTOM,
  custom: PDF_PRESETS.print.seed,
};

describe('loadPdfPrefs', () => {
  it('未保存のときは既定値を返す', () => {
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('正常な値はそのまま返す', () => {
    const custom = {
      bg: '#101010', ink: '#f0f0f0', line: '#202020',
      surface: '#303030', accent: '#e0a020', accentLine: '#c08010',
      accent2: '#2060E0', accentLine2: '#1050C0',
    };
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({
        presetId: 'winterDark',
        fontId: 'mincho',
        fontWeightId: 'bold',
        titleFontSizePt: 20,
        metaFontSizePt: 12,
        maxRowsPerPage: 4,
        lyricSizePercent: 130,
        gridNumberSizePercent: 140,
        gridNumberDisplayId: 'none',
        pageNumberFontSizePt: 14,
        sheetLayoutId: 'double',
        scoreInfoDesignId: 'cover',
        mastheadDirectionId: 'right',
        tempoValueModeId: 'custom',
        customTempoValue: 72.5,
        pageMarginId: 'wide',
        gridGapId: 'loose',
        keyNotationId: 'flat',
        keyModeNotationId: 'traditional',
        pageNumberFormatId: 'current',
        pageNumberPositionId: 'bottomOuter',
        runningHeaderId: 'title',
        footerCreditId: 'transcribedBy',
        gridStyleId: 'soft',
        gridStyleCustom: { ...DEFAULT_PDF_GRID_STYLE_CUSTOM, outerRadius: 22 },
        custom,
      }),
    );
    expect(loadPdfPrefs()).toEqual({
      presetId: 'winterDark',
      fontId: 'mincho',
      fontWeightId: 'bold',
      titleFontSizePt: 20,
      metaFontSizePt: 12,
      maxRowsPerPage: 4,
      lyricSizePercent: 130,
      gridNumberSizePercent: 140,
      gridNumberDisplayId: 'none',
      pageNumberFontSizePt: 14,
      sheetLayoutId: 'double',
      scoreInfoDesignId: 'cover',
      mastheadDirectionId: 'right',
      tempoValueModeId: 'custom',
      customTempoValue: 72.5,
      pageMarginId: 'wide',
      gridGapId: 'loose',
      keyNotationId: 'flat',
      keyModeNotationId: 'traditional',
      pageNumberFormatId: 'current',
      pageNumberPositionId: 'bottomOuter',
      runningHeaderId: 'title',
      footerCreditId: 'transcribedBy',
      gridStyleId: 'soft',
      gridStyleCustom: { ...DEFAULT_PDF_GRID_STYLE_CUSTOM, outerRadius: 22 },
      custom,
    });
  });

  it('旧形式のcustomは第1色から第2色を導出して読める', () => {
    const custom = {
      bg: '#101010', ink: '#f0f0f0', line: '#202020',
      surface: '#303030', accent: '#e0a020', accentLine: '#c08010',
    };
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ presetId: CUSTOM_PRESET_ID, custom }),
    );
    expect(loadPdfPrefs().custom).toEqual({
      ...custom,
      accent2: complementHex(custom.accent),
      accentLine2: complementHex(custom.accentLine),
    });
  });

  it('presetId が "custom"（PDF_PRESETSに存在しない）でもそのまま使う', () => {
    localStorage.setItem(PDF_PREFS_STORAGE_KEY, JSON.stringify({ presetId: CUSTOM_PRESET_ID }));
    expect(loadPdfPrefs()).toEqual({ ...DEFAULTS, presetId: CUSTOM_PRESET_ID });
  });

  it('custom の一部キーだけ不正な形式のとき、そのキーだけ既定値に落ちる', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({
        presetId: CUSTOM_PRESET_ID,
        custom: { bg: '#123456', ink: 'not-a-color', line: 12345 },
      }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      presetId: CUSTOM_PRESET_ID,
      custom: { ...PDF_PRESETS.print.seed, bg: '#123456' },
    });
  });

  it('custom が欠落しているとき既定値（printの種色）に落ちる', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ presetId: CUSTOM_PRESET_ID, fontId: 'gothic' }),
    );
    expect(loadPdfPrefs()).toEqual({ ...DEFAULTS, presetId: CUSTOM_PRESET_ID });
  });

  it('custom が壊れた型（配列・文字列）のとき全キーが既定値に落ちる', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ presetId: CUSTOM_PRESET_ID, custom: ['#111111'] }),
    );
    expect(loadPdfPrefs()).toEqual({ ...DEFAULTS, presetId: CUSTOM_PRESET_ID });
  });

  it('存在しないidはそのキーだけ既定値に落ちる', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ presetId: 'doesNotExist', fontId: 'mincho', sheetLayoutId: 'triple' }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      presetId: DEFAULT_PRESET_ID,
      fontId: 'mincho',
      sheetLayoutId: DEFAULT_SHEET_LAYOUT_ID,
    });
  });

  it('壊れたJSONは既定値に落ちる', () => {
    localStorage.setItem(PDF_PREFS_STORAGE_KEY, '{not valid json');
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('null は既定値に落ちる', () => {
    localStorage.setItem(PDF_PREFS_STORAGE_KEY, 'null');
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('配列は既定値に落ちる', () => {
    localStorage.setItem(PDF_PREFS_STORAGE_KEY, JSON.stringify(['print', 'gothic']));
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('型が違う値は既定値に落ちる', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ presetId: 42, fontId: null, sheetLayoutId: 2 }),
    );
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('知らないキーが入っていても、そのキーだけ無視して既知のキーは維持する', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({
        presetId: 'summerLight',
        fontId: 'rounded',
        backgroundImageId: 'sky.png',
      }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      presetId: 'summerLight',
      fontId: 'rounded',
    });
  });

  it('旧バージョン（4キーが無い prefs）を読んでも既定値で動く', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ presetId: 'print', fontId: 'gothic' }),
    );
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('titleFontSizePt/metaFontSizePt/maxRowsPerPageが範囲外のときそのキーだけ既定値に落ちる', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ titleFontSizePt: 999, metaFontSizePt: 1, maxRowsPerPage: 100 }),
    );
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('titleFontSizePt/metaFontSizePt/maxRowsPerPageが範囲の境界値ならそのまま使う', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ titleFontSizePt: 24, metaFontSizePt: 6, maxRowsPerPage: 12 }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      titleFontSizePt: 24,
      metaFontSizePt: 6,
      maxRowsPerPage: 12,
    });
  });

  it('旧既定値の曲名15ptが保存済みなら新しい既定値で上書きしない', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ titleFontSizePt: 15 }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      titleFontSizePt: 15,
    });
  });

  it('titleFontSizePt/metaFontSizePt/maxRowsPerPageが非整数・非数値のときそのキーだけ既定値に落ちる', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ titleFontSizePt: 15.5, metaFontSizePt: '9', maxRowsPerPage: null }),
    );
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('文字設定の境界値はそのまま使う', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({
        fontWeightId: 'bold',
        lyricSizePercent: 70,
        gridNumberSizePercent: 140,
        pageNumberFontSizePt: 8,
      }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      fontWeightId: 'bold',
      lyricSizePercent: 70,
      gridNumberSizePercent: 140,
      pageNumberFontSizePt: 8,
    });
  });

  it('ページ装飾の未知idはキーごとに既定値へ落ちる', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({
        pageNumberFormatId: 'total',
        pageNumberPositionId: 'top',
        runningHeaderId: 'author',
        footerCreditId: 1,
      }),
    );
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('文字設定の不正値はキーごとに既定値へ落ちる', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({
        fontWeightId: 'heavy',
        lyricSizePercent: 131,
        gridNumberSizePercent: 70.5,
        pageNumberFontSizePt: '10',
      }),
    );
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('グリッド番号表示の不正値は他の正常なキーを巻き戻さず既定値へ落とす', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ gridNumberDisplayId: 1, fontId: 'mincho' }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      fontId: 'mincho',
      gridNumberDisplayId: DEFAULT_GRID_NUMBER_DISPLAY_ID,
    });
  });

  it('sheetLayoutId が "double" ならそのまま使う', () => {
    localStorage.setItem(PDF_PREFS_STORAGE_KEY, JSON.stringify({ sheetLayoutId: 'double' }));
    expect(loadPdfPrefs()).toEqual({ ...DEFAULTS, sheetLayoutId: 'double' });
  });

  it('曲情報デザインとマストヘッドの向きを既知idだけ受け付ける', () => {
    for (const scoreInfoDesignId of ['score', 'masthead', 'specSheet', 'cover']) {
      localStorage.setItem(
        PDF_PREFS_STORAGE_KEY,
        JSON.stringify({ scoreInfoDesignId, mastheadDirectionId: 'right' }),
      );
      expect(loadPdfPrefs()).toEqual({
        ...DEFAULTS,
        scoreInfoDesignId,
        mastheadDirectionId: 'right',
      });
    }

    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ scoreInfoDesignId: 'freeform', mastheadDirectionId: 'top' }),
    );
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('旧「形式×位置」を最も近い完成組版へ移行する', () => {
    const cases = [
      [{ scoreInfoFormatId: 'standard', firstPageLayoutId: 'right' }, 'score', 'left'],
      [{ scoreInfoFormatId: 'combined', firstPageLayoutId: 'editorial' }, 'masthead', 'left'],
      [{ scoreInfoFormatId: 'combined', firstPageLayoutId: 'right' }, 'masthead', 'right'],
      [{ scoreInfoFormatId: 'itemized' }, 'specSheet', 'left'],
      [{ scoreInfoFormatId: 'twoColumn' }, 'specSheet', 'left'],
      [{ scoreInfoFormatId: 'itemized', firstPageLayoutId: 'cover' }, 'cover', 'left'],
    ];
    cases.forEach(([legacy, scoreInfoDesignId, mastheadDirectionId]) => {
      localStorage.setItem(PDF_PREFS_STORAGE_KEY, JSON.stringify(legacy));
      expect(loadPdfPrefs()).toEqual({
        ...DEFAULTS,
        scoreInfoDesignId,
        mastheadDirectionId,
      });
    });
  });

  it('♩の値の方式とカスタム値を検証し、旧設定はBPM値÷4へ戻す', () => {
    for (const tempoValueModeId of ['quarter', 'half', 'custom']) {
      localStorage.setItem(
        PDF_PREFS_STORAGE_KEY,
        JSON.stringify({ tempoValueModeId, customTempoValue: 72.25 }),
      );
      expect(loadPdfPrefs()).toEqual({
        ...DEFAULTS,
        tempoValueModeId,
        customTempoValue: 72.25,
      });
    }

    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ tempoValueModeId: 'double', customTempoValue: 1000 }),
    );
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('keyNotationId は既知idを受け付け、未知idを既定値へ戻す', () => {
    for (const keyNotationId of ['both', 'sharp', 'flat']) {
      localStorage.setItem(PDF_PREFS_STORAGE_KEY, JSON.stringify({ keyNotationId }));
      expect(loadPdfPrefs()).toEqual({ ...DEFAULTS, keyNotationId });
    }

    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ keyNotationId: 'auto', fontId: 'mincho' }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      fontId: 'mincho',
      keyNotationId: DEFAULT_KEY_NOTATION_ID,
    });
  });

  it('keyModeNotationId は4つの既知idを受け付け、未知idを短縮表記へ戻す', () => {
    for (const keyModeNotationId of ['compact', 'english', 'japanese', 'traditional']) {
      localStorage.setItem(PDF_PREFS_STORAGE_KEY, JSON.stringify({ keyModeNotationId }));
      expect(loadPdfPrefs()).toEqual({ ...DEFAULTS, keyModeNotationId });
    }

    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ keyModeNotationId: 'german', fontId: 'mincho' }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      fontId: 'mincho',
      keyModeNotationId: DEFAULT_KEY_MODE_NOTATION_ID,
    });
  });

  it('余白・グリッド間隔のidをキーごとに検証する', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ pageMarginId: 'wide', gridGapId: 'tight' }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      pageMarginId: 'wide',
      gridGapId: 'tight',
    });

    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ pageMarginId: 'unknown', gridGapId: 42 }),
    );
    expect(loadPdfPrefs()).toEqual(DEFAULTS);
  });

  it('gridStyleId が "custom" ならそのまま使う', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({ gridStyleId: 'custom', gridStyleCustom: { outerRadius: 30 } }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      gridStyleId: 'custom',
      gridStyleCustom: { ...DEFAULT_PDF_GRID_STYLE_CUSTOM, outerRadius: 30 },
    });
  });

  it('gridStyleId と gridStyleCustom はキーごとにフォールバックする', () => {
    localStorage.setItem(
      PDF_PREFS_STORAGE_KEY,
      JSON.stringify({
        gridStyleId: 'unknown',
        gridStyleCustom: {
          outerRadius: 12,
          cellRadius: 12.5,
          symbolRadius: 8,
          outerStrokeWidth: 2,
          cellStrokeWidth: 0,
          symbolStrokeWidth: 7,
        },
      }),
    );
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      gridStyleCustom: {
        ...DEFAULT_PDF_GRID_STYLE_CUSTOM,
        outerRadius: 12,
        symbolRadius: 8,
        outerStrokeWidth: 2,
      },
    });
  });
});

describe('savePdfPrefs', () => {
  it('PDF設定を保存する', () => {
    const custom = {
      bg: '#101010', ink: '#f0f0f0', line: '#202020',
      surface: '#303030', accent: '#e0a020', accentLine: '#c08010',
      accent2: '#2060E0', accentLine2: '#1050C0',
    };
    savePdfPrefs({
      presetId: 'autumnDark',
      fontId: 'mincho',
      fontWeightId: 'bold',
      titleFontSizePt: 18,
      metaFontSizePt: 10,
      maxRowsPerPage: 5,
      lyricSizePercent: 120,
      gridNumberSizePercent: 130,
      gridNumberDisplayId: 'none',
      pageNumberFontSizePt: 12,
      sheetLayoutId: 'double',
      scoreInfoDesignId: 'masthead',
      mastheadDirectionId: 'right',
      tempoValueModeId: 'custom',
      customTempoValue: 64.5,
      pageMarginId: 'narrow',
      gridGapId: 'loose',
      keyNotationId: 'sharp',
      keyModeNotationId: 'english',
      pageNumberFormatId: 'current',
      pageNumberPositionId: 'bottomOuter',
      runningHeaderId: 'title',
      footerCreditId: 'transcribedBy',
      gridStyleId: 'bold',
      gridStyleCustom: {
        ...DEFAULT_PDF_GRID_STYLE_CUSTOM,
        symbolRadius: 8,
        symbolStrokeWidth: 5,
      },
      custom,
    });
    expect(JSON.parse(localStorage.getItem(PDF_PREFS_STORAGE_KEY))).toEqual({
      presetId: 'autumnDark',
      fontId: 'mincho',
      fontWeightId: 'bold',
      titleFontSizePt: 18,
      metaFontSizePt: 10,
      maxRowsPerPage: 5,
      lyricSizePercent: 120,
      gridNumberSizePercent: 130,
      gridNumberDisplayId: 'none',
      pageNumberFontSizePt: 12,
      sheetLayoutId: 'double',
      scoreInfoDesignId: 'masthead',
      mastheadDirectionId: 'right',
      tempoValueModeId: 'custom',
      customTempoValue: 64.5,
      pageMarginId: 'narrow',
      gridGapId: 'loose',
      keyNotationId: 'sharp',
      keyModeNotationId: 'english',
      pageNumberFormatId: 'current',
      pageNumberPositionId: 'bottomOuter',
      runningHeaderId: 'title',
      footerCreditId: 'transcribedBy',
      gridStyleId: 'bold',
      gridStyleCustom: {
        ...DEFAULT_PDF_GRID_STYLE_CUSTOM,
        symbolRadius: 8,
        symbolStrokeWidth: 5,
      },
      custom,
    });
  });

  it('保存の失敗（容量超過等）を例外を投げずに握り潰す', () => {
    globalThis.localStorage = {
      ...globalThis.localStorage,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() =>
      savePdfPrefs({
        presetId: 'print',
        fontId: 'gothic',
        titleFontSizePt: 15,
        metaFontSizePt: 9,
        maxRowsPerPage: 6,
        sheetLayoutId: 'single',
        gridStyleId: DEFAULT_PDF_GRID_STYLE_ID,
        gridStyleCustom: DEFAULT_PDF_GRID_STYLE_CUSTOM,
        custom: PDF_PRESETS.print.seed,
      }),
    ).not.toThrow();
  });

  it('新しい表示設定をload-save-loadで保持し、背景画像は保存しない', () => {
    const prefs = {
      ...DEFAULTS,
      gridNumberDisplayId: 'none',
      backgroundImage: { dataUrl: 'data:image/jpeg;base64,ignored', width: 10, height: 10 },
    };
    savePdfPrefs(prefs);
    const stored = JSON.parse(localStorage.getItem(PDF_PREFS_STORAGE_KEY));

    expect(stored.gridNumberDisplayId).toBe('none');
    expect(stored).not.toHaveProperty('backgroundImage');
    expect(loadPdfPrefs()).toEqual({
      ...DEFAULTS,
      gridNumberDisplayId: 'none',
    });
  });
});
