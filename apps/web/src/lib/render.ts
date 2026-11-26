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
  return JSON.stringify([block.type, block.options, part.key, config.theme, config.profile, mode, dataId(data), minute]);
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

const urlCache = new Map<string, string>();

/** A blob URL for an SVG string; `epoch` forces a fresh URL (replays animations). */
export function svgUrl(svg: string, cacheKeyStr: string, epoch = 0): string {
  const k = `${cacheKeyStr}#${epoch}`;
  let u = urlCache.get(k);
  if (!u) {
    u = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    urlCache.set(k, u);
    if (urlCache.size > 400) {
      const [oldK, oldU] = urlCache.entries().next().value!;
      urlCache.delete(oldK);
      setTimeout(() => URL.revokeObjectURL(oldU), 4000);
    }
  }
  return u;
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

/** The current minute, ticking, so clocks and greetings stay plausible during long sessions. */
export function useMinute(): Date {
  const [d, setD] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setD(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return d;
}

/** Render the layout, debounced so typing stays responsive. */
export function useRenderedLayout(config: StudioConfig, data: ProfileData, mode: Mode, delay = 90): { rows: RenderedRow[]; ready: boolean } {
  const fontsReady = useFontsReady([config.theme.font, config.theme.headingFont]);
  const now = useMinute();
  const [rows, setRows] = useState<RenderedRow[]>([]);
  const first = useRef(true);
  useEffect(() => {
    if (!fontsReady) return;
    const run = () => setRows(renderLayout(config, data, mode, now, true));
    if (first.current) {
      first.current = false;
      run();
      return;
    }
    const t = window.setTimeout(run, delay);
    return () => window.clearTimeout(t);
  }, [config, data, mode, now, fontsReady, delay]);
  return { rows, ready: fontsReady && rows.length >= 0 };
}

export function useRenderedBlock(block: Block | null, config: StudioConfig, data: ProfileData, mode: Mode): RenderedPart[] {
  const fontsReady = useFontsReady([config.theme.font, config.theme.headingFont]);
  return useMemo(() => (block && fontsReady ? renderBlock(block, config, data, mode) : []), [block, config, data, mode, fontsReady]);
}
