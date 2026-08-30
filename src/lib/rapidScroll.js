// iPhone実測では通常操作の最大値が約210,000px/s、高速操作が
// 1,400,000px/s超だった。両者の間に置き、通常スクロールで表示を
// 不要に簡略化せず、強制リロードが再現した速度域だけを対象にする。
export const RAPID_TOUCH_SCROLL_MIN_SPEED_PX_PER_SEC = 300_000;
export const RAPID_TOUCH_SCROLL_IDLE_MS = 180;

/**
 * 高速スクロール中だけ軽量カードへ切り替えるかを判定する純関数。
 * タッチ操作を開始点に限定することで、キーボード移動・再生追尾・
 * window.scrollToなどのプログラム的スクロールを巻き込まない。
 */
export function shouldUseRapidScrollPlaceholders({
  isMobile,
  hasTouchScrollSession,
  playbackState,
  hasEditableFocus,
  speedPxPerSec,
}) {
  return isMobile === true
    && hasTouchScrollSession === true
    && playbackState === 'stopped'
    && hasEditableFocus !== true
    && Number.isFinite(speedPxPerSec)
    && speedPxPerSec >= RAPID_TOUCH_SCROLL_MIN_SPEED_PX_PER_SEC;
}
