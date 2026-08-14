import { CloseIcon } from './icons.jsx';

/** ステータス表示。role/aria-live でスクリーンリーダーへ通知する。 */
export default function StatusBar({ message, type, action, onClose }) {
  if (!message) return null;
  const isError = type === 'error' || type === 'warning';
  return (
    <div
      className={`status-bar status-bar--toast status-${type}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
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
      {onClose && (
        <button
          type="button"
          className="status-bar__close"
          onClick={onClose}
          aria-label="通知を閉じる"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
}
