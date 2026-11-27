import { describe, expect, it } from "vitest";
import { createCtx, glyphNames, hasIcon, icon, iconList, iconsVersion, isGlyphName, loadMoreIcons, mockData, normalizeConfig, renderPart, blockParts } from "../src/index";
import { mark } from "../src/widgets/kit-c";

const DATE = new Date("2026-11-26T09:30:00Z");

function featuresSvg(iconId: string): string {
  const config = normalizeConfig({ layout: [{ blocks: [{ type: "features", id: "features", options: { items: [{ icon: iconId, title: "One", text: "Two" }] } }] }] }).config;
  const ctx = createCtx(config, mockData(DATE, "mona"), "dark", { date: DATE });
  return renderPart(blockParts(config.layout[0].blocks[0], ctx)[0], ctx);
}

describe("icon library", () => {
  it("draws the line icons stroked on their own grid, like the hand-drawn glyphs", () => {
    expect(glyphNames.length).toBeGreaterThan(300);
    expect(isGlyphName("database")).toBe(true);
    expect(isGlyphName("git-branch")).toBe(true);
    const svg = featuresSvg("database");
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('stroke-width="2.25"');
  });

  it("keeps the names the hand-drawn glyphs and brands already had", () => {
    // a line icon never takes over an existing id, so existing designs keep their icons
    expect(isGlyphName("rocket")).toBe(true);
    expect(featuresSvg("rocket")).toContain('viewBox="0 0 16 16"');
    expect(icon("mail").title).toBe("Email");
    expect(icon("rust").title).toBe("Rust");
  });

  it("loads the larger brand set on demand", async () => {
    const before = iconsVersion();
    await loadMoreIcons();
    expect(iconsVersion()).toBeGreaterThan(before);
    expect(hasIcon("ollama")).toBe(true);
    expect(icon("ollama").title).toBe("Ollama");
    // renamed where a line icon has the plain name
    expect(icon("hashicorpvault").title).toMatch(/Vault/);
    expect(isGlyphName("vault")).toBe(true);
    expect(iconList().length).toBeGreaterThan(450);
    const theme = createCtx(normalizeConfig({}).config, mockData(DATE, "mona"), "dark", { date: DATE }).theme;
    expect(mark(theme, "ollama", 0, 0, 16, "brand")).toContain("<path");
  });
});
