/**
 * Isomorphic live-data loader (Node 18+ and browsers): GitHub GraphQL when a token
 * is available, the public REST API otherwise, plus Open-Meteo weather and RSS/Atom feeds.
 * Node-only fallbacks (HTML scraping) are injected by the engine through `calendar`/`pinned`.
 */
import { localParts } from "../lib/astro";
import { languageColor } from "./colors";
import { assignLevels } from "./mock";
import type { ActivityEvent, ContributionDay, DataSource, LanguageShare, Post, ProfileData, Release, Repo, RepoSummary, Weather } from "./types";

export interface FetchOptions {
  login: string;
  token?: string;
  timeZone?: string;
  location?: { latitude: number; longitude: number };
  /** feed URLs to fetch for blog widgets */
  feeds?: string[];
  /** which optional sources to fetch (default: all) */
  include?: { weather?: boolean; events?: boolean; hours?: boolean; releases?: boolean };
  now?: Date;
  fetch?: typeof fetch;
  log?: (msg: string) => void;
  /** Node-only fallback for the contribution calendar when no token is available */
  calendar?: (login: string) => Promise<ContributionDay[][]>;
  /** Node-only fallback for pinned repositories when no token is available */
  pinned?: (login: string) => Promise<Repo[]>;
  /** browser-friendly: synthesise a calendar when it cannot be fetched */
  syntheticCalendar?: (login: string) => ContributionDay[][];
  timeoutMs?: number;
}

const LEVELS: Record<string, ContributionDay["level"]> = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

class Http {
  constructor(private o: FetchOptions) {}
  private get f(): typeof fetch {
    return this.o.fetch ?? globalThis.fetch.bind(globalThis);
  }
  async raw(url: string, init: RequestInit = {}): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.o.timeoutMs ?? 20_000);
    try {
      return await this.f(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  headers(auth = true): Record<string, string> {
    return {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(auth && this.o.token ? { authorization: `Bearer ${this.o.token}` } : {}),
    };
  }
  async gh<T>(path: string): Promise<T> {
    const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
    let res = await this.raw(url, { headers: this.headers() });
    if ((res.status === 401 || res.status === 403) && this.o.token) res = await this.raw(url, { headers: this.headers(false) });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return (await res.json()) as T;
  }
  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    if (!this.o.token) throw new Error("no GitHub token for GraphQL");
    const res = await this.raw("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `Bearer ${this.o.token}`, "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (!res.ok || body.errors?.length || !body.data) throw new Error(`GraphQL failed (${res.status}): ${body.errors?.map((e) => e.message).join("; ") ?? "no data"}`);
    return body.data;
  }
  async soft<T>(what: string, p: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await p();
    } catch (e) {
      this.o.log?.(`⚠ ${what}: ${(e as Error).message}`);
      return fallback;
    }
  }
}

// ------------------------------------------------------------ GraphQL

interface GqlRepo {
  name: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  isArchived?: boolean;
  isPrivate?: boolean;
  pushedAt?: string;
  createdAt?: string;
  owner: { login: string };
  primaryLanguage: { name: string; color: string | null } | null;
  languages?: { edges: { size: number; node: { name: string; color: string | null } }[] };
  releases?: { nodes: { tagName: string; name: string | null; url: string; publishedAt: string | null; isPrerelease: boolean; isDraft: boolean }[] };
}

interface MainQuery {
  user: {
    name: string | null;
    login: string;
    createdAt: string;
    avatarUrl: string;
    bio: string | null;
    company: string | null;
    location: string | null;
    websiteUrl: string | null;
    followers: { totalCount: number };
    following: { totalCount: number };
    pullRequests: { totalCount: number };
    issues: { totalCount: number };
    contributionsCollection: {
      contributionYears: number[];
      totalCommitContributions: number;
      totalPullRequestReviewContributions: number;
      restrictedContributionsCount: number;
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: { date: string; contributionCount: number; contributionLevel: string; weekday: number }[] }[];
      };
    };
    repositories: { totalCount: number; nodes: GqlRepo[] };
    pinnedItems: { nodes: GqlRepo[] };
  };
}

const REPO_FIELDS = `name description url stargazerCount forkCount isArchived isPrivate pushedAt createdAt owner{login} primaryLanguage{name color}`;

