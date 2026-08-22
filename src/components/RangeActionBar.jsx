import { useLayoutEffect, useRef } from 'react';
import { useT } from '../i18n/LanguageContext.jsx';
import { selectedRange } from '../lib/rangeSelectionStore.js';
import { useRangeSelectionState } from '../contexts/RangeSelectionContext.jsx';
import { useFadePresence } from '../hooks/useFadePresence.js';
import {
  AddGridIcon,
  ChevronIcon,
  CloseIcon,
  CopyIcon,
  CutIcon,
  PasteIcon,
  TrashIcon,
} from './icons.jsx';

export default function RangeActionBar({
  visible,
  gridCount,
  onCollapse,
  onExpand,
  onInsert,
  insertDisabled = false,
  insertDisabledTitle = '',
  onPaste,
  onCopy,
  onCut,
  onDelete,
  onClearSelection,
  onHeightChange,
}) {
  const t = useT();
  const state = useRangeSelectionState();
  const range = selectedRange(state);
  const selectedCount = range ? range.end - range.start + 1 : 0;
  // 拡大表示が開いているあいだの選択では、どのグリッドを指して
  // いるかは拡大表示そのものが示している。ここで番号と件数をもう一度出すと、
  // 同じことを言う要素が画面に2つ並ぶ。解除も拡大表示を閉じれば済むので、
  // 状態表示の行ごと出さない
  const isTransientSelection = state.transientSelectionIndex >= 0;
  const showContext = range !== null && !isTransientSelection;
  // たたんだ姿の件数も同じ理由で出さない。開いていても閉じていても、
  // 拡大表示中は「どのグリッドか」を言うのは拡大表示だけにする
  const showCollapsedCount = selectedCount > 0 && !isTransientSelection;
  const barRef = useRef(null);
  const { shouldRender, fadeClassName } = useFadePresence(visible);

  useLayoutEffect(() => {
    const node = barRef.current;
    if (!node) return undefined;
    const updateHeight = () => {
      const height = node.getBoundingClientRect().height;
      // 非表示時の0pxで最後の実寸を消すと、表示判定のrootMarginも0になり
      // 境界で表示と非表示を往復するため、正の実寸だけを親へ渡す。
      if (height > 0) onHeightChange?.(height);
    };
    updateHeight();
    const observer = typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver(updateHeight)
      : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [onHeightChange, selectedCount, shouldRender, state.actionBarOpen, state.showExtendHint]);

  if (!shouldRender) return null;

  if (!state.actionBarOpen) {
    const expandLabel = showCollapsedCount
      ? t('ui.range.expandBarWithCount', { count: selectedCount })
      : t('ui.range.expandBar');
    return (
      <button
        type="button"
        ref={barRef}
        className={`range-action-bar__expand ${fadeClassName}`}
        onClick={onExpand}
        aria-label={expandLabel}
        title={expandLabel}
      >
        <ChevronIcon direction="up" />
        {showCollapsedCount && (
          <span>{t('ui.range.selectionCount', { count: selectedCount })}</span>
        )}
      </button>
    );
  }

  const hasClipboard = state.clipboard.length > 0;
  const cannotRemoveAll = selectedCount === gridCount;
  return (
    <div
      className={`range-action-bar${showContext ? ' has-context' : ''} ${fadeClassName}`}
      ref={barRef}
      role="toolbar"
      aria-label={t(range ? 'ui.range.barLabel' : 'ui.range.caretLabel')}
    >
      {showContext && (
        <div className="range-action-bar__context">
          <div className="range-action-bar__context-copy">
            <div className="range-action-bar__summary" aria-live="polite">
              {range.start === range.end
                ? t('ui.range.selectedOne', { start: range.start + 1 })
                : t('ui.range.selected', {
                  start: range.start + 1,
                  end: range.end + 1,
                  count: range.end - range.start + 1,
                })}
            </div>
            {state.showExtendHint && (
              <div className="range-action-bar__hint">{t('ui.range.extendHint')}</div>
            )}
          </div>
          <button
            type="button"
            className="icon-btn range-action-bar__clear"
            onClick={onClearSelection}
            aria-label={t('ui.range.clearSelection')}
            title={t('ui.range.clearSelection')}
          >
            <CloseIcon />
          </button>
        </div>
      )}
      <div className="range-action-bar__button-row">
        <div className="range-action-bar__actions">
          <div className="range-action-bar__group">
            <button
              type="button"
              className="btn btn--ghost range-action"
              onClick={onCopy}
              disabled={!range}
              aria-label={t('ui.range.copy')}
            >
              <CopyIcon />
              <span className="range-action__wide">{t('ui.range.copy')}</span>
              <span className="range-action__short">{t('ui.range.copyShort')}</span>
            </button>
            <button
              type="button"
              className="btn btn--ghost range-action"
              onClick={onCut}
              disabled={!range || cannotRemoveAll}
              aria-label={t('ui.range.cut')}
              title={cannotRemoveAll ? t('ui.range.cannotRemoveAll') : t('ui.range.cut')}
            >
              <CutIcon />
              <span className="range-action__wide">{t('ui.range.cut')}</span>
              <span className="range-action__short">{t('ui.range.cutShort')}</span>
            </button>
            <button
              type="button"
              className="btn btn--ghost range-action range-action--danger"
              onClick={onDelete}
              disabled={!range || cannotRemoveAll}
              aria-label={t('ui.range.delete')}
              title={cannotRemoveAll ? t('ui.range.cannotRemoveAll') : t('ui.range.delete')}
            >
              <TrashIcon />
              <span className="range-action__wide">{t('ui.range.delete')}</span>
              <span className="range-action__short">{t('ui.range.deleteShort')}</span>
            </button>
            <button
              type="button"
              className="btn btn--ghost range-action range-action--paste"
              onClick={onPaste}
              disabled={!hasClipboard}
              aria-label={hasClipboard
                ? `${t('ui.range.paste')} (${t('ui.range.selectionCount', {
                  count: state.clipboard.length,
                })})`
                : t('ui.range.paste')}
              title={range ? t('ui.range.pasteReplaceTitle') : t('ui.range.paste')}
            >
              <PasteIcon />
              <span className="range-action__wide">{t('ui.range.paste')}</span>
              <span className="range-action__short">{t('ui.range.paste')}</span>
              {hasClipboard && (
                <span className="range-action__paste-count" aria-hidden="true">
                  {t('ui.range.pasteCount', { count: state.clipboard.length })}
                </span>
              )}
            </button>
          </div>
          <span className="v-sep" aria-hidden="true" />
          <div className="range-action-bar__group">
            <button
              type="button"
              className="btn range-action"
              onClick={onInsert}
              disabled={insertDisabled}
              aria-label={t('ui.range.insertHere')}
              title={insertDisabled ? insertDisabledTitle : t('ui.range.insertHere')}
            >
              <AddGridIcon />
              <span className="range-action__wide">{t('ui.range.insertHere')}</span>
              <span className="range-action__short">{t('ui.range.insertHere')}</span>
            </button>
          </div>
        </div>
        <span className="v-sep" aria-hidden="true" />
        <div className="range-action-bar__group range-action-bar__utility">
          <button
            type="button"
            className="icon-btn range-action-bar__collapse"
            onClick={onCollapse}
            aria-label={t('ui.range.collapseBar')}
            title={t('ui.range.collapseBar')}
          >
            <ChevronIcon direction="down" />
          </button>
        </div>
      </div>
    </div>
  );
}
