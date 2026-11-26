import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { llmsTxt, presetCatalog, presetConfig, widgetCatalog } from "@readme-studio/core";
import { decodeShare } from "../../../apps/web/src/lib/share";
import { shareToken } from "../src/cli";

const CLI = resolve(__dirname, "../src/cli.ts");
const TSX = resolve(__dirname, "../../../node_modules/.bin/tsx");
const run = (cwd: string, ...args: string[]) => {
  try {
    return { code: 0, out: execFileSync(TSX, [CLI, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: err.stdout + err.stderr };
  }
};

describe("catalog for agents", () => {
  it("describes every widget with options and choices", () => {
    const all = widgetCatalog();
    expect(all.length).toBeGreaterThan(50);
    const stats = all.find((w) => w.type === "stats")!;
    expect(stats.scope).toBe("profile");
    expect(stats.options.find((o) => o.key === "tiles")?.choices?.length).toBeGreaterThan(5);
    expect(widgetCatalog("project").every((w) => w.scope !== "profile")).toBe(true);
    expect(presetCatalog("project").every((p) => p.kind === "project")).toBe(true);
    expect(llmsTxt()).toContain("readme.config.json");
  });
});

describe("cli", () => {
  it("initialises a project design with its workflow, then validates and links it", () => {
    const dir = mkdtempSync(join(tmpdir(), "rs-cli-"));
    const init = run(dir, "init", "--repo", "mona/aurora", "--npm", "aurora", "--workflow");
    expect(init.code).toBe(0);
    expect(existsSync(join(dir, ".github/workflows/readme-studio.yml"))).toBe(true);
    const cfg = JSON.parse(readFileSync(join(dir, "readme.config.json"), "utf8"));
    expect(cfg).toMatchObject({ kind: "project", project: { repo: "mona/aurora", packages: { npm: "aurora" } } });
    expect(cfg.layout.flatMap((r: { blocks: { type: string }[] }) => r.blocks.map((b) => b.type))).toContain("project-hero");

    const v = run(dir, "validate", "--json");
    expect(v.code).toBe(0);
    expect(JSON.parse(v.out)).toMatchObject({ valid: true, kind: "project", repository: "mona/aurora" });

    const again = run(dir, "init", "--login", "mona");
    expect(again.code).toBe(1);
    expect(again.out).toContain("exists");

    const link = run(dir, "link").out.trim();
    expect(link).toMatch(/^https:\/\/readme\.niessen\.dev\/#\/studio\?design=[\w-]+$/);
    expect(decodeShare(link.split("design=")[1])).toMatchObject({ kind: "project", project: { repo: "mona/aurora" } });
  });

  it("reports repairs as JSON with a non-zero exit", () => {
    const dir = mkdtempSync(join(tmpdir(), "rs-cli-"));
    execFileSync("sh", ["-c", `echo '{"theme":{"preset":"nope"},"layout":[{"blocks":[{"type":"nope"}]}]}' > readme.config.json`], { cwd: dir });
    const v = run(dir, "validate", "--json");
    expect(v.code).toBe(2);
    expect(JSON.parse(v.out).warnings.some((w: string) => w.includes("nope"))).toBe(true);
  });

  it("prints catalogs and the schema", () => {
    const dir = mkdtempSync(join(tmpdir(), "rs-cli-"));
    expect(JSON.parse(run(dir, "widgets", "--json", "--kind", "project").out).widgets.length).toBeGreaterThan(20);
    expect(JSON.parse(run(dir, "widgets", "--type", "shields").out).type).toBe("shields");
    expect(JSON.parse(run(dir, "presets", "--json").out).presets.length).toBeGreaterThan(10);
    expect(JSON.parse(run(dir, "schema").out).properties.kind.enum).toEqual(["profile", "project"]);
    expect(run(dir, "widgets", "--type", "nope").code).toBe(1);
  });

  it("encodes share tokens the studio can read", () => {
    const c = presetConfig("minimal-paper", { login: "mona" });
    expect(decodeShare(shareToken(c))).toEqual(c);
  });
});
