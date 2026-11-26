/** Node-only fallbacks that read public github.com HTML (no API token required). */
import type { ContributionDay, Repo } from "@readme-studio/core";

const UA = "readme-studio (+https://github.com/DavidNiessen/readme-generator)";

/**
 * Parse the public contributions calendar HTML (github.com/users/<login>/contributions).
 * Cells look like `<td data-date="2025-11-23" id="contribution-day-component-0-0" data-level="0">`
 * and counts live in `<tool-tip for="contribution-day-component-0-0">3 contributions on …</tool-tip>`.
 */
export function parseContributionsHtml(html: string): ContributionDay[][] {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = /^(\d[\d,]*)\s+contribution/.exec(m[2].trim());
    counts.set(m[1], n ? Number(n[1].replace(/,/g, "")) : 0);
  }
  const days: ContributionDay[] = [];
  for (const m of html.matchAll(/<td\b[^>]*class="ContributionCalendar-day"[^>]*>/g)) {
    const tag = m[0];
    const date = /data-date="([\d-]+)"/.exec(tag)?.[1];
    const id = /id="([^"]+)"/.exec(tag)?.[1];
    const level = Number(/data-level="(\d)"/.exec(tag)?.[1] ?? 0) as ContributionDay["level"];
    if (!date) continue;
    const count = (id ? counts.get(id) : undefined) ?? (level > 0 ? level : 0);
    days.push({ date, count, level, weekday: new Date(`${date}T12:00:00Z`).getUTCDay() });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  const weeks: ContributionDay[][] = [];
  for (const d of days) {
    if (!weeks.length || d.weekday === 0) weeks.push([]);
    weeks[weeks.length - 1].push(d);
  }
  return weeks;
}

function decodeEntities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function countOf(s: string | undefined): number {
  if (!s) return 0;
  const t = s.trim().toLowerCase().replace(/,/g, "");
  return t.endsWith("k") ? Math.round(parseFloat(t) * 1000) : Number(t) || 0;
}

/** Parse the pinned repositories from a GitHub profile page. */
export function parsePinnedHtml(html: string): Repo[] {
  const items = html.split(/class="pinned-item-list-item-content"/).slice(1);
  return items.flatMap((chunk): Repo[] => {
    const end = chunk.indexOf("</li>");
    const s = end >= 0 ? chunk.slice(0, end) : chunk;
    const href = /href="\/([^/"]+)\/([^/"]+)"/.exec(s);
    if (!href || />\s*Private\s*</.test(s)) return [];
    const desc = /class="pinned-item-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(s)?.[1] ?? "";
    const lang = /itemprop="programmingLanguage">([^<]+)</.exec(s)?.[1];
    const color = /repo-language-color" style="background-color: ([^;"]+)/.exec(s)?.[1] ?? "";
    const stars = /\/stargazers"[\s\S]*?<\/svg>\s*([\d.,k]+)/.exec(s)?.[1];
    const forks = /\/forks"[\s\S]*?<\/svg>\s*([\d.,k]+)/.exec(s)?.[1];
    return [
      {
        owner: href[1],
        name: href[2],
        url: `https://github.com/${href[1]}/${href[2]}`,
        description: decodeEntities(desc.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()),
        stars: countOf(stars),
        forks: countOf(forks),
        language: lang ? { name: lang.trim(), color } : null,
      },
    ];
  });
}

async function getHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { headers: { accept: "text/html", "user-agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function scrapeCalendar(login: string): Promise<ContributionDay[][]> {
  const weeks = parseContributionsHtml(await getHtml(`https://github.com/users/${encodeURIComponent(login)}/contributions`));
  if (!weeks.length) throw new Error("contributions page had no calendar cells");
  return weeks;
}

export async function scrapePinned(login: string): Promise<Repo[]> {
  return parsePinnedHtml(await getHtml(`https://github.com/${encodeURIComponent(login)}`));
}
