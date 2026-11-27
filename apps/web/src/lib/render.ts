import {
  blockParts,
  createCtx,
  isFontLoaded,
  loadFonts,
  renderFrames,
  renderPart,
  type Block,
  type Ctx,
  type GifFrames,
  type Mode,
  type PartMeta,
  type ProfileData,
  type StudioConfig,
  views,
  iconsVersion,
  loadMoreIcons,
  moreIconsLoaded,
} from "@readme-studio/core";
import { useEffect, useMemo, useRef, useState } from "react";

/** Rendered output for one part: an SVG string, GIF frames, or markdown. */
export interface RenderedPart {
  meta: PartMeta;
  key: string;
  svg?: string;
  frames?: GifFrames;
  markdown?: string;
  width: number;
  height: number;
}

const svgCache = new Map<string, RenderedPart>();
const MAX_CACHE = 600;

let dataIds = new WeakMap<ProfileData, number>();
let nextDataId = 1;
function dataId(d: ProfileData): number {
  let id = dataIds.get(d);
  if (!id) {
    id = nextDataId++;
    dataIds.set(d, id);
  }
  return id;
}

export function resetRenderCache(): void {
  svgCache.clear();
  dataIds = new WeakMap();
}

function sizeOf(svg: string): { width: number; height: number } {
  const m = /<svg[^>]*?width="([\d.]+)"[^>]*?height="([\d.]+)"/.exec(svg);
  return m ? { width: +m[1], height: +m[2] } : { width: 840, height: 200 };
}

/** The parts of a config every widget's render depends on, serialised once per config and data. */
const shared = new WeakMap<StudioConfig, WeakMap<ProfileData, string>>();
/** A short fingerprint of a long string (an image's data), for cache keys. */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${(h >>> 0).toString(36)}.${s.length}`;
}

function sharedKey(config: StudioConfig, data: ProfileData): string {
  let byData = shared.get(config);
  if (!byData) shared.set(config, (byData = new WeakMap()));
  let k = byData.get(data);
  // views: a widget falls back to names and roles other widgets set, so those count too
  // the media library too: replacing an image must redraw every widget that refers to it
  if (k === undefined) byData.set(data, (k = JSON.stringify([config.theme, views(config, data), (config.media ?? []).map((m) => `${m.id}:${hash(m.data)}`)])));
  return k;
}

function cacheKey(block: Block, part: PartMeta, config: StudioConfig, data: ProfileData, mode: Mode, minute: number): string {
  // the icon version: a render made before the larger icon set arrived may hold a stand-in icon
  return JSON.stringify([block.type, block.options, part.key, mode, dataId(data), minute, iconsVersion()]) + sharedKey(config, data);
}

/** A part's render when it is cached already, without rendering it. */
function cachedPart(part: PartMeta, ctx: Ctx, config: StudioConfig, data: ProfileData, mode: Mode): RenderedPart | null {
  const hit = svgCache.get(cacheKey(part.block, part, config, data, mode, Math.floor(ctx.date.getTime() / 60000)));
  return hit ? { ...hit, meta: part } : null;
}

/** A GIF widget's single preview frame, while its full set of frames is still to come. */
function stillGif(part: PartMeta, ctx: Ctx, config: StudioConfig, data: ProfileData, mode: Mode): RenderedPart {
  const key = `${cacheKey(part.block, part, config, data, mode, Math.floor(ctx.date.getTime() / 60000))}#still`;
  const hit = svgCache.get(key);
  if (hit) return { ...hit, meta: part };
  const svg = renderPart(part, ctx);
  const out: RenderedPart = { meta: part, key, svg, ...sizeOf(svg) };
  svgCache.set(key, out);
  return out;
}

/** Render (or fetch from cache) one part for a mode. */
export function renderPartCached(part: PartMeta, ctx: Ctx, config: StudioConfig, data: ProfileData, mode: Mode): RenderedPart {
  const minute = Math.floor(ctx.date.getTime() / 60000);
  const key = cacheKey(part.block, part, config, data, mode, minute);
  const hit = svgCache.get(key);
  if (hit) return { ...hit, meta: part };
  let out: RenderedPart;
  if (part.kind === "markdown") {
    out = { meta: part, key, markdown: renderPart(part, ctx), width: 0, height: 0 };
  } else if (part.kind === "gif" && ctx.theme.motion === "off") {
    // a still design (or a paused canvas) shows one frame: rendering them all is wasted work
    const svg = renderPart(part, ctx);
    out = { meta: part, key, svg, ...sizeOf(svg) };
  } else if (part.kind === "gif") {
    const frames = renderFrames(part, ctx);
    out = { meta: part, key, frames, svg: frames.frames[Math.floor(frames.frames.length / 3)]?.svg ?? renderPart(part, ctx), width: frames.width, height: frames.height };
  } else {
    const svg = renderPart(part, ctx);
    out = { meta: part, key, svg, ...sizeOf(svg) };
  }
  if (svgCache.size > MAX_CACHE) svgCache.delete(svgCache.keys().next().value!);
  svgCache.set(key, out);
  return out;
}

export interface RenderedRow {
  rowId: string;
  align: string;
  parts: RenderedPart[];
}

/** Render a whole layout for one mode. */
export function renderLayout(config: StudioConfig, data: ProfileData, mode: Mode, date: Date, includeHidden = false): RenderedRow[] {
  const ctx = createCtx(config, data, mode, { date, run: "1" });
  return config.layout.map((row) => ({
    rowId: row.id,
    align: row.align,
    parts: row.blocks
      .filter((b) => includeHidden || !b.hidden)
      .flatMap((b) => blockParts(b, ctx))
      .map((p) => renderPartCached(p, ctx, config, data, mode)),
  }));
}

