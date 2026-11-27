import { palettePresets } from "@readme-studio/core";
import { BookOpen, Check, Moon, Sun, UploadCloud } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WidgetImage } from "../../components/WidgetImage";
import { cn } from "../../components/ui";
import type { RenderedPart } from "../../lib/render";
import { clamp, ease, lerp, reducedMotion, useScrollProgress } from "./scroll";
import { useStillVariants } from "./stills";

/** The widgets the cursor drags in, in order. */
const LIBRARY = [
  { type: "hero", title: "Hero banner" },
  { type: "socials", title: "Social pills" },
  { type: "stats", title: "Stats board" },
  { type: "contrib", title: "Contribution graph", options: { weekly: false } },
];
const BLOCKS = LIBRARY.map(({ type, options }) => ({ type, options }));
const SWATCHES = ["crimson", "ocean", "amber", "github", "nord", "sakura"];

/** Every look the demo passes through, rendered ahead while the page is idle. */
const VARIANTS = {
  crimson: { palette: "crimson" },
  ocean: { palette: "ocean" },
  amber: { palette: "amber" },
  "amber-light": { palette: "amber", mode: "light" as const },
};
type Variant = keyof typeof VARIANTS;

const STEPS = [
  { title: "Drag widgets in", text: "Pick from 54 widgets and drop each one where it belongs." },
  { title: "Make it yours", text: "17 palettes, 12 typefaces, dark and light, all previewed live." },
  { title: "Save to GitHub", text: "One commit. Your repository's workflow does the rest." },
];

// ---------------------------------------------------------------- the script

/** Where the cursor is at a moment of the scroll: aimed at a named element, the button up or down. */
interface Key {
  t: number;
  at: string;
  down?: boolean;
}

const DROP_START = 0.04;
const DROP_EACH = 0.13;
const KEYS: Key[] = (() => {
  const k: Key[] = [{ t: 0, at: "rest" }];
  LIBRARY.forEach((_, i) => {
    const t0 = DROP_START + i * DROP_EACH;
    k.push(
      { t: t0 + 0.035, at: `card-${i}` },
      { t: t0 + 0.045, at: `card-${i}`, down: true },
      { t: t0 + 0.105, at: "drop", down: true },
      { t: t0 + 0.113, at: "drop" },
    );
  });
  const click = (t: number, at: string) => k.push({ t, at }, { t: t + 0.012, at, down: true }, { t: t + 0.024, at });
  click(0.6, "swatch-1");
  click(0.67, "swatch-2");
  click(0.75, "mode-light");
  click(0.85, "save");
  k.push({ t: 1, at: "save" });
  return k;
})();

/** What the demo shows at a point of the scroll. */
function stateAt(p: number) {
  const placed = LIBRARY.filter((_, i) => p >= DROP_START + i * DROP_EACH + 0.105).length;
  const dragging = LIBRARY.findIndex((_, i) => {
    const t0 = DROP_START + i * DROP_EACH;
    return p >= t0 + 0.045 && p < t0 + 0.105;
  });
  const palette = p >= 0.682 ? 2 : p >= 0.612 ? 1 : 0;
  const light = p >= 0.762;
  const saved = p >= 0.862;
  const step = p < 0.57 ? 0 : p < 0.82 ? 1 : 2;
  const stepProgress = step === 0 ? p / 0.57 : step === 1 ? (p - 0.57) / 0.25 : (p - 0.82) / 0.18;
  return { placed, dragging, palette, light, saved, step, stepProgress: clamp(stepProgress) };
}

// ---------------------------------------------------------------- the stage

/**
 * The studio, played by scrolling: a cursor drags four widgets from the library into a README,
 * tries two palettes and the light theme, and saves to GitHub. The stage is a fixed-size mock,
 * scaled to fit, and the cursor aims at its elements by measuring them, so the same script plays
 * on the wide layout and on the compact one phones get.
 */
