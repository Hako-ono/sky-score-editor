import { memo, useEffect, useRef } from 'react';
import { useT } from '../i18n/LanguageContext.jsx';
import NoteGridSvg from './NoteGridSvg.jsx';
import { useIsActiveGrid } from '../contexts/ActiveGridContext.jsx';
import { useGrid, useIsPendingFocus, useScoreGridsStore } from '../contexts/ScoreGridsContext.jsx';
import { CloseIcon } from './icons.jsx';
import { getAudibleKeys, getOtherLayerKeys, getSelectedLayerKeys } from '../lib/scoreLayers.js';

// interactive=false の NoteGridSvg は onToggleKey を呼ばないが、
// 毎レンダーで新しい関数を渡さないようモジュールスコープに置く
const noop = () => {};

/**
 * スマートフォン一覧専用の軽量カード。鍵盤・入力欄・再生ボタンを持たず、
 * タップで拡大表示（GridOverlay）を開く。鍵盤や入力欄を持たないぶん
 * GridCard より軽い（一覧のグリッド数が多いほど効いてくる）。
 */
function GridCardCompact({
  index,
  editMode,
  selectedLayer,
  usesTwoLayers,
  usesSecondHighlightColor,
  onExpand,
  onDelete,
}) {
  const t = useT();
  // props ではなく自分の index でストアから引く。DELETE 直後の1フレームでは
  // undefined になりうる（GridCard.jsx と同じ理由）。
  const grid = useGrid(index);
  const isActive = useIsActiveGrid(index);
  const store = useScoreGridsStore();

  // GridOverlay を閉じたとき、画面外（未マウント）だったこのカードに
  // 保留フォーカスが予約されていれば、マウントされた今フォーカスする。
  // GridOverlay 側は自前でスクロール位置を決めた後なので
  // preventScroll: true でブラウザに動かされないようにする
  // （GridOverlay.jsx の元々の意図をそのまま維持）。
  const isPendingFocus = useIsPendingFocus(index);
  const tapRef = useRef(null);
  useEffect(() => {
    if (!isPendingFocus) return;
    tapRef.current?.focus({ preventScroll: true });
    store.clearPendingFocus(index);
  }, [isPendingFocus, index, store]);

  if (!grid) return null;
  const selectedKeys = getSelectedLayerKeys(grid, selectedLayer);
  const otherKeys = getOtherLayerKeys(grid, selectedLayer);
  const isEmpty = getAudibleKeys(grid).length === 0;

  return (
    <div
      className={`grid-card grid-card--compact${isEmpty ? ' is-empty' : ''}${
        grid.forceBreakAfter ? ' has-break' : ''
      }${isActive ? ' is-playing' : ''}`}
    >
      <div className="grid-card__header">
        <span className="grid-card__number">{index + 1}</span>
        {editMode && (
          <div className="grid-card__controls">
            <button
              type="button"
              className="icon-btn delete-btn"
              onClick={() => onDelete(index)}
              aria-label={t('ui.gridCard.delete', { n: index + 1 })}
              title={t('ui.gridCard.deleteTitle')}
            >
              <CloseIcon />
            </button>
          </div>
        )}
      </div>

      {/* 削除ボタンを内側に入れると button の入れ子になるため、
          タップ領域はヘッダの外に分ける */}
      <button
        ref={tapRef}
        type="button"
        className="grid-card__tap"
        onClick={() => onExpand(index)}
        aria-label={t('ui.gridCard.expand', { n: index + 1 })}
      >
        <NoteGridSvg
          selectedKeys={selectedKeys}
          otherKeys={otherKeys}
          usesTwoLayers={usesTwoLayers}
          usesSecondHighlightColor={usesSecondHighlightColor}
          onToggleKey={noop}
          interactive={false}
        />
        <span className="grid-card__text-view">{grid.text}</span>
      </button>
    </div>
  );
}
export default memo(GridCardCompact);
