import { UndoIcon, RedoIcon } from './icons.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

/**
 * 「元に戻す／やり直す」の浮遊ボタン。ツールバー内の同じボタンは
 * 残してあり、こちらは追加の導線。モバイルではツールバーが既定で
 * 最小化されており、さらに音符編集は拡大表示の中で行われるため、
 * ツールバー側だけでは編集中に手が届かない。
 */
export default function HistoryFab({ canUndo, canRedo, onUndo, onRedo }) {
  const t = useT();
  return (
    <div className="history-fab">
      <button
        type="button"
        className="history-fab__btn"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label={t('ui.toolbar.score.undo')}
        title={t('ui.toolbar.score.undoTitle')}
      >
        <UndoIcon />
      </button>
      <span className="history-fab__sep" aria-hidden="true" />
      <button
        type="button"
        className="history-fab__btn"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label={t('ui.toolbar.score.redo')}
        title={t('ui.toolbar.score.redoTitle')}
      >
        <RedoIcon />
      </button>
    </div>
  );
}
