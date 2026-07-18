import { useEffect, useRef, useState } from "react";

/**
 * Native-feel pull-to-refresh for mobile. Tracks touch drag from the top of
 * the page; when the user releases past the threshold, calls onRefresh().
 * Returns the current pull distance (0..max) for rendering an indicator,
 * plus an isRefreshing flag.
 *
 * Only engages when:
 * - window.scrollY === 0 at touchstart
 * - the gesture is a downward drag (dy > 0)
 * - on coarse-pointer devices (phones/tablets)
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  opts?: { threshold?: number; max?: number },
) {
  const threshold = opts?.threshold ?? 70;
  const max = opts?.max ?? 110;
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;
  refreshingRef.current = refreshing;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const apply = (v: number) => { pullRef.current = v; setPull(v); };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (window.scrollY > 0) return;
      if (e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!active.current || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { apply(0); return; }
      const eased = Math.min(max, dy * 0.55);
      apply(eased);
      if (dy > 8 && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = async () => {
      const finalPull = pullRef.current;
      active.current = false;
      startY.current = null;
      if (finalPull >= threshold && !refreshingRef.current) {
        setRefreshing(true);
        apply(threshold);
        try { await cb.current(); } finally {
          setRefreshing(false);
          apply(0);
        }
      } else {
        apply(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [threshold, max]);

  return { pull, refreshing, threshold };
}
