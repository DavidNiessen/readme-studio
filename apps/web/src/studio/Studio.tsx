import {
  Command,
  Download,
  Eye,
  FileJson,
  FolderOpen,
  Keyboard,
  LayoutTemplate,
  Link2,
  Monitor,
  Moon,
  MoreHorizontal,
  Play,
  Redo2,
  SlidersHorizontal,
  Smartphone,
  Sun,
  SunMoon,
  Undo2,
  Upload,
  Layers,
  BookOpen,
  User,
  Plus,
  Check,
  ChevronDown,
  FileText,
  FolderGit2,
  RotateCcw,
  X,
  RefreshCw,
  Pause,
  RotateCw,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { layoutPresets, parseConfig, resolvePalette, type StudioConfig } from "@readme-studio/core";
import { ThemeSwatchesContext } from "../components/ColorPicker";
import { Logo, LogoMark } from "../components/Logo";
import { Button, ConfirmProvider, ContextMenuHost, IconButton, MOD, Menu, Segmented, cn, copyText, useToast, type MenuHeading, type MenuItem } from "../components/ui";
import { findBlock } from "../lib/layout";
import { navigate } from "../lib/router";
import { decodeShare, shareUrl } from "../lib/share";
import { installWheelScroll } from "../lib/wheelScroll";
import { getPref, loadDesigns, setPref, type SavedDesign } from "../lib/storage";
import { useStudio } from "../state/store";
import { Canvas } from "./Canvas";
import { Dialogs } from "./Dialogs";
import { Inspector } from "./Inspector";
import { Rail } from "./Rail";
import { DraftNotice, SaveButton, SaveDialog, useDraftChanges, useResetDraft } from "./github/SaveToGitHub";
import { openedMessage, openFailure, openRepository } from "./github/openRepo";
import { getSession, setSession, useSession } from "./github/session";
import { parseRepo } from "../github/repo";
import { OpenFailed } from "./github/OpenFailed";
import { webPlatform } from "./github/webPlatform";
import { StudioHostContext, useStudioHost, type StudioHost } from "./host";
import { Welcome } from "./Welcome";
import { DataRefreshButton, useDataSummary } from "./DataStatus";
import { useLiveData } from "../lib/liveData";

export function useUiTheme(): ["light" | "dark" | "system", (t: "light" | "dark" | "system") => void] {
  const [t, setT] = useState<"light" | "dark" | "system">(() => getPref("ui-theme-choice", "system"));
  useEffect(() => {
    const root = document.documentElement;
    if (t === "system") delete root.dataset.theme;
    else root.dataset.theme = t;
    try {
      if (t === "system") localStorage.removeItem("rs:ui-theme");
      else localStorage.setItem("rs:ui-theme", t);
    } catch {
      /* ignore */
    }
    setPref("ui-theme-choice", t);
  }, [t]);
  return [t, setT];
}

/** What a crowded top bar gives up, in order. All of it stays reachable from the ⋯ menu. */
const GIVE_WAY = [".data-refresh", ".presets-label", ".draft-notice__label", ".draft-notice"];

/**
 * How crowded the top bar is. Its centre sits in the middle of the window, so a full right-hand
 * side would slide under it: first the data refresh button gives way, then the Presets label, then
 * the unsaved changes notice shrinks to its dot and Reset button, and only then does it go. A hidden item comes back only once there is room for it, so the bar
 * does not flicker at the threshold.
 */
function useTopbarFit(ref: React.RefObject<HTMLElement | null>): number {
  const [level, setLevel] = useState(0);
  const current = useRef(0);
  current.current = level;
  const widths = useRef<number[]>(GIVE_WAY.map(() => 0));
  useLayoutEffect(() => {
    const bar = ref.current;
    const center = bar?.querySelector<HTMLElement>(".topbar__center");
    const right = bar?.querySelector<HTMLElement>(".topbar__right");
    if (!bar || !center || !right) return;
    const MIN_GAP = 12;
    const measure = () => {
      // on narrow screens the centre is in the flow and cannot overlap
      if (getComputedStyle(center).position !== "absolute") {
        if (current.current) setLevel(0);
        return;
      }
      GIVE_WAY.forEach((sel, i) => {
        const w = bar.querySelector<HTMLElement>(sel)?.offsetWidth;
        if (w) widths.current[i] = w;
      });
      const gap = right.getBoundingClientRect().left - center.getBoundingClientRect().right;
      const lvl = current.current;
      if (gap < MIN_GAP && lvl < GIVE_WAY.length) setLevel(lvl + 1);
      else if (lvl > 0 && gap - widths.current[lvl - 1] - 8 >= MIN_GAP) setLevel(lvl - 1);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    ro.observe(right);
    measure();
    return () => ro.disconnect();
  }, [ref]);
  return level;
}

function TopBar() {
  const s = useStudio();
  const bar = useRef<HTMLElement>(null);
  const tight = useTopbarFit(bar);
  const draft = useDraftChanges();
  const resetDraft = useResetDraft();
  const data = useDataSummary();
  const toast = useToast();
  const host = useStudioHost();
  const [ui, setUi] = useUiTheme();
  const docs = () => (host?.siteUrl ? window.open(`${host.siteUrl}#/docs`, "_blank", "noopener") : navigate("/docs"));
  return (
    <header className="topbar" ref={bar} data-tight={tight || undefined}>
      {host ? (
        <a className="logo" href={host.siteUrl ?? "#"} target="_blank" rel="noopener" aria-label="Readme Studio website">
          <LogoMark />
        </a>
      ) : (
        <Logo compact />
      )}
      <div className="topbar__sep hide-sm" />
      <div className="design-name">
        <Menu
          align="start"
          label="Recent projects"
          trigger={
            <button type="button" className="icon-btn icon-btn--sm design-switch" aria-label="Recent projects" title="Recent projects">
              <ChevronDown />
            </button>
          }
          items={() => recentProjects(s.designId, s.openDesign, () => s.openDialog("designs"))}
        />
        <Menu
          align="start"
          label="New project"
          trigger={
            <button type="button" className="icon-btn icon-btn--sm design-switch" aria-label="New project" title="New project">
              <Plus />
            </button>
          }
          items={[
            { heading: "New project" },
            { label: "Profile README", icon: <User />, onSelect: () => (s.newDesign("command-center"), toast("New profile README started")) },
            {
              label: "Project README",
              icon: <FolderGit2 />,
              onSelect: () => (s.newDesign(layoutPresets.find((p) => p.kind === "project")?.id ?? "command-center"), toast("New project README started")),
            },
            "sep",
            { label: "From a preset…", icon: <LayoutTemplate />, onSelect: () => s.openDialog("presets") },
            { label: "Import…", icon: <Upload />, hint: "config, Markdown, GitHub", onSelect: () => s.openDialog("import") },
          ]}
        />
        <input aria-label="Design name" value={s.name} onChange={(e) => s.setName(e.target.value)} onBlur={(e) => !e.target.value.trim() && s.setName("Untitled design")} />
        {host?.context && (
          <span className="host-context hide-sm" title={`Editing ${host.context}`}>
            {host.context}
          </span>
        )}
      </div>
      <div className="topbar__center">
        <div className="topbar__group hide-sm">
          <IconButton label="Undo" shortcut={`${MOD} Z`} disabled={!s.past.length} onClick={s.undo}>
            <Undo2 />
          </IconButton>
          <IconButton label="Redo" shortcut={`${MOD} ⇧ Z`} disabled={!s.future.length} onClick={s.redo}>
            <Redo2 />
          </IconButton>
        </div>
        <div style={{ width: 132 }} className="hide-sm">
          <Segmented
            label="Preview colour scheme"
            value={s.mode}
            onChange={s.setMode}
            options={[
              { value: "dark", label: <span>Dark</span>, icon: <Moon />, title: "GitHub dark" },
              { value: "light", label: <span>Light</span>, icon: <Sun />, title: "GitHub light" },
            ]}
          />
        </div>
        <div className="topbar__group hide-md">
          <IconButton label="Desktop width" active={s.device === "desktop"} onClick={() => s.setDevice("desktop")}>
            <Monitor />
          </IconButton>
          <IconButton label="Mobile width" active={s.device === "mobile"} onClick={() => s.setDevice("mobile")}>
            <Smartphone />
          </IconButton>
          <IconButton label="Replay animations" shortcut="R" onClick={s.replay}>
            <RotateCw />
          </IconButton>
          <IconButton label={s.animate ? "Pause animations" : "Play animations"} shortcut="P" active={!s.animate} onClick={() => s.setAnimate(!s.animate)}>
            {s.animate ? <Pause /> : <Play />}
          </IconButton>
        </div>
      </div>
      <div className="topbar__right">
        <DataRefreshButton />
        <Button variant="ghost" className="hide-md" title="Presets" aria-label="Presets" onClick={() => s.openDialog("presets")}>
          <LayoutTemplate /> <span className="presets-label">Presets</span>
        </Button>
        <IconButton label="Command palette" shortcut={`${MOD} K`} className="hide-sm" onClick={() => s.openDialog("palette")}>
          <Command />
        </IconButton>
        <Menu
          trigger={
            <button type="button" className="icon-btn" aria-label="More">
              <MoreHorizontal />
            </button>
          }
          items={[
            { label: "Presets", icon: <LayoutTemplate />, onSelect: () => s.openDialog("presets") },
            { label: "All projects", icon: <FolderOpen />, onSelect: () => s.openDialog("designs") },
            { label: "Import design", icon: <Upload />, onSelect: () => s.openDialog("import") },
            { label: "Edit as JSON", icon: <FileJson />, onSelect: () => s.openDialog("json") },
            { label: "Export manually", icon: <Download />, shortcut: `${MOD} E`, onSelect: () => s.openDialog("export") },
            {
              label: "Copy share link",
              icon: <Link2 />,
              onSelect: async () => {
                await copyText(shareUrl(s.config));
                toast("Share link copied");
              },
            },
            "sep",
            { label: s.mode === "dark" ? "Preview light" : "Preview dark", icon: s.mode === "dark" ? <Sun /> : <Moon />, shortcut: "T", onSelect: () => s.setMode(s.mode === "dark" ? "light" : "dark") },
            { label: s.device === "desktop" ? "Mobile width" : "Desktop width", icon: s.device === "desktop" ? <Smartphone /> : <Monitor />, onSelect: () => s.setDevice(s.device === "desktop" ? "mobile" : "desktop") },
            { label: "Replay animations", icon: <RotateCw />, shortcut: "R", onSelect: s.replay },
            { label: s.animate ? "Pause animations" : "Play animations", icon: s.animate ? <Pause /> : <Play />, shortcut: "P", onSelect: () => s.setAnimate(!s.animate) },
            { label: "Refresh GitHub data", icon: <RefreshCw />, hint: data.text, onSelect: s.refreshData },
            ...(draft ? [{ label: "Reset unsaved changes", icon: <RotateCcw />, hint: draft.repo, onSelect: () => void resetDraft() }] : []),
            { label: `App theme: ${ui}`, icon: <SunMoon />, onSelect: () => setUi(ui === "system" ? "dark" : ui === "dark" ? "light" : "system") },
            "sep",
            { label: "Keyboard shortcuts", icon: <Keyboard />, shortcut: "?", onSelect: () => s.openDialog("shortcuts") },
            { label: "Documentation", icon: <BookOpen />, onSelect: docs },
          ]}
        />
        <DraftNotice />
        {host?.actions}
        <SaveButton />
        {host?.onClose && (
          <IconButton label="Close and return" onClick={host.onClose}>
            <X />
          </IconButton>
        )}
      </div>
    </header>
  );
}

/** How long ago, in a few words. */
function ago(t: number, now = Date.now()): string {
  const m = Math.round((now - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(t).toLocaleDateString();
}

/** The switcher left of the design name: the latest projects, then all of them. */
function recentProjects(current: string, open: (d: SavedDesign) => void, showAll: () => void): (MenuItem | MenuHeading | "sep")[] {
  const designs = loadDesigns();
  const recent = designs.slice(0, 7);
  return [
    { heading: "Recent projects" },
    ...recent.map(
      (d): MenuItem => ({
        label: d.name,
        icon: d.id === current ? <Check /> : d.source?.startsWith("github:") ? <FolderGit2 /> : <FileText />,
        hint: d.id === current ? "open" : ago(d.updatedAt),
        disabled: d.id === current,
        onSelect: () => open(d),
      }),
    ),
    ...(recent.length ? (["sep"] as const) : []),
    { label: designs.length > recent.length ? `Show all ${designs.length} projects` : "Show all projects", icon: <FolderOpen />, onSelect: showAll },
  ];
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
}

function useShortcuts() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const s = useStudio.getState();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "k") {
        e.preventDefault();
        s.openDialog(s.dialog === "palette" ? null : "palette");
        return;
      }
      if (s.dialog) return;
      if (mod && k === "s") {
        e.preventDefault();
        s.openDialog("save");
        return;
      }
      if (mod && k === "e") {
        e.preventDefault();
        s.openDialog("export");
        return;
      }
      if (isTyping(e)) return;
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      const sel = s.selected;
      // actions apply to every selected block
      const ids = s.selection.length ? s.selection : sel ? [sel] : [];
      if (mod && k === "d" && ids.length) {
        e.preventDefault();
        s.duplicateMany(ids);
        return;
      }
      if (mod && k === "a") {
        e.preventDefault();
        s.selectAll();
        return;
      }
      if (mod) return;
      if ((e.key === "Delete" || e.key === "Backspace") && ids.length) {
        e.preventDefault();
        s.removeMany(ids);
      } else if (e.key === "Escape") s.select(null);
      else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && ids.length) {
        e.preventDefault();
        s.moveMany(ids, e.key === "ArrowUp" ? -1 : 1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const order = s.config.layout.flatMap((r) => r.blocks.map((b) => b.id));
        if (!order.length) return;
        e.preventDefault();
        const i = sel ? order.indexOf(sel) : -1;
        const j = e.key === "ArrowUp" ? Math.max(0, i - 1) : Math.min(order.length - 1, i + 1);
        // Shift extends the selection, as Shift-click does
        if (e.shiftKey && sel) {
          const anchor = order.indexOf(s.selection[0] === sel ? s.selection[s.selection.length - 1] : s.selection[0]);
          const [a, b] = anchor < j ? [anchor, j] : [j, anchor];
          useStudio.setState({ selection: order.slice(a, b + 1), selected: order[j] });
        } else s.select(order[j]);
      } else if (k === "h" && ids.length) {
        const blocks = s.config.layout.flatMap((r) => r.blocks).filter((b) => ids.includes(b.id));
        s.setHidden(ids, !blocks.every((b) => b.hidden));
      } else if (k === "t") s.setMode(s.mode === "dark" ? "light" : "dark");
      else if (k === "r") s.replay();
      else if (k === "p") s.setAnimate(!s.animate);
      else if (k === "a") {
        s.setRailTab("add");
        s.setPane("layers");
      } else if (e.key === "?") s.openDialog("shortcuts");
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}

function MobileTabs() {
  const { pane, setPane, selected, config } = useStudio();
  const sel = selected ? findBlock(config, selected) : null;
  return (
    <nav className="mobile-tabs" aria-label="Studio panels">
      <button type="button" aria-pressed={pane === "layers"} onClick={() => setPane("layers")}>
        <Layers />
        Layers
      </button>
      <button type="button" aria-pressed={pane === "canvas"} onClick={() => setPane("canvas")}>
        <Eye />
        Preview
      </button>
      <button type="button" aria-pressed={pane === "inspect"} onClick={() => setPane("inspect")}>
        <SlidersHorizontal />
        {sel ? "Widget" : "Design"}
      </button>
    </nav>
  );
}

export default function Studio({ host }: { host?: StudioHost } = {}) {
  useEffect(installWheelScroll, []);
  return (
    <StudioHostContext.Provider value={host ?? null}>
      <ConfirmProvider>
        <StudioShell />
      </ConfirmProvider>
    </StudioHostContext.Provider>
  );
}

function StudioShell() {
  const pane = useStudio((s) => s.pane);
  const toast = useToast();
  const host = useStudioHost();
  useShortcuts();
  useUiTheme();
  useLiveData(host?.github ?? webPlatform);
  // a host (the browser extension) decides what opens; the website reads its URL. Until that
  // design is in, the editor stays hidden: whatever design the store held is not this one.
  const [opening, setOpening] = useState<{ state: "loading" } | { state: "ready" } | { state: "failed"; error: unknown }>({ state: host?.open ? "loading" : "ready" });
  const [attempt, setAttempt] = useState(0);
  // a link that says what to open (a repository, preset, shared design or config) skips the welcome
  const [deepLink] = useState(() => /[?&](repo|preset|design|config)=/.test(location.hash));
  useEffect(() => {
    if (!host?.open) return;
    let cancelled = false;
    setOpening({ state: "loading" });
    host
      .open()
      .then((r) => {
        if (cancelled) return;
        setOpening({ state: "ready" });
        if (!r) return;
        if (r.source) {
          const { restored } = useStudio.getState().openSource(r.source, r.config, r.name);
          if (!restored && r.message) toast(r.message);
        } else {
          useStudio.getState().replace(r.config, r.name, true);
          if (r.message) toast(r.message);
        }
        if (r.warnings?.length) toast(`Opened with ${r.warnings.length} repair(s)`);
      })
      .catch((error) => !cancelled && setOpening({ state: "failed", error }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, attempt]);
  // Save to GitHub targets the repository a draft belongs to; another design has none
  // (only when the design changes: a host may name its repository a moment before its draft opens)
  const source = useStudio((s) => s.source);
  useEffect(() => {
    const { opened } = getSession();
    if (opened && source !== `github:${opened.repo.full.toLowerCase()}`) setSession({ opened: null });
  }, [source]);
  // shared design links: #/studio?design=<token>
  useEffect(() => {
    if (host) return;
    const pm = /preset=([\w-]+)/.exec(location.hash);
    if (pm) {
      history.replaceState(null, "", "#/studio");
      const st = useStudio.getState();
      st.newDesign(pm[1]);
      const preset = layoutPresets.find((x) => x.id === pm[1]);
      if (preset) useStudio.setState({ name: preset.name });
      return;
    }
    // #/studio?repo=owner/name opens that repository's design (else its README) as its draft,
    // #/studio?config=<https url> any publicly readable config file
    const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
    const repoParam = params.get("repo");
    const cfgUrl = params.get("config");
    if (repoParam) {
      history.replaceState(null, "", "#/studio");
      const repo = parseRepo(repoParam);
      if (!repo) {
        toast("That link does not name a repository");
        return;
      }
      openRepository(repo, webPlatform)
        .then(({ opened, restored }) => {
          if (restored) return; // the banner says it
          toast(opened.warnings.length ? `Opened with ${opened.warnings.length} repair(s)` : openedMessage(opened));
        })
        .catch((e) => toast(openFailure(e, repo.full)));
      return;
    }
    if (cfgUrl) {
      history.replaceState(null, "", "#/studio");
      if (!/^https:\/\//.test(cfgUrl)) {
        toast("That link does not point at a public config");
        return;
      }
      fetch(cfgUrl)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((text) => {
          const { config, warnings } = parseConfig(text);
          useStudio.getState().replace(config, "Imported design", true);
          toast(warnings.length ? `Opened with ${warnings.length} repair(s)` : "Opened the config");
        })
        .catch((e) => toast(`Could not load that config (${(e as Error).message})`));
      return;
    }
    const m = /design=([^&]+)/.exec(location.hash);
    if (!m) return;
    const c = decodeShare(m[1]);
    history.replaceState(null, "", "#/studio");
    if (c) {
      useStudio.getState().replace(c, "Shared design", true);
      toast("Opened a shared design. Your previous design is in All projects.");
    } else toast("That share link is broken or incomplete");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // the theme's colours, offered as swatches in every colour picker
  const theme = useStudio((st) => st.config.theme);
  const previewMode = useStudio((st) => st.mode);
  const swatches = useMemo(() => {
    const p = resolvePalette(theme, previewMode);
    return (["accent", "glow", "accent2", "text", "muted", "subtle", "card", "raised", "border", "bg"] as const).map((k) => ({ label: k === "bg" ? "page" : k, color: String(p[k] ?? "") }));
  }, [theme, previewMode]);
  if (opening.state !== "ready") {
    return (
      <div className="studio-gate">
        {host?.onClose && (
          <IconButton className="studio-gate__close" label="Close" onClick={host.onClose}>
            <X />
          </IconButton>
        )}
        <div className="studio-gate__body" aria-live="polite">
          {opening.state === "loading" ? (
            <p className="studio-gate__loading" role="status">
              <span className="spinner" />
              Opening {host?.context ?? "the design"}…
            </p>
          ) : (
            (host?.failed?.(opening.error, () => setAttempt((n) => n + 1)) ?? <OpenFailed platform={host?.github ?? webPlatform} error={opening.error} retry={() => setAttempt((n) => n + 1)} />)
          )}
        </div>
      </div>
    );
  }
  // selecting on the canvas on phones jumps to the inspector only on explicit request
  return (
    <ThemeSwatchesContext.Provider value={swatches}>
    <div className="studio" data-pane={pane}>
      <TopBar />
      <div className="studio__body">
        <Rail />
        <Canvas />
        <Inspector />
      </div>
      <MobileTabs />
      <DraftBanner />
      <Dialogs />
      <SaveDialog platform={host?.github ?? webPlatform} />
      {!host?.open && !deepLink && <Welcome />}
      <ContextMenuHost />
      {host?.overlays}
    </div>
    </ThemeSwatchesContext.Provider>
  );
}

/**
 * Unsaved changes came back on reopening. Reset goes back to what the source holds (one undoable
 * step); when the source changed since the changes were made, the banner says the draft is out
 * of date.
 */
function DraftBanner() {
  const draft = useStudio((s) => s.restoredDraft);
  const host = useStudioHost();
  const { opened } = useSession();
  if (!draft) return null;
  const { stale, committed } = draft;
  const onDone = () => useStudio.getState().setRestoredDraft(null);
  const context = host?.context ?? opened?.repo.full;
  const where = context ?? "the repository";
  return (
    <div className={cn("draft-banner", stale && "draft-banner--stale")} role="status">
      <p>
        {stale ? (
          <>
            <b>Your unsaved changes are out of date.</b> The design in {where} changed after you made them.
          </>
        ) : (
          <>
            <b>Your unsaved changes are back.</b> They differ from the design in {where}.
          </>
        )}
      </p>
      <div className="draft-banner__actions">
        <Button
          size="sm"
          variant={stale ? "accent" : "secondary"}
          onClick={() => {
            useStudio.getState().resetToSource(committed);
            onDone();
          }}
        >
          <RotateCcw /> Reset changes
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            // keeping them means they now build on what the source holds
            useStudio.getState().rebase(committed);
            onDone();
          }}
        >
          Keep mine
        </Button>
      </div>
    </div>
  );
}
