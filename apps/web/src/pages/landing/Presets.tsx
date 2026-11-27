import { layoutPresets, presetConfig, type Mode } from "@readme-studio/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { PresetThumb } from "../../components/PresetThumb";
import { WidgetImage } from "../../components/WidgetImage";
import { cn } from "../../components/ui";
import { href } from "../../lib/router";
import { renderLayout, useFontsReady } from "../../lib/render";
import { Reveal, reducedMotion } from "./scroll";
import { sampleData, useSiteMode } from "./stills";

const DATE = new Date();
const LIST = [
  ...layoutPresets.filter((p) => (p.kind ?? "profile") === "profile").slice(0, 2),
  ...layoutPresets.filter((p) => p.kind === "project").slice(0, 2),
];

/**
 * Four presets. While the section is on screen, the selected one (the first, until another is
 * hovered) fills the page behind it as a full README, and hovering another swaps it in. The choice
 * stays after the pointer leaves. On touch screens the first tap selects, the second opens it.
 */
export function PresetShowcase() {
  const mode = useSiteMode();
  const [selected, setSelected] = useState(LIST[0].id);
  const [visible, setVisible] = useState(false);
  // presets are rendered the first time they are shown, then kept, so swapping back is instant
  const [seen, setSeen] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const hover = useRef(typeof matchMedia !== "undefined" && matchMedia("(hover: hover)").matches);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // on while the row is around the middle of the screen, so the sections either side keep the plain page
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "-25% 0px -25% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (visible && !seen.includes(selected)) setSeen((s) => [...s, selected]);
  }, [visible, selected, seen]);

  return (
    <div ref={ref} className="lp-presets">
      <div className={cn("lp-backdrop", visible && "is-on")} aria-hidden>
        {seen.map((id) => (
          <div key={id} className={cn("lp-backdrop__layer", id === selected && "is-on")}>
            <Backdrop id={id} mode={mode} />
          </div>
        ))}
      </div>
      <div className="preset-row">
        {LIST.map((p, i) => (
          <Reveal key={p.id} delay={i * 90}>
            <a
              className={cn("preset-card lp-tilt", p.id === selected && "is-selected")}
              href={href(`/studio?preset=${p.id}`)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setSelected(p.id)}
              onFocus={() => setSelected(p.id)}
              onClick={(e) => {
                if (hover.current || p.id === selected) return;
                e.preventDefault();
                setSelected(p.id);
              }}
            >
              <PresetThumb id={p.id} height={260} mode={mode} />
              <div className="preset-meta">
                <h4>{p.name}</h4>
                <p>{p.description}</p>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/** A preset's whole README, still, large enough to fill the window behind the page. */
function Backdrop({ id, mode }: { id: string; mode: Mode }) {
  const config = useMemo(() => {
    const c = presetConfig(id);
    // stills: a screen-sized backdrop of looping images would keep the browser drawing every frame
    return { ...c, theme: { ...c.theme, motion: "off" as const } };
  }, [id]);
  const ready = useFontsReady([config.theme.font, config.theme.headingFont]);
  const [rows, setRows] = useState<ReturnType<typeof renderLayout>>([]);
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setRows(renderLayout(config, sampleData(config.kind), mode, DATE)), 0);
    return () => window.clearTimeout(t);
  }, [ready, config, mode]);
  const drift = useRef<HTMLDivElement>(null);

  // the README drifts up slowly while the page scrolls, so more of it passes behind the section
  useEffect(() => {
    const el = drift.current;
    if (!el || reducedMotion()) return;
    let frame = 0;
    const move = () => {
      frame = 0;
      const host = el.closest(".lp-presets");
      if (!host) return;
      const r = host.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
      const room = Math.max(0, el.offsetHeight - window.innerHeight);
      el.style.transform = `translateY(${(-p * room * 0.5).toFixed(1)}px)`;
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(move);
    };
    move();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [rows]);

  return (
    <div className="lp-backdrop__page" style={{ background: mode === "dark" ? "#0d1117" : "#ffffff" }}>
      <div ref={drift} className="lp-backdrop__readme">
        {rows.map((r) => {
          const imgs = r.parts.filter((p) => p.meta.kind !== "markdown");
          if (!imgs.length) return null;
          const fixed = imgs.every((p) => p.meta.fixedHeight);
          return (
            <div key={r.rowId} className={cn("lp-backdrop__row", fixed && "is-pills")}>
              {imgs.map((p) => (
                <WidgetImage key={p.meta.name} part={p} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
