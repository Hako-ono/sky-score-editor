import { useCallback, useEffect, useRef, useState } from 'react';

import { useT } from '../i18n/LanguageContext.jsx';
import { pdfConfig } from '../constants/config.js';
import { DEBUG_ENABLED } from '../lib/debugFlag.js';
import { CheckIcon } from './icons.jsx';
import PdfPreviewOverlay from './PdfPreviewOverlay.jsx';

// 自動更新のデバウンス時間は依存の直前値と比較して、連続変化しうる
// キー（背景画像の不透明度＝backgroundImage、カスタム配色の色相ピッカー＝
// custom、グリッドデザインの角丸・線幅スライダー＝gridStyleCustom）だけが
// 変わったときはCONTINUOUS_DEBOUNCE_MS、それ以外（プリセット切り替えなど
// 単発の操作、または楽譜自体の変更）はDISCRETE_DEBOUNCE_MSを使う。
// 最初は連続変化する入力だけ800msにしていたが、実機確認で
// 250msでも問題ないと判断したため両方250msにした。ただし
// previewOnly=trueでも1ページぶんのPDF組み立て＋ラスタ化は軽くない処理で、
// かつ生成を中断する仕組みは持たない（AbortSignalは意図的に不採用）
// ため、スライダーを連続で動かすと世代
// カウンタで捨てられる分も含め生成が重なって走る。大きな譜面やiPhoneで
// 重さが気になる場合は、CONTINUOUS_DEBOUNCE_MSだけを大きくして戻せる
// ようキー分類のロジックは残してある。
const DISCRETE_DEBOUNCE_MS = 250;
const CONTINUOUS_DEBOUNCE_MS = 250;
const CONTINUOUS_OPTION_KEYS = new Set(['backgroundImage', 'custom', 'gridStyleCustom']);

/** 直前の依存と比べて、連続変化しうるキーだけが変わったか判定する。 */
function isContinuousOnlyChange(prev, next) {
  if (!prev || prev.score !== next.score) return false;
  const prevOptions = prev.options;
  const nextOptions = next.options;
  const keys = new Set([...Object.keys(prevOptions), ...Object.keys(nextOptions)]);
  let changedAnyKey = false;
  for (const key of keys) {
    if (prevOptions[key] === nextOptions[key]) continue;
    if (!CONTINUOUS_OPTION_KEYS.has(key)) return false;
    changedAnyKey = true;
  }
  // 呼び出し元でscore/optionsの参照が変わったときにしか呼ばないため、
  // 通常ここは必ずtrueになる。念のため何も変わっていなければ連続変化
  // 扱いにはしない。
  return changedAnyKey;
}

// 「設定が変わった（未反映）」の判定から除外するキー。optionsは
// pdfPrefs一式をそのまま含むため、PDFの見た目に関わらないキーの変更
// （自動更新のオン/オフ自体・PNG出力専用のpngDpi）でも参照が変わり、
// 何もしていないのに反応してしまっていた。
const STALE_IGNORED_OPTION_KEYS = new Set(['previewAutoUpdate', 'pngDpi']);

/** optionsのうちPDFの見た目に関わるキーだけを比較する（浅い比較）。 */
function hasRelevantOptionsChanged(prevOptions, nextOptions) {
  if (!prevOptions) return true;
  const keys = new Set([...Object.keys(prevOptions), ...Object.keys(nextOptions)]);
  for (const key of keys) {
    if (STALE_IGNORED_OPTION_KEYS.has(key)) continue;
    if (prevOptions[key] !== nextOptions[key]) return true;
  }
  return false;
}

