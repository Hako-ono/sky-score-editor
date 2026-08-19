import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useT } from '../i18n/LanguageContext.jsx';
import { CloseIcon } from './icons.jsx';

// 拡大の下限＝fit（等倍）、上限は4倍程度。
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_MOVE_PX = 8;
// この移動量を超えたら「ドラッグ・ピンチした」とみなす。タップ判定
// （背景タップで閉じる・ダブルタップで拡大）の両方が参照する。
const GESTURE_MOVE_THRESHOLD_PX = 4;
// iOS Safari等でGPUテクスチャの一般的な上限とされる4096×4096に合わせた
// 値。一時的なcanvas1枚ぶんで、拡大表示を閉じれば解放される。
const OVERLAY_LONG_SIDE_CAP_PX = 4096;
// 2面付け（横向き）は1枚の紙面に2ページぶんの内容が収まっており、
// 同じ解像度で描いても1ページあたりの精細さは1面付けの約半分になる
// （同じピクセル予算を2ページで分け合うため）。そのぶんだけ目標解像度の
// 倍率を引き上げて補う。
const LANDSCAPE_RESOLUTION_BOOST = 2;
// マウスホイールでの拡大縮小の感度。deltaYが大きいほど1回のホイール操作の
// 変化量が大きくなる指数写像（factor = exp(-deltaY*感度)）。実機調整の
// 余地がある値だが、一般的なホイール1ノッチ(±100)で1.1〜1.2倍程度になる
// よう選んだ。
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

/**
 * PDFプレビューの拡大表示。`GridOverlay.jsx` と同じ流儀
 * （2層のバックドロップ／visualViewport追従・背景タップで閉じる・Escで
 * 閉じる）に揃えるが、コードは共通化しない（カルーセル・スワイプ・
 * ソフトキーボード対応などプレビューに要らない事情が大量に入っているため）。
 *
 * `document.body` へポータルする。`.toolbar` は `backdrop-filter` を持ち、
 * これが `position: fixed` な子孫の containing block を viewport から
 * `.toolbar` 自身へ差し替えてしまう（CSSの仕様。transform/filter/
 * backdrop-filter/will-change:transform/contain のいずれかを持つ祖先が
 * あると起こる）。ポータルしないと、背景の暗い帯が画面全体ではなく
 * `.toolbar` の矩形にしか及ばず、モバイルでは表示位置がプレビュー枠の
 * 位置に引きずられる不具合になる。
 *
 * 初期表示は「画像の高さか横幅のどちらかが画面いっぱいになった状態」
 * （ふつうのcontain-fit）。面付け（1面付け／2面付け）や画面幅で枠自体の
 * 見た目のサイズが変わること自体は問題ない、というSNS等の画像ビューアを
 * 参考にした設計（一度は面付けに関わらず枠を固定する設計を
 * 試みたが撤回した）。拡大するとその分だけ大きくなり、画面外がはみ出す
 * のも許容する。
 *
 * 拡大・縮小・パンは `transform: translate() scale()` を自前で実装する
 * （`touch-action: pinch-zoom` 等のブラウザ任せにすると背面の一覧まで
 * 一緒に拡大されるため）。デスクトップはマウスホイールでも拡大縮小できる。
 *
 * 閉じるボタンは常時表示ではなく、画像（canvas）へのシングルタップ／
 * クリックでフェードイン・フェードアウトするチロムにする
 * （画面いっぱいに拡大した画像の上に常時ボタンがあると邪魔になるため）。
 * ダブルタップ／ダブルクリックでの拡大と区別するため、1回目のタップの
 * 時点では確定させず、`DOUBLE_TAP_MS` だけ待って2回目が来なければ
 * チロムを切り替える（保留中に2回目が来たらタイマーを消して拡大だけを
 * 行う）。背景タップでの終了は待たずに即時実行する（背景には拡大用の
 * ダブルタップの意味がないため）。
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {Blob | null} props.blob `renderPdfPreview` が返したPDFのBlob。
 *          `buildPdfBlob` からやり直さず、ここから別解像度で描き直す
 *          （`renderPdfPreviewFromBlob`）
 * @param {number} props.aspectRatio 実際の内容の縦横比（PdfPreview.jsxと
 *          同じ式で求めたもの）
 * @param {() => void} props.onClose
 */