export function Demo() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const scrollBox = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const [compact, setCompact] = useState(false);
  const [state, setState] = useState(() => stateAt(reducedMotion() ? 1 : 0));
  const renders = useStillVariants(VARIANTS, BLOCKS);
  const variant: Variant = state.light ? "amber-light" : (["crimson", "ocean", "amber"] as const)[state.palette];
  const rows = renders[variant] ?? renders.crimson ?? [];
  const thumbs = renders.crimson ?? [];

  // the stage is designed at a fixed size and scaled to the space it has
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      const narrow = el.clientWidth < 760;
      setCompact(narrow);
      const w = narrow ? 640 : 1160;
      const h = narrow ? 900 : 720;
      const room = window.innerHeight - (narrow ? 210 : 190);
      const s = Math.min(1, el.clientWidth / w, room / h);
      el.style.setProperty("--s", String(s));
      el.style.setProperty("--w", `${w}px`);
      el.style.setProperty("--h", `${h}px`);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, []);

  const last = useRef(state);
  useScrollProgress(
    section,
    (p) => {
      const next = stateAt(p);
      const prev = last.current;
      if (
        next.placed !== prev.placed ||
        next.dragging !== prev.dragging ||
        next.palette !== prev.palette ||
        next.light !== prev.light ||
        next.saved !== prev.saved ||
        next.step !== prev.step
      ) {
        last.current = next;
        setState(next);
      }
      bars.current.forEach((b, i) => b?.style.setProperty("--fill", String(i < next.step ? 1 : i === next.step ? next.stepProgress : 0)));
      moveCursor(p, next);
    },
    "sticky",
  );

  /** Puts the cursor (and the widget it drags) where the script says, aiming at measured elements. */
  const moveCursor = (p: number, s: ReturnType<typeof stateAt>) => {
    const f = frame.current;
    const c = cursor.current;
    if (!f || !c) return;
    const scale = Number(getComputedStyle(stage.current!).getPropertyValue("--s")) || 1;
    const fr = f.getBoundingClientRect();
    const point = (name: string): [number, number] => {
      const el = f.querySelector<HTMLElement>(`[data-demo="${name}"]`);
      if (!el) return [fr.width / scale / 2, fr.height / scale / 2];
      const r = el.getBoundingClientRect();
      const y = name === "drop" ? r.top + Math.min(r.height / 2, 40 * scale) : r.top + r.height / 2;
      return [(r.left + r.width / 2 - fr.left) / scale, (y - fr.top) / scale];
    };
    let i = KEYS.findIndex((k) => k.t > p);
    if (i < 0) i = KEYS.length - 1;
    const a = KEYS[Math.max(0, i - 1)];
    const b = KEYS[i];
    const t = b.t === a.t ? 1 : ease(clamp((p - a.t) / (b.t - a.t)));
    const [ax, ay] = point(a.at);
    const [bx, by] = point(b.at);
    const x = lerp(ax, bx, t);
    const y = lerp(ay, by, t);
    const down = !!(t < 0.5 ? a.down : b.down);
    c.style.transform = `translate(${x}px, ${y}px) scale(${down ? 0.86 : 1})`;
    const g = ghost.current;
    if (g) {
      g.style.transform = `translate(${x + 14}px, ${y + 12}px) rotate(-2deg)`;
      g.style.opacity = s.dragging >= 0 ? "1" : "0";
    }
    // the README grows past the canvas: keep its newest widget in view
    const v = scrollBox.current;
    const content = inner.current;
    if (v && content) {
      const over = Math.max(0, content.scrollHeight - v.clientHeight + 24);
      content.style.transform = `translateY(${-over}px)`;
    }
  };

  // keep the cursor in place when the layout changes under it (a widget lands, the stage resizes)
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("scroll")));
    return () => cancelAnimationFrame(id);
  }, [state, compact, rows]);

  const dragged = state.dragging >= 0 ? thumbs[state.dragging]?.[0] : undefined;
  return (
    <section ref={section} className={cn("lp-demo", reducedMotion() && "is-still")} aria-label="How a README is made in the studio">
      <div className="lp-demo__sticky">
        <div className="wrap lp-demo__head">
          <ol className="lp-steps">
            {STEPS.map((st, i) => (
              <li key={st.title} className={cn(i === state.step && "is-on", i < state.step && "is-done")}>
                <span className="lp-steps__bar">
                  <span ref={(el) => void (bars.current[i] = el)} />
                </span>
                <b>
                  <span className="mono">0{i + 1}</span> {st.title}
                </b>
                <span className="lp-steps__text">{st.text}</span>
              </li>
            ))}
          </ol>
        </div>
        <div ref={stage} className="lp-stage">
          <div ref={frame} className={cn("lp-studio", compact && "is-compact")} aria-hidden>
            <div className="lp-studio__top">
              <span className="lp-studio__logo" />
              <span className="lp-studio__name">Untitled design</span>
              <span className="lp-studio__seg">
                <span className={cn(!state.light && "is-on")}>
                  <Moon /> Dark
                </span>
                <span className={cn(state.light && "is-on")} data-demo="mode-light">
                  <Sun /> Light
                </span>
              </span>
              <span className={cn("lp-studio__save", state.saved && "is-done")} data-demo="save">
                {state.saved ? <Check /> : <UploadCloud />} {state.saved ? "Saved" : "Save to GitHub"}
              </span>
            </div>
            <div className="lp-studio__body">
              <div className="lp-studio__rail">
                <div className="lp-studio__label">Add widget</div>
                <div className="lp-studio__cards">
                  {LIBRARY.map((w, i) => (
                    <div
                      key={w.type}
                      className={cn("lp-card", state.dragging === i && "is-lifted", i < state.placed && "is-used")}
                      data-demo={`card-${i}`}
                    >
                      <div className="lp-card__thumb">{thumbs[i]?.[0] && <WidgetImage part={thumbs[i][0]} />}</div>
                      <span>{w.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={cn("lp-studio__canvas", state.light && "is-light")}>
                <div className="lp-studio__file">
                  <BookOpen /> octocat / README.md
                </div>
                <div ref={scrollBox} className="lp-studio__scroll">
                  <div ref={inner} className="lp-studio__readme">
                    {rows.slice(0, state.placed).map((parts, i) => (
                      <div key={i} className={cn("lp-studio__row", i === state.placed - 1 && "is-new")}>
                        {parts.map((p: RenderedPart) => (
                          <WidgetImage key={p.meta.name} part={p} style={p.meta.fixedHeight ? { height: 24, width: "auto" } : undefined} />
                        ))}
                      </div>
                    ))}
                    <div
                      className={cn("lp-drop", state.dragging >= 0 && "is-active", state.placed >= LIBRARY.length && "is-gone")}
                      data-demo="drop"
                    >
                      {state.dragging >= 0 ? `Drop ${LIBRARY[state.dragging].title}` : "Drag widgets here"}
                    </div>
                  </div>
                </div>
                <div className={cn("lp-toast", state.saved && "is-on")}>
                  <Check />
                  <span className="lp-toast__t">
                    Committed to <b>octocat/octocat</b>
                  </span>
                  <span>The workflow renders it tonight.</span>
                </div>
              </div>
              <div className="lp-studio__inspector">
                <div className="lp-studio__label">Palette</div>
                <div className="lp-studio__swatches">
                  {SWATCHES.map((id, i) => {
                    const pal = palettePresets.find((x) => x.id === id)!;
                    return (
                      <span
                        key={id}
                        className={cn("lp-swatch", i === state.palette && "is-on")}
                        data-demo={`swatch-${i}`}
                        style={{ background: `linear-gradient(135deg, ${pal.dark.card} 0 50%, ${pal.dark.accent} 50% 100%)` }}
                      >
                        <i>{pal.name}</i>
                      </span>
                    );
                  })}
                </div>
                <div className="lp-studio__label">Type</div>
                <div className="lp-studio__fake">JetBrains Mono</div>
                <div className="lp-studio__label">Motion</div>
                <div className="lp-studio__fake">Full</div>
              </div>
            </div>
            <div ref={ghost} className="lp-ghost">
              {dragged && <WidgetImage part={dragged} />}
            </div>
            <div ref={cursor} className="lp-cursor">
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path
                  d="M4 2.5 19.5 13l-7 1.2 4 7.3-2.9 1.5-4-7.3L4.5 21z"
                  fill="#fff"
                  stroke="#111"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
