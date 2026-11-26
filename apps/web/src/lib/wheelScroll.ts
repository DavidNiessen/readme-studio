/**
 * The lists that scroll sideways: tab bars and chip rows. Tables and code blocks that are only
 * wide keep the wheel for the page, so reading them is not interrupted.
 */
const LISTS = ".tabs, .lib-cats, .gallery__tabs, .mobile-tabs, .docs-switch__track, [data-wheel-x]";

/**
 * Lists that only scroll sideways (tab bars, chip rows) follow an ordinary mouse wheel: its
 * vertical turn scrolls them horizontally. Lists that also scroll vertically, sideways trackpad
 * swipes, and lists already at the end in that direction are left alone, so the page scrolls on.
 */
function sideways(el: Element | null): HTMLElement | null {
  for (let n = (el as HTMLElement | null)?.closest<HTMLElement>(LISTS) ?? null; n; n = n.parentElement?.closest<HTMLElement>(LISTS) ?? null) {
    if (n.scrollWidth <= n.clientWidth + 1) continue;
    const style = getComputedStyle(n);
    if (!/(auto|scroll)/.test(style.overflowX)) continue;
    // something that scrolls both ways keeps the wheel for its own vertical scrolling
    if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(style.overflowY)) return null;
    return n;
  }
  return null;
}

let installed = false;

export function installWheelScroll(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const el = sideways(e.target as Element);
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    },
    { passive: false },
  );
}
