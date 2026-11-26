import { items, str } from "./kit-c";
import { ghSlug } from "./kit-f";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget } from "./types";

const DEFAULT_ENTRIES = [
  { title: "Installation", anchor: "", level: "1" },
  { title: "Usage", anchor: "", level: "1" },
  { title: "Features", anchor: "", level: "1" },
  { title: "Roadmap", anchor: "", level: "1" },
  { title: "Contributing", anchor: "", level: "1" },
  { title: "License", anchor: "", level: "1" },
];

/** Escape characters that would break a markdown link label. */
function mdLabel(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/([[\]])/g, "\\$1");
}

export const pfToc = defineWidget({
  type: "toc",
  title: "Table of contents",
  description: "A markdown table of contents with links to your README's sections, numbered or bulleted, with optional sub-entries.",
  scope: "any",
  category: "Content",
  kind: "markdown",
  width: "full",
  defaults: {
    title: "## Contents",
    numbered: false,
    entries: DEFAULT_ENTRIES,
  },
  fields: [
    { key: "title", label: "Heading", type: "text", placeholder: "## Contents", max: 80, help: "Markdown, e.g. `## Contents` or `**On this page**`. Leave empty for just the list." },
    { key: "numbered", label: "Numbered", type: "toggle" },
    {
      key: "entries",
      label: "Entries",
      type: "list",
      itemLabel: "Entry",
      titleKey: "title",
      max: 30,
      newItem: { title: "New section", anchor: "", level: "1" },
      help: "Anchors default to GitHub's heading slug, so `## Getting started` becomes #getting-started.",
      item: [
        { key: "title", label: "Title", type: "text", max: 80, help: PLACEHOLDER_HELP },
        { key: "anchor", label: "Anchor", type: "text", placeholder: "Automatic from the title", max: 80 },
        {
          key: "level",
          label: "Level",
          type: "segmented",
          options: [
            { value: "1", label: "Section" },
            { value: "2", label: "Sub-section" },
          ],
        },
      ],
    },
  ],
  alt: () => "Table of contents",
  render(ctx, o) {
    const numbered = o.numbered === true;
    const list = items(o.entries)
      .map((e) => {
        const title = fillPlaceholders(str(e.title), ctx).replace(/\s+/g, " ").trim();
        const raw = str(e.anchor).replace(/^#/, "").trim();
        const anchor = raw ? raw.replace(/\s+/g, "-") : ghSlug(title);
        return { title, anchor, sub: str(e.level) === "2" };
      })
      .filter((e) => e.title)
      .slice(0, 30);
    const lines: string[] = [];
    const heading = fillPlaceholders(str(o.title), ctx).trim();
    if (heading) lines.push(heading, "");
    let n = 0;
    let m = 0;
    let seenTop = false;
    for (const e of list) {
      const link = e.anchor ? `[${mdLabel(e.title)}](#${encodeURI(e.anchor)})` : mdLabel(e.title);
      if (e.sub && seenTop) {
        m++;
        lines.push(numbered ? `${" ".repeat(`${n}. `.length)}${m}. ${link}` : `  - ${link}`);
      } else {
        n++;
        m = 0;
        seenTop = true;
        lines.push(numbered ? `${n}. ${link}` : `- ${link}`);
      }
    }
    if (!list.length) lines.push("<!-- Add entries to the table of contents in the inspector -->");
    return lines.join("\n");
  },
});
