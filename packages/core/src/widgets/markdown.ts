import { str } from "./kit-c";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget, type Field } from "./types";

/**
 * How a Markdown block's text sits in the README. Text is left-aligned unless asked otherwise:
 * a row's alignment places images, and centring lists, tables and code would only hurt them.
 */
export const TEXT_ALIGN: Field = {
  key: "align",
  label: "Text alignment",
  type: "segmented",
  options: [
    { value: "left", label: "Left" },
    { value: "center", label: "Centre" },
    { value: "right", label: "Right" },
  ],
  help: "Centre or right wraps the text in an aligned <div>, which GitHub honours.",
};

export const markdown = defineWidget({
  type: "markdown",
  title: "Markdown text",
  description: "Free-form Markdown or HTML written straight into your README, with live placeholders like {name} and {followers}.",
  category: "Content",
  kind: "markdown",
  width: "full",
  defaults: {
    text: "Hi, I'm **{name}**. I build calm, fast software and the tools around it.\nCurrently exploring local-first apps and typed APIs. Say hello any time!",
    align: "left",
  },
  fields: [
    {
      key: "text",
      label: "Markdown",
      type: "text",
      multiline: true,
      max: 20000,
      rows: 12,
      placeholder: "**Bold**, _italic_, [links](https://example.com), lists, tables and HTML all work.",
      help: `Emitted verbatim into the README. ${PLACEHOLDER_HELP}`,
    },
    TEXT_ALIGN,
  ],
  alt: () => "Markdown text",
  render(ctx, o) {
    return fillOutsideCode(str(o.text).replace(/\r\n?/g, "\n"), (t) => fillPlaceholders(t, ctx));
  },
});

/**
 * Applies `fill` to prose only: fenced code blocks and inline code stay exactly as written, so a
 * sample like `${name}` in an imported README is never turned into a placeholder value.
 */
export function fillOutsideCode(text: string, fill: (t: string) => string): string {
  return text
    .split(/(^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[ \t]*$)/m)
    .map((part, i) => (i % 2 === 1 ? part : part.split(/(`+[^`]*?`+)/).map((p, j) => (j % 2 === 1 ? p : fill(p))).join("")))
    .join("");
}
