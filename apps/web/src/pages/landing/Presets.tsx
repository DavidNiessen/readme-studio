import {
  fontFaceCss,
  fontInfo,
  fontStack,
  getPalettePreset,
  layoutPresets,
  presetConfig,
  resolveTheme,
  type Mode,
} from "@readme-studio/core";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PresetThumb, presetRows } from "../../components/PresetThumb";
import { cn } from "../../components/ui";
import { useFontsReady } from "../../lib/render";
import { href } from "../../lib/router";
import { clamp, reducedMotion } from "./scroll";
import { holdImages, useSiteMode, whenIdle } from "./stills";

/** Two profiles and two projects, one for each texture: dots, none, grid and lines. */
const LIST = ["command-center", "minimal-paper", "maintainers-dashboard", "cli-tool"]
  .map((id) => layoutPresets.find((p) => p.id === id))
  .filter((p): p is (typeof layoutPresets)[number] => !!p);

const TEXTURE: Record<string, string> = { dots: "Dotted cards", grid: "Grid cards", lines: "Hatched cards", none: "Plain cards" };

/** The page's own copy of the fonts the presets use, so the section can set its text in them. */
const pageFonts = new Set<string>();
export function usePageFonts(ids: string[]): boolean {
  const ready = useFontsReady(ids);
  useEffect(() => {
    const fresh = ids.filter((id) => !pageFonts.has(fontInfo(id).id));
    if (!ready || !fresh.length) return;
    fresh.forEach((id) => pageFonts.add(fontInfo(id).id));
    const style = document.createElement("style");
    style.dataset.presetFonts = fresh.join(" ");
    style.textContent = fontFaceCss(fresh);
    document.head.appendChild(style);
  }, [ready, ids]);
  return ready;
}

/** A preset's look as CSS variables: its colours in the site's scheme, typefaces and corners. */
function presetLook(id: string, mode: Mode) {
  const settings = presetConfig(id).theme;
  const theme = resolveTheme(settings, mode);
  const vars: Record<string, string> = {
    "--pz-bg": theme.card,
    "--pz-card": theme.bg,
    "--pz-border": theme.border,
    "--pz-text": theme.text,
    "--pz-muted": theme.muted,
    "--pz-subtle": theme.subtle,
    "--pz-accent": theme.accent,
    "--pz-glow": theme.glow,
    "--pz-radius": `${Math.min(24, theme.radius + 4)}px`,
    "--pz-head": fontStack(theme.headingFont),
    "--pz-body": fontStack(theme.font),
    "--pz-head-weight": fontInfo(theme.headingFont).category === "serif" ? "600" : "700",
  };
  return {
    style: vars as CSSProperties,
    texture: theme.texture,
    facts: [getPalettePreset(settings.preset).name, fontInfo(settings.headingFont).name, TEXTURE[theme.texture] ?? "Plain cards"],
  };
}

/**
 * The presets, one at a time as the page scrolls. The section pins to the screen and, preset by
 * preset, takes on each one's look (its colours, typefaces, corners and texture) while its README
 * slides in beside its name. The list of names jumps straight to one.
 */
