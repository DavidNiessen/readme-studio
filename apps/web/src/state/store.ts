import { create } from "zustand";
import { getWidget, hashSeed, mockData, mockWeeks, normalizeConfig, presetConfig, type Mode, type ProfileData, type StudioConfig } from "@readme-studio/core";
import { addBlock, duplicateBlock, findBlock, moveBlock, removeBlock, renameBlock, updateOptions } from "../lib/layout";
import { getCurrentId, getPref, loadDesigns, saveDesign, setCurrentId, setPref, type SavedDesign } from "../lib/storage";

export type InspectorTab = "block" | "profile" | "theme" | "data";
export type DialogId = "export" | "presets" | "import" | "json" | "shortcuts" | "designs" | "palette" | "add" | null;
export type MobilePane = "layers" | "canvas" | "inspect";

export interface DataStatus {
  state: "idle" | "loading" | "ok" | "error";
  message?: string;
}

interface StudioState {
  designId: string;
  name: string;
  config: StudioConfig;
  past: StudioConfig[];
  future: StudioConfig[];
  lastKey: string | null;
  lastAt: number;
  savedAt: number;

  selected: string | null;
  mode: Mode;
  device: "desktop" | "mobile";
  epoch: number;
  tab: InspectorTab;
  pane: MobilePane;
  dialog: DialogId;
  railTab: "layers" | "add";

  dataMode: "sample" | "live";
  data: ProfileData;
  liveData: ProfileData | null;
  dataStatus: DataStatus;

  /** apply a config change; consecutive changes with the same key merge into one undo step */
  commit: (fn: (c: StudioConfig) => StudioConfig, key?: string) => void;
  undo: () => void;
  redo: () => void;
  replace: (c: StudioConfig, name?: string, newDesign?: boolean) => void;

  select: (id: string | null) => void;
  setMode: (m: Mode) => void;
  setDevice: (d: "desktop" | "mobile") => void;
  replay: () => void;
  setTab: (t: InspectorTab) => void;
  setPane: (p: MobilePane) => void;
  openDialog: (d: DialogId) => void;
  setRailTab: (t: "layers" | "add") => void;
  setName: (n: string) => void;

