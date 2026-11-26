import { create } from "zustand";
import { getWidget, hashSeed, mockData, mockWeeks, normalizeConfig, presetConfig, type Mode, type ProfileData, type StudioConfig } from "@readme-studio/core";
import { addBlock, duplicateBlock, findBlock, flatten, moveBlock, moveBlocksTo, removeBlock, renameBlock, updateBlock, updateOptions } from "../lib/layout";
import { findDesignBySource, getCurrentId, getPref, loadDesigns, saveDesign, setCurrentId, setPref, type SavedDesign } from "../lib/storage";

export type InspectorTab = "block" | "theme" | "data";
export type DialogId = "export" | "save" | "presets" | "import" | "json" | "shortcuts" | "designs" | "palette" | "add" | null;
export type MobilePane = "layers" | "canvas" | "inspect";

export interface DataStatus {
  state: "idle" | "loading" | "ok" | "error";
  message?: string;
  /** when the shown live data was fetched */
  updatedAt?: number;
}

interface StudioState {
  designId: string;
  /** where the design saves back to (e.g. "github:owner/repo"); null for designs of the studio itself */
  source: string | null;
  /** for a source's draft: the source's design it started from (see SavedDesign.base) */
  base: StudioConfig | null;
  /** unsaved changes that came back when a source was opened again; the studio offers to reset them */
  restoredDraft: { stale: boolean; committed: StudioConfig } | null;
  /** nothing saved in this browser yet: the studio asks what to make instead of assuming */
  firstRun: boolean;
  setFirstRun: (v: boolean) => void;
  setRestoredDraft: (d: { stale: boolean; committed: StudioConfig } | null) => void;
  name: string;
  config: StudioConfig;
  past: StudioConfig[];
  future: StudioConfig[];
  lastKey: string | null;
  lastAt: number;
  savedAt: number;

  /** the block the inspector shows (the last one clicked) */
  selected: string | null;
  /** every selected block, in layer order; holds `selected` whenever something is selected */
  selection: string[];
  /** the Markdown block being edited on the canvas, if any */
  editing: string | null;
  editMarkdown: (id: string | null) => void;
  mode: Mode;
  device: "desktop" | "mobile";
  epoch: number;
  tab: InspectorTab;
  pane: MobilePane;
  dialog: DialogId;
  railTab: "layers" | "add";

  /** live: GitHub data for `dataKey`; sample: the stand-in until there is some (see lib/liveData) */
  dataMode: "sample" | "live";
  data: ProfileData;
  /** the account or repository the live data is for */
  dataKey: string | null;
  dataStatus: DataStatus;
  /** bumped to fetch fresh data now */
  dataRefresh: number;

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
  /** Ctrl/⌘-click: adds a block to the selection or takes it out. */
  toggleSelect: (id: string) => void;
  /** Shift-click: selects every block from the last one clicked to this one. */
  rangeSelect: (id: string) => void;
  selectAll: () => void;
  /** Bulk actions on several blocks, each one undoable step. */
  removeMany: (ids: string[]) => void;
  duplicateMany: (ids: string[]) => void;
  moveMany: (ids: string[], dir: -1 | 1) => void;
  setHidden: (ids: string[], hidden: boolean) => void;
  /** Drops blocks before or after another block (dragging on the canvas). */
  moveTo: (ids: string[], targetId: string, after: boolean) => void;
  setOptions: (id: string, patch: Record<string, unknown>, key?: string) => void;
  rename: (id: string, wanted: string) => void;

  showSample: () => void;
  setLive: (d: ProfileData, key: string, at: number) => void;
  setDataStatus: (s: DataStatus) => void;
  refreshData: () => void;

  newDesign: (presetId: string) => void;
  openDesign: (d: SavedDesign) => void;
  /**
   * Opens the design of a source: its kept draft when there is one, else `committed` as a new
   * draft. Returns whether the draft differs from `committed` (unsaved changes came back).
   */
  openSource: (source: string, committed: StudioConfig, name: string) => { restored: boolean; stale: boolean };
  /** Records `committed` as what the source now holds (after a save, or keeping a stale draft). */
  rebase: (committed: StudioConfig) => void;
  /** Replaces the draft with the source's design, as one undoable step. */
  resetToSource: (committed: StudioConfig) => void;
}

const sampleFor = (c: StudioConfig) => mockData(new Date(), c.profile.login, "", c.profile.location.timezone, c.kind === "project" ? c.project.repo : undefined);

function initial(): { id: string; name: string; config: StudioConfig; source: string | null; base: StudioConfig | null; firstRun: boolean } {
  const designs = loadDesigns();
  const current = getCurrentId();
  const found = designs.find((d) => d.id === current) ?? designs[0];
  if (found) return { id: found.id, name: found.name, config: found.config, source: found.source ?? null, base: found.base ?? null, firstRun: false };
  return { id: newId(), name: "My profile", config: presetConfig("command-center"), source: null, base: null, firstRun: true };
}

