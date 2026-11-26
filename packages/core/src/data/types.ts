export interface ContributionDay {
  /** YYYY-MM-DD */
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  /** 0 = Sunday */
  weekday: number;
}

export interface Repo {
  name: string;
  owner: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: { name: string; color: string } | null;
}

export interface RepoSummary {
  name: string;
  description: string;
  url: string;
  stars: number;
  language: { name: string; color: string } | null;
  /** ISO timestamps */
  createdAt: string;
  pushedAt: string;
}

export interface LanguageShare {
  name: string;
  color: string;
  bytes: number;
}

export type EventKind = "push" | "pr" | "merge" | "issue" | "review" | "release" | "create" | "star" | "fork" | "other";

export interface ActivityEvent {
  kind: EventKind;
  repo: string;
  detail: string;
  /** ISO timestamp */
  time: string;
}

export interface Weather {
  temperature: number;
  min: number;
  max: number;
  /** WMO weather code */
  code: number;
  isDay: boolean;
  wind: number;
}

export interface Release {
  repo: string;
  tag: string;
  name: string;
  url: string;
  /** ISO timestamp */
  publishedAt: string;
}

export interface Post {
  title: string;
  url: string;
  /** ISO timestamp, empty when unknown */
  date: string;
  summary: string;
}

export type DataSource = "graphql" | "rest" | "scrape" | "mock";

export interface ProfileData {
  source: DataSource;
  generatedAt: string;
  login: string;
  name: string;
  createdAt: string | null;
  avatarUrl: string;
  bio: string;
  company: string;
  location: string;
  blog: string;
  followers: number;
  following: number;
  repoCount: number;
  /** last ~53 weeks, Sunday-first weeks, oldest first */
  weeks: ContributionDay[][];
  lastYearTotal: number;
  /** contributions in the current calendar year */
  yearTotal: number;
  /** sum over all contribution years (falls back to lastYearTotal) */
  allTimeTotal: number;
  totals: {
    commits: number | null;
    pullRequests: number | null;
    issues: number | null;
    reviews: number | null;
    stars: number | null;
    forks: number | null;
    privateContributions: number | null;
  };
  languages: LanguageShare[];
  projects: Repo[];
  /** owned, non-fork repositories (most recently pushed first) */
  repos: RepoSummary[];
  /** contributions per calendar year */
  yearTotals: Record<number, number>;
  events: ActivityEvent[];
  /** commits per local hour 0..23, null if unavailable */
  commitHours: number[] | null;
  weather: Weather | null;
  releases: Release[];
  /** feed items fetched for blog widgets, keyed by feed URL */
  feeds: Record<string, Post[]>;
  /** repository data, present for project designs */
  project?: ProjectData;
}

export interface Contributor {
  login: string;
  /** avatar as a data: URI (embedded so it renders inside SVG images), or "" */
  avatar: string;
  contributions: number;
}

export interface Milestone {
  title: string;
  open: number;
  closed: number;
  /** ISO date or "" */
  dueOn: string;
  url: string;
}

export interface PackageDownloads {
  registry: "npm" | "pypi" | "crates";
  name: string;
  /** downloads in the last 7 / 30 days and all time (null when the registry doesn't say) */
  lastWeek: number | null;
  lastMonth: number | null;
  total: number | null;
  /** weekly downloads, oldest first (up to 52) */
  weekly: number[];
  /** latest published version */
  version: string;
}

/** Everything project widgets can show about one repository. */
export interface ProjectData {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  homepage: string;
  url: string;
  topics: string[];
  /** SPDX id or name, "" when none */
  license: string;
  defaultBranch: string;
  createdAt: string;
  pushedAt: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  closedIssues: number;
  openPulls: number;
  mergedPulls: number;
  /** repository size in KB */
  size: number;
  language: { name: string; color: string } | null;
  languages: LanguageShare[];
  contributors: Contributor[];
  contributorCount: number;
  /** commits per week for the last 52 weeks, oldest first */
  commitWeeks: number[];
  lastCommit: { message: string; sha: string; date: string; author: string } | null;
  releases: Release[];
  /** release notes of the latest releases (markdown stripped), keyed by tag */
  releaseNotes: Record<string, string>;
  /** cumulative stars over time, oldest first */
  starHistory: { date: string; stars: number }[];
  /** status of the latest workflow run on the default branch */
  ci: { name: string; status: "passing" | "failing" | "running" | "unknown"; url: string } | null;
  milestones: Milestone[];
  downloads: PackageDownloads[];
}
