import { age, daysAlive, daysUntilBirthday, monthName, pad2, parseBirthday, yearProgress, zoneAbbr } from "../lib/astro";
import { esc, groupDigits } from "../lib/escape";
import { card, cardStroke, fitText, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { onAccent } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 840;
const FS = 14;
const LH = 22;
const X0 = 28;
const BAR = 36;
const STATUS = 28;
const MAX_LINES = 40;

// ------------------------------------------------------------ markup

/** A run of text in one style. */
interface Seg {
  text: string;
  cls: string;
  bold: boolean;
}

const STYLE: Record<string, string> = { a: "a", m: "m", s: "str", n: "num", t: "t" };

/** Values for the {placeholders} users can put into titles, commands and output. */
export function terminalVars(ctx: Ctx, stack: string[] = [], o: Record<string, unknown> = {}): Record<string, string | Seg[]> {
  const { data, d, now } = ctx;
  // the terminal's own values first, then what GitHub and the rest of the design say
  const own = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
  const p = {
    ...ctx.profile,
    name: own("name") || ctx.profile.name,
    company: own("company") || ctx.profile.company,
    pronouns: own("pronouns") || ctx.profile.pronouns,
    birthday: own("birthday") || ctx.profile.birthday,
    roles: own("role") ? [own("role"), ...ctx.profile.roles.filter((r) => r !== own("role"))] : ctx.profile.roles,
  };
  const yp = yearProgress(now);
  const bday = /^\d{4}-\d{2}-\d{2}$/.test(p.birthday) ? parseBirthday(p.birthday) : null;
  const created = data.createdAt ? new Date(data.createdAt) : null;
  const validCreated = created && !Number.isNaN(created.getTime()) ? created : null;
  const accountDays = validCreated ? Math.max(0, Math.floor((ctx.date.getTime() - validCreated.getTime()) / 86_400_000)) : null;
  const accountYears = accountDays === null ? null : Math.floor(accountDays / 365.25);
  const until = bday ? daysUntilBirthday(bday, now) : null;
  const stars = data.totals.stars ?? data.repos.reduce((a, r) => a + r.stars, 0);
  let uptimeNote = "";
  if (until !== null) uptimeNote = until === 0 ? "level-up today, happy birthday!" : `next level-up in ${until} day${until === 1 ? "" : "s"}`;
  else if (validCreated) uptimeNote = `on github since ${validCreated.getUTCFullYear()}`;
  const time = `${pad2(now.hour)}:${pad2(now.minute)}`;
  const date = `${pad2(now.day)}-${monthName(now.month)}-${String(now.year).slice(2)}`;
  const company = (p.company || data.company || "").replace(/^@/, "").trim();
  const stackSegs: Seg[] = stack.flatMap((s, i) => [
    { text: s, cls: i % 3 === 0 ? "a" : "t", bold: false },
    { text: "  ", cls: "m", bold: false },
  ]);
  stackSegs.pop();
  return {
    name: p.name || data.name || p.login,
    login: p.login,
    city: p.location.city,
    company,
    role: p.roles[0] ?? "",
    roles: p.roles.join(" · "),
    bio: p.bio || data.bio,
    pronouns: p.pronouns,
    year: String(now.year),
    age: bday ? String(age(bday, now)) : "",
    days_alive: bday ? groupDigits(daysAlive(bday, now)) : "",
    until_birthday: until === null ? "" : String(until),
    account_age: accountYears === null ? "" : String(accountYears),
    account_days: accountDays === null ? "" : groupDigits(accountDays),
    since: validCreated ? String(validCreated.getUTCFullYear()) : "",
    uptime_days: bday ? groupDigits(daysAlive(bday, now)) : accountDays === null ? "" : groupDigits(accountDays),
    uptime_note: uptimeNote,
    followers: groupDigits(data.followers),
    stars: groupDigits(stars),
    repos: groupDigits(data.repoCount),
    streak: String(d.streaks.current),
    longest: String(d.streaks.longest),
    contributions: groupDigits(data.lastYearTotal),
    year_contributions: groupDigits(data.yearTotal),
    year_pct: (yp.fraction * 100).toFixed(1),
    day_of_year: String(yp.dayOfYear),
    time,
    date,
    clock: `${time} ${date}`,
    tz: zoneAbbr(ctx.date, p.location.timezone),
    stack: stackSegs,
  };
}

const TOKEN = /\{(\/|[amsntb]|[a-z_]+(?:\|(?:lower|upper))?)\}/g;

function lookup(vars: Record<string, string | Seg[]>, token: string): string | Seg[] | undefined {
  const [key, mod] = token.split("|");
  const v = vars[key];
  if (v === undefined || typeof v !== "string") return v;
  return mod === "lower" ? v.toLowerCase() : mod === "upper" ? v.toUpperCase() : v;
}

/**
 * Parse the tiny output markup into styled runs.
 * `{a}` accent, `{m}` muted, `{s}` string, `{n}` number, `{t}` text colour, `{b}` bold, `{/}` reset.
 * `{name}` style placeholders are filled from `vars`; `{? … ?}` is dropped when a placeholder inside it is empty.
 */
export function parseMarkup(src: string, vars: Record<string, string | Seg[]>, base = "t"): Seg[] {
  const text = src.replace(/\{\?([\s\S]*?)\?\}/g, (_, inner: string) => {
    for (const m of inner.matchAll(TOKEN)) {
      if (STYLE[m[1]] || m[1] === "b" || m[1] === "/") continue;
      const v = lookup(vars, m[1]);
      if (v !== undefined && (typeof v === "string" ? v.trim() === "" : v.length === 0)) return "";
    }
    return inner;
  });
  const segs: Seg[] = [];
  let cls = base;
  let bold = false;
  const push = (s: string, c = cls, b = bold) => {
    if (!s) return;
    const last = segs[segs.length - 1];
    if (last && last.cls === c && last.bold === b) last.text += s;
    else segs.push({ text: s, cls: c, bold: b });
  };
  let at = 0;
  for (const m of text.matchAll(TOKEN)) {
    push(text.slice(at, m.index));
    at = (m.index ?? 0) + m[0].length;
    const tok = m[1];
    if (tok === "/") {
      cls = base;
      bold = false;
    } else if (tok === "b") bold = true;
    else if (STYLE[tok]) cls = STYLE[tok];
    else {
      const v = lookup(vars, tok);
      if (v === undefined) push(m[0]);
      else if (typeof v === "string") push(v);
      else v.forEach((s) => push(s.text, s.cls, s.bold || bold));
    }
  }
  push(text.slice(at));
  return segs;
}

const segW = (t: Theme, s: Seg) => textWidth(t, s.text, FS, { bold: s.bold });

/** Greedy word wrap over styled runs; continuation lines get a two-space hanging indent. */
export function wrapSegs(t: Theme, segs: Seg[], max: number, maxLines: number): Seg[][] {
  const pieces: Seg[] = segs.flatMap((s) => s.text.split(/(\s+)/).filter(Boolean).map((p) => ({ ...s, text: p })));
  const indent: Seg = { text: "  ", cls: "m", bold: false };
  const indentW = segW(t, indent);
  const lines: Seg[][] = [];
  let cur: Seg[] = [];
  let w = 0;
  const hasText = () => cur.some((s) => s !== indent && s.text.trim());
  const flush = () => {
    while (cur.length && !cur[cur.length - 1].text.trim()) cur.pop();
    lines.push(cur);
    cur = [indent];
    w = indentW;
  };
  let cut = false;
  for (const p of pieces) {
    const pw = segW(t, p);
    if (w + pw <= max) {
      cur.push(p);
      w += pw;
      continue;
    }
    if (!p.text.trim()) {
      if (hasText()) flush();
      continue;
    }
    if (hasText()) flush();
    if (lines.length >= maxLines) {
      cut = true;
      break;
    }
    const fitted = fitText(t, p.text, FS, max - w, { bold: p.bold });
    cur.push({ ...p, text: fitted });
    w += segW(t, { ...p, text: fitted });
  }
  if (hasText() && lines.length < maxLines) flush();
  else if (hasText()) cut = true;
  if (cut && lines.length) {
    const tail = lines[lines.length - 1];
    const lw = tail.reduce((a, s) => a + segW(t, s), 0);
    if (lw + textWidth(t, " …", FS) <= max) tail.push({ text: " …", cls: "m", bold: false });
  }
  return lines;
}

function lineMarkup(segs: Seg[], x: number, y: number): string {
  return `<text x="${x}" y="${y}" font-size="${FS}" xml:space="preserve">${segs
    .map((s) => `<tspan class="${s.cls}${s.bold ? " b" : ""}">${esc(s.text)}</tspan>`)
    .join("")}</text>`;
}

// ------------------------------------------------------------ prompt

const PROMPTS = [
  { value: "arrow", label: "➜" },
  { value: "chevron", label: "❯" },
  { value: "dollar", label: "$" },
  { value: "percent", label: "%" },
  { value: "gt", label: ">" },
];

/** Prompt symbol, drawn as a path for glyphs the embedded Latin fonts lack. Returns markup and advance. */
function promptGlyph(t: Theme, kind: string, x: number, y: number): { svg: string; w: number } {
  const s = FS;
  const top = y - s * 0.68;
  const mid = y - s * 0.34;
  const stroke = `stroke="${t.accent}" stroke-width="${(s * 0.15).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  if (kind === "arrow") {
    const w = s * 0.78;
    return {
      svg: `<path d="M${x + 1} ${mid}H${x + w - 1}M${x + w * 0.52} ${top + 0.5}L${x + w - 1} ${mid}L${x + w * 0.52} ${y - 0.5}" ${stroke}/>`,
      w: w + textWidth(t, " ", s),
    };
  }
  if (kind === "chevron") {
    const w = s * 0.5;
    return { svg: `<path d="M${x + 1.5} ${top + 0.5}L${x + w} ${mid}L${x + 1.5} ${y - 0.5}" ${stroke}/>`, w: w + textWidth(t, " ", s) };
  }
  const ch = kind === "dollar" ? "$" : kind === "percent" ? "%" : ">";
  return { svg: `<text x="${x}" y="${y}" font-size="${s}" class="a b">${ch}</text>`, w: textWidth(t, `${ch} `, s, { bold: true }) };
}

// ------------------------------------------------------------ widget

interface Command {
  cmd: string;
  output: string;
}

const DEFAULT_COMMANDS: Command[] = [
  { cmd: "whoami", output: "{b}{name|lower}{/}{?{m} — {role|lower}?}{?{m} @ {a}{b}{company}?}" },
  {
    cmd: "cat profile.json",
    output: [
      `{m}{ {a}"login"{m}: {s}"{login}"{m}{?, {a}"based"{m}: {s}"{city}"?}{?{m}, {a}"pronouns"{m}: {s}"{pronouns}"?}{?{m}, {a}"age"{m}: {n}{age}?}{m},`,
      `{m}  {a}"repos"{m}: {n}{repos}{m}, {a}"followers"{m}: {n}{followers}{m}, {a}"streak"{m}: {n}{streak}{m}, {a}"coffee"{m}: {n}Infinity{m} }`,
    ].join("\n"),
  },
  { cmd: "uptime", output: "{?{m}up {n}{b}{uptime_days}{/}{m} days  ·  ?}{?{t}{uptime_note}{m}  ·  ?}{m}{year} is {t}{year_pct}%{m} done" },
  { cmd: "ls ~/stack", output: "{stack}" },
];

export const terminal = defineWidget({
  type: "terminal",
  title: "Terminal",
  description: "A shell session that types out commands about you, with live placeholders, syntax colours and a tmux-style status bar.",
  scope: "profile",
  category: "Identity",
  kind: "svg",
  width: "full",
  needs: ["calendar"],
  defaults: {
    title: "",
    prompt: "arrow",
    cwd: "~",
    commands: DEFAULT_COMMANDS,
    stack: ["typescript", "react", "node", "python", "go", "docker", "k8s", "postgres", "aws"],
    name: "",
    role: "",
    company: "",
    pronouns: "",
    birthday: "",
    chrome: true,
    statusBar: true,
    tab: "[{login}] 0:zsh*",
    status: "git:main  ·  {followers} followers  ·  {clock}",
  },
  fields: [
    { key: "title", label: "Window title", type: "text", placeholder: "login@city: ~ — zsh" },
    { key: "prompt", label: "Prompt", type: "segmented", options: PROMPTS },
    { key: "cwd", label: "Directory", type: "text", placeholder: "~", max: 24 },
    {
      key: "commands",
      label: "Commands",
      type: "list",
      itemLabel: "Command",
      titleKey: "cmd",
      max: 8,
      newItem: { cmd: "echo hello", output: "hello, {name}!" },
      item: [
        { key: "cmd", label: "Command", type: "text", placeholder: "whoami", max: 80 },
        {
          key: "output",
          label: "Output",
          type: "text",
          multiline: true,
          help: "One line per row. Colours: {a}accent {m}muted {s}string {n}number {b}bold {/}reset. Placeholders: {name} {login} {city} {company} {role} {year} {age} {days_alive} {account_age} {followers} {stars} {repos} {streak} {year_pct} {stack}. Wrap text in {? … ?} to hide it when a placeholder is empty.",
        },
      ],
    },
    { key: "stack", label: "Stack ({stack})", type: "tags", placeholder: "rust", max: 24 },
    { key: "name", label: "Name ({name})", type: "text", placeholder: "Defaults to your GitHub name", max: 80 },
    { key: "role", label: "Role ({role})", type: "text", placeholder: "Defaults to the hero's first role", max: 80 },
    { key: "company", label: "Company ({company})", type: "text", placeholder: "Defaults to your GitHub company", max: 80 },
    { key: "pronouns", label: "Pronouns ({pronouns})", type: "text", placeholder: "they/them", max: 30 },
    { key: "birthday", label: "Birthday ({age})", type: "text", placeholder: "YYYY-MM-DD", max: 10, help: "Optional. Gives {age}, {days_alive} and the uptime line." },
    { key: "chrome", label: "Window chrome", type: "toggle" },
    { key: "statusBar", label: "Status bar", type: "toggle" },
    { key: "tab", label: "Status tab", type: "text", when: { key: "statusBar", is: [true] } },
    { key: "status", label: "Status text", type: "text", when: { key: "statusBar", is: [true] }, help: "Supports the same placeholders, plus {clock}, {time}, {date} and {tz}." },
  ],
  alt: (ctx, o) => `terminal session for ${(typeof o.name === "string" && o.name.trim()) || ctx.profile.name || ctx.profile.login}`,
  href: (ctx) => `https://github.com/${ctx.profile.login}`,
  render(ctx, o) {
    const t = ctx.theme;
    const stack = (Array.isArray(o.stack) ? (o.stack as unknown[]) : []).filter((s): s is string => typeof s === "string" && s.trim() !== "").slice(0, 24);
    const vars = terminalVars(ctx, stack, o);
    const plain = (s: string) =>
      parseMarkup(s, vars)
        .map((x) => x.text)
        .join("");
    const commands = (Array.isArray(o.commands) ? (o.commands as Partial<Command>[]) : [])
      .filter((c) => c && typeof c === "object")
      .slice(0, 8)
      .map((c) => ({ cmd: typeof c.cmd === "string" ? c.cmd : "", output: typeof c.output === "string" ? c.output : "" }));
    const chrome = o.chrome !== false;
    const statusBar = o.statusBar !== false;
    const motion = t.motion !== "off";
    const maxW = W - X0 * 2;

    const cwd = String(o.cwd ?? "~").slice(0, 24);
    const promptAt = (x: number, y: number) => {
      const g = promptGlyph(t, String(o.prompt), x, y);
      const dir = cwd ? `<text x="${(x + g.w).toFixed(1)}" y="${y}" font-size="${FS}" class="m b">${esc(cwd)}</text>` : "";
      return { svg: g.svg + dir, w: g.w + (cwd ? textWidth(t, `${cwd} `, FS, { bold: true }) : 0) };
    };

    const parts: string[] = [];
    let y = chrome ? BAR + 34 : 36;
    let time = 0.5;
    let budget = MAX_LINES;
    commands.forEach((c, bi) => {
      if (budget <= 0) return;
      budget--;
      const p = promptAt(X0, y);
      const cx = X0 + p.w;
      const cmd = fitText(t, plain(c.cmd), FS, W - X0 - cx);
      const chars = [...cmd];
      const typeDur = Math.min(1.6, chars.length * 0.05);
      let typed = `<text x="${cx.toFixed(1)}" y="${y}" font-size="${FS}" class="t" xml:space="preserve">${esc(cmd)}</text>`;
      if (motion && chars.length) {
        const values = chars.map((_, i) => textWidth(t, chars.slice(0, i).join(""), FS).toFixed(1));
        values.push((textWidth(t, cmd, FS) + 2).toFixed(1));
        const id = `cmd${bi}`;
        typed = `<clipPath id="${id}"><rect x="${cx.toFixed(1)}" y="${y - FS - 2}" height="${LH}" width="0"><animate attributeName="width" begin="${(time + 0.15).toFixed(2)}s" dur="${typeDur.toFixed(2)}s" values="${values.join(";")}" calcMode="discrete" fill="freeze"/></rect></clipPath>
<g clip-path="url(#${id})">${typed}</g>`;
      }
      parts.push(`<g class="fade" style="animation-delay:${time.toFixed(2)}s">${p.svg}</g>\n${typed}`);
      time += 0.15 + typeDur + 0.3;
      y += LH;
      const outLines = c.output.split(/\r?\n/).flatMap((raw) => {
        const segs = parseMarkup(raw, vars);
        if (!segs.some((s) => s.text.trim())) return raw.trim() ? [] : [[]];
        return wrapSegs(t, segs, maxW, 4);
      });
      // drop trailing empty rows
      while (outLines.length && !outLines[outLines.length - 1].length) outLines.pop();
      for (const segs of outLines.slice(0, budget)) {
        budget--;
        if (segs.length) parts.push(`<g class="in" style="animation-delay:${time.toFixed(2)}s">${lineMarkup(segs, X0, y)}</g>`);
        time += 0.12;
        y += LH;
      }
      time += 0.25;
      y += 8;
    });
    // final prompt with a blinking block cursor
    const last = promptAt(X0, y);
    const cursorW = textWidth(t, "n", FS);
    parts.push(
      `<g class="fade" style="animation-delay:${time.toFixed(2)}s">${last.svg}<rect x="${(X0 + last.w + 1).toFixed(1)}" y="${y - FS + 1}" width="${cursorW.toFixed(1)}" height="${FS + 3}" rx="1" fill="${t.accent}" class="blink loop"/></g>`,
    );
    const H = y + (statusBar ? STATUS + 22 : 26);

    // window chrome
    const r = t.radius;
    const host = (ctx.profile.location.city || "github").toLowerCase().replace(/\s+/g, "-");
    const titleText = o.title ? plain(String(o.title)) : `${ctx.profile.login.toLowerCase()}@${host}: ${cwd || "~"} — zsh`;
    const barFill = t.surface ? t.raised : "none";
    const chromeMarkup = chrome
      ? `<rect x="0" y="0" width="${W}" height="${BAR}" fill="${barFill}"/>
<path d="M0 ${BAR + 0.5}H${W}" stroke="${t.border}"/>
<circle cx="22" cy="18" r="6" fill="#ff5f57"/><circle cx="42" cy="18" r="6" fill="#febc2e"/><circle cx="62" cy="18" r="6" fill="#28c840"/>
<text x="${W / 2}" y="22.5" text-anchor="middle" font-size="12" class="m">${esc(fitText(t, titleText, 12, W - 200))}</text>`
      : "";

    let statusMarkup = "";
    if (statusBar) {
      const sy = H - STATUS;
      const tab = fitText(t, plain(String(o.tab ?? "")), 12, 320, { bold: true });
      const tabW = tab ? textWidth(t, tab, 12, { bold: true }) + 28 : 0;
      const right = fitText(t, plain(String(o.status ?? "")), 12, W - tabW - 48);
      statusMarkup = `<rect x="0" y="${sy}" width="${W}" height="${STATUS}" fill="${barFill}"/>
<path d="M0 ${sy - 0.5}H${W}" stroke="${t.border}"/>
<rect class="bar" x="0" y="${sy - 1}" width="${W}" height="1.5" fill="url(#accentGrad)"/>
${tab ? `<rect x="0" y="${sy + 0.5}" width="${tabW.toFixed(1)}" height="${STATUS}" fill="${t.accent}"/><text x="14" y="${H - 9.5}" font-size="12" class="b" fill="${onAccent(t)}">${esc(tab)}</text>` : ""}
${right ? `<text x="${W - 16}" y="${H - 9.5}" font-size="12" class="m" text-anchor="end" xml:space="preserve">${esc(right)}</text>` : ""}`;
    }

    const css = `.str{fill:${t.accent2}}.num{fill:${t.glow}}
.bar{transform-box:fill-box;transform-origin:left;animation:growX 1s cubic-bezier(.2,.7,.2,1) .2s both}`;
    const defs = `<clipPath id="win"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${r}"/></clipPath>`;
    const body = `${card(t, { width: W, height: H })}
<g clip-path="url(#win)">${chromeMarkup}${statusMarkup}</g>
${cardStroke(t, W, H)}
${parts.join("\n")}`;
    return svg({ width: W, height: H, theme: t, title: `terminal session for ${vars.name as string}`, css, defs, body });
  },
});
