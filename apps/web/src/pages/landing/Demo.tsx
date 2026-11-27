import { palettePresets } from "@readme-studio/core";
import { BookOpen, Check, ChevronDown, GitCommitHorizontal, GitPullRequest, UploadCloud } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WidgetImage } from "../../components/WidgetImage";
import { cn } from "../../components/ui";
import type { RenderedPart } from "../../lib/render";
import { clamp, ease, reducedMotion } from "./scroll";
import { useSiteMode, useStillVariants } from "./stills";

/** The widgets the cursor drags in, in order. */
const LIBRARY = [
  { type: "hero", title: "Hero banner" },
  { type: "stats", title: "Stats board" },
  { type: "contrib", title: "Contribution graph", options: { weekly: false } },
];
const BLOCKS = LIBRARY.map(({ type, options }) => ({ type, options }));
const SWATCHES = ["crimson", "ocean", "amber", "github", "nord", "sakura"];

/** Every look the demo shows, rendered ahead while the page is idle, in the site's colour scheme. */
const VARIANTS = {
  crimson: { palette: "crimson" },
  ocean: { palette: "ocean" },
  amber: { palette: "amber" },
  "amber-grotesk": { palette: "amber", headingFont: "space-grotesk" },
};

const CHAPTERS = [
  {
    title: "Drag widgets in",
    text: "Banners, stats, graphs, clocks and cards: 54 widgets, each fed by real GitHub data. Drop one between any two others, full width or side by side.",
    facts: ["54 widgets", "Profile and project READMEs"],
  },
  {
    title: "Make it yours",
    text: "Pick one of 17 palettes or generate one from a single colour, choose from 12 typefaces, and tune radius, texture and motion. Every change shows at once.",
    facts: ["17 palettes", "12 typefaces", "Dark and light"],
  },
  {
    title: "Save to GitHub",
    text: "Commit straight to your repository or open a pull request. The workflow renders every image there and keeps them current, every night.",
    facts: ["Commit or pull request", "Rebuilt nightly"],
  },
];

// ---------------------------------------------------------------- the script, in scroll time

/**
 * The story runs on one timeline, T from 0 to 3: chapter n is T from n to n + 1, and T advances
 * as that chapter's text scrolls past the reading line. Keys aim the cursor at named elements of
 * the window, with the button up or down.
 */
interface Key {
  t: number;
  at: string;
  down?: boolean;
}
const DROPS = LIBRARY.map((_, i) => 0.06 + i * 0.3);
const KEYS: Key[] = (() => {
  const k: Key[] = [{ t: 0, at: "rest" }];
  DROPS.forEach((t0, i) =>
    k.push(
      { t: t0 + 0.08, at: `card-${i}` },
      { t: t0 + 0.1, at: `card-${i}`, down: true },
      { t: t0 + 0.24, at: "drop", down: true },
      { t: t0 + 0.26, at: "drop" },
    ),
  );
  const click = (t: number, at: string) => k.push({ t: t - 0.05, at }, { t, at, down: true }, { t: t + 0.03, at });
  click(1.25, "swatch-1");
  click(1.5, "swatch-2");
  click(1.78, "font");
  click(2.28, "save");
  click(2.58, "commit");
  k.push({ t: 2.85, at: "rest" }, { t: 3, at: "rest" });
  return k;
})();

/** What the window shows at a point of the timeline. */
function viewAt(T: number) {
  const placed = DROPS.filter((t0) => T >= t0 + 0.24).length;
  const dragging = DROPS.findIndex((t0) => T >= t0 + 0.1 && T < t0 + 0.24);
  return {
    placed,
    dragging,
    palette: T >= 1.5 ? 2 : T >= 1.25 ? 1 : 0,
    grotesk: T >= 1.78,
    dialog: T >= 2.28 && T < 2.58,
    saved: T >= 2.58,
  };
}
type View = ReturnType<typeof viewAt>;
const sameView = (a: View, b: View) =>
  a.placed === b.placed &&
  a.dragging === b.dragging &&
  a.palette === b.palette &&
  a.grotesk === b.grotesk &&
  a.dialog === b.dialog &&
  a.saved === b.saved;

