export default function EmptyState({ onLoadFile, hasDraft, onRestoreDraft }) {
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
      <p className="empty-state__title">楽譜がまだありません</p>
      <p className="empty-state__body">
        「楽譜を開く」から既存の楽譜を読み込めます。空の楽譜はツールバーの「新規作成」から作成できます。
      </p>
      <p className="empty-state__hint">
        新規作成すると編集モードになります。グリッドの鍵をクリックして音を置いてください。
      </p>
      <div className="empty-state__actions">
        <label className="btn btn--primary file-label">
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
        {hasDraft && (
          <button type="button" className="btn btn--ghost" onClick={onRestoreDraft}>
            前回の続きを復元
          </button>
        )}
      </div>
    </div>
  );
}
