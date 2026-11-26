import { esc } from "../lib/escape";
import { card, fitText, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { items, n1, str } from "./kit-c";
import { dl, emptyState, header, longDate, optPick, optStr } from "./kit-d";
import { okColor, projectData, repoUrl } from "./kit-f";
import { accentDeep } from "./parts";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget, type Ctx } from "./types";

const W = 840;

type Status = "done" | "progress" | "planned";

interface Item {
  title: string;
  pct: number;
  status: Status;
  note: string;
  /** "15 / 22 issues" for GitHub milestones */
  count: string;
  due: string;
  overdue: boolean;
}

const STATUS_LABEL: Record<Status, string> = { done: "Done", progress: "In progress", planned: "Planned" };

const DEFAULT_ITEMS = [
  { title: "v1.0: stable API", progress: 100, status: "done", note: "Frozen public API, migration guide and codemods." },
  { title: "Plugin system", progress: 65, status: "progress", note: "Lifecycle hooks, typed options and a plugin registry." },
  { title: "Windows & ARM builds", progress: 30, status: "progress", note: "Native binaries for every platform in CI." },
  { title: "Web playground", progress: 0, status: "planned", note: "Try it in the browser, share snippets by URL." },
];

function daysBetween(a: Date, isoDay: string): number {
  const d = new Date(`${isoDay.slice(0, 10)}T00:00:00Z`);
  return Math.round((d.getTime() - Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) / 86_400_000);
}

function rows(ctx: Pick<Ctx, "data" | "profile" | "project" | "kind"> & { date?: Date }, o: Record<string, unknown>): { list: Item[]; source: "github" | "manual" } {
  const src = optPick(o.source, ["auto", "github", "manual"], "auto");
  const ms = (projectData(ctx)?.milestones ?? []).filter((m) => m && m.title);
  const now = ctx.date ?? new Date();
  if (src === "github" || (src === "auto" && ms.length)) {
    const hideDone = o.hideDone === true;
    const list = ms
      .map((m): Item => {
        const open = Math.max(0, m.open || 0);
        const closed = Math.max(0, m.closed || 0);
        const total = open + closed;
        const pct = total ? (closed / total) * 100 : 0;
        const status: Status = total && !open ? "done" : closed ? "progress" : "planned";
        const days = m.dueOn ? daysBetween(now, m.dueOn) : null;
        const overdue = days !== null && days < 0 && status !== "done";
        const due = m.dueOn ? (overdue ? `overdue by ${-days!} d` : days === 0 ? "due today" : `due ${longDate(m.dueOn.slice(0, 10))}`) : "";
        return { title: m.title, pct, status, note: "", count: `${closed} / ${total} issue${total === 1 ? "" : "s"}`, due, overdue };
      })
      .filter((m) => !hideDone || m.status !== "done");
    return { list: list.slice(0, 6), source: "github" };
  }
  const list = items(o.items)
    .map((it): Item => {
      const pct = Math.max(0, Math.min(100, Number(it.progress) || 0));
      const st = optPick(it.status, ["done", "progress", "planned", "auto"], "auto");
      const status: Status = st === "auto" ? (pct >= 100 ? "done" : pct > 0 ? "progress" : "planned") : st;
      return { title: fillPlaceholders(str(it.title), ctx), pct: status === "done" ? 100 : pct, status, note: fillPlaceholders(str(it.note), ctx), count: "", due: fillPlaceholders(str(it.due), ctx), overdue: false };
    })
    .filter((it) => it.title)
    .slice(0, 6);
  return { list, source: "manual" };
}