/**
 * A design that was just started or switched to shows sample data: live data belongs to the
 * account or repository it was loaded for, which the next design may not share.
 */
const freshData = (c: StudioConfig) => ({ dataMode: "sample" as const, data: sampleFor(c), dataKey: null, dataStatus: { state: "idle" } as const });

/** Two configs are the same design when they serialise the same way. */
export function sameConfig(a: StudioConfig, b: StudioConfig): boolean {
  return JSON.stringify(normalizeConfig(a).config) === JSON.stringify(normalizeConfig(b).config);
}

export function newId(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const init = initial();
const HISTORY = 120;

export const useStudio = create<StudioState>((set, get) => ({
  designId: init.id,
  source: init.source,
  base: init.base,
  firstRun: init.firstRun,
  setFirstRun(v) {
    set({ firstRun: v });
  },
  restoredDraft: null,
  setRestoredDraft(d) {
    set({ restoredDraft: d });
  },
  name: init.name,
  config: init.config,
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
  savedAt: 0,

  selected: null,
  selection: [],
  editing: null,
  editMarkdown(id) {
    set(id ? { editing: id, selected: id, selection: [id], tab: "block" } : { editing: null });
  },
  mode: getPref<Mode>("mode", "dark"),
  device: "desktop",
  epoch: 0,
  tab: "theme",
  pane: "canvas",
  dialog: null,
  railTab: "layers",

  dataMode: "sample",
  data: sampleFor(init.config),
  dataKey: null,
  dataStatus: { state: "idle" },
  dataRefresh: 0,

  commit(fn, key) {
    const s = get();
    const next = fn(s.config);
    if (next === s.config) return;
    const now = Date.now();
    const merge = key && key === s.lastKey && now - s.lastAt < 900;
    const past = merge ? s.past : [...s.past, s.config].slice(-HISTORY);
    const loginChanged =
      next.profile.login !== s.config.profile.login ||
      next.profile.location.timezone !== s.config.profile.location.timezone ||
      next.kind !== s.config.kind ||
      next.project.repo !== s.config.project.repo;
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
      ...(newDesign ? { designId: newId(), source: null, base: null, restoredDraft: null, firstRun: false, ...freshData(config) } : s.dataMode === "sample" ? { data: sampleFor(config) } : {}),
    });
  },

  select(id) {
    set((s) => ({ selected: id, selection: id ? [id] : [], tab: id ? "block" : s.tab === "block" ? "theme" : s.tab }));
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
  toggleSelect(id) {
    const s = get();
    const order = flatten(s.config).map((x) => x.block.id);
    const has = s.selection.includes(id);
    const selection = order.filter((x) => (x === id ? !has : s.selection.includes(x)));
    const selected = has ? (s.selected === id ? (selection[selection.length - 1] ?? null) : s.selected) : id;
    set({ selection, selected, tab: selected ? "block" : s.tab === "block" ? "theme" : s.tab });
  },
  rangeSelect(id) {
    const s = get();
    const order = flatten(s.config).map((x) => x.block.id);
    const from = order.indexOf(s.selected ?? id);
    const to = order.indexOf(id);
    if (from < 0 || to < 0) return get().select(id);
    const [a, b] = from < to ? [from, to] : [to, from];
    set({ selection: order.slice(a, b + 1), selected: id, tab: "block" });
  },
  selectAll() {
    const order = flatten(get().config).map((x) => x.block.id);
    set({ selection: order, selected: order[order.length - 1] ?? null, tab: order.length ? "block" : get().tab });
  },
  removeMany(ids) {
    if (ids.length <= 1) return ids[0] ? get().remove(ids[0]) : undefined;
    get().commit((c) => ids.reduce(removeBlock, c));
    set({ selected: null, selection: [] });
  },
  duplicateMany(ids) {
    if (ids.length <= 1) return ids[0] ? get().duplicate(ids[0]) : undefined;
    const made: string[] = [];
    get().commit((c) =>
      ids.reduce((acc, id) => {
        const r = duplicateBlock(acc, id);
        made.push(r.id);
        return r.config;
      }, c),
    );
    // the copies become the selection, ready to move or restyle together
    const order = flatten(get().config).map((x) => x.block.id);
    const selection = order.filter((x) => made.includes(x));
    set({ selection, selected: selection[selection.length - 1] ?? null });
  },
  moveMany(ids, dir) {
    if (ids.length <= 1) return ids[0] ? get().move(ids[0], dir) : undefined;
    const order = flatten(get().config).map((x) => x.block.id);
    const sorted = order.filter((x) => ids.includes(x));
    // the block at the edge leads, so the group keeps its order; at the very edge nothing moves
    const lead = dir < 0 ? sorted : [...sorted].reverse();
    const edge = dir < 0 ? order[0] : order[order.length - 1];
    if (lead[0] === edge) return;
    get().commit((c) => lead.reduce((acc, id) => moveBlock(acc, id, dir), c));
  },
  moveTo(ids, targetId, after) {
    get().commit((c) => moveBlocksTo(c, ids, targetId, after));
  },
  setHidden(ids, hidden) {
    get().commit((c) => ids.reduce((acc, id) => updateBlock(acc, id, { hidden: hidden || undefined }), c));
  },
  setOptions(id, patch, key) {
    get().commit((c) => updateOptions(c, id, patch), key ?? `opt:${id}:${Object.keys(patch).join(",")}`);
  },
  rename(id, wanted) {
    const r = renameBlock(get().config, id, wanted);
    get().commit(() => r.config);
    set({ selected: r.id });
  },

  showSample() {
    set((s) => ({ dataMode: "sample", data: sampleFor(s.config), dataKey: null, dataStatus: { state: s.dataStatus.state === "loading" ? "loading" : "idle" } }));
  },
  setLive(d, key, at) {
    set({ dataMode: "live", data: d, dataKey: key, dataStatus: { state: "ok", updatedAt: at } });
  },
  refreshData() {
    set((s) => ({ dataRefresh: s.dataRefresh + 1 }));
  },
  setDataStatus(st) {
    set({ dataStatus: st });
  },

  newDesign(presetId) {
    // a new project starts from the preset alone: nothing of the design that was open carries over
    const config = presetConfig(presetId);
    set({
      designId: newId(),
      source: null,
      base: null,
      restoredDraft: null,
      firstRun: false,
      name: "Untitled design",
      config,
      past: [],
      future: [],
      selected: null,
      ...freshData(config),
    });
  },
  openDesign(d) {
    set((s) => ({ designId: d.id, source: d.source ?? null, base: d.base ?? null, restoredDraft: null, firstRun: false, name: d.name, config: d.config, past: [], future: [], selected: null, ...freshData(d.config) }));
  },
  openSource(source, committed, name) {
    const kept = findDesignBySource(source);
    const config = normalizeConfig(kept?.config ?? committed).config;
    set((s) => ({
      designId: kept?.id ?? newId(),
      firstRun: false,
      source,
      // drafts saved before bases were kept count as started from what the source holds now
      base: kept?.base ?? committed,
      name: kept?.name ?? name,
      config,
      past: [],
      future: [],
      selected: null,
      lastKey: null,
      ...freshData(config),
    }));
    const restored = !!kept && !sameConfig(kept.config, committed);
    const stale = restored && !!kept?.base && !sameConfig(kept.base, committed);
    set({ restoredDraft: restored ? { stale, committed } : null });
    return { restored, stale };
  },
  rebase(committed) {
    set({ base: normalizeConfig(committed).config });
  },
  resetToSource(committed) {
    const config = normalizeConfig(committed).config;
    get().commit(() => config);
    set({ base: config, selected: null });
  },
}));

