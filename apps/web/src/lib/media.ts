import { getWidget, MAX_MEDIA, MEDIA_PREFIX, type MediaItem, type StudioConfig } from "@readme-studio/core";

/** The option value that uses an image from the media library. */
export const mediaValue = (id: string) => `${MEDIA_PREFIX}${id}`;

/** A free id for an image named `name`: a slug of it, numbered when taken. */
function freeId(c: StudioConfig, name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "image";
  const taken = new Set(c.media.map((m) => m.id));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Adds an image to the library and returns its id. */
export function addMedia(
  c: StudioConfig,
  name: string,
  image: { data: string; width: number; height: number },
): { config: StudioConfig; id: string } {
  if (c.media.length >= MAX_MEDIA) throw new Error(`The media library holds up to ${MAX_MEDIA} images. Delete one first.`);
  const id = freeId(c, name);
  const label = name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || id;
  return { config: { ...c, media: [...c.media, { id, name: label, ...image }] }, id };
}

const patchMedia = (c: StudioConfig, id: string, patch: Partial<MediaItem>): StudioConfig => ({
  ...c,
  media: c.media.map((m) => (m.id === id ? { ...m, ...patch } : m)),
});

/** Replaces an image's picture: every widget using it shows the new one, with the same corners. */
export const replaceMedia = (c: StudioConfig, id: string, image: { data: string; width: number; height: number }) =>
  patchMedia(c, id, image);

/** Rounds an image's corners (0 square, 50 a circle or pill), with its size so rounding follows the picture. */
export const setMediaCorners = (c: StudioConfig, id: string, radius: number, size?: { width: number; height: number }) =>
  patchMedia(c, id, { radius: Math.round(Math.min(50, Math.max(0, radius))), ...size });

export const renameMedia = (c: StudioConfig, id: string, name: string) => patchMedia(c, id, { name: name.slice(0, 60) });

/** Every string in a value, with `media:<id>` swapped for `to`. */
function swapRef<T>(v: T, ref: string, to: string): T {
  if (v === ref) return to as T;
  if (Array.isArray(v)) return v.map((x) => swapRef(x, ref, to)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swapRef(x, ref, to)])) as T;
  return v;
}

/** Removes an image, and clears it from every widget and link that used it. */
export function removeMedia(c: StudioConfig, id: string): StudioConfig {
  const ref = mediaValue(id);
  return {
    ...c,
    media: c.media.filter((m) => m.id !== id),
    profile: { ...c.profile, links: swapRef(c.profile.links, ref, "") },
    layout: c.layout.map((r) => ({ ...r, blocks: r.blocks.map((b) => ({ ...b, options: swapRef(b.options, ref, "") })) })),
  };
}

/** Where an image is used: the widgets (by title) and whether a profile link uses it. */
export function mediaUses(c: StudioConfig, id: string): string[] {
  const ref = mediaValue(id);
  const has = (v: unknown): boolean =>
    v === ref || (Array.isArray(v) ? v.some(has) : !!v && typeof v === "object" && Object.values(v).some(has));
  const uses = c.layout
    .flatMap((r) => r.blocks)
    .filter((b) => has(b.options))
    .map((b) => getWidget(b.type)?.title ?? b.type);
  if (has(c.profile.links)) uses.push("Profile links");
  return uses;
}
