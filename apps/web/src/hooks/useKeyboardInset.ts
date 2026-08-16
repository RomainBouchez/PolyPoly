import { useEffect, useState } from 'react';

/**
 * How many pixels the on-screen keyboard currently covers at the bottom of the
 * window.
 *
 * A `fixed` element is positioned against the layout viewport, which the
 * keyboard does not shrink — so a bottom-anchored sheet keeps sitting under the
 * keyboard while the visual viewport shrinks above it. Measuring the gap
 * between the two is the only reliable cross-browser way to find that height:
 * `env(keyboard-inset-height)` is barely supported, and the viewport-meta
 * `interactive-widget` hint is Chromium-only.
 *
 * Returns 0 where visualViewport is unavailable, so callers degrade to the
 * previous behaviour rather than breaking.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      // offsetTop matters when the page itself is scrolled up to reveal a
      // focused field; without it the keyboard reads as taller than it is.
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(covered > 1 ? covered : 0);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
