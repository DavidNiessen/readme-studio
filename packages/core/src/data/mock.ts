import { localParts } from "../lib/astro";
import type { ActivityEvent, ContributionDay, Contributor, Post, ProfileData, ProjectData, Release, Repo, RepoSummary } from "./types";

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (const c of s.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Assign GitHub-like quartile levels to raw counts. */
export function assignLevels(days: ContributionDay[]): void {
  const max = Math.max(1, ...days.map((d) => d.count));
  for (const day of days) {
    day.level = (day.count === 0 ? 0 : Math.min(4, Math.ceil((day.count / max) * 4))) as ContributionDay["level"];
  }
}

/** Realistic-looking calendar: weekday bias, bursts, quiet holidays. */
export function mockWeeks(now = new Date(), seed = 42): ContributionDay[][] {
  const r = rng(seed);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364 - end.getUTCDay());
  const weeks: ContributionDay[][] = [];
  let burst = 0;
  const intensity = 0.7 + r() * 0.6;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd === 0 || !weeks.length) weeks.push([]);
    if (r() < 0.04) burst = 3 + Math.floor(r() * 6);
    const weekend = wd === 0 || wd === 6;
    const base = (weekend ? 0.35 : 0.8) * intensity;
    let count = r() < base ? Math.floor(r() * (weekend ? 5 : 9)) + 1 : 0;
    if (burst > 0) {
      count += 4 + Math.floor(r() * 10);
      burst--;
    }
    const month = d.getUTCMonth();
    if ((month === 7 && d.getUTCDate() > 10 && d.getUTCDate() < 22) || (month === 11 && d.getUTCDate() > 23)) count = 0;
    weeks[weeks.length - 1].push({ date: iso(d), count, level: 0, weekday: wd });
  }
  assignLevels(weeks.flat());
  return weeks;
}

const LANGS = [
  { name: "TypeScript", color: "#3178c6" },
  { name: "Rust", color: "#dea584" },
  { name: "Go", color: "#00ADD8" },
  { name: "Python", color: "#3572A5" },
  { name: "Kotlin", color: "#A97BFF" },
  { name: "Java", color: "#b07219" },
  { name: "JavaScript", color: "#f1e05a" },
  { name: "Swift", color: "#F05138" },
  { name: "C++", color: "#f34b7d" },
  { name: "Shell", color: "#89e051" },
  { name: "CSS", color: "#663399" },
];

const REPO_IDEAS: [string, string][] = [
  ["aurora", "A tiny, fast design-token compiler for multi-brand UI kits"],
  ["kestrel", "Self-hosted uptime monitor with a calm status page"],
  ["fieldnotes", "Markdown-first knowledge base that syncs over git"],
  ["lumen-cli", "Beautiful terminal dashboards from any JSON stream"],
  ["tidepool", "Event-sourced job queue for Postgres, zero extra infra"],
  ["glyphs", "Hand-drawn 16px icon set with an SVG optimiser"],
  ["orbit-ui", "Headless component primitives with first-class a11y"],
  ["patchwork", "Visual diff tool for screenshots in CI"],
  ["quill-sync", "CRDT-powered collaborative text editor core"],
  ["harbor", "Opinionated Kubernetes starter for side projects"],
  ["metronome", "Cron-as-code scheduler with retries and alerts"],
  ["dotfiles", "My terminal, editor and shell setup"],
];

