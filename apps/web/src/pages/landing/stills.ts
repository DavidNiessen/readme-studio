import { mockData, normalizeConfig, type DesignKind, type Mode, type Motion, type ProfileData } from "@readme-studio/core";
import { useEffect, useMemo, useState } from "react";
import { renderLayout, svgUrl, useFontsReady, type RenderedPart } from "../../lib/render";

const DATE = new Date();
const PROJECT = { repo: "octocat/aurora", packages: { npm: "aurora" } };
const data = new Map<string, ProfileData>();

/** The sample account and repository every landing preview shows. */
export function sampleData(kind: DesignKind): ProfileData {
  let d = data.get(kind);
  if (!d) data.set(kind, (d = mockData(DATE, "octocat", "Mona Octocat", "UTC", kind === "project" ? PROJECT.repo : undefined)));
  return d;
}

/**
 * Images decoded ahead of need and held, so the browser keeps them parsed: switching the site's
 * colour scheme then shows the other scheme's images at once instead of parsing dozens of SVG
 * documents in the frame the switch happens.
 */
const held = new Map<string, HTMLImageElement>();
export function holdImages(rows: RenderedPart[][]): void {
  for (const part of rows.flat()) {
    if (!part.svg || part.meta.kind === "markdown") continue;
    const url = svgUrl(part.svg);
    if (held.has(url)) continue;
    const img = new Image();
    img.src = url;
    img.decode().catch(() => undefined);
    held.set(url, img);
    // a bounded set: the oldest go first
    if (held.size > 400) held.delete(held.keys().next().value!);
  }
}

/** Runs work when the browser is idle, or after a moment where it cannot say. */
export function whenIdle(fn: () => void, timeout = 2000): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, 200);
  return () => window.clearTimeout(t);
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
    let cancelIdle = () => {};
    const warm = window.setTimeout(() => {
      cancelIdle = whenIdle(() =>
        holdImages(renderLayout(config, sampleData(config.kind), mode === "dark" ? "light" : "dark", DATE).map((r) => r.parts)),
      );
    }, 2500);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(warm);
      cancelIdle();
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
    const other: Mode = mode === "dark" ? "light" : "dark";
    let i = 0;
    const next = () => {
      if (!alive) return;
      if (i < keys.length) {
        const k = keys[i++];
        const c = configFor(blocks, variants[k]);
        const rows = renderLayout(c, sampleData(c.kind), mode, DATE).map((r) => r.parts);
        setDone((d) => ({ mode, renders: { ...(d.mode === mode ? d.renders : {}), [k]: rows } }));
        window.setTimeout(next, 30);
      } else if (i < keys.length * 2) {
        // then the other colour scheme, decoded and held, for a switch of the site's theme
        const c = configFor(blocks, variants[keys[i++ - keys.length]]);
        holdImages(renderLayout(c, sampleData(c.kind), other, DATE).map((r) => r.parts));
        whenIdle(next);
      }
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