/**
 * PDF出力タブ「デザイン」セクションの常時プレビュー。
 * 実際のラスタ化は `pdfPreview.js` に委ね、ここでは表示状態（読み込み中・
 * 失敗・楽譜未読込・古い設定）の管理と自動更新のデバウンスだけを持つ。
 *
 * @param {object} props
 * @param {*} props.score buildPdfBlob と同じ形
 * @param {*} props.options buildPdfBlob と同じ形。呼び出し元
 *          （Toolbar.jsx 経由の App.jsx）が handleExportPdf/handleExportPng と
 *          同一の式で組み立てたものをそのまま渡す想定
 *          （`{ ...pdfPrefs, language, backgroundImage, selectedLayer }`）。
 *          previewAutoUpdate・sheetLayoutId も pdfPrefs 由来としてここに含む
 * @param {boolean} props.active PDF出力タブが表示され、かつデザインセクションが
 *          開いていること（非表示中は生成もcanvasの保持もしない）
 * @param {boolean} props.isPlaying 再生中か（再生中は生成しない。負荷対策）
 * @param {boolean} props.isProcessing PDF/PNG出力の実行中か（生成しない）
 * @param {boolean} props.hasData 楽譜が読み込まれているか
 * @param {(value: boolean) => void} props.onToggleAutoUpdate
 */
