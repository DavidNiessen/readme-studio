import { normalizeConfig, type StudioConfig } from "@readme-studio/core";

const PREFIX = "rs:";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the studio keeps working in memory */
  }
}

export interface SavedDesign {
  id: string;
  name: string;
  updatedAt: number;
  config: StudioConfig;
}

export function loadDesigns(): SavedDesign[] {
  const list = read<SavedDesign[]>("designs", []);
  return Array.isArray(list)
    ? list
        .filter((d) => d && typeof d.id === "string")
        .map((d) => ({ ...d, name: String(d.name || "Untitled"), config: normalizeConfig(d.config).config }))
        .sort((a, b) => b.updatedAt - a.updatedAt)
    : [];
}

export function saveDesign(d: SavedDesign): void {
  const list = read<SavedDesign[]>("designs", []).filter((x) => x && x.id !== d.id);
  list.unshift(d);
  write("designs", list.slice(0, 40));
}

export function deleteDesign(id: string): void {
  write(
    "designs",
    read<SavedDesign[]>("designs", []).filter((x) => x && x.id !== id),
  );
}

export function getCurrentId(): string | null {
  return read<string | null>("current", null);
}

export function setCurrentId(id: string): void {
  write("current", id);
}

export function getPref<T>(key: string, fallback: T): T {
  return read<T>(`pref:${key}`, fallback);
}

export function setPref(key: string, value: unknown): void {
  write(`pref:${key}`, value);
}
