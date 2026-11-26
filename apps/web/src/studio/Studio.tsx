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
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { layoutPresets, parseConfig } from "@readme-studio/core";
import { Logo, LogoMark } from "../components/Logo";
import { Button, IconButton, MOD, Menu, Segmented, copyText, useToast } from "../components/ui";
import { findBlock } from "../lib/layout";
import { navigate } from "../lib/router";
import { decodeShare, shareUrl } from "../lib/share";
import { getPref, setPref } from "../lib/storage";
import { useStudio } from "../state/store";
import { Canvas } from "./Canvas";
import { Dialogs } from "./Dialogs";
import { Inspector } from "./Inspector";
import { Rail } from "./Rail";
import { StudioHostContext, useStudioHost, type StudioHost } from "./host";

function SavedIndicator() {
  const savedAt = useStudio((s) => s.savedAt);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((x) => x + 1), 15_000);
    return () => window.clearInterval(t);
  }, []);
  if (!savedAt) return null;
  const s = Math.round((Date.now() - savedAt) / 1000);
  return (
    <span className="saved hide-md" title="Designs are saved in this browser">
      <span className="dot" /> {s < 10 ? "Saved" : s < 60 ? `Saved ${s}s ago` : `Saved ${Math.round(s / 60)}m ago`}
    </span>
  );
}

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

function TopBar() {
  const s = useStudio();
  const toast = useToast();
  const host = useStudioHost();
  const [ui, setUi] = useUiTheme();
  const docs = () => (host?.siteUrl ? window.open(`${host.siteUrl}#/docs`, "_blank", "noopener") : navigate("/docs"));
  return (
    <header className="topbar">
      {host ? (
        <a className="logo" href={host.siteUrl ?? "#"} target="_blank" rel="noopener" aria-label="Readme Studio website">
          <LogoMark />
        </a>
      ) : (
        <Logo compact />
      )}
      <div className="topbar__sep hide-sm" />
      <div className="design-name">
        <input aria-label="Design name" value={s.name} onChange={(e) => s.setName(e.target.value)} onBlur={(e) => !e.target.value.trim() && s.setName("Untitled design")} />
        <SavedIndicator />
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
            <Play />
          </IconButton>
        </div>
      </div>
      <div className="topbar__right">
        <Button variant="ghost" className="hide-md" onClick={() => s.openDialog("presets")}>
          <LayoutTemplate /> Presets
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
            { label: "My designs", icon: <FolderOpen />, onSelect: () => s.openDialog("designs") },
            { label: "Import config", icon: <Upload />, onSelect: () => s.openDialog("import") },
            { label: "Edit as JSON", icon: <FileJson />, onSelect: () => s.openDialog("json") },
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
            { label: "Replay animations", icon: <Play />, shortcut: "R", onSelect: s.replay },
            { label: `App theme: ${ui}`, icon: <SunMoon />, onSelect: () => setUi(ui === "system" ? "dark" : ui === "dark" ? "light" : "system") },
            "sep",
            { label: "Keyboard shortcuts", icon: <Keyboard />, shortcut: "?", onSelect: () => s.openDialog("shortcuts") },
            { label: "Documentation", icon: <BookOpen />, onSelect: docs },
          ]}
        />
        {host?.actions}
        <Button variant={host?.actions ? "secondary" : "accent"} aria-label="Export" onClick={() => s.openDialog("export")}>
          <Download /> <span className="hide-sm">Export</span>
        </Button>
        {host?.onClose && (
          <IconButton label="Close and return" onClick={host.onClose}>
            <X />
          </IconButton>
        )}
      </div>
    </header>
  );
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
      if (mod && k === "d" && sel) {
        e.preventDefault();
        s.duplicate(sel);
        return;
      }
      if (mod) return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault();
        s.remove(sel);
      } else if (e.key === "Escape") s.select(null);
      else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && sel) {
        e.preventDefault();
        s.move(sel, e.key === "ArrowUp" ? -1 : 1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const ids = s.config.layout.flatMap((r) => r.blocks.map((b) => b.id));
        if (!ids.length) return;
        e.preventDefault();
        const i = sel ? ids.indexOf(sel) : -1;
        const j = e.key === "ArrowUp" ? Math.max(0, i - 1) : Math.min(ids.length - 1, i + 1);
        s.select(ids[j]);
      } else if (k === "t") s.setMode(s.mode === "dark" ? "light" : "dark");
      else if (k === "r") s.replay();
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
  return (
    <StudioHostContext.Provider value={host ?? null}>
      <StudioShell />
    </StudioHostContext.Provider>
  );
}

function StudioShell() {
  const pane = useStudio((s) => s.pane);
  const toast = useToast();
  const host = useStudioHost();
  useShortcuts();
  useUiTheme();
  // a host (the browser extension) decides what opens; the website reads its URL
  useEffect(() => {
    if (!host?.open) return;
    let cancelled = false;
    host
      .open()
      .then((r) => {
        if (cancelled || !r) return;
        if (r.source) {
          const { restored } = useStudio.getState().openSource(r.source, r.config, r.name);
          if (restored) toast("Your unsaved changes are back");
        } else useStudio.getState().replace(r.config, r.name, true);
        if (r.warnings?.length) toast(`Opened with ${r.warnings.length} repair(s)`);
      })
      .catch((e) => !cancelled && toast((e as Error).message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);
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
    // #/studio?repo=owner/name opens that repository's committed readme.config.json,
    // #/studio?config=<https url> any config file (both must be publicly readable)
    const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
    const repo = params.get("repo");
    const cfgUrl = params.get("config");
    if (repo || cfgUrl) {
      history.replaceState(null, "", "#/studio");
      const url = repo && /^[\w.-]+\/[\w.-]+$/.test(repo) ? `https://raw.githubusercontent.com/${repo}/HEAD/readme.config.json` : cfgUrl && /^https:\/\//.test(cfgUrl) ? cfgUrl : null;
      if (!url) {
        toast("That link does not point at a public config");
        return;
      }
      fetch(url)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((text) => {
          const { config, warnings } = parseConfig(text);
          useStudio.getState().replace(config, repo ? `${repo} README` : "Imported design", true);
          toast(warnings.length ? `Opened with ${warnings.length} repair(s)` : `Opened ${repo ?? "the config"}`);
        })
        .catch((e) => toast(repo ? `No readme.config.json found in ${repo} (${(e as Error).message})` : `Could not load that config (${(e as Error).message})`));
      return;
    }
    const m = /design=([^&]+)/.exec(location.hash);
    if (!m) return;
    const c = decodeShare(m[1]);
    history.replaceState(null, "", "#/studio");
    if (c) {
      useStudio.getState().replace(c, "Shared design", true);
      toast("Opened a shared design. Your previous design is in My designs.");
    } else toast("That share link is broken or incomplete");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // selecting on the canvas on phones jumps to the inspector only on explicit request
  return (
    <div className="studio" data-pane={pane}>
      <TopBar />
      <div className="studio__body">
        <Rail />
        <Canvas />
        <Inspector />
      </div>
      <MobileTabs />
      <Dialogs />
      {host?.overlays}
    </div>
  );
}