export default function PdfPreview({
  score,
  options,
  active,
  isPlaying,
  isProcessing,
  hasData,
  onToggleAutoUpdate,
}) {
  const t = useT();
  const canvasRef = useRef(null);
  const contentRef = useRef(null);
  const callIdRef = useRef(0);
  const frameTriggerRef = useRef(null);
  // 手動更新モードで「設定が変わった」ことを示すための、直近に生成した
  // score/optionsの参照。世代カウンタ（pdfPreview.js側）とは別に、
  // React state更新の順序を守るためのローカルなガードも兼ねる。
  const lastGeneratedRef = useRef({ score: null, options: null });
  // 拡大表示（PdfPreviewOverlay.jsx）が再利用するPDFのBlob。
  // buildPdfBlobからやり直さないための保持で、閉じても参照は切らない
  // （常時プレビューが持ち続ける現在値そのものであり、開くたびに使い回す）。
  const lastBlobRef = useRef(null);
  // デバウンス時間の出し分け（連続変化か単発の変化か）だけに使う、
  // 直前に見たscore/options。lastGeneratedRef（生成に成功した値）とは
  // 別物で、生成が成功したかどうかに関わらず毎回更新する。
  const prevDepsRef = useRef(null);

  const [phase, setPhase] = useState('idle'); // idle | loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const [isStale, setIsStale] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const autoUpdate = options.previewAutoUpdate !== false;
  // 次のときは生成しない：タブ非表示／デザインセクション閉／楽譜未読込／
  // 再生中／PDF・PNG出力の実行中。
  const shouldGenerate = active && hasData && !isPlaying && !isProcessing;

  const runGenerate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const callId = (callIdRef.current += 1);
    setPhase('loading');
    try {
      // pdfExport.js も pdfjs-dist も pdfPreview.js の中で動的import される
      // （初期バンドルに含めない）。
      const { renderPdfPreview } = await import('../lib/pdfPreview.js');
      const result = await renderPdfPreview(score, options, canvas);
      // 自分より新しい呼び出しが来ていれば、成功・失敗を問わず結果を捨てる。
      if (callId !== callIdRef.current) return;
      if (result === null) return; // pdfPreview.js側の世代遅れ（保険）
      lastGeneratedRef.current = { score, options };
      lastBlobRef.current = result.blob;
      setIsStale(false);
      setErrorMessage('');
      setPhase('ready');
    } catch (err) {
      if (callId !== callIdRef.current) return;
      setErrorMessage(err.message);
      setPhase('error');
    }
  }, [score, options]);

  // 自動更新：依存が変わったらデバウンスして再生成する。連続変化しうる
  // キーだけが変わった（＝スライダーやカラーピッカーの操作中）ときは
  // 長め、それ以外の単発の操作は短めにする。
  useEffect(() => {
    if (!shouldGenerate || !autoUpdate) return undefined;
    const current = { score, options };
    const delay = isContinuousOnlyChange(prevDepsRef.current, current)
      ? CONTINUOUS_DEBOUNCE_MS
      : DISCRETE_DEBOUNCE_MS;
    prevDepsRef.current = current;
    const timer = setTimeout(runGenerate, delay);
    return () => clearTimeout(timer);
  }, [shouldGenerate, autoUpdate, runGenerate, score, options]);

  // 手動更新モード：自動生成しない代わりに、直近の生成以降にPDFの見た目へ
  // 関わる依存が変わったことだけを示す。以前は「一度も生成していない
  // 間はstale扱いにしない」ガードを持っていたが、楽譜未読込のまま
  // マウントした場合（shouldGenerateがfalseで一度も生成できない）に
  // このガードがずっと外れず、その後「楽譜を開く」等でhasDataがtrueに
  // 変わってもstaleにならず更新ボタンが有効化されない不具合になって
  // いた。生成できるかどうか（shouldGenerate）はボタンの活性側で
  // 既に見ているため、ここでは単純に「直近の生成内容と今の内容が違うか」
  // だけを見ればよい。
  useEffect(() => {
    if (autoUpdate) {
      setIsStale(false);
      return;
    }
    const scoreChanged = score !== lastGeneratedRef.current.score;
    const optionsChanged = hasRelevantOptionsChanged(lastGeneratedRef.current.options, options);
    if (scoreChanged || optionsChanged) {
      setIsStale(true);
    }
  }, [score, options, autoUpdate]);

  // アンマウント時・非表示化時にcanvasを縮めてメモリを解放する
  // （PNG出力と同じiOSの対策）。
  useEffect(() => {
    if (active) return undefined;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    return undefined;
  }, [active]);
  useEffect(() => () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }, []);

  // タブを離れて非表示化していたところから再び表示された（active が
  // false→true になった）ときは、自動更新・手動更新の設定に関わらず
  // 必ず1回描き直す。上のデバウンスeffectはscore/options（＝runGenerate
  // の参照）が実際に変わったときしか反応しないため、非表示中に何らかの
  // 理由で更新が失敗していた場合や、直前にzeroにしたcanvasへ非表示化後の
  // 描画が競合して書き込まれた場合に、表示に戻っても空のまま気づけない
  // おそれがあった（原因を1つに特定できていないため、表示に戻った時点で
  // 無条件に描き直すことで結果的に復帰できるようにする防御的な対応）。
  const wasActiveRef = useRef(active);
  useEffect(() => {
    const becameActive = active && !wasActiveRef.current;
    wasActiveRef.current = active;
    if (becameActive && shouldGenerate) {
      runGenerate();
    }
  }, [active, shouldGenerate, runGenerate]);

  const handleManualUpdate = () => {
    if (!shouldGenerate) return;
    runGenerate();
  };

  const handleOpenOverlay = () => {
    if (!lastBlobRef.current) return;
    // 手動更新で未反映の変更があるときは、拡大表示を開くタイミングで
    // 自動的に最新化する。開いた直後は直前のBlobのまま
    // 表示され、生成が終わるとPdfPreviewOverlayへ渡すblob propが
    // 差し替わって自動的に描き直る（自動更新中は既に最新のため対象外）。
    if (!autoUpdate && isStale) runGenerate();
    setOverlayOpen(true);
  };
  // 閉じたら、開くきっかけになった枠へフォーカスを戻す。
  const handleCloseOverlay = () => {
    setOverlayOpen(false);
    frameTriggerRef.current?.focus();
  };

  // 用紙の縦横比だけがsheetLayoutIdで決まる（2面付け=横向き、それ以外=縦向き）。
  // 寸法の元になる数値はpdfConfigから取り、CSSへ直書きしない（二重管理を避ける）。
  const isLandscape = options.sheetLayoutId === 'double';
  const contentAspectRatio = isLandscape
    ? pdfConfig.pageHeightPt / pdfConfig.pageWidthPt
    : pdfConfig.pageWidthPt / pdfConfig.pageHeightPt;
  // 直近に成功した生成の向きと今の向きが違うときは、canvasの中身
  // （直近生成時点の向きのまま描かれた画像）を新しい向きの枠へそのまま
  // 引き伸ばして見せないよう隠す。自動更新ならデバウンスの間だけ一瞬だが、
  // 手動更新モードでは更新するまでずっと残ってしまうため。
  const lastGeneratedIsLandscape = lastGeneratedRef.current.options
    ? lastGeneratedRef.current.options.sheetLayoutId === 'double'
    : null;
  const contentShapeStale = lastGeneratedIsLandscape !== null && lastGeneratedIsLandscape !== isLandscape;
  // 枠（.pdf-preview__frame）は面付けを変えてもデザインセクションの高さが
  // 変わらないよう、常に横向き（2面付け）相当の比率で固定する
  // （用紙比に応じてフレキシブルに変える案は、1面付けで
  // 紙面と背景の境界が分からなくなるため撤回した）。実際の紙面
  // （.pdf-preview__content）は真の比率のまま枠の中いっぱいまでletterboxで
  // 収め、紙面自体の境界線を持つことで枠との違いが分かるようにする。
  const frameAspectRatio = pdfConfig.pageHeightPt / pdfConfig.pageWidthPt;
  // isLandscapeのときcontentAspectRatioはframeAspectRatioと厳密に同じ式
  // （どちらもpageHeightPt/pageWidthPt）になる。この「入れ子のaspect-ratio
  // が親と完全一致する」組み合わせで、実機のcanvasが1x0近くまで潰れる
  // 不具合が発生した（フレーム→自動更新→フレームのタブ切り替えを跨いでも
  // 再現し、面付け変更を挟まなくても2面付けのまま初回から発生した＝
  // 競合状態ではなくCSSレイアウト自体の問題）。この場合はaspect-ratioに
  // 頼らずwidth/height:100%で直接フレーム全体を埋める
  // （`.pdf-preview__content--fill`、index.css）。

  // 右の状態表示ボタンの文言・アイコン・活性（同期ON中は文言を一切
  // 動かさずちらつきを防ぐ設計。通常のtranslated key呼び出しに揃えるため
  // 動的キー生成は使わずif/elseで literal な t() 呼び出しに分ける）。
  const isRendering = phase === 'loading';
  let statusLabel;
  let statusIcon = null;
  if (autoUpdate) {
    statusLabel = t('ui.toolbar.pdf.preview.synced');
    statusIcon = <CheckIcon size={14} />;
  } else if (isRendering) {
    statusLabel = t('ui.toolbar.pdf.preview.updating');
    statusIcon = <span className="pdf-preview__spinner" aria-hidden="true" />;
  } else {
    statusLabel = t('ui.toolbar.pdf.preview.update');
  }
  const statusEnabled = !autoUpdate && !isRendering && isStale && shouldGenerate;

  return (
    <div className="pdf-preview">
      {/* 見出し「プレビュー」は置かない。楽譜未読込時のメッセージ
         （ui.toolbar.pdf.preview.empty）が枠の役割を説明するため、
         見出しがなくても迷わない。 */}
      <button
        type="button"
        ref={frameTriggerRef}
        className={`pdf-preview__frame${hasData ? '' : ' pdf-preview__frame--empty'}`}
        style={{ aspectRatio: frameAspectRatio }}
        onClick={handleOpenOverlay}
        disabled={!lastBlobRef.current}
        aria-label={t('ui.toolbar.pdf.preview.open')}
      >
        <div
          ref={contentRef}
          className={`pdf-preview__content${isLandscape ? ' pdf-preview__content--fill' : ''}`}
          style={isLandscape ? undefined : { aspectRatio: contentAspectRatio }}
        >
          <canvas
            ref={canvasRef}
            className={`pdf-preview__canvas${
              contentShapeStale
                ? ' pdf-preview__canvas--hidden'
                : phase === 'loading' ? ' pdf-preview__canvas--loading' : ''
            }`}
          />
        </div>
        {/* 枠（横長で固定）を基準に中央揃えの横書きで出す。紙面
            （.pdf-preview__content）を基準にすると、1面付けの縦長の中に
            置いたときに1〜2文字ごとに改行されて見切れる。 */}
        {!hasData && (
          <p className="pdf-preview__overlay pdf-preview__overlay--empty">
            {t('ui.toolbar.pdf.preview.empty')}
          </p>
        )}
        {phase === 'loading' && (
          <p className="pdf-preview__overlay pdf-preview__overlay--loading" aria-live="polite">
            {t('ui.toolbar.pdf.preview.updating')}
          </p>
        )}
        {phase === 'error' && (
          <p className="pdf-preview__overlay pdf-preview__overlay--error" role="alert">
            {t('ui.toolbar.pdf.preview.failed', { message: errorMessage })}
          </p>
        )}
      </button>

      <div className="pdf-preview__controls">
        <label className="pdf-preview__sync-toggle">
          {t('ui.toolbar.pdf.preview.sync')}
          <input
            type="checkbox"
            role="switch"
            aria-checked={autoUpdate}
            checked={autoUpdate}
            onChange={(e) => onToggleAutoUpdate(e.target.checked)}
          />
        </label>
        {/* 右のボタンは3状態のみ：同期ON＝常に「最新」で固定・無効（生成中でも文言を
            一切動かさない。ちらつき防止が仕様の核）／同期OFF・未反映の
            変更なし＝「更新」で無効／同期OFF・未反映の変更あり＝「更新」＋
            ドット（＝btn__dot、「JSONを保存」の未保存表示と同じ流儀）で
            有効。幅がラベルの入れ替わりで動かないよう
            .pdf-preview__status-buttonにmin-widthを固定してある。 */}
        <button
          type="button"
          className={`btn btn--sm pdf-preview__status-button ${
            !autoUpdate && !isRendering ? 'btn--primary' : 'btn--ghost'
          }`}
          onClick={handleManualUpdate}
          disabled={!statusEnabled}
          aria-live={autoUpdate ? undefined : 'polite'}
          title={statusEnabled ? t('ui.toolbar.pdf.preview.stale') : undefined}
        >
          {statusIcon}
          {statusLabel}
          {statusEnabled && <span className="btn__dot" aria-hidden="true" />}
        </button>
      </div>

      <p className="pdf-preview__quality-note">{t('ui.toolbar.pdf.preview.qualityNote')}</p>

      {/* ?debug=1 のときだけ、生成しない条件のどれに当たっているかを
          その場で見えるようにする（実機でしか再現しない「プレビューが
          空のままになる」不具合の切り分け用。画面上の診断オーバレイと同じ
          方針：通常利用では一切コストをかけない）。 */}
      {DEBUG_ENABLED && (
        <p className="pdf-preview__debug-note">
          active:{String(active)} hasData:{String(hasData)} isPlaying:{String(isPlaying)}{' '}
          isProcessing:{String(isProcessing)} shouldGenerate:{String(shouldGenerate)} phase:{phase}{' '}
          blob:{String(!!lastBlobRef.current)} contentShapeStale:{String(contentShapeStale)}{' '}
          canvas(bitmap):{canvasRef.current?.width ?? '?'}x{canvasRef.current?.height ?? '?'}{' '}
          canvas(css):{canvasRef.current?.clientWidth ?? '?'}x{canvasRef.current?.clientHeight ?? '?'}{' '}
          content(css):{contentRef.current?.clientWidth ?? '?'}x{contentRef.current?.clientHeight ?? '?'}{' '}
          frame:{frameTriggerRef.current?.clientWidth ?? '?'}x{frameTriggerRef.current?.clientHeight ?? '?'}
        </p>
      )}

      <PdfPreviewOverlay
        isOpen={overlayOpen}
        blob={lastBlobRef.current}
        aspectRatio={contentAspectRatio}
        onClose={handleCloseOverlay}
      />
    </div>
  );
}
