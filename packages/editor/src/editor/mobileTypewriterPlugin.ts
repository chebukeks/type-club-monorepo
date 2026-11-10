import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export const mobileTypewriterPluginKey = new PluginKey('mobileTypewriter');

export function createMobileTypewriterPlugin(): Plugin {
  let isUserInteracting = false;
  let interactionTimeout: number | null = null;
  let rafId: number | null = null;

  function isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(max-width: 768px)').matches ||
      ('ontouchstart' in window && window.innerWidth <= 1024)
    );
  }

  function getScrollContainer(view: EditorView): HTMLElement | null {
    let el: HTMLElement | null = view.dom.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight
      ) {
        return el;
      }
      el = el.parentElement;
    }
    el = view.dom.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return el;
      }
      el = el.parentElement;
    }
    return (view.dom.closest('.overflow-auto') as HTMLElement) || document.documentElement;
  }

  function scrollToTypewriter(view: EditorView) {
    if (view.isDestroyed || !view.hasFocus()) return;
    if (isUserInteracting) return;
    if (!isMobile()) return;

    const scrollContainer = getScrollContainer(view);
    if (!scrollContainer) return;

    let coords: { top: number; bottom: number };
    try {
      coords = view.coordsAtPos(view.state.selection.head);
    } catch {
      return;
    }

    const caretY = (coords.top + coords.bottom) / 2;
    const containerRect = scrollContainer.getBoundingClientRect();

    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const visibleTop = Math.max(containerRect.top, vv ? vv.offsetTop : 0);
    const visibleBottom = Math.min(
      containerRect.bottom,
      vv ? vv.offsetTop + vv.height : window.innerHeight
    );

    // Leave space for mobile toolbar at bottom (approx 48px)
    const effectiveBottom = Math.max(visibleTop + 80, visibleBottom - 48);
    const visibleHeight = effectiveBottom - visibleTop;

    // Center caret around 42% of visible screen above keyboard
    const targetY = visibleTop + visibleHeight * 0.42;
    const offset = caretY - targetY;

    if (Math.abs(offset) > 4) {
      scrollContainer.scrollBy({
        top: offset,
        behavior: Math.abs(offset) > 120 ? 'smooth' : 'auto',
      });
    }
  }

  return new Plugin({
    key: mobileTypewriterPluginKey,
    props: {
      handleDOMEvents: {
        touchstart: () => {
          if (interactionTimeout) clearTimeout(interactionTimeout);
          isUserInteracting = true;
          return false;
        },
        touchmove: () => {
          isUserInteracting = true;
          return false;
        },
        touchend: () => {
          if (interactionTimeout) clearTimeout(interactionTimeout);
          interactionTimeout = window.setTimeout(() => {
            isUserInteracting = false;
          }, 300);
          return false;
        },
        touchcancel: () => {
          isUserInteracting = false;
          return false;
        },
      },
    },
    view() {
      return {
        update(view, prevState) {
          const docChanged = !view.state.doc.eq(prevState.doc);
          const hasFocus = view.hasFocus();

          // Active strictly when user is typing text (doc changed and focused)
          if (docChanged && hasFocus && isMobile() && !isUserInteracting) {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('editor-typing'));
            }
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
              scrollToTypewriter(view);
            });
          }
        },
        destroy() {
          if (rafId) cancelAnimationFrame(rafId);
          if (interactionTimeout) clearTimeout(interactionTimeout);
        },
      };
    },
  });
}
