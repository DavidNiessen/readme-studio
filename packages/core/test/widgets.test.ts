import { XMLValidator } from "fast-xml-parser";
import { beforeAll, describe, expect, it } from "vitest";
import { blockParts, createCtx, loadAllFonts, MODES, mockData, normalizeConfig, renderFrames, renderPart, widgetFits, widgetList, type ProfileData, type StudioConfig } from "../src/index";

const DATE = new Date("2026-11-26T09:30:00Z");

function configFor(preset: string, motion: "full" | "subtle" | "off" = "full", font = "jetbrains-mono"): StudioConfig {
  return normalizeConfig({
    theme: { preset, motion, font, headingFont: font },
    layout: [{ blocks: widgetList.map((w) => ({ type: w.type, id: w.type })) }],
  }).config;
}

function emptyData(): ProfileData {
  const d = mockData(DATE, "nobody");
  for (const day of d.weeks.flat()) {
    day.count = 0;
    day.level = 0;
  }
  return {
    ...d,
    repos: [],
    projects: [],
    events: [],
    languages: [],
    releases: [],
    feeds: {},
    yearTotals: {},
    weather: null,
    commitHours: null,
    lastYearTotal: 0,
    yearTotal: 0,
    allTimeTotal: 0,
    followers: 0,
    following: 0,
    repoCount: 0,
    createdAt: null,
    totals: { commits: null, pullRequests: null, issues: null, reviews: null, stars: null, forks: null, privateContributions: null },
  };
}

function check(config: StudioConfig, data: ProfileData, label: string): void {
  for (const mode of MODES) {
    const ctx = createCtx(config, data, mode, { date: DATE, run: "7" });
    for (const block of config.layout[0].blocks) {
      for (const part of blockParts(block, ctx)) {
        const out = renderPart(part, ctx);
        if (part.kind === "markdown") {
          expect(typeof out).toBe("string");
          continue;
        }
        const where = `${label}/${mode}/${part.name}`;
        expect(out, where).not.toContain("could not be rendered");
        expect(out.replace(/base64,[^)]*\)/g, ""), where).not.toMatch(/NaN|undefined/);
        const valid = XMLValidator.validate(out);
        expect(valid, `${where}: ${JSON.stringify(valid)}`).toBe(true);
        expect(out.length, where).toBeLessThan(1.5 * 1024 * 1024);
        if (part.kind === "gif") {
          const g = renderFrames(part, ctx);
          expect(g.frames.length, where).toBeGreaterThan(0);
          for (const f of g.frames) expect(XMLValidator.validate(f.svg), where).toBe(true);
        }
      }
    }
  }
}

describe("widgets", () => {
  beforeAll(async () => {
    await loadAllFonts();
  });

  it("registry has unique types and complete metadata", () => {
    const types = widgetList.map((w) => w.type);
    expect(new Set(types).size).toBe(types.length);
    for (const w of widgetList) {
      expect(w.title, w.type).toBeTruthy();
      expect(w.description.length, w.type).toBeGreaterThan(20);
      for (const f of w.fields) expect(Object.keys(w.defaults), `${w.type}.${f.key}`).toContain(f.key);
    }
  });

  for (const preset of ["crimson", "paper", "nord", "mono"]) {
    it(`render valid SVG with sample data (${preset})`, () => check(configFor(preset), mockData(DATE, "octocat"), preset));
  }

  it("render with every motion level and proportional fonts", () => {
    check(configFor("github", "off", "inter"), mockData(DATE, "octocat"), "motion-off");
    check(configFor("tokyo", "subtle", "fraunces"), mockData(DATE, "octocat"), "motion-subtle");
  });

  it("render gracefully with empty data", () => check(configFor("crimson"), emptyData(), "empty"));

  it("render every project-capable widget with and without repository data", () => {
    const c = normalizeConfig({
      kind: "project",
      project: { repo: "octocat/aurora", packages: { npm: "aurora" } },
      theme: { preset: "github", font: "inter", headingFont: "inter" },
      layout: [{ blocks: widgetList.filter((w) => widgetFits(w, "project")).map((w) => ({ type: w.type, id: w.type })) }],
    }).config;
    check(c, mockData(DATE, "octocat", "Mona", "UTC", "octocat/aurora"), "project");
    const bare = mockData(DATE, "octocat", "Mona", "UTC", "octocat/aurora");
    delete bare.project;
    check(c, bare, "project-without-data");
    const empty = mockData(DATE, "octocat", "Mona", "UTC", "octocat/aurora");
    empty.project = { ...empty.project!, contributors: [], releases: [], milestones: [], downloads: [], starHistory: [], commitWeeks: [], ci: null, lastCommit: null, stars: 0, forks: 0, languages: [] };
    check(c, empty, "project-empty");
  });

  it("render with empty profile and hostile strings", () => {
    const c = configFor("ember");
    const hostile = `<script>alert("x")</script> & "quotes"`;
    c.profile = { ...c.profile, links: [], location: { ...c.profile.location, city: "" } };
    // names, taglines and the like live in the widgets now: every widget's own text is hostile too
    for (const b of c.layout.flatMap((r) => r.blocks))
      for (const k of ["title", "name", "tagline", "bio", "company", "pronouns", "role"]) if (typeof b.options[k] === "string") b.options[k] = hostile;
    for (const b of c.layout.flatMap((r) => r.blocks)) if (Array.isArray(b.options.roles)) b.options.roles = [];
    const data = mockData(DATE, "octocat");
    Object.assign(data, { name: hostile, bio: "", company: "" });
    check(c, data, "hostile");
  });
});

describe("presets render", () => {
  it("every layout preset renders every part in both modes", async () => {
    const { layoutPresets, presetConfig } = await import("../src/index");
    await loadAllFonts();
    for (const p of layoutPresets) {
      const c = presetConfig(p.id);
      for (const mode of c.output.modes) {
        const ctx = createCtx(c, mockData(DATE, "octocat"), mode, { date: DATE });
        for (const row of c.layout)
          for (const b of row.blocks)
            for (const part of blockParts(b, ctx)) {
              const out = renderPart(part, ctx);
              expect(out, `${p.id}/${mode}/${part.name}`).not.toContain("could not be rendered");
            }
      }
    }
  });
});