/**
 * Keeps the selection in step with everything else that sets `selected` (clicks, undo, adding,
 * deleting): a single selection follows it, and blocks that no longer exist drop out.
 */
useStudio.subscribe((s, prev) => {
  if (s.selected === prev.selected && s.config === prev.config && s.selection === prev.selection && s.designId === prev.designId) return;
  const ids = new Set(flatten(s.config).map((x) => x.block.id));
  // the Markdown editor closes with its block, or when another design opens
  if (s.editing && (!ids.has(s.editing) || s.designId !== prev.designId)) useStudio.setState({ editing: null });
  let selection = s.selection.filter((id) => ids.has(id));
  if (!s.selected) selection = [];
  else if (!selection.includes(s.selected)) selection = [s.selected];
  if (selection.length !== s.selection.length || selection.some((x, i) => x !== s.selection[i])) useStudio.setState({ selection });
});

/** Debounced autosave of the current design. */
let saveTimer = 0;
useStudio.subscribe((s, prev) => {
  if (s.config === prev.config && s.name === prev.name && s.designId === prev.designId && s.base === prev.base) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const st = useStudio.getState();
    saveDesign({ id: st.designId, name: st.name, updatedAt: Date.now(), config: st.config, ...(st.source ? { source: st.source, ...(st.base ? { base: st.base } : {}) } : {}) });
    setCurrentId(st.designId);
    useStudio.setState({ savedAt: Date.now() });
  }, 500);
});

/** Synthetic calendar for live data without a token (the browser cannot read the HTML calendar). */
export function syntheticCalendar(login: string) {
  return mockWeeks(new Date(), hashSeed(login));
}
