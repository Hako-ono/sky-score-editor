import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLanguage, useT } from './i18n/LanguageContext.jsx';

import Toolbar from './components/Toolbar.jsx';
import PdfPresetDialog from './components/PdfPresetDialog.jsx';
import StatusBar from './components/StatusBar.jsx';
import ScoreCanvas from './components/ScoreCanvas.jsx';
import EmptyState from './components/EmptyState.jsx';
import PlaybackBar from './components/PlaybackBar.jsx';
import GridOverlay from './components/GridOverlay.jsx';
import HistoryFab from './components/HistoryFab.jsx';
import ScrollTopFab from './components/ScrollTopFab.jsx';
import DebugOverlay from './components/DebugOverlay.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import { usePlayback } from './hooks/usePlayback.js';
import { DEBUG_ENABLED } from './lib/debugFlag.js';

import { useUndoableScore } from './hooks/useUndoableScore.js';
import { useScoreGridsStore } from './contexts/ScoreGridsContext.jsx';
import { columnsForBits } from './lib/layout.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { initialScore } from './state/scoreReducer.js';
import { createScore, serializeScoreForCompare } from './state/scoreShape.js';
import {
  parseScoreJson,
  serializeScore,
  createEmptyGrid,
  ParseError,
  normalizeLoadedScore,
  decodeScoreFileBytes,
} from './lib/parseScore.js';
import { saveDraft, loadDraft, clearDraft } from './lib/draftStorage.js';
import { loadPdfPrefs, savePdfPrefs } from './lib/pdfPrefs.js';
import { readPdfPresetFragment } from './lib/pdfPresetUrl.js';
import {
  loadBackgroundImageSource,
  composeBackgroundImage,
  DEFAULT_BACKGROUND_IMAGE_OPACITY,
} from './lib/backgroundImage.js';
import { audioEngine } from './lib/audioEngine.js';
import {
  DEFAULT_BPM,
  MAX_GRIDS,
  resolveLyricSizePercentOnLanguageChange,
  resolvePaletteSeed,
} from './constants/config.js';
import { normalizeThemePreference, resolveTheme } from './lib/theme.js';
import {
  analyzeScoreLayers,
  getInitialLayer,
  getKeyTogglePreviewKeys,
  shouldUseSecondHighlightColor,
} from './lib/scoreLayers.js';

const THEME_KEY = 'sky-score-editor:theme';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? 'dark' : 'light';
}

