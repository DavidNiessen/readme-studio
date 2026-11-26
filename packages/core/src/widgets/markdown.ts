import { str } from "./kit-c";
import { fillPlaceholders, PLACEHOLDER_HELP } from "./placeholders";
import { defineWidget } from "./types";

export const markdown = defineWidget({
  type: "markdown",
  title: "Markdown text",
  description: "Free-form Markdown or HTML written straight into your README, with live placeholders like {name} and {followers}.",
  category: "Content",
  kind: "markdown",
  width: "full",
  defaults: {
    text: "Hi, I'm **{name}**. I build calm, fast software and the tools around it.\nCurrently exploring local-first apps and typed APIs. Say hello any time!",
  },
  fields: [
    {
      key: "text",
      label: "Markdown",
      type: "text",
      multiline: true,
      max: 5000,
      placeholder: "**Bold**, _italic_, [links](https://example.com), lists, tables and HTML all work.",
      help: `Emitted verbatim into the README; the row's alignment applies. ${PLACEHOLDER_HELP}`,
    },
  ],
  alt: () => "Markdown text",
  render(ctx, o) {
    return fillPlaceholders(str(o.text), ctx).replace(/\r\n?/g, "\n");
  },
});
