/**
 * Switches the site between light and dark with a transition instead of a cut. Where the browser
 * supports view transitions, the new theme spreads as a circle from the control that was used;
 * elsewhere colours fade for a moment. With reduced motion it switches at once.
 *
 * `apply` must change the page synchronously (set the theme attribute, and flush any React state
 * that depends on it), because the browser photographs the page right after it returns.
 */
export function switchTheme(apply: () => void, from?: { x: number; y: number }): void {
  const root = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
  const doc = document as Document & { startViewTransition?: (update: () => void) => { ready: Promise<void> } };
  if (!doc.startViewTransition) {
    root.classList.add("is-theming");
    apply();
    window.setTimeout(() => root.classList.remove("is-theming"), 450);
    return;
  }
  const x = from?.x ?? window.innerWidth - 60;
  const y = from?.y ?? 30;
  // far enough to cover the farthest corner of the window
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const t = doc.startViewTransition(apply);
  t.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 700, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => undefined);
}

/** The centre of the element an event came from: where the new theme spreads from. */
export function originOf(e: { currentTarget: EventTarget | null }): { x: number; y: number } | undefined {
  const el = e.currentTarget as HTMLElement | null;
  if (!el?.getBoundingClientRect) return undefined;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
