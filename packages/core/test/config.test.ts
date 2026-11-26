import { describe, expect, it } from "vitest";
import { assetBase, describeCron, layoutPresets, mockData, nextBlockId, normalizeConfig, presetConfig, renderReadme, serializeConfig, parseConfig, workflowYaml, setupGuide, widgetList } from "../src/index";

describe("config normalisation", () => {
  it("fills defaults from nothing", () => {
    const { config, warnings } = normalizeConfig(undefined);
    expect(config.version).toBe(1);
    expect(config.profile.login).toBe("octocat");
    expect(config.output.modes).toEqual(["dark", "light"]);
    expect(warnings.length).toBe(1);
  });

  it("sanitises hostile and wrong values", () => {
    const { config, warnings } = normalizeConfig({
      profile: { login: "bad login!!", name: 42, location: { timezone: "Mars/Olympus", latitude: 999 } },
      theme: { preset: "nope", radius: -5, font: "comic-sans", overrides: { dark: { accent: "red", text: "#fff" } } },
      layout: [{ blocks: [{ type: "hero", id: "Hero Banner!", options: { glitch: "yes" } }, { type: "unknown" }] }, { blocks: [] }],
      output: { branch: "bad branch name", modes: ["light", "sepia"], schedule: "nope" },
    });
    expect(config.profile.login).toBe("octocat");
    expect(config.profile.location.timezone).toBe("UTC");
    expect(config.profile.location.latitude).toBe(90);
    expect(config.theme.preset).toBe("crimson");
    expect(config.theme.radius).toBe(0);
    expect(config.theme.font).toBe("jetbrains-mono");
    expect(config.theme.overrides?.dark).toEqual({ text: "#fff" });
    expect(config.layout).toHaveLength(1);
    expect(config.layout[0].blocks[0].id).toBe("hero-banner");
    expect(config.layout[0].blocks[0].options.glitch).toBe(true);
    expect(config.output.branch).toBe("readme-studio");
    expect(config.output.modes).toEqual(["light"]);
    expect(warnings.some((w) => w.includes("unknown"))).toBe(true);
  });

  it("deduplicates block ids", () => {
    const { config } = normalizeConfig({ layout: [{ blocks: [{ type: "divider", id: "x" }, { type: "divider", id: "x" }] }] });
    expect(config.layout[0].blocks.map((b) => b.id)).toEqual(["x", "x-2"]);
    expect(nextBlockId("stats", ["stats", "stats-2"])).toBe("stats-3");
  });

  it("round-trips through JSON", () => {
    const c = presetConfig(layoutPresets[0].id, { login: "someone" });
    const again = parseConfig(serializeConfig(c));
    expect(again.warnings).toEqual([]);
    expect(again.config).toEqual(c);
  });
});

describe("presets", () => {
  it("every preset normalises without warnings and only uses known widgets", () => {
    const types = new Set(widgetList.map((w) => w.type));
    for (const p of layoutPresets) {
      const flat = p.rows.flatMap((r) => (Array.isArray(r) ? r : r.blocks));
      for (const b of flat) expect(types.has(b.type), `${p.id} uses unknown widget ${b.type}`).toBe(true);
      const c = presetConfig(p.id);
      expect(c.layout.length, p.id).toBeGreaterThan(0);
    }
  });
});

describe("readme composer", () => {
  const c = presetConfig("command-center", { login: "mona" });
  const data = mockData(new Date("2026-06-01T12:00:00Z"), "mona");

  it("emits theme-aware pictures pointing at the asset branch", () => {
    const md = renderReadme(c, data);
    expect(assetBase(c)).toBe("https://raw.githubusercontent.com/mona/mona/readme-studio");
    expect(md).toContain('<source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mona/mona/readme-studio/hero-dark.svg">');
    expect(md).toContain('<img alt="');
    expect(md).toContain('height="52"');
    expect(md).not.toContain("undefined");
  });

  it("links the footer to the studio only when its credit is on", () => {
    const withFooter = (credit: boolean) => normalizeConfig({ ...c, layout: [{ blocks: [{ type: "footer", id: "footer", options: { credit } }] }] }).config;
    expect(renderReadme(withFooter(false), data)).not.toContain('<a href="https://readme.niessen.dev/">');
    const md = renderReadme(withFooter(true), data);
    expect(md).toContain('<a href="https://readme.niessen.dev/">');
    expect(md).toContain('alt="footer · made with Readme Studio"');
  });

  it("single-mode output skips <picture>", () => {
    const md = renderReadme({ ...c, output: { ...c.output, modes: ["light"] } }, data);
    expect(md).not.toContain("<picture>");
    expect(md).toContain("hero-light.svg");
  });

  it("hidden blocks are skipped", () => {
    const hidden = structuredClone(c);
    hidden.layout[0].blocks[0].hidden = true;
    expect(renderReadme(hidden, data)).not.toContain("hero-dark.svg");
  });
});

describe("workflow", () => {
  it("renders the schedule and action reference", () => {
    const c = presetConfig("command-center", { login: "mona" });
    const y = workflowYaml(c);
    expect(y).toContain('cron: "17 2 * * *"');
    expect(y).toContain("uses: DavidNiessen/readme-studio@v1");
    expect(y).toContain("contents: write");
    expect(setupGuide(c)).toContain("github.com/mona/mona");
    expect(describeCron("0 */6 * * *")).toBe("every 6 hours at minute 0");
    expect(describeCron("5 4 * * 1")).toBe("every Monday at 04:05 UTC");
    expect(y).toContain("animated profile README");
    expect(y).toContain("profile-token");
  });

  it("describes a project workflow without the profile token", () => {
    const y = workflowYaml(presetConfig("oss-library", { login: "mona" }, { repo: "mona/aurora" }));
    expect(y).toContain("animated project README");
    expect(y).not.toContain("profile-token");
  });
});