function loadThemePreference() {
  try {
    return normalizeThemePreference(localStorage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function jsonFilename() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `sky_score_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(
    d.getHours(),
  )}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
}

export default function App() {
  const t = useT();
  const { language } = useLanguage();
  const { score, dispatch, reset, undo, redo, canUndo, canRedo } =
    useUndoableScore();

  const [editMode, setEditMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState({ message: '', type: 'info', action: null });
  const [fileName, setFileName] = useState('');
  const [themePreference, setThemePreference] = useState(loadThemePreference);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const theme = resolveTheme(themePreference, systemTheme);
  const [pdfPrefs, setPdfPrefs] = useState(loadPdfPrefs);
  const [pdfPresetDialog, setPdfPresetDialog] = useState(null);
  const pdfPresetReturnFocusRef = useRef(null);
  const pdfPresetScoreContext = useMemo(
    () => ({ pitchLevel: score.pitchLevel, keyMode: score.keyMode, language }),
    [language, score.keyMode, score.pitchLevel],
  );
  // 背景画像は利用者が出力のたびにローカルから選ぶもので、pdfPrefsとは違い
  // localStorageに保存しない。
  // backgroundImage: { dataUrl, width, height } | null。プレビュー表示と
  // exportPdf の両方が参照する「白地へ現在の不透明度で合成済み」の状態
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundImageOpacity, setBackgroundImageOpacity] = useState(
    DEFAULT_BACKGROUND_IMAGE_OPACITY,
  );
  // 縮小済み・不透明度100%のsource（{ canvas, width, height }）。不透明度を
  // 変えるたびに元ファイルを読み直さずに済むよう、ここにだけ保持する
  // （再レンダーの起点にする必要がないためstateではなくref）
  const backgroundImageSourceRef = useRef(null);
  const [hasDraft, setHasDraft] = useState(false);
  const isMobile = useIsMobile();
  const [selectedLayer, setSelectedLayer] = useState(() => getInitialLayer(initialScore.grids));
  // 元レイヤー2だけの譜面も読込直後は標準色にするため、絶対番号ではなく
  // 読込時の初期レイヤーを「画面上の色1」の基準としてページ内だけで保持する。
  const [standardColorLayer, setStandardColorLayer] = useState(
    () => getInitialLayer(initialScore.grids),
  );

  // useRef だと markSaved 単体では再レンダーされず、isDirty を読む Toolbar の
  // 未保存ドットや beforeunload の effect が保存直後も古い値のまま取り残される
  const [savedSnapshot, setSavedSnapshot] = useState(() => serializeScoreForCompare(initialScore));
  const statusTimerRef = useRef(null);
  const saveFailedRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  // isDirty は「ファイルに書き出した内容との差」であり、下書きとの差ではない。
  // 自動保存をこれで駆動すると、全消去を undo で戻したときに isDirty が false へ
  // 復帰し、空のまま書かれた下書きが二度と更新されなくなる
  const draftSnapshotRef = useRef(serializeScoreForCompare(initialScore));

  // 共有URLの設定は起動時に候補として1回だけ取り込み、確認画面での適用まで
  // pdfPrefsへ触れない。認識したhash parameterだけを履歴から取り除き、
  // 他のhash parameterとpath/queryは維持する。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fragment = readPdfPresetFragment(window.location);
    if (!fragment) return;
    if (!fragment.tooLarge && fragment.remainingHash !== null) {
      const nextUrl = `${window.location.pathname}${window.location.search}${fragment.remainingHash}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    }
    setPdfPresetDialog({
      mode: 'import',
      initialImportText: fragment.tooLarge
        ? ''
        : `${window.location.origin}${window.location.pathname}${window.location.search}#pdf-preset=${fragment.value}`,
      initialError: fragment.tooLarge ? t('ui.pdfPresetDialog.error.inputTooLarge') : '',
    });
  }, [t]);

  const hasData = score.grids.length > 0;
  const layerAnalysis = useMemo(() => analyzeScoreLayers(score.grids), [score.grids]);
  const { usesTwoLayers } = layerAnalysis;
  const usesSecondHighlightColor = shouldUseSecondHighlightColor(
    usesTwoLayers,
    selectedLayer,
    standardColorLayer,
  );
  // 毎回の入力時の重い整形処理をやめるため useMemo で score が変わったときだけ計算する
  const currentSerialized = useMemo(() => serializeScoreForCompare(score), [score]);
  // hasData は「書き出す中身があるか」の判定にのみ使う。isDirty からは外している。
  // grids が0件のときも isDirty を有効にしないと、全消去した直後に自動保存が
  // 止まり、消去前の下書きが localStorage に残ったまま戻ってきてしまう
  const isDirty = currentSerialized !== savedSnapshot;
  
  useEffect(() => {
    document.title = score.title
      ? t('ui.app.documentTitle', { title: score.title })
      : t('ui.app.documentTitleDefault');
  }, [score.title, t]);

  const gridsRef = useRef(score.grids);
  useEffect(() => {
    gridsRef.current = score.grids;
  }, [score.grids]);

  const gridsStore = useScoreGridsStore();
  // 行の分かれ方は bitsPerPage にも依存するため、ScoreCanvas.jsx が columns を
  // 独自に計算しているのと同じ式をストアへも渡す。
  const gridColumns = columnsForBits(score.bitsPerPage);
  // useEffect ではなく useLayoutEffect を使う理由：useEffect は描画後に走るため、
  // undo / 読み込み直後の1フレームだけストア側が古い内容を購読者に見せうる。
  // useLayoutEffect なら描画前（ブラウザが画面を更新する前）に通知が終わる。
  useLayoutEffect(() => {
    gridsStore.setGrids(score.grids, gridColumns);
  }, [gridsStore, score.grids, gridColumns]);

  const showStatus = useCallback((message, type = 'info', autoDismiss = true, action = null) => {
    setStatus({ message, type, action });
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (autoDismiss && type !== 'error') {
      statusTimerRef.current = setTimeout(
        () => setStatus({ message: '', type: 'info', action: null }),
        4000,
      );
    }
  }, []);

  const dismissStatus = useCallback(() => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatus({ message: '', type: 'info', action: null });
  }, []);

  const markSaved = useCallback((serialized) => {
    setSavedSnapshot(serialized);
  }, []);

  const {
    playbackState,
    isAutoScroll,
    setIsAutoScroll,
    togglePlayPause,
    stop,
    playFrom,
    playSingleGrid,
    playPreview
  } = usePlayback(score.grids, score.bpm, score.pitchLevel, showStatus, dismissStatus);

  const toggleLayer = useCallback(() => {
    setSelectedLayer((layer) => (layer === 1 ? 2 : 1));
  }, []);

  const handleToggleKey = useCallback((index, k, layer = selectedLayer) => {
    const g = gridsRef.current[index];
    const previewKeys = getKeyTogglePreviewKeys(g, k, layer);
    if (previewKeys.length > 0) playPreview(previewKeys);
    dispatch({ type: 'TOGGLE_KEY', gridIndex: index, keyIndex: k, layer });
  }, [dispatch, playPreview, selectedLayer]);

  const handleSetText = useCallback((index, text) => {
    dispatch({ type: 'SET_TEXT', gridIndex: index, text });
  }, [dispatch]);

  const handleDelete = useCallback((index) => {
    dispatch({ type: 'DELETE', gridIndex: index });
  }, [dispatch]);

  const handleToggleBreak = useCallback((index) => {
    dispatch({ type: 'TOGGLE_BREAK', gridIndex: index });
  }, [dispatch]);

  const handleInsert = useCallback((insertIndex) => {
    // reducer 側にも最終防御があるが、押せてしまってから理由を伝えないと
    // 利用者には何も起きなかったようにしか見えない
    if (gridsRef.current.length >= MAX_GRIDS) {
      showStatus(t('ui.app.maxGrids', { n: MAX_GRIDS }), 'error', false);
      return;
    }
    dispatch({ type: 'INSERT', insertIndex });
  }, [dispatch, showStatus, t]);

  const handlePlayFrom = useCallback((index) => {
    playFrom(index);
  }, [playFrom]);

  const handlePlaySingle = useCallback((index) => {
    playSingleGrid(index);
  }, [playSingleGrid]);

  // --- テーマ適用 ---
  // data-themeはCSSの初期描画後すぐに反映し、システム設定の変更時も
  // 解決済みテーマだけを更新する。保存するのは利用者の選択値であり、
  // システム設定から得たlight/darkは保存しない。
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, themePreference);
    } catch {
      // プライベートモード等のエラーを無視
    }
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    const handleChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    if (typeof mediaQuery.addListener !== 'function') return undefined;
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  // PDF出力の配色・書体設定を保存する。楽譜のstate（useUndoableScore）とは
  // 別に持つ。Undo/Redoの対象ではなく、JSONへの保存経路にも混ぜないため
  useEffect(() => {
    savePdfPrefs(pdfPrefs);
  }, [pdfPrefs]);

  // 表示言語を切り替えたときだけ歌詞サイズの既定値を追従させる。初回表示分は
  // loadPdfPrefs が済ませているため、ref で「前回の言語」を持って変化時のみ動かす。
  // 追従条件は resolveLyricSizePercentOnLanguageChange 側に集約している。
  const previousLanguageRef = useRef(language);
  useEffect(() => {
    const previousLanguage = previousLanguageRef.current;
    if (previousLanguage === language) return;
    previousLanguageRef.current = language;

    setPdfPrefs((prefs) => {
      const nextPercent = resolveLyricSizePercentOnLanguageChange(
        prefs.lyricSizePercent,
        previousLanguage,
        language,
      );
      // 同じ参照を返して、変化が無いときの保存とレンダーを増やさない
      return nextPercent === prefs.lyricSizePercent
        ? prefs
        : { ...prefs, lyricSizePercent: nextPercent };
    });
  }, [language]);

  // tone のチャンク（約340KB）を先に取得しておく。初回タップ時に取りに行くと、
  // ダウンロードの間に iOS のユーザー操作の有効期間が切れて音が出なくなる。
  // 初期描画と帯域を奪い合わないよう、少し遅らせてから始める。
  useEffect(() => {
    const timer = setTimeout(() => audioEngine.preload(), 1500);
    return () => clearTimeout(timer);
  }, []);

  // --- 起動時: 下書きの有無を確認 ---
  useEffect(() => {
    setHasDraft(Boolean(loadDraft()));
  }, []);

  // --- 自動保存 (デバウンス) ---
  useEffect(() => {
    if (currentSerialized === draftSnapshotRef.current) return undefined;
    const id = setTimeout(() => {
      if (score.grids.length === 0) {
        // 全消去の結果は下書きにも反映する必要がある（消したはずの楽譜が
        // 次回起動で戻ってきてはいけない）。ただし空の下書きを書き戻すと
        // 復元しても EmptyState のままの何も起きないボタンになるため、
        // 削除で表す（draftStorage.js の loadDraft 側の防御と対になる）
        clearDraft();
        draftSnapshotRef.current = currentSerialized;
        setHasDraft(false);
        saveFailedRef.current = false;
        return;
      }
      const saved = saveDraft(score);
      if (saved) {
        draftSnapshotRef.current = currentSerialized;
        setHasDraft(true);
        saveFailedRef.current = false;
      } else if (!saveFailedRef.current) {
        // 失敗し続ける状況（プライベートブラウズ等）で毎回出すと操作できなく
        // なるため、成功に戻るまでは最初の1回だけ知らせる
        saveFailedRef.current = true;
        showStatus(
          t('ui.app.autosaveFailed'),
          'error',
          false,
        );
      }
    }, 800);
    // 下書き削除ボタンがこのタイマーを止められるよう ref にも控えておく
    autoSaveTimerRef.current = id;
    return () => clearTimeout(id);
  }, [score, currentSerialized, showStatus, t]);

  // --- 離脱時の未保存警告 ---
  useEffect(() => {
    const handler = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // --- ファイル読み込み ---
  const loadFile = useCallback(
    async (file) => {
      if (file.size > 10 * 1024 * 1024) {
        showStatus(t('ui.app.fileTooLarge'), 'error', false);
        return;
      }

      // 譜面作成アプリ側は同じ内容を .txt で書き出すため、拡張子だけで弾かない。
      // 中身の検証は parseScoreJson が行う
      const lowerName = file.name.toLowerCase();
      const acceptedByName = lowerName.endsWith('.json') || lowerName.endsWith('.txt');
      const acceptedByType = file.type === 'application/json' || file.type === 'text/plain';
      if (!acceptedByName && !acceptedByType) {
        showStatus(t('ui.app.fileType'), 'error', false);
        return;
      }
      setFileName(file.name);
      showStatus(t('ui.app.loadingFile'), 'loading', false);
      try {
        const bytes = await file.arrayBuffer();
        const text = decodeScoreFileBytes(bytes);
        const parsed = parseScoreJson(text);
        // parsed は normalizeLoadedScore の戻り値で、score のフィールドに
        // 加えて warning を持つ。createScore で9フィールドだけを取り出す。
        const loaded = createScore(parsed);
        reset(loaded);
        const initialLayer = getInitialLayer(loaded.grids);
        setSelectedLayer(initialLayer);
        setStandardColorLayer(initialLayer);
        markSaved(serializeScoreForCompare(loaded));
        setEditMode(false);
        if (parsed.warning) {
          // 切り詰め等の警告は見逃されると「読み込みが壊れた」と誤解される。
          // 自動で消さず、利用者が閉じるまで残す
          showStatus(
            t('ui.app.loaded', { n: parsed.grids.length, warning: parsed.warning }),
            'warning',
            false,
          );
        } else {
          // グリッドが画面に出ること自体が成功の合図なので通知はしない。
          // ただし「読み込んでいます…」を出したままにはできない
          dismissStatus();
        }
      } catch (err) {
        const msg =
          err instanceof ParseError
            ? err.message
            : t('ui.app.loadFailed', { message: err.message });
        showStatus(msg, 'error', false);
      }
    },
    [reset, markSaved, showStatus, dismissStatus, t],
  );

  // --- 新規作成 ---
  const newScore = useCallback(() => {
    if (isDirty && !window.confirm(t('ui.app.confirmNew'))) {
      return;
    }
    const next = createScore({
      grids: [createEmptyGrid()],
      bpm: score.bpm || DEFAULT_BPM,
      pitchLevel: score.pitchLevel || 0,
      keyMode: score.keyMode,
    });
    reset(next);
    const initialLayer = getInitialLayer(next.grids);
    setSelectedLayer(initialLayer);
    setStandardColorLayer(initialLayer);
    markSaved(serializeScoreForCompare(next));
    setFileName('');
    setEditMode(true);
  }, [isDirty, score.bpm, score.pitchLevel, score.keyMode, reset, markSaved, t]);

  const restoreDraft = useCallback(() => {
    const draft = loadDraft();
    if (!draft) return;
    // normalizeLoadedScore は10番目のキーとして warning を返す。loadFile と
    // 同じく createScore で score のフィールドだけを取り出し、warning を
    // state に混入させない（混入すると以後の saveDraft で下書きへ書き戻る）。
    const next = createScore(normalizeLoadedScore(draft));
    reset(next);
    const initialLayer = getInitialLayer(next.grids);
    setSelectedLayer(initialLayer);
    setStandardColorLayer(initialLayer);
    markSaved(serializeScoreForCompare(next));
  }, [reset, markSaved]);

  const clearAll = useCallback(() => {
    // 保存状態にかかわらず、必ず確認メッセージを表示する
    const confirmMessage = isDirty
      ? t('ui.app.confirmClearDirty')
      : t('ui.app.confirmClear');

    if (!window.confirm(confirmMessage)) {
      return; // キャンセルされたら何もしない
    }
    // reset() ではなく dispatch で CLEAR アクションを発行し、履歴に残す
    dispatch({ type: 'CLEAR' });
    setSelectedLayer(1);
    setStandardColorLayer(1);

    // Undo した際にファイル名や保存状態の基準が狂わないよう、
    // markSaved や setFileName('') 等は実行せず、「ファイルの内容をすべて消した」という編集状態として扱います。

    setEditMode(false);
    // 破壊的だが可逆な操作。取り消し手段をツールバーまで探しに行かせず、
    // 通知そのものに載せる。自動で消すと押す機会ごと失われるため消さない
    showStatus(t('ui.app.cleared'), 'info', false, {
      label: t('ui.toolbar.score.undo'),
      onClick: undo,
    });
  }, [isDirty, dispatch, showStatus, undo, t]);

  // --- 下書き削除 (共用端末でのデータ消去手段) ---
  const handleClearDraft = useCallback(() => {
    // window.confirm はメインスレッドを塞ぐため、表示中に自動保存のタイマーが
    // 発火時刻を過ぎうる。OK 後にそのまま clearDraft() すると、直後にタイマーの
    // コールバックが走って saveDraft(score) が下書きを書き戻してしまうため、
    // 削除の直前に予約済みタイマーを止める。削除後の編集で新しい下書きが
    // 作られるのは自動保存の約束どおりの動作なので、それは止めない
    if (!window.confirm(t('ui.app.confirmDeleteDraft'))) {
      return;
    }
    clearTimeout(autoSaveTimerRef.current);
    clearDraft();
    setHasDraft(false);
  }, [t]);

  // --- JSON 保存 ---
  const saveJson = useCallback(() => {
    if (!hasData) return;
    try {
      const text = serializeScore(score); // フォーマットバージョンを含めて出力する
      downloadText(text, jsonFilename(), 'application/json');
      markSaved(serializeScoreForCompare(score));
    } catch (err) {
      showStatus(t('ui.app.saveFailed', { message: err.message }), 'error', false);
    }
  }, [hasData, score, markSaved, showStatus, t]);

  // --- PDF背景画像
  // 合成後の背景画像は不透明なJPEGで、PDFでは用紙の背景色の上に重なる。
  // つまり利用者が見る背景色は「用紙の塗り」ではなく「合成用canvasの塗り色」で
  // 決まるため、選択中の配色のbgをここへ渡す（以前は白固定だった）
  const paletteBg = useMemo(
    () => resolvePaletteSeed({ presetId: pdfPrefs.presetId, custom: pdfPrefs.custom }).bg,
    [pdfPrefs.presetId, pdfPrefs.custom],
  );

  const handleLoadBackgroundImage = useCallback(
    async (file) => {
      showStatus(t('ui.app.loadingBackground'), 'loading', false);
      try {
        // 縮小済み・不透明度100%のsourceを保持しておき、以後の不透明度・
        // 背景色の変更はここから合成し直すだけにする（元ファイルの再デコードをしない）
        const source = await loadBackgroundImageSource(file);
        backgroundImageSourceRef.current = source;
        setBackgroundImage(
          composeBackgroundImage(source, {
            backgroundColor: paletteBg,
            opacity: backgroundImageOpacity,
          }),
        );
        dismissStatus();
      } catch (err) {
        // 壊れたファイル・巨大なファイル・画像でないファイルでも落ちずに
        // 利用者へ伝える
        showStatus(err.message || t('ui.app.backgroundFailed'), 'error', false);
      }
    },
    [showStatus, dismissStatus, backgroundImageOpacity, paletteBg, t],
  );

  // sourceが無い（まだ画像を選んでいない）ときは値を覚えておくだけにし、
  // 次に画像を選んだときにその値で合成する
  const handleSetBackgroundImageOpacity = useCallback((opacity) => {
    setBackgroundImageOpacity(opacity);
  }, []);

  // 不透明度・背景色が変わったら、読み込み済みのsourceから合成し直す。
  // 合成済みJPEGの色は後から変えられないため、配色を変えるたびに画像を
  // 選び直させないための再合成である。読み込み直後の合成とは経路が
  // 重ならない（sourceの差し替えはこのeffectを起動しない）
  useEffect(() => {
    if (!backgroundImageSourceRef.current) return;
    setBackgroundImage(
      composeBackgroundImage(backgroundImageSourceRef.current, {
        backgroundColor: paletteBg,
        opacity: backgroundImageOpacity,
      }),
    );
  }, [paletteBg, backgroundImageOpacity]);

  const handleRemoveBackgroundImage = useCallback(() => {
    backgroundImageSourceRef.current = null;
    setBackgroundImage(null);
  }, []);

  // --- PDF 出力 ---
  const handleExportPdf = useCallback(async () => {
    if (!hasData || isProcessing) return;
    setIsProcessing(true);
    const prevEdit = editMode;
    setEditMode(false);
    try {
      // PDF ライブラリ(jsPDF/svg2pdf)は重いので、必要になった時点で動的読み込みする
      const { exportPdf } = await import('./lib/pdfExport.js');
      // backgroundImageはpdfPrefsと違いlocalStorageに保存しない値なので、
      // ここでoptionsへ合流させるだけにして pdfPrefs 自体には混ぜない
      const result = await exportPdf(
        score,
        { ...pdfPrefs, language, backgroundImage, selectedLayer },
        (msg) => showStatus(msg, 'loading', false),
      );
      showStatus(
        result.opened
          ? t('ui.app.pdfOpened', { filename: result.filename })
          : t('ui.app.pdfDownloaded', { filename: result.filename }),
        'success',
      );
    } catch (err) {
      showStatus(t('ui.app.pdfFailed', { message: err.message }), 'error', false);
    } finally {
      setIsProcessing(false);
      setEditMode(prevEdit);
    }
  }, [hasData, isProcessing, editMode, score, pdfPrefs, language, backgroundImage, selectedLayer, showStatus, t]);

  const handleOpenPdfPreset = useCallback((nextMode) => {
    pdfPresetReturnFocusRef.current = document.activeElement;
    setPdfPresetDialog({ mode: nextMode, initialImportText: '', initialError: '' });
  }, []);

  const handleClosePdfPreset = useCallback(() => {
    setPdfPresetDialog(null);
    const returnFocus = pdfPresetReturnFocusRef.current;
    pdfPresetReturnFocusRef.current = null;
    if (returnFocus && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => returnFocus.focus?.());
    }
  }, []);

  const handleApplyPdfPreset = useCallback((nextPrefs) => {
    // ダイアログで完全に検証済みの1オブジェクトだけを適用する。
    // 背景画像・楽譜state・Undo履歴へsetterを渡さない構造を維持する。
    setPdfPrefs(nextPrefs);
  }, []);

  useKeyboardShortcuts({ onUndo: undo, onRedo: redo, onSave: saveJson });

  return (
    <div className={`app${editMode ? ' app--edit-mode' : ''}`}>
      <div className="app__inner">
        {/* ツールバーは sticky に含めない。楽譜を見ている間に手が届く必要が
            あるのは再生・停止・移調・追尾であって、JSONを開く/曲名/BPM ではない。
            固定するものを再生バーとステータスに絞ることで、画面上部が
            グリッドを覆う量を減らしている */}
        <Toolbar
            hasData={hasData}
            isProcessing={isProcessing}
            editMode={editMode}
            canUndo={canUndo}
            canRedo={canRedo}
            isDirty={isDirty}
            title={score.title}
            author={score.author}
            lyricist={score.lyricist}
            transcribedBy={score.transcribedBy}
            bitsPerPage={score.bitsPerPage}
            bpm={score.bpm}
            theme={themePreference}
            fileName={fileName}
            pitchLevel={score.pitchLevel}
            keyMode={score.keyMode}
            pdfPrefs={pdfPrefs}
            onSetPdfPrefs={setPdfPrefs}
            backgroundImage={backgroundImage}
            backgroundImageOpacity={backgroundImageOpacity}
            onLoadBackgroundImage={handleLoadBackgroundImage}
            onSetBackgroundImageOpacity={handleSetBackgroundImageOpacity}
            onRemoveBackgroundImage={handleRemoveBackgroundImage}
            onSetPitchLevel={(p) => dispatch({ type: 'SET_PITCH_LEVEL', pitchLevel: p })}
            onSetKeyMode={(keyMode) => dispatch({ type: 'SET_KEY_MODE', keyMode })}
            onLoadFile={loadFile}
            onNewScore={newScore}
            onClear={clearAll}
            onSetTitle={(t) => dispatch({ type: 'SET_TITLE', title: t })}
            onSetAuthor={(a) => dispatch({ type: 'SET_AUTHOR', author: a })}
            onSetLyricist={(l) => dispatch({ type: 'SET_LYRICIST', lyricist: l })}
            onSetTranscribedBy={(t) => dispatch({ type: 'SET_TRANSCRIBED_BY', transcribedBy: t })}
            onSetBitsPerPage={(b) => dispatch({ type: 'SET_BITS_PER_PAGE', bitsPerPage: b })}
            onSetBpm={(v) => dispatch({ type: 'SET_BPM', bpm: v })}
            onUndo={undo}
            onRedo={redo}
            onToggleEdit={() => setEditMode((v) => !v)}
            onToggleLayer={toggleLayer}
            usesTwoLayers={usesTwoLayers}
            onSaveJson={saveJson}
            onExportPdf={handleExportPdf}
            onOpenPdfPreset={handleOpenPdfPreset}
            onSetTheme={(preference) => setThemePreference(preference)}
        />

        {pdfPresetDialog && (
          <PdfPresetDialog
            mode={pdfPresetDialog.mode}
            initialImportText={pdfPresetDialog.initialImportText}
            initialError={pdfPresetDialog.initialError}
            pdfPrefs={pdfPrefs}
            scoreContext={pdfPresetScoreContext}
            onApply={handleApplyPdfPreset}
            onClose={handleClosePdfPreset}
          />
        )}

        {/* ステータスは通常フローから外して画面下部のトーストにしてある。
            ここに置くと、通知が出るたびに sticky ヘッダの高さが変わって
            再生バーと本文が上下し、楽譜を読んでいる最中に位置を見失う */}
        <div className="app__sticky-header">
          {hasData && (
            <PlaybackBar
              playbackState={playbackState}
              onTogglePlayPause={togglePlayPause}
              onStop={stop}
              isAutoScroll={isAutoScroll}
              setIsAutoScroll={setIsAutoScroll}
            />
          )}
        </div>

        <main className={`output${editMode ? ' edit-mode' : ''}`}>
          {hasData ? (
            <ScoreCanvas
              bitsPerPage={score.bitsPerPage}
              editMode={editMode}
              isAutoScroll={isAutoScroll}
              playbackState={playbackState}
              isMobile={isMobile}
              selectedLayer={selectedLayer}
              usesTwoLayers={usesTwoLayers}
              usesSecondHighlightColor={usesSecondHighlightColor}
              onPlayFrom={handlePlayFrom}
              onPlaySingle={handlePlaySingle}
              onPlayPreview={playPreview}
              onToggleKey={handleToggleKey}
              onToggleLayer={toggleLayer}
              onSetText={handleSetText}
              onDelete={handleDelete}
              onToggleBreak={handleToggleBreak}
              onInsert={handleInsert}
            />
          ) : (
            <EmptyState
              onLoadFile={loadFile}
              hasDraft={hasDraft}
              onRestoreDraft={restoreDraft}
            />
          )}
        </main>
        <SiteFooter hasDraft={hasDraft} onClearDraft={handleClearDraft} />
      </div>

      {/* 画面下部の浮遊レイヤー。通知と「編集を終了」を1つの重なり順にまとめて
          いるのは、両方を別々に fixed にすると互いに重なる位置関係を
          2箇所で調整することになるため。
          レイヤー自身は pointer-events を持たない（CSS 参照）。全幅に広がる
          ので、そのままだと下にあるグリッドがタップできなくなる */}
      <div className="bottom-layer">
        <StatusBar
          message={status.message}
          type={status.type}
          action={status.action}
          onClose={dismissStatus}
        />
        {editMode && (
          <button
            type="button"
            className="btn btn--warning-active edit-exit-fab"
            onClick={() => setEditMode(false)}
            disabled={isProcessing}
          >
            {t('ui.app.editFinish')}
          </button>
        )}
      </div>

      {/* 通知が出ている間は隠す。通知は画面下部の同じ帯に出るため重なるのと、
          「全消去」の通知は取り消しボタンを自前で持っているため、
          そちらが優先されるべき場面だから */}
      {(canUndo || canRedo) && !status.message && (
        <HistoryFab
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />
      )}

      {hasData && <ScrollTopFab editMode={editMode} />}

      {hasData && isMobile && (
        <GridOverlay
          grids={score.grids}
          editMode={editMode}
          onToggleKey={handleToggleKey}
          onSetText={handleSetText}
          onDelete={handleDelete}
          onToggleBreak={handleToggleBreak}
          onPlayFrom={handlePlayFrom}
          onPlaySingle={handlePlaySingle}
          onPlayPreview={playPreview}
          selectedLayer={selectedLayer}
          usesTwoLayers={usesTwoLayers}
          usesSecondHighlightColor={usesSecondHighlightColor}
          onToggleLayer={toggleLayer}
        />
      )}

      {DEBUG_ENABLED && (
        <DebugOverlay playbackState={playbackState} gridCount={score.grids.length} />
      )}
    </div>
  );
}
