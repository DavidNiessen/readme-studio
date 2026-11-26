/**
 * Isomorphic loader for repository data (project READMEs): REST endpoints that work with the
 * Actions GITHUB_TOKEN, without a token, and from the browser (CORS). Every source is optional:
 * a failing call leaves its part empty instead of failing the build.
 */
import { languageColor } from "./colors";
import { fetchFeed, fetchWeather, Http, type FetchOptions } from "./live";
import type { Contributor, Milestone, PackageDownloads, Post, ProfileData, ProjectData, Release } from "./types";

export interface ProjectFetchOptions extends Pick<FetchOptions, "token" | "fetch" | "log" | "timeoutMs"> {
  repo: string;
  packages?: { npm?: string; pypi?: string; crates?: string };
  /** max contributor avatars to embed (0 = none) */
  avatars?: number;
  /** how many stargazer pages to sample for the star history */
  starPages?: number;
}

interface RestRepo {
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  homepage: string | null;
  html_url: string;
  topics?: string[];
  license: { spdx_id: string | null; name: string } | null;
  default_branch: string;
  created_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  subscribers_count?: number;
  watchers_count: number;
  open_issues_count: number;
  size: number;
  language: string | null;
  private?: boolean;
}

/** Number of the last page in a GitHub Link header (1 when absent). */
export function lastPage(link: string | null): number {
  const m = link ? /[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(link) : null;
  return m ? Number(m[1]) : 1;
}

function base64(bytes: Uint8Array): string {
  const B = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(enc: string): string } } }).Buffer;
  if (B) return B.from(bytes).toString("base64");
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Strip markdown to a short plain-text summary (first meaningful lines). */
export function summarizeNotes(body: string, max = 220): string {
  const lines = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^#+\s*/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_`>]/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .trim(),
    )
    .filter((l) => l && !/^(what'?s changed|full changelog|new contributors|changes|changelog)\b/i.test(l));
  const text = lines.slice(0, 3).join(" · ");
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Weekly sums (oldest first) from daily download points. */
function weeklyFromDaily(days: { day: string; downloads: number }[]): number[] {
  const weeks: number[] = [];
  for (let i = days.length; i > 0; i -= 7) weeks.unshift(days.slice(Math.max(0, i - 7), i).reduce((a, d) => a + d.downloads, 0));
  return weeks.slice(-52);
}

async function npmDownloads(http: Http, name: string): Promise<PackageDownloads> {
  const enc = name.startsWith("@") ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
  const [range, latest] = await Promise.all([
    http.raw(`https://api.npmjs.org/downloads/range/last-year/${enc}`).then((r) => (r.ok ? r.json() : null)) as Promise<{ downloads?: { day: string; downloads: number }[] } | null>,
    http.raw(`https://registry.npmjs.org/${enc}/latest`).then((r) => (r.ok ? r.json() : null)) as Promise<{ version?: string } | null>,
  ]);
  const days = range?.downloads ?? [];
  if (!days.length && !latest) throw new Error(`npm package ${name} not found`);
  const sum = (n: number) => days.slice(-n).reduce((a, d) => a + d.downloads, 0);
  return { registry: "npm", name, lastWeek: days.length ? sum(7) : null, lastMonth: days.length ? sum(30) : null, total: days.length ? sum(days.length) : null, weekly: weeklyFromDaily(days), version: latest?.version ?? "" };
}

async function pypiDownloads(http: Http, name: string): Promise<PackageDownloads> {
  const [recent, info] = await Promise.all([
    http.raw(`https://pypistats.org/api/packages/${encodeURIComponent(name.toLowerCase())}/recent`).then((r) => (r.ok ? r.json() : null)) as Promise<{ data?: { last_week: number; last_month: number } } | null>,
    http.raw(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`).then((r) => (r.ok ? r.json() : null)) as Promise<{ info?: { version: string } } | null>,
  ]);
  if (!recent && !info) throw new Error(`PyPI package ${name} not found`);
  return { registry: "pypi", name, lastWeek: recent?.data?.last_week ?? null, lastMonth: recent?.data?.last_month ?? null, total: null, weekly: [], version: info?.info?.version ?? "" };
}

async function cratesDownloads(http: Http, name: string): Promise<PackageDownloads> {
  const res = await http.raw(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`crate ${name} → ${res.status}`);
  const j = (await res.json()) as { crate: { downloads: number; recent_downloads: number | null; max_stable_version?: string; max_version: string } };
  return { registry: "crates", name, lastWeek: null, lastMonth: j.crate.recent_downloads ? Math.round(j.crate.recent_downloads / 3) : null, total: j.crate.downloads, weekly: [], version: j.crate.max_stable_version || j.crate.max_version };
}

/** Load everything project widgets can show. Throws only when the repository cannot be read at all. */
export async function fetchProjectData(o: ProjectFetchOptions): Promise<ProjectData> {
  const http = new Http({ login: "", token: o.token, fetch: o.fetch, log: o.log, timeoutMs: o.timeoutMs });
  const [owner, name] = o.repo.split("/");
  const R = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const repo = await http.gh<RestRepo>(R);
  if (repo.private) throw new Error(`${o.repo} is private; project READMEs only read public repositories`);

  const count = async (q: string) => (await http.gh<{ total_count: number }>(`/search/issues?per_page=1&q=${encodeURIComponent(`repo:${repo.full_name} ${q}`)}`)).total_count;

  const [languages, contributorsRes, contributorCount, commitWeeks, lastCommit, releasesRaw, issues, ci, milestones, starHistory] = await Promise.all([
    http.soft("languages", () => http.gh<Record<string, number>>(`${R}/languages`), {} as Record<string, number>),
    http.soft("contributors", () => http.gh<{ login: string; avatar_url: string; contributions: number; type: string }[]>(`${R}/contributors?per_page=100`), []),
    http.soft(
      "contributor count",
      async () => {
        const res = await http.ghRes(`${R}/contributors?per_page=1&anon=1`);
        if (!res.ok) throw new Error(`contributors → ${res.status}`);
        return lastPage(res.headers.get("link"));
      },
      0,
    ),
    http.soft(
      "commit activity",
      async () => {
        // GitHub computes this lazily and answers 202 until it is ready
        for (let i = 0; i < 4; i++) {
          const res = await http.ghRes(`${R}/stats/commit_activity`);
          if (res.status === 200) return ((await res.json()) as { total: number }[]).map((w) => w.total).slice(-52);
          if (res.status !== 202) throw new Error(`commit activity → ${res.status}`);
          await sleep(1500 * (i + 1));
        }
        return [] as number[];
      },
      [] as number[],
    ),
    http.soft(
      "last commit",
      async () => {
        const [c] = await http.gh<{ sha: string; commit: { message: string; author: { name: string; date: string } }; author: { login: string } | null }[]>(`${R}/commits?per_page=1`);
        return c ? { message: c.commit.message.split("\n")[0], sha: c.sha.slice(0, 7), date: c.commit.author.date, author: c.author?.login ?? c.commit.author.name } : null;
      },
      null,
    ),
    http.soft("releases", () => http.gh<{ tag_name: string; name: string | null; html_url: string; published_at: string | null; draft: boolean; prerelease: boolean; body: string | null }[]>(`${R}/releases?per_page=12`), []),
    http.soft(
      "issue counts",
      async () => {
        const [openIssues, closedIssues, openPulls, mergedPulls] = await Promise.all([count("is:issue is:open"), count("is:issue is:closed"), count("is:pr is:open"), count("is:pr is:merged")]);
        return { openIssues, closedIssues, openPulls, mergedPulls };
      },
      null,
    ),
    http.soft(
      "ci status",
      async () => {
        const j = await http.gh<{ workflow_runs: { name: string; status: string; conclusion: string | null; html_url: string }[] }>(`${R}/actions/runs?per_page=1&exclude_pull_requests=true&branch=${encodeURIComponent(repo.default_branch)}`);
        const r = j.workflow_runs[0];
        if (!r) return null;
        const status = r.status !== "completed" ? "running" : r.conclusion === "success" ? "passing" : r.conclusion === "failure" || r.conclusion === "timed_out" ? "failing" : "unknown";
        return { name: r.name, status, url: r.html_url } as ProjectData["ci"];
      },
      null,
    ),
    http.soft(
      "milestones",
      async () =>
        (await http.gh<{ title: string; open_issues: number; closed_issues: number; due_on: string | null; html_url: string; state: string }[]>(`${R}/milestones?state=all&per_page=20&sort=due_on`))
          .sort((a, b) => (a.state === b.state ? 0 : a.state === "open" ? -1 : 1))
          .slice(0, 10)
          .map((m): Milestone => ({ title: m.title, open: m.open_issues, closed: m.closed_issues, dueOn: m.due_on?.slice(0, 10) ?? "", url: m.html_url })),
      [] as Milestone[],
    ),
    http.soft("star history", () => starHistoryOf(http, R, repo.stargazers_count, o.starPages ?? 10), [] as { date: string; stars: number }[]),
  ]);

  // avatars as data URIs: SVGs served through <img> cannot load external images
  const humans = contributorsRes.filter((c) => c.type !== "Bot" && !c.login.endsWith("[bot]"));
  const contributors: Contributor[] = await Promise.all(
    humans.map(async (c, i) => {
      let avatar = "";
      if (i < (o.avatars ?? 48)) {
        avatar = await http.soft(
          `avatar ${c.login}`,
          async () => {
            const res = await http.raw(`${c.avatar_url}${c.avatar_url.includes("?") ? "&" : "?"}s=64`);
            if (!res.ok) throw new Error(`${res.status}`);
            const type = res.headers.get("content-type") || "image/png";
            return `data:${type};base64,${base64(new Uint8Array(await res.arrayBuffer()))}`;
          },
          "",
        );
      }
      return { login: c.login, avatar, contributions: c.contributions };
    }),
  );

  const published = releasesRaw.filter((r) => !r.draft && r.published_at);
  const releases: Release[] = published.map((r) => ({ repo: repo.name, tag: r.tag_name, name: r.name ?? "", url: r.html_url, publishedAt: r.published_at! }));
  const releaseNotes = Object.fromEntries(published.map((r) => [r.tag_name, summarizeNotes(r.body ?? "")]));

  const pk = o.packages ?? {};
  const downloads = (
    await Promise.all([
      pk.npm ? http.soft(`npm ${pk.npm}`, () => npmDownloads(http, pk.npm!), null) : null,
      pk.pypi ? http.soft(`pypi ${pk.pypi}`, () => pypiDownloads(http, pk.pypi!), null) : null,
      pk.crates ? http.soft(`crates ${pk.crates}`, () => cratesDownloads(http, pk.crates!), null) : null,
    ])
  ).filter((d): d is PackageDownloads => d !== null);

  const langs = Object.entries(languages)
    .map(([n, bytes]) => ({ name: n, color: languageColor(n), bytes }))
    .sort((a, b) => b.bytes - a.bytes);
  const openIssuesFallback = Math.max(0, repo.open_issues_count - (issues?.openPulls ?? 0));

  return {
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description ?? "",
    homepage: repo.homepage ?? "",
    url: repo.html_url,
    topics: repo.topics ?? [],
    license: repo.license ? (repo.license.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : repo.license.name) : "",
    defaultBranch: repo.default_branch,
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.subscribers_count ?? repo.watchers_count,
    openIssues: issues?.openIssues ?? openIssuesFallback,
    closedIssues: issues?.closedIssues ?? 0,
    openPulls: issues?.openPulls ?? 0,
    mergedPulls: issues?.mergedPulls ?? 0,
    size: repo.size,
    language: repo.language ? { name: repo.language, color: languageColor(repo.language) } : null,
    languages: langs,
    contributors,
    contributorCount: Math.max(contributorCount, contributors.length),
    commitWeeks,
    lastCommit,
    releases,
    releaseNotes,
    starHistory: starHistory.length ? starHistory : [{ date: new Date().toISOString().slice(0, 10), stars: repo.stargazers_count }],
    ci,
    milestones,
    downloads,
  };
}

/**
 * Cumulative stars over time, sampled like star-history.com: the stargazer list (with
 * timestamps) is paged, so read the first page plus evenly spread pages and interpolate.
 */
async function starHistoryOf(http: Http, R: string, total: number, maxPages: number): Promise<{ date: string; stars: number }[]> {
  if (total === 0) return [];
  const accept = "application/vnd.github.star+json";
  const first = await http.ghRes(`${R}/stargazers?per_page=100&page=1`, accept);
  if (!first.ok) throw new Error(`stargazers → ${first.status}`);
  const pages = Math.min(lastPage(first.headers.get("link")), 400);
  const firstList = (await first.json()) as { starred_at: string }[];
  const wanted = new Set<number>();
  for (let i = 1; i < maxPages; i++) wanted.add(Math.max(2, Math.round((i / (maxPages - 1)) * pages)));
  wanted.delete(1);
  const lists = await Promise.all(
    [...wanted].filter((p) => p <= pages).map(async (p) => {
      const res = await http.ghRes(`${R}/stargazers?per_page=100&page=${p}`, accept);
      return res.ok ? { page: p, list: (await res.json()) as { starred_at: string }[] } : { page: p, list: [] };
    }),
  );
  const points: { date: string; stars: number }[] = [];
  const add = (page: number, list: { starred_at: string }[]) => {
    if (!list.length) return;
    points.push({ date: list[0].starred_at.slice(0, 10), stars: (page - 1) * 100 + 1 });
    if (page === 1 && list.length > 1) points.push({ date: list[list.length - 1].starred_at.slice(0, 10), stars: list.length });
  };
  add(1, firstList);
  for (const l of lists.sort((a, b) => a.page - b.page)) add(l.page, l.list);
  points.push({ date: new Date().toISOString().slice(0, 10), stars: total });
  // monotonic and unique by date
  const out: { date: string; stars: number }[] = [];
  for (const p of points.sort((a, b) => a.date.localeCompare(b.date))) {
    const prev = out[out.length - 1];
    if (prev && prev.date === p.date) prev.stars = Math.max(prev.stars, p.stars);
    else out.push({ date: p.date, stars: Math.max(p.stars, prev?.stars ?? 0) });
  }
  return out;
}

/** A ProfileData shell with no account numbers (project designs don't show them). */
export function emptyProfileData(login: string, now = new Date()): Omit<ProfileData, "project"> {
  return {
    source: "rest",
    generatedAt: now.toISOString(),
    login,
    name: login,
    createdAt: null,
    avatarUrl: "",
    bio: "",
    company: "",
    location: "",
    blog: "",
    followers: 0,
    following: 0,
    repoCount: 0,
    weeks: [],
    lastYearTotal: 0,
    yearTotal: 0,
    allTimeTotal: 0,
    totals: { commits: null, pullRequests: null, issues: null, reviews: null, stars: null, forks: null, privateContributions: null },
    languages: [],
    projects: [],
    repos: [],
    yearTotals: {},
    events: [],
    commitHours: null,
    weather: null,
    releases: [],
    feeds: {},
  };
}

export interface ProjectBundleOptions extends ProjectFetchOptions {
  login: string;
  timeZone?: string;
  location?: { latitude: number; longitude: number };
  feeds?: string[];
  weather?: boolean;
  now?: Date;
}

/** Everything a project design renders from: repository data plus weather and feeds when used. */
export async function fetchProjectProfile(o: ProjectBundleOptions): Promise<ProfileData> {
  const http = new Http({ login: o.login, token: o.token, fetch: o.fetch, log: o.log, timeoutMs: o.timeoutMs });
  const now = o.now ?? new Date();
  const [project, weather, feedEntries] = await Promise.all([
    fetchProjectData(o),
    o.weather && o.location ? http.soft("weather", () => fetchWeather(http, o.location!, o.timeZone ?? "UTC"), null) : Promise.resolve(null),
    Promise.all((o.feeds ?? []).filter(Boolean).map(async (url) => [url, await http.soft(`feed ${url}`, () => fetchFeed(http, url), [] as Post[])] as const)),
  ]);
  return { ...emptyProfileData(o.login, now), source: o.token ? "graphql" : "rest", weather, feeds: Object.fromEntries(feedEntries), project };
}
