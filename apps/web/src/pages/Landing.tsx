import {
  CATEGORIES,
  FONTS,
  layoutPresets,
  mockData,
  normalizeConfig,
  palettePresets,
  widgetList,
  workflowYaml,
  presetConfig,
  type DesignKind,
  type Mode,
  type WidgetCategory,
} from "@readme-studio/core";
import { ArrowRight, BookOpen, Check, FolderGit2, Moon, Sun, User } from "lucide-react";
import { useMemo, useState } from "react";
import { PresetThumb } from "../components/PresetThumb";
import { REPO_URL, SitePage } from "../components/Site";
import { WidgetImage } from "../components/WidgetImage";
import { cn } from "../components/ui";
import { renderLayout, useFontsReady } from "../lib/render";
import { href } from "../lib/router";

const DATE = new Date();

/** A faux GitHub profile README rendering a few widgets live with the chosen palette. */
const PROFILE_ROWS = [{ blocks: [{ type: "hero" }] }, { blocks: [{ type: "socials" }] }, { blocks: [{ type: "stats" }] }, { blocks: [{ type: "contrib", options: { weekly: false } }] }];
const PROJECT_ROWS = [{ blocks: [{ type: "project-hero" }] }, { blocks: [{ type: "shields" }] }, { blocks: [{ type: "repo-stats" }] }, { blocks: [{ type: "star-history" }] }];

