import { memo, useEffect, useRef } from 'react';
import { useT } from '../i18n/LanguageContext.jsx';
import NoteGridSvg from './NoteGridSvg.jsx';
import { useIsActiveGrid } from '../contexts/ActiveGridContext.jsx';
import { useGrid, useIsPendingFocus, useScoreGridsStore } from '../contexts/ScoreGridsContext.jsx';
import { getAudibleKeys, getOtherLayerKeys, getSelectedLayerKeys } from '../lib/scoreLayers.js';
import { useRangeGridFlags, useRangeSelectionStore } from '../contexts/RangeSelectionContext.jsx';
import {
  RANGE_SELECTED,
  RANGE_SELECTION_END,
  RANGE_SELECTION_START,
  selectedRange,
} from '../lib/rangeSelectionStore.js';
import { useRangeSelectionGesture } from '../hooks/useRangeSelectionGesture.js';
import CaretSlot from './CaretSlot.jsx';

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
  selectedLayer,
  usesTwoLayers,
  usesSecondHighlightColor,
  onExpand,
  showCaretSlots = false,
  isRowStart = false,
  isRowEnd = false,
  gridCount = 0,
}) {
  const t = useT();
  // props ではなく自分の index でストアから引く。構造編集直後の1フレームでは
  // undefined になりうる（GridCard.jsx と同じ理由）。
  const grid = useGrid(index);
  const isActive = useIsActiveGrid(index);
  const store = useScoreGridsStore();
  const rangeStore = useRangeSelectionStore();
  const rangeFlags = useRangeGridFlags(index);
  const isRangeSelected = (rangeFlags & RANGE_SELECTED) !== 0;
  const isRangeEdge = (rangeFlags & (RANGE_SELECTION_START | RANGE_SELECTION_END)) !== 0;
  const { isPressing, gestureProps, consumeClick } = useRangeSelectionGesture({
    index,
    rangeStore,
    gridStore: store,
    ignoreInteractive: false,
  });

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
      }${isActive ? ' is-playing' : ''}${isRangeSelected ? ' is-range-selected' : ''}${
        isRangeEdge ? ' is-range-edge' : ''
      }${
        isPressing ? ' is-long-pressing' : ''
      }`}
      data-grid-index={index}
      aria-selected={isRangeSelected || undefined}
      {...gestureProps}
      onClick={(event) => {
        if (consumeClick(event)) return;
        if (event.shiftKey) {
          rangeStore.extendSelectionToGrid(index);
        } else if (selectedRange(rangeStore.getState())) {
          rangeStore.selectIndex(index);
        } else if (event.target.closest('.grid-card__tap')) {
          onExpand(index);
        }
      }}
    >
      {showCaretSlots && (
        <CaretSlot
          insertIndex={index}
          placement="before"
          gridCount={gridCount}
          isRowStart={isRowStart}
        />
      )}
      {showCaretSlots && isRowEnd && (
        <CaretSlot insertIndex={index + 1} placement="after" gridCount={gridCount} />
      )}
      <div className="grid-card__header">
        <span className="grid-card__number">{index + 1}</span>
      </div>

      <button
        ref={tapRef}
        type="button"
        className="grid-card__tap"
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