export default function PdfPreviewOverlay({ isOpen, blob, aspectRatio, onClose }) {
  const t = useT();
  const viewportRef = useRef(null);
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const closeButtonRef = useRef(null);

  const [phase, setPhase] = useState('idle'); // idle | loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  // 閉じるボタン（チロム）の表示状態。開くたびに非表示から始める
  // （紙面の閲覧を邪魔しないため）。
  const [chromeVisible, setChromeVisible] = useState(false);
  const pendingTapTimerRef = useRef(null);

  // 拡大・パンの状態はReact stateを経由せず、ref＋直接styleの書き換えで
  // 持つ（GridOverlay.jsxのsetTrackOffsetと同じ理由：連続操作のたびに
  // 再レンダーさせない）。
  const transformRef = useRef({ scale: MIN_SCALE, tx: 0, ty: 0 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  // 実際にドラッグ・ピンチとして動いたか（tap/クリックとして扱ってよいかの
  // 判定に使う）。setPointerCaptureはこれがtrueになった瞬間だけ行う。
  // pointerdownの時点で無条件にcaptureすると、その後のclickイベントの
  // target がcapture先の要素にすり替わり、「背景タップで閉じる」判定が
  // 常に外れる／常に成立するどちらかに壊れる（実機確認で発覚した不具合）。
  const movedRef = useRef(false);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  const applyTransform = (animate) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.transition = animate ? 'transform 0.2s ease-out' : 'none';
    const { scale, tx, ty } = transformRef.current;
    canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  const clampTransform = (next) => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return next;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
    const stageRect = stage.getBoundingClientRect();
    // offsetWidth/Heightはtransformの影響を受けない「fit」時の表示寸法
    // （stageは画面いっぱいの箱。canvas自身がmax-width/max-height+
    // aspect-ratioでcontain-fitする）。
    const fitWidth = canvas.offsetWidth;
    const fitHeight = canvas.offsetHeight;
    const overflowX = Math.max(0, (fitWidth * scale - stageRect.width) / 2);
    const overflowY = Math.max(0, (fitHeight * scale - stageRect.height) / 2);
    return {
      scale,
      tx: Math.min(overflowX, Math.max(-overflowX, next.tx)),
      ty: Math.min(overflowY, Math.max(-overflowY, next.ty)),
    };
  };

  const toStageOffset = (clientX, clientY) => {
    const stage = stageRef.current;
    const rect = stage.getBoundingClientRect();
    return { dx: clientX - (rect.left + rect.width / 2), dy: clientY - (rect.top + rect.height / 2) };
  };

  // 指定した画面位置を軸に拡大・縮小する（ダブルクリック／ダブルタップ・
  // ホイールから使う）。dx/dyはステージ中心からの画面px。
  // newScaleは呼び出し側の値をそのまま使わず、ここで上限・下限へ
  // クランプしてから軸計算に使う。クランプ前の値で軸（tx/ty）を求めると、
  // 上限を超えて操作し続けたときに実際の表示スケール（クランプ後）とtx/ty
  // が食い違い、ホイールを回し続けると画像内が意図せず動いて見える不具合
  // になる（実機確認で発覚）。
  const zoomAt = (dx, dy, newScale, animate) => {
    const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    const { scale, tx, ty } = transformRef.current;
    const localX = (dx - tx) / scale;
    const localY = (dy - ty) / scale;
    transformRef.current = clampTransform({
      scale: clampedScale,
      tx: dx - clampedScale * localX,
      ty: dy - clampedScale * localY,
    });
    applyTransform(animate);
  };

  // 開くたびにfit（等倍）・チロム非表示へ戻す。
  useEffect(() => {
    if (!isOpen) return;
    pointersRef.current.clear();
    gestureRef.current = null;
    movedRef.current = false;
    transformRef.current = { scale: MIN_SCALE, tx: 0, ty: 0 };
    applyTransform(false);
    setChromeVisible(false);
    if (pendingTapTimerRef.current) {
      clearTimeout(pendingTapTimerRef.current);
      pendingTapTimerRef.current = null;
    }
  }, [isOpen]);

  // 閉じるボタンは開いた直後は非表示のため、フォーカスはダイアログ本体
  // （このviewport）へ寄せる。閉じている間は背面をスクロールさせない
  // （GridOverlay.jsxと同じ方針）。
  useEffect(() => {
    if (!isOpen) return undefined;
    viewportRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 保留中の単発タップ処理はアンマウント時にも解除する。
  useEffect(() => () => {
    if (pendingTapTimerRef.current) clearTimeout(pendingTapTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ルート（.pdf-preview-overlay）はレイアウトビューポート全面の暗い背景を
  // 保ち、visualViewportへの追従（高さ・位置）は内側の__viewportだけが
  // 書き換える（GridOverlay.jsxと同じ理由）。
  useEffect(() => {
    if (!isOpen) return undefined;
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const viewportEl = viewportRef.current;
    if (!viewportEl) return undefined;

    const apply = () => {
      viewportEl.style.height = `${vv.height}px`;
      viewportEl.style.transform = `translateY(${vv.offsetTop}px)`;
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      viewportEl.style.height = '';
      viewportEl.style.transform = '';
    };
  }, [isOpen]);

  // 開いたときに1回だけ、指定解像度で描き直す。buildPdfBlobからは
  // やり直さず、渡されたBlobをそのまま使う。
  useEffect(() => {
    if (!isOpen || !blob) return undefined;
    let cancelled = false;
    (async () => {
      const stage = stageRef.current;
      const canvas = canvasRef.current;
      if (!stage || !canvas) return;
      setPhase('loading');
      try {
        // 基準はstage（使える領域いっぱいの箱）ではなくcanvas自身の
        // fit時の表示寸法にする。letterboxで生じる余白ぶんstageの方が
        // 大きいことがあり、stage基準だと実際の表示より過大／過小に
        // 見積もる（実機確認で2面付けの粗さとして発覚）。
        const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const fitLongSidePx = Math.max(canvas.offsetWidth, canvas.offsetHeight);
        // 「fit時の表示サイズ × devicePixelRatio(上限2) × 2」でラスタライズし、
        // CSSでfitサイズへ縮めて表示する。等倍〜2倍の範囲は再ラスタライズ
        // なしで鮮明に保てる。2面付け（横向き）はLANDSCAPE_RESOLUTION_BOOST
        // でさらに引き上げる（1枚の紙面に2ページぶんの内容が収まっており、
        // 同じ解像度では1ページあたりの精細さが1面付けの約半分になるため）。
        const resolutionBoost = aspectRatio > 1 ? LANDSCAPE_RESOLUTION_BOOST : 1;
        const targetLongSidePx = Math.min(
          fitLongSidePx * devicePixelRatio * 2 * resolutionBoost,
          OVERLAY_LONG_SIDE_CAP_PX,
        );
        const { renderPdfPreviewFromBlob } = await import('../lib/pdfPreview.js');
        const result = await renderPdfPreviewFromBlob(blob, canvas, { targetLongSidePx });
        if (cancelled) return;
        if (result === null) return; // 世代遅れ
        setPhase('ready');
        setErrorMessage('');
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err.message);
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, blob, aspectRatio]);

  // アンマウント時・非表示化時にcanvasを縮めてメモリを解放する（PNG出力と同じiOSの対策）。
  useEffect(() => {
    if (isOpen) return undefined;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    return undefined;
  }, [isOpen]);

  // マウスホイールでの拡大縮小（PC向け）。overscroll-behavior: contain
  // だけでは背面のページスクロール等を防げないため、既定動作を止める。
  const handleWheel = (e) => {
    e.preventDefault();
    const { dx, dy } = toStageOffset(e.clientX, e.clientY);
    const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY);
    zoomAt(dx, dy, transformRef.current.scale * factor, false);
  };

  // JSXのonWheelはReactがルートへpassiveなリスナーとして委譲するため、
  // 中でpreventDefault()を呼んでも効かず、コンソールに"Unable to
  // preventDefault inside passive event listener invocation."が出るだけで
  // 実際にはページのスクロール等を止められていなかった（実機
  // 確認で発覚）。ネイティブのaddEventListenerで{ passive: false }を
  // 明示して登録し直す（Rules of Hooks上、この効果はearly return
  // （下のif (!isOpen) return null;）より前に置く必要がある）。
  useEffect(() => {
    if (!isOpen) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    root.addEventListener('wheel', handleWheel, { passive: false });
    return () => root.removeEventListener('wheel', handleWheel);
  });

  if (!isOpen) return null;

  // ドラッグ・ピンチが実際に始まった瞬間だけpointer captureする。
  // タップ／クリックだけの操作ではcaptureしないため、続く click イベントの
  // targetは実際に指を離した要素のまま（ブラウザ標準の当たり判定）になる。
  const captureActivePointers = () => {
    const root = rootRef.current;
    if (!root) return;
    for (const id of pointersRef.current.keys()) {
      root.setPointerCapture?.(id);
    }
  };

  const handlePointerDown = (e) => {
    if (pointersRef.current.size === 0) {
      // 新しいジェスチャの最初の指／クリック。movedRefは本来
      // handleClick側で読んだ直後にリセットするが、タッチのスワイプ
      // （実際に動いた操作）の直後はブラウザが合成clickイベントを
      // 出さないことがあり、その場合handleClickが一度も呼ばれず
      // movedRefがtrueのまま残ってしまう。次に単独のタップをしても
      // 「ドラッグ直後」と誤認識してチロムの切り替えが起きない不具合に
      // なっていたため（マウスでは再現しない：クリックは動いた後でも
      // 発火するため）、新しいジェスチャの開始時点で必ずリセットする。
      movedRef.current = false;
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      const onCanvas = !!e.target.closest?.('.pdf-preview-overlay__canvas');
      gestureRef.current = {
        // fit（等倍）または画像の外から始まった1本指はパンしない
        type: onCanvas ? 'pan' : 'none',
        startX: e.clientX,
        startY: e.clientY,
        startTx: transformRef.current.tx,
        startTy: transformRef.current.ty,
      };
    } else if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const { dx, dy } = toStageOffset(centerX, centerY);
      const { scale, tx, ty } = transformRef.current;
      gestureRef.current = {
        type: 'pinch',
        startDist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1,
        startScale: scale,
        // ピンチ中心（2点の中点）の真下にある内容側の座標を固定の軸として
        // 保持する。中心が動く場合（2本指スワイプを伴うピンチ）も、
        // ピンチで拡大縮小する場合も、常にこの点を「今の中心の真下」に
        // 保つことで指へ正しく追従させる。startTx/startScaleと現在フレーム
        // の中心位置を毎回混ぜて軸を求め直すと、拡大率が変わらないまま
        // 中心だけ動かした（＝2本指スワイプ）ときに移動量が打ち消し合って
        // 反応しなくなる不具合になる（実機確認で発覚）。
        anchorLocalX: (dx - tx) / scale,
        anchorLocalY: (dy - ty) / scale,
      };
    }
  };

  const handlePointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.type === 'pan' && pointersRef.current.size === 1) {
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      if (!movedRef.current && Math.hypot(dx, dy) > GESTURE_MOVE_THRESHOLD_PX) {
        movedRef.current = true;
        captureActivePointers();
      }
      // fit（等倍）ではパンできない（下限より縮小させないのと同様、
      // fitのときは動かす意味が無い）
      if (transformRef.current.scale <= MIN_SCALE + 0.001) return;
      transformRef.current = clampTransform({
        scale: transformRef.current.scale,
        tx: gesture.startTx + dx,
        ty: gesture.startTy + dy,
      });
      applyTransform(false);
      return;
    }

    if (gesture.type === 'pinch' && pointersRef.current.size === 2) {
      if (!movedRef.current) {
        movedRef.current = true;
        captureActivePointers();
      }
      const [p1, p2] = [...pointersRef.current.values()];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const rawScale = gesture.startScale * (dist / gesture.startDist);
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const { dx, dy } = toStageOffset(centerX, centerY);
      transformRef.current = clampTransform({
        scale: clampedScale,
        tx: dx - clampedScale * gesture.anchorLocalX,
        ty: dy - clampedScale * gesture.anchorLocalY,
      });
      applyTransform(false);
    }
  };

  const endPointer = (e) => {
    const root = rootRef.current;
    root?.releasePointerCapture?.(e.pointerId);
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
    } else if (pointersRef.current.size === 1) {
      // ピンチから1本指へ戻ったら、残った指でパンを続けられるようにする
      const [remaining] = pointersRef.current.values();
      gestureRef.current = {
        type: 'pan',
        startX: remaining.x,
        startY: remaining.y,
        startTx: transformRef.current.tx,
        startTy: transformRef.current.ty,
      };
    }
  };

  const handlePointerCancel = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) gestureRef.current = null;
  };

  // click（pointerupではない）で判定する。pointer captureはドラッグ・
  // ピンチが実際に始まったときしか行わないため、captureしていないタップ・
  // クリックでは e.target が正しく「指を離した実際の要素」になる。
  const handleClick = (e) => {
    const wasMoved = movedRef.current;
    movedRef.current = false;
    if (wasMoved) {
      // ドラッグ・ピンチ直後のclickは無視する（背景タップ閉じる・
      // ダブルタップ拡大・チロム切り替えのいずれの判定もしない）
      lastTapRef.current = { time: 0, x: 0, y: 0 };
      return;
    }

    const onCloseButton = !!e.target.closest?.('.pdf-preview-overlay__close');
    if (onCloseButton) return; // ボタン自身のonClickへ任せる

    const onCanvas = !!e.target.closest?.('.pdf-preview-overlay__canvas');
    if (!onCanvas) {
      // 背景タップは即時に閉じる。ここにはダブルタップの意味が無いため
      // 待つ必要がない（GridOverlay.jsxと同じ「ドラッグしていないときだけ」
      // の判定は上のwasMovedガードで既に済んでいる）。
      onClose();
      return;
    }

    // ここから先は画像（canvas）上のタップ・クリックだけ。ダブルタップでの
    // 拡大と、シングルタップでのチロム切り替えを区別する。
    const now = Date.now();
    const last = lastTapRef.current;
    const dt = now - last.time;
    const dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    const isDoubleTap = last.time > 0 && dt < DOUBLE_TAP_MS && dist < DOUBLE_TAP_MOVE_PX;

    if (isDoubleTap) {
      // 保留していた1回目のタップぶんのチロム切り替えを取り消し、
      // 拡大だけを行う（1回目のタップでチロムが出てしまう不具合の原因
      // だったため、ここで確実に止める）。
      if (pendingTapTimerRef.current) {
        clearTimeout(pendingTapTimerRef.current);
        pendingTapTimerRef.current = null;
      }
      lastTapRef.current = { time: 0, x: 0, y: 0 };
      const { dx, dy } = toStageOffset(e.clientX, e.clientY);
      const isFit = transformRef.current.scale <= MIN_SCALE + 0.001;
      zoomAt(dx, dy, isFit ? DOUBLE_TAP_SCALE : MIN_SCALE, true);
      return;
    }

    lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
    if (pendingTapTimerRef.current) clearTimeout(pendingTapTimerRef.current);
    pendingTapTimerRef.current = setTimeout(() => {
      pendingTapTimerRef.current = null;
      setChromeVisible((visible) => !visible);
    }, DOUBLE_TAP_MS);
  };

  return createPortal(
    <div
      ref={rootRef}
      className="pdf-preview-overlay"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={handlePointerCancel}
    >
      <div
        ref={viewportRef}
        className="pdf-preview-overlay__viewport"
        role="dialog"
        aria-modal="true"
        aria-label={t('ui.toolbar.pdf.preview.open')}
        tabIndex={-1}
      >
        <div ref={stageRef} className="pdf-preview-overlay__stage">
          <canvas
            ref={canvasRef}
            className="pdf-preview-overlay__canvas"
            style={{ aspectRatio }}
          />
          {phase === 'loading' && (
            <p className="pdf-preview__overlay pdf-preview__overlay--loading" aria-live="polite">
              {t('ui.toolbar.pdf.preview.updating')}
            </p>
          )}
          {phase === 'error' && (
            <p className="pdf-preview__overlay pdf-preview__overlay--error" role="alert">
              {t('ui.toolbar.pdf.preview.failed', { message: errorMessage })}
            </p>
          )}
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className={`pdf-preview-overlay__close${chromeVisible ? '' : ' pdf-preview-overlay__close--hidden'}`}
          onClick={onClose}
          aria-label={t('ui.gridOverlay.close')}
        >
          <CloseIcon />
        </button>
      </div>
    </div>,
    document.body,
  );
}
