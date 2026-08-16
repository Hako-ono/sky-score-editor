import { memo, useEffect, useRef } from 'react';
import { useT } from '../i18n/LanguageContext.jsx';
import NoteGridSvg from './NoteGridSvg.jsx';
import { useIsActiveGrid } from '../contexts/ActiveGridContext.jsx';
import { useGrid, useIsPendingFocus, useScoreGridsStore } from '../contexts/ScoreGridsContext.jsx';
import { PlayIcon, NoteIcon, LayerSwitchIcon, CloseIcon } from './icons.jsx';
import { MAX_TEXT_LENGTH } from '../constants/config.js';
import { getAudibleKeys, getOtherLayerKeys, getSelectedLayerKeys } from '../lib/scoreLayers.js';

// 仮想化後は画面外の行がマウントされていないため、targetIndex の入力欄が
// 常に存在するとは限らない。存在すれば（＝マウント済み＝ほぼ可視範囲内）
// 属性セレクタより速い getElementById でそのまま同期的に focus する
// （今の操作感を変えない）。存在しなければ、ストアが持つ行のY座標へ
// 大まかにスクロールしたうえで「保留フォーカス」を予約する。実際の
// focus() 呼び出しは、その行がマウントされたとき対象の GridCard 自身が
// 行う（下の useIsPendingFocus 参照）。戻り値は「（どちらかの形で）
// 移動を引き受けたか」＝ Tab のデフォルト動作を防ぐべきかの判定に使う。
function focusOrScheduleFocus(store, targetIndex) {
  const existing = document.getElementById(`grid-input-${targetIndex}`);
  if (existing) {
    existing.focus();
    return true;
  }
  const y = store.getRowOffsetY(targetIndex);
  if (y === null) return false; // 範囲外（存在しない index）
  store.requestFocus(targetIndex);
  window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
  return true;
}

/** 改行トグルのアイコン */
function BreakIcon() {
  return (
    <svg viewBox="0 0 30 30" width="18" height="18" aria-hidden="true">
      <polyline
        points="21,7 21,15 9,15"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <polyline
        points="12,11 8,15 12,19"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  );
}

