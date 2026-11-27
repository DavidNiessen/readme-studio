import { useEffect, useRef, useState } from "react";

export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
/** 0 → 1 between `a` and `b`, eased. */
export const span = (p: number, a: number, b: number) => ease(clamp((p - a) / (b - a)));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Reports how far the page has scrolled through an element, once per animation frame while it
 * changes. "sticky": 0 when the element's top reaches the top of the window, 1 when its bottom
 * reaches the bottom (for a tall section with a sticky stage inside). "view": 0 when its top enters
 * at the bottom of the window, 1 when its bottom leaves at the top.
 *
 * The callback writes styles directly: re-rendering React sixty times a second for a scroll
 * position would cost more than the animation itself.
 */
export function useScrollProgress(
  ref: React.RefObject<HTMLElement | null>,
  onProgress: (p: number) => void,
  mode: "sticky" | "view" = "view",
): void {
  const cb = useRef(onProgress);
  cb.current = onProgress;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      // the finished state, without the journey
      cb.current(1);
      return;
    }
    let frame = 0;
    let last = -1;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = mode === "sticky" ? clamp(-r.top / Math.max(1, r.height - vh)) : clamp((vh - r.top) / (vh + r.height));
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      cb.current(p);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [ref, mode]);
}

/** True once the element has scrolled into view (and stays true): for fade-in reveals. */
export function useRevealed<T extends HTMLElement>(margin = "-12% 0px"): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(() => reducedMotion() || typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (shown || !el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, margin]);
  return [ref, shown];
}

/** A block that fades and rises into place the first time it is scrolled into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section";
}) {
  const [ref, shown] = useRevealed<HTMLDivElement>();
  return (
    <Tag
      ref={ref as React.RefObject<never>}
      className={`lp-reveal${shown ? " is-in" : ""}${className ? ` ${className}` : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