export function PresetShowcase({ head }: { head: ReactNode }) {
  const mode = useSiteMode();
  const still = reducedMotion();
  const [index, setIndex] = useState(0);
  const section = useRef<HTMLElement>(null);
  const run = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const fonts = useMemo(() => LIST.flatMap((p) => [presetConfig(p.id).theme.font, presetConfig(p.id).theme.headingFont]), []);
  const fontsReady = usePageFonts(fonts);
  const look = presetLook(LIST[index].id, mode);
  // the READMEs are rendered once the section comes near, not with the rest of the page
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = section.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "250% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  // one README per idle moment: all four at once would hold up the scroll for a few hundred milliseconds
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!near || shown >= LIST.length) return;
    return whenIdle(() => setShown((n) => n + 1), 400);
  }, [near, shown]);
  // and the other colour scheme's, decoded and held while the browser is idle, for a theme switch
  useEffect(() => {
    if (!near) return;
    const other: Mode = mode === "dark" ? "light" : "dark";
    let i = 0;
    let cancel = () => {};
    const next = () => {
      if (i >= LIST.length) return;
      holdImages(presetRows(LIST[i++].id, other, "off", 8).map((r) => r.parts));
      cancel = whenIdle(next);
    };
    const t = window.setTimeout(() => (cancel = whenIdle(next)), 2000);
    return () => {
      window.clearTimeout(t);
      cancel();
    };
  }, [near, mode]);

  /** How far the page has scrolled through the pinned stretch, from 0 to 1. */
  const progress = () => {
    const el = run.current;
    if (!el) return 0;
    const pin = el.firstElementChild as HTMLElement;
    const top = parseFloat(getComputedStyle(pin).top) || 0;
    return clamp((top - el.getBoundingClientRect().top) / Math.max(1, el.offsetHeight - pin.offsetHeight));
  };
  useEffect(() => {
    if (still) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const p = progress();
      bar.current?.style.setProperty("--p", p.toFixed(3));
      setIndex(Math.min(LIST.length - 1, Math.floor(p * LIST.length)));
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [still]);

  /** Scrolls to the middle of a preset's stretch. */
  const go = (i: number) => {
    const el = run.current;
    if (!el || still) return setIndex(i);
    const pin = el.firstElementChild as HTMLElement;
    const top = parseFloat(getComputedStyle(pin).top) || 0;
    const span = el.offsetHeight - pin.offsetHeight;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - top + (span * (i + 0.5)) / LIST.length, behavior: "smooth" });
  };

  const current = LIST[index];
  return (
    <section ref={section} className={cn("lp-section lp-pz", fontsReady && "is-fonts", still && "is-still")} style={look.style}>
      <div className="lp-pz__bg" aria-hidden>
        {(["dots", "grid", "lines"] as const).map((t) => (
          <span key={t} className={cn("lp-pz__tex", `lp-pz__tex--${t}`, look.texture === t && "is-on")} />
        ))}
      </div>
      <div className="wrap">{head}</div>
      <div ref={run} className="lp-pz__run" style={{ ["--n" as string]: LIST.length }}>
        <div className="lp-pz__pin">
          <div className="wrap lp-pz__grid">
            <div className="lp-pz__copy">
              <ol className="lp-pz__list">
                {LIST.map((p, i) => (
                  <li key={p.id}>
                    <button type="button" className={cn(i === index && "is-on")} onClick={() => go(i)}>
                      <span className="mono">0{i + 1}</span> {p.name}
                    </button>
                  </li>
                ))}
              </ol>
              <div ref={bar} className="lp-pz__bar" aria-hidden />
              <div className="lp-pz__now">
                {LIST.map((p, i) => (
                  <div
                    key={p.id}
                    className={cn("lp-pz__about", i === index ? "is-on" : i < index ? "is-past" : "is-next")}
                    aria-hidden={i !== index}
                  >
                    <span className="lp-pz__kind mono">{p.kind === "project" ? "Project README" : "Profile README"}</span>
                    <h3>{p.name}</h3>
                    <p>{p.description}</p>
                  </div>
                ))}
              </div>
              <ul className="lp-pz__facts">
                {look.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className="lp-pz__actions">
                <a className="lp-pz__go" href={href(`/studio?preset=${current.id}`)}>
                  Open {current.name} in the studio <ArrowRight />
                </a>
                <a className="lp-pz__all" href={href("/presets")}>
                  All {layoutPresets.length} presets
                </a>
              </div>
            </div>
            <div className="lp-pz__stage">
              {LIST.map((p, i) => (
                <a
                  key={p.id}
                  className={cn("lp-pz__shot", i === index ? "is-on" : i < index ? "is-past" : "is-next")}
                  href={href(`/studio?preset=${p.id}`)}
                  tabIndex={i === index ? 0 : -1}
                  aria-label={`Open ${p.name} in the studio`}
                >
                  {(i < shown || i === index) && <PresetThumb id={p.id} height={640} maxRows={8} mode={mode} motion="off" />}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