function GridCard({
  index,
  editMode,
  onPlayFrom,
  onPlaySingle,
  onPlayPreview,
  selectedLayer,
  usesTwoLayers,
  usesSecondHighlightColor,
  onToggleLayer,
  onToggleKey,
  onSetText,
  onDelete,
  onToggleBreak,
  onRequestNext,
}) {
  const t = useT();
  // props ではなく自分の index でストアから引く。DELETE 直後の1フレームや
  // GridOverlay の前後スライド（配列の外）では undefined になりうる。
  const grid = useGrid(index);
  // 自分の index が現在アクティブかどうかだけを購読する。isActive を props
  // として親から受け取ると、activeGrid が変わるたびに全 GridCard の
  // props比較が発生するため、ここで直接ストアを購読する形にしている。
  const isActive = useIsActiveGrid(index);
  const store = useScoreGridsStore();

  // 画面外から Enter/Tab で移動してきた「保留フォーカス」の対象が
  // 自分になったら、マウントされた今フォーカスする。
  const isPendingFocus = useIsPendingFocus(index);
  const inputRef = useRef(null);
  useEffect(() => {
    if (!isPendingFocus) return;
    inputRef.current?.focus();
    store.clearPendingFocus(index);
  }, [isPendingFocus, index, store]);

  // フック呼び出しをすべて終えた後でだけ判定できる（ルール上ここより前には
  // 置けない）。DELETE 直後の1フレームや GridOverlay の前後スライドで
  // 実際に undefined になる。
  if (!grid) return null;

  const selectedKeys = getSelectedLayerKeys(grid, selectedLayer);
  const otherKeys = getOtherLayerKeys(grid, selectedLayer);
  const audibleKeys = getAudibleKeys(grid);
  const isEmpty = audibleKeys.length === 0;

  // className に isActive による '.is-playing' を追加
  return (
    <div
      className={`grid-card${isEmpty ? ' is-empty' : ''}${
        grid.forceBreakAfter ? ' has-break' : ''
      }${isActive ? ' is-playing' : ''}`}
    >
      <div className="grid-card__header">
        {/* 左側に番号と再生ボタンをグループ化 */}
        <div className="grid-card__header-left">
          <span className="grid-card__number">{index + 1}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => onPlayFrom(index)}
            title={t('ui.gridCard.playFromTitle')}
            aria-label={t('ui.gridCard.playFrom', { n: index + 1 })}
          >
            <PlayIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => onPlaySingle(index)}
            disabled={isEmpty}
            style={{ opacity: isEmpty ? 0.3 : 1 }}
            title={t('ui.gridCard.playSingleTitle')}
            aria-label={t('ui.gridCard.playSingle', { n: index + 1 })}
          >
            <NoteIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLayer();
            }}
            title={t('ui.gridCard.layerSwitch')}
            aria-label={t('ui.gridCard.layerSwitch')}
          >
            <LayerSwitchIcon />
          </button>
        </div>
        <div className="grid-card__controls">
          <button
            type="button"
            className={`icon-btn break-btn${grid.forceBreakAfter ? ' active' : ''}`}
            onClick={() => onToggleBreak(index)}
            aria-pressed={grid.forceBreakAfter}
            aria-label={
              grid.forceBreakAfter
                ? t('ui.gridCard.breakOff', { n: index + 1 })
                : t('ui.gridCard.breakOn', { n: index + 1 })
            }
            title={t('ui.gridCard.breakTitle')}
          >
            <BreakIcon />
          </button>
          {editMode && (
            <button
              type="button"
              className="icon-btn delete-btn"
              onClick={() => onDelete(index)}
              aria-label={t('ui.gridCard.delete', { n: index + 1 })}
              title={t('ui.gridCard.deleteTitle')}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      <NoteGridSvg
        selectedKeys={selectedKeys}
        otherKeys={otherKeys}
        usesTwoLayers={usesTwoLayers}
        usesSecondHighlightColor={usesSecondHighlightColor}
        onToggleKey={(k) => onToggleKey(index, k, selectedLayer)}
        interactive
      />

      <input
        ref={inputRef}
        id={`grid-input-${index}`}
        type="text"
        className="grid-card__text"
        value={grid.text}
        /* 半角スペース1つ：文字としては表示されないが、CSS の
           :placeholder-shown で「未入力かどうか」を判定できるようにする
           （枠を消した分、未入力の見た目は index.css 側の下線で示す） */
        placeholder=" "
        maxLength={MAX_TEXT_LENGTH}
        onChange={(e) => onSetText(index, e.target.value)}
        /* フォーカスが当たったときに音が鳴るようにする */
        onFocus={() => {
          if (!isEmpty) {
            onPlayPreview(audibleKeys);
          }
        }}
        aria-label={t('ui.gridCard.text', { n: index + 1 })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault(); // Enter は常に防ぐ
            if (onRequestNext) {
              // 拡大表示では隣のグリッドの入力欄が DOM に存在しないため、
              // 移動先の決定は呼び出し元（GridOverlay）に任せる
              onRequestNext();
              return;
            }
            focusOrScheduleFocus(store, index + 1);
          } else if (onRequestNext && e.key === 'Tab') {
            // 拡大表示では Tab はダイアログ内のフォーカス移動であるべきなので、
            // 隣のグリッドへは飛ばさず既定動作に任せる
          } else if (e.key === 'Tab' && !e.shiftKey) {
            // 移動先が存在する（＝マウント済みでそのままfocusする、または
            // 画面外で保留フォーカスを予約した）ときだけ既定の移動を防ぐ。
            // 存在しない（末尾）ときは既定のTab移動に任せる。
            if (focusOrScheduleFocus(store, index + 1)) {
              e.preventDefault();
            }
          } else if (e.key === 'Tab' && e.shiftKey) {
            if (focusOrScheduleFocus(store, index - 1)) {
              e.preventDefault();
            }
          }
        }}
      />
    </div>
  );
}
export default memo(GridCard);