/** Render a single block (all its parts) for previews and thumbnails. */
export function renderBlock(block: Block, config: StudioConfig, data: ProfileData, mode: Mode, date = new Date()): RenderedPart[] {
  const ctx = createCtx(config, data, mode, { date });
  return blockParts(block, ctx).map((p) => renderPartCached(p, ctx, config, data, mode));
}

// ---------------------------------------------------------------- object URLs

const urlCache = new Map<string, { url: string; epoch: number }>();

/**
 * A blob URL for an SVG string. The same text keeps its URL, so an image whose SVG did not change
 * is not reloaded (which would replay its entrance animation); a new `epoch` forces a fresh URL,
 * which is how "replay" restarts the animations.
 */
export function svgUrl(svg: string, epoch = 0): string {
  const hit = urlCache.get(svg);
  if (hit && hit.epoch === epoch) return hit.url;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  if (hit) setTimeout(() => URL.revokeObjectURL(hit.url), 4000);
  urlCache.delete(svg);
  urlCache.set(svg, { url, epoch });
  if (urlCache.size > 400) {
    const [oldK, old] = urlCache.entries().next().value!;
    urlCache.delete(oldK);
    setTimeout(() => URL.revokeObjectURL(old.url), 4000);
  }
  return url;
}

// ---------------------------------------------------------------- hooks

/**
 * Where designs can use any icon (the studio), renders also wait for the larger brand set. Pages
 * that show only built-in designs (the landing page, docs) never load it.
 */
let allIcons = false;
export function wantAllIcons(): void {
  allIcons = true;
}
const iconsReady = () => !allIcons || moreIconsLoaded();

/** Resolves once the fonts of a config are registered (embedding needs the data), and the icons where wanted. */
export function useFontsReady(fonts: string[]): boolean {
  const key = fonts.join(",");
  const [ready, setReady] = useState(() => fonts.every(isFontLoaded) && iconsReady());
  useEffect(() => {
    if (fonts.every(isFontLoaded) && iconsReady()) {
      setReady(true);
      return;
    }
    setReady(false);
    let alive = true;
    Promise.all([loadFonts(fonts), allIcons ? loadMoreIcons() : undefined]).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ready;
}

/** Longest stretch of rendering before the page gets to handle input and paint. */
const SLICE_MS = 12;

/**
 * Render the layout, debounced so typing stays responsive. Parts already cached show at once. The
 * rest render in short slices, top first, so a change that touches every widget (a palette, the
 * colour scheme) never freezes the page: until its new render is ready, a part keeps showing its
 * previous one. A part with nothing to show yet (a widget just added) renders straight away.
 */
export function useRenderedLayout(config: StudioConfig, data: ProfileData, mode: Mode, delay = 90): { rows: RenderedRow[]; ready: boolean } {
  const fontsReady = useFontsReady([config.theme.font, config.theme.headingFont]);
  const [rows, setRows] = useState<RenderedRow[]>([]);
  const shown = useRef<RenderedRow[]>([]);
  shown.current = rows;
  const first = useRef(true);
  useEffect(() => {
    if (!fontsReady) return;
    let timer = 0;
    const run = () => {
      const ctx = createCtx(config, data, mode, { date: new Date(), run: "1" });
      const before = new Map(shown.current.flatMap((r) => r.parts.map((p) => [p.meta.name, p] as const)));
      const pending: { row: number; index: number; part: PartMeta }[] = [];
      // a GIF's frames take long to render (the 3D skyline draws its city once per frame): its
      // still frame shows first, and the frames come after everything else
      const frames: typeof pending = [];
      const out: RenderedRow[] = config.layout.map((row, ri) => ({
        rowId: row.id,
        align: row.align,
        parts: row.blocks
          .flatMap((b) => blockParts(b, ctx))
          .map((part, pi) => {
            const hit = cachedPart(part, ctx, config, data, mode);
            if (hit) return hit;
            if (part.kind === "gif" && ctx.theme.motion !== "off") {
              frames.push({ row: ri, index: pi, part });
              return stillGif(part, ctx, config, data, mode);
            }
            const old = before.get(part.name);
            if (!old || old.meta.kind !== part.kind) return renderPartCached(part, ctx, config, data, mode);
            pending.push({ row: ri, index: pi, part });
            return { ...old, meta: part };
          }),
      }));
      pending.push(...frames);
      setRows(out);
      const slice = () => {
        const t0 = performance.now();
        while (pending.length && performance.now() - t0 < SLICE_MS) {
          const { row, index, part } = pending.shift()!;
          out[row] = { ...out[row], parts: out[row].parts.map((p, i) => (i === index ? renderPartCached(part, ctx, config, data, mode) : p)) };
        }
        setRows([...out]);
        if (pending.length) timer = window.setTimeout(slice, 0);
      };
      if (pending.length) timer = window.setTimeout(slice, 0);
    };
    if (first.current) {
      first.current = false;
      run();
    } else timer = window.setTimeout(run, delay);
    return () => window.clearTimeout(timer);
  }, [config, data, mode, fontsReady, delay]);
  return { rows, ready: fontsReady && rows.length >= 0 };
}

export function useRenderedBlock(block: Block | null, config: StudioConfig, data: ProfileData, mode: Mode): RenderedPart[] {
  const fontsReady = useFontsReady([config.theme.font, config.theme.headingFont]);
  return useMemo(() => (block && fontsReady ? renderBlock(block, config, data, mode) : []), [block, config, data, mode, fontsReady]);
}
