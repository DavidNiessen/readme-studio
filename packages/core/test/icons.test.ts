import { describe, expect, it } from "vitest";
import {
  blockParts,
  createCtx,
  glyphNames,
  hasIcon,
  icon,
  iconList,
  iconsVersion,
  isGlyphName,
  isImageData,
  loadMoreIcons,
  MAX_IMAGE_CHARS,
  mockData,
  normalizeConfig,
  renderPart,
  serializeConfig,
} from "../src/index";
import { mark } from "../src/widgets/kit-c";

const DATE = new Date("2026-11-26T09:30:00Z");

function featuresSvg(iconId: string): string {
  const config = normalizeConfig({
    layout: [{ blocks: [{ type: "features", id: "features", options: { items: [{ icon: iconId, title: "One", text: "Two" }] } }] }],
  }).config;
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

describe("uploaded images", () => {
  // a 1×1 PNG
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  it("draws an uploaded image wherever an icon goes, in its own colours", () => {
    expect(isImageData(png)).toBe(true);
    expect(hasIcon(png)).toBe(true);
    const svg = featuresSvg(png);
    expect(svg).toContain(`<image href="${png}"`);
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("uses the image as the project's logo in the hero", () => {
    const config = normalizeConfig({
      kind: "project",
      project: { repo: "mona/aurora" },
      layout: [{ blocks: [{ type: "project-hero", id: "hero", options: { emblem: png } }] }],
    }).config;
    const ctx = createCtx(config, mockData(DATE, "mona", "Mona", "UTC", "mona/aurora"), "dark", { date: DATE });
    expect(renderPart(blockParts(config.layout[0].blocks[0], ctx)[0], ctx)).toContain(`<image href="${png}"`);
  });

  it("accepts only small base64 raster data, never markup", () => {
    for (const bad of [
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      'data:image/png;base64,AAAA" onload="alert(1)',
      "data:text/html;base64,PGgxPg==",
      "https://example.com/logo.png",
      `data:image/png;base64,${"A".repeat(MAX_IMAGE_CHARS)}`,
    ]) {
      expect(isImageData(bad)).toBe(false);
      expect(featuresSvg(bad)).not.toContain("<image");
    }
  });

  it("names a social link's file after the link, not after the image data", () => {
    const config = normalizeConfig({
      profile: { login: "mona", links: [{ icon: png, label: "", url: "https://example.com" }] },
      layout: [{ blocks: [{ type: "socials", id: "socials" }] }],
    }).config;
    const ctx = createCtx(config, mockData(DATE, "mona"), "dark", { date: DATE });
    const parts = blockParts(config.layout[0].blocks[0], ctx);
    expect(parts.length).toBeGreaterThan(0);
    for (const p of parts) {
      expect(p.name.length).toBeLessThan(40);
      expect(p.alt).not.toContain("base64");
    }
  });
});

describe("media library", () => {
  const red = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
  const blue = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const design = (data: string, extra: Record<string, unknown> = {}) =>
    normalizeConfig({
      kind: "project",
      project: { repo: "mona/aurora" },
      media: [{ id: "logo", name: "Logo", data }],
      layout: [
        { blocks: [{ type: "project-hero", id: "hero", options: { emblem: "media:logo" } }] },
        { blocks: [{ type: "features", id: "features", options: { items: [{ icon: "media:logo", title: "One", text: "Two" }] } }] },
      ],
      ...extra,
    }).config;
  const render = (config: ReturnType<typeof design>) => {
    const ctx = createCtx(config, mockData(DATE, "mona", "Mona", "UTC", "mona/aurora"), "dark", { date: DATE });
    return config.layout.map((r) => renderPart(blockParts(r.blocks[0], ctx)[0], ctx));
  };

  it("draws one uploaded image in every widget that refers to it", () => {
    const [hero, features] = render(design(red));
    expect(hero).toContain(`<image href="${red}"`);
    expect(features).toContain(`<image href="${red}"`);
  });

  it("replacing the image updates every widget at once", () => {
    const config = design(red);
    const replaced = { ...config, media: [{ ...config.media[0], data: blue }] };
    for (const svg of render(replaced)) {
      expect(svg).toContain(`<image href="${blue}"`);
      expect(svg).not.toContain(red);
    }
  });

  it("draws nothing for a reference to an image that is not there", () => {
    const [, features] = render(design(red, { media: [] }));
    expect(features).not.toContain("<image");
    expect(features).not.toContain("media:logo");
  });

  it("keeps only valid images with unique ids, and leaves an empty library out of the file", () => {
    const { config, warnings } = normalizeConfig({
      media: [
        { id: "Logo!", name: "Logo", data: red },
        { id: "logo", data: blue },
        { id: "bad", data: "https://x/y.png" },
      ],
    });
    expect(config.media.map((m) => m.id)).toEqual(["logo"]);
    expect(warnings.length).toBe(2);
    expect(serializeConfig(normalizeConfig({}).config)).not.toContain('"media"');
    expect(JSON.parse(serializeConfig(config)).media[0].data).toBe(red);
  });
});

describe("rounded media", () => {
  const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAAABJRU5ErkJggg==";
  const heading = (media: Record<string, unknown>) => {
    const config = normalizeConfig({ media: [{ id: "logo", name: "Logo", data: img, ...media }], layout: [{ blocks: [{ type: "heading", id: "h", options: { icon: "media:logo" } }] }] }).config;
    const ctx = createCtx(config, mockData(DATE, "mona"), "dark", { date: DATE });
    return renderPart(blockParts(config.layout[0].blocks[0], ctx)[0], ctx);
  };

  it("draws a square image as a circle at 50%", () => {
    const svg = heading({ radius: 50, width: 256, height: 256 });
    const rect = /<clipPath id="(rsimg[a-z0-9]+)"><rect x="0.00" y="0.00" width="24.00" height="24.00" rx="12.00"\/><\/clipPath>/.exec(svg);
    expect(rect).not.toBeNull();
    expect(svg).toContain(`clip-path="url(#${rect![1]})"`);
    expect(svg).toContain(`<image href="${img}"`);
  });

  it("rounds a wide image around the picture, not its square box", () => {
    // 256×128 fills the width and half the height, centred
    expect(heading({ radius: 50, width: 256, height: 128 })).toContain('<rect x="0.00" y="6.00" width="24.00" height="12.00" rx="6.00"/>');
  });

  it("leaves an image square unless asked, and keeps the setting in range", () => {
    expect(heading({})).not.toContain("<clipPath");
    const { config } = normalizeConfig({ media: [{ id: "a", data: img, radius: 400, width: -3, height: 10 }] });
    expect(config.media[0].radius).toBe(50);
    expect(config.media[0].width).toBeUndefined();
  });
});