  add: (type: string, options?: Record<string, unknown>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  move: (id: string, dir: -1 | 1) => void;
  setOptions: (id: string, patch: Record<string, unknown>, key?: string) => void;
  rename: (id: string, wanted: string) => void;

  useSample: () => void;
  setLive: (d: ProfileData) => void;
  setDataStatus: (s: DataStatus) => void;

  newDesign: (presetId: string) => void;
  openDesign: (d: SavedDesign) => void;
}

const sampleFor = (c: StudioConfig) => mockData(new Date(), c.profile.login, c.profile.name, c.profile.location.timezone);

function initial(): { id: string; name: string; config: StudioConfig } {
  const designs = loadDesigns();
  const current = getCurrentId();
  const found = designs.find((d) => d.id === current) ?? designs[0];
  if (found) return { id: found.id, name: found.name, config: found.config };
  return { id: newId(), name: "My profile", config: presetConfig("command-center") };
}

export function newId(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const init = initial();
const HISTORY = 120;

export const useStudio = create<StudioState>((set, get) => ({
  designId: init.id,
  name: init.name,
  config: init.config,
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
  savedAt: 0,

  selected: null,
  mode: getPref<Mode>("mode", "dark"),
  device: "desktop",
  epoch: 0,
  tab: "theme",
  pane: "canvas",
  dialog: null,
  railTab: "layers",

  dataMode: "sample",
  data: sampleFor(init.config),
  liveData: null,
  dataStatus: { state: "idle" },

  commit(fn, key) {
    const s = get();
    const next = fn(s.config);
    if (next === s.config) return;
    const now = Date.now();
    const merge = key && key === s.lastKey && now - s.lastAt < 900;
    const past = merge ? s.past : [...s.past, s.config].slice(-HISTORY);
    const loginChanged = next.profile.login !== s.config.profile.login || next.profile.name !== s.config.profile.name || next.profile.location.timezone !== s.config.profile.location.timezone;
    set({
      config: next,
      past,
      future: [],
      lastKey: key ?? null,
      lastAt: now,
      ...(loginChanged && s.dataMode === "sample" ? { data: sampleFor(next) } : {}),
    });
  },
  undo() {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({ config: prev, past: s.past.slice(0, -1), future: [s.config, ...s.future], lastKey: null, selected: s.selected && findBlock(prev, s.selected) ? s.selected : null });
  },
  redo() {
    const s = get();
    const next = s.future[0];
    if (!next) return;
    set({ config: next, past: [...s.past, s.config], future: s.future.slice(1), lastKey: null, selected: s.selected && findBlock(next, s.selected) ? s.selected : null });
  },
  replace(c, name, newDesign) {
    const s = get();
    const config = normalizeConfig(c).config;
    set({
      config,
      past: newDesign ? [] : [...s.past, s.config].slice(-HISTORY),
      future: [],
      selected: null,
      lastKey: null,
      ...(name ? { name } : {}),
      ...(newDesign ? { designId: newId() } : {}),
      ...(s.dataMode === "sample" ? { data: sampleFor(config) } : {}),
    });
  },

  select(id) {
    set((s) => ({ selected: id, tab: id ? "block" : s.tab === "block" ? "theme" : s.tab }));
  },
  setMode(m) {
    setPref("mode", m);
    set({ mode: m });
  },
  setDevice(d) {
    set({ device: d });
  },
  replay() {
    set((s) => ({ epoch: s.epoch + 1 }));
  },
  setTab(t) {
    set({ tab: t });
  },
  setPane(p) {
    set({ pane: p });
  },
  openDialog(d) {
    set({ dialog: d });
  },
  setRailTab(t) {
    set({ railTab: t });
  },
  setName(n) {
    set({ name: n.slice(0, 60) });
  },

  add(type, options) {
    const s = get();
    if (!getWidget(type)) return;
    const r = addBlock(s.config, type, s.selected, options);
    get().commit(() => r.config);
    set({ selected: r.id, tab: "block", railTab: "layers" });
  },
  remove(id) {
    const s = get();
    const items = s.config.layout.flatMap((r) => r.blocks.map((b) => b.id));
    const i = items.indexOf(id);
    get().commit((c) => removeBlock(c, id));
    const after = items.filter((x) => x !== id);
    set({ selected: s.selected === id ? (after[Math.min(i, after.length - 1)] ?? null) : s.selected });
  },
  duplicate(id) {
    const r = duplicateBlock(get().config, id);
    get().commit(() => r.config);
    set({ selected: r.id });
  },
  move(id, dir) {
    get().commit((c) => moveBlock(c, id, dir));
  },
  setOptions(id, patch, key) {
    get().commit((c) => updateOptions(c, id, patch), key ?? `opt:${id}:${Object.keys(patch).join(",")}`);
  },
  rename(id, wanted) {
    const r = renameBlock(get().config, id, wanted);
    get().commit(() => r.config);
    set({ selected: r.id });
  },

  useSample() {
    set((s) => ({ dataMode: "sample", data: sampleFor(s.config), dataStatus: { state: "idle" } }));
  },
  setLive(d) {
    set({ dataMode: "live", data: d, liveData: d, dataStatus: { state: "ok" } });
  },
  setDataStatus(st) {
    set({ dataStatus: st });
  },

  newDesign(presetId) {
    const s = get();
    const config = presetConfig(presetId, s.config.profile);
    set({
      designId: newId(),
      name: "Untitled design",
      config,
      past: [],
      future: [],
      selected: null,
      ...(s.dataMode === "sample" ? { data: sampleFor(config) } : {}),
    });
  },
  openDesign(d) {
    set((s) => ({ designId: d.id, name: d.name, config: d.config, past: [], future: [], selected: null, ...(s.dataMode === "sample" ? { data: sampleFor(d.config) } : {}) }));
  },
}));

/** Debounced autosave of the current design. */
let saveTimer = 0;
useStudio.subscribe((s, prev) => {
  if (s.config === prev.config && s.name === prev.name && s.designId === prev.designId) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const st = useStudio.getState();
    saveDesign({ id: st.designId, name: st.name, updatedAt: Date.now(), config: st.config });
    setCurrentId(st.designId);
    useStudio.setState({ savedAt: Date.now() });
  }, 500);
});

/** Synthetic calendar for live data without a token (the browser cannot read the HTML calendar). */
export function syntheticCalendar(login: string) {
  return mockWeeks(new Date(), hashSeed(login));
}
