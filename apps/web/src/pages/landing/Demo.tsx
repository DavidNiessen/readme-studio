import { palettePresets } from "@readme-studio/core";
import { BookOpen, Check, ChevronDown, UploadCloud } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WidgetImage } from "../../components/WidgetImage";
import { cn } from "../../components/ui";
import type { RenderedPart } from "../../lib/render";
import { clamp, ease, lerp, reducedMotion, useScrollProgress } from "./scroll";
import { useSiteMode, useStillVariants } from "./stills";

/** The widgets the cursor drags in, in order. */
const LIBRARY = [
  { type: "hero", title: "Hero banner" },
  { type: "socials", title: "Social pills" },
  { type: "stats", title: "Stats board" },
  { type: "contrib", title: "Contribution graph", options: { weekly: false } },
];
const BLOCKS = LIBRARY.map(({ type, options }) => ({ type, options }));
const SWATCHES = ["crimson", "ocean", "amber", "github", "nord", "sakura"];

/** Every look the demo passes through, rendered ahead while the page is idle, in the site's colour scheme. */
const VARIANTS = {
  crimson: { palette: "crimson" },
  ocean: { palette: "ocean" },
  amber: { palette: "amber" },
  "amber-grotesk": { palette: "amber", headingFont: "space-grotesk" },
};

const STEPS = [
  { title: "Drag widgets in", text: "Pick from 54 widgets and drop each one where it belongs." },
  { title: "Make it yours", text: "17 palettes and 12 typefaces, previewed live as you choose." },
  { title: "Save to GitHub", text: "One commit. Your repository's workflow does the rest, every night." },
];

// ---------------------------------------------------------------- the script

/** Where the cursor is at a moment of the scroll: aimed at a named element, the button up or down. */
interface Key {
  t: number;
  at: string;
  down?: boolean;
}

const DROP_START = 0.06;
const DROP_EACH = 0.125;
const KEYS: Key[] = (() => {
  const k: Key[] = [
    { t: 0, at: "rest" },
    { t: DROP_START - 0.01, at: "rest" },
  ];
  LIBRARY.forEach((_, i) => {
    const t0 = DROP_START + i * DROP_EACH;
    k.push(
      { t: t0 + 0.035, at: `card-${i}` },
      { t: t0 + 0.045, at: `card-${i}`, down: true },
      { t: t0 + 0.1, at: "drop", down: true },
      { t: t0 + 0.108, at: "drop" },
    );
  });
  const click = (t: number, at: string) => k.push({ t, at }, { t: t + 0.01, at, down: true }, { t: t + 0.022, at });
  click(0.61, "swatch-1");
  click(0.67, "swatch-2");
  click(0.73, "font");
  click(0.85, "save");
  k.push({ t: 1, at: "save" });
  return k;
})();

/** What the demo shows at a point of the scroll. */
function stateAt(p: number) {
  const placed = LIBRARY.filter((_, i) => p >= DROP_START + i * DROP_EACH + 0.1).length;
  const dragging = LIBRARY.findIndex((_, i) => {
    const t0 = DROP_START + i * DROP_EACH;
    return p >= t0 + 0.045 && p < t0 + 0.1;
  });
  const palette = p >= 0.68 ? 2 : p >= 0.62 ? 1 : 0;
  const grotesk = p >= 0.74;
  const saved = p >= 0.86;
  const step = p < 0.58 ? 0 : p < 0.81 ? 1 : 2;
  const stepProgress = step === 0 ? p / 0.58 : step === 1 ? (p - 0.58) / 0.23 : (p - 0.81) / 0.19;
  return { placed, dragging, palette, grotesk, saved, step, stepProgress: clamp(stepProgress) };
}

/** A smooth bump: 0 outside [a, b], 1 in the middle. */
const bump = (p: number, a: number, b: number) => (p <= a || p >= b ? 0 : Math.sin(((p - a) / (b - a)) * Math.PI));

/**
 * The camera: the window starts tilted back and settles, leans a little towards what the cursor
 * works on, turns towards the theme panel while it is used, swells on save and tilts away at the end.
 */
