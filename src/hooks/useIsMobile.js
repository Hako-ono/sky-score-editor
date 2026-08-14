import { useSyncExternalStore } from 'react';
import { MOBILE_MEDIA_QUERY } from '../constants/config.js';

// モジュール読み込み時に window を触ると、ブラウザのない実行環境
// （vitest の既定 environment）で読み込んだだけで落ちる。最初に
// 必要になった時点で作る。
let mediaQuery = null;
function getMediaQuery() {
  if (!mediaQuery) mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
  return mediaQuery;
}

// useSyncExternalStore は subscribe / getSnapshot が毎レンダーで新しい
// 関数だと再購読を繰り返すため、モジュールスコープに固定して置く。
function subscribe(callback) {
  const mq = getMediaQuery();
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSnapshot() {
  return getMediaQuery().matches;
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
