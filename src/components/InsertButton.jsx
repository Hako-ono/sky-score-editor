import { memo } from 'react';

/**
 * グリッド間に表示する挿入ボタン (編集モード時のみ表示)
 *
 * onInsert(index) を内部で呼ぶ形にしているのは、呼び出し側
 * (ScoreCanvas) がインラインのアロー関数を渡さずに済むようにするため。
 * memo は Object.is で props を比較するため、呼び出し側が毎回新しい
 * 関数を作って渡すと props が常に変わったとみなされ memo が素通りする。
 * index は数値、onInsert は呼び出し側で useCallback 済みの安定した
 * 関数、label は文字列（値で比較されるため内容が同じなら毎回作り直し
 * ても等しいと判定される）で、いずれも打鍵では変化しないため memo が効く。
 */
function InsertButton({ index, onInsert, label }) {
  return (
    <button
      type="button"
      className="insert-button"
      onClick={() => onInsert(index)}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 30 30" width="26" height="26" aria-hidden="true">
        <circle cx="15" cy="15" r="14" />
        <line x1="15" y1="8" x2="15" y2="22" />
        <line x1="8" y1="15" x2="22" y2="15" />
      </svg>
    </button>
  );
}

export default memo(InsertButton);
