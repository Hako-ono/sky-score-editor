import { useMemo, useRef, useState, useEffect } from 'react';
import {
  KEY_MODES,
  KEY_NOTATIONS,
  KEY_MODE_NOTATIONS,
  keyDisplayName,
  keyModeNotationLabel,
  hasEnharmonicKeyName,
  DEFAULT_BPM,
  MAX_METADATA_LENGTH,
  PDF_PRESETS,
  PDF_FONTS,
  PDF_FONT_WEIGHTS,
  PDF_LAYOUT_RANGES,
  PDF_GRID_NUMBER_DISPLAYS,
  PDF_SHEET_LAYOUTS,
  PDF_COLUMNS_PER_PAGE,
  PDF_ROW_SHADINGS,
  PDF_SCORE_INFO_DESIGNS,
  PDF_MASTHEAD_DIRECTIONS,
  PDF_TEMPO_VALUE_MODES,
  PDF_CUSTOM_TEMPO_VALUE_RANGE,
  sanitizeCustomTempoValue,
  PDF_PAGE_MARGINS,
  PDF_GRID_GAPS,
  PDF_PAGE_NUMBER_FORMATS,
  PDF_PAGE_NUMBER_POSITIONS,
  PDF_RUNNING_HEADERS,
  PDF_FOOTER_CREDITS,
  CUSTOM_PRESET_ID,
  DEFAULT_CUSTOM_SEED,
  sanitizeCustomSeed,
  isDarkSeedBg,
  contrastRatio,
  deriveSeedFromSimple,
  resolvePaletteSeed,
  MOBILE_MEDIA_QUERY,
} from '../constants/config.js';
import {
  DEFAULT_PDF_GRID_STYLE_CUSTOM,
  PDF_GRID_STYLES,
  PDF_GRID_STYLE_CUSTOM_RANGES,
  resolvePdfGridStyle,
  sanitizePdfGridStyleCustom,
} from '../lib/pdfGridStyle.js';
import {
  BACKGROUND_IMAGE_OPACITY_MIN,
  BACKGROUND_IMAGE_OPACITY_MAX,
  BACKGROUND_IMAGE_OPACITY_STEP,
} from '../lib/backgroundImage.js';
import { resolveColumnsPerPage } from '../lib/layout.js';
import { ChevronIcon } from './icons.jsx';

// カスタム配色の入力ラベル。簡易モードで見せる3つ（bg/ink/line）を先頭に置く
// 順序にしてある。
const CUSTOM_SEED_LABELS = {
  bg: '背景',
  ink: '文字',
  line: '線',
  surface: '鍵面',
};
const CUSTOM_SEED_SIMPLE_KEYS = ['bg', 'ink', 'line'];
const CUSTOM_SEED_DETAIL_KEYS_SINGLE = ['surface', 'accent', 'accentLine'];
const CUSTOM_SEED_DETAIL_KEYS_TWO = [
  ...CUSTOM_SEED_DETAIL_KEYS_SINGLE,
  'accent2',
  'accentLine2',
];

export function getCustomSeedDetailKeys(usesTwoLayers) {
  return usesTwoLayers ? CUSTOM_SEED_DETAIL_KEYS_TWO : CUSTOM_SEED_DETAIL_KEYS_SINGLE;
}

export function getCustomSeedLabel(key, usesTwoLayers) {
  if (usesTwoLayers && key === 'accent') return '押鍵面1';
  if (usesTwoLayers && key === 'accentLine') return '押鍵枠1';
  if (key === 'accent2') return '押鍵面2';
  if (key === 'accentLine2') return '押鍵枠2';
  if (key === 'accent') return '押鍵面';
  if (key === 'accentLine') return '押鍵枠';
  return CUSTOM_SEED_LABELS[key];
}

const PDF_GRID_STYLE_CUSTOM_LABELS = {
  outerRadius: '外枠の角丸',
  cellRadius: '鍵盤の角丸',
  symbolRadius: '記号の角丸',
  outerStrokeWidth: '外枠の線幅',
  cellStrokeWidth: '鍵盤の線幅',
  symbolStrokeWidth: '記号の線幅',
};

const PDF_GRID_STYLE_CUSTOM_GROUPS = [
  { title: '角丸', keys: ['outerRadius', 'cellRadius', 'symbolRadius'] },
  { title: '線幅', keys: ['outerStrokeWidth', 'cellStrokeWidth', 'symbolStrokeWidth'] },
];

const PDF_SECTION_KEYS = ['design', 'typography', 'score-info', 'page', 'paper'];
const THEME_LABELS = { system: 'システム', light: 'ライト', dark: 'ダーク' };

