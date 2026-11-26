import { getWidget } from "@readme-studio/core";
import { useEffect, useRef, useState } from "react";
import { findBlock } from "../lib/layout";
import { useStudio } from "../state/store";

export interface DropAt {
  id: string;
  after: boolean;
}

/** How far the pointer moves before a press on a block becomes a drag, not a click. */
const THRESHOLD = 6;
const EDGE = 48;

/**
 * Dragging blocks on the canvas: press on a block and move to drag it (or the whole selection,
 * when it is part of one); a line shows where it lands; release to drop, Esc to cancel. A press
 * that does not move stays a click.
 */
export function useCanvasDrag(scroller: React.RefObject<HTMLElement | null>) {
  const [drag, setDrag] = useState<{ ids: string[]; label: string; x: number; y: number } | null>(null);
  const [drop, setDrop] = useState<DropAt | null>(null);
  const press = useRef<{ id: string; x: number; y: number } | null>(null);
  const live = useRef<{ ids: string[]; drop: DropAt | null } | null>(null);

  useEffect(() => {
    const target = (x: number, y: number, ids: string[]): DropAt | null => {
      const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-block]");
      const id = el?.dataset.block;
      if (!el || !id || ids.includes(id)) return null;
      // blocks of several parts (shields, socials): measure the whole block, not one part
      const parts = [...document.querySelectorAll<HTMLElement>(`.canvas [data-block="${CSS.escape(id)}"]`)].map((p) => p.getBoundingClientRect());
      const top = Math.min(...parts.map((r) => r.top));
      const bottom = Math.max(...parts.map((r) => r.bottom));
      return { id, after: y > (top + bottom) / 2 };
    };
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!live.current) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < THRESHOLD) return;
        const s = useStudio.getState();
        const ids = s.selection.includes(p.id) ? s.selection : [p.id];
        const type = findBlock(s.config, p.id)?.block.type ?? "";
        live.current = { ids, drop: null };
        document.body.classList.add("is-dragging-blocks");
        setDrag({ ids, label: ids.length > 1 ? `${ids.length} widgets` : (getWidget(type)?.title ?? p.id), x: e.clientX, y: e.clientY });
      }
      const d = live.current;
      d.drop = target(e.clientX, e.clientY, d.ids);
      setDrop(d.drop);
      setDrag((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
      // near the canvas edges, scroll so any spot can be reached
      const box = scroller.current?.getBoundingClientRect();
      if (box && scroller.current) {
        if (e.clientY < box.top + EDGE) scroller.current.scrollBy({ top: -14 });
        else if (e.clientY > box.bottom - EDGE) scroller.current.scrollBy({ top: 14 });
      }
    };
    const end = (commit: boolean) => {
      const d = live.current;
      press.current = null;
      live.current = null;
      document.body.classList.remove("is-dragging-blocks");
      setDrag(null);
      setDrop(null);
      if (!d) return;
      // the click the browser sends right after the release must not change the selection;
      // it comes before any timer, so the guard is gone again before the next real click
      const swallow = (e: MouseEvent) => e.stopPropagation();
      window.addEventListener("click", swallow, true);
      setTimeout(() => window.removeEventListener("click", swallow, true), 0);
      if (commit && d.drop) useStudio.getState().moveTo(d.ids, d.drop.id, d.drop.after);
    };
    const up = () => end(true);
    const cancel = () => end(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && live.current) {
        e.stopPropagation();
        end(false);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
    };
  }, [scroller]);

  /** Spread onto a block's element: a primary-button press may turn into a drag. */
  const handle = (id: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || e.pointerType === "touch") return;
      if ((e.target as HTMLElement).closest(".cv-tools, a[href], textarea, input")) return;
      press.current = { id, x: e.clientX, y: e.clientY };
    },
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  });

  return { drag, drop, handle };
}
