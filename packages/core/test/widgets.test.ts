import { XMLValidator } from "fast-xml-parser";
import { beforeAll, describe, expect, it } from "vitest";
import { blockParts, createCtx, loadAllFonts, MODES, mockData, normalizeConfig, renderFrames, renderPart, widgetList, type ProfileData, type StudioConfig } from "../src/index";

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

  it("render with empty profile and hostile strings", () => {
    const c = configFor("ember");
    c.profile = { ...c.profile, name: `<script>alert("x")</script> & "quotes"`, roles: [], bio: "", company: "", links: [], location: { ...c.profile.location, city: "" } };
    check(c, mockData(DATE, "octocat"), "hostile");
  });
});
