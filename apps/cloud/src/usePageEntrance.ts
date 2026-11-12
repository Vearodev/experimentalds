import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Only the changed content responds. Navigation and page geometry stay still. */
export function usePageEntrance(
  container: RefObject<HTMLElement | null>,
  locationKey: string,
  loading: boolean,
) {
  const previousLocation = useRef<string | null>(null);
  const lastChangeAt = useRef(-Infinity);
  useLayoutEffect(() => {
    const root = container.current;
    if (!root || loading) return;
    const previous = previousLocation.current;
    previousLocation.current = locationKey;
    // Initial data, refreshes and ordinary rerenders must not replay an entrance.
    if (previous === null || previous === locationKey) return;
    const content = root.querySelector<HTMLElement>(
      ':scope > .basis-tabs > .basis-tabs__panel, :scope > .cloud-metrics',
    );
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (!content?.animate || reduced.matches) return;
    const style = getComputedStyle(content);
    const rawDuration = style.getPropertyValue('--basis-comp-shell-content-enter-duration').trim();
    const duration = parseFloat(rawDuration) * (rawDuration.endsWith('ms') ? 1 : 1000);
    const easing = style.getPropertyValue('--basis-comp-shell-content-enter-easing').trim();
    const opacity = Number(style.getPropertyValue('--basis-comp-shell-content-enter-opacity'));
    if (!Number.isFinite(duration) || duration <= 0 || opacity < 0 || opacity >= 1) return;
    const now = performance.now();
    const elapsed = now - lastChangeAt.current;
    lastChangeAt.current = now;
    // Rapid keyboard navigation settles immediately instead of flashing repeatedly.
    if (elapsed < duration) return;
    const animation = content.animate([{ opacity }, { opacity: 1 }], { duration, easing });
    const cancel = () => animation.cancel();
    reduced.addEventListener('change', cancel);
    return () => {
      cancel();
      reduced.removeEventListener('change', cancel);
    };
  }, [container, locationKey, loading]);
}
