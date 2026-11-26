import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { repoUrl } from "../../lib/repoLinks";

/**
 * Markdown ⇄ HTML for the rich view of the Markdown editor. The HTML shows relative images and
 * links resolved against the repository (so they load), and remembers what was written, so the
 * Markdown that comes back keeps them relative. The HTML README authors write on purpose
 * (centred blocks, <details>, <picture>, sized images) comes back as HTML, not flattened.
 */

const ORIGINAL = "data-md-url";

/** Markdown to editable HTML, with relative URLs resolved for display. */
export function toEditableHtml(md: string, repo: string): string {
  const html = marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  if (/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    for (const el of doc.querySelectorAll<HTMLElement>("img[src], source[srcset], a[href]")) {
      const attr = el.tagName === "A" ? "href" : el.tagName === "SOURCE" ? "srcset" : "src";
      const value = el.getAttribute(attr) ?? "";
      const shown = attr === "srcset" ? value : repoUrl(value, repo, el.tagName === "A" ? "link" : "image");
      if (shown !== value) {
        el.setAttribute(ORIGINAL, value);
        el.setAttribute(attr, shown);
      }
    }
  }
  return doc.body.innerHTML;
}

/** The URL as the author wrote it, when the rich view resolved it for display. */
const written = (el: HTMLElement, attr: string) => el.getAttribute(ORIGINAL) ?? el.getAttribute(attr) ?? "";

/** An element written as HTML in the README: kept as HTML, with its URLs as written. */
function asHtml(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement;
  for (const n of [copy, ...copy.querySelectorAll<HTMLElement>(`[${ORIGINAL}]`)]) {
    const o = n.getAttribute(ORIGINAL);
    if (o === null) continue;
    n.setAttribute(n.tagName === "A" ? "href" : n.tagName === "SOURCE" ? "srcset" : "src", o);
    n.removeAttribute(ORIGINAL);
  }
  return copy.outerHTML;
}

let service: TurndownService | null = null;

function turndown(): TurndownService {
  if (service) return service;
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", fence: "```", bulletListMarker: "-", emDelimiter: "_", strongDelimiter: "**", hr: "---", linkStyle: "inlined" });
  td.use(gfm);
  // what README authors write as HTML stays HTML
  td.keep(["details", "summary", "picture", "kbd", "sub", "sup"] as TurndownService.Filter);
  td.addRule("aligned", {
    filter: (n) => (n.nodeName === "P" || n.nodeName === "DIV" || /^H[1-6]$/.test(n.nodeName)) && (n as HTMLElement).hasAttribute("align"),
    replacement: (_c, n) => `\n\n${asHtml(n as HTMLElement)}\n\n`,
  });
  td.addRule("picture", { filter: "picture", replacement: (_c, n) => asHtml(n as HTMLElement) });
  td.addRule("image", {
    filter: "img",
    replacement: (_c, n) => {
      const el = n as HTMLElement;
      // a sized or aligned image only exists as HTML
      if (["width", "height", "align"].some((a) => el.hasAttribute(a))) return asHtml(el);
      const alt = (el.getAttribute("alt") ?? "").replace(/[[\]]/g, "\\$&");
      const title = el.getAttribute("title");
      return `![${alt}](${written(el, "src")}${title ? ` "${title.replace(/"/g, '\\"')}"` : ""})`;
    },
  });
  td.addRule("link", {
    filter: (n) => n.nodeName === "A" && (n as HTMLElement).hasAttribute("href"),
    replacement: (content, n) => {
      const el = n as HTMLElement;
      const title = el.getAttribute("title");
      return `[${content}](${written(el, "href")}${title ? ` "${title.replace(/"/g, '\\"')}"` : ""})`;
    },
  });
  // list items as people write them: "- item", "1. item", "- [x] task"
  td.addRule("listItem", {
    filter: "li",
    replacement: (content, n) => {
      const el = n as HTMLElement;
      const list = el.parentElement;
      let prefix = "- ";
      if (list?.nodeName === "OL") {
        const start = Number(list.getAttribute("start") || 1);
        prefix = `${start + Array.prototype.indexOf.call(list.children, el)}. `;
      }
      const body = content
        .replace(/^\n+/, "")
        .replace(/\n+$/, "\n")
        .replace(/^(\[[ x]\]) +/, "$1 ")
        .replace(/\n/gm, `\n${" ".repeat(prefix.length)}`);
      return prefix + body + (el.nextSibling && !/\n$/.test(body) ? "\n" : "");
    },
  });
  // task list items: [x] / [ ] from their checkboxes
  td.addRule("taskItem", {
    filter: (n) => n.nodeName === "INPUT" && (n as HTMLInputElement).type === "checkbox",
    replacement: (_c, n) => ((n as HTMLInputElement).checked || (n as HTMLElement).hasAttribute("checked") ? "[x] " : "[ ] "),
  });
  service = td;
  return td;
}

/** Editable HTML back to Markdown. */
export function toMarkdown(html: string): string {
  return turndown()
    .turndown(html)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
