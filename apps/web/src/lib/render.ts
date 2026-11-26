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

function cacheKey(block: Block, part: PartMeta, config: StudioConfig, data: ProfileData, mode: Mode, minute: number): string {
  // views: a widget falls back to names and roles other widgets set, so those count too
  return JSON.stringify([block.type, block.options, part.key, config.theme, views(config, data), mode, dataId(data), minute]);
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

/** Resolves once the fonts of a config are registered (embedding needs the data). */
export function useFontsReady(fonts: string[]): boolean {
  const key = fonts.join(",");
  const [ready, setReady] = useState(() => fonts.every(isFontLoaded));
  useEffect(() => {
    if (fonts.every(isFontLoaded)) {
      setReady(true);
      return;
    }
    setReady(false);
    let alive = true;
    loadFonts(fonts).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ready;
}

/** Render the layout, debounced so typing stays responsive. */
export function useRenderedLayout(config: StudioConfig, data: ProfileData, mode: Mode, delay = 90): { rows: RenderedRow[]; ready: boolean } {
  const fontsReady = useFontsReady([config.theme.font, config.theme.headingFont]);
  const [rows, setRows] = useState<RenderedRow[]>([]);
  const first = useRef(true);
  useEffect(() => {
    if (!fontsReady) return;
    // the time is read when something changes, not on a timer: re-rendering every minute gave every
    // image a new URL, and each one reloaded and replayed its entrance animation
    const run = () => setRows(renderLayout(config, data, mode, new Date(), true));
    if (first.current) {
      first.current = false;
      run();
      return;
    }
    const t = window.setTimeout(run, delay);
    return () => window.clearTimeout(t);
  }, [config, data, mode, fontsReady, delay]);
  return { rows, ready: fontsReady && rows.length >= 0 };
}

export function useRenderedBlock(block: Block | null, config: StudioConfig, data: ProfileData, mode: Mode): RenderedPart[] {
  const fontsReady = useFontsReady([config.theme.font, config.theme.headingFont]);
  return useMemo(() => (block && fontsReady ? renderBlock(block, config, data, mode) : []), [block, config, data, mode, fontsReady]);
}