function chip(t: Theme, x: number, y: number, s: Status): { svg: string; w: number } {
  const txt = STATUS_LABEL[s].toUpperCase();
  const w = textWidth(t, txt, 9.5, { bold: true, letterSpacing: 1.1 }) + (s === "planned" ? 16 : 26);
  const ok = okColor(t);
  const c = s === "done" ? ok : s === "progress" ? t.accent : t.muted;
  const dot =
    s === "done"
      ? `<path d="M${n1(x + 8)} ${n1(y + 9.5)}l2.2 2.2 4-4.4" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : s === "progress"
        ? `<circle cx="${n1(x + 11)}" cy="${n1(y + 9.5)}" r="3" fill="${c}"/><circle cx="${n1(x + 11)}" cy="${n1(y + 9.5)}" r="3" fill="${c}" class="ping loop loop-only"/>`
        : "";
  return {
    w,
    svg: `<rect x="${n1(x + 0.5)}" y="${n1(y + 0.5)}" width="${n1(w - 1)}" height="18" rx="9" fill="${s === "planned" ? "none" : c}" fill-opacity="${t.name === "dark" ? 0.12 : 0.08}" stroke="${c}" stroke-opacity=".45"${s === "planned" ? ' stroke-dasharray="3 2"' : ""}/>
${dot}<text x="${n1(x + (s === "planned" ? 8 : 19))}" y="${n1(y + 13)}" font-size="9.5" letter-spacing="1.1" class="b" fill="${s === "planned" ? t.muted : t.name === "dark" ? c : t.text}">${txt}</text>`,
  };
}

export const pfRoadmap = defineWidget({
  type: "roadmap",
  title: "Roadmap",
  description: "Milestones as progress rows with status chips, issue counts and due dates, from GitHub milestones or a list you write.",
  scope: "project",
  category: "Projects",
  kind: "svg",
  width: "full",
  needs: ["project"],
  defaults: { label: "roadmap", source: "auto", hideDone: false, items: DEFAULT_ITEMS },
  fields: [
    { key: "label", label: "Title", type: "text", placeholder: "roadmap" },
    {
      key: "source",
      label: "Source",
      type: "segmented",
      options: [
        { value: "auto", label: "Automatic" },
        { value: "github", label: "GitHub milestones" },
        { value: "manual", label: "My list" },
      ],
      help: "Automatic uses the repository's open milestones when there are any, otherwise your list.",
    },
    { key: "hideDone", label: "Hide finished milestones", type: "toggle", when: { key: "source", is: ["auto", "github"] } },
    {
      key: "items",
      label: "Roadmap items",
      type: "list",
      itemLabel: "Item",
      titleKey: "title",
      max: 6,
      newItem: { title: "Next big thing", progress: 0, status: "planned", note: "" },
      when: { key: "source", is: ["auto", "manual"] },
      item: [
        { key: "title", label: "Title", type: "text", max: 60, help: PLACEHOLDER_HELP },
        { key: "progress", label: "Progress", type: "number", min: 0, max: 100, step: 5, unit: "%" },
        {
          key: "status",
          label: "Status",
          type: "segmented",
          options: [
            { value: "done", label: "Done" },
            { value: "progress", label: "In progress" },
            { value: "planned", label: "Planned" },
          ],
        },
        { key: "note", label: "Note", type: "text", max: 120 },
        { key: "due", label: "When (optional)", type: "text", max: 24, placeholder: "Q2 2026" },
      ],
    },
  ],
  alt: (ctx, o) => {
    const { list } = rows(ctx, o);
    return list.length ? `Roadmap: ${list.map((r) => `${r.title} (${Math.round(r.pct)}%)`).join(", ")}` : "Roadmap";
  },
  href: (ctx, o) => (rows(ctx, o).source === "github" ? `${repoUrl(ctx)}/milestones` : repoUrl(ctx)),
  render(ctx, o) {
    const t = ctx.theme;
    const { list, source } = rows(ctx, o);
    const lbl = optStr(o.label);
    const top = lbl ? 54 : 22;
    const ok = okColor(t);
    let right = "";
    if (list.length && source === "github") {
      const ms = projectData(ctx)?.milestones ?? [];
      const closed = ms.reduce((a, m) => a + (m.closed || 0), 0);
      const total = ms.reduce((a, m) => a + (m.open || 0) + (m.closed || 0), 0);
      right = `${ms.length} milestone${ms.length === 1 ? "" : "s"}  ·  ${closed} of ${total} issues closed`;
    } else if (list.length) {
      const done = list.filter((r) => r.status === "done").length;
      right = `${done} of ${list.length} shipped`;
    }

    if (!list.length) {
      const H = top + 132;
      const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl) : ""}
${emptyState(t, 24, top, W - 48, 104, "calendar", source === "github" ? "No milestones yet" : "Nothing on the roadmap yet", source === "github" ? "Create a milestone on GitHub, or switch the source to your own list." : "Add a few roadmap items in the inspector.")}`;
      return svg({ width: W, height: H, theme: t, title: "Roadmap", body });
    }

    const x = 28;
    const bw = W - x * 2;
    const out: string[] = [];
    let y = top;
    list.forEach((r, i) => {
      const d = 0.2 + i * 0.12;
      const base = y + 16;
      const metaParts = [r.count, r.due].filter(Boolean);
      const pctTxt = `${Math.round(r.pct)}%`;
      const pctW = textWidth(t, pctTxt, 15, { bold: true, heading: true });
      // right block: percentage, then meta to its left
      const meta = metaParts.join("  ·  ");
      const metaMax = 260;
      const metaTxt = meta ? fitText(t, meta, 11.5, metaMax) : "";
      const metaW = metaTxt ? textWidth(t, metaTxt, 11.5) : 0;
      const c = chip(t, 0, 0, r.status);
      const titleMax = bw - pctW - (metaW ? metaW + 20 : 0) - c.w - 30;
      const title = fitText(t, r.title, 14.5, titleMax, { bold: true });
      const tw = textWidth(t, title, 14.5, { bold: true });
      const cx = x + tw + 12;
      const chipSvg = chip(t, cx, base - 13, r.status).svg;
      const overdueCls = r.overdue ? `fill="${t.name === "dark" ? "#f0883e" : "#bc4c00"}"` : 'class="m"';
      const metaMarkup = metaTxt
        ? `<text x="${n1(x + bw - pctW - 14)}" y="${base}" font-size="11.5" text-anchor="end" ${overdueCls}>${esc(metaTxt)}</text>`
        : "";
      // bar
      const by = base + (r.note ? 30 : 14);
      const bh = 8;
      const fw = Math.max(r.pct > 0 ? bh : 0, (bw * r.pct) / 100);
      const fillC = r.status === "done" ? ok : "url(#rmG)";
      const id = `rb${i}`;
      const bar = `<rect x="${x}" y="${by}" width="${bw}" height="${bh}" rx="${bh / 2}" fill="${t.heat[0]}"${r.status === "planned" ? ` stroke="${t.subtle}" stroke-dasharray="3 3"` : ` stroke="${t.border}" stroke-width=".6"`}/>
${fw > 0 ? `<clipPath id="${id}"><rect x="${x}" y="${by}" width="${n1(fw)}" height="${bh}" rx="${bh / 2}"/></clipPath><g clip-path="url(#${id})"><rect x="${x}" y="${by}" width="${n1(fw)}" height="${bh}" fill="${fillC}" class="fill" style="${dl(d + 0.25)}"/>${r.status === "progress" ? `<rect x="${x}" y="${by}" width="80" height="${bh}" fill="url(#shine)" class="sh loop loop-only" style="animation-delay:${(2.2 + i * 0.6).toFixed(1)}s"/>` : ""}</g>` : ""}`;
      out.push(`<g class="in" style="${dl(d)}">
<text x="${x}" y="${base}" font-size="14.5" class="t b">${esc(title)}</text>
${chipSvg}
${metaMarkup}
<text x="${x + bw}" y="${base + 0.5}" font-size="15" text-anchor="end" class="${r.status === "planned" ? "m" : "t"} b h">${pctTxt}</text>
${r.note ? `<text x="${x}" y="${base + 20}" font-size="12.5" class="m">${esc(fitText(t, r.note, 12.5, bw))}</text>` : ""}
${bar}
</g>`);
      y = by + bh + (i < list.length - 1 ? 26 : 0);
    });
    const H = y + 26;
    const css = `
.fill{transform-box:fill-box;transform-origin:left;animation:growX 1.4s cubic-bezier(.2,.7,.2,1) both}
.sh{animation:rmSh 4.2s ease-in-out infinite}
@keyframes rmSh{0%{transform:translateX(-80px)}60%,100%{transform:translateX(${bw + 10}px)}}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2s cubic-bezier(0,0,.2,1) infinite}
@keyframes ping{0%{transform:scale(1);opacity:.8}75%,100%{transform:scale(2.6);opacity:0}}`;
    const defs = `<linearGradient id="rmG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accentDeep(t)}"/><stop offset="1" stop-color="${t.glow}"/></linearGradient>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl, right) : ""}
${out.join("\n")}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
