import { palettePresets } from "@readme-studio/core";
import { BookOpen, Check, ChevronDown, GitCommitHorizontal, GitPullRequest, UploadCloud } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WidgetImage } from "../../components/WidgetImage";
import { cn } from "../../components/ui";
import type { RenderedPart } from "../../lib/render";
import { reducedMotion, useScrollProgress } from "./scroll";
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

/** What the window shows: where each chapter's animation starts, and where it ends. */
interface View {
  placed: number;
  palette: number;
  grotesk: boolean;
  dialog: boolean;
  saved: boolean;
  dragging: number;
}
const START: View[] = [
  { placed: 0, palette: 0, grotesk: false, dialog: false, saved: false, dragging: -1 },
  { placed: 3, palette: 0, grotesk: false, dialog: false, saved: false, dragging: -1 },
  { placed: 3, palette: 2, grotesk: true, dialog: false, saved: false, dragging: -1 },
];
const END: View[] = [
  { ...START[0], placed: 3 },
  { ...START[1], palette: 2, grotesk: true },
  { ...START[2], saved: true },
];

class Stopped extends Error {}

/**
 * How a README is made, told in three chapters. The text scrolls as usual; the studio window
 * beside it stays in view and, when a chapter reaches the middle of the screen, plays that
 * chapter on its own clock: a cursor drags widgets in, picks a palette and a typeface, and saves.
 * Each chapter loops while it is the one being read. The window keeps the site's colour scheme.
 */
