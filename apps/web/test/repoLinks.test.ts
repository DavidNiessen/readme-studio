import { describe, expect, it } from "vitest";
import { repoUrl, resolveRepoLinks } from "../src/lib/repoLinks";

const R = "DavidNiessen/soundwave";

describe("relative README links in the studio", () => {
  it("serves images from the repository and links to its files", () => {
    expect(repoUrl("docs/screenshot.webp", R, "image")).toBe("https://raw.githubusercontent.com/DavidNiessen/soundwave/HEAD/docs/screenshot.webp");
    expect(repoUrl("./docs/../img/a.png?raw=1", R, "image")).toBe("https://raw.githubusercontent.com/DavidNiessen/soundwave/HEAD/img/a.png?raw=1");
    expect(repoUrl("CONTRIBUTING.md", R, "link")).toBe("https://github.com/DavidNiessen/soundwave/blob/HEAD/CONTRIBUTING.md");
    expect(repoUrl("/docs/playing.md#replays", R, "link")).toBe("https://github.com/DavidNiessen/soundwave/blob/HEAD/docs/playing.md#replays");
    expect(repoUrl("#releases", R, "link")).toBe("https://github.com/DavidNiessen/soundwave#releases");
  });

  it("leaves absolute URLs alone", () => {
    for (const u of ["https://soundwave.niessen.dev", "mailto:a@b.c", "data:image/png;base64,AA", "//cdn.example/x.png"]) expect(repoUrl(u, R, "link")).toBe(u);
  });

  it("rewrites rendered HTML and opens links in a new tab", () => {
    const html =
      '<p><a href="docs/playing.md">guide</a> <a href="https://x.dev" target="_self">x</a></p><img src="docs/screenshot.webp" alt="shot"><picture><source srcset="a.png 1x, b.png 2x"></picture>';
    const out = resolveRepoLinks(html, R);
    expect(out).toContain('<a target="_blank" rel="noopener noreferrer" href="https://github.com/DavidNiessen/soundwave/blob/HEAD/docs/playing.md">');
    expect(out).toContain('<a href="https://x.dev" target="_self">');
    expect(out).toContain('src="https://raw.githubusercontent.com/DavidNiessen/soundwave/HEAD/docs/screenshot.webp"');
    expect(out).toContain('srcset="https://raw.githubusercontent.com/DavidNiessen/soundwave/HEAD/a.png 1x, https://raw.githubusercontent.com/DavidNiessen/soundwave/HEAD/b.png 2x"');
    expect(resolveRepoLinks(html, "not a repo")).toBe(html);
  });
});
