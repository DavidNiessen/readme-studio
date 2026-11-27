/**
 * Images a user uploads in the studio, stored in the config as data URIs. A README's SVGs are shown
 * through <img>, which never fetches anything, so an image has to travel inside the SVG itself.
 * The studio shrinks uploads to PNG or JPEG before storing them (the GIF rasteriser reads both).
 */

/** Longest data URI accepted: about 150 KB of image, a few times what a shrunk logo needs. */
export const MAX_IMAGE_CHARS = 200_000;

/**
 * A base64 image, optionally followed by how to draw it: `#r<corner %>w<width>h<height>`. The media
 * library adds that when it resolves `media:<id>`, so the rounding travels with the image itself.
 */
const DATA_URI = /^(data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2})(?:#r(\d{1,2})w(\d{1,4})h(\d{1,4}))?$/;

/**
 * True for an uploaded image: a base64 PNG, JPEG, GIF or WebP data URI within the size limit.
 * Checked strictly, since the value is written into an SVG attribute: nothing else gets through.
 */
export function isImageData(v: unknown): boolean {
  return typeof v === "string" && v.length <= MAX_IMAGE_CHARS && DATA_URI.test(v);
}

/** An image value split into its data and how to draw it (corner radius in %, pixel size). */
export function imageParts(v: string): { href: string; radius: number; width: number; height: number } | null {
  if (v.length > MAX_IMAGE_CHARS) return null;
  const m = DATA_URI.exec(v);
  if (!m) return null;
  return { href: m[1], radius: Math.min(50, Number(m[2] ?? 0)), width: Number(m[3] ?? 0), height: Number(m[4] ?? 0) };
}

/** An image value with its drawing hints, as the media library resolves it. */
export function withImageHints(data: string, radius = 0, width = 0, height = 0): string {
  const r = Math.round(Math.min(50, Math.max(0, radius)));
  return r > 0 ? `${data}#r${r}w${Math.round(width)}h${Math.round(height)}` : data;
}

/** A short, stable id for an image's clip path (identical clips share an id, which is harmless). */
function clipId(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 7) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `rsimg${(h >>> 0).toString(36)}${s.length.toString(36)}`;
}

/**
 * An uploaded image in a size×size box at (x, y), kept to its proportions and centred. With a
 * corner radius it is clipped to a rounded rectangle around the picture itself (50% is a circle
 * for a square image, a pill for a wide one), which needs the picture's size to find its edges.
 */
export function imageSvg(value: string, x: number, y: number, size: number, extra = ""): string {
  const img = imageParts(value);
  if (!img) return "";
  const pos = `x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size}" height="${size}"`;
  if (!img.radius) return `<image href="${img.href}" ${pos} preserveAspectRatio="xMidYMid meet" ${extra}/>`;
  // where the picture sits in its box when fitted (a square when its size is unknown)
  const aspect = img.width && img.height ? img.width / img.height : 1;
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;
  const cx = x + (size - w) / 2;
  const cy = y + (size - h) / 2;
  const r = (Math.min(w, h) * img.radius) / 100;
  const id = clipId(`${value}|${x}|${y}|${size}`);
  return `<clipPath id="${id}"><rect x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${r.toFixed(2)}"/></clipPath><image href="${img.href}" ${pos} preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})" ${extra}/>`;
}

/** About how many kilobytes an image's data URI holds, for showing next to it. */
export function imageKb(v: string): number {
  const comma = v.indexOf(",");
  return Math.round(((v.length - comma - 1) * 3) / 4 / 1024);
}

/** How an icon option names an image in the design's media library: `media:<id>`. */
export const MEDIA_PREFIX = "media:";

/** The media id an option value refers to, or null when it is not a media reference. */
export function mediaRef(v: unknown): string | null {
  return typeof v === "string" && v.startsWith(MEDIA_PREFIX) ? v.slice(MEDIA_PREFIX.length) : null;
}

/**
 * Swaps every `media:<id>` in an option value (strings, lists, nested items) for that image's data,
 * so widgets only ever see images. A reference to a missing image becomes empty: the widget then
 * draws as it does without an icon.
 */
export function resolveMedia<T>(v: T, media: Readonly<Record<string, string>>): T {
  if (typeof v === "string") {
    const id = mediaRef(v);
    return (id === null ? v : (media[id] ?? "")) as T;
  }
  if (Array.isArray(v)) return v.map((x) => resolveMedia(x, media)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = resolveMedia(x, media);
    return out as T;
  }
  return v;
}
