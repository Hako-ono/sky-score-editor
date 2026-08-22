import { useEffect, useRef, useState } from 'react';
import { ChevronIcon } from './icons.jsx';
import { useT } from '../i18n/LanguageContext.jsx';
import { useFadePresence } from '../hooks/useFadePresence.js';

/**
 * 「一番上へ戻る」浮遊ボタン。1画面ぶんスクロールしたら出す。
 * 再生中の自動追尾（AutoScrollWatcher, ScoreCanvas.jsx）は止めないため、
 * 押下は window.scrollTo だけで、再生や追尾の state には一切触れない。
 */
export default function ScrollTopFab({ enabled }) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(0);
  const { shouldRender, fadeClassName } = useFadePresence(enabled && visible);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) return;
      // スクロールイベントは1フレームに何度も飛ぶため、実際の判定は
      // requestAnimationFrame で1回に間引く
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        const next = window.scrollY > window.innerHeight;
        // 真偽値が変わらない限り setState しない。再生中の追尾スクロールは
        // グリッドが変わるたびに走るため、ここで毎回 setState すると
        // ScrollTopFab が再生中ずっと再レンダーされ続けることになる
        setVisible((prev) => (prev === next ? prev : next));
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <button
      type="button"
      className={`scroll-top-fab ${fadeClassName}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'auto' })}
      aria-label={t('ui.scrollTopFab.backToTop')}
      title={t('ui.scrollTopFab.backToTop')}
    >
      <ChevronIcon direction="up" />
    </button>
  );
}
