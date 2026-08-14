import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import GridCard from './GridCard.jsx';
import GridCardCompact from './GridCardCompact.jsx';
import InsertButton from './InsertButton.jsx';
import { columnsForBits } from '../lib/layout.js';
import {
  classifyPlaybackFollowTransition,
  computePlaybackFollowTarget,
} from '../lib/playbackFollow.js';
import { computeVisibleRowRange } from '../lib/virtualRows.js';
import { useActiveGridIndex } from '../contexts/ActiveGridContext.jsx';
import { useExpandedGridStore } from '../contexts/ExpandedGridContext.jsx';
import { useGridRows, useScoreGridsStore } from '../contexts/ScoreGridsContext.jsx';

// 実測前（初回描画・isMobile/editMode/columns切り替え直後の1フレーム）だけ
// 使う仮の行ピッチ。.grid-card のCSSから概算した値。
const PROVISIONAL_ROW_PITCH_DESKTOP = 260;
const PROVISIONAL_ROW_PITCH_MOBILE = 130;

// 再生中のグリッドへの自動スクロールだけを担当する。activeGrid の変化は
// ここで購読が完結し、2700件の GridCard を抱える ScoreCanvas 本体は
// 再評価されない。
//
// 仮想化後は画面外の行がマウントされていないため、対象の要素を
// getElementById で掴む前提が崩れる。行の文書内Y座標は ScoreGridsContext
// のストア（ScoreCanvas が実測値を書き込んでいる）から算術で求め、
// マウント状態によらず動く形にしてある。
function AutoScrollWatcher({ isAutoScroll, playbackState, measure }) {
  const activeGridIndex = useActiveGridIndex();
  const store = useScoreGridsStore();
  const previousRowRef = useRef(-1);

  useEffect(() => {
    if (isAutoScroll !== true || playbackState !== 'playing' || activeGridIndex < 0) {
      previousRowRef.current = -1;
      return;
    }

    let rowLayout = store.getRowLayout(activeGridIndex);
    if (!rowLayout) {
      previousRowRef.current = -1;
      return;
    }

    const transition = classifyPlaybackFollowTransition(
      previousRowRef.current,
      rowLayout.rowIndex,
    );
    if (transition === null) return;

    if (transition === 'entry') {
      measure();
      rowLayout = store.getRowLayout(activeGridIndex);
      if (!rowLayout) {
        previousRowRef.current = -1;
        return;
      }
    }

    const stickyHeader = document.querySelector('.app__sticky-header');
    const stickyRect = stickyHeader ? stickyHeader.getBoundingClientRect() : null;
    const target = computePlaybackFollowTarget({
      rowTop: rowLayout.rowTop,
      rowPitch: rowLayout.rowPitch,
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
      currentHeaderBottom: stickyRect?.bottom ?? 0,
      stickyHeaderHeight: stickyRect?.height ?? 0,
      preserveIfFullyVisible: transition === 'entry',
    });

    previousRowRef.current = rowLayout.rowIndex;
    if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior: 'auto' });
    }
  }, [activeGridIndex, isAutoScroll, measure, playbackState, store]);

  return null;
}

/**
 * 楽譜全体を行ごとに描画。forceBreakAfter と columns に従って折り返す。
 * 各グリッドの左に挿入ボタン、末尾に最後の挿入ボタンを置く。
 *
 * マウント枚数を可視範囲（＋前後1画面の余裕）に絞る。上下の余白は
 * スペーサー要素ではなく .score-canvas の padding-top/padding-bottom で
 * 作る（.score-canvas は gap を持つ flex コンテナのため、子要素として
 * スペーサーを置くと gap が1つ余分に入って行の位置がずれる）。
 */