export function Demo() {
  const still = reducedMotion();
  const [chapter, setChapter] = useState(0);
  const [view, setView] = useState<View>(still ? END[0] : START[0]);
  const [visible, setVisible] = useState(false);
  const mode = useSiteMode();
  const renders = useStillVariants(VARIANTS, BLOCKS, mode);
  const variant = view.grotesk ? "amber-grotesk" : (["crimson", "ocean", "amber"] as const)[view.palette];
  const rows = renders[variant] ?? renders.crimson ?? [];
  const thumbs = renders.crimson ?? [];
  const ready = !!renders.crimson;

  const section = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const texts = useRef<(HTMLElement | null)[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLDivElement>(null);
  const scrollBox = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  // the chapter whose text crosses the middle of the screen is the one being read
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setChapter(Number((e.target as HTMLElement).dataset.chapter));
      },
      // on narrow screens the window sits at the top, so the chapter being read is lower down
      { rootMargin: window.innerWidth <= 1000 ? "-62% 0px -30% 0px" : "-45% 0px -50% 0px" },
    );
    texts.current.forEach((t) => t && io.observe(t));
    const seen = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (section.current) seen.observe(section.current);
    return () => {
      io.disconnect();
      seen.disconnect();
    };
  }, []);
  // the rail beside the chapters fills as the section scrolls by
  useScrollProgress(section, (p) => rail.current?.style.setProperty("--p", p.toFixed(3)), "sticky");

  // the window is designed at a fixed size and scaled to the column it sits in
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => el.style.setProperty("--s", String(Math.min(1, el.clientWidth / 900)));
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, []);

  // the README grows past its canvas: keep the newest widget in view
  useLayoutEffect(() => {
    const v = scrollBox.current;
    const c = inner.current;
    if (v && c) c.style.transform = `translateY(${-Math.max(0, c.scrollHeight - v.clientHeight + 16)}px)`;
  }, [view.placed, rows]);

  // ---------------------------------------------------------------- playing a chapter

  useEffect(() => {
    if (still) {
      setView(END[chapter]);
      return;
    }
    if (!visible || !ready) return;
    const run = { live: true };
    const anims: Animation[] = [];
    // from wherever the cursor is now: a new chapter carries on from the last one, without a jump
    const now = cursor.current ? new DOMMatrixReadOnly(getComputedStyle(cursor.current).transform) : null;
    const at = { x: now?.m41 ?? 450, y: now?.m42 ?? 330 };
    const check = () => {
      if (!run.live) throw new Stopped();
    };
    const wait = async (ms: number) => {
      await new Promise((r) => setTimeout(r, ms));
      check();
    };
    /** The centre of an element of the window, in the window's own coordinates. */
    const point = (name: string) => {
      const f = frame.current!;
      const el = f.querySelector<HTMLElement>(`[data-demo="${name}"]`);
      if (!el) return { x: 450, y: 330 };
      let x = 0;
      let y = 0;
      for (let n: HTMLElement | null = el; n && n !== f; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      if (inner.current && scrollBox.current?.contains(el)) y += new DOMMatrixReadOnly(getComputedStyle(inner.current).transform).m42;
      return { x: x + el.offsetWidth / 2, y: y + Math.min(el.offsetHeight / 2, 46) };
    };
    /** Glides the cursor (and the widget it carries) along a gentle arc. */
    const move = async (name: string, ms: number) => {
      const to = point(name);
      const dx = to.x - at.x;
      const dy = to.y - at.y;
      const len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(70, len * 0.18);
      const mid = { x: (at.x + to.x) / 2 - (dy / len) * bend, y: (at.y + to.y) / 2 + (dx / len) * bend };
      const path = (o: number, r = 0) => [
        { transform: `translate(${at.x + o}px, ${at.y + o}px) rotate(${r}deg)`, easing: "cubic-bezier(.45,.05,.55,.95)" },
        {
          transform: `translate(${mid.x + o}px, ${mid.y + o}px) rotate(${r + Math.sign(dx) * 3}deg)`,
          offset: 0.5,
          easing: "cubic-bezier(.45,.05,.55,.95)",
        },
        { transform: `translate(${to.x + o}px, ${to.y + o}px) rotate(${r}deg)` },
      ];
      const opts: KeyframeAnimationOptions = { duration: ms, fill: "forwards" };
      const a = cursor.current!.animate(path(0), opts);
      anims.push(a);
      if (ghost.current?.classList.contains("is-on")) anims.push(ghost.current.animate(path(14, -2), opts));
      await a.finished.catch(() => undefined);
      check();
      at.x = to.x;
      at.y = to.y;
    };
    /** A click: the cursor presses, a ring spreads from it. */
    const press = async (down: boolean) => {
      cursor.current!.classList.toggle("is-down", down);
      if (down && ripple.current) {
        ripple.current.style.transform = `translate(${at.x}px, ${at.y}px)`;
        ripple.current.classList.remove("is-on");
        void ripple.current.offsetWidth;
        ripple.current.classList.add("is-on");
      }
      await wait(down ? 140 : 90);
    };
    const click = async (name: string, ms = 650) => {
      await move(name, ms);
      await press(true);
      await press(false);
    };
    const carry = (show: boolean) => {
      const g = ghost.current;
      if (!g) return;
      g.classList.toggle("is-on", show);
      g.style.transform = `translate(${at.x + 14}px, ${at.y + 14}px) rotate(-2deg)`;
    };

    const scripts: (() => Promise<void>)[] = [
      async () => {
        for (let i = 0; i < LIBRARY.length; i++) {
          await move(`card-${i}`, i ? 700 : 900);
          await press(true);
          setView((v) => ({ ...v, dragging: i }));
          carry(true);
          await wait(120);
          await move("drop", 850);
          await press(false);
          carry(false);
          setView((v) => ({ ...v, dragging: -1, placed: i + 1 }));
          await wait(380);
        }
      },
      async () => {
        await click("swatch-1", 900);
        setView((v) => ({ ...v, palette: 1 }));
        await wait(900);
        await click("swatch-2");
        setView((v) => ({ ...v, palette: 2 }));
        await wait(800);
        await click("font", 700);
        setView((v) => ({ ...v, grotesk: true }));
      },
      async () => {
        await click("save", 900);
        setView((v) => ({ ...v, dialog: true }));
        await wait(700);
        await click("commit", 650);
        setView((v) => ({ ...v, dialog: false, saved: true }));
        await wait(400);
        await move("rest", 900);
      },
    ];

    (async () => {
      try {
        // each chapter loops while it is being read, from its own starting point
        for (;;) {
          setView(START[chapter]);
          await wait(450);
          await scripts[chapter]();
          await wait(2600);
        }
      } catch (e) {
        if (!(e instanceof Stopped)) throw e;
      }
    })();
    return () => {
      run.live = false;
      for (const a of anims) a.cancel();
      // the cursor stays where it was rather than jumping back to its start
      if (cursor.current) cursor.current.style.transform = `translate(${at.x}px, ${at.y}px)`;
      ghost.current?.classList.remove("is-on");
    };
  }, [chapter, visible, ready, still]);

  const dragged = view.dragging >= 0 ? thumbs[view.dragging]?.[0] : undefined;
  return (
    <section ref={section} className={cn("lp-how", still && "is-still")} aria-label="How a README is made in the studio">
      <div className="wrap lp-how__grid">
        <div ref={rail} className="lp-how__chapters">
          <div className="lp-how__rail" aria-hidden />
          {CHAPTERS.map((c, i) => (
            <article
              key={c.title}
              ref={(el) => void (texts.current[i] = el)}
              data-chapter={i}
              className={cn("lp-how__chapter", i === chapter && "is-on")}
            >
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
            <div ref={frame} className={cn("lp-studio", `is-chapter-${chapter}`, view.saved && "is-saved")} aria-hidden>
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
                        <div
                          key={i}
                          className={cn("lp-studio__row", i === view.placed - 1 && view.placed > START[chapter].placed && "is-new")}
                        >
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
              <div ref={cursor} className="lp-cursor" style={{ transform: "translate(450px, 330px)" }}>
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