export function mockData(now = new Date(), login = "octocat", name = "Mona Lisa Octocat", timeZone = "UTC", repo?: string): ProfileData {
  const seed = hashSeed(login);
  const r = rng(seed);
  const weeks = mockWeeks(now, seed);
  const days = weeks.flat();
  const total = days.reduce((a, d) => a + d.count, 0);
  const year = localParts(now, timeZone).year;
  const yearTotal = days.filter((d) => d.date.startsWith(`${year}-`)).reduce((a, d) => a + d.count, 0);
  const peak = 11 + Math.floor(r() * 8);
  const hours = Array.from({ length: 24 }, (_, h) =>
    Math.round(40 * Math.exp(-((h - peak) ** 2) / 18) + 22 * Math.exp(-((h - 22) ** 2) / 6) + (h > 8 ? 4 : 1)),
  );
  const t = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
  const langs = [...LANGS].sort(() => r() - 0.5).slice(0, 7);
  let bytes = 2_400_000;
  const languages = langs.map((l) => {
    bytes = Math.round(bytes * (0.45 + r() * 0.35));
    return { ...l, bytes };
  });
  const ideas = [...REPO_IDEAS].sort(() => r() - 0.5);
  const repos: RepoSummary[] = ideas.map(([n, desc], i) => {
    const created = new Date(now.getTime() - (40 + i * 37 + r() * 30) * 86_400_000);
    const pushed = new Date(now.getTime() - (i * 2.5 + r() * 2) * 86_400_000);
    return {
      name: n,
      description: desc,
      url: `https://github.com/${login}/${n}`,
      stars: Math.round(r() ** 2 * 420),
      language: langs[i % langs.length],
      createdAt: created.toISOString(),
      pushedAt: pushed.toISOString(),
    };
  });
  const projects: Repo[] = repos
    .slice(0, 6)
    .map((x) => ({ name: x.name, owner: login, description: x.description, url: x.url, stars: x.stars, forks: Math.round(x.stars * 0.12), language: x.language }))
    .sort((a, b) => b.stars - a.stars);
  const stars = repos.reduce((a, x) => a + x.stars, 0);
  const events: ActivityEvent[] = [
    { kind: "push", repo: repos[0].name, detail: "3 commits → main", time: t(95) },
    { kind: "merge", repo: repos[0].name, detail: "PR #42 merged", time: t(260) },
    { kind: "push", repo: repos[1].name, detail: "1 commit → main", time: t(410) },
    { kind: "release", repo: repos[2].name, detail: "released v0.4.0", time: t(900) },
    { kind: "review", repo: repos[3].name, detail: "reviewed PR #17", time: t(1500) },
    { kind: "create", repo: repos[4].name, detail: "created branch feat/sync", time: t(2900) },
    { kind: "star", repo: "awesome-svg", detail: "starred", time: t(4100) },
  ];
  const releases: Release[] = repos.slice(0, 4).map((x, i) => ({
    repo: x.name,
    tag: `v${1 + (i % 2)}.${Math.floor(r() * 9)}.${Math.floor(r() * 9)}`,
    name: "",
    url: `${x.url}/releases`,
    publishedAt: t(600 + i * 4000 + r() * 2000),
  }));
  const posts: Post[] = [
    ["Rendering animated SVGs that survive GitHub's sanitizer", "What works, what gets stripped and how to test it."],
    ["A year of shipping side projects on weekends", "Notes on scope, energy and finishing things."],
    ["Why I moved my dotfiles to Nix (and back)", "An honest retrospective."],
    ["Designing calm status pages", "Less red, more signal."],
  ].map(([title, summary], i) => ({ title, summary, url: `https://example.com/posts/${i + 1}`, date: t(4000 + i * 13000) }));
  const yearTotals: Record<number, number> = {};
  for (let y = year - 5; y < year; y++) yearTotals[y] = Math.round(300 + r() * 1100 + (y - year + 6) * 120);
  yearTotals[year] = yearTotal;
  const allTimeTotal = Object.values(yearTotals).reduce((a, b) => a + b, 0);
  return {
    source: "mock",
    generatedAt: now.toISOString(),
    login,
    name,
    createdAt: new Date(Date.UTC(year - 6, 6, 14, 10)).toISOString(),
    avatarUrl: `https://github.com/${login}.png`,
    bio: "",
    company: "",
    location: "",
    blog: "",
    followers: 40 + Math.round(r() * 400),
    following: 10 + Math.round(r() * 80),
    repoCount: 18 + Math.round(r() * 40),
    weeks,
    lastYearTotal: total,
    yearTotal,
    allTimeTotal,
    totals: {
      commits: Math.round(total * 0.7),
      pullRequests: 60 + Math.round(r() * 200),
      issues: 20 + Math.round(r() * 60),
      reviews: 40 + Math.round(r() * 220),
      stars,
      forks: Math.round(stars * 0.14),
      privateContributions: Math.round(total * 0.25),
    },
    languages,
    projects,
    repos,
    yearTotals,
    events,
    commitHours: hours,
    weather: { temperature: 3.4 + r() * 18, min: -1.2 + r() * 10, max: 6 + r() * 18, code: [0, 1, 2, 3, 61, 71][Math.floor(r() * 6)], isDay: true, wind: Math.round(4 + r() * 20) },
    releases,
    feeds: { default: posts },
    project: mockProject(repo ?? `${login}/aurora`, now),
  };
}

