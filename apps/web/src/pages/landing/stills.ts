import { mockData, normalizeConfig, type DesignKind, type Mode, type Motion, type ProfileData } from "@readme-studio/core";
import { useEffect, useMemo, useState } from "react";
import { renderLayout, useFontsReady, type RenderedPart } from "../../lib/render";

const DATE = new Date();
const PROJECT = { repo: "octocat/aurora", packages: { npm: "aurora" } };
const data = new Map<string, ProfileData>();

/** The sample account and repository every landing preview shows. */
export function sampleData(kind: DesignKind): ProfileData {
  let d = data.get(kind);
  if (!d) data.set(kind, (d = mockData(DATE, "octocat", "Mona Octocat", "UTC", kind === "project" ? PROJECT.repo : undefined)));
  return d;
}

export interface StillOptions {
  kind?: DesignKind;
  palette?: string;
  mode?: Mode;
  motion?: Motion;
  font?: string;
  headingFont?: string;
}

/** A layout for the landing page's previews, with the sample account's details. */
function configFor(blocks: { type: string; options?: Record<string, unknown> }[], o: StillOptions) {
  return normalizeConfig({
    kind: o.kind ?? "profile",
    profile: { login: "octocat" },
    project: PROJECT,
    theme: {
      preset: o.palette ?? "crimson",
      font: o.font ?? "jetbrains-mono",
      headingFont: o.headingFont ?? o.font ?? "jetbrains-mono",
      motion: o.motion ?? "off",
    },
    layout: blocks.map((b) => ({
      blocks: [{ type: b.type, id: b.type, options: { ...(b.type === "hero" ? { title: "Mona Octocat" } : {}), ...b.options } }],
    })),
  }).config;
}

/**
 * Widget renders for the landing page, one list of parts per block. Stills by default: a page full
 * of looping SVG images keeps the browser drawing every frame. Rendering waits until the fonts are
 * in (text is measured with them) and happens after the first paint, so the page shows at once.
 */
export function useStills(blocks: { type: string; options?: Record<string, unknown> }[], o: StillOptions = {}): RenderedPart[][] {
  const key = JSON.stringify([blocks, o]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const config = useMemo(() => configFor(blocks, o), [key]);
  const ready = useFontsReady([config.theme.font, config.theme.headingFont]);
  const [parts, setParts] = useState<RenderedPart[][]>([]);
  useEffect(() => {
    if (!ready) return;
    const mode = o.mode ?? "dark";
    const t = window.setTimeout(() => setParts(renderLayout(config, sampleData(config.kind), mode, DATE).map((r) => r.parts)), 0);
    // the other colour scheme too, later and into the cache, so switching the site's theme is instant
    const warm = window.setTimeout(() => renderLayout(config, sampleData(config.kind), mode === "dark" ? "light" : "dark", DATE), 2500);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(warm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, config, o.mode]);
  return parts;
}

/**
 * Renders a set of variants ahead of need, one per idle moment, so switching between them while
 * scrolling never stalls: the demo's palettes and colour schemes.
 */
export function useStillVariants<K extends string>(
  variants: Record<K, StillOptions>,
  blocks: { type: string; options?: Record<string, unknown> }[],
  mode: Mode = "dark",
): Partial<Record<K, RenderedPart[][]>> {
  const [done, setDone] = useState<{ mode: Mode; renders: Partial<Record<K, RenderedPart[][]>> }>({ mode, renders: {} });
  const fonts = useFontsReady(["jetbrains-mono", "space-grotesk"]);
  useEffect(() => {
    if (!fonts) return;
    let alive = true;
    const keys = Object.keys(variants) as K[];
    let i = 0;
    const next = () => {
      if (!alive || i >= keys.length) return;
      const k = keys[i++];
      const c = configFor(blocks, variants[k]);
      const rows = renderLayout(c, sampleData(c.kind), mode, DATE).map((r) => r.parts);
      setDone((d) => ({ mode, renders: { ...(d.mode === mode ? d.renders : {}), [k]: rows } }));
      window.setTimeout(next, 30);
    };
    window.setTimeout(next, 0);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts, mode]);
  // until the new scheme's renders are in, the previous ones stand in
  return done.renders;
}

/** The site's colour scheme: the visitor's choice in the header, else the system's. Previews follow it. */
export function useSiteMode(): Mode {
  const read = (): Mode => {
    const t = document.documentElement.dataset.theme;
    if (t === "dark" || t === "light") return t;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };
  const [mode, setMode] = useState<Mode>(read);
  useEffect(() => {
    const update = () => setMode(read());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);
  return mode;
}
