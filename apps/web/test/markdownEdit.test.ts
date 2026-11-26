import { describe, expect, it } from "vitest";
import { continueBlock, indentLines, insertBlock, insertLink, TABLE_TEMPLATE, toggleLinePrefix, toggleWrap } from "../src/studio/markdown/rawEdit";

// « and » mark the selection (brackets would clash with task lists and links)
const at = (text: string) => {
  const start = text.indexOf("«");
  const end = text.indexOf("»") - 1;
  return { text: text.replace("«", "").replace("»", ""), start, end };
};
const show = (s: { text: string; start: number; end: number }) => `${s.text.slice(0, s.start)}«${s.text.slice(s.start, s.end)}»${s.text.slice(s.end)}`;

describe("raw Markdown editing", () => {
  it("wraps and unwraps inline marks", () => {
    expect(show(toggleWrap(at("a «word» b"), "**"))).toBe("a **«word»** b");
    expect(show(toggleWrap(at("a **«word»** b"), "**"))).toBe("a «word» b");
    expect(show(toggleWrap(at("a «»b"), "`", "code"))).toBe("a `«code»`b");
  });

  it("prefixes lines, numbers lists and toggles back", () => {
    expect(toggleLinePrefix(at("«one\ntwo»"), "- ").text).toBe("- one\n- two");
    expect(toggleLinePrefix(at("«- one\n- two»"), "- ").text).toBe("one\ntwo");
    expect(toggleLinePrefix(at("«one\n\ntwo»"), "1. ").text).toBe("1. one\n\n2. two");
    // a heading replaces a list marker instead of stacking on it
    expect(toggleLinePrefix(at("«- item»"), "## ").text).toBe("## item");
    expect(toggleLinePrefix(at("«todo»"), "- [ ] ").text).toBe("- [ ] todo");
  });

  it("puts blocks on lines of their own", () => {
    const r = insertBlock(at("text«»"), TABLE_TEMPLATE, "Column");
    expect(r.text).toBe(`text\n\n${TABLE_TEMPLATE}`);
    expect(r.text.slice(r.start, r.end)).toBe("Column");
  });

  it("makes links with the URL selected", () => {
    const r = insertLink(at("see «docs»"), false);
    expect(r.text).toBe("see [docs](https://)");
    expect(r.text.slice(r.start, r.end)).toBe("https://");
    expect(insertLink(at("«»"), true).text).toBe("![description](https://)");
  });

  it("continues lists on Enter and ends them on an empty item", () => {
    expect(show(continueBlock(at("- one«»"))!)).toBe("- one\n- «»");
    expect(show(continueBlock(at("3. three«»"))!)).toBe("3. three\n4. «»");
    expect(show(continueBlock(at("- [x] done«»"))!)).toBe("- [x] done\n- [ ] «»");
    expect(show(continueBlock(at("> quote«»"))!)).toBe("> quote\n> «»");
    expect(show(continueBlock(at("- one\n- «»"))!)).toBe("- one\n«»");
    expect(continueBlock(at("plain«»"))).toBeNull();
  });

  it("indents and outdents lines", () => {
    expect(indentLines(at("«- a\n- b»"), false).text).toBe("  - a\n  - b");
    expect(indentLines(at("«  - a»"), true).text).toBe("- a");
  });
});