function cameraAt(p: number, cx: number, cy: number, w: number, h: number): string {
  const intro = ease(clamp(p / 0.06));
  const outro = ease(clamp((p - 0.93) / 0.07));
  const follow = clamp((p - 0.05) / 0.05) * (1 - outro);
  const rx = lerp(22, 0, intro) - outro * 8 + ((cy - h / 2) / h) * -3 * follow;
  const ry = ((cx - w / 2) / w) * 4 * follow - bump(p, 0.58, 0.8) * 4;
  const scale = lerp(0.82, 1, intro) - outro * 0.05 + bump(p, 0.85, 0.93) * 0.03;
  const ty = lerp(80, 0, intro) - outro * 24;
  return `perspective(2000px) translateY(${ty.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
}

// ---------------------------------------------------------------- the stage

/**
 * The studio, played by scrolling: a cursor drags four widgets from the library into a README,
 * tries two palettes and a heading typeface, and saves to GitHub. The scroll position is eased
 * each frame, so the cursor glides along curved paths even when the wheel jumps. The stage is a
 * fixed-size mock, scaled to fit, and the cursor aims at its elements by their layout positions,
 * so the same script plays on the wide layout and the compact one phones get. It keeps the site's
 * colour scheme throughout.
 */
export function Demo() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const scrollBox = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const [compact, setCompact] = useState(false);
  const still = reducedMotion();
  const [state, setState] = useState(() => stateAt(still ? 1 : 0));
  const mode = useSiteMode();
  const renders = useStillVariants(VARIANTS, BLOCKS, mode);
  const variant = state.grotesk ? "amber-grotesk" : (["crimson", "ocean", "amber"] as const)[state.palette];
  const rows = renders[variant] ?? renders.amber ?? renders.crimson ?? [];
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
      const room = window.innerHeight - 250;
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

  /** A point of the stage, in the frame's own coordinates (unaffected by scaling and the camera). */
  const point = (name: string): [number, number] => {
    const f = frame.current!;
    const el = f.querySelector<HTMLElement>(`[data-demo="${name}"]`);
    if (!el) return [f.offsetWidth * 0.55, f.offsetHeight * 0.45];
    let x = 0;
    let y = 0;
    for (let n: HTMLElement | null = el; n && n !== f; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    // the README scrolls inside its canvas
    if (inner.current && scrollBox.current?.contains(el)) y += new DOMMatrixReadOnly(getComputedStyle(inner.current).transform).m42;
    return [x + el.offsetWidth / 2, y + (name === "drop" ? Math.min(el.offsetHeight / 2, 40) : el.offsetHeight / 2)];
  };

  const wasDown = useRef(false);
  /** Puts the cursor, the widget it drags and the camera where the script says. */
  const place = (p: number, s: ReturnType<typeof stateAt>) => {
    const f = frame.current;
    const c = cursor.current;
    if (!f || !c) return;
    // the README grows past the canvas: keep its newest widget in view
    const v = scrollBox.current;
    const content = inner.current;
    if (v && content) content.style.transform = `translateY(${-Math.max(0, content.scrollHeight - v.clientHeight + 24)}px)`;
    let i = KEYS.findIndex((k) => k.t > p);
    if (i < 0) i = KEYS.length - 1;
    const a = KEYS[Math.max(0, i - 1)];
    const b = KEYS[i];
    const t = b.t === a.t ? 1 : ease(clamp((p - a.t) / (b.t - a.t)));
    const [ax, ay] = point(a.at);
    const [bx, by] = point(b.at);
    // a gentle arc rather than a straight line, like a hand moving a mouse
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(90, len * 0.22) * (i % 2 ? 1 : -1);
    const mx = (ax + bx) / 2 - (dy / len) * bend;
    const my = (ay + by) / 2 + (dx / len) * bend;
    const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx;
    const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by;
    const down = !!(t < 0.5 ? a.down : b.down);
    c.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    c.classList.toggle("is-down", down);
    const r = ripple.current;
    if (down && !wasDown.current && r) {
      // a ring where the button goes down
      r.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      r.classList.remove("is-on");
      void r.offsetWidth;
      r.classList.add("is-on");
    }
    wasDown.current = down;
    const g = ghost.current;
    if (g) {
      // the dragged widget trails the cursor, tilting with the direction it moves in
      const tilt = s.dragging >= 0 ? clamp(dx / 500, -1, 1) * 5 * Math.sin(t * Math.PI) : 0;
      g.style.transform = `translate(${(x + 16).toFixed(1)}px, ${(y + 14).toFixed(1)}px) rotate(${(tilt - 2).toFixed(2)}deg)`;
      g.style.opacity = s.dragging >= 0 ? "1" : "0";
    }
    if (cam.current && !still) cam.current.style.transform = cameraAt(p, x, y, f.offsetWidth, f.offsetHeight);
  };

  const last = useRef(state);
  const render = (p: number) => {
    const next = stateAt(p);
    const prev = last.current;
    if (
      next.placed !== prev.placed ||
      next.dragging !== prev.dragging ||
      next.palette !== prev.palette ||
      next.grotesk !== prev.grotesk ||
      next.saved !== prev.saved ||
      next.step !== prev.step
    ) {
      last.current = next;
      setState(next);
    }
    bars.current.forEach((b, i) => b?.style.setProperty("--fill", String(i < next.step ? 1 : i === next.step ? next.stepProgress : 0)));
    place(p, next);
  };

  // the scroll sets a target; each frame the shown progress eases towards it
  const target = useRef(still ? 1 : 0);
  const shown = useRef(still ? 1 : 0);
  const raf = useRef(0);
  const tick = () => {
    raf.current = 0;
    const gap = target.current - shown.current;
    // eased, and never faster than a watchable pace: a big jump of the scroll replays the steps
    // in between rather than skipping through them
    shown.current = Math.abs(gap) < 0.0003 ? target.current : shown.current + Math.sign(gap) * Math.min(Math.abs(gap) * 0.1, 0.006);
    render(shown.current);
    if (shown.current !== target.current) raf.current = requestAnimationFrame(tick);
  };
  useScrollProgress(
    section,
    (p) => {
      target.current = p;
      if (!raf.current) raf.current = requestAnimationFrame(tick);
    },
    "sticky",
  );
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // keep everything in place when the layout changes under it (a widget lands, the stage resizes)
  useEffect(() => {
    const id = requestAnimationFrame(() => render(shown.current));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, compact, rows]);

  const dragged = state.dragging >= 0 ? thumbs[state.dragging]?.[0] : undefined;
  return (
    <section ref={section} className={cn("lp-demo", still && "is-still")} aria-label="How a README is made in the studio">
      <div className="lp-demo__sticky">
        <div className="wrap lp-demo__head">
          <div className="lp-demo__caption" aria-live="polite">
            {STEPS.map((st, i) => (
              <div
                key={st.title}
                className={cn("lp-demo__say", i === state.step ? "is-on" : i < state.step ? "is-past" : "is-next")}
                aria-hidden={i !== state.step}
              >
                <span className="mono">0{i + 1} / 03</span>
                <h3 className="serif">{st.title}</h3>
                <p>{st.text}</p>
              </div>
            ))}
          </div>
          <ol className="lp-steps" aria-hidden>
            {STEPS.map((st, i) => (
              <li key={st.title} className={cn(i === state.step && "is-on", i < state.step && "is-done")}>
                <span className="lp-steps__bar">
                  <span ref={(el) => void (bars.current[i] = el)} />
                </span>
                <span className="lp-steps__name">{st.title}</span>
              </li>
            ))}
          </ol>
        </div>
        <div ref={stage} className="lp-stage">
          <div ref={cam} className="lp-cam">
            <div ref={frame} className={cn("lp-studio", compact && "is-compact", state.saved && "is-saved")} aria-hidden>
              <div className="lp-studio__top">
                <span className="lp-studio__logo" />
                <span className="lp-studio__name">Untitled design</span>
                <span className="lp-studio__tabs">
                  <span className="is-on">Layers · {state.placed}</span>
                  <span>Theme</span>
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
                        <span>
                          {w.title}
                          {i < state.placed && <Check />}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lp-studio__canvas">
                  <div className="lp-studio__file">
                    <BookOpen /> octocat / README.md
                  </div>
                  <div ref={scrollBox} className="lp-studio__scroll">
                    <div ref={inner} className="lp-studio__readme">
                      {rows.slice(0, state.placed).map((parts, i) => (
                        <div key={i} className={cn("lp-studio__row", i === state.placed - 1 && "is-new")}>
                          {parts.map((p: RenderedPart) => (
                            <WidgetImage
                              key={p.meta.name}
                              part={p}
                              style={p.meta.fixedHeight ? { height: 24, width: "auto" } : undefined}
                            />
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
                          style={{ background: `linear-gradient(135deg, ${pal[mode].card} 0 50%, ${pal[mode].accent} 50% 100%)` }}
                        >
                          <i>{pal.name}</i>
                        </span>
                      );
                    })}
                  </div>
                  <div className="lp-studio__label">Heading typeface</div>
                  <div className={cn("lp-studio__fake", state.grotesk && "is-changed")} data-demo="font">
                    <span style={{ fontFamily: state.grotesk ? "'Space Grotesk', var(--font-sans)" : "var(--font-mono)" }}>
                      {state.grotesk ? "Space Grotesk" : "JetBrains Mono"}
                    </span>
                    <ChevronDown />
                  </div>
                  <div className="lp-studio__label">Motion</div>
                  <div className="lp-studio__fake">
                    <span>Full</span>
                    <ChevronDown />
                  </div>
                </div>
              </div>
              <div ref={ghost} className="lp-ghost">
                {dragged && <WidgetImage part={dragged} />}
              </div>
              <div ref={ripple} className="lp-ripple" />
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
      </div>
    </section>
  );
}
