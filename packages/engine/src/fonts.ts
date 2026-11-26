import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));

/** Locate a directory that exists either next to the bundle or in the source tree. */
export function assetDir(...candidates: string[]): string {
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error(`asset directory not found; looked in ${candidates.join(", ")}`);
}

export function fontDir(): string {
  return assetDir(join(here, "fonts"), join(here, "../../core/assets/fonts"), join(here, "../core/assets/fonts"));
}

/**
 * Convert a WOFF 1.0 file into a plain SFNT (TTF/OTF) buffer.
 * resvg only understands SFNT fonts; the repo vendors WOFF/WOFF2.
 */
export function woffToSfnt(woff: Buffer): Buffer {
  if (woff.toString("ascii", 0, 4) !== "wOFF") throw new Error("not a WOFF file");
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables: { tag: number; checksum: number; data: Buffer }[] = [];
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    const tag = woff.readUInt32BE(o);
    const offset = woff.readUInt32BE(o + 4);
    const compLength = woff.readUInt32BE(o + 8);
    const origLength = woff.readUInt32BE(o + 12);
    const checksum = woff.readUInt32BE(o + 16);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? inflateSync(raw) : Buffer.from(raw);
    tables.push({ tag, checksum, data });
  }
  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = 2 ** entrySelector * 16;
  const header = Buffer.alloc(12 + numTables * 16);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(numTables * 16 - searchRange, 10);
  const chunks: Buffer[] = [header];
  let offset = header.length;
  tables.forEach((t, i) => {
    const rec = 12 + i * 16;
    header.writeUInt32BE(t.tag, rec);
    header.writeUInt32BE(t.checksum, rec + 4);
    header.writeUInt32BE(offset, rec + 8);
    header.writeUInt32BE(t.data.length, rec + 12);
    const padded = Buffer.alloc((t.data.length + 3) & ~3);
    t.data.copy(padded);
    chunks.push(padded);
    offset += padded.length;
  });
  return Buffer.concat(chunks);
}

const cache = new Map<string, Uint8Array>();

/** SFNT buffers (400 + 700) for the given font ids, for raster rendering. */
export function sfntFonts(ids: string[]): Uint8Array[] {
  const dir = fontDir();
  const out: Uint8Array[] = [];
  for (const id of new Set(ids)) {
    for (const w of [400, 700]) {
      const key = `${id}-${w}`;
      let buf = cache.get(key);
      if (!buf) {
        const file = join(dir, `${key}.woff`);
        if (!existsSync(file)) continue;
        buf = new Uint8Array(woffToSfnt(readFileSync(file)));
        cache.set(key, buf);
      }
      out.push(buf);
    }
  }
  return out;
}
