/**
 * Images a user uploads in the studio, stored in the config as data URIs. A README's SVGs are shown
 * through <img>, which never fetches anything, so an image has to travel inside the SVG itself.
 * The studio shrinks uploads to PNG or JPEG before storing them (the GIF rasteriser reads both).
 */

/** Longest data URI accepted: about 150 KB of image, a few times what a shrunk logo needs. */
export const MAX_IMAGE_CHARS = 200_000;

const DATA_URI = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * True for an uploaded image: a base64 PNG, JPEG, GIF or WebP data URI within the size limit.
 * Checked strictly, since the value is written into an SVG attribute: nothing else gets through.
 */
export function isImageData(v: unknown): boolean {
  return typeof v === "string" && v.length <= MAX_IMAGE_CHARS && DATA_URI.test(v);
}

/** An uploaded image in a size×size box at (x, y), kept to its proportions and centred. */
export function imageSvg(href: string, x: number, y: number, size: number, extra = ""): string {
  if (!isImageData(href)) return "";
  return `<image href="${href}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" ${extra}/>`;
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
