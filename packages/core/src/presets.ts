import { DEFAULT_OUTPUT, DEFAULT_PROFILE, DEFAULT_PROJECT, normalizeConfig, type Align, type DesignKind, type Profile, type ProjectInfo, type StudioConfig } from "./config";
import { DEFAULT_THEME, type ThemeSettings } from "./theme";

type B = { type: string; id?: string; options?: Record<string, unknown>; link?: string };
type R = B[] | { align: Align; blocks: B[] };

export interface LayoutPreset {
  id: string;
  /** what the preset is for (default: profile) */
  kind?: DesignKind;
  name: string;
  description: string;
  tags: string[];
  theme: Partial<ThemeSettings>;
  rows: R[];
}

const div = (style = "comet"): B[] => [{ type: "divider", options: { style } }];

export const layoutPresets: LayoutPreset[] = [
  {
    id: "command-center",
    name: "Command Center",
    description: "Everything, animated: hero, live stats, a 3D skyline, departure board and project cards. The full show.",
    tags: ["dark-first", "data", "maximal"],
    theme: { preset: "crimson", font: "jetbrains-mono", headingFont: "jetbrains-mono", texture: "dots", radius: 12 },
    rows: [
      [{ type: "hero" }],
      [{ type: "socials" }],
      div(),
      [{ type: "terminal" }],
      [{ type: "stats" }],
      [{ type: "contrib" }],
      [{ type: "pulse" }],
      [{ type: "skyline" }],
      div(),
      [{ type: "now" }],
      [{ type: "stack" }],
      [{ type: "languages" }, { type: "rhythm" }],
      [{ type: "journey" }],
      [{ type: "board" }],
      [{ type: "project", id: "project-1", options: { index: 1 } }, { type: "project", id: "project-2", options: { index: 2 } }],
      [{ type: "project", id: "project-3", options: { index: 3 } }, { type: "project", id: "project-4", options: { index: 4 } }],
      [{ type: "trophies" }, { type: "today" }],
      div(),
      [{ type: "footer" }],
    ],
  },
  {
    id: "minimal-paper",
    name: "Minimal Paper",
    description: "Editorial serif headlines on warm paper. Quiet motion, generous whitespace, all signal.",
    tags: ["light-first", "editorial", "calm"],
    theme: { preset: "paper", font: "inter", headingFont: "fraunces", texture: "none", motion: "subtle", radius: 10 },
    rows: [
      [{ type: "banner", options: { effect: "rise", height: "regular", glow: false, corners: false } }],
      [{ type: "about", options: { monogram: true } }],
      [{ type: "heading", options: { eyebrow: "01 · activity", title: "What I've been up to" } }],
      [{ type: "contrib", options: { beam: false, callout: false, weekly: false } }],
      [{ type: "donut" }, { type: "weekdays" }],
      [{ type: "heading", options: { eyebrow: "02 · work", title: "Things I made" } }],
      [{ type: "repos", options: { count: 4 } }],
      [{ type: "posts" }],
      div("line"),
      [{ type: "footer", options: { waves: false, barcode: false } }],
    ],
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Amber phosphor and a shell that types itself. For people who live in tmux.",
    tags: ["retro", "monospace", "compact"],
    theme: { preset: "amber", font: "ibm-plex-mono", headingFont: "ibm-plex-mono", texture: "lines", radius: 6 },
    rows: [[{ type: "terminal" }], [{ type: "contrib", options: { shape: "square" } }], [{ type: "board" }], [{ type: "footer" }]],
  },
  {
    id: "data-nerd",
    name: "Data Nerd",
    description: "Every number GitHub knows about you, charted: trends, year in review, rhythms and a harvest loop.",
    tags: ["dark-first", "charts", "stats"],
    theme: { preset: "ocean", font: "geist-mono", headingFont: "space-grotesk", texture: "grid", radius: 10 },
    rows: [
      [{ type: "heading", options: { eyebrow: "00 · telemetry", title: "Live from GitHub", line: true } }],
      [{ type: "stats", options: { ring: false, tiles: ["year", "allTime", "current", "longest", "prs", "reviews", "stars", "followers"] } }],
      [{ type: "area" }],
      [{ type: "year" }],
      [{ type: "languages", options: { style: "bars" } }, { type: "rhythm" }],
      [{ type: "harvest" }],
      [{ type: "weekdays" }, { type: "followers" }],
      [{ type: "streak" }],
      [{ type: "journey" }],
      [{ type: "footer" }],
    ],
  },
  {
    id: "portfolio",
    name: "Designer Portfolio",
    description: "A soft, rounded showcase: statement banner, selected work, skills and a contact card.",
    tags: ["portfolio", "rounded", "warm"],
    theme: { preset: "rose", font: "manrope", headingFont: "fraunces", texture: "none", radius: 18, border: 1 },
    rows: [
      [{ type: "banner", options: { effect: "outline", align: "center", height: "tall" } }],
      [{ type: "socials", options: { style: "compact", iconColor: "brand" } }],
      [{ type: "about", options: { layout: "center" } }],
      [{ type: "heading", options: { eyebrow: "selected work", title: "Featured projects", align: "center" } }],
      [{ type: "project", id: "project-1", options: { index: 1, accent: "bar" } }, { type: "project", id: "project-2", options: { index: 2, accent: "bar" } }],
      [{ type: "project", id: "project-3", options: { index: 3, accent: "bar" } }, { type: "project", id: "project-4", options: { index: 4, accent: "bar" } }],
      [{ type: "skills", options: { style: "gauges" } }],
      [{ type: "contact" }],
    ],
  },
  {
    id: "maintainer",
    name: "Open Source Maintainer",
    description: "Native GitHub colours. Leads with your repositories, releases and the green graph.",
    tags: ["github-native", "projects", "releases"],
    theme: { preset: "github", font: "geist-sans", headingFont: "geist-sans", texture: "none", radius: 8 },
    rows: [
      [{ type: "hero", options: { emblem: "github", glitch: false, scanline: false } }],
      [{ type: "badges" }],
      [{ type: "stats", options: { tiles: ["stars", "prs", "reviews", "issues", "repos", "followers"] } }],
      [{ type: "repos", options: { layout: "grid", count: 6 } }],
      [{ type: "releases" }, { type: "donut" }],
      [{ type: "contrib" }],
      [{ type: "board" }],
      [{ type: "footer", options: { waves: false } }],
    ],
  },
  {
    id: "student",
    name: "Student",
    description: "Fresh and friendly: about, quick facts, an education timeline, skills you're building and today's quote.",
    tags: ["friendly", "timeline", "learning"],
    theme: { preset: "forest", font: "space-grotesk", headingFont: "space-grotesk", texture: "dots", radius: 14 },
    rows: [
      [{ type: "banner", options: { headline: "Hi, I'm {name}.", subline: "Computer science student. Learning in public, one commit at a time.", effect: "rise" } }],
      [{ type: "socials" }],
      [{ type: "facts" }],
      [
        {
          type: "timeline",
          options: {
            label: "journey so far",
            items: [
              { period: "2024 — now", title: "BSc Computer Science", place: "University of Somewhere", description: "Algorithms, distributed systems and far too many group projects." },
              { period: "Summer 2025", title: "Software Engineering Intern", place: "Small Startup", description: "Shipped my first production feature and learned to love code review." },
              { period: "2023", title: "First open-source PR", place: "GitHub", description: "A two-line docs fix. Everyone starts somewhere." },
            ],
          },
        },
      ],
      [{ type: "skills", options: { label: "currently learning", style: "blocks" } }],
      [{ type: "today" }, { type: "clock" }],
      [{ type: "contrib" }],
      [{ type: "quote" }],
    ],
  },
  {
    id: "retro-arcade",
    name: "Retro Arcade",
    description: "Warm gruvbox colours, a glitching title and a spinning skyline in chunky mono.",
    tags: ["retro", "playful", "gif"],
    theme: { preset: "gruvbox", font: "space-mono", headingFont: "space-mono", texture: "grid", radius: 4, border: 2 },
    rows: [
      [{ type: "hero", options: { emblem: "steam" } }],
      [{ type: "socials", options: { style: "icon" } }],
      [{ type: "skyline", options: { rotation: "sway" } }],
      [{ type: "pulse" }],
      [{ type: "trophies" }, { type: "languages", options: { style: "stacked" } }],
      [{ type: "harvest", options: { speed: "brisk" } }],
      [{ type: "footer" }],
    ],
  },
  {
    id: "nordic",
    name: "Nordic Calm",
    description: "Arctic blues, serif headlines and slow, deliberate motion. Clocks, weather and long-form writing.",
    tags: ["calm", "serif", "writing"],
    theme: { preset: "nord", font: "inter", headingFont: "ibm-plex-serif", texture: "none", motion: "subtle", radius: 12 },
    rows: [
      [{ type: "heading", options: { eyebrow: "hello", title: "{name}", line: true } }],
      [{ type: "about" }],
      [{ type: "clock" }, { type: "today", options: { quote: false } }],
      [{ type: "area", options: { points: false } }],
      [{ type: "donut" }, { type: "weekdays" }],
      [{ type: "posts" }],
      div("line"),
      [{ type: "footer", options: { waves: false } }],
    ],
  },
  {
    id: "one-card",
    name: "One Card",
    description: "Monochrome and minimal: a headline, your links and one streak card. Nothing else.",
    tags: ["minimal", "monochrome", "short"],
    theme: { preset: "mono", font: "geist-sans", headingFont: "geist-sans", texture: "none", radius: 14, motion: "subtle" },
    rows: [
      [{ type: "hero", options: { emblemStyle: "none", glitch: false, scanline: false, glow: false } }],
      [{ type: "socials", options: { style: "icon", iconColor: "text", runner: false } }],
      [{ type: "streak" }],
    ],
  },
  {
    id: "live-wire",
    name: "Live Wire",
    description: "Electric violet on ink. A marquee banner, the harvester, a trend line and rotating quotes.",
    tags: ["bold", "animated", "dark-first"],
    theme: { preset: "ultraviolet", font: "space-grotesk", headingFont: "space-grotesk", texture: "dots", radius: 16 },
    rows: [
      [{ type: "banner", options: { effect: "marquee", headline: "Shipping things that move." } }],
      [{ type: "socials" }],
      [{ type: "harvest" }],
      [{ type: "stats" }],
      [{ type: "now" }],
      [{ type: "area" }],
      [{ type: "quote" }],
      [{ type: "footer" }],
    ],
  },
  {
    id: "writer",
    name: "Writer",
    description: "For developers who blog: an intro in real markdown, your latest posts and a quote to end on.",
    tags: ["writing", "markdown", "light-first"],
    theme: { preset: "paper", font: "ibm-plex-serif", headingFont: "fraunces", texture: "none", motion: "subtle", radius: 8 },
    rows: [
      [{ type: "banner", options: { effect: "none", height: "compact", corners: false } }],
      // a short intro under the banner reads best centred, like the rest of the page
      [{ type: "markdown", options: { align: "center" } }],
      [{ type: "posts", options: { count: 5 } }],
      [{ type: "socials", options: { style: "compact" } }],
      [{ type: "quote", options: { rotate: false } }],
    ],
  },

  // ---------------------------------------------------------------- project READMEs
  {
    id: "oss-library",
    kind: "project",
    name: "Open-Source Library",
    description: "The full treatment for a published package: hero, live shields, install terminal, usage, stars and the people who built it.",
    tags: ["package", "npm", "complete"],
    theme: { preset: "github", font: "geist-sans", headingFont: "geist-sans", texture: "none", radius: 10 },
    rows: [
      [{ type: "project-hero" }],
      [{ type: "shields" }],
      [{ type: "install" }],
      [{ type: "toc" }],
      [{ type: "features" }],
      [{ type: "code" }],
      [{ type: "repo-stats" }],
      [{ type: "star-history" }],
      [{ type: "contributors" }],
      [{ type: "changelog" }],
      [{ type: "footer", options: { message: "{project} · {license} licensed", waves: false } }],
    ],
  },
  {
    id: "cli-tool",
    kind: "project",
    name: "CLI Tool",
    description: "Terminal-first: amber phosphor, a typed install, a usage snippet and the commit pulse of the project.",
    tags: ["cli", "monospace", "retro"],
    theme: { preset: "amber", font: "jetbrains-mono", headingFont: "jetbrains-mono", texture: "lines", radius: 6 },
    rows: [
      [{ type: "project-hero", options: { emblemStyle: "plain" } }],
      [{ type: "shields" }],
      [{ type: "install" }],
      [{ type: "code" }],
      [{ type: "commit-activity" }],
      [{ type: "repo-health" }, { type: "downloads" }],
      [{ type: "footer", options: { message: "{project} · built in the open", barcode: true } }],
    ],
  },
  {
    id: "product-launch",
    kind: "project",
    name: "Product Launch",
    description: "Bold and visual for apps and frameworks: statement banner, feature grid, roadmap progress and a sponsor card.",
    tags: ["app", "bold", "roadmap"],
    theme: { preset: "ultraviolet", font: "space-grotesk", headingFont: "space-grotesk", texture: "dots", radius: 16 },
    rows: [
      [{ type: "project-hero", options: { align: "center" } }],
      [{ type: "shields" }],
      [{ type: "features" }],
      [{ type: "star-history" }],
      [{ type: "roadmap" }],
      [{ type: "contributors" }],
      [{ type: "support" }],
      [{ type: "footer" }],
    ],
  },
  {
    id: "python-package",
    kind: "project",
    name: "Python Package",
    description: "Calm Nord palette for a PyPI package: pip install, a code sample, releases and repository vitals.",
    tags: ["pypi", "calm", "docs"],
    theme: { preset: "nord", font: "inter", headingFont: "ibm-plex-serif", texture: "none", radius: 10, motion: "subtle" },
    rows: [
      [{ type: "project-hero" }],
      [{ type: "shields" }],
      [{ type: "install" }],
      [{ type: "code", options: { language: "python" } }],
      [{ type: "changelog" }],
      [{ type: "repo-health" }, { type: "donut" }],
      [{ type: "contributors" }],
    ],
  },
  {
    id: "minimal-oss",
    kind: "project",
    name: "Minimal OSS",
    description: "Monochrome and quiet: a title, a row of shields, real markdown docs and nothing that shouts.",
    tags: ["minimal", "monochrome", "markdown"],
    theme: { preset: "mono", font: "geist-sans", headingFont: "geist-sans", texture: "none", radius: 8, motion: "subtle" },
    rows: [
      [{ type: "project-hero", options: { emblemStyle: "none" } }],
      [{ type: "shields" }],
      [{ type: "markdown", options: { text: "## Getting started\n\nInstall the package, import it and you're done. Issues and ideas are welcome on [GitHub](https://github.com/{repo})." } }],
      [{ type: "commit-activity" }],
      [{ type: "contributors", options: {} }],
    ],
  },
  {
    id: "maintainers-dashboard",
    kind: "project",
    name: "Maintainer's Dashboard",
    description: "Everything a maintainer watches, at a glance: stats, health, downloads, star growth, commit rhythm and milestones.",
    tags: ["data", "health", "dashboard"],
    theme: { preset: "ocean", font: "geist-mono", headingFont: "space-grotesk", texture: "grid", radius: 10 },
    rows: [
      [{ type: "project-hero" }],
      [{ type: "repo-stats" }],
      [{ type: "repo-health" }, { type: "downloads" }],
      [{ type: "star-history" }],
      [{ type: "commit-activity" }],
      [{ type: "roadmap" }],
      [{ type: "changelog" }],
      [{ type: "contributors" }],
    ],
  },
];

export function getLayoutPreset(id: string): LayoutPreset {
  return layoutPresets.find((p) => p.id === id) ?? layoutPresets[0];
}

/** A complete, normalised config for a preset, with the given profile (and project) fields merged in. */
export function presetConfig(id: string, profile: Partial<Profile> = {}, project: Partial<ProjectInfo> = {}): StudioConfig {
  const p = getLayoutPreset(id);
  const raw = {
    kind: p.kind ?? "profile",
    profile: { ...DEFAULT_PROFILE, ...profile },
    project: { ...DEFAULT_PROJECT, ...project },
    theme: { ...DEFAULT_THEME, ...p.theme },
    layout: p.rows.map((r) => (Array.isArray(r) ? { align: "center", blocks: r } : r)),
    output: DEFAULT_OUTPUT,
  };
  return normalizeConfig(raw).config;
}
