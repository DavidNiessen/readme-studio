// @vitest-environment jsdom
import { marked } from "marked";
import { describe, expect, it } from "vitest";
import { sanitizeReadmeHtml } from "../src/lib/sanitize";

const md = (s: string) => sanitizeReadmeHtml(marked.parse(s, { async: false, gfm: true }) as string);

describe("README HTML sanitising", () => {
  it("removes what could run code or take over the page", () => {
    const attacks = [
      `<img src="x" onerror="alert(1)">`,
      `<script>alert(1)</script>`,
      `<a href="javascript:alert(1)">x</a>`,
      `<a href="JaVaScRiPt:alert(1)">x</a>`,
      `<iframe src="https://evil.example"></iframe>`,
      `<object data="x"></object><embed src="x">`,
      `<form action="https://evil.example"><input type="password"><button>go</button></form>`,
      `<svg><script>alert(1)</script></svg>`,
      `<math><mi xlink:href="javascript:alert(1)">x</mi></math>`,
      `<details open ontoggle="alert(1)"><summary>s</summary>b</details>`,
      `<p style="position:fixed;inset:0">cover</p>`,
      `<a href="https://x" onclick="alert(1)">x</a>`,
      `<style>body{display:none}</style>`,
      `<meta http-equiv="refresh" content="0;url=https://evil.example">`,
      `<base href="https://evil.example/">`,
      `<img src="x" srcset="x" onload="alert(1)">`,
    ];
    for (const a of attacks) {
      const out = sanitizeReadmeHtml(a);
      expect(out, a).not.toMatch(/<script|onerror|onload|onclick|ontoggle|javascript:|<iframe|<object|<embed|<form|<style|<meta|<base|style=|type="password"/i);
    }
    expect(md("[x](javascript:alert(1))")).not.toContain("javascript:");
  });

  it("keeps what GitHub renders", () => {
    const readme = [
      `<p align="center"><img src="docs/logo.png" width="120" alt="logo"></p>`,
      `<picture><source media="(prefers-color-scheme: dark)" srcset="d.png"><img src="l.png" alt="x"></picture>`,
      `<details><summary>More</summary>hidden</details>`,
      `<kbd>Ctrl</kbd> <sub>a</sub> <sup>b</sup>`,
    ].join("\n");
    const out = sanitizeReadmeHtml(readme);
    for (const kept of ['align="center"', 'width="120"', "<picture>", 'media="(prefers-color-scheme: dark)"', 'srcset="d.png"', "<details>", "<summary>", "<kbd>", "<sub>", "<sup>"])
      expect(out, kept).toContain(kept);
    expect(md("| a | b |\n| :- | -: |\n| 1 | 2 |")).toMatch(/<table>[\s\S]*<th[^>]*>a<\/th>/);
    expect(md("- [x] done\n- [ ] todo")).toContain('type="checkbox"');
    expect(md("```js\nconst x = 1;\n```")).toContain('class="language-js"');
    expect(md("[docs](https://example.com) and ![shot](docs/shot.png)")).toMatch(/href="https:\/\/example.com"[\s\S]*src="docs\/shot.png"/);
  });

  it("allows only code-language classes and checkbox inputs", () => {
    expect(sanitizeReadmeHtml(`<span class="js-take-over">x</span>`)).not.toContain("class=");
    expect(sanitizeReadmeHtml(`<input type="text" value="x">`)).not.toContain("<input");
    expect(sanitizeReadmeHtml(`<a href="https://x" target="_blank">x</a>`)).toContain('rel="noopener noreferrer"');
  });
});