function SegmentedRadioField({
  className = '',
  legend,
  ariaLabel,
  name,
  value,
  options,
  onChange,
}) {
  return (
    <fieldset className={`toolbar__segmented-field field field--stack field--compact ${className}`.trim()}>
      <legend>{legend}</legend>
      <div className="toolbar__segmented-options" role="radiogroup" aria-label={ariaLabel}>
        {Object.entries(options).map(([id, option]) => (
          <label className="toolbar__segmented-option" key={id}>
            <input
              type="radio"
              name={name}
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function Toolbar({
  hasData,
  isProcessing,
  editMode,
  canUndo,
  canRedo,
  isDirty,
  title,
  author,
  lyricist,
  transcribedBy,
  bitsPerPage,
  bpm,
  pitchLevel,
  keyMode,
  theme,
  fileName,
  pdfPrefs,
  onSetPdfPrefs,
  backgroundImage,
  backgroundImageOpacity,
  onLoadBackgroundImage,
  onSetBackgroundImageOpacity,
  onRemoveBackgroundImage,
  onLoadFile,
  onNewScore,
  onClear,
  onSetTitle,
  onSetAuthor,
  onSetLyricist,
  onSetTranscribedBy,
  onSetBitsPerPage,
  onSetBpm,
  onSetPitchLevel,
  onSetKeyMode,
  onUndo,
  onRedo,
  onToggleEdit,
  onToggleLayer,
  usesTwoLayers,
  onSaveJson,
  onExportPdf,
  onOpenPdfPreset,
  onSetTheme,
}) {
  // 狭い画面では展開したツールバーが数画面分の高さを占め、楽譜まで
  // スクロールしないと辿り着けなくなるため、初期状態を縮小にしておく。
  // 以後は利用者の操作に従うだけで、画面幅の変化では切り替えない。
  const [isMinimized, setIsMinimized] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches,
  );
  const [activeTab, setActiveTab] = useState('score');
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches,
  );
  const [pdfSectionsOpen, setPdfSectionsOpen] = useState(() => {
    const isMobile = typeof window !== 'undefined'
      && window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    return {
      design: true,
      typography: !isMobile,
      'score-info': !isMobile,
      page: !isMobile,
      paper: !isMobile,
    };
  });
  const tabRefs = useRef({ score: null, pdf: null });
  const tabOrder = ['score', 'pdf'];
  const themeMenuRef = useRef(null);
  const themeTriggerRef = useRef(null);
  const themeItemRefs = useRef({});
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', updateViewport);
    else mediaQuery.addListener(updateViewport);
    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', updateViewport);
      else mediaQuery.removeListener(updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport) {
      setPdfSectionsOpen(Object.fromEntries(PDF_SECTION_KEYS.map((key) => [key, true])));
    }
  }, [isMobileViewport]);

  const togglePdfSection = (section) => {
    if (!isMobileViewport) return;
    setPdfSectionsOpen((current) => ({ ...current, [section]: !current[section] }));
  };

  const isPdfSectionOpen = (section) => !isMobileViewport || pdfSectionsOpen[section];

  const renderPdfSectionHeading = (section, title) => {
    const headingId = `toolbar-group-pdf-${section}`;
    const panelId = `toolbar-panel-pdf-${section}`;
    return (
      <h2 className="toolbar__section-title" id={headingId}>
        {isMobileViewport ? (
          <button
            type="button"
            className="toolbar__section-toggle"
            aria-controls={panelId}
            aria-expanded={isPdfSectionOpen(section)}
            onClick={() => togglePdfSection(section)}
          >
            <span className="toolbar__section-toggle-label">{title}</span>
            <span className="toolbar__section-toggle-icon" aria-hidden="true">
              <ChevronIcon direction={isPdfSectionOpen(section) ? 'up' : 'down'} size={14} />
            </span>
          </button>
        ) : title}
      </h2>
    );
  };

  const selectTab = (tab, shouldFocus = false) => {
    if (activeTab === 'pdf' && tab !== 'pdf') setImageMenuOpen(false);
    setActiveTab(tab);
    if (shouldFocus) tabRefs.current[tab]?.focus();
  };

  const handleTabKeyDown = (e) => {
    const currentIndex = tabOrder.indexOf(activeTab);
    let nextIndex;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabOrder.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabOrder.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    selectTab(tabOrder[nextIndex], true);
  };

  useEffect(() => {
    if (!themeMenuOpen) return undefined;
    const selectedItem = themeItemRefs.current[theme];
    selectedItem?.focus();
    const handleOutsideClick = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setThemeMenuOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setThemeMenuOpen(false);
        themeTriggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [themeMenuOpen, theme]);

  const handleThemeMenuKeyDown = (e) => {
    const preferences = Object.keys(THEME_LABELS);
    if (e.key === 'Escape') {
      e.preventDefault();
      setThemeMenuOpen(false);
      themeTriggerRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      setThemeMenuOpen(false);
      return;
    }
    const focusedIndex = preferences.findIndex(
      (preference) => themeItemRefs.current[preference] === document.activeElement,
    );
    const currentIndex = focusedIndex >= 0 ? focusedIndex : preferences.indexOf(theme);
    let nextIndex;
    if (e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % preferences.length;
    else if (e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + preferences.length) % preferences.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = preferences.length - 1;
    else return;
    e.preventDefault();
    themeItemRefs.current[preferences[nextIndex]]?.focus();
  };

  // 背景画像プレビューの「変更」「外す」メニュー。プレビューアイコンを
  // タップして開閉する（以前は常時ボタン2つを並べていた）
  const bgFileInputRef = useRef(null);
  const imageMenuRef = useRef(null);
  const [imageMenuOpen, setImageMenuOpen] = useState(false);

  useEffect(() => {
    if (!imageMenuOpen) return undefined;
    const handleOutsideClick = (e) => {
      if (imageMenuRef.current && !imageMenuRef.current.contains(e.target)) {
        setImageMenuOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setImageMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [imageMenuOpen]);

  const [localBpm, setLocalBpm] = useState(bpm.toString());

  useEffect(() => {
    setLocalBpm(bpm.toString());
  }, [bpm]);

  const handleBpmBlur = () => {
    let v = parseInt(localBpm, 10);
    if (Number.isNaN(v) || v <= 0) v = DEFAULT_BPM;
    if (v > 999) v = 999;
    setLocalBpm(v.toString());
    onSetBpm(v);
  };

  // PDF数値設定は入力中だけ文字列で保持し、確定時に共通範囲へ丸める。
  // BPM欄と同じく、入力中は自由な文字列を許し、確定時（blur/Enter）だけ
  // 範囲内の整数へ丸める（onChangeで即座に丸めると、範囲外の桁を
  // 入力している途中の値が弾かれて入力し続けられなくなる）。
  const [localTitleFontSize, setLocalTitleFontSize] = useState(
    pdfPrefs.titleFontSizePt.toString(),
  );
  const [localMetaFontSize, setLocalMetaFontSize] = useState(
    pdfPrefs.metaFontSizePt.toString(),
  );
  const [localLyricSizePercent, setLocalLyricSizePercent] = useState(
    pdfPrefs.lyricSizePercent.toString(),
  );
  const [localPageNumberFontSize, setLocalPageNumberFontSize] = useState(
    pdfPrefs.pageNumberFontSizePt.toString(),
  );
  const [localMaxRows, setLocalMaxRows] = useState(pdfPrefs.maxRowsPerPage.toString());
  const [localCustomTempoValue, setLocalCustomTempoValue] = useState(
    pdfPrefs.customTempoValue.toString(),
  );

  useEffect(() => {
    setLocalTitleFontSize(pdfPrefs.titleFontSizePt.toString());
  }, [pdfPrefs.titleFontSizePt]);
  useEffect(() => {
    setLocalMetaFontSize(pdfPrefs.metaFontSizePt.toString());
  }, [pdfPrefs.metaFontSizePt]);
  useEffect(() => {
    setLocalLyricSizePercent(pdfPrefs.lyricSizePercent.toString());
  }, [pdfPrefs.lyricSizePercent]);
  useEffect(() => {
    setLocalPageNumberFontSize(pdfPrefs.pageNumberFontSizePt.toString());
  }, [pdfPrefs.pageNumberFontSizePt]);
  useEffect(() => {
    setLocalMaxRows(pdfPrefs.maxRowsPerPage.toString());
  }, [pdfPrefs.maxRowsPerPage]);
  useEffect(() => {
    setLocalCustomTempoValue(pdfPrefs.customTempoValue.toString());
  }, [pdfPrefs.customTempoValue]);

  const commitLayoutNumber = (key, localValue, setLocalValue) => {
    const range = PDF_LAYOUT_RANGES[key];
    let v = parseInt(localValue, 10);
    if (Number.isNaN(v)) v = pdfPrefs[key];
    v = Math.min(range.max, Math.max(range.min, v));
    setLocalValue(v.toString());
    onSetPdfPrefs({ ...pdfPrefs, [key]: v });
  };

  const commitCustomTempoValue = () => {
    const value = sanitizeCustomTempoValue(localCustomTempoValue);
    setLocalCustomTempoValue(value.toString());
    onSetPdfPrefs({ ...pdfPrefs, customTempoValue: value });
  };

  // 「拍子に合わせる」が示す実際の列数を、PDF出力と同じ関数から出す。
  const autoColumns = resolveColumnsPerPage('auto', bitsPerPage);
  // 同じ結果になる固定列（4拍子なら「4列」）は選択肢から省くが、保存済みの
  // 設定がその固定列のときだけは残す。消すとselectの選択が外れて空欄に見え、
  // 実際に保存されている値と画面が食い違うため。
  const columnsPerPageOptions = useMemo(
    () => Object.entries(PDF_COLUMNS_PER_PAGE).filter(
      ([id, option]) => option.columns !== autoColumns || pdfPrefs.columnsPerPageId === id,
    ),
    [autoColumns, pdfPrefs.columnsPerPageId],
  );

  const isCustomPreset = pdfPrefs.presetId === CUSTOM_PRESET_ID;
  // 詳細色を編集する状態は、そのページを開いている間だけ保持する。
  const [isCustomDetailEditing, setIsCustomDetailEditing] = useState(false);
  // pdfPrefs.custom は pdfPrefs.js 側で既に検証済みだが、壊れたJSONを
  // 直接localStorageへ書き込まれた場合等への保険としてここでも検証する。
  const customSeed = useMemo(() => sanitizeCustomSeed(pdfPrefs.custom), [pdfPrefs.custom]);
  // 出力（pdfExport.js）と同じルールで実効seedを求める。以前はスウォッチ・
  // 入力欄が独自に種色を再実装しており、スウォッチだけ反映されない不整合が
  // あった。resolvePaletteSeedに一本化する
  const effectiveSeed = useMemo(
    () =>
      resolvePaletteSeed({
        presetId: pdfPrefs.presetId,
        custom: pdfPrefs.custom,
      }),
    [pdfPrefs.presetId, pdfPrefs.custom],
  );
  const resolvedGridStyle = useMemo(
    () =>
      resolvePdfGridStyle({
        gridStyleId: pdfPrefs.gridStyleId,
        gridStyleCustom: pdfPrefs.gridStyleCustom,
      }),
    [pdfPrefs.gridStyleId, pdfPrefs.gridStyleCustom],
  );
  const gridStyleCustom = useMemo(
    () => sanitizePdfGridStyleCustom(pdfPrefs.gridStyleCustom),
    [pdfPrefs.gridStyleCustom],
  );
  const showDarkNote = isDarkSeedBg(effectiveSeed.bg);
  const showMinchoNote = pdfPrefs.fontId === 'mincho';
  const showKeyNotation = hasEnharmonicKeyName(pitchLevel, keyMode);
  // 警告であって禁止ではない（出力は止めない）。本文の読みやすさの下限4.5を
  // 下回ったときだけ知らせる。判定は保存値ではなく effectiveSeed（実際に
  // 出力される色）で行う
  const showContrastWarning =
    isCustomPreset && contrastRatio(effectiveSeed.bg, effectiveSeed.ink) < 4.5;

  const setCustomSeedColor = (key, value) => {
    if (key === 'bg' || key === 'line') {
      // 簡易モードのbg/lineを変えたらsurfaceも追従させる。inkの
      // 変更では呼ばない（詳細モードで手で調整したsurfaceを、無関係な
      // ink変更のたびに上書きしないため）
      const nextSimple = { bg: customSeed.bg, ink: customSeed.ink, line: customSeed.line, [key]: value };
      const derived = deriveSeedFromSimple(nextSimple, customSeed);
      onSetPdfPrefs({ ...pdfPrefs, custom: { ...customSeed, ...derived } });
      return;
    }
    onSetPdfPrefs({ ...pdfPrefs, custom: { ...customSeed, [key]: value } });
  };

  const customSeedDetailKeys = getCustomSeedDetailKeys(usesTwoLayers);

  const setGridStyleCustomValue = (key, value) => {
    onSetPdfPrefs({
      ...pdfPrefs,
      gridStyleCustom: { ...gridStyleCustom, [key]: Number(value) },
    });
  };

  return (
    <header className="toolbar">
      {/* 1行目: ファイル操作やテーマ・最小化ボタン（常に表示） */}
      <div className="toolbar__row toolbar__row--primary">
        <h1 className="toolbar__brand">
          <span className="toolbar__brand-latin">Sky</span>
          <span className="toolbar__brand-jp">楽譜エディター</span>
        </h1>
        <span className="v-sep" aria-hidden="true" />
        <div className="toolbar__group">
          <label className="btn btn--ghost file-label">
            楽譜を開く
            <input
              type="file"
              accept=".json,.txt,application/json,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onLoadFile(file);
                event.target.value = '';
              }}
              hidden
            />
          </label>
          <button type="button" className="btn btn--ghost" onClick={onNewScore}>
            新規作成
          </button>
          <span
            className={`file-name${fileName ? '' : ' file-name--empty'}`}
            title={fileName}
          >
            {fileName || '未読み込み'}
          </span>
        </div>

        <div className="toolbar__group toolbar__group--right">
          <div className="theme-menu" ref={themeMenuRef}>
            <button
              ref={themeTriggerRef}
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                if (themeMenuOpen) themeTriggerRef.current?.focus();
                setThemeMenuOpen(!themeMenuOpen);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && !themeMenuOpen) {
                  event.preventDefault();
                  setThemeMenuOpen(true);
                }
              }}
              aria-haspopup="menu"
              aria-expanded={themeMenuOpen}
              aria-controls="toolbar-theme-menu"
              aria-label="表示テーマを選ぶ"
              title="表示テーマを選ぶ"
            >
              {THEME_LABELS[theme]}
            </button>
            {themeMenuOpen && (
              <div id="toolbar-theme-menu" className="theme-menu__panel" role="menu" aria-label="表示テーマ">
                {Object.entries(THEME_LABELS).map(([preference, label]) => (
                  <button
                    key={preference}
                    ref={(element) => {
                      themeItemRefs.current[preference] = element;
                    }}
                    type="button"
                    role="menuitemradio"
                    className="theme-menu__item"
                    aria-checked={theme === preference}
                    aria-label={theme === preference ? `${label}（現在のテーマ）` : `${label}に切り替える`}
                    title={theme === preference ? `${label}（現在のテーマ）` : `${label}に切り替える`}
                    onClick={() => {
                      onSetTheme(preference);
                      setThemeMenuOpen(false);
                      themeTriggerRef.current?.focus();
                    }}
                    onKeyDown={handleThemeMenuKeyDown}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* テーマ選択はアプリ設定、開閉はこのパネル自身の操作で意味が違う */}
          <span className="v-sep" aria-hidden="true" />
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => setIsMinimized(!isMinimized)}
            aria-expanded={!isMinimized}
            aria-label={isMinimized ? 'ツールバーを展開' : 'ツールバーを最小化'}
            title={isMinimized ? 'メニューを展開' : 'メニューを最小化'}
          >
            {isMinimized ? '展開' : '縮小'}
            <ChevronIcon direction={isMinimized ? 'down' : 'up'} size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="toolbar__tabs" role="tablist" aria-label="ツールバー">
            <button
              ref={(element) => {
                tabRefs.current.score = element;
              }}
              type="button"
              className="toolbar__tab"
              id="toolbar-tab-score"
              role="tab"
              aria-selected={activeTab === 'score'}
              aria-controls="toolbar-panel-score"
              tabIndex={activeTab === 'score' ? 0 : -1}
              onClick={() => selectTab('score')}
              onKeyDown={handleTabKeyDown}
            >
              楽譜
            </button>
            <button
              ref={(element) => {
                tabRefs.current.pdf = element;
              }}
              type="button"
              className="toolbar__tab"
              id="toolbar-tab-pdf"
              role="tab"
              aria-selected={activeTab === 'pdf'}
              aria-controls="toolbar-panel-pdf"
              tabIndex={activeTab === 'pdf' ? 0 : -1}
              onClick={() => selectTab('pdf')}
              onKeyDown={handleTabKeyDown}
            >
              PDF出力
            </button>
          </div>

          <div
            className="toolbar__tabpanel toolbar__settings-grid toolbar__settings-grid--score"
            id="toolbar-panel-score"
            role="tabpanel"
            aria-labelledby="toolbar-tab-score"
            hidden={activeTab !== 'score'}
          >
          <section className="toolbar__section toolbar__section--score-info" aria-labelledby="toolbar-group-score-info">
            <h2 className="toolbar__section-title" id="toolbar-group-score-info">曲情報</h2>
          {/* 曲情報 (タイトル、作曲者、作詞者、譜面作成者) */}
          <div className="toolbar__info-grid">
            <div className="toolbar__group field field--stack field--title">
              <label htmlFor="score-title">曲名</label>
              <input
                id="score-title"
                type="text"
                className="text-input"
                value={title || ''}
                placeholder="曲名"
                maxLength={MAX_METADATA_LENGTH}
                onChange={(e) => onSetTitle(e.target.value)}
              />
            </div>
            <div className="toolbar__group field field--stack">
              <label htmlFor="score-author">作曲者</label>
              <input
                id="score-author"
                type="text"
                className="text-input"
                value={author || ''}
                placeholder="作曲者"
                maxLength={MAX_METADATA_LENGTH}
                onChange={(e) => onSetAuthor(e.target.value)}
              />
            </div>
            <div className="toolbar__group field field--stack">
              <label htmlFor="score-lyricist">作詞者</label>
              <input
                id="score-lyricist"
                type="text"
                className="text-input"
                value={lyricist || ''}
                placeholder="作詞者"
                maxLength={MAX_METADATA_LENGTH}
                onChange={(e) => onSetLyricist(e.target.value)}
              />
            </div>
            <div className="toolbar__group field field--stack">
              <label htmlFor="score-transcribed">作成者</label>
              <input
                id="score-transcribed"
                type="text"
                className="text-input"
                value={transcribedBy || ''}
                placeholder="譜面作成者"
                maxLength={MAX_METADATA_LENGTH}
                onChange={(e) => onSetTranscribedBy(e.target.value)}
              />
            </div>
          </div>
          </section>

          <section className="toolbar__section toolbar__section--score-playback" aria-labelledby="toolbar-group-score-playback">
            <h2 className="toolbar__section-title" id="toolbar-group-score-playback">演奏設定</h2>
          {/* 音楽設定（1行目: BPM/拍子、2行目: キー/調性） */}
          <div className="toolbar__playback-grid">
            <div className="toolbar__group field field--stack field--compact field--bpm">
              <label htmlFor="score-bpm">BPM</label>
              <input
                id="score-bpm"
                type="number"
                className="text-input"
                min="1"
                max="999"
                value={localBpm}
                onChange={(e) => setLocalBpm(e.target.value)}
                onBlur={handleBpmBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBpmBlur();
                  }
                }}
              />
            </div>
            <div className="toolbar__group field field--stack field--compact">
              <label htmlFor="score-bits">拍子</label>
              <select
                id="score-bits"
                className="text-input"
                value={bitsPerPage}
                onChange={(e) => onSetBitsPerPage(e.target.value)}
              >
                <option value={16}>4拍子</option>
                <option value={12}>3拍子</option>
                <option value={4}>なし(未設定)</option>
              </select>
            </div>
            {/* キー設定 */}
            <div className="toolbar__group field field--stack field--compact field--pitch">
              <label htmlFor="score-pitch">キー</label>
              <select
                id="score-pitch"
                className="text-input"
                value={pitchLevel}
                onChange={(e) => onSetPitchLevel(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {keyDisplayName(i, keyMode)}
                  </option>
                ))}
              </select>
            </div>
            <div className="toolbar__group field field--stack field--compact">
              <label htmlFor="score-key-mode">調性</label>
              <select
                id="score-key-mode"
                className="text-input"
                value={keyMode}
                onChange={(e) => onSetKeyMode(e.target.value)}
              >
                {Object.entries(KEY_MODES).map(([id, mode]) => (
                  <option key={id} value={id}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          </section>

          <section className="toolbar__section toolbar__section--score-actions" aria-labelledby="toolbar-group-score-actions">
            <h2 className="toolbar__section-title" id="toolbar-group-score-actions">編集・保存</h2>
          {/* 3行目: 編集操作 */}
          <div className="toolbar__action-bar toolbar__action-bar--score">
            <div className="toolbar__action-cluster toolbar__action-cluster--history">
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="元に戻す"
                title="元に戻す (Ctrl+Z)"
              >
                元に戻す
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label="やり直す"
                title="やり直す (Ctrl+Shift+Z)"
              >
                やり直す
              </button>
            </div>
            <div className="toolbar__action-cluster toolbar__action-cluster--edit">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onToggleLayer}
                title="レイヤー切り替え"
              >
                レイヤー切り替え
              </button>
              {/* 橙はモードに入っている最中だけに使う。入る前も橙だと、
                  可逆な操作が破壊的な操作に見える */}
              <button
                type="button"
                className={`btn ${editMode ? 'btn--warning-active' : 'btn--ghost'}`}
                onClick={onToggleEdit}
                disabled={isProcessing}
                aria-pressed={editMode}
              >
                {editMode ? 'グリッド編集を終了' : 'グリッドの追加/削除'}
              </button>
              {hasData && (
                <>
                  <span className="toolbar__action-separator" aria-hidden="true" />
                <button
                  type="button"
                  className="btn btn--sm btn--danger-ghost"
                  onClick={onClear}
                >
                  全消去
                </button>
                </>
              )}
            </div>
            <div className="toolbar__action-cluster toolbar__action-cluster--save">
              <button
                type="button"
                className="btn btn--success"
                onClick={onSaveJson}
                disabled={isProcessing || !hasData}
                title={isDirty ? '未保存の変更があります' : undefined}
              >
                JSONを保存
                {isDirty && <span className="btn__dot" aria-hidden="true" />}
              </button>
            </div>
          </div>
          </section>
          </div>

          {/* 4行目: PDF出力の配色・書体。楽譜の属性ではなく出力側の好みなので
              曲情報・音楽設定とは別の行にし、楽譜JSONにも入れない */}
          <div
            className="toolbar__tabpanel toolbar__settings-grid toolbar__settings-grid--pdf"
            id="toolbar-panel-pdf"
            role="tabpanel"
            aria-labelledby="toolbar-tab-pdf"
            hidden={activeTab !== 'pdf'}
          >
          <section className="toolbar__section toolbar__section--pdf-design" aria-labelledby="toolbar-group-pdf-design">
            {renderPdfSectionHeading('design', 'デザイン')}
            <div
              className="toolbar__section-panel"
              id="toolbar-panel-pdf-design"
              hidden={!isPdfSectionOpen('design')}
            >
            <div className="toolbar__design-grid">
            <div className="toolbar__design-column toolbar__design-column--colors">
            <h3 className="toolbar__subsection-title">色と背景</h3>
          <div className="toolbar__appearance-basics">
            <div className="toolbar__group field field--stack field--compact toolbar__palette-field">
              <label htmlFor="pdf-preset">配色</label>
              <select
                id="pdf-preset"
                className="text-input"
                value={pdfPrefs.presetId}
                onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, presetId: e.target.value })}
              >
                <optgroup label="標準">
                  <option value="print">{PDF_PRESETS.print.label}</option>
                </optgroup>
                <optgroup label="四季・明">
                  <option value="springLight">{PDF_PRESETS.springLight.label}</option>
                  <option value="summerLight">{PDF_PRESETS.summerLight.label}</option>
                  <option value="autumnLight">{PDF_PRESETS.autumnLight.label}</option>
                  <option value="winterLight">{PDF_PRESETS.winterLight.label}</option>
                </optgroup>
                {/* 暗色4種が印刷向けでないことを、選ぶ前に伝えるためグループ名で区別する */}
                <optgroup label="四季・暗">
                  <option value="springDark">{PDF_PRESETS.springDark.label}</option>
                  <option value="summerDark">{PDF_PRESETS.summerDark.label}</option>
                  <option value="autumnDark">{PDF_PRESETS.autumnDark.label}</option>
                  <option value="winterDark">{PDF_PRESETS.winterDark.label}</option>
                </optgroup>
                <optgroup label="カスタム">
                  <option value={CUSTOM_PRESET_ID}>カスタム</option>
                </optgroup>
              </select>
            </div>

            <div className="toolbar__palette-panel">
              <div className="toolbar__palette-panel-header">
                <h3>使用色</h3>
                {isCustomPreset && (
                  <div className="toolbar__palette-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      aria-pressed={isCustomDetailEditing}
                      onClick={() => setIsCustomDetailEditing((value) => !value)}
                    >
                      {isCustomDetailEditing ? '編集を終了' : '詳細色を編集'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() =>
                        onSetPdfPrefs({ ...pdfPrefs, custom: { ...DEFAULT_CUSTOM_SEED } })
                      }
                    >
                      既定の色に戻す
                    </button>
                  </div>
                )}
              </div>

              <div className="toolbar__palette-groups">
                {[
                  {
                    title: '基本色',
                    description: isCustomPreset ? '色面を選択して変更' : '',
                    keys: CUSTOM_SEED_SIMPLE_KEYS,
                    editable: isCustomPreset,
                  },
                  {
                    title: '詳細色',
                    description: isCustomPreset ? (isCustomDetailEditing ? '色面を選択して変更' : '表示のみ') : '',
                    keys: customSeedDetailKeys,
                    editable: isCustomPreset && isCustomDetailEditing,
                  },
                ].map(({ title: groupTitle, description, keys, editable }) => (
                  <div
                    className={`toolbar__palette-group${keys.includes('accent2') ? ' toolbar__palette-group--two-layer' : ''}`}
                    key={keys[0]}
                  >
                    <div className="toolbar__palette-group-header">
                      <h4>{groupTitle}</h4>
                      {description && <span>{description}</span>}
                    </div>
                    <div className="toolbar__palette-strip">
                      {keys.map((key) => (
                        <div
                          className={`toolbar__palette-segment${editable ? ' is-editable' : ''}`}
                          key={key}
                          style={{ background: effectiveSeed[key] }}
                        >
                          {editable && (
                            <input
                              id={`pdf-custom-${key}`}
                              type="color"
                              className="toolbar__palette-color-input"
                              value={customSeed[key]}
                              onChange={(e) => setCustomSeedColor(key, e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="toolbar__palette-labels">
                      {keys.map((key) => {
                        const Label = editable ? 'label' : 'span';
                        return (
                          <Label
                            {...(editable ? { htmlFor: `pdf-custom-${key}` } : {})}
                            key={key}
                          >
                            {getCustomSeedLabel(key, usesTwoLayers)}
                          </Label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 背景画像は背景色の上に重ねて描かれ、見え方が配色と一体で
                決まるため、書体や面付けではなく配色設定として扱う */}
            <div
              className={`toolbar__background-controls${backgroundImage ? '' : ' toolbar__background-controls--empty'}`}
            >
              <div className="toolbar__group field field--stack field--compact toolbar__background-field">
                {/* htmlFor を付けない。付けると見出しの文字をクリックしただけで
                    ファイル選択画面が開いてしまう（隠しinputが関連付けの相手に
                    なるため）。実際の操作は下のボタンとメニューが受け持つ */}
                {/* 常に1つだけ存在する隠しinput。「選ぶ」ボタンと、画像がある
                    ときのメニュー内「変更」の両方からrefで開く */}
                <input
                  ref={bgFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onLoadBackgroundImage(file);
                    e.target.value = '';
                  }}
                  hidden
                />
                {!backgroundImage && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm pdf-bg-control"
                    onClick={() => bgFileInputRef.current?.click()}
                    aria-label="背景画像を選択"
                  >
                    背景画像を選択
                  </button>
                )}
                {backgroundImage && (
                  <div
                    className={`pdf-bg-menu pdf-bg-menu--${pdfPrefs.sheetLayoutId === 'double' ? 'double' : 'single'} pdf-bg-control`}
                    ref={imageMenuRef}
                  >
                    <button
                      type="button"
                      className="pdf-bg-menu__trigger"
                      onClick={() => setImageMenuOpen((v) => !v)}
                      aria-haspopup="true"
                      aria-expanded={imageMenuOpen}
                      aria-label="背景画像を変更または外す"
                    >
                      <img src={backgroundImage.dataUrl} alt="背景画像のプレビュー" />
                    </button>
                    {imageMenuOpen && (
                      <div className="pdf-bg-menu__panel" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="pdf-bg-menu__item"
                          onClick={() => {
                            setImageMenuOpen(false);
                            bgFileInputRef.current?.click();
                          }}
                        >
                          変更
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="pdf-bg-menu__item"
                          onClick={() => {
                            setImageMenuOpen(false);
                            onRemoveBackgroundImage();
                          }}
                        >
                          外す
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {backgroundImage && (
                <div className="toolbar__group field field--stack field--compact toolbar__background-opacity">
                  <div className="pdf-range-label">
                    <label htmlFor="pdf-bg-opacity">不透明度</label>
                    <output id="pdf-bg-opacity-value" htmlFor="pdf-bg-opacity">
                      {Math.round(backgroundImageOpacity * 100)}%
                    </output>
                  </div>
                  <input
                    id="pdf-bg-opacity"
                    type="range"
                    className="pdf-range-input pdf-range-input--fluid"
                    min={BACKGROUND_IMAGE_OPACITY_MIN}
                    max={BACKGROUND_IMAGE_OPACITY_MAX}
                    step={BACKGROUND_IMAGE_OPACITY_STEP}
                    value={backgroundImageOpacity}
                    aria-describedby="pdf-bg-opacity-value"
                    onChange={(e) => onSetBackgroundImageOpacity(Number(e.target.value))}
                  />
                </div>
              )}
            </div>

          </div>

          {/* トースト通知にすると自動で消えてしまう。配色・書体は選んだ後も
              効き続ける前提なので、選択が変わらない限り常時見えてよい */}
          {(showDarkNote || showContrastWarning) && (
            <div className="pdf-notes">
              {showDarkNote && (
                <p className="pdf-note">
                  用紙全面を塗ります。印刷ではインクを多く使います。
                </p>
              )}
              {/* 破綻を禁止はしないため、出力を止めずに知らせるだけにする */}
              {showContrastWarning && (
                <p className="pdf-note pdf-note--warning">
                  背景と文字の色が近く、読みにくい可能性があります。
                </p>
              )}
            </div>
          )}
          </div>
          <div className="toolbar__design-column toolbar__design-column--grid">
            <h3 className="toolbar__subsection-title">グリッド</h3>

            <div className="toolbar__grid-style-controls">
              <div className="toolbar__group field field--stack field--compact toolbar__grid-style-select">
                <label htmlFor="pdf-grid-style">グリッドデザイン</label>
                <select
                  id="pdf-grid-style"
                  className="text-input"
                  value={pdfPrefs.gridStyleId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, gridStyleId: e.target.value })}
                >
                  {Object.entries(PDF_GRID_STYLES).map(([id, style]) => (
                    <option key={id} value={id}>
                      {style.label}
                    </option>
                  ))}
                  <option value="custom">カスタム</option>
                </select>
              </div>

              {pdfPrefs.gridStyleId === 'custom' && (
                <div className="toolbar__grid-style-custom">
                  <div className="toolbar__grid-style-custom-header">
                    <h4>カスタム設定</h4>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() =>
                        onSetPdfPrefs({
                          ...pdfPrefs,
                          gridStyleCustom: { ...DEFAULT_PDF_GRID_STYLE_CUSTOM },
                        })
                      }
                    >
                      既定の値に戻す
                    </button>
                  </div>
                  <div className="toolbar__grid-style-custom-groups">
                    {PDF_GRID_STYLE_CUSTOM_GROUPS.map(({ title: groupTitle, keys }) => (
                      <div className="toolbar__grid-style-custom-group" key={groupTitle}>
                        <h5>{groupTitle}</h5>
                        {keys.map((key) => {
                          const range = PDF_GRID_STYLE_CUSTOM_RANGES[key];
                          const value = resolvedGridStyle[key];
                          const inputId = `pdf-grid-style-${key}`;
                          const outputId = `${inputId}-value`;
                          return (
                            <div className="pdf-range-field" key={key}>
                              <div className="pdf-range-label">
                                <label htmlFor={inputId}>
                                  {PDF_GRID_STYLE_CUSTOM_LABELS[key]}
                                </label>
                                <output id={outputId} htmlFor={inputId}>{value}</output>
                              </div>
                              <input
                                id={inputId}
                                type="range"
                                className="pdf-range-input pdf-range-input--fluid"
                                min={range.min}
                                max={range.max}
                                step={range.step}
                                value={value}
                                aria-describedby={outputId}
                                onChange={(e) => setGridStyleCustomValue(key, e.target.value)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <SegmentedRadioField
              className="toolbar__grid-number-settings"
              legend="グリッド番号"
              ariaLabel="グリッド番号の表示"
              name="pdf-grid-number-display"
              value={pdfPrefs.gridNumberDisplayId}
              options={PDF_GRID_NUMBER_DISPLAYS}
              onChange={(gridNumberDisplayId) => onSetPdfPrefs({
                ...pdfPrefs,
                gridNumberDisplayId,
              })}
            />
          </div>
          </div>
          </div>
          </section>

          <section className="toolbar__section toolbar__section--pdf-typography" aria-labelledby="toolbar-group-pdf-typography">
            {renderPdfSectionHeading('typography', '文字')}
            <div
              className="toolbar__section-panel"
              id="toolbar-panel-pdf-typography"
              hidden={!isPdfSectionOpen('typography')}
            >
            <div className="toolbar__typography-grid">
              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-font">書体</label>
                <select
                  id="pdf-font"
                  className="text-input"
                  value={pdfPrefs.fontId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, fontId: e.target.value })}
                >
                  {Object.entries(PDF_FONTS).map(([id, font]) => (
                    <option key={id} value={id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-font-weight">太さ</label>
                <select
                  id="pdf-font-weight"
                  className="text-input"
                  value={pdfPrefs.fontWeightId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, fontWeightId: e.target.value })}
                >
                  {Object.entries(PDF_FONT_WEIGHTS).map(([id, weight]) => (
                    <option key={id} value={id}>
                      {weight.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-title-size">曲名（pt）</label>
                <input
                  id="pdf-title-size"
                  type="number"
                  className="text-input"
                  min={PDF_LAYOUT_RANGES.titleFontSizePt.min}
                  max={PDF_LAYOUT_RANGES.titleFontSizePt.max}
                  value={localTitleFontSize}
                  onChange={(e) => setLocalTitleFontSize(e.target.value)}
                  onBlur={() =>
                    commitLayoutNumber('titleFontSizePt', localTitleFontSize, setLocalTitleFontSize)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitLayoutNumber('titleFontSizePt', localTitleFontSize, setLocalTitleFontSize);
                    }
                  }}
                />
              </div>

              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-meta-size">曲情報（pt）</label>
                <input
                  id="pdf-meta-size"
                  type="number"
                  className="text-input"
                  min={PDF_LAYOUT_RANGES.metaFontSizePt.min}
                  max={PDF_LAYOUT_RANGES.metaFontSizePt.max}
                  value={localMetaFontSize}
                  onChange={(e) => setLocalMetaFontSize(e.target.value)}
                  onBlur={() =>
                    commitLayoutNumber('metaFontSizePt', localMetaFontSize, setLocalMetaFontSize)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitLayoutNumber('metaFontSizePt', localMetaFontSize, setLocalMetaFontSize);
                    }
                  }}
                />
              </div>

              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-lyric-size">歌詞（%）</label>
                <input
                  id="pdf-lyric-size"
                  type="number"
                  className="text-input"
                  min={PDF_LAYOUT_RANGES.lyricSizePercent.min}
                  max={PDF_LAYOUT_RANGES.lyricSizePercent.max}
                  value={localLyricSizePercent}
                  onChange={(e) => setLocalLyricSizePercent(e.target.value)}
                  onBlur={() =>
                    commitLayoutNumber(
                      'lyricSizePercent',
                      localLyricSizePercent,
                      setLocalLyricSizePercent,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitLayoutNumber(
                        'lyricSizePercent',
                        localLyricSizePercent,
                        setLocalLyricSizePercent,
                      );
                    }
                  }}
                />
              </div>

            </div>

            {showMinchoNote && (
              <div className="pdf-notes">
                <p className="pdf-note">初回のPDF生成時に約8MBを読み込みます。</p>
              </div>
            )}
            </div>
          </section>

          <section className="toolbar__section toolbar__section--pdf-score-info" aria-labelledby="toolbar-group-pdf-score-info">
            {renderPdfSectionHeading('score-info', '曲情報')}
            <div
              className="toolbar__section-panel"
              id="toolbar-panel-pdf-score-info"
              hidden={!isPdfSectionOpen('score-info')}
            >
            <div className="toolbar__score-info-grid">
              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-score-info-design">曲情報デザイン</label>
                <select
                  id="pdf-score-info-design"
                  className="text-input"
                  value={pdfPrefs.scoreInfoDesignId}
                  onChange={(e) => onSetPdfPrefs({
                    ...pdfPrefs,
                    scoreInfoDesignId: e.target.value,
                  })}
                >
                  {Object.entries(PDF_SCORE_INFO_DESIGNS).map(([id, design]) => (
                    <option key={id} value={id}>
                      {design.label}
                    </option>
                  ))}
                </select>
              </div>

              {pdfPrefs.scoreInfoDesignId === 'masthead' && (
                <SegmentedRadioField
                  legend="向き"
                  ariaLabel="シンプルの向き"
                  name="pdf-masthead-direction"
                  value={pdfPrefs.mastheadDirectionId}
                  options={PDF_MASTHEAD_DIRECTIONS}
                  onChange={(mastheadDirectionId) => onSetPdfPrefs({
                    ...pdfPrefs,
                    mastheadDirectionId,
                  })}
                />
              )}

              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-tempo-value-mode">♩の値</label>
                <select
                  id="pdf-tempo-value-mode"
                  className="text-input"
                  value={pdfPrefs.tempoValueModeId}
                  onChange={(e) => onSetPdfPrefs({
                    ...pdfPrefs,
                    tempoValueModeId: e.target.value,
                  })}
                >
                  {Object.entries(PDF_TEMPO_VALUE_MODES).map(([id, mode]) => (
                    <option key={id} value={id}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </div>

              {pdfPrefs.tempoValueModeId === 'custom' && (
                <div className="toolbar__group field field--stack field--compact">
                  <label htmlFor="pdf-custom-tempo-value">カスタム値</label>
                  <input
                    id="pdf-custom-tempo-value"
                    type="number"
                    className="text-input"
                    min={PDF_CUSTOM_TEMPO_VALUE_RANGE.min}
                    max={PDF_CUSTOM_TEMPO_VALUE_RANGE.max}
                    step={PDF_CUSTOM_TEMPO_VALUE_RANGE.step}
                    value={localCustomTempoValue}
                    onChange={(e) => setLocalCustomTempoValue(e.target.value)}
                    onBlur={commitCustomTempoValue}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitCustomTempoValue();
                      }
                    }}
                  />
                </div>
              )}

              {showKeyNotation && (
                <div className="toolbar__group field field--stack field--compact">
                  <label htmlFor="pdf-key-notation">キー表記</label>
                  <select
                    id="pdf-key-notation"
                    className="text-input"
                    value={pdfPrefs.keyNotationId}
                    onChange={(e) => onSetPdfPrefs({
                      ...pdfPrefs,
                      keyNotationId: e.target.value,
                    })}
                  >
                    {Object.entries(KEY_NOTATIONS).map(([id, notation]) => (
                      <option key={id} value={id}>
                        {notation.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-key-mode-notation">調性表記</label>
                <select
                  id="pdf-key-mode-notation"
                  className="text-input"
                  value={pdfPrefs.keyModeNotationId}
                  onChange={(e) => onSetPdfPrefs({
                    ...pdfPrefs,
                    keyModeNotationId: e.target.value,
                  })}
                >
                  {Object.keys(KEY_MODE_NOTATIONS).map((id) => (
                    <option key={id} value={id}>
                      {keyModeNotationLabel(keyMode, id)}
                    </option>
                  ))}
                </select>
              </div>

            </div>
            </div>
          </section>

          <section className="toolbar__section toolbar__section--pdf-page" aria-labelledby="toolbar-group-pdf-page">
            {renderPdfSectionHeading('page', 'ページ')}
            <div
              className="toolbar__section-panel"
              id="toolbar-panel-pdf-page"
              hidden={!isPdfSectionOpen('page')}
            >
            <div className="toolbar__page-grid">

              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-page-number-format">ページ番号</label>
                <select
                  id="pdf-page-number-format"
                  className="text-input"
                  value={pdfPrefs.pageNumberFormatId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, pageNumberFormatId: e.target.value })}
                >
                  {Object.entries(PDF_PAGE_NUMBER_FORMATS).map(([id, format]) => (
                    <option key={id} value={id}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </div>

              {pdfPrefs.pageNumberFormatId !== 'none' && (
                <>
              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-page-number-position">ページ番号の位置</label>
                <select
                  id="pdf-page-number-position"
                  className="text-input"
                  value={pdfPrefs.pageNumberPositionId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, pageNumberPositionId: e.target.value })}
                >
                  {Object.entries(PDF_PAGE_NUMBER_POSITIONS).map(([id, position]) => (
                    <option key={id} value={id}>
                      {position.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-page-number-size">ページ番号サイズ（pt）</label>
                <input
                  id="pdf-page-number-size"
                  type="number"
                  className="text-input"
                  min={PDF_LAYOUT_RANGES.pageNumberFontSizePt.min}
                  max={PDF_LAYOUT_RANGES.pageNumberFontSizePt.max}
                  value={localPageNumberFontSize}
                  onChange={(e) => setLocalPageNumberFontSize(e.target.value)}
                  onBlur={() =>
                    commitLayoutNumber(
                      'pageNumberFontSizePt',
                      localPageNumberFontSize,
                      setLocalPageNumberFontSize,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitLayoutNumber(
                        'pageNumberFontSizePt',
                        localPageNumberFontSize,
                        setLocalPageNumberFontSize,
                      );
                    }
                  }}
                />
              </div>
                </>
              )}

              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-running-header">柱</label>
                <select
                  id="pdf-running-header"
                  className="text-input"
                  value={pdfPrefs.runningHeaderId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, runningHeaderId: e.target.value })}
                >
                  {Object.entries(PDF_RUNNING_HEADERS).map(([id, header]) => (
                    <option key={id} value={id}>
                      {header.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="toolbar__group field field--stack field--compact">
                <label htmlFor="pdf-footer-credit">フッター</label>
                <select
                  id="pdf-footer-credit"
                  className="text-input"
                  value={pdfPrefs.footerCreditId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, footerCreditId: e.target.value })}
                >
                  {Object.entries(PDF_FOOTER_CREDITS).map(([id, footer]) => (
                    <option key={id} value={id}>
                      {footer.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            </div>
          </section>

          <section className="toolbar__section toolbar__section--pdf-paper" aria-labelledby="toolbar-group-pdf-paper">
            {renderPdfSectionHeading('paper', '紙面')}
            <div
              className="toolbar__section-panel"
              id="toolbar-panel-pdf-paper"
              hidden={!isPdfSectionOpen('paper')}
            >
            <div className="toolbar__layout-grid">
              <div className="toolbar__group field field--stack field--compact toolbar__layout-sheet">
                <label htmlFor="pdf-sheet-layout">面付け</label>
                <select
                  id="pdf-sheet-layout"
                  className="text-input"
                  value={pdfPrefs.sheetLayoutId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, sheetLayoutId: e.target.value })}
                >
                  {Object.entries(PDF_SHEET_LAYOUTS).map(([id, sheetLayout]) => (
                    <option key={id} value={id}>
                      {sheetLayout.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="toolbar__group field field--stack field--compact toolbar__layout-rows">
                <label htmlFor="pdf-max-rows">1ページの行数</label>
                <input
                  id="pdf-max-rows"
                  type="number"
                  className="text-input"
                  min={PDF_LAYOUT_RANGES.maxRowsPerPage.min}
                  max={PDF_LAYOUT_RANGES.maxRowsPerPage.max}
                  value={localMaxRows}
                  onChange={(e) => setLocalMaxRows(e.target.value)}
                  onBlur={() => commitLayoutNumber('maxRowsPerPage', localMaxRows, setLocalMaxRows)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitLayoutNumber('maxRowsPerPage', localMaxRows, setLocalMaxRows);
                    }
                  }}
                />
              </div>

              <div className="toolbar__group field field--stack field--compact toolbar__layout-columns">
                <label htmlFor="pdf-columns-per-page">1ページの列数</label>
                <select
                  id="pdf-columns-per-page"
                  className="text-input"
                  value={pdfPrefs.columnsPerPageId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, columnsPerPageId: e.target.value })}
                >
                  {columnsPerPageOptions.map(([id, option]) => (
                    <option key={id} value={id}>
                      {/* 拍子に合わせる場合の実際の列数は、PDF出力と同じ関数から出す */}
                      {option.columns === null
                        ? `${option.label}（${autoColumns}列）`
                        : option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 見た目はグリッド番号のトグルと同じ。gridの1セルを占めるため、
                  fieldsetのままでも他のプルダウンと同じ列に収まる */}
              <SegmentedRadioField
                className="toolbar__layout-row-shading"
                legend="偶数行を暗くする"
                ariaLabel="偶数行の網掛け"
                name="pdf-row-shading"
                value={pdfPrefs.rowShadingId}
                options={PDF_ROW_SHADINGS}
                onChange={(rowShadingId) => onSetPdfPrefs({ ...pdfPrefs, rowShadingId })}
              />

              <div className="toolbar__group field field--stack field--compact toolbar__layout-margin">
                <label htmlFor="pdf-page-margin">余白</label>
                <select
                  id="pdf-page-margin"
                  className="text-input"
                  value={pdfPrefs.pageMarginId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, pageMarginId: e.target.value })}
                >
                  {Object.entries(PDF_PAGE_MARGINS).map(([id, margin]) => (
                    <option key={id} value={id}>
                      {margin.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="toolbar__group field field--stack field--compact toolbar__layout-gap">
                <label htmlFor="pdf-grid-gap">グリッド間隔</label>
                <select
                  id="pdf-grid-gap"
                  className="text-input"
                  value={pdfPrefs.gridGapId}
                  onChange={(e) => onSetPdfPrefs({ ...pdfPrefs, gridGapId: e.target.value })}
                >
                  {Object.entries(PDF_GRID_GAPS).map(([id, gap]) => (
                    <option key={id} value={id}>
                      {gap.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            </div>
          </section>

          <div className="toolbar__pdf-action-bar">
            <p className="toolbar__pdf-action-note">新しいタブを開けない場合はPDFをダウンロードします。</p>
            <div className="toolbar__action-cluster toolbar__action-cluster--pdf-preset">
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => onOpenPdfPreset('export')}
                disabled={isProcessing}
              >
                設定を書き出す
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => onOpenPdfPreset('import')}
                disabled={isProcessing}
              >
                設定を読み込む
              </button>
            </div>
            <div className="toolbar__action-cluster toolbar__action-cluster--pdf-export">
              <button
                type="button"
                className="btn btn--lg btn--primary"
                onClick={onExportPdf}
                disabled={isProcessing || !hasData}
              >
                {isProcessing ? '処理中…' : 'PDFを生成'}
              </button>
            </div>
          </div>
          </div>
        </>
      )}
    </header>
  );
}
