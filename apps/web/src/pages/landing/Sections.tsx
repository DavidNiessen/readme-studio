import { getWidget, widgetList } from "@readme-studio/core";
import { ArrowRight, BookOpen, Check, CircleDot, Code2, GitPullRequest, Pencil, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CHROME_STORE_URL, extensionStore } from "../../components/InstallExtension";
import { WidgetImage } from "../../components/WidgetImage";
import { cn } from "../../components/ui";
import { href } from "../../lib/router";
import { clamp, reducedMotion, span, useScrollProgress } from "./scroll";
import { useSiteMode, useStills } from "./stills";

// ---------------------------------------------------------------- it runs itself

const LOG: [string, string][] = [
  ["02:17", "schedule fired · .github/workflows/readme-studio.yml"],
  ["", "Render 15 blocks for @octocat"],
  ["", "data source: graphql · 53 weeks · 1 441 contributions"],
  ["", "hero-dark.svg                 68.4 KB    3 ms"],
  ["", "stats-dark.svg                22.1 KB    1 ms"],
  ["", "contrib-dark.svg              41.0 KB    2 ms"],
  ["", "skyline-dark.gif             812.6 KB  904 ms"],
  ["", "… 23 more, dark and light"],
  ["", "Publishing assets to octocat/octocat@readme-studio"],
  ["02:18", "README.md updated and pushed  ✓"],
];
const NODES = [
  { k: "02:17", t: "The schedule fires", d: "GitHub runs the workflow in your repository, every night or as often as you like." },
  { k: "Fetch", t: "Your numbers, fresh", d: "Streaks, stars, releases, contributors and CI status, straight from GitHub's API." },
  { k: "Render", t: "Every widget, both themes", d: "The same renderer as the studio draws each image twice: for dark and for light." },
  {
    k: "Publish",
    t: "Images on their own branch",
    d: "Force-pushed to an orphan branch, so your history stays clean. The README follows.",
  },
];

