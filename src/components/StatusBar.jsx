import { AutoScrollIcon, CloseIcon, LoopIcon } from './icons.jsx';
import { useT } from '../i18n/LanguageContext.jsx';

/** ステータス表示。role/aria-live でスクリーンリーダーへ通知する。 */
export default function StatusBar({ message, type, action, compactIcon, onClose }) {
  const t = useT();
  if (!message) return null;
  const isError = type === 'error' || type === 'warning';
  const isCompact = Boolean(compactIcon && !action);
  const leadingIcon = compactIcon === 'loop'
    ? <LoopIcon size={17} />
    : compactIcon === 'autoScroll'
      ? <AutoScrollIcon size={17} />
      : null;
  return (
    <div
      className={`status-bar status-bar--toast${isCompact ? ' status-bar--compact' : ''} status-${type}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      {leadingIcon && <span className="status-bar__icon">{leadingIcon}</span>}
      <span className="status-bar__message">{message}</span>
      {action && (
        <button
          type="button"
          className="status-bar__action"
          onClick={() => {
            action.onClick();
            // 実行済みの操作を案内し続けても意味がないため、押したら閉じる
            if (onClose) onClose();
          }}
        >
          {action.label}
        </button>
      )}
      {onClose && !isCompact && (
        <button
          type="button"
          className="status-bar__close"
          onClick={onClose}
          aria-label={t('ui.statusBar.close')}
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
}