const MAIN_QUERY = `query($login:String!){
  user(login:$login){
    name login createdAt avatarUrl bio company location websiteUrl
    followers{totalCount} following{totalCount}
    pullRequests{totalCount} issues{totalCount}
    contributionsCollection{
      contributionYears totalCommitContributions totalPullRequestReviewContributions restrictedContributionsCount
      contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount contributionLevel weekday } } }
    }
    repositories(first:100, ownerAffiliations:OWNER, isFork:false, privacy:PUBLIC, orderBy:{field:PUSHED_AT, direction:DESC}){
      totalCount
      nodes{ ${REPO_FIELDS}
        languages(first:10, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name color } } }
        releases(first:2, orderBy:{field:CREATED_AT, direction:DESC}){ nodes{ tagName name url publishedAt isPrerelease isDraft } }
      }
    }
    pinnedItems(first:6, types:REPOSITORY){ nodes{ ... on Repository { ${REPO_FIELDS} } } }
  }
}`;

function toSummary(r: GqlRepo): RepoSummary {
  return {
    name: r.name,
    description: r.description ?? "",
    url: r.url,
    stars: r.stargazerCount,
    language: r.primaryLanguage ? { name: r.primaryLanguage.name, color: languageColor(r.primaryLanguage.name, r.primaryLanguage.color) } : null,
    createdAt: r.createdAt ?? "",
    pushedAt: r.pushedAt ?? "",
  };
}

function toRepo(r: GqlRepo): Repo {
  return {
    name: r.name,
    owner: r.owner.login,
    description: r.description ?? "",
    url: r.url,
    stars: r.stargazerCount,
    forks: r.forkCount,
    language: r.primaryLanguage ? { name: r.primaryLanguage.name, color: languageColor(r.primaryLanguage.name, r.primaryLanguage.color) } : null,
  };
}

/** Privacy guard: only public repositories may ever be named in the README. */
export function publicRepos<T extends { isPrivate?: boolean } | null | undefined>(nodes: T[]): NonNullable<T>[] {
  return nodes.filter((r): r is NonNullable<T> => !!r && r.isPrivate !== true);
}

