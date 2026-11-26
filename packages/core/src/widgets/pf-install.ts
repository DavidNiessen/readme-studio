import { esc } from "../lib/escape";
import { card, cardStroke, fitText, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { items, mark, n1, str } from "./kit-c";
import { discreteTimeline, fillStrict, linearTimeline, okColor, pkgNames, repoUrl, xglyph, type PkgNames } from "./kit-f";
import { glyph, onAccent } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 840;
const BAR = 44;
const FS = 14;
const X0 = 28;
const STATUS = 30;
const MAX_TABS = 6;

type Manager = "npm" | "pnpm" | "yarn" | "bun" | "pip" | "uv" | "cargo" | "brew" | "go" | "docker" | "custom";

const MANAGERS: { value: Manager; label: string }[] = [
  { value: "npm", label: "npm" },
  { value: "pnpm", label: "pnpm" },
  { value: "yarn", label: "Yarn" },
  { value: "bun", label: "Bun" },
  { value: "pip", label: "pip" },
  { value: "uv", label: "uv" },
  { value: "cargo", label: "Cargo" },
  { value: "brew", label: "Homebrew" },
  { value: "go", label: "Go" },
  { value: "docker", label: "Docker" },
  { value: "custom", label: "Custom" },
];

interface Tab {
  id: string;
  label: string;
  icon: string;
  cmd: string;
  then: string;
  registry: string;
  verb: string;
  pkg: string;
}

function builtin(m: Exclude<Manager, "custom">, n: PkgNames): Tab {
  const js = { registry: "npm registry", verb: "installed", pkg: n.npm };
  const py = { registry: "PyPI", verb: "installed", pkg: n.pypi };
  const mod = n.pypi.replace(/-/g, "_");
  switch (m) {
    case "npm":
      return { id: m, label: "npm", icon: "npm", cmd: `npm install ${n.npm}`, then: `npx ${n.npm} init`, ...js };
    case "pnpm":
      return { id: m, label: "pnpm", icon: "", cmd: `pnpm add ${n.npm}`, then: `pnpm dlx ${n.npm} init`, ...js };
    case "yarn":
      return { id: m, label: "yarn", icon: "", cmd: `yarn add ${n.npm}`, then: `yarn dlx ${n.npm} init`, ...js };
    case "bun":
      return { id: m, label: "bun", icon: "bun", cmd: `bun add ${n.npm}`, then: `bunx ${n.npm} init`, ...js };
    case "pip":
      return { id: m, label: "pip", icon: "python", cmd: `pip install ${n.pypi}`, then: `python -m ${mod} --help`, ...py };
    case "uv":
      return { id: m, label: "uv", icon: "python", cmd: `uv add ${n.pypi}`, then: `uv run ${n.pypi} --help`, ...py };
    case "cargo":
      return { id: m, label: "cargo", icon: "rust", cmd: `cargo add ${n.crate}`, then: `cargo run --release`, registry: "crates.io", verb: "added", pkg: n.crate };
    case "brew":
      return { id: m, label: "brew", icon: "", cmd: `brew install ${n.bin}`, then: `${n.bin} --version`, registry: "Homebrew", verb: "poured", pkg: n.bin };
    case "go":
      return { id: m, label: "go", icon: "go", cmd: `go install github.com/${n.repo}@latest`, then: `${n.bin} --help`, registry: "Go modules", verb: "installed", pkg: n.bin };
    case "docker":
      return { id: m, label: "docker", icon: "docker", cmd: `docker pull ghcr.io/${n.repo.toLowerCase()}`, then: `docker run --rm -it ghcr.io/${n.repo.toLowerCase()}`, registry: "GHCR", verb: "pulled", pkg: n.bin };
  }
}

/** Small marks for package managers that have no brand icon. */
function tabIcon(t: Theme, tab: Tab, x: number, y: number, size: number, color: string): string {
  if (tab.icon) return mark(t, tab.icon, x, y, size, color, t.raised);
  if (tab.id === "pnpm") {
    const s = size / 3.4;
    const cells = [
      [0, 0],
      [1.2, 0],
      [2.4, 0],
      [2.4, 1.2],
      [1.2, 1.2],
      [1.2, 2.4],
      [0, 2.4],
      [2.4, 2.4],
    ];
    return cells.map(([cx, cy], i) => `<rect x="${n1(x + cx * s)}" y="${n1(y + cy * s)}" width="${n1(s)}" height="${n1(s)}" rx=".6" fill="${color}" fill-opacity="${i > 3 ? 0.55 : 1}"/>`).join("");
  }
  if (tab.id === "yarn") {
    const r = size / 2 - 1;
    const cx = x + size / 2;
    const cy = y + size / 2;
    return `<g stroke="${color}" stroke-width="1.4" fill="none" stroke-linecap="round"><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}"/><path d="M${n1(cx - r * 0.75)} ${n1(cy - r * 0.2)}c${n1(r * 0.7)} ${n1(-r * 0.5)} ${n1(r * 1.3)} ${n1(-r * 0.4)} ${n1(r * 1.6)} ${n1(r * 0.2)}M${n1(cx - r * 0.6)} ${n1(cy + r * 0.45)}c${n1(r * 0.6)} ${n1(-r * 0.5)} ${n1(r * 1.2)} ${n1(-r * 0.4)} ${n1(r * 1.5)} 0M${n1(cx - r * 0.1)} ${n1(cy - r)}c${n1(-r * 0.3)} ${n1(r * 0.7)} ${n1(-r * 0.2)} ${n1(r * 1.4)} ${n1(r * 0.3)} ${n1(r * 1.95)}"/></g>`;
  }
  if (tab.id === "brew") return xglyph("beer", x, y, size, color);
  return glyph("terminal", x, y, size, color);
}

function tabsFor(ctx: Pick<Ctx, "profile" | "data" | "project" | "kind">, o: Record<string, unknown>): Tab[] {
  const n = pkgNames(ctx);
  const picked = (Array.isArray(o.managers) ? (o.managers as unknown[]) : []).filter((m): m is Manager => MANAGERS.some((x) => x.value === m));
  const custom = items(o.custom)
    .map((c) => ({ label: str(c.label).slice(0, 18), cmd: fillStrict(str(c.cmd), ctx), then: fillStrict(str(c.then), ctx) }))
    .filter((c) => c.cmd);
  const tabs: Tab[] = [];
  for (const m of picked) {
    if (m === "custom") {
      for (const c of custom) {
        if (MANAGERS.some((x) => x.value === c.label.toLowerCase() && picked.includes(x.value))) continue;
        tabs.push({ id: "custom", label: c.label || "shell", icon: "", cmd: c.cmd, then: c.then, registry: "", verb: "done", pkg: "" });
      }
      continue;
    }
    const tab = builtin(m, n);
    // a custom entry named after a selected manager replaces its commands
    const over = custom.find((c) => c.label.toLowerCase() === m);
    if (over) Object.assign(tab, { cmd: over.cmd, then: over.then || "" });
    tabs.push(tab);
  }
  if (!tabs.length) tabs.push(builtin("npm", n));
  return tabs.slice(0, MAX_TABS);
}

export const pfInstall = defineWidget({
  type: "install",
  title: "Install command",
  description: "A terminal that types your install command, cycling through package-manager tabs, with a copy button and an optional quick-start line.",
  scope: "project",
  category: "Content",
  kind: "svg",
  width: "full",
  defaults: {
    managers: ["npm", "pnpm", "yarn", "bun"],
    quickStart: true,
    quickStartCmd: "",
    custom: [],
    statusBar: true,
  },
  fields: [
    { key: "managers", label: "Package managers", type: "checklist", options: MANAGERS, max: MAX_TABS, help: "One tab each, typed in turn. Package names come from the project settings and fall back to the repository name." },
    { key: "quickStart", label: "Quick-start line", type: "toggle", help: "A follow-up command such as `npx {npm} init`." },
    { key: "quickStartCmd", label: "Quick-start command", type: "text", placeholder: "Automatic per package manager", when: { key: "quickStart", is: [true] }, help: "Same command on every tab. Placeholders: {npm} {pypi} {crate} {bin} {repo}." },
    {
      key: "custom",
      label: "Custom commands",
      type: "list",
      itemLabel: "Command",
      titleKey: "label",
      max: 6,
      newItem: { label: "curl", cmd: "curl -fsSL https://example.com/install.sh | sh", then: "" },
      help: "Shown as extra tabs when Custom is ticked. An entry labelled like a ticked manager (npm, pip, …) replaces that tab's command.",
      item: [
        { key: "label", label: "Tab label", type: "text", max: 18, placeholder: "curl" },
        { key: "cmd", label: "Command", type: "text", max: 120, placeholder: "curl -fsSL https://… | sh" },
        { key: "then", label: "Then (optional)", type: "text", max: 120, placeholder: "{bin} --help" },
      ],
    },
    { key: "statusBar", label: "Status bar", type: "toggle" },
  ],
  alt: (ctx, o) => {
    const tabs = tabsFor(ctx, o);
    return `Install ${pkgNames(ctx).name}: ${tabs.map((t) => t.cmd).join(" | ")}`;
  },
  href: (ctx) => repoUrl(ctx),
  render(ctx, o) {
    const t = ctx.theme;
    const n = pkgNames(ctx);
    const tabs = tabsFor(ctx, o);
    const quick = o.quickStart !== false;
    const quickOverride = fillStrict(str(o.quickStartCmd), ctx);
    const statusBar = o.statusBar !== false;
    const motion = t.motion !== "off";
    const cycle = t.motion === "full" && tabs.length > 1;

    // ---------------------------------------------------------- tab strip
    const TAB_H = 28;
    const tabY = (BAR - TAB_H) / 2;
    const tabFs = 12.5;
    const tabX0 = 86;
    const geo: { x: number; w: number }[] = [];
    let tx = tabX0;
    const shown: Tab[] = [];
    for (const tab of tabs) {
      const lw = textWidth(t, fitText(t, tab.label, tabFs, 110, { bold: true }), tabFs, { bold: true });
      const w = 14 + 14 + 7 + lw + 14;
      if (tx + w > W - 16) break;
      geo.push({ x: tx, w });
      shown.push(tab);
      tx += w + 4;
    }
    const N = shown.length;

    // ---------------------------------------------------------- body rows
    const promptW = Math.max(20, textWidth(t, "$ ", FS, { bold: true }));
    const copyS = 30;
    const cmdMax = W - X0 - promptW - copyS - 40;
    const y1 = BAR + 36;
    const y2 = y1 + 27;
    const y3 = y2 + 34;
    const lastY = quick && shown.some((tab) => quickOverride || tab.then) ? y3 : y2;
    const H = lastY + 28 + (statusBar ? STATUS : 0);

    // timing per tab (seconds from the start of its slot)
    const CH = 0.055;
    const plan = shown.map((tab) => {
      const cmd = fitText(t, tab.cmd, FS, cmdMax);
      const thenRaw = quick ? quickOverride || tab.then : "";
      const then = thenRaw ? fitText(t, thenRaw, FS, cmdMax - 110) : "";
      const t1 = 0.45;
      const d1 = Math.min(1.7, [...cmd].length * CH);
      const tOut = t1 + d1 + 0.35;
      const t2 = tOut + 0.55;
      const d2 = then ? Math.min(1.5, [...then].length * CH) : 0;
      const end = then ? t2 + d2 : tOut;
      return { cmd, then, t1, d1, tOut, t2, d2, end };
    });
    const slot = Math.max(5.2, ...plan.map((p) => p.end + 2.6));
    const P = cycle ? slot * N : slot;
    const loopAttr = cycle ? `dur="${n1(P)}s" repeatCount="indefinite"` : `dur="${n1(P)}s" fill="freeze"`;
    const begin = 0.35;

    /** A discrete animation whose steps are local to tab i's slot. */
    const anim = (attr: string, i: number, steps: [number, string][], before: string) => {
      const off = cycle ? i * slot : 0;
      const all: [number, string][] = [[0, before], ...steps.map(([s, v]) => [off + s, v] as [number, string])];
      if (cycle) all.push([off + slot, before]);
      const tl = discreteTimeline(P, all);
      return `<animate attributeName="${attr}" begin="${begin}s" ${loopAttr} calcMode="discrete" values="${tl.values}" keyTimes="${tl.keyTimes}"/>`;
    };

    /** Typed text revealed by a clip that widens one glyph at a time. */
    const typed = (i: number, key: string, text: string, x: number, y: number, start: number, cls: string) => {
      const markup = `<text x="${n1(x)}" y="${y}" font-size="${FS}" class="${cls}" xml:space="preserve">${esc(text)}</text>`;
      if (!motion || (!cycle && i > 0)) return markup;
      const chars = [...text];
      const steps: [number, string][] = chars.map((_, k) => [start + k * CH, n1(textWidth(t, chars.slice(0, k + 1).join(""), FS) + 1)]);
      const id = `ty${i}${key}`;
      return `<clipPath id="${id}"><rect x="${n1(x)}" y="${y - FS - 3}" width="0" height="${FS + 9}">${anim("width", i, steps, "0")}</rect></clipPath><g clip-path="url(#${id})">${markup}</g>`;
    };

    /** Something that appears at `at` (and hides again when the slot ends). */
    const appear = (i: number, at: number, inner: string) => {
      if (!motion || (!cycle && i > 0)) return inner;
      return `<g opacity="0">${anim("opacity", i, [[at, "1"]], "0")}${inner}</g>`;
    };

    const ok = okColor(t);
    const panes = shown.map((tab, i) => {
      const p = plan[i];
      const cx = X0 + promptW;
      const prompt = (y: number) => `<text x="${X0}" y="${y}" font-size="${FS}" class="a b">$</text>`;
      const row1 = `${prompt(y1)}${typed(i, "c", p.cmd, cx, y1, p.t1, "t")}`;
      // output: ✓ verb pkg@version
      const ver = n.version && tab.pkg && tab.id !== "docker" && tab.id !== "custom" ? `@${n.version}` : "";
      const outParts = [
        { s: `${tab.verb} `, cls: "m" },
        { s: tab.pkg, cls: "t b" },
        { s: ver, cls: "a2" },
      ].filter((s) => s.s);
      let ox = cx;
      const outText = outParts
        .map((s) => {
          const fitted = fitText(t, s.s, 13, Math.max(20, W - 80 - ox), { bold: s.cls.includes("b") });
          const m = `<text x="${n1(ox)}" y="${y2}" font-size="13" class="${s.cls}" xml:space="preserve">${esc(fitted)}</text>`;
          ox += textWidth(t, fitted, 13, { bold: s.cls.includes("b") });
          return m;
        })
        .join("");
      const row2 = appear(i, p.tOut, `${glyph("check", X0 - 1, y2 - 11.5, 14, ok)}${outText}`);
      let row3 = "";
      let curX = cx + textWidth(t, p.cmd, FS) + 3;
      let curY = y1;
      let curAt = p.t1 + p.d1;
      if (p.then) {
        const tw = textWidth(t, p.then, FS);
        const comment = `<text x="${n1(cx + tw + 26)}" y="${y3}" font-size="12.5" class="s">${esc("# quick start")}</text>`;
        row3 = `${appear(i, p.t2 - 0.25, prompt(y3))}${typed(i, "q", p.then, cx, y3, p.t2, "t")}${appear(i, p.t2 + p.d2 + 0.1, comment)}`;
        curX = cx + tw + 3;
        curY = y3;
        curAt = p.t2 + p.d2;
      }
      const cursorW = textWidth(t, "n", FS);
      const cursor = appear(i, curAt, `<rect x="${n1(curX)}" y="${curY - FS + 1}" width="${n1(cursorW)}" height="${FS + 3}" rx="1" fill="${t.accent}" class="blink loop"/>`);
      const pane = `${row1}${row2}${row3}${cursor}`;
      if (!motion) return i === 0 ? pane : "";
      if (!cycle) return i === 0 ? pane : "";
      return `<g opacity="${i === 0 ? 1 : 0}">${anim("opacity", i, [[0, "1"]], "0")}${pane}</g>`;
    });

    // ---------------------------------------------------------- tab chrome
    const barFill = t.surface ? t.raised : "none";
    const pillRects = (() => {
      const g0 = geo[0];
      if (!g0) return "";
      let ax = "";
      let aw = "";
      let ux = "";
      if (cycle) {
        const sp = ".4 0 .2 1";
        const xs: [number, string][] = [];
        const ws: [number, string][] = [];
        const uxs: [number, string][] = [];
        for (let i = 0; i <= N; i++) {
          const g = geo[i % N];
          const tIn = i * slot;
          const tOut = (i + 1) * slot - 0.4;
          if (i === N) {
            xs.push([P, n1(g.x)]);
            ws.push([P, n1(g.w)]);
            uxs.push([P, n1(g.x + 14)]);
            break;
          }
          xs.push([tIn, n1(g.x)], [tOut, n1(g.x)]);
          ws.push([tIn, n1(g.w)], [tOut, n1(g.w)]);
          uxs.push([tIn, n1(g.x + 14)], [tOut, n1(g.x + 14)]);
        }
        const mk = (attr: string, steps: [number, string][]) => {
          const tl = linearTimeline(P, steps);
          const k = tl.keyTimes.split(";").length - 1;
          return `<animate attributeName="${attr}" begin="${begin}s" dur="${n1(P)}s" repeatCount="indefinite" calcMode="spline" keySplines="${Array(k).fill(sp).join(";")}" values="${tl.values}" keyTimes="${tl.keyTimes}"/>`;
        };
        ax = mk("x", xs);
        aw = mk("width", ws);
        ux = mk("x", uxs) + mk("width", ws.map(([s, v]) => [s, n1(Number(v) - 28)] as [number, string]));
      }
      return `<rect x="${n1(g0.x)}" y="${tabY}" width="${n1(g0.w)}" height="${TAB_H}" rx="${Math.min(8, t.radius)}" fill="${t.surface ? t.card : t.raised}" stroke="${t.border}">${ax}${aw}</rect>
<rect x="${n1(g0.x + 14)}" y="${tabY + TAB_H - 2.5}" width="${n1(g0.w - 28)}" height="2" rx="1" fill="${t.accent}">${ux}</rect>`;
    })();

    const tabMarkup = shown
      .map((tab, i) => {
        const g = geo[i];
        const lab = fitText(t, tab.label, tabFs, 110, { bold: true });
        const ix = g.x + 14;
        const iy = tabY + (TAB_H - 14) / 2;
        const lx = ix + 21;
        const ly = tabY + TAB_H / 2 + tabFs * 0.36;
        const base = `${tabIcon(t, tab, ix, iy, 14, t.muted)}<text x="${n1(lx)}" y="${n1(ly)}" font-size="${tabFs}" class="m b">${esc(lab)}</text>`;
        const active = `${tabIcon(t, tab, ix, iy, 14, tab.icon ? "brand" : t.accent)}<text x="${n1(lx)}" y="${n1(ly)}" font-size="${tabFs}" class="t b">${esc(lab)}</text>`;
        if (!cycle) {
          return i === 0 ? active : `<g opacity=".85">${base}</g>`;
        }
        const on = (() => {
          const sw = 0.2;
          const steps: [number, string][] =
            i === 0
              ? [
                  [0, "1"],
                  [slot - sw, "0"],
                  [P - sw, "1"],
                ]
              : [
                  [0, "0"],
                  [i * slot - sw, "1"],
                  [(i + 1) * slot - sw, "0"],
                ];
          const tl = discreteTimeline(P, steps);
          return `<animate attributeName="opacity" begin="${begin}s" dur="${n1(P)}s" repeatCount="indefinite" calcMode="discrete" values="${tl.values}" keyTimes="${tl.keyTimes}"/>`;
        })();
        const off = on.replace(/values="([^"]*)"/, (_, v: string) => `values="${v.replace(/[01]/g, (d) => (d === "1" ? "0" : "1"))}"`);
        return `<g opacity="${i === 0 ? 0 : 1}">${off}${base}</g><g opacity="${i === 0 ? 1 : 0}">${on}${active}</g>`;
      })
      .join("");

    // ---------------------------------------------------------- copy button
    const bx = W - X0 - copyS;
    const byy = y1 - copyS / 2 - 5;
    let copyIcons = `${xglyph("copy", bx + 8, byy + 8, 14, t.muted)}`;
    if (motion) {
      // "copied" flash after each command is typed
      const flash = shown.map((_, i) => {
        const p = plan[i];
        const off = cycle ? i * slot : 0;
        return [off + p.tOut + 0.5, off + p.tOut + 1.9] as [number, number];
      });
      const vis = (on: string, off: string): string => {
        const steps: [number, string][] = [[0, off]];
        for (const [a, b] of flash.slice(0, cycle ? N : 1)) steps.push([a, on], [b, off]);
        const tl = discreteTimeline(P, steps);
        return `<animate attributeName="opacity" begin="${begin}s" ${loopAttr} calcMode="discrete" values="${tl.values}" keyTimes="${tl.keyTimes}"/>`;
      };
      copyIcons = `<g>${vis("0", "1")}${xglyph("copy", bx + 8, byy + 8, 14, t.muted)}</g><g opacity="0">${vis("1", "0")}${glyph("check", bx + 8, byy + 8, 14, ok)}</g>`;
    }
    const copyBtn = `<g class="fade" style="animation-delay:.3s"><rect x="${bx + 0.5}" y="${byy + 0.5}" width="${copyS - 1}" height="${copyS - 1}" rx="${Math.min(8, t.radius)}" fill="${t.raised}" stroke="${t.border}"/>${copyIcons}</g>`;

    // ---------------------------------------------------------- status bar
    let statusMarkup = "";
    if (statusBar) {
      const sy = H - STATUS;
      const regs = shown.map((s) => s.registry || s.label);
      const regW = Math.max(...regs.map((r) => textWidth(t, fitText(t, r, 11.5, 150, { bold: true }), 11.5, { bold: true }))) + 30;
      const regTexts = regs
        .map((r, i) => {
          const txt = `<text x="${n1(regW / 2)}" y="${H - 10.5}" font-size="11.5" text-anchor="middle" class="b" fill="${onAccent(t)}">${esc(fitText(t, r, 11.5, 150, { bold: true }))}</text>`;
          if (!cycle) return i === 0 ? txt : "";
          const steps: [number, string][] =
            i === 0
              ? [
                  [0, "1"],
                  [slot - 0.2, "0"],
                  [P - 0.2, "1"],
                ]
              : [
                  [0, "0"],
                  [i * slot - 0.2, "1"],
                  [(i + 1) * slot - 0.2, "0"],
                ];
          const tl = discreteTimeline(P, steps);
          return `<g opacity="${i === 0 ? 1 : 0}"><animate attributeName="opacity" begin="${begin}s" dur="${n1(P)}s" repeatCount="indefinite" calcMode="discrete" values="${tl.values}" keyTimes="${tl.keyTimes}"/>${txt}</g>`;
        })
        .join("");
      const right = [n.repo, n.version ? `v${n.version}` : "", n.license ? `${n.license} licence` : ""].filter(Boolean).join("  ·  ");
      statusMarkup = `<rect x="0" y="${sy}" width="${W}" height="${STATUS}" fill="${barFill}"/>
<path d="M0 ${sy - 0.5}H${W}" stroke="${t.border}"/>
<rect x="0" y="${sy + 0.5}" width="${n1(regW)}" height="${STATUS}" fill="${t.accent}"/>${regTexts}
<text x="${W - 16}" y="${H - 10.5}" font-size="11.5" class="m" text-anchor="end">${esc(fitText(t, right, 11.5, W - regW - 48))}</text>`;
    }

    const chrome = `<rect x="0" y="0" width="${W}" height="${BAR}" fill="${barFill}"/>
<path d="M0 ${BAR + 0.5}H${W}" stroke="${t.border}"/>
<circle cx="22" cy="${BAR / 2}" r="6" fill="#ff5f57"/><circle cx="42" cy="${BAR / 2}" r="6" fill="#febc2e"/><circle cx="62" cy="${BAR / 2}" r="6" fill="#28c840"/>`;

    const css = `.a2{fill:${t.accent2}}`;
    const defs = `<clipPath id="win"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${t.radius}"/></clipPath>`;
    const body = `${card(t, { width: W, height: H })}
<g clip-path="url(#win)">${chrome}${statusMarkup}</g>
<g class="fade" style="animation-delay:.1s">${pillRects}${tabMarkup}</g>
${cardStroke(t, W, H)}
${copyBtn}
<g class="fade" style="animation-delay:.2s">${panes.join("\n")}</g>`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
