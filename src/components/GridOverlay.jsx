import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useT } from '../i18n/LanguageContext.jsx';
import GridCard from './GridCard.jsx';
import { ChevronIcon, CloseIcon } from './icons.jsx';
import {
  useExpandedGridStore,
  useExpandedGridIndex,
} from '../contexts/ExpandedGridContext.jsx';
import { useScoreGridsStore } from '../contexts/ScoreGridsContext.jsx';
import {
  clampExpandedIndex,
  stepExpandedIndex,
  resolveSwipe,
  shouldStartDrag,
  dampDragOffset,
  SWIPE_EDGE_GUARD_PX,
} from '../lib/gridNavigation.js';
import { getAudibleKeys } from '../lib/scoreLayers.js';

/** スワイプで隣のグリッドへ送り出す／迎え入れるアニメーションの長さ */
const SWIPE_ANIM_MS = 200;

/**
 * 入力欄をシート（`.grid-overlay__sheet`）の中だけで見える位置へ動かす。
 * `Element.scrollIntoView` は祖先のスクロール可能ボックスを文書まで
 * 全部さかのぼって動かしてしまい、`overflow: hidden` はプログラムからの
 * スクロールを止めないため、背面の一覧までスクロールさせうる。シートの
 * `scrollTop` だけを直接動かすことで、影響範囲をシートの内側に閉じる。
 */
function scrollInputIntoSheet(input) {
  const sheet = input.closest('.grid-overlay__sheet');
  if (!sheet) return;
  const inputRect = input.getBoundingClientRect();
  const sheetRect = sheet.getBoundingClientRect();
  const delta =
    inputRect.top + inputRect.height / 2 - (sheetRect.top + sheetRect.height / 2);
  sheet.scrollTop += delta;
}

/**
 * 押しても入力欄からフォーカスが外れないようにする。iOS はフォーカスが
 * 外れた瞬間にソフトキーボードを閉じるため、キーボードを出したまま矢印で
 * 隣のグリッドへ移れるようにするにはフォーカスを移動させてはならない。
 * フォーカスの移動は mousedown の既定動作として起きるので、これを止める。
 * click は別に発火するため、ボタンとしての動作は変わらない。
 */
function preventFocusShift(e) {
  e.preventDefault();
}

/**
 * トラック内の1枠。前後の枠は index が配列の外（-1 または total 以上）に
 * なりうるので空のプレースホルダを返す。GridCard 自身がストアから
 * useGrid(index) で引くようになったため、grid の有無ではなく index の
 * 範囲で判定する。GridOverlay の内側で定義すると index が変わるたびに
 * 別のコンポーネント型になり中央カードが作り直されて iOS のソフトキーボードが
 * 閉じるため、モジュールスコープに置く。
 */
