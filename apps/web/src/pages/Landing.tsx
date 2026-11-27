import { FONTS, layoutPresets, palettePresets, widgetList } from "@readme-studio/core";
import { ArrowDown, ArrowRight, Check } from "lucide-react";
import { useRef } from "react";
import { extensionStore } from "../components/InstallExtension";
import { REPO_URL, SitePage } from "../components/Site";
import { href } from "../lib/router";
import { Demo } from "./landing/Demo";
import { HeroFan } from "./landing/HeroFan";
import { Playground } from "./landing/Playground";
import { PresetShowcase } from "./landing/Presets";
import { ease, reducedMotion, Reveal, useScrollProgress } from "./landing/scroll";
import { ExtensionScene, RunsItself, WidgetRows } from "./landing/Sections";

const RULES: [string, string][] = [
  ["Theme-aware", "Every image is rendered twice and served with <picture>, so it matches whichever theme the visitor uses."],
  ["Pure SVG motion", "CSS animation only. No JavaScript, so nothing is stripped by GitHub's sanitiser."],
  ["Your repo, your data", "Images are force-pushed to an orphan branch of your own repository. No third-party image host."],
  ["Respectful motion", "Choose full, entrance-only or static. Visitors with reduced-motion settings always get a calm version."],
  ["Private stays private", "Only public repositories are ever named. A token adds private counts, never private names."],
  ["Fails gracefully", "If GitHub's API is down, the action falls back to the public calendar. A broken widget never breaks the build."],
];

/**
 * Scrolls to an element with an eased glide (a slow start and a soft landing) rather than a jump.
 * The site routes by the URL's hash, so an in-page #anchor would be taken for a page.
 */
function glideTo(el: HTMLElement | null) {
  if (!el) return;
  const to = el.getBoundingClientRect().top + window.scrollY - 24;
  if (reducedMotion()) return window.scrollTo(0, to);
  const from = window.scrollY;
  const ms = Math.min(1400, 500 + Math.abs(to - from) * 0.5);
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    window.scrollTo(0, from + (to - from) * ease(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** A section heading whose words rise into place as it scrolls into view. */
function Head({ eyebrow, title, text }: { eyebrow?: string; title: React.ReactNode; text?: React.ReactNode }) {
  return (
    <Reveal className="lp-head">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="serif">{title}</h2>
      {text && <p>{text}</p>}
    </Reveal>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  // the copy drifts up and fades as the page scrolls away from it
  useScrollProgress(ref, (p) => ref.current?.style.setProperty("--hp", Math.max(0, (p - 0.5) * 2).toFixed(3)));
  const store = extensionStore();
  return (
    <section ref={ref} className="lp-hero">
      <div className="lp-hero__glow" aria-hidden />
      <div className="wrap lp-hero__grid">
        <div className="lp-hero__copy">
          <span className="eyebrow">Open source · No server · Rebuilt nightly</span>
          <h1 className="lp-hero__title serif">
            READMEs that <br />
            stay <em>alive.</em>
          </h1>
          <p className="lp-hero__lede">
            Design an animated README for your GitHub profile or your project, from {widgetList.length} widgets and {palettePresets.length}{" "}
            palettes. A GitHub Action re-renders it on a schedule, so streaks, stars, contributors and releases are never stale.
          </p>
          <div className="hero__cta">
            <a className="btn btn--accent btn--lg" href={href("/studio")}>
              Start designing <ArrowRight />
            </a>
            <a
              className="btn btn--lg"
              href={store ? store.url : href("/presets")}
              {...(store ? { target: "_blank", rel: "noopener" } : {})}
            >
              {store ? `Add to ${store.browser}` : "Browse presets"}
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
        <HeroFan />
      </div>
      <a
        className="lp-hero__more"
        href={href("/")}
        aria-label="See how it works"
        onClick={(e) => {
          e.preventDefault();
          glideTo(document.getElementById("how"));
        }}
      >
        <span>See how it works</span>
        <ArrowDown />
      </a>
    </section>
  );
}

function Numbers() {
  return (
    <section className="lp-numbers">
      <div className="wrap lp-numbers__grid">
        {[
          [String(widgetList.length), "widgets", "graphs, cards, banners, clocks"],
          [String(palettePresets.length), "palettes", "each with dark and light"],
          [String(FONTS.length), "typefaces", "embedded, no external requests"],
          [String(layoutPresets.length), "presets", "finished designs to start from"],
        ].map(([n, l, s], i) => (
          <Reveal key={l} className="lp-numbers__item" delay={i * 90}>
            <span className="lp-numbers__n serif">{n}</span>
            <span className="lp-numbers__l">{l}</span>
            <span className="lp-numbers__s">{s}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <SitePage current="home">
      <Hero />
      <Numbers />

      <section id="how" className="lp-section lp-section--tight">
        <div className="wrap">
          <Head
            eyebrow="How it works"
            title={
              <>
                Drag, tune, <em>save.</em>
              </>
            }
            text="Three steps in the studio. Then the workflow in your repository takes over."
          />
        </div>
        <Demo />
      </section>

      <section className="lp-section">
        <div className="wrap">
          <Head
            eyebrow="Try it here"
            title={
              <>
                Your turn. <em>Build one.</em>
              </>
            }
            text="Drag widgets into the README, drag them into order, switch palettes. It is the real renderer: what you see is what GitHub shows."
          />
          <Reveal>
            <Playground />
          </Reveal>
        </div>
      </section>

      <section className="lp-section">
        <div className="wrap">
          <Head
            eyebrow="Then"
            title={
              <>
                It runs <em>itself.</em>
              </>
            }
            text="No accounts, no API keys, no hosting. Your repository's own workflow keeps it current."
          />
          <RunsItself />
        </div>
      </section>

      <section className="lp-section lp-section--bleed">
        <div className="wrap">
          <Head
            eyebrow={`${widgetList.length} widgets`}
            title={
              <>
                Widgets that know <em>what you did today.</em>
              </>
            }
            text="Hand-drawn SVGs fed by real GitHub data: calendars, streaks, releases, languages, even the weather."
          />
        </div>
        <WidgetRows />
      </section>

      <section className="lp-section">
        <div className="wrap">
          <ExtensionScene />
        </div>
      </section>

      <PresetShowcase
        head={
          <Head
            eyebrow={`${layoutPresets.length} presets`}
            title={
              <>
                Start from something <em>finished.</em>
              </>
            }
            text="Complete designs for profiles and projects, from a maximal command center to a single quiet card."
          />
        }
      />

      <section className="lp-section">
        <div className="wrap">
          <Head
            title={
              <>
                Built around <em>GitHub's rules.</em>
              </>
            }
            text="GitHub strips scripts and proxies images. Everything here is designed for exactly that."
          />
          <div className="features">
            {RULES.map(([t, d], i) => (
              <Reveal key={t} className="feature" delay={(i % 3) * 90}>
                <h3>{t}</h3>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="wrap">
          <Reveal className="cta lp-cta">
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
          </Reveal>
        </div>
      </section>
    </SitePage>
  );
}
