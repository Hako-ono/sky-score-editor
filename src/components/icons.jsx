import { useId } from 'react';

/**
 * 画面上のアイコン。文字（絵文字・記号）で描くと字形の選択がOSの
 * フォントフォールバックに委ねられ、iOS ではカラー絵文字になる。
 * 字形をアプリ内に持つことで描画を端末に依存させない。
 */

/** 再生(ここから再生) */
export function PlayIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <polygon points="8,5 19,12 8,19" fill="currentColor" />
    </svg>
  );
}

/**
 * 単音(このグリッドのみ再生)。4分音符の形。茎の右端(x=16)は、符頭(rx=4.4, ry=3.3,
 * -22°回転)の外接半幅 √((rx·cos22°)²+(ry·sin22°)²)≈4.05 から逆算した
 * 位置で、符頭の輪郭からはみ出さない。符頭の中心を x=12 に置き、全体の
 * 重心が24枠の中心(12,12)に来るようにしている。
 */
export function NoteIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M13.8 16.6V3.9h2.2v12.7z" fill="currentColor" />
      <ellipse cx="12" cy="16.6" rx="4.4" ry="3.3" transform="rotate(-22 12 16.6)" fill="currentColor" />
    </svg>
  );
}

/** レイヤー切り替え。中心へ寄せた2枚の輪郭ひし形で別々の所属を表す。 */
export function LayerSwitchIcon({ size = 18 }) {
  const topLayerMaskId = useId();

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <mask
        id={topLayerMaskId}
        x="0"
        y="0"
        width="24"
        height="24"
        maskUnits="userSpaceOnUse"
        maskContentUnits="userSpaceOnUse"
      >
        <rect width="24" height="24" fill="#fff" />
        <polygon points="12,4.2 21.6,9.5 12,14.8 2.4,9.5" fill="#000" />
      </mask>
      <polygon
        points="12,9.2 21.6,14.5 12,19.8 2.4,14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        mask={`url(#${topLayerMaskId})`}
      />
      <polygon
        points="12,4.2 21.6,9.5 12,14.8 2.4,9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 閉じる・削除 */
export function CloseIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** 方向を回転で表す。矢印の形を4つ持つより、1つを回す方が線幅が揃う */
const CHEVRON_ROTATION = { right: 0, left: 180, down: 90, up: -90 };

export function ChevronIcon({ direction = 'right', size = 18 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ transform: `rotate(${CHEVRON_ROTATION[direction]}deg)` }}
    >
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** ライトモードへ切替 */
export function SunIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2.4v2.6M12 19v2.6M21.6 12H19M5 12H2.4M18.8 5.2L17 7M7 17l-1.8 1.8M18.8 18.8L17 17M7 7L5.2 5.2"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * ダークモードへ切替。三日月は円弧2本の手計算パスではなく、外側の円を
 * 内側の円で mask を使ってくり抜く方式にしている。arc-flagの組み合わせを
 * 手で解いて三日月になるかは実際に描画しないと確証が持てないが、円と円の
 * 重なりで欠けさせる方式は座標さえ重なっていれば必ず三日月形になり、
 * 目視確認なしでも形状の破綻が起きない。
 */
export function MoonIcon({ size = 18 }) {
  const maskId = useId();
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <mask id={maskId}>
        <rect width="24" height="24" fill="#fff" />
        <circle cx="14.5" cy="9" r="6.5" fill="#000" />
      </mask>
      <circle cx="11" cy="13" r="8" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

/**
 * 元に戻す／やり直す。横向きのU字（平行な2本の腕を半円でつなぐ）を、
 * 腕の長さと半径を揃えた1:1の比率で描く。redo は undo の左右反転で
 * 描く。曲線に円弧（A コマンド）ではなく3次ベジェを使っているのは、
 * arc-flag の組み合わせが正しいかは
 * 描画しないと確証が持てないため（MoonIcon と同じ理由）
 */
function HistoryArrow({ size, flip }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M7 8.75H12C14.76 8.75 17 10.99 17 13.75C17 16.51 14.76 18.75 12 18.75H7"
            fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 5.25L7 8.75l3.5 3.5" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UndoIcon({ size = 18 }) {
  return <HistoryArrow size={size} flip={false} />;
}

export function RedoIcon({ size = 18 }) {
  return <HistoryArrow size={size} flip />;
}

/** プレビューが最新であることを示すチェックマーク。直線2本のみで
    構成し、曲線・円弧を使わない。 */
export function CheckIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
