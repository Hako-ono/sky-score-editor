import { useT } from '../i18n/LanguageContext.jsx';

export default function EmptyState({ onLoadFile, hasDraft, onRestoreDraft }) {
  const t = useT();
  return (
    <div className="empty-state">
      <div className="empty-state__mark" aria-hidden="true">
        <svg viewBox="0 0 120 80" width="120" height="80">
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3, 4].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={8 + c * 22}
                y={8 + r * 22}
                width="16"
                height="16"
                rx="3"
              />
            )),
          )}
        </svg>
      </div>
      <p className="empty-state__title">{t('ui.emptyState.title')}</p>
      <p className="empty-state__body">
        {t('ui.emptyState.body')}
      </p>
      <p className="empty-state__hint">
        {t('ui.emptyState.hint')}
      </p>
      <div className="empty-state__actions">
        <label className="btn btn--primary file-label">
          {t('ui.toolbar.openScore')}
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
        {hasDraft && (
          <button type="button" className="btn btn--ghost" onClick={onRestoreDraft}>
            {t('ui.emptyState.restoreDraft')}
          </button>
        )}
      </div>
    </div>
  );
}
