import { derive } from "../data/derive";
import { groupDigits } from "../lib/escape";
import type { Ctx } from "./types";

/** Placeholder tokens users can type into free text, with a short explanation for help texts. */
export const PLACEHOLDERS: { token: string; help: string }[] = [
  { token: "{name}", help: "display name" },
  { token: "{login}", help: "GitHub username" },
  { token: "{city}", help: "city" },
  { token: "{company}", help: "company" },
  { token: "{role}", help: "first role" },
  { token: "{year}", help: "current year" },
  { token: "{followers}", help: "follower count" },
  { token: "{stars}", help: "stars earned" },
  { token: "{repos}", help: "repository count" },
  { token: "{streak}", help: "current streak in days" },
  { token: "{contributions}", help: "contributions this year" },
  { token: "{project}", help: "project name" },
  { token: "{repo}", help: "owner/repository" },
  { token: "{tagline}", help: "project tagline" },
  { token: "{version}", help: "latest release or package version" },
  { token: "{license}", help: "project licence" },
  { token: "{forks}", help: "repository forks" },
  { token: "{contributors}", help: "contributor count" },
  { token: "{npm}", help: "npm package name" },
  { token: "{pypi}", help: "PyPI package name" },
  { token: "{crate}", help: "crates.io crate name" },
  { token: "{owner}", help: "repository owner" },
];

/** Inspector help text listing the supported placeholders. */
export const PLACEHOLDER_HELP = `Placeholders: ${PLACEHOLDERS.map((p) => p.token).join(" ")}`;

type PlaceholderCtx = Pick<Ctx, "profile"> & Partial<Pick<Ctx, "data" | "d" | "now" | "project" | "kind">>;

/**
 * Replace `{name}`, `{login}`, `{city}`, `{company}`, `{role}`, `{year}`, `{followers}`,
 * `{stars}`, `{repos}`, `{streak}` and `{contributions}` in user text.
 * Tokens are case-insensitive and may contain inner spaces (`{ Name }`); unknown tokens are kept as typed.
 * Values that need profile data are left empty when the context has no data (e.g. while building alt text).
 */
export function fillPlaceholders(text: string, ctx: PlaceholderCtx): string {
  if (typeof text !== "string" || !text.includes("{")) return typeof text === "string" ? text : "";
  const p = ctx.profile;
  const data = ctx.data;
  let derived = ctx.d;
  const streak = () => {
    if (!derived && data) derived = derive(data);
    return derived ? String(derived.streaks.current) : "";
  };
  const pd = data?.project;
  const pi = ctx.project;
  const projectName = () => pi?.name?.trim() || pi?.repo?.split("/")[1] || pd?.name || "";
  const version = () => {
    const tag = pd?.releases?.[0]?.tag || pd?.downloads?.find((d) => d.version)?.version || "";
    return tag ? (tag.startsWith("v") ? tag : `v${tag}`) : "";
  };
  const stars = () => {
    if (ctx.kind === "project" && pd) return groupDigits(pd.stars);
    if (!data) return "";
    const s = data.totals?.stars ?? (data.repos ?? []).reduce((a, r) => a + (r.stars || 0), 0);
    return groupDigits(s);
  };
  const values: Record<string, () => string> = {
    name: () => p?.name || p?.login || "",
    login: () => p?.login || "",
    city: () => p?.location?.city || "",
    company: () => p?.company || "",
    role: () => (p?.roles ?? []).find(Boolean) || "",
    year: () => String(ctx.now?.year ?? new Date().getFullYear()),
    followers: () => (data ? groupDigits(data.followers) : ""),
    stars,
    repos: () => (data ? groupDigits(data.repoCount) : ""),
    streak,
    contributions: () => (data ? groupDigits(data.yearTotal) : ""),
    project: projectName,
    repo: () => pi?.repo || pd?.fullName || "",
    tagline: () => pi?.tagline || pd?.description || "",
    version,
    license: () => pd?.license || "",
    forks: () => (pd ? groupDigits(pd.forks) : ""),
    contributors: () => (pd ? groupDigits(pd.contributorCount) : ""),
    npm: () => pi?.packages?.npm || "",
    pypi: () => pi?.packages?.pypi || "",
    crate: () => pi?.packages?.crates || "",
    owner: () => (pi?.repo || pd?.fullName || "").split("/")[0] || p?.login || "",
  };
  return text.replace(/\{\s*([a-zA-Z]+)\s*\}/g, (m, key: string) => {
    const f = values[key.toLowerCase()];
    return f ? f() : m;
  });
}
