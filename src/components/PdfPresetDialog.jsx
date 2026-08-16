import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CloseIcon } from './icons.jsx';
import { useT } from '../i18n/LanguageContext.jsx';
import {
  MAX_PDF_PRESET_INPUT_LENGTH,
  MAX_PDF_PRESET_MEMO_CODE_POINTS,
  MAX_PDF_PRESET_NAME_CODE_POINTS,
} from '../lib/pdfPresetConstants.js';
import { readPdfPresetFragment } from '../lib/pdfPresetUrl.js';

const ERROR_MESSAGE_KEYS = {
  'input-too-large': 'inputTooLarge',
  'invalid-input': 'invalidInput',
  'invalid-code': 'invalidCode',
  'invalid-base64': 'invalidBase64',
  'compressed-too-large': 'compressedTooLarge',
  'json-too-large': 'jsonTooLarge',
  'invalid-utf8': 'invalidUtf8',
  'invalid-json': 'invalidJson',
  'invalid-settings': 'invalidSettings',
  'invalid-settings-group': 'invalidSettingsGroup',
  'unsupported-version': 'unsupportedVersion',
  'unsupported-browser': 'unsupportedBrowser',
  'foreign-origin': 'foreignOrigin',
  'not-pdf-preset': 'notPdfPreset',
  'qr-not-found': 'qrNotFound',
  'decode-failed': 'decodeFailed',
  'canvas-failed': 'canvasFailed',
  'unsupported-type': 'unsupportedType',
  'file-too-large': 'fileTooLarge',
  'encode-failed': 'encodeFailed',
  'draw-failed': 'drawFailed',
  'save-failed': 'saveFailed',
};

function codePointLimit(value, max) {
  return [...value].slice(0, max).join('');
}

function getErrorMessage(translate, error, fallbackKey) {
  const key = ERROR_MESSAGE_KEYS[error?.code];
  return translate(`ui.pdfPresetDialog.error.${key || fallbackKey}`);
}

function focusableElements(root) {
  return [...root.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hasAttribute('hidden'));
}

function copyTextFallback(value) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
}