/** The nightly run, told as a timeline that fills as you scroll, with its log typing out beside it. */
export function RunsItself() {
  const ref = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState(reducedMotion() ? LOG.length : 0);
  const [replay, setReplay] = useState<number | null>(null);
  useScrollProgress(ref, (p) => {
    const t = span(p, 0.18, 0.62);
    ref.current?.style.setProperty("--p", t.toFixed(3));
    if (replay === null) setLines(Math.round(t * LOG.length));
  });
  // "Run it now" types the log again on a clock, whatever the scroll
  useEffect(() => {
    if (replay === null) return;
    setLines(0);
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setLines(n);
      if (n >= LOG.length) {
        window.clearInterval(id);
        window.setTimeout(() => setReplay(null), 400);
      }
    }, 260);
    return () => window.clearInterval(id);
  }, [replay]);
  const done = lines >= LOG.length;
  return (
    <div ref={ref} className="lp-runs">
      <ol className="lp-runs__line">
        {NODES.map((n, i) => (
          <li key={n.k} className={cn(lines >= ((i + 1) / NODES.length) * LOG.length - 1 && "is-on")}>
            <span className="lp-runs__k mono">{n.k}</span>
            <b>{n.t}</b>
            <p>{n.d}</p>
          </li>
        ))}
      </ol>
      <div className="lp-term">
        <div className="lp-term__bar">
          <span className="lp-win__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="mono">Readme Studio · Render the README</span>
          <button type="button" className="lp-term__run" onClick={() => setReplay(Date.now())} disabled={replay !== null}>
            <Play /> Run it now
          </button>
        </div>
        <pre className="lp-term__body mono">
          {LOG.slice(0, lines).map(([time, text], i) => (
            <div key={i} className={cn("lp-term__l", i === LOG.length - 1 && "is-ok")}>
              <span>{time}</span>
              {text}
            </div>
          ))}
          {!done && <span className="lp-term__caret" />}
        </pre>
        <div className={cn("lp-commit", done && "is-on")}>
          <span className="lp-commit__avatar" />
          <span>
            <b>github-actions</b> chore(readme-studio): update the README
          </span>
          <span className="mono lp-commit__sha">a1b2c3d</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- widget rows

const ROW_A = ["hero", "stats", "contrib", "pulse", "languages", "terminal", "trophies", "skyline"];
const ROW_B = ["project-hero", "repo-stats", "star-history", "contributors", "changelog", "install", "health", "board"];
const pick = (list: string[]) =>
  list.filter((t) => getWidget(t)).map((type) => ({ type, options: type === "contrib" ? { weekly: false } : undefined }));

function Strip({
  types,
  kind,
  palette,
  stripRef,
}: {
  types: string[];
  kind: "profile" | "project";
  palette: string;
  stripRef: React.RefObject<HTMLDivElement | null>;
}) {
  const mode = useSiteMode();
  const rows = useStills(pick(types), { kind, palette, mode });
  return (
    <div ref={stripRef} className="lp-strip">
      {rows.map((parts, i) => {
        const part = parts[0];
        if (!part) return null;
        const def = getWidget(part.meta.block.type);
        return (
          <a key={part.meta.name} className="lp-strip__item" href={href("/docs/widgets")} title={def?.description}>
            <span className="lp-strip__img">
              <WidgetImage part={part} />
            </span>
            <span className="lp-strip__meta">
              <b>{def?.title}</b>
              <span>{def?.category}</span>
            </span>
          </a>
        );
      })}
      {!rows.length && Array.from({ length: 4 }, (_, i) => <div key={i} className="lp-strip__item lp-skeleton" />)}
    </div>
  );
}

/** Two rows of widgets drifting past each other as the page scrolls. Hover one to look closer. */
export function WidgetRows() {
  const ref = useRef<HTMLDivElement>(null);
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);
  // the rows move with the scroll by their style alone: re-rendering them every frame would cost far more
  useScrollProgress(ref, (p) => {
    a.current?.style.setProperty("transform", `translate3d(${(-p * 28).toFixed(2)}%, 0, 0)`);
    b.current?.style.setProperty("transform", `translate3d(${(-(1 - p) * 28).toFixed(2)}%, 0, 0)`);
  });
  return (
    <div ref={ref} className="lp-strips">
      <Strip types={ROW_A} kind="profile" palette="crimson" stripRef={a} />
      <Strip types={ROW_B} kind="project" palette="ocean" stripRef={b} />
      <div className="center-link">
        <a href={href("/docs/widgets")}>
          See all {widgetList.length} widgets and their options <ArrowRight />
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the extension

/**
 * A repository page on GitHub with the extension's button. Scrolling (or clicking the button)
 * opens the studio over the page, as the extension does.
 */
export function ExtensionScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [manual, setManual] = useState<boolean | null>(null);
  const [auto, setAuto] = useState(reducedMotion());
  const mode = useSiteMode();
  const rows = useStills(pick(["project-hero", "shields", "repo-stats"]), { kind: "project", palette: "github", mode });
  useScrollProgress(ref, (p) => setAuto(p > 0.42));
  const open = manual ?? auto;
  const store = extensionStore();
  return (
    <div ref={ref} className="lp-ext">
      <div className="lp-ext__copy">
        <span className="eyebrow">Browser extension</span>
        <h2 className="serif">
          Edit it right <em>on GitHub.</em>
        </h2>
        <p>
          Every repository gets an <b>Edit README</b> button. It opens the studio over the page with the committed design, keeps a draft per
          repository, and saves back as a commit or a pull request.
        </p>
        <ul className="lp-ext__list">
          <li>
            <Check /> The same studio, not a copy
          </li>
          <li>
            <Check /> Sign in with GitHub, or use a token
          </li>
          <li>
            <Check /> Drafts survive closing the tab
          </li>
        </ul>
        <div className="hero__cta">
          <a className="btn btn--accent btn--lg" href={store?.url ?? CHROME_STORE_URL} target="_blank" rel="noopener">
            Add to {store?.browser ?? "Chrome"} <ArrowRight />
          </a>
          <a className="btn btn--lg" href={href("/docs/extension")}>
            How it works
          </a>
        </div>
        <p className="lp-ext__note">Firefox: in review at Firefox Add-ons.</p>
      </div>
      <div className={cn("lp-gh", open && "is-open")}>
        <div className="lp-gh__head">
          <span className="lp-gh__repo">
            <BookOpen /> octocat / <b>aurora</b>
          </span>
          <span className="lp-gh__tabs">
            <span className="is-on">
              <Code2 /> Code
            </span>
            <span>
              <CircleDot /> Issues
            </span>
            <span>
              <GitPullRequest /> Pull requests
            </span>
          </span>
        </div>
        <div className="lp-gh__files">
          {[".github/workflows", "src", "package.json", "readme.config.json", "README.md"].map((f) => (
            <div key={f} className="mono">
              {f}
            </div>
          ))}
        </div>
        <div className="lp-gh__readme">
          {rows.map((parts, i) => (
            <div key={i} className="lp-gh__row">
              {parts.map((p) => (
                <WidgetImage key={p.meta.name} part={p} style={p.meta.fixedHeight ? { height: 18, width: "auto" } : undefined} />
              ))}
            </div>
          ))}
        </div>
        <button type="button" className="lp-gh__btn" onClick={() => setManual(!open)} aria-expanded={open}>
          <Pencil /> Edit README
        </button>
        <div className="lp-gh__scrim" onClick={() => setManual(false)} />
        <div className="lp-gh__overlay" aria-hidden={!open}>
          <div className="lp-gh__overlay-top">
            <span className="lp-studio__logo" /> Readme Studio · octocat/aurora
            <button type="button" aria-label="Close" onClick={() => setManual(false)}>
              <X />
            </button>
          </div>
          <div className="lp-gh__overlay-body">
            <div className="lp-gh__mini-rail">
              {["Project hero", "Shields", "Repository stats", "Changelog"].map((t, i) => (
                <span key={t} className={cn(i === 1 && "is-on")}>
                  {t}
                </span>
              ))}
            </div>
            <div className="lp-gh__mini-canvas">
              {rows.map((parts, i) => (
                <div key={i} className={cn("lp-gh__row", i === 1 && "is-selected")}>
                  {parts.map((p) => (
                    <WidgetImage key={p.meta.name} part={p} style={p.meta.fixedHeight ? { height: 16, width: "auto" } : undefined} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="lp-gh__save">
            <span className="mono">Unsaved changes</span>
            <span className="btn btn--accent">Save to GitHub</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { clamp };