/** Plausible, deterministic repository data for previews and tests. */
export function mockProject(repo = "octocat/aurora", now = new Date()): ProjectData {
  const [owner, name = "aurora"] = repo.split("/");
  const r = rng(hashSeed(repo));
  const day = 86_400_000;
  const created = new Date(now.getTime() - (420 + Math.floor(r() * 500)) * day);
  const stars = 800 + Math.round(r() ** 1.4 * 9000);
  // S-curve star history with a launch spike
  const points = 40;
  const span = now.getTime() - created.getTime();
  const starHistory = Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const curve = 1 / (1 + Math.exp(-9 * (t - 0.42)));
    const spike = t > 0.3 ? 0.18 : 0;
    return { date: new Date(created.getTime() + span * t).toISOString().slice(0, 10), stars: Math.round(stars * Math.min(1, curve * 0.82 + spike * (t > 0.3 ? 1 : 0))) };
  });
  starHistory[points - 1].stars = stars;
  for (let i = 1; i < points; i++) starHistory[i].stars = Math.max(starHistory[i].stars, starHistory[i - 1].stars);
  const commitWeeks = Array.from({ length: 52 }, (_, i) => {
    const base = 6 + Math.sin(i / 5) * 4 + r() * 10;
    return Math.max(0, Math.round(i > 44 ? base * 1.8 : i % 13 === 0 ? base * 0.2 : base));
  });
  const handles = ["mona", "hubot", "octocat", "linus-t", "ada-l", "grace-h", "kat", "devon", "sam-r", "jun", "priya", "omar", "lea", "noah", "zoe", "ivan", "mei", "tariq"];
  const contributors: Contributor[] = handles.map((login, i) => ({ login, avatar: "", contributions: Math.max(1, Math.round(900 / (i + 1) ** 1.25 + r() * 10)) }));
  const t = (d: number) => new Date(now.getTime() - d * day).toISOString();
  const releases: Release[] = [
    ["v2.4.0", 3, "Faster incremental builds and a new watch mode."],
    ["v2.3.1", 19, "Fixes a regression in nested token references."],
    ["v2.3.0", 41, "Adds design-token aliases and CSS layer output."],
    ["v2.2.0", 77, "Plugin API, typed config and Windows path fixes."],
    ["v2.0.0", 160, "Rewritten core: 6× faster, zero dependencies."],
  ].map(([tag, ago]) => ({ repo: name, tag: tag as string, name: "", url: `https://github.com/${repo}/releases/tag/${tag}`, publishedAt: t(ago as number) }));
  const releaseNotes = Object.fromEntries(
    [
      ["v2.4.0", "Faster incremental builds and a new watch mode."],
      ["v2.3.1", "Fixes a regression in nested token references."],
      ["v2.3.0", "Adds design-token aliases and CSS layer output."],
      ["v2.2.0", "Plugin API, typed config and Windows path fixes."],
      ["v2.0.0", "Rewritten core: 6× faster, zero dependencies."],
    ] as [string, string][],
  );
  const weekly = Array.from({ length: 52 }, (_, i) => Math.round((1800 + i * 160) * (0.85 + r() * 0.3)));
  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
    description: "A tiny, fast design-token compiler for multi-brand UI kits.",
    homepage: `https://${name}.dev`,
    url: `https://github.com/${repo}`,
    topics: ["design-tokens", "css", "typescript", "cli", "build-tool"],
    license: "MIT",
    defaultBranch: "main",
    createdAt: created.toISOString(),
    pushedAt: t(0.2),
    stars,
    forks: Math.round(stars * 0.07),
    watchers: Math.round(stars * 0.02) + 4,
    openIssues: 23 + Math.round(r() * 30),
    closedIssues: 410 + Math.round(r() * 300),
    openPulls: 6 + Math.round(r() * 8),
    mergedPulls: 520 + Math.round(r() * 400),
    size: 4200,
    language: { name: "TypeScript", color: "#3178c6" },
    languages: [
      { name: "TypeScript", color: "#3178c6", bytes: 612_000 },
      { name: "Rust", color: "#dea584", bytes: 188_000 },
      { name: "CSS", color: "#663399", bytes: 42_000 },
      { name: "JavaScript", color: "#f1e05a", bytes: 21_000 },
      { name: "Shell", color: "#89e051", bytes: 6_000 },
    ],
    contributors,
    contributorCount: 64,
    commitWeeks,
    lastCommit: { message: "perf: cache resolved aliases between builds", sha: "9f2c1ab", date: t(0.2), author: "mona" },
    releases,
    releaseNotes,
    starHistory,
    ci: { name: "ci", status: "passing", url: `https://github.com/${repo}/actions` },
    milestones: [
      { title: "v2.5: plugin marketplace", open: 7, closed: 15, dueOn: t(-30).slice(0, 10), url: `https://github.com/${repo}/milestone/7` },
      { title: "v3.0: multi-platform output", open: 22, closed: 9, dueOn: t(-120).slice(0, 10), url: `https://github.com/${repo}/milestone/8` },
      { title: "Docs overhaul", open: 3, closed: 27, dueOn: "", url: `https://github.com/${repo}/milestone/6` },
    ],
    downloads: [{ registry: "npm", name, lastWeek: weekly[51], lastMonth: weekly.slice(-4).reduce((a, b) => a + b, 0), total: weekly.reduce((a, b) => a + b, 0) * 3, weekly, version: "2.4.0" }],
  };
}
