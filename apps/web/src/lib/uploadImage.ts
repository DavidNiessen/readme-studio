import { MAX_IMAGE_CHARS } from "@readme-studio/core";

/** What an icon needs: the largest emblem is drawn at about 80 px, so 256 stays sharp on any screen. */
const SIDE = 256;
/** Size an icon should settle under; past it, a JPEG or a smaller image is tried. */
const TARGET = 90_000;

export interface ShrunkImage {
  data: string;
  width: number;
  height: number;
}

/**
 * Turns an uploaded file into a small PNG (or JPEG, for an opaque photo that compresses better) as a
 * data URI with its pixel size, ready to store in the design. SVG and GIF uploads are drawn to a canvas too: the README
 * renderer and its GIF rasteriser read PNG and JPEG, and a raster can carry no script.
 */
export async function shrinkImage(file: File): Promise<ShrunkImage> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image. Pick a PNG, JPEG, SVG, GIF or WebP.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is over 15 MB. Pick a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error("That image could not be read. Try exporting it as PNG.");
    }
    // an SVG without a size of its own reports 0: draw it as a square
    const w = img.naturalWidth || SIDE;
    const h = img.naturalHeight || SIDE;
    for (const side of [SIDE, 192, 128, 96]) {
      const out = encode(img, w, h, side);
      if (out.data.length <= TARGET || (side === 96 && out.data.length <= MAX_IMAGE_CHARS)) return out;
    }
    throw new Error("That image is too detailed to store in the design. Try a simpler logo.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(img: HTMLImageElement, w: number, h: number, side: number): ShrunkImage {
  const scale = Math.min(1, side / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, cw, ch);
  const png = canvas.toDataURL("image/png");
  if (png.length <= TARGET || !opaque(g, cw, ch)) return { data: png, width: cw, height: ch };
  // a photo without transparency: JPEG is usually far smaller
  const jpeg = canvas.toDataURL("image/jpeg", 0.86);
  return { data: jpeg.length < png.length ? jpeg : png, width: cw, height: ch };
}

function opaque(g: CanvasRenderingContext2D, w: number, h: number): boolean {
  const px = g.getImageData(0, 0, w, h).data;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 255) return false;
  return true;
}

/** The pixel size of an image already in the library (older entries were stored without it). */
export async function imageSize(data: string): Promise<{ width: number; height: number }> {
  const img = new Image();
  img.src = data;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight };
}