export function aggregateLanguages(repos: GqlRepo[]): LanguageShare[] {
  const map = new Map<string, LanguageShare>();
  for (const r of repos) {
    for (const e of r.languages?.edges ?? []) {
      const cur = map.get(e.node.name) ?? { name: e.node.name, color: languageColor(e.node.name, e.node.color), bytes: 0 };
      cur.bytes += e.size;
      map.set(e.node.name, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.bytes - a.bytes);
}

export function sumYear(weeks: ContributionDay[][], year: number): number {
  return weeks
    .flat()
    .filter((d) => d.date.startsWith(`${year}-`))
    .reduce((a, d) => a + d.count, 0);
}

// ------------------------------------------------------------ REST

interface RestEvent {
  type: string;
  public?: boolean;
  repo: { name: string };
  created_at: string;
  payload: {
    action?: string;
    ref?: string;
    ref_type?: string;
    size?: number;
    commits?: unknown[];
    pull_request?: { number: number; merged?: boolean };
    issue?: { number: number };
    release?: { tag_name: string };
  };
}

export function mapEvent(e: RestEvent): ActivityEvent | null {
  const repo = e.repo.name.split("/")[1] ?? e.repo.name;
  const time = e.created_at;
  const p = e.payload ?? {};
  switch (e.type) {
    case "PushEvent": {
      const n = p.size ?? p.commits?.length ?? 1;
      const branch = (p.ref ?? "").replace("refs/heads/", "") || "main";
      return { kind: "push", repo, detail: `${n} commit${n === 1 ? "" : "s"} → ${branch}`, time };
    }
    case "PullRequestEvent": {
      const n = p.pull_request?.number ?? 0;
      if (p.action === "closed" && p.pull_request?.merged) return { kind: "merge", repo, detail: `PR #${n} merged`, time };
      return { kind: "pr", repo, detail: `PR #${n} ${p.action ?? "updated"}`, time };
    }
    case "PullRequestReviewEvent":
      return { kind: "review", repo, detail: `reviewed PR #${p.pull_request?.number ?? 0}`, time };
    case "IssuesEvent":
      return { kind: "issue", repo, detail: `issue #${p.issue?.number ?? 0} ${p.action ?? ""}`.trim(), time };
    case "ReleaseEvent":
      return { kind: "release", repo, detail: `released ${p.release?.tag_name ?? ""}`.trim(), time };
    case "CreateEvent":
      return { kind: "create", repo, detail: `created ${p.ref_type ?? "repo"}${p.ref ? ` ${p.ref}` : ""}`, time };
    case "WatchEvent":
      return { kind: "star", repo, detail: "starred", time };
    case "ForkEvent":
      return { kind: "fork", repo, detail: "forked", time };
    default:
      return null;
  }
}

interface RestRepo {
  name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived?: boolean;
  private?: boolean;
  language: string | null;
  created_at: string;
  pushed_at: string;
}

interface RestUser {
  login: string;
  name: string | null;
  created_at: string;
  followers: number;
  following: number;
  public_repos: number;
  avatar_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
}

// ------------------------------------------------------------ extras

interface OpenMeteo {
  current: { temperature_2m: number; weather_code: number; is_day: number; wind_speed_10m: number };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
}

async function fetchWeather(http: Http, loc: { latitude: number; longitude: number }, tz: string): Promise<Weather> {
  const res = await http.raw(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
      `&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=${encodeURIComponent(tz)}&forecast_days=1`,
  );
  if (!res.ok) throw new Error(`open-meteo → ${res.status}`);
  const w = (await res.json()) as OpenMeteo;
  return {
    temperature: w.current.temperature_2m,
    code: w.current.weather_code,
    isDay: w.current.is_day === 1,
    wind: w.current.wind_speed_10m,
    min: w.daily.temperature_2m_min[0],
    max: w.daily.temperature_2m_max[0],
  };
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Minimal RSS 2.0 / Atom parser: title, link, date and a summary per item. */
export function parseFeed(xml: string, max = 10): Post[] {
  const items = xml.match(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/g) ?? [];
  return items.slice(0, max).map((it) => {
    const tag = (name: string) => new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(it)?.[1] ?? "";
    const link = /<link\b[^>]*href="([^"]+)"/i.exec(it)?.[1] ?? decode(tag("link"));
    const date = tag("pubDate") || tag("published") || tag("updated") || tag("dc:date");
    const parsed = date ? new Date(decode(date)) : null;
    const summary = decode(tag("description") || tag("summary") || tag("content")).slice(0, 280);
    return { title: decode(tag("title")) || "Untitled", url: link.trim(), date: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : "", summary };
  });
}

async function fetchFeed(http: Http, url: string): Promise<Post[]> {
  const res = await http.raw(url, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
  if (!res.ok) throw new Error(`feed ${url} → ${res.status}`);
  return parseFeed(await res.text());
}

// ------------------------------------------------------------ main

/** Load everything the widgets can display. Throws only if the user cannot be found at all. */
export async function fetchProfileData(o: FetchOptions): Promise<ProfileData> {
  const http = new Http(o);
  const now = o.now ?? new Date();
  const tz = o.timeZone ?? "UTC";
  const inc = { weather: true, events: true, hours: true, releases: true, ...o.include };
  const login = o.login;
  let source: DataSource;
  let base: Omit<ProfileData, "weather" | "generatedAt" | "feeds" | "events" | "commitHours" | "source">;
  let ownedRefs: { owner: string; name: string }[] = [];
  let releases: Release[] = [];

  let gql: MainQuery["user"] | null = null;
  if (o.token) gql = await http.soft("graphql", async () => (await http.graphql<MainQuery>(MAIN_QUERY, { login })).user, null);

  if (gql) {
    source = "graphql";
    const user = gql;
    const cc = user.contributionsCollection;
    const weeks: ContributionDay[][] = cc.contributionCalendar.weeks.map((w) =>
      w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0, weekday: d.weekday })),
    );
    const years = await http.soft(
      "year totals",
      async () => {
        if (!cc.contributionYears.length) return {} as Record<number, number>;
        const parts = cc.contributionYears.map(
          (y) => `y${y}: contributionsCollection(from:"${y}-01-01T00:00:00Z", to:"${y}-12-31T23:59:59Z"){ contributionCalendar{ totalContributions } }`,
        );
        const data = await http.graphql<{ user: Record<string, { contributionCalendar: { totalContributions: number } }> }>(
          `query($login:String!){ user(login:$login){ ${parts.join("\n")} } }`,
          { login },
        );
        return Object.fromEntries(cc.contributionYears.map((y) => [y, data.user[`y${y}`].contributionCalendar.totalContributions]));
      },
      {} as Record<number, number>,
    );
    const thisYear = localParts(now, tz).year;
    const owned = publicRepos(user.repositories.nodes);
    ownedRefs = owned.map((r) => ({ owner: r.owner.login, name: r.name }));
    const pinned = publicRepos(user.pinnedItems.nodes).filter((r) => r.name && r.name.toLowerCase() !== login.toLowerCase());
    const projects = (pinned.length ? pinned : [...owned].filter((r) => !r.isArchived && r.name.toLowerCase() !== login.toLowerCase()).sort((a, b) => b.stargazerCount - a.stargazerCount))
      .slice(0, 6)
      .map(toRepo);
    releases = owned
      .flatMap((r) =>
        (r.releases?.nodes ?? [])
          .filter((x) => !x.isDraft && x.publishedAt)
          .map((x) => ({ repo: r.name, tag: x.tagName, name: x.name ?? "", url: x.url, publishedAt: x.publishedAt! })),
      )
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 12);
    const allTime = Object.values(years).reduce((a, b) => a + b, 0);
    base = {
      login: user.login,
      name: user.name || user.login,
      createdAt: user.createdAt,
      avatarUrl: user.avatarUrl,
      bio: user.bio ?? "",
      company: user.company ?? "",
      location: user.location ?? "",
      blog: user.websiteUrl ?? "",
      followers: user.followers.totalCount,
      following: user.following.totalCount,
      repoCount: user.repositories.totalCount,
      weeks,
      lastYearTotal: cc.contributionCalendar.totalContributions,
      yearTotal: years[thisYear] ?? sumYear(weeks, thisYear),
      allTimeTotal: allTime || cc.contributionCalendar.totalContributions,
      totals: {
        commits: cc.totalCommitContributions,
        pullRequests: user.pullRequests.totalCount,
        issues: user.issues.totalCount,
        reviews: cc.totalPullRequestReviewContributions,
        stars: owned.reduce((a, r) => a + r.stargazerCount, 0),
        forks: owned.reduce((a, r) => a + r.forkCount, 0),
        privateContributions: cc.restrictedContributionsCount,
      },
      languages: aggregateLanguages(owned),
      projects,
      repos: owned.map(toSummary),
      yearTotals: years,
      releases,
    };
  } else {
    const user = await http.gh<RestUser>(`/users/${encodeURIComponent(login)}`);
    const repos = await http.soft("repos", () => http.gh<RestRepo[]>(`/users/${encodeURIComponent(login)}/repos?type=owner&per_page=100&sort=pushed`), [] as RestRepo[]);
    const own = repos.filter((r) => !r.fork && r.private !== true);
    ownedRefs = own.map((r) => ({ owner: r.owner.login, name: r.name }));
    let weeks: ContributionDay[][] = [];
    source = "rest";
    if (o.calendar) {
      weeks = await http.soft("calendar", () => o.calendar!(login), []);
      if (weeks.length) source = "scrape";
    }
    if (!weeks.length && o.syntheticCalendar) weeks = o.syntheticCalendar(login);
    assignLevelsIfMissing(weeks);
    const pinnedScraped = o.pinned ? (await http.soft("pinned", () => o.pinned!(login), [] as Repo[])).filter((r) => r.name.toLowerCase() !== login.toLowerCase()) : [];
    const toRepoRest = (r: RestRepo): Repo => ({
      name: r.name,
      owner: r.owner.login,
      description: r.description ?? "",
      url: r.html_url,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language ? { name: r.language, color: languageColor(r.language) } : null,
    });
    const langCount = new Map<string, number>();
    own.forEach((r) => r.language && langCount.set(r.language, (langCount.get(r.language) ?? 0) + 1));
    const total = weeks.flat().reduce((a, d) => a + d.count, 0);
    const thisYear = localParts(now, tz).year;
    if (inc.releases) {
      const lists = await Promise.all(
        own.slice(0, 8).map((r) =>
          http.soft(`releases ${r.name}`, () => http.gh<{ tag_name: string; name: string | null; html_url: string; published_at: string | null; draft: boolean }[]>(`/repos/${r.owner.login}/${r.name}/releases?per_page=2`), []),
        ),
      );
      releases = lists
        .flatMap((l, i) => l.filter((x) => !x.draft && x.published_at).map((x) => ({ repo: own[i].name, tag: x.tag_name, name: x.name ?? "", url: x.html_url, publishedAt: x.published_at! })))
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 12);
    }
    base = {
      login: user.login,
      name: user.name || user.login,
      createdAt: user.created_at,
      avatarUrl: user.avatar_url,
      bio: user.bio ?? "",
      company: user.company ?? "",
      location: user.location ?? "",
      blog: user.blog ?? "",
      followers: user.followers,
      following: user.following,
      repoCount: user.public_repos,
      weeks,
      lastYearTotal: total,
      yearTotal: sumYear(weeks, thisYear),
      allTimeTotal: total,
      totals: {
        commits: null,
        pullRequests: null,
        issues: null,
        reviews: null,
        stars: own.reduce((a, r) => a + r.stargazers_count, 0),
        forks: own.reduce((a, r) => a + r.forks_count, 0),
        privateContributions: null,
      },
      languages: [...langCount.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, color: languageColor(name), bytes: n })),
      projects: pinnedScraped.length
        ? pinnedScraped.map((r) => ({ ...r, language: r.language ? { name: r.language.name, color: languageColor(r.language.name, r.language.color) } : null }))
        : own
            .filter((r) => r.name.toLowerCase() !== login.toLowerCase() && !r.archived)
            .sort((a, b) => b.stargazers_count - a.stargazers_count)
            .slice(0, 6)
            .map(toRepoRest),
      repos: own.map((r) => ({
        name: r.name,
        description: r.description ?? "",
        url: r.html_url,
        stars: r.stargazers_count,
        language: r.language ? { name: r.language, color: languageColor(r.language) } : null,
        createdAt: r.created_at,
        pushedAt: r.pushed_at,
      })),
      yearTotals: { [thisYear]: sumYear(weeks, thisYear) },
      releases,
    };
  }

  const [events, commitHours, weather, feedEntries] = await Promise.all([
    inc.events
      ? http.soft(
          "events",
          async () =>
            (await http.gh<RestEvent[]>(`/users/${encodeURIComponent(login)}/events/public?per_page=50`))
              .filter((e) => e.public === true)
              .map(mapEvent)
              .filter((e): e is ActivityEvent => e !== null)
              .slice(0, 10),
          [] as ActivityEvent[],
        )
      : Promise.resolve([] as ActivityEvent[]),
    inc.hours ? http.soft("commit hours", () => commitHoursOf(http, login, ownedRefs, tz, now), null) : Promise.resolve(null),
    inc.weather && o.location ? http.soft("weather", () => fetchWeather(http, o.location!, tz), null) : Promise.resolve(null),
    Promise.all((o.feeds ?? []).filter(Boolean).map(async (url) => [url, await http.soft(`feed ${url}`, () => fetchFeed(http, url), [] as Post[])] as const)),
  ]);
  return {
    ...base,
    source,
    generatedAt: now.toISOString(),
    events,
    commitHours,
    weather,
    feeds: Object.fromEntries(feedEntries),
  };
}

function assignLevelsIfMissing(weeks: ContributionDay[][]): void {
  const days = weeks.flat();
  if (days.some((d) => d.count > 0) && days.every((d) => d.level === 0)) assignLevels(days);
}

async function commitHoursOf(http: Http, login: string, repos: { owner: string; name: string }[], tz: string, now: Date): Promise<number[] | null> {
  const hours = new Array(24).fill(0);
  const since = new Date(now.getTime() - 365 * 86_400_000).toISOString();
  let total = 0;
  const lists = await Promise.all(
    repos.slice(0, 8).map((r) =>
      http.soft(`commits ${r.name}`, () => http.gh<{ commit: { author: { date: string } } }[]>(`/repos/${r.owner}/${r.name}/commits?author=${encodeURIComponent(login)}&since=${since}&per_page=100`), []),
    ),
  );
  for (const commits of lists) {
    for (const c of commits) {
      hours[localParts(new Date(c.commit.author.date), tz).hour]++;
      total++;
    }
  }
  return total >= 10 ? hours : null;
}
