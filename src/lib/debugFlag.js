/**
 * `?debug=1` の診断オーバレイ・計測を有効にするかどうかのフラグ。
 * モジュールスコープで一度だけ URL を読む定数にしている。レンダーのたびに
 * URLSearchParams を作ると、フラグが立っていない通常利用の経路にまで
 * コストが乗ってしまうため。
 */
export const DEBUG_ENABLED =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('debug') === '1';