function ScoreCanvas({
  bitsPerPage,
  editMode,
  isAutoScroll,
  playbackState,
  isMobile,
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
  onInsert,
}) {
  // CSS変数用の列数だけがここで必要で、bitsPerPage は既に props で渡って
  // いるためストアの columns を別途公開する API は増やさず、ここで
  // columnsForBits から求める（ストアの rows 計算と同じ式を使う）。
  const columns = columnsForBits(bitsPerPage);

  // 行構造（number[][]）はストアが grids の変化を見て計算済みのものを
  // 購読するだけにする。テキスト編集では rows の参照が変わらないため、
  // ここでの再計算も再レンダーも発生しない。
  const rows = useGridRows();
  const rowCount = rows.length;
  const store = useScoreGridsStore();

  const canvasEl = useRef(null);
  const initialRowPitch = isMobile ? PROVISIONAL_ROW_PITCH_MOBILE : PROVISIONAL_ROW_PITCH_DESKTOP;
  const rowPitchRef = useRef(initialRowPitch);

  // rowPitch・canvasTop は「実測して覚えておく値」、startRow・endRow は
  // スクロールのたびに変わる値。1つの state にまとめ、実際に変化した
  // ときだけ新しいオブジェクトを返すことで、rAFで間引いても無駄な
  // 再レンダーを起こさないようにする。
  const [layout, setLayout] = useState(() => {
    const rowPitch = isMobile ? PROVISIONAL_ROW_PITCH_MOBILE : PROVISIONAL_ROW_PITCH_DESKTOP;
    const viewportHeight = window.innerHeight;
    const range = computeVisibleRowRange({
      scrollY: window.scrollY,
      viewportHeight,
      canvasTop: 0,
      rowPitch,
      rowCount,
      overscanPx: viewportHeight,
    });
    return { rowPitch, canvasTop: 0, ...range };
  });

  // 可視範囲だけを算術で求め直す（DOMは読まない）。同じ結果なら同じ
  // オブジェクト参照を返し、setState による再レンダーを起こさない。
  const recompute = useCallback(
    (rowPitchOverride, canvasTopOverride) => {
      setLayout((prev) => {
        const rowPitch = rowPitchOverride ?? prev.rowPitch;
        const canvasTop = canvasTopOverride ?? prev.canvasTop;
        const viewportHeight = window.innerHeight;
        const { startRow, endRow } = computeVisibleRowRange({
          scrollY: window.scrollY,
          viewportHeight,
          canvasTop,
          rowPitch,
          rowCount,
          overscanPx: viewportHeight,
        });
        if (
          prev.rowPitch === rowPitch &&
          prev.canvasTop === canvasTop &&
          prev.startRow === startRow &&
          prev.endRow === endRow
        ) {
          return prev;
        }
        return { rowPitch, canvasTop, startRow, endRow };
      });
    },
    [rowCount],
  );

  // 行ピッチ（マウント済みの隣り合う2行の offsetTop の差）と、一覧先頭の
  // 文書内Y座標（.score-canvas 自身の上端。padding-top を変えても
  // ここは動かないため、可視範囲を変えるたびに測り直す必要がない）を
  // 実測する。定数として持たないのは、CSSを変えたときに黙って壊れる
  // 「CSSとJSの二重管理」を増やさないため。
  const measure = useCallback(() => {
    const el = canvasEl.current;
    if (!el) return;
    const canvasTop = el.getBoundingClientRect().top + window.scrollY;

    let measuredRowPitch;
    const rowEls = el.querySelectorAll(':scope > .score-row');
    if (rowEls.length >= 2) {
      const diff = rowEls[1].offsetTop - rowEls[0].offsetTop;
      if (diff > 0) measuredRowPitch = diff;
    }
    const nextRowPitch = measuredRowPitch ?? rowPitchRef.current;
    rowPitchRef.current = nextRowPitch;
    store.setLayoutMetrics(nextRowPitch, canvasTop);
    recompute(nextRowPitch, canvasTop);
  }, [recompute, store]);

  // 初回描画時、および行の高さが変わりうるとき（モバイル/デスクトップの
  // 切り替え・編集モードの切り替え・列数の変化）に測り直す。
  useLayoutEffect(() => {
    measure();
  }, [isMobile, editMode, columns, measure]);

  // rows が変わっただけ（rowPitch・canvasTop は変わらない）のときも、
  // rowCount の変化に合わせて範囲をクランプし直す必要がある。
  // DOMは読まないので measure より軽い。
  useEffect(() => {
    recompute();
  }, [rows, recompute]);

  // window の scroll / resize を購読する。rAF で間引き、実際に範囲が
  // 変わったときだけ state を更新する（recompute 内で判定済み）。
  // resize は行の高さ・先頭位置が変わりうるため measure（実測）から、
  // scroll は変わらないため recompute（算術のみ）から呼ぶ。
  useEffect(() => {
    let scrollScheduled = false;
    const handleScroll = () => {
      if (scrollScheduled) return;
      scrollScheduled = true;
      window.requestAnimationFrame(() => {
        scrollScheduled = false;
        recompute();
      });
    };
    let resizeScheduled = false;
    const handleResize = () => {
      if (resizeScheduled) return;
      resizeScheduled = true;
      window.requestAnimationFrame(() => {
        resizeScheduled = false;
        measure();
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [recompute, measure]);

  // ツールバーや再生バーの高さ変更は ScoreCanvas 自身の resize では検出できず、
  // canvasTop だけが変わる。兄弟要素を同じ observer で監視し、1フレームに1回だけ
  // 実測することで、タブ・アコーディオン操作と再生開始が近接しても計測を束ねる。
  useEffect(() => {
    const ResizeObserverConstructor = window.ResizeObserver;
    if (typeof ResizeObserverConstructor !== 'function') return undefined;

    let frameId = null;
    const scheduleMeasure = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measure();
      });
    };

    const observer = new ResizeObserverConstructor(scheduleMeasure);
    const toolbar = document.querySelector('.toolbar');
    const stickyHeader = document.querySelector('.app__sticky-header');
    if (toolbar) observer.observe(toolbar);
    if (stickyHeader) observer.observe(stickyHeader);

    return () => {
      observer.disconnect();
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [measure]);

  const expandedGridStore = useExpandedGridStore();
  const handleExpand = useCallback(
    (index) => expandedGridStore.setExpandedIndex(index),
    [expandedGridStore],
  );

  const { rowPitch, startRow, endRow } = layout;
  const visibleRows = rows.slice(startRow, endRow);

  return (
    // columns を CSS へ渡し、1行分の幅を calc で決め打ちして一覧全体を中央に置く。
    // 子要素の実測幅から幅を決める方法（width: fit-content 等）は、仮想化に
    // よる行の出入りのたびに親の幅が再計算されうるため使わない。
    // 上下の padding が、マウントしていない行ぶんの余白を作る。
    <div
      ref={canvasEl}
      className="score-canvas"
      role="list"
      aria-label="楽譜グリッド一覧"
      style={{
        '--columns': columns,
        paddingTop: startRow * rowPitch,
        paddingBottom: (rowCount - endRow) * rowPitch,
      }}
    >
      <AutoScrollWatcher
        isAutoScroll={isAutoScroll}
        playbackState={playbackState}
        measure={measure}
      />
      {visibleRows.map((row, i) => {
        // key は配列内の位置ではなく行の通し番号にする。可視範囲がずれた
        // ときに React が別の行として扱うようにするため。
        const rowIndex = startRow + i;
        return (
          <div className="score-row" key={rowIndex} role="presentation">
            {row.map((index) => (
              <div
                className="score-cell"
                role="listitem"
                key={index}
                id={`score-cell-${index}`}
              >
                {editMode && (
                  <InsertButton
                    index={index}
                    onInsert={onInsert}
                    label={`グリッド ${index + 1} の前に挿入`}
                  />
                )}
                {isMobile ? (
                  <GridCardCompact
                    index={index}
                    editMode={editMode}
                    selectedLayer={selectedLayer}
                    usesTwoLayers={usesTwoLayers}
                    usesSecondHighlightColor={usesSecondHighlightColor}
                    onExpand={handleExpand}
                    onDelete={onDelete}
                  />
                ) : (
                  <GridCard
                    index={index}
                    editMode={editMode}
                    selectedLayer={selectedLayer}
                    usesTwoLayers={usesTwoLayers}
                    usesSecondHighlightColor={usesSecondHighlightColor}
                    onPlayFrom={onPlayFrom}
                    onPlaySingle={onPlaySingle}
                    onPlayPreview={onPlayPreview}
                    onToggleLayer={onToggleLayer}
                    onToggleKey={onToggleKey}
                    onSetText={onSetText}
                    onDelete={onDelete}
                    onToggleBreak={onToggleBreak}
                  />
                )}
              </div>
            ))}
            {/* 行末に、その行最後のグリッドの後ろへ挿入するボタン */}
            {editMode && row.length > 0 && (
              <InsertButton
                index={row[row.length - 1] + 1}
                onInsert={onInsert}
                label={`グリッド ${row[row.length - 1] + 1} の後に挿入`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(ScoreCanvas);
