import { getWidget, normalizeConfig, palettePresets, type Mode } from "@readme-studio/core";
import { ArrowRight, GripVertical, Moon, Plus, RotateCcw, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WidgetImage } from "../../components/WidgetImage";
import { cn } from "../../components/ui";
import { href } from "../../lib/router";
import { encodeShare } from "../../lib/share";
import { useStills } from "./stills";

/** What the playground offers: profile widgets that read well small. */
const OFFER = ["hero", "socials", "stats", "contrib", "pulse", "languages", "terminal", "streak", "clock", "footer"].filter((t) =>
  getWidget(t),
);
const START = ["hero", "stats"];
const PALETTES = ["crimson", "ocean", "amber", "github", "nord", "sakura", "forest", "mono"].filter((id) =>
  palettePresets.some((p) => p.id === id),
);

let nextKey = 1;
interface Item {
  key: number;
  type: string;
}

/**
 * A small studio on the landing page itself: drag widgets (or click them) into a README, drag
 * them into order, remove them, switch palette and theme, and carry the result into the studio.
 * Everything renders with the real renderer.
 */
export function Playground() {
  const [items, setItems] = useState<Item[]>(() => START.map((type) => ({ key: nextKey++, type })));
  const [palette, setPalette] = useState("crimson");
  const [mode, setMode] = useState<Mode>("dark");
  const blocks = items.map((i) => ({ type: i.type, options: i.type === "contrib" ? { weekly: false } : undefined }));
  // entrances play as a widget lands, then it rests: no endless loops on a landing page
  const rows = useStills(blocks, { palette, mode, motion: "subtle" });
  const list = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: "offer" | "readme"; type: string; key?: number; x: number; y: number; at: number } | null>(null);
  const press = useRef<{ from: "offer" | "readme"; type: string; key?: number; x: number; y: number } | null>(null);
  const dragging = useRef(false);
  // the click a browser sends after a drag ends must not add the widget a second time
  const justDragged = useRef(false);

  /** Where a drop at height y lands in the README: before the first item whose middle is below it. */
  const slotAt = (y: number) => {
    const els = [...(list.current?.querySelectorAll<HTMLElement>("[data-pg-item]") ?? [])];
    const i = els.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return i < 0 ? els.length : i;
  };
  const overList = (x: number, y: number) => {
    const r = list.current?.getBoundingClientRect();
    return !!r && x >= r.left - 40 && x <= r.right + 40 && y >= r.top - 40 && y <= r.bottom + 40;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!dragging.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
      dragging.current = true;
      setDrag({ ...p, x: e.clientX, y: e.clientY, at: overList(e.clientX, e.clientY) ? slotAt(e.clientY) : -1 });
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      const wasDragging = dragging.current;
      press.current = null;
      dragging.current = false;
      if (!p || !wasDragging) return setDrag(null);
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      const at = overList(e.clientX, e.clientY) ? slotAt(e.clientY) : -1;
      setDrag(null);
      setItems((cur) => {
        if (p.from === "offer") return at < 0 ? cur : [...cur.slice(0, at), { key: nextKey++, type: p.type }, ...cur.slice(at)];
        const from = cur.findIndex((i) => i.key === p.key);
        // dragged out of the README: removed
        if (at < 0) return cur.filter((i) => i.key !== p.key);
        const next = cur.filter((i) => i.key !== p.key);
        const to = at > from ? at - 1 : at;
        next.splice(to, 0, cur[from]);
        return next;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studioLink = () =>
    href(
      `/studio?design=${encodeShare(
        normalizeConfig({
          profile: { login: "octocat" },
          theme: { preset: palette },
          layout: blocks.map((b) => ({ blocks: [{ type: b.type, options: b.options }] })),
        }).config,
      )}`,
    );
  const grab = (e: React.PointerEvent, from: "offer" | "readme", type: string, key?: number) => {
    if (e.button !== 0) return;
    if (e.pointerType !== "mouse") return; // fingers scroll; tapping still adds
    press.current = { from, type, key, x: e.clientX, y: e.clientY };
  };

  return (
    <div className={cn("lp-pg", drag && "is-dragging")}>
      <div className="lp-pg__offer">
        <div className="lp-pg__label">Widgets · drag or tap</div>
        <div className="lp-pg__chips">
          {OFFER.map((t) => (
            <button
              key={t}
              type="button"
              className="lp-chip"
              onPointerDown={(e) => grab(e, "offer", t)}
              onClick={() => !justDragged.current && setItems((cur) => [...cur, { key: nextKey++, type: t }])}
            >
              <Plus /> {getWidget(t)!.title}
            </button>
          ))}
        </div>
        <div className="lp-pg__label">Palette</div>
        <div className="lp-pg__swatches">
          {PALETTES.map((id) => {
            const p = palettePresets.find((x) => x.id === id)!;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={palette === id}
                aria-label={p.name}
                title={p.name}
                onClick={() => setPalette(id)}
                style={{ background: `linear-gradient(135deg, ${p.dark.card} 0 50%, ${p.dark.accent} 50% 100%)` }}
              />
            );
          })}
        </div>
        <div className="lp-pg__row">
          <div className="lp-pg__mode" role="group" aria-label="Colour scheme">
            <button type="button" aria-pressed={mode === "dark"} onClick={() => setMode("dark")}>
              <Moon /> Dark
            </button>
            <button type="button" aria-pressed={mode === "light"} onClick={() => setMode("light")}>
              <Sun /> Light
            </button>
          </div>
          <button
            type="button"
            className="lp-pg__reset"
            onClick={() => setItems(START.map((type) => ({ key: nextKey++, type })))}
            title="Start over"
          >
            <RotateCcw />
          </button>
        </div>
        <a className="btn btn--accent btn--lg lp-pg__go" href={studioLink()}>
          Open this in the studio <ArrowRight />
        </a>
      </div>
      <div className={cn("lp-pg__readme", mode === "light" && "is-light")}>
        <div className="lp-pg__file mono">octocat / README.md</div>
        <div ref={list} className="lp-pg__list">
          {items.map((it, i) => (
            <div
              key={it.key}
              data-pg-item
              className={cn("lp-pg__item", drag?.key === it.key && "is-dragged", drag && drag.at === i && "is-drop-before")}
              onPointerDown={(e) => grab(e, "readme", it.type, it.key)}
            >
              <span className="lp-pg__grip" aria-hidden>
                <GripVertical />
              </span>
              <button
                type="button"
                className="lp-pg__remove"
                aria-label={`Remove ${getWidget(it.type)?.title}`}
                onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <X />
              </button>
              <div className="lp-pg__parts">
                {(rows[i] ?? []).map((p) => (
                  <WidgetImage key={p.meta.name} part={p} style={p.meta.fixedHeight ? { height: 26, width: "auto" } : undefined} />
                ))}
                {!rows[i] && <div className="lp-skeleton lp-skeleton--sm" />}
              </div>
            </div>
          ))}
          <div className={cn("lp-pg__end", drag && drag.at === items.length && "is-drop-before", !items.length && "is-empty")}>
            {items.length ? "Drop here" : "Drag a widget here to start"}
          </div>
        </div>
      </div>
      {drag && (
        <div className="lp-pg__ghost" style={{ left: drag.x + 12, top: drag.y + 10 }}>
          {drag.at < 0 && drag.from === "readme" ? "Remove " : drag.from === "offer" ? "Add " : "Move "}
          {getWidget(drag.type)?.title}
        </div>
      )}
    </div>
  );
}