function HeroPreview() {
  const [palette, setPalette] = useState("crimson");
  const [mode, setMode] = useState<Mode>("dark");
  const [kind, setKind] = useState<DesignKind>("profile");
  const config = useMemo(
    () =>
      normalizeConfig({
        kind,
        profile: { ...presetConfig("command-center").profile, name: "Mona Octocat", login: "octocat" },
        project: { repo: "octocat/aurora", tagline: "A tiny, fast design-token compiler for multi-brand UI kits.", packages: { npm: "aurora" } },
        theme: { preset: palette, font: "jetbrains-mono", headingFont: kind === "project" ? "space-grotesk" : "jetbrains-mono" },
        layout: kind === "project" ? PROJECT_ROWS : PROFILE_ROWS,
      }).config,
    [palette, kind],
  );
  const data = useMemo(() => mockData(DATE, "octocat", "Mona Octocat", config.profile.location.timezone, "octocat/aurora"), [config.profile.location.timezone]);
  const ready = useFontsReady([config.theme.font, config.theme.headingFont]);
  const rows = useMemo(() => (ready ? renderLayout(config, data, mode, DATE) : []), [ready, config, data, mode]);
  const shown = ["crimson", "github", "ocean", "amber", "nord", "sakura", "mono"];
  return (
    <div className="hero-preview">
      <div className={cn("hp-window", mode === "light" && "hp-window--light")}>
        <div className="hp-bar">
          <span className="hp-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="hp-url mono">{kind === "project" ? "github.com/octocat/aurora" : "github.com/octocat"}</span>
        </div>
        <div className="hp-body">
          <div className="hp-file">
            <BookOpen /> {kind === "project" ? "aurora / README.md" : "octocat / README.md"}
          </div>
          <div className="hp-content">
            {rows.map((r) => (
              <div key={r.rowId} className="hp-row">
                {r.parts.map((p) => (
                  <WidgetImage key={p.meta.name} part={p} style={p.meta.fixedHeight ? { height: 30, width: "auto", display: "inline-block", margin: "0 3px" } : undefined} />
                ))}
              </div>
            ))}
            {!rows.length && <div className="hp-skeleton" />}
          </div>
        </div>
      </div>
      <div className="hp-controls">
        <div className="hp-mode hp-kind" role="group" aria-label="README type">
          <button type="button" aria-pressed={kind === "profile"} onClick={() => setKind("profile")}>
            Profile
          </button>
          <button type="button" aria-pressed={kind === "project"} onClick={() => setKind("project")}>
            Project
          </button>
        </div>
        <div className="hp-swatches" role="group" aria-label="Try a palette">
          {shown.map((id) => {
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
        <div className="hp-mode" role="group" aria-label="Colour scheme">
          <button type="button" aria-pressed={mode === "dark"} onClick={() => setMode("dark")} aria-label="Dark">
            <Moon />
          </button>
          <button type="button" aria-pressed={mode === "light"} onClick={() => setMode("light")} aria-label="Light">
            <Sun />
          </button>
        </div>
        <span className="hp-hint mono">try a palette →</span>
      </div>
    </div>
  );
}

function ProjectShowcase() {
  const config = useMemo(
    () =>
      normalizeConfig({
        kind: "project",
        project: { repo: "octocat/aurora", tagline: "A tiny, fast design-token compiler for multi-brand UI kits.", packages: { npm: "aurora" } },
        theme: { preset: "github", font: "geist-sans", headingFont: "geist-sans", texture: "none", radius: 10 },
        layout: [{ blocks: [{ type: "install" }] }, { blocks: [{ type: "contributors" }] }, { blocks: [{ type: "changelog" }] }],
      }).config,
    [],
  );
  const data = useMemo(() => mockData(DATE, "octocat", "Mona Octocat", "UTC", "octocat/aurora"), []);
  const ready = useFontsReady([config.theme.font]);
  const rows = useMemo(() => (ready ? renderLayout(config, data, "dark", DATE) : []), [ready, config, data]);
  const projectWidgets = widgetList.filter((w) => w.scope === "project");
  const firstPreset = layoutPresets.find((p) => p.kind === "project");
  return (
    <div className="showcase">
      <div className="showcase__copy">
        <span className="eyebrow">New · project READMEs</span>
        <h2 className="serif">
          For your projects, <em>too.</em>
        </h2>
        <p>
          Point a design at any public repository and its README stays current on its own: stars over time, the people who built it, the latest releases, CI status,
          download counts and a typed-out install command.
        </p>
        <ul className="showcase__list">
          {projectWidgets.slice(0, 10).map((w) => (
            <li key={w.type}>
              <Check /> {w.title}
            </li>
          ))}
        </ul>
        <div className="hero__cta">
          <a className="btn btn--primary btn--lg" href={href(`/studio${firstPreset ? `?preset=${firstPreset.id}` : ""}`)}>
            Start a project README <ArrowRight />
          </a>
          <a className="btn btn--lg" href={href("/presets?kind=project")}>
            Project presets
          </a>
        </div>
      </div>
      <div className="showcase__preview">
        <div className="hp-window">
          <div className="hp-bar">
            <span className="hp-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="hp-url mono">github.com/octocat/aurora</span>
          </div>
          <div className="hp-body">
            <div className="hp-content" style={{ minHeight: 360 }}>
              {rows.map((r) => (
                <div key={r.rowId} className="hp-row">
                  {r.parts.map((p) => (
                    <WidgetImage key={p.meta.name} part={p} />
                  ))}
                </div>
              ))}
              {!rows.length && <div className="hp-skeleton" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Gallery() {
  const [cat, setCat] = useState<WidgetCategory | "Project">("Stats");
  const [mode, setMode] = useState<Mode>("dark");
  const config = useMemo(
    () =>
      normalizeConfig({
        theme: { preset: "crimson" },
        kind: cat === "Project" ? "project" : "profile",
        project: { repo: "octocat/aurora", tagline: "A tiny, fast design-token compiler for multi-brand UI kits.", packages: { npm: "aurora" } },
        layout: widgetList
          .filter((w) => (cat === "Project" ? w.scope === "project" : w.category === cat && w.scope !== "project") && w.kind !== "markdown")
          .map((w) => ({ blocks: [{ type: w.type, id: w.type }] })),
      }).config,
    [cat],
  );
  const data = useMemo(() => mockData(DATE, "octocat", "Mona Octocat", "UTC", "octocat/aurora"), []);
  const ready = useFontsReady([config.theme.font]);
  const rows = useMemo(() => (ready ? renderLayout(config, data, mode, DATE) : []), [ready, config, data, mode]);
  const items = rows.flatMap((r) => r.parts.slice(0, 1));
  return (
    <div className="gallery">
      <div className="gallery__bar">
        <div className="gallery__tabs" role="tablist" aria-label="Widget categories">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}>
              {c.id}
              <span>{widgetList.filter((w) => w.category === c.id && w.scope !== "project").length}</span>
            </button>
          ))}
          <button type="button" role="tab" aria-selected={cat === "Project"} onClick={() => setCat("Project")}>
            Project
            <span>{widgetList.filter((w) => w.scope === "project").length}</span>
          </button>
        </div>
        <div className="hp-mode" role="group" aria-label="Colour scheme">
          <button type="button" aria-pressed={mode === "dark"} onClick={() => setMode("dark")} aria-label="Dark">
            <Moon />
          </button>
          <button type="button" aria-pressed={mode === "light"} onClick={() => setMode("light")} aria-label="Light">
            <Sun />
          </button>
        </div>
      </div>
      <div className={cn("gallery__grid", mode === "light" && "is-light")}>
        {items.map((p) => {
          const def = widgetList.find((w) => w.type === p.meta.block.type)!;
          return (
            <figure key={p.meta.name} className={cn("gallery__item", def.width !== "full" && "is-half")}>
              <div className="gallery__img">
                <WidgetImage part={p} style={p.meta.fixedHeight ? { height: 44, width: "auto" } : undefined} />
              </div>
              <figcaption>
                <b>{def.title}</b>
                <span>{def.description}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

const WORKFLOW = workflowYaml(presetConfig("command-center", { login: "octocat" }), { profileToken: false })
  .split("\n")
  .filter((l) => !l.startsWith("#"))
  .join("\n")
  .trim();

export function Landing() {
  const sample = presetConfig("command-center");
  return (
    <SitePage current="home">
      <section className="hero">
        <div className="wrap hero__grid">
          <div className="hero__copy">
            <span className="eyebrow">Open source · No server · Rebuilt nightly</span>
            <h1 className="hero__title">
              READMEs that stay <em>alive.</em>
            </h1>
            <p className="hero__lede">
              Design an animated README for your GitHub profile or your project in the browser, from {widgetList.length} widgets and {palettePresets.length} palettes. A GitHub Action re-renders every image on a schedule, so streaks, stars, contributors and releases are never stale.
            </p>
            <div className="hero__cta">
              <a className="btn btn--accent btn--lg" href={href("/studio")}>
                Start designing <ArrowRight />
              </a>
              <a className="btn btn--lg" href={href("/presets")}>
                Browse presets
              </a>
            </div>
            <ul className="hero__facts">
              <li>
                <Check /> Dark &amp; light aware
              </li>
              <li>
                <Check /> Runs in your own repo
              </li>
              <li>
                <Check /> Free, MIT licensed
              </li>
            </ul>
          </div>
          <HeroPreview />
        </div>
      </section>

      <section className="numbers">
        <div className="wrap numbers__grid">
          {[
            [String(widgetList.length), "widgets", "graphs, cards, banners, clocks"],
            [String(palettePresets.length), "palettes", "each with dark and light"],
            [String(FONTS.length), "typefaces", "embedded, no external requests"],
            [String(layoutPresets.length), "presets", "finished designs to start from"],
          ].map(([n, l, s]) => (
            <div key={l} className="numbers__item">
              <span className="numbers__n serif">{n}</span>
              <span className="numbers__l">{l}</span>
              <span className="numbers__s">{s}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <h2>Three steps. Then it runs itself.</h2>
            <p>No accounts, no API keys, no hosting. The studio exports plain files; GitHub does the rest on its own schedule.</p>
          </div>
          <ol className="how">
            <li className="how__step">
              <span className="how__n mono">01</span>
              <h3>Design</h3>
              <p>Pick a preset or start blank. Drag widgets into place, tune every option, and preview in GitHub's dark and light themes at desktop or phone width.</p>
              <div className="how__visual how__layers">
                {["Hero banner", "Social pills", "Stats board", "Contribution graph", "Footer"].map((t, i) => (
                  <div key={t} className={cn("how__layer", i === 2 && "is-on")}>
                    <i /> {t}
                  </div>
                ))}
              </div>
            </li>
            <li className="how__step">
              <span className="how__n mono">02</span>
              <h3>Save to GitHub</h3>
              <p>Commit a tiny project straight to your repository, or download it: your design as JSON, a scheduled workflow and the README itself. Re-import the JSON any time to keep editing.</p>
              <div className="how__visual how__tree mono">
                <div>{sample.profile.login}/</div>
                <div>├─ .github/workflows/readme.yml</div>
                <div>├─ readme.config.json</div>
                <div>├─ README.md</div>
                <div>└─ SETUP.md</div>
              </div>
            </li>
            <li className="how__step">
              <span className="how__n mono">03</span>
              <h3>Commit</h3>
              <p>Push it to your profile repository. Every night the action fetches your numbers, renders fresh SVGs and GIFs, and publishes them to their own branch.</p>
              <pre className="how__visual how__code mono">{WORKFLOW.split("\n").slice(-6).join("\n")}</pre>
            </li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <ProjectShowcase />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <h2>Widgets that know what you did today.</h2>
            <p>Every widget is a hand-drawn, animated SVG fed by your real GitHub data: contribution calendars, streaks, releases, languages, even the weather where you live.</p>
          </div>
          <Gallery />
          <div className="center-link">
            <a href={href("/docs/widgets")}>
              See all {widgetList.length} widgets and their options <ArrowRight />
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <h2>Start from something finished.</h2>
            <p>{layoutPresets.length} complete designs for profiles and projects, from a maximal command center to a single quiet card. Apply one, keep your details, change anything.</p>
          </div>
          <div className="preset-row">
            {[...layoutPresets.filter((p) => (p.kind ?? "profile") === "profile").slice(0, 2), ...layoutPresets.filter((p) => p.kind === "project").slice(0, 2)].map((p) => (
              <a key={p.id} className="preset-card" href={href(`/studio?preset=${p.id}`)}>
                <PresetThumb id={p.id} height={260} />
                <div className="preset-meta">
                  <h4>{p.name}</h4>
                  <p>{p.description}</p>
                </div>
              </a>
            ))}
          </div>
          <div className="center-link">
            <a href={href("/presets")}>
              All {layoutPresets.length} presets <ArrowRight />
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <h2>Built around GitHub's rules.</h2>
            <p>GitHub strips scripts and proxies images. Everything here is designed for exactly that environment.</p>
          </div>
          <div className="features">
            {[
              ["Theme-aware", "Every image is rendered twice and served with <picture>, so it matches whichever theme the visitor uses."],
              ["Pure SVG motion", "CSS and SMIL animation only. No JavaScript, so nothing is stripped by GitHub's sanitiser."],
              ["Your repo, your data", "Images are force-pushed to an orphan branch of your own repository. No third-party image host."],
              ["Respectful motion", "Choose full, entrance-only or static. Visitors with reduced-motion settings always get a calm version."],
              ["Private stays private", "Only public repositories are ever named. A token adds private counts, never private names."],
              ["Fails gracefully", "If GitHub's API is down, the action falls back to scraping the public calendar. A broken widget never breaks the build."],
            ].map(([t, d]) => (
              <div key={t} className="feature">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta">
            <h2 className="serif">
              Make your profile <em>worth a scroll.</em>
            </h2>
            <div className="cta__actions">
              <a className="btn btn--accent btn--lg" href={href("/studio")}>
                Open the studio <ArrowRight />
              </a>
              <a className="btn btn--lg" href={REPO_URL} target="_blank" rel="noopener">
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>
    </SitePage>
  );
}