export default function PdfPresetDialog({
  mode,
  initialImportText = '',
  initialError = '',
  pdfPrefs,
  scoreContext,
  onApply,
  onClose,
}) {
  const t = useT();
  const dialogRef = useRef(null);
  const cardCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const aliveRef = useRef(true);
  const initialImportHandledRef = useRef(false);
  const generationRef = useRef(0);
  const fileRequestRef = useRef(0);
  const qrLoaderRef = useRef(null);
  const copyTimerRef = useRef(null);
  const [name, setName] = useState('');
  const [memo, setMemo] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [matrix, setMatrix] = useState(null);
  const [qrApi, setQrApi] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [copyStatus, setCopyStatus] = useState(null);
  const [manualCopyValue, setManualCopyValue] = useState('');
  const [importText, setImportText] = useState(initialImportText);
  const [imported, setImported] = useState(null);
  const [diff, setDiff] = useState([]);
  const [cardDrawn, setCardDrawn] = useState(false);

  useEffect(() => {
    // React Strict Modeは開発時にeffectをsetup→cleanup→setupと再実行する。
    // setupでもtrueへ戻さないと、正常な非同期結果までunmount後として捨ててしまう。
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      generationRef.current += 1;
      fileRequestRef.current += 1;
      qrLoaderRef.current?.cancel();
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    const frame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(() => {
        const target = mode === 'export'
          ? dialogRef.current?.querySelector('#pdf-preset-name')
          : dialogRef.current?.querySelector('#pdf-preset-import-text');
        target?.focus();
      })
      : null;
    return () => {
      if (frame !== null && typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(frame);
      }
    };
  }, [mode]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const elements = focusableElements(dialogRef.current);
    if (elements.length === 0) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const generateExport = useCallback(async () => {
    const generation = ++generationRef.current;
    const presetName = name.trim();
    setBusy(true);
    setError('');
    setShareUrl('');
    setMatrix(null);
    try {
      const [codec, qr] = await Promise.all([
        import('../lib/pdfPresetCodec.js'),
        import('../lib/pdfQr.js'),
      ]);
      const nextCode = await codec.encodePdfPreset({ name: presetName, memo, prefs: pdfPrefs });
      if (!aliveRef.current || generation !== generationRef.current) return;
      setQrApi(qr);
      const locationLike = globalThis.location;
      const baseUrl = locationLike
        ? `${locationLike.pathname}${locationLike.search}`
        : '/';
      const nextUrl = codec.buildPdfPresetUrl(nextCode, locationLike, baseUrl);
      setShareUrl(nextUrl);
      const nextMatrix = qr.generatePdfQrMatrix(nextUrl);
      if (!aliveRef.current || generation !== generationRef.current) return;
      setMatrix(nextMatrix);
    } catch (caught) {
      if (!aliveRef.current || generation !== generationRef.current) return;
      setError(getErrorMessage(t, caught, 'exportCode'));
      setMatrix(null);
    } finally {
      if (aliveRef.current && generation === generationRef.current) setBusy(false);
    }
  }, [memo, name, pdfPrefs, t]);

  useEffect(() => {
    if (mode !== 'export') return undefined;
    const timer = setTimeout(generateExport, 250);
    return () => clearTimeout(timer);
  }, [generateExport, mode, name]);

  useEffect(() => {
    if (!qrApi || !matrix || !shareUrl || !cardCanvasRef.current) return;
    try {
      qrApi.buildPdfPresetQrCardCanvas({
        text: shareUrl,
        matrix,
        name: name.trim(),
        memo,
        canvas: cardCanvasRef.current,
      });
      setCardDrawn(true);
    } catch (caught) {
      setError(getErrorMessage(t, caught, 'exportQr'));
    }
  }, [matrix, memo, name, qrApi, shareUrl, t]);

  const setImportedResult = useCallback((decoded, codec) => {
    setImported(decoded);
    setDiff(codec.buildPdfPresetDiff(pdfPrefs, decoded.prefs, scoreContext));
    setError('');
  }, [pdfPrefs, scoreContext]);

  const importCodeText = useCallback(async (text) => {
    if (typeof text !== 'string' || text.length > MAX_PDF_PRESET_INPUT_LENGTH) {
      setError(t('ui.pdfPresetDialog.error.inputTooLarge'));
      return;
    }
    setBusy(true);
    setError('');
    setImported(null);
    setDiff([]);
    try {
      const [codec, qr] = await Promise.all([
        import('../lib/pdfPresetCodec.js'),
        import('../lib/pdfQr.js'),
      ]);
      const extracted = codec.extractPdfPresetCode(text);
      if (!extracted) {
        const caught = new Error('not-pdf-preset');
        caught.code = 'not-pdf-preset';
        throw caught;
      }
      if (!qr.isPdfPresetTextSameOrigin(text, globalThis.location)) {
        const caught = new Error('foreign-origin');
        caught.code = 'foreign-origin';
        throw caught;
      }
      const decoded = await codec.decodePdfPresetCode(extracted, scoreContext);
      setImportedResult({ ...decoded, code: extracted, text }, codec);
    } catch (caught) {
      setError(getErrorMessage(t, caught, 'importCode'));
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [scoreContext, setImportedResult, t]);

  useEffect(() => {
    if (mode !== 'import' || initialError || !initialImportText || initialImportHandledRef.current) return;
    initialImportHandledRef.current = true;
    importCodeText(initialImportText);
  }, [importCodeText, initialError, initialImportText, mode]);

  const handleImportSubmit = () => {
    const trimmed = importText.trim();
    if (trimmed) importCodeText(trimmed);
  };

  const handleQrFile = async (file) => {
    const requestId = ++fileRequestRef.current;
    setBusy(true);
    setError('');
    setImported(null);
    setDiff([]);
    try {
      const [imageModule, qr] = await Promise.all([
        import('../lib/qrImage.js'),
        import('../lib/pdfQr.js'),
      ]);
      if (!qrLoaderRef.current) qrLoaderRef.current = imageModule.createQrImageLoader();
      const result = await qrLoaderRef.current.load(file);
      if (!aliveRef.current || requestId !== fileRequestRef.current || result === null) return;
      const decoded = qr.decodePdfPresetQrImageData(
        result.imageData,
        scoreContext,
        globalThis.location,
      );
      const codec = await import('../lib/pdfPresetCodec.js');
      setImportedResult(await decoded, codec);
    } catch (caught) {
      if (aliveRef.current && requestId === fileRequestRef.current) {
        setError(getErrorMessage(t, caught, 'importQr'));
      }
    } finally {
      if (aliveRef.current && requestId === fileRequestRef.current) setBusy(false);
    }
  };

  const handleCopy = async (value, label) => {
    let copied = false;
    try {
      if (globalThis.navigator?.clipboard && typeof globalThis.navigator.clipboard.writeText === 'function') {
        await globalThis.navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) copied = copyTextFallback(value);
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    if (copied) {
      setManualCopyValue('');
      setCopyStatus({ ok: true, message: t('ui.pdfPresetDialog.copy.success', { label }) });
      // 成功の合図は読めば用済みなので自動で引っ込める。押すたびに残ると、
      // ボタンの下に古い通知が積まれたまま見えてしまう
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null;
        if (aliveRef.current) setCopyStatus(null);
      }, 2600);
    } else {
      // 失敗時は下の手動コピー欄の説明を兼ねるため消さない
      copyTimerRef.current = null;
      setManualCopyValue(value);
      setCopyStatus({ ok: false, message: t('ui.pdfPresetDialog.copy.failure') });
    }
  };

  const handleSaveCard = async () => {
    if (!qrApi || !matrix || !shareUrl || busy) return;
    setBusy(true);
    setError('');
    try {
      const canvas = cardCanvasRef.current || document.createElement('canvas');
      const presetName = name.trim();
      qrApi.buildPdfPresetQrCardCanvas({ text: shareUrl, matrix, name: presetName, memo, canvas });
      await qrApi.savePdfPresetQrCard(canvas, presetName);
    } catch (caught) {
      setError(getErrorMessage(t, caught, 'saveFailed'));
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };

  const handleApply = () => {
    if (!imported || busy) return;
    onApply(imported.prefs);
    onClose();
  };

  const titleId = 'pdf-preset-dialog-title';
  const leadId = 'pdf-preset-dialog-lead';
  const isExport = mode === 'export';
  // 書き出しの「更新中」は入力のたびに出入りする。ここへ置くと本文が上下し、
  // 入力欄そのものが動いてしまうため、高さを確保済みのカード側へ表示する
  const hasMessage = Boolean(error || (busy && !isExport));
  const changedSections = diff.filter((section) => section.changed);
  const unchangedLabels = diff.filter((section) => !section.changed).map((section) => section.label);
  return (
    <div
      className="pdf-preset-dialog__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="pdf-preset-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={leadId}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="pdf-preset-dialog__header">
          <h2 id={titleId}>{t(isExport ? 'ui.pdfPresetDialog.title.export' : 'ui.pdfPresetDialog.title.import')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('ui.pdfPresetDialog.close')}>
            <CloseIcon />
          </button>
        </div>

        {/* 通知の位置をモードによらず1か所へ固定する。節の途中に出すと、
            スクロール位置によっては結果に気づけない */}
        {hasMessage && (
          <div className="pdf-preset-dialog__messages">
            {busy && !isExport && <p className="pdf-preset-dialog__status" role="status">{t('ui.pdfPresetDialog.loading')}</p>}
            {error && <p className="pdf-preset-dialog__error" role="alert">{error}</p>}
          </div>
        )}

        {isExport ? (
          <div className="pdf-preset-dialog__body">
            <p id={leadId} className="pdf-preset-dialog__lead">
              {t('ui.pdfPresetDialog.exportLead')}
            </p>
            <section className="pdf-preset-dialog__section" aria-labelledby="pdf-preset-group-info">
              <h3 className="pdf-preset-dialog__section-title" id="pdf-preset-group-info">{t('ui.pdfPresetDialog.info')}</h3>
              <div className="pdf-preset-dialog__fields">
                <label className="pdf-preset-dialog__field" htmlFor="pdf-preset-name">
                  <span>{t('ui.pdfPresetDialog.name')}</span>
                  <input
                    id="pdf-preset-name"
                    className="text-input"
                    type="text"
                    value={name}
                    maxLength={MAX_PDF_PRESET_NAME_CODE_POINTS}
                    onChange={(event) => setName(codePointLimit(
                      event.target.value,
                      MAX_PDF_PRESET_NAME_CODE_POINTS,
                    ))}
                  />
                </label>
                <label className="pdf-preset-dialog__field" htmlFor="pdf-preset-memo">
                  <span>{t('ui.pdfPresetDialog.memo')}</span>
                  <textarea
                    id="pdf-preset-memo"
                    className="text-input pdf-preset-dialog__textarea"
                    value={memo}
                    maxLength={MAX_PDF_PRESET_MEMO_CODE_POINTS}
                    rows={3}
                    onChange={(event) => setMemo(codePointLimit(
                      event.target.value,
                      MAX_PDF_PRESET_MEMO_CODE_POINTS,
                    ))}
                  />
                </label>
              </div>
              <p className="pdf-preset-dialog__hint">{t('ui.pdfPresetDialog.exportHint')}</p>
            </section>

            {/* 入力のたびにQRを作り直すが、節ごと消すと本文の高さが変わり、
                スクロール位置とともに入力欄まで動いてしまう。Canvasは前回の
                描画を保ったまま置いておき、新しい行列が来たら描き替える */}
            <section className="pdf-preset-dialog__section" aria-labelledby="pdf-preset-group-card">
              <h3 className="pdf-preset-dialog__section-title" id="pdf-preset-group-card">{t('ui.pdfPresetDialog.qrCard')}</h3>
              <div className="pdf-preset-dialog__card-preview">
                {busy && <p className="pdf-preset-dialog__card-busy" role="status">{t('ui.pdfPresetDialog.qrUpdate')}</p>}
                <canvas
                  ref={cardCanvasRef}
                  className={`pdf-preset-dialog__card${cardDrawn ? '' : ' pdf-preset-dialog__card--blank'}`}
                  role="img"
                  aria-label={t('ui.pdfPresetDialog.qrCardAria')}
                />
              </div>
              <div className="pdf-preset-dialog__actions pdf-preset-dialog__actions--center">
                <button type="button" className="btn btn--sm btn--primary" disabled={busy || !matrix} onClick={handleSaveCard}>
                  {t('ui.pdfPresetDialog.saveQrCard')}
                </button>
              </div>
              <p className="pdf-preset-dialog__hint">{t('ui.pdfPresetDialog.pngHint')}</p>
            </section>

            <section className="pdf-preset-dialog__section" aria-labelledby="pdf-preset-group-url">
              <h3 className="pdf-preset-dialog__section-title" id="pdf-preset-group-url">{t('ui.pdfPresetDialog.shareUrl')}</h3>
              <textarea
                id="pdf-preset-share-url"
                className="text-input pdf-preset-dialog__code"
                aria-label={t('ui.pdfPresetDialog.shareUrl')}
                readOnly
                value={shareUrl}
              />
              {/* コピーの結果はボタンの隣に出す。ダイアログ上端の通知欄だと、
                  ここまでスクロールしている利用者の視界に入らない */}
              <div className="pdf-preset-dialog__actions pdf-preset-dialog__actions--copy">
                <button type="button" className="btn btn--sm btn--ghost" disabled={!shareUrl} onClick={() => handleCopy(shareUrl, t('ui.pdfPresetDialog.shareUrl'))}>
                  {t('ui.pdfPresetDialog.copyUrl')}
                </button>
                {copyStatus && (
                  <p
                    className={`pdf-preset-dialog__copy-status${copyStatus.ok ? '' : ' pdf-preset-dialog__copy-status--error'}`}
                    role="status"
                  >
                    {copyStatus.message}
                  </p>
                )}
              </div>
              <p className="pdf-preset-dialog__hint">{t('ui.pdfPresetDialog.shareHint')}</p>
              {manualCopyValue && (
                <textarea
                  className="text-input pdf-preset-dialog__code"
                  aria-label={t('ui.pdfPresetDialog.manualCopy')}
                  readOnly
                  value={manualCopyValue}
                  onFocus={(event) => event.target.select()}
                />
              )}
            </section>

            <p className="pdf-preset-dialog__note">{t('ui.pdfPresetDialog.exportNote')}</p>
          </div>
        ) : (
          <div className="pdf-preset-dialog__body">
            <p id={leadId} className="pdf-preset-dialog__lead">
              {t('ui.pdfPresetDialog.importLead')}
            </p>
            <section className="pdf-preset-dialog__section" aria-labelledby="pdf-preset-group-source">
              <h3 className="pdf-preset-dialog__section-title" id="pdf-preset-group-source">{t('ui.pdfPresetDialog.source')}</h3>
              <label className="pdf-preset-dialog__field" htmlFor="pdf-preset-import-text">
                <span>{t('ui.pdfPresetDialog.shareUrl')}</span>
                <textarea
                  id="pdf-preset-import-text"
                  className="text-input pdf-preset-dialog__code"
                  value={importText}
                  maxLength={MAX_PDF_PRESET_INPUT_LENGTH}
                  rows={5}
                  onChange={(event) => setImportText(event.target.value)}
                />
              </label>
              <div className="pdf-preset-dialog__actions">
                <button type="button" className="btn btn--sm btn--primary" disabled={busy || !importText.trim()} onClick={handleImportSubmit}>
                  {t('ui.pdfPresetDialog.loadUrl')}
                </button>
                <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                  {t('ui.pdfPresetDialog.chooseQr')}
                </button>
                <input
                  ref={fileInputRef}
                  className="pdf-preset-dialog__file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) handleQrFile(file);
                  }}
                />
              </div>
              <p className="pdf-preset-dialog__hint">{t('ui.pdfPresetDialog.importHint')}</p>
            </section>

            {imported && (
              <section className="pdf-preset-dialog__section" aria-labelledby="pdf-preset-group-review">
                <h3 className="pdf-preset-dialog__section-title" id="pdf-preset-group-review">{t('ui.pdfPresetDialog.review')}</h3>
                <dl className="pdf-preset-dialog__meta">
                  <dt>{t('ui.pdfPresetDialog.name')}</dt>
                  <dd>{imported.name || t('ui.pdfPresetDialog.nameValueEmpty')}</dd>
                  <dt>{t('ui.pdfPresetDialog.memo')}</dt>
                  <dd>{imported.memo || t('ui.pdfPresetDialog.memoValueEmpty')}</dd>
                </dl>
                <div className="pdf-preset-dialog__diff" aria-label={t('ui.pdfPresetDialog.diff')}>
                  {changedSections.map((section) => (
                    <section key={section.id} className="pdf-preset-dialog__diff-section">
                      <h4>{section.label}</h4>
                      <ul>
                        {section.changes.map((change) => (
                          <li key={change.key}>{t('ui.pdfPresetDialog.diffChange', change)}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  {changedSections.length === 0 && (
                    <p className="pdf-preset-dialog__diff-empty">{t('ui.pdfPresetDialog.diffEmpty')}</p>
                  )}
                </div>
                {/* 変更のない節まで見出しで並べると、変わった項目が埋もれる */}
                {unchangedLabels.length > 0 && (
                  <p className="pdf-preset-dialog__hint">{t('ui.pdfPresetDialog.unchanged', { labels: unchangedLabels.join('、') })}</p>
                )}
              </section>
            )}

            <p className="pdf-preset-dialog__note">{t('ui.pdfPresetDialog.importNote')}</p>
          </div>
        )}

        <div className="pdf-preset-dialog__footer">
          {isExport ? (
            <button type="button" className="btn btn--primary" onClick={onClose}>{t('ui.pdfPresetDialog.close')}</button>
          ) : (
            <>
              <button type="button" className="btn btn--ghost" onClick={onClose}>{t('ui.pdfPresetDialog.cancel')}</button>
              <button type="button" className="btn btn--primary" disabled={!imported || busy} onClick={handleApply}>{t('ui.pdfPresetDialog.apply')}</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export function getPdfPresetDialogUrlState(locationLike) {
  return readPdfPresetFragment(locationLike);
}