function OverlaySlide({
  index,
  total,
  isCenter,
  editMode,
  onFocus,
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
  if (index < 0 || index >= total) return <div className="grid-overlay__slide" />;

  return (
    <div className="grid-overlay__slide" aria-hidden={isCenter ? undefined : 'true'}>
      <div className="grid-overlay__sheet" onFocus={isCenter ? onFocus : undefined}>
        <GridCard
          index={index}
          editMode={editMode}
          onPlayFrom={onPlayFrom}
          onPlaySingle={onPlaySingle}
          onPlayPreview={onPlayPreview}
          selectedLayer={selectedLayer}
          usesTwoLayers={usesTwoLayers}
          usesSecondHighlightColor={usesSecondHighlightColor}
          onToggleLayer={onToggleLayer}
          onToggleKey={onToggleKey}
          onSetText={onSetText}
          onDelete={onDelete}
          onToggleBreak={onToggleBreak}
          onRequestNext={onRequestNext}
        />
      </div>
    </div>
  );
}

/**
 * スマートフォンでのグリッド拡大表示。一覧の GridCardCompact はタップで
 * 拡大 index をストアへ書き込むだけで、鍵盤・入力欄・音などの実際の
 * 操作はすべてここで初めて有効になる。
 *
 * 前後のグリッドを含む3枠のトラックを横に動かすカルーセル構造にし、
 * スワイプで払うと今のグリッドが画面外へ送り出され、移動先が中央へ
 * 迎え入れられる見た目にしている。
 */
export default function GridOverlay({
  grids,
  editMode,
  onToggleKey,
  onSetText,
  onDelete,
  onToggleBreak,
  onPlayFrom,
  onPlaySingle,
  onPlayPreview,
  selectedLayer,
  usesTwoLayers,
  usesSecondHighlightColor,
  onToggleLayer,
}) {
  const t = useT();
  const store = useExpandedGridStore();
  const scoreGridsStore = useScoreGridsStore();
  const rawIndex = useExpandedGridIndex();
  // 読み込み・全消去・Undo・削除で grids が縮んだ直後は、ストアに残っている
  // 番号が範囲外になりうる。書き込み側ではなく読み出す直前にクランプする。
  const index = clampExpandedIndex(rawIndex, grids.length);
  const isOpen = index >= 0;

  // テキスト入力の1文字ごとに effect が再実行されて音が鳴ることのないよう、
  // 内容は ref から読み、effect の依存は index だけにする。
  const gridsRef = useRef(grids);
  useEffect(() => {
    gridsRef.current = grids;
  }, [grids]);

  const close = useCallback(() => store.setExpandedIndex(-1), [store]);

  // grids が縮んで rawIndex が範囲外になったら閉じる
  useEffect(() => {
    if (rawIndex >= 0 && index < 0) close();
  }, [rawIndex, index, close]);

  // 拡大・移動のたびにそのグリッドの音を鳴らす
  useEffect(() => {
    if (index < 0) return;
    const keys = getAudibleKeys(gridsRef.current[index]);
    if (keys && keys.length > 0) onPlayPreview(keys);
  }, [index, onPlayPreview]);

  // Escape で閉じる。開いている間だけ登録する
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  // 開いている間は背面をスクロールさせない
  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 閉じたら、最後に見ていたグリッドを一覧の中央に戻してフォーカスする
  const lastOpenIndexRef = useRef(-1);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (index >= 0) {
      lastOpenIndexRef.current = index;
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const last = lastOpenIndexRef.current;
    if (last < 0) return;

    // 属性セレクタは文書を先頭から走査するため件数に比例したコストがかかる。
    // id はブラウザが索引を持つので getElementById が一定時間で引ける。
    // 仮想化後は画面外の一覧カードがマウントされていないため見つからない
    // ことがある。見つかれば（＝マウント済み＝ほぼ可視範囲内）今の操作感の
    // とおりスクロールせずそのまま同期的にフォーカスする。
    const existingTap = document
      .getElementById(`score-cell-${last}`)
      ?.querySelector('.grid-card__tap');
    if (existingTap) {
      existingTap.focus({ preventScroll: true });
      return;
    }

    // マウントされていない場合は、ストアが持つ行のY座標へ大まかに
    // スクロールしたうえで保留フォーカスを予約する。
    // 実際の focus() 呼び出しは、その行がマウントされたとき対象の
    // GridCardCompact 自身が行う（GridCardCompact.jsx 参照）。
    const rowTop = scoreGridsStore.getRowOffsetY(last);
    if (rowTop === null) return;
    const rowPitch = scoreGridsStore.getRowPitch();
    const viewportHeight = window.innerHeight;
    // smooth は多数のフレームを描画し続けるため、瞬時移動にする。
    const targetScrollY = rowTop + rowPitch / 2 - viewportHeight / 2;
    scoreGridsStore.requestFocus(last);
    window.scrollTo({ top: Math.max(0, targetScrollY), behavior: 'auto' });
  }, [index, scoreGridsStore]);

  const goto = useCallback(
    (delta) => {
      const next = stepExpandedIndex(store.getExpandedIndex(), gridsRef.current.length, delta);
      if (next !== null) store.setExpandedIndex(next);
    },
    [store],
  );
  const goNext = useCallback(() => goto(1), [goto]);
  const goPrev = useCallback(() => goto(-1), [goto]);

  const overlayRef = useRef(null);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const animTimerRef = useRef(null);

  // 追従中は毎フレーム呼ばれるため、React の state は経由せず
  // style を直接書き換える。基準位置は -100%（トラック3枚のうち中央の
  // 1枚が画面に写る位置）。
  const setTrackOffset = useCallback((px, animate) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${SWIPE_ANIM_MS}ms ease-out` : 'none';
    el.style.transform = px
      ? `translateX(calc(-100% + ${px}px))`
      : 'translateX(-100%)';
  }, []);

  // 今のグリッドを画面外へ送り出す。送り出した先には移動先のグリッドが
  // 既に描画されているので、そのまま index を進めて基準位置(-100%)へ
  // 戻しても、写っているグリッドは変わらず見た目は変化しない。
  const slideOut = useCallback((direction) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = `transform ${SWIPE_ANIM_MS}ms ease-out`;
    el.style.transform = direction === 1 ? 'translateX(-200%)' : 'translateX(0%)';
  }, []);

  const commit = useCallback(
    (direction) => {
      // 端では送り出さず、中央へ戻すだけ
      if (stepExpandedIndex(index, gridsRef.current.length, direction) === null) {
        setTrackOffset(0, true);
        // index が変わらないためこの経路は useLayoutEffect(254-258行)の
        // is-moving 解除を通らない。handlePointerUp がしきい値未満で
        // 離したとき(421-426行)と同じパターンで解除を予約する。
        animTimerRef.current = setTimeout(() => {
          animTimerRef.current = null;
          trackRef.current?.classList.remove('is-moving');
        }, SWIPE_ANIM_MS);
        return;
      }
      slideOut(direction);
      // prefers-reduced-motion では transition が無効化され transitionend が
      // 発火しないため、完了はタイマーで確定させる
      animTimerRef.current = setTimeout(() => {
        animTimerRef.current = null;
        goto(direction);
      }, SWIPE_ANIM_MS);
    },
    [index, goto, slideOut, setTrackOffset],
  );

  // 矢印ボタン・Enter で移動したときに、前回のドラッグ量が残らないように
  // する。送り出し後の位置と基準位置には同じグリッドが写るため、ここで
  // 戻しても見た目は変化しない。描画前に戻さないと1フレームずれて見える
  // ため useEffect ではなく useLayoutEffect を使う。
  useLayoutEffect(() => {
    setTrackOffset(0, false);
    const track = trackRef.current;
    if (!track) return undefined;
    track.classList.remove('is-moving');

    // 中央枠の DOM ノードは index が変わっても再利用されるため、鍵の
    // fill/stroke に transition がかかり、入れ替えの瞬間だけ移動先の
    // 鍵盤が点滅して見える。入れ替わりを含む1フレームだけ transition を
    // 止める。offsetWidth の読み出しで同期的にスタイルを確定させる手も
    // あるが、背後に残っている巨大な楽譜のレイアウトまで巻き込みうるため
    // 使わない。
    track.classList.add('is-swapping');
    let innerId = 0;
    const outerId = window.requestAnimationFrame(() => {
      // 1回目の rAF は「新しい鍵の状態が transition:none のまま初めて
      // 描画されるフレーム」。ここで外すと直後のスタイル計算で
      // transition が復活し、結局アニメーションが始まってしまう。
      innerId = window.requestAnimationFrame(() => {
        // 2回目の rAF では新しい状態が既に確定しているため、ここで
        // 外せば色は変化せず transition も起きない。
        trackRef.current?.classList.remove('is-swapping');
      });
    });
    return () => {
      window.cancelAnimationFrame(outerId);
      if (innerId) window.cancelAnimationFrame(innerId);
    };
  }, [index, setTrackOffset]);

  // 拡大表示は閉じても return null するだけでアンマウントされないため、
  // 送り出しアニメーションのタイマーが残ったまま閉じると、後から goto が
  // 走って拡大表示が勝手に開き直ってしまう
  useEffect(() => {
    if (isOpen) return undefined;
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    return undefined;
  }, [isOpen]);

  // ソフトキーボードが出ると表示領域だけが縮み、レイアウトビューポートは
  // 縮まない。`.grid-overlay`（ルート）は position:fixed＝レイアウト
  // ビューポート基準のまま inset:0 で覆い続け、実際に見えている領域への
  // 追従は内側の `.grid-overlay__viewport` だけが担う。ルート自身を
  // 縮めると、キーボード表示中に暗い背景が覆わない帯が生まれ、そこから
  // 背面の一覧が見えたり触れたりしてしまう。
  useEffect(() => {
    if (!isOpen) return undefined;
    const vv = window.visualViewport;
    if (!vv) return undefined; // 非対応ブラウザは CSS の height:100% のまま動く

    // cleanup が走る時点では ref.current が既に変わっている（unmount 後
    // など）可能性があるため、effect 実行時点の要素をローカル変数として
    // 捕まえ、apply/cleanup の両方でそれだけを使う。
    const overlayEl = overlayRef.current;
    const viewportEl = viewportRef.current;
    if (!overlayEl || !viewportEl) return undefined;

    const apply = () => {
      viewportEl.style.height = `${vv.height}px`;
      viewportEl.style.transform = `translateY(${vv.offsetTop}px)`;
      // is-compact と --overlay-h は子孫セレクタ・変数の継承で見た目を
      // 制御するために使われており、ルート側に置いたままでよい
      overlayEl.style.setProperty('--overlay-h', `${vv.height}px`);
      // 高さが減ったときに余白を優先すると、カードが入りきらない
      overlayEl.classList.toggle('is-compact', vv.height < 520);

      // キーボードが既に開いている状態で別の入力欄へ移ると resize が
      // 発火しないため、フォーカス側でも補う（handleSheetFocus 参照）
      const active = document.activeElement;
      if (active && active.tagName === 'INPUT' && overlayEl.contains(active)) {
        scrollInputIntoSheet(active);
      }
    };

    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      viewportEl.style.height = '';
      viewportEl.style.transform = '';
      overlayEl.classList.remove('is-compact');
    };
  }, [isOpen]);

  // 実機では、シート側のスクロール制御だけでは背面の一覧がスクロール
  // できるままだったため追加。touchmove を非passiveで購読し、指の動きを
  // ブラウザに任せてよい場合以外は preventDefault する。
  //
  // 任せてよいのは「シートの中で、かつシートに実際にスクロールの余地が
  // ある」ときだけである。中身が収まっていてスクロールできないシートの
  // 上では、iOS は動かせる祖先を文書までさかのぼって探し、背面の一覧を
  // スクロールさせる。overscroll-behavior はスクロールする要素の端で
  // 連鎖を止めるものなので、そもそもスクロールしない要素では効かない。
  //
  // React の onTouchMove はデフォルトで passive のため addEventListener
  // で明示的に { passive: false } を指定する必要がある。
  useEffect(() => {
    if (!isOpen) return undefined;
    const el = overlayRef.current;
    if (!el) return undefined;

    // スクロールの余地は指を置いた時点で1回だけ測る。touchmove のたびに
    // scrollHeight を読むと、同じフレームでトラックの transform を書き
    // 換えている（handlePointerMove）ぶんのレイアウトを毎フレーム確定
    // させることになる。
    let sheetCanScroll = false;
    const handleTouchStart = (e) => {
      const sheet = e.target.closest?.('.grid-overlay__sheet');
      sheetCanScroll = !!sheet && sheet.scrollHeight > sheet.clientHeight;
    };
    const handleTouchMove = (e) => {
      if (sheetCanScroll) return;
      e.preventDefault();
    };
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isOpen]);

  // キーボードが既に開いている状態で次の入力欄へフォーカスが移ったとき
  // （Enter移動など）は visualViewport の resize が発火しないため、
  // フォーカス自体をきっかけにスクロール位置を補正する
  const handleSheetFocus = useCallback((e) => {
    if (e.target?.tagName === 'INPUT') {
      scrollInputIntoSheet(e.target);
    }
  }, []);

  // スワイプ・ドラッグ追従の検出。座標は pointerdown からの差分で判定する
  const swipeStartRef = useRef(null);
  const swipedRef = useRef(false);
  const dragRef = useRef({ startX: 0, startY: 0, active: false, dragging: false });

  const handlePointerDown = useCallback(
    (e) => {
      // 送り出しアニメーション中は新しい操作を無視する。200ms なので
      // 体感には影響しない。中断して引き継ぐ実装は状態が増えるだけ
      if (animTimerRef.current) return;

      // handleClickCapture のコメントが前提とする「リセットは onPointerDown
      // の1箇所だけ」を成立させるため、この先で return しうる画面端ガード
      // より前でリセットする。
      swipedRef.current = false;

      // iOS の画面端スワイプ（戻る）と競合するため、端から始まった操作は拾わない
      if (
        e.clientX <= SWIPE_EDGE_GUARD_PX ||
        e.clientX >= window.innerWidth - SWIPE_EDGE_GUARD_PX
      ) {
        swipeStartRef.current = null;
        dragRef.current.active = false;
        return;
      }
      swipeStartRef.current = { x: e.clientX, y: e.clientY };
      dragRef.current = { startX: e.clientX, startY: e.clientY, active: true, dragging: false };
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag.active) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (!drag.dragging) {
        if (!shouldStartDrag(dx, dy)) return;
        drag.dragging = true;
        // しきい値を超えてから初めて capture する。最初から取ると
        // タップや入力欄へのフォーカスが壊れる
        e.currentTarget.setPointerCapture?.(e.pointerId);
        // 動き始めたときだけ前後のスライドを見せる（index.css 参照）
        trackRef.current?.classList.add('is-moving');
      }

      const direction = dx < 0 ? 1 : -1;
      const canMove = stepExpandedIndex(index, gridsRef.current.length, direction) !== null;
      setTrackOffset(dampDragOffset(dx, canMove), false);
    },
    [index, setTrackOffset],
  );

  const handlePointerUp = useCallback(
    (e) => {
      // 送り出しアニメーション中は handlePointerDown が操作を無視している
      // （362行）。ここで戻し処理まで走ると、送り出し中の位置が中央へ
      // 巻き戻ってからインデックスだけが進む。swipedRef は true のまま
      // 残し、終端の click は handleClickCapture に握り潰させる
      if (animTimerRef.current) return;

      const start = swipeStartRef.current;
      const wasDragging = dragRef.current.dragging;
      swipeStartRef.current = null;
      dragRef.current.active = false;
      dragRef.current.dragging = false;

      // ドラッグ追従していた場合は、移動するしないに関わらず、終端の
      // click で鍵をトグルさせないようにする
      if (wasDragging) swipedRef.current = true;

      const direction = start ? resolveSwipe(e.clientX - start.x, e.clientY - start.y) : 0;
      if (direction !== 0) {
        swipedRef.current = true;
        commit(direction);
        return;
      }

      // 移動が確定しなかった（しきい値未満で離した）場合は中央へ戻す。
      // index は変わらないので useLayoutEffect ではなく、ここで
      // is-moving の解除を予約する
      setTrackOffset(0, true);
      if (wasDragging) {
        animTimerRef.current = setTimeout(() => {
          animTimerRef.current = null;
          trackRef.current?.classList.remove('is-moving');
        }, SWIPE_ANIM_MS);
      }
    },
    [commit, setTrackOffset],
  );

  const handlePointerCancel = useCallback(() => {
    const wasDragging = dragRef.current.dragging;
    swipeStartRef.current = null;
    dragRef.current.active = false;
    dragRef.current.dragging = false;
    setTrackOffset(0, true);
    if (wasDragging) {
      animTimerRef.current = setTimeout(() => {
        animTimerRef.current = null;
        trackRef.current?.classList.remove('is-moving');
      }, SWIPE_ANIM_MS);
    }
  }, [setTrackOffset]);

  const handleClickCapture = useCallback((e) => {
    // スワイプ・ドラッグ操作の終端で発火する click は、開始点にあった鍵の
    // トグルや、通過しただけのボタンの誤操作につながるため握りつぶす。
    // リセットは onPointerDown の1箇所だけで行う。
    if (swipedRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  const handlePlayFrom = useCallback(
    (i) => {
      close();
      onPlayFrom(i);
    },
    [close, onPlayFrom],
  );

  const handleDelete = useCallback(
    (i) => {
      onDelete(i);
      close();
    },
    [onDelete, close],
  );

  if (index < 0) return null;

  const total = grids.length;
  const slideProps = {
    total,
    editMode,
    onFocus: handleSheetFocus,
    onPlayFrom: handlePlayFrom,
    onPlaySingle,
    onPlayPreview,
    selectedLayer,
    usesTwoLayers,
    usesSecondHighlightColor,
    onToggleLayer,
    onToggleKey,
    onSetText,
    onDelete: handleDelete,
    onToggleBreak,
    onRequestNext: goNext,
  };

  return (
    <div
      ref={overlayRef}
      className="grid-overlay"
      onClick={(e) => {
        // スワイプ・ドラッグの終端で背景上に指を離しても閉じないようにする
        if (swipedRef.current) return;
        // スライドが画面全体を覆うため target === currentTarget は使えない。
        // シートの外・矢印の外を押したかどうかで判定する（矢印はトラックの
        // 外＝シートの外に置いているため、この判定に加えないと押した瞬間に
        // 閉じてしまう）
        if (
          !e.target.closest?.(
            '.grid-overlay__sheet, .grid-overlay__arrow, .grid-overlay__close',
          )
        ) {
          close();
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClickCapture={handleClickCapture}
    >
      <div
        ref={viewportRef}
        className="grid-overlay__viewport"
        role="dialog"
        aria-modal="true"
        aria-label={t('ui.gridOverlay.grid', { n: index + 1 })}
      >
        <div ref={trackRef} className="grid-overlay__track">
          <OverlaySlide index={index - 1} isCenter={false} {...slideProps} />
          <OverlaySlide index={index} isCenter {...slideProps} />
          <OverlaySlide index={index + 1} isCenter={false} {...slideProps} />
        </div>
        {/* トラックの外に置く。中に置くとスワイプの translateX で
            一緒に動いてしまう */}
        <button
          type="button"
          className="grid-overlay__arrow grid-overlay__arrow--prev"
          onClick={goPrev}
          onMouseDown={preventFocusShift}
          disabled={index === 0}
          aria-label={t('ui.gridOverlay.previous')}
        >
          <ChevronIcon direction="left" />
        </button>
        <button
          type="button"
          className="grid-overlay__arrow grid-overlay__arrow--next"
          onClick={goNext}
          onMouseDown={preventFocusShift}
          disabled={index === total - 1}
          aria-label={t('ui.gridOverlay.next')}
        >
          <ChevronIcon direction="right" />
        </button>
        {/* 背景タップと Escape でも閉じられるが、キーボード表示中
            （is-compact）はカードが画面いっぱいに寄って背景がほとんど
            残らず、支援技術からは背景タップに到達する手段がないため、
            明示的な閉じるボタンを残す */}
        <button
          type="button"
          className="grid-overlay__close"
          onClick={close}
          aria-label={t('ui.gridOverlay.close')}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
