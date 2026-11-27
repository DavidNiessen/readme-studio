import { getWidget, palettePresets } from "@readme-studio/core";
import {
  BookOpen,
  Check,
  ChevronDown,
  Database,
  GitCommitHorizontal,
  GitPullRequest,
  Layers,
  LayoutTemplate,
  Moon,
  Palette,
  Plus,
  Redo2,
  Search,
  Sun,
  Undo2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { LogoMark } from "../../components/Logo";
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

/** One text per chapter, lit word by word as the page scrolls. The first sentence is its title. */
const CHAPTERS = [
  {
    title: "Drag widgets in.",
    text: "Banners, stats, graphs and clocks: 54 widgets fed by real GitHub data, dropped exactly where you want them.",
    facts: ["54 widgets", "Profile and project READMEs"],
  },
  {
    title: "Make it yours.",
    text: "Pick one of 17 palettes or make your own, choose from 12 typefaces, and see every change the moment you make it.",
    facts: ["17 palettes", "12 typefaces", "Dark and light"],
  },
  {
    title: "Save to GitHub.",
    text: "Commit or open a pull request. The workflow in your repository renders every image and keeps it current, every night.",
    facts: ["Commit or pull request", "Rebuilt nightly"],
  },
].map((c) => ({
  ...c,
  words: [...c.title.split(" ").map((w) => ({ w, title: true })), ...c.text.split(" ").map((w) => ({ w, title: false }))],
}));

/** How much of a chapter's scroll lights its text; the rest holds it full before the next one. */
const FILL = 0.72;

// ---------------------------------------------------------------- the script, in scroll time

/**
 * The story runs on one timeline, T from 0 to 3: chapter n is T from n to n + 1, and T follows
 * the scroll through the pinned section. Keys aim the cursor at named elements of the window,
 * with the button up or down.
 */
interface Key {
  t: number;
  at: string;
  down?: boolean;
}
const DROPS = LIBRARY.map((_, i) => 0.06 + i * 0.27);
const KEYS: Key[] = (() => {
  const k: Key[] = [{ t: 0, at: "rest" }];
  DROPS.forEach((t0, i) =>
    k.push(
      { t: t0 + 0.07, at: `card-${i}` },
      { t: t0 + 0.09, at: `card-${i}`, down: true },
      { t: t0 + 0.22, at: "drop", down: true },
      { t: t0 + 0.24, at: "drop" },
    ),
  );
  const click = (t: number, at: string) => k.push({ t: t - 0.05, at }, { t, at, down: true }, { t: t + 0.03, at });
  click(1.22, "swatch-1");
  click(1.42, "swatch-2");
  click(1.66, "font");
  click(2.24, "save");
  click(2.5, "commit");
  k.push({ t: 2.75, at: "rest" }, { t: 3, at: "rest" });
  return k;
})();

/** What the window shows at a point of the timeline. */
function viewAt(T: number) {
  const placed = DROPS.filter((t0) => T >= t0 + 0.22).length;
  const dragging = DROPS.findIndex((t0) => T >= t0 + 0.09 && T < t0 + 0.22);
  return {
    placed,
    dragging,
    palette: T >= 1.42 ? 2 : T >= 1.22 ? 1 : 0,
    grotesk: T >= 1.66,
    dialog: T >= 2.24 && T < 2.5,
    saved: T >= 2.5,
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
 * How a README is made, in three chapters. The section pins to the screen while it scrolls: one
 * text at a time lights up word by word, like lyrics following a song, and once it is full the
 * next one takes its place. Beside it (below it on phones) a studio window, drawn after the real
 * one, plays the same chapter in step: a cursor drags widgets in, picks a palette and a typeface,
 * and saves. The scroll position is eased each frame, so the cursor glides even when the wheel
 * jumps, and scrolling back rewinds.
 */
export function Demo() {
  const still = reducedMotion();
  const [chapter, setChapter] = useState(still ? 2 : 0);
  const [view, setView] = useState<View>(() => viewAt(still ? 3 : 0));
  const [compact, setCompact] = useState(false);
  const mode = useSiteMode();
  const renders = useStillVariants(VARIANTS, BLOCKS, mode);
  const variant = view.grotesk ? "amber-grotesk" : (["crimson", "ocean", "amber"] as const)[view.palette];
  const rows = renders[variant] ?? renders.crimson ?? [];
  const thumbs = renders.crimson ?? [];

  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const words = useRef<(HTMLSpanElement | null)[][]>(CHAPTERS.map(() => []));
  const steps = useRef<(HTMLElement | null)[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLDivElement>(null);
  const scrollBox = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  // how far the README is scrolled up to show its newest widget
  const shift = useRef(0);

  // the window is designed at a fixed size, compact on narrow screens, and scaled into its box
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      const narrow = el.clientWidth < 640;
      setCompact(narrow);
      const w = narrow ? 460 : 940;
      const h = narrow ? 620 : 640;
      const s = Math.min(1, el.clientWidth / w, el.clientHeight / h);
      el.style.setProperty("--s", String(s));
      el.style.setProperty("--fw", `${w}px`);
      el.style.setProperty("--fh", `${h}px`);
      el.style.setProperty("--ox", `${Math.max(0, (el.clientWidth - w * s) / 2)}px`);
      el.style.setProperty("--oy", `${Math.max(0, (el.clientHeight - h * s) / 2)}px`);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, []);

  // ---------------------------------------------------------------- following the scroll

  /** A point of the window, in the window's own coordinates (unaffected by scaling and tilt). */
  const point = (name: string): [number, number] => {
    const f = frame.current!;
    const el = f.querySelector<HTMLElement>(`[data-demo="${name}"]`);
    if (!el || !el.offsetParent) return [f.offsetWidth / 2, f.offsetHeight / 2];
    let x = 0;
    let y = 0;
    for (let n: HTMLElement | null = el; n && n !== f; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    // where the README is scrolling to, not where its transition has got to
    if (scrollBox.current?.contains(el)) y -= shift.current;
    return [x + el.offsetWidth / 2, y + Math.min(el.offsetHeight / 2, 40)];
  };

  const last = useRef(view);
  const lastChapter = useRef(chapter);
  const wasDown = useRef(false);
  // only a widget that has just landed plays its entrance, not one uncovered by scrolling back
  const grew = useRef(false);

  /** Draws the timeline at T: the text, the window's state, the cursor, the widget it carries. */
  const draw = (T: number) => {
    const ch = Math.min(2, Math.floor(T));
    if (ch !== lastChapter.current) {
      lastChapter.current = ch;
      setChapter(ch);
    }
    // the text lights word by word, a soft edge running through it
    CHAPTERS.forEach((c, i) => {
      const lit = clamp((T - i) / FILL) * c.words.length;
      words.current[i].forEach((el, j) => el?.style.setProperty("--lit", clamp(lit - j).toFixed(3)));
      steps.current[i]?.style.setProperty("--p", clamp(T - i).toFixed(3));
    });
    const f = frame.current;
    const c = cursor.current;
    if (!f || !c) return;
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

  /** Where the scroll is in the story: how far the section has moved under its pinned screen, as T from 0 to 3. */
  const measure = () => {
    const s = section.current;
    const p = pin.current;
    if (!s || !p) return 0;
    const top = parseFloat(getComputedStyle(p).top) || 0;
    const run = Math.max(1, s.offsetHeight - p.offsetHeight);
    return clamp((top - s.getBoundingClientRect().top) / run) * 3;
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
    <section ref={section} className={cn("lp-how", still && "is-still")} aria-label="How a README is made in the studio">
      <div ref={pin} className="lp-how__pin">
        <div className="wrap lp-how__grid">
          <div className="lp-how__copy">
            <div className="lp-how__steps" aria-hidden>
              {CHAPTERS.map((c, i) => (
                <span key={c.title} ref={(el) => void (steps.current[i] = el)} className={cn(i === chapter && "is-on")}>
                  <b className="mono">0{i + 1}</b>
                  <i />
                </span>
              ))}
            </div>
            <div className="lp-how__lyrics">
              {CHAPTERS.map((c, i) => (
                <article
                  key={c.title}
                  className={cn("lp-lyric", i === chapter ? "is-on" : i < chapter ? "is-past" : "is-next")}
                  aria-hidden={i !== chapter}
                >
                  <p className="lp-lyric__text">
                    {c.words.map(({ w, title }, j) => (
                      <span key={j} ref={(el) => void (words.current[i][j] = el)} className={cn(title && "is-title")}>
                        {w}{" "}
                      </span>
                    ))}
                  </p>
                  <ul className="lp-lyric__facts">
                    {c.facts.map((f) => (
                      <li key={f}>
                        <Check /> {f}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
          <div ref={stage} className="lp-how__stage">
            <StudioWindow
              frameRef={frame}
              scrollRef={scrollBox}
              innerRef={inner}
              chapter={chapter}
              compact={compact}
              view={view}
              mode={mode}
              rows={rows}
              thumbs={thumbs}
              fresh={grew.current}
            >
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
            </StudioWindow>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The studio as it looks, cut down to what the story uses. */
function StudioWindow({
  frameRef,
  scrollRef,
  innerRef,
  chapter,
  compact,
  view,
  mode,
  rows,
  thumbs,
  fresh,
  children,
}: {
  frameRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  innerRef: RefObject<HTMLDivElement | null>;
  chapter: number;
  compact: boolean;
  view: View;
  mode: "dark" | "light";
  rows: RenderedPart[][];
  thumbs: RenderedPart[][];
  fresh: boolean;
  children: ReactNode;
}) {
  return (
    <div ref={frameRef} className={cn("lp-studio", `is-chapter-${chapter}`, compact && "is-compact", view.saved && "is-saved")} aria-hidden>
      <div className="lp-studio__top" data-part="top">
        <span className="lp-studio__brand">
          <LogoMark size={22} />
          <ChevronDown />
          <Plus />
        </span>
        <span className="lp-studio__name">My profile</span>
        <span className="lp-studio__tools">
          <Undo2 className={cn(!view.placed && "is-dim")} />
          <Redo2 className="is-dim" />
          <span className="lp-studio__seg">
            <span className={cn(mode === "dark" && "is-on")}>
              <Moon /> Dark
            </span>
            <span className={cn(mode === "light" && "is-on")}>
              <Sun /> Light
            </span>
          </span>
        </span>
        <span className="lp-studio__ghost">
          <LayoutTemplate /> Presets
        </span>
        <span className={cn("lp-studio__save", view.saved && "is-done")} data-demo="save">
          {view.saved ? <Check /> : <UploadCloud />} {view.saved ? "Saved" : "Save to GitHub"}
        </span>
      </div>
      <div className="lp-studio__body">
        <div className="lp-studio__rail" data-part="rail">
          <div className="lp-studio__tabs">
            <span>
              <Layers /> Layers · {view.placed}
            </span>
            <span className="is-on">
              <Plus /> Add widget
            </span>
          </div>
          <div className="lp-studio__search">
            <Search /> Search 41 profile widgets
          </div>
          <div className="lp-studio__group">
            <b>Popular</b>
            <span>Where most READMEs start</span>
          </div>
          <div className="lp-studio__cards">
            {LIBRARY.map((w, i) => (
              <div
                key={w.type}
                className={cn("lp-card", view.dragging === i && "is-lifted", i < view.placed && "is-used")}
                data-demo={`card-${i}`}
              >
                <div className="lp-card__thumb">{thumbs[i]?.[0] && <WidgetImage part={thumbs[i][0]} />}</div>
                <b>
                  {w.title}
                  {i < view.placed && <Check />}
                </b>
                <small>{getWidget(w.type)?.description}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="lp-studio__canvas" data-part="canvas" data-demo="rest">
          <div className="lp-studio__meta mono">
            <span>octocat/octocat · README.md</span>
            <span>
              {view.placed} image{view.placed === 1 ? "" : "s"}
            </span>
          </div>
          <div className="lp-studio__doc">
            <div className="lp-studio__file">
              <BookOpen /> <b>README</b> <span>· octocat</span>
            </div>
            <div ref={scrollRef} className="lp-studio__scroll">
              <div ref={innerRef} className="lp-studio__readme">
                {rows.slice(0, view.placed).map((parts, i) => (
                  <div key={i} className={cn("lp-studio__row", fresh && i === view.placed - 1 && "is-new")}>
                    {parts.map((p) => (
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
          <div className="lp-studio__tabs">
            <span className="is-on">
              <Palette /> Theme
            </span>
            <span>
              <Database /> Data
            </span>
          </div>
          <div className="lp-studio__label">Palette</div>
          <div className="lp-studio__palettes">
            {SWATCHES.map((id, i) => {
              const pal = palettePresets.find((x) => x.id === id)!;
              return (
                <span key={id} className={cn("lp-pal", i === view.palette && "is-on")} data-demo={`swatch-${i}`}>
                  <span className="lp-pal__swatch">
                    {(["dark", "light"] as const).map((m) => (
                      <span key={m} style={{ background: pal[m].card }}>
                        <i style={{ height: "50%", background: pal[m].accent }} />
                        <i style={{ height: "32%", background: pal[m].text }} />
                        <i style={{ height: "21%", background: pal[m].muted }} />
                        <i style={{ height: "40%", background: pal[m].heat[3] }} />
                      </span>
                    ))}
                  </span>
                  <span className="lp-pal__name">{pal.name}</span>
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
      {children}
    </div>
  );
}