/**
 * How a README is made, in three chapters. The text scrolls as usual; the studio window beside it
 * (above it on phones) stays in view and plays the chapter being read in step with the scroll: a
 * cursor drags widgets in, picks a palette and a typeface, and saves. The scroll position is eased
 * each frame, so the cursor glides even when the wheel jumps, and scrolling back rewinds. The
 * window keeps the site's colour scheme; on narrow screens it takes a compact layout.
 */
export function Demo() {
  const still = reducedMotion();
  const [chapter, setChapter] = useState(0);
  const [view, setView] = useState<View>(() => viewAt(still ? 3 : 0));
  const [compact, setCompact] = useState(false);
  const mode = useSiteMode();
  const renders = useStillVariants(VARIANTS, BLOCKS, mode);
  const variant = view.grotesk ? "amber-grotesk" : (["crimson", "ocean", "amber"] as const)[view.palette];
  const rows = renders[variant] ?? renders.crimson ?? [];
  const thumbs = renders.crimson ?? [];

  const rail = useRef<HTMLDivElement>(null);
  const texts = useRef<(HTMLElement | null)[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLDivElement>(null);
  const scrollBox = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  // how far the README is scrolled up to show its newest widget
  const shift = useRef(0);

  // the window is designed at a fixed size, compact on narrow screens, and scaled to its column
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      const narrow = el.clientWidth < 640;
      setCompact(narrow);
      const w = narrow ? 540 : 900;
      const h = narrow ? 640 : 620;
      // on phones the window shares the screen with the text below it
      const room = narrow ? window.innerHeight * 0.5 : Infinity;
      el.style.setProperty("--s", String(Math.min(1, el.clientWidth / w, room / h)));
      el.style.setProperty("--fw", `${w}px`);
      el.style.setProperty("--fh", `${h}px`);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    fit();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  // ---------------------------------------------------------------- following the scroll

  /** A point of the window, in the window's own coordinates (unaffected by scaling and tilt). */
  const point = (name: string): [number, number] => {
    const f = frame.current!;
    const el = f.querySelector<HTMLElement>(`[data-demo="${name}"]`);
    if (!el) return [f.offsetWidth / 2, f.offsetHeight / 2];
    let x = 0;
    let y = 0;
    for (let n: HTMLElement | null = el; n && n !== f; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    // where the README is scrolling to, not where its transition has got to
    if (scrollBox.current?.contains(el)) y -= shift.current;
    return [x + el.offsetWidth / 2, y + Math.min(el.offsetHeight / 2, 44)];
  };

  const last = useRef(view);
  const lastChapter = useRef(0);
  const wasDown = useRef(false);
  // only a widget that has just landed plays its entrance, not one uncovered by scrolling back
  const grew = useRef(false);
  /** Draws the timeline at T: the window's state, the cursor, the widget it carries. */
  const draw = (T: number) => {
    const f = frame.current;
    const c = cursor.current;
    if (!f || !c) return;
    const ch = Math.min(2, Math.floor(T));
    if (ch !== lastChapter.current) {
      lastChapter.current = ch;
      setChapter(ch);
    }
    const v = viewAt(T);
    if (!sameView(v, last.current)) {
      grew.current = v.placed > last.current.placed || (grew.current && v.placed === last.current.placed);
      last.current = v;
      setView(v);
    }
    // the README grows past its canvas: keep the newest widget in view
    const box = scrollBox.current;
    const content = inner.current;
    if (box && content) {
      shift.current = Math.max(0, content.scrollHeight - box.clientHeight + 16);
      content.style.transform = `translateY(${-shift.current}px)`;
    }
    let i = KEYS.findIndex((k) => k.t > T);
    if (i < 0) i = KEYS.length - 1;
    const a = KEYS[Math.max(0, i - 1)];
    const b = KEYS[i];
    const t = b.t === a.t ? 1 : ease(clamp((T - a.t) / (b.t - a.t)));
    const [ax, ay] = point(a.at);
    const [bx, by] = point(b.at);
    // a gentle arc rather than a straight line, like a hand moving a mouse
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(70, len * 0.18);
    const mx = (ax + bx) / 2 - (dy / len) * bend;
    const my = (ay + by) / 2 + (dx / len) * bend;
    const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx;
    const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by;
    const down = !!(t < 0.5 ? a.down : b.down);
    c.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    c.classList.toggle("is-down", down);
    const r = ripple.current;
    if (down && !wasDown.current && r) {
      r.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      r.classList.remove("is-on");
      void r.offsetWidth;
      r.classList.add("is-on");
    }
    wasDown.current = down;
    const g = ghost.current;
    if (g) {
      // the dragged widget trails the cursor, leaning the way it moves
      const lean = v.dragging >= 0 ? clamp(dx / 400, -1, 1) * 4 * Math.sin(t * Math.PI) : 0;
      g.style.transform = `translate(${(x + 14).toFixed(1)}px, ${(y + 14).toFixed(1)}px) rotate(${(lean - 2).toFixed(2)}deg)`;
      g.classList.toggle("is-on", v.dragging >= 0);
    }
  };

  /** Where the scroll is in the story: each chapter's text, passing the reading line, is one unit of T. */
  const measure = () => {
    // on phones the window covers the top half, so the text is read lower down
    const line = window.innerHeight * (compact ? 0.78 : 0.62);
    let T = 0;
    texts.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      // a chapter starts as its top reaches the reading line and ends as its bottom passes it
      const p = clamp((line - r.top) / Math.max(1, r.height));
      if (p > 0) T = i + p;
    });
    rail.current?.style.setProperty("--p", clamp(T / 3).toFixed(3));
    return Math.min(3, T);
  };

  useEffect(() => {
    if (still) {
      draw(3);
      return;
    }
    let frameId = 0;
    let shown = measure();
    let target = shown;
    // eased towards the scroll, and never faster than a watchable pace: a jump replays what it skipped
    const tick = () => {
      frameId = 0;
      const gap = target - shown;
      shown = Math.abs(gap) < 0.0015 ? target : shown + Math.sign(gap) * Math.min(Math.abs(gap) * 0.12, 0.03);
      draw(shown);
      if (shown !== target) frameId = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      target = measure();
      if (!frameId) frameId = requestAnimationFrame(tick);
    };
    draw(shown);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, compact]);

  // keep the cursor on its target when the layout changes under it (a widget lands, the size changes)
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("scroll")));
    return () => cancelAnimationFrame(id);
  }, [view, rows, compact]);

  const dragged = view.dragging >= 0 ? thumbs[view.dragging]?.[0] : undefined;
  return (
    <section className={cn("lp-how", still && "is-still")} aria-label="How a README is made in the studio">
      <div className="wrap lp-how__grid">
        <div ref={rail} className="lp-how__chapters">
          <div className="lp-how__rail" aria-hidden />
          {CHAPTERS.map((c, i) => (
            <article key={c.title} ref={(el) => void (texts.current[i] = el)} className={cn("lp-how__chapter", i === chapter && "is-on")}>
              <span className="lp-how__n mono">0{i + 1}</span>
              <h3 className="serif">{c.title}</h3>
              <p>{c.text}</p>
              <ul>
                {c.facts.map((f) => (
                  <li key={f}>
                    <Check /> {f}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="lp-how__visual">
          <div ref={stage} className="lp-how__stage">
            <div
              ref={frame}
              className={cn("lp-studio", `is-chapter-${chapter}`, compact && "is-compact", view.saved && "is-saved")}
              aria-hidden
            >
              <div className="lp-studio__top" data-part="top">
                <span className="lp-studio__logo" />
                <span className="lp-studio__name">Untitled design</span>
                <span className="lp-studio__tabs">
                  <span className="is-on">Layers · {view.placed}</span>
                  <span>Theme</span>
                </span>
                <span className={cn("lp-studio__save", view.saved && "is-done")} data-demo="save">
                  {view.saved ? <Check /> : <UploadCloud />} {view.saved ? "Saved" : "Save to GitHub"}
                </span>
              </div>
              <div className="lp-studio__body">
                <div className="lp-studio__rail" data-part="rail">
                  <div className="lp-studio__label">Add widget</div>
                  <div className="lp-studio__cards">
                    {LIBRARY.map((w, i) => (
                      <div
                        key={w.type}
                        className={cn("lp-card", view.dragging === i && "is-lifted", i < view.placed && "is-used")}
                        data-demo={`card-${i}`}
                      >
                        <div className="lp-card__thumb">{thumbs[i]?.[0] && <WidgetImage part={thumbs[i][0]} />}</div>
                        <span>
                          {w.title}
                          {i < view.placed && <Check />}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lp-studio__canvas" data-part="canvas" data-demo="rest">
                  <div className="lp-studio__file">
                    <BookOpen /> octocat / README.md
                  </div>
                  <div ref={scrollBox} className="lp-studio__scroll">
                    <div ref={inner} className="lp-studio__readme">
                      {rows.slice(0, view.placed).map((parts, i) => (
                        <div key={i} className={cn("lp-studio__row", grew.current && i === view.placed - 1 && "is-new")}>
                          {parts.map((p: RenderedPart) => (
                            <WidgetImage key={p.meta.name} part={p} />
                          ))}
                        </div>
                      ))}
                      <div
                        className={cn("lp-drop", view.dragging >= 0 && "is-active", view.placed >= LIBRARY.length && "is-gone")}
                        data-demo="drop"
                      >
                        {view.dragging >= 0 ? `Drop ${LIBRARY[view.dragging].title}` : "Drag widgets here"}
                      </div>
                    </div>
                  </div>
                  <div className={cn("lp-dialog", view.dialog && "is-on")}>
                    <b>Save to GitHub</b>
                    <span className="lp-dialog__opt is-on">
                      <GitCommitHorizontal /> Commit to <code>main</code>
                    </span>
                    <span className="lp-dialog__opt">
                      <GitPullRequest /> Open a pull request
                    </span>
                    <span className="lp-dialog__go" data-demo="commit">
                      Commit
                    </span>
                  </div>
                  <div className={cn("lp-toast", view.saved && "is-on")}>
                    <Check />
                    <span className="lp-toast__t">
                      Committed to <b>octocat/octocat</b>
                    </span>
                    <span>The workflow renders it tonight.</span>
                  </div>
                </div>
                <div className="lp-studio__inspector" data-part="inspector">
                  <div className="lp-studio__label">Palette</div>
                  <div className="lp-studio__swatches">
                    {SWATCHES.map((id, i) => {
                      const pal = palettePresets.find((x) => x.id === id)!;
                      return (
                        <span
                          key={id}
                          className={cn("lp-swatch", i === view.palette && "is-on")}
                          data-demo={`swatch-${i}`}
                          style={{ background: `linear-gradient(135deg, ${pal[mode].card} 0 50%, ${pal[mode].accent} 50% 100%)` }}
                        >
                          <i>{pal.name}</i>
                        </span>
                      );
                    })}
                  </div>
                  <div className="lp-studio__label">Heading typeface</div>
                  <div className={cn("lp-studio__fake", view.grotesk && "is-changed")} data-demo="font">
                    <span style={{ fontFamily: view.grotesk ? "'Space Grotesk', var(--font-sans)" : "var(--font-mono)" }}>
                      {view.grotesk ? "Space Grotesk" : "JetBrains Mono"}
                    </span>
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
