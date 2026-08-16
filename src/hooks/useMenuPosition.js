import { useCallback, useLayoutEffect, useRef } from 'react';

const MENU_VIEWPORT_GAP = 8;

export function useMenuPosition(isOpen) {
  const panelRef = useRef(null);

  const updatePosition = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || typeof window === 'undefined') return;

    panel.style.setProperty('--menu-shift', '0px');
    panel.style.setProperty('--menu-y-shift', '0px');
    const rect = panel.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportRight = viewportLeft
      + (viewport?.width ?? window.innerWidth)
      - MENU_VIEWPORT_GAP;
    const viewportBottom = viewportTop
      + (viewport?.height ?? window.innerHeight)
      - MENU_VIEWPORT_GAP;
    let shift = 0;
    let yShift = 0;

    if (rect.left < viewportLeft + MENU_VIEWPORT_GAP) {
      shift = viewportLeft + MENU_VIEWPORT_GAP - rect.left;
    } else if (rect.right > viewportRight) {
      shift = viewportRight - rect.right;
    }
    if (rect.bottom > viewportBottom) {
      yShift = viewportBottom - rect.bottom;
    }
    if (rect.top + yShift < viewportTop + MENU_VIEWPORT_GAP) {
      yShift += viewportTop + MENU_VIEWPORT_GAP - (rect.top + yShift);
    }

    panel.style.setProperty('--menu-shift', `${shift}px`);
    panel.style.setProperty('--menu-y-shift', `${yShift}px`);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('orientationchange', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('orientationchange', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [isOpen, updatePosition]);

  return panelRef;
}
