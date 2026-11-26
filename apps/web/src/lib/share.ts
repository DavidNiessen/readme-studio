import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";
import { normalizeConfig, type StudioConfig } from "@readme-studio/core";

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

/** Compress a config into a URL-safe token. */
export function encodeShare(c: StudioConfig): string {
  const { $schema: _drop, ...rest } = c;
  return toBase64Url(zlibSync(strToU8(JSON.stringify(rest)), { level: 9 }));
}

export function decodeShare(token: string): StudioConfig | null {
  try {
    return normalizeConfig(JSON.parse(strFromU8(unzlibSync(fromBase64Url(token))))).config;
  } catch {
    return null;
  }
}

export function shareUrl(c: StudioConfig): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/studio?design=${encodeShare(c)}`;
}
