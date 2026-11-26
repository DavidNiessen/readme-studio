import DOMPurify from "dompurify";

/**
 * README HTML is untrusted: Markdown allows raw HTML, and the studio opens READMEs from any
 * repository. GitHub sanitises READMEs before showing them; this does the same before the studio
 * puts one on the page, so a crafted README can show what GitHub would show and nothing more:
 * no scripts, event handlers, javascript: links, frames, forms or styles.
 *
 * The allow-list follows what GitHub keeps in rendered Markdown.
 */
const TAGS = [
  "a", "abbr", "b", "bdi", "bdo", "blockquote", "br", "caption", "cite", "code", "col", "colgroup", "dd", "del", "details", "dfn", "div", "dl", "dt", "em",
  "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "input", "ins", "kbd", "li", "mark", "ol", "p", "picture", "pre", "q", "rp",
  "rt", "ruby", "s", "samp", "small", "source", "span", "strike", "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time",
  "tr", "tt", "u", "ul", "var", "wbr",
];
const ATTRS = [
  "align", "alt", "checked", "cite", "class", "colspan", "datetime", "dir", "disabled", "height", "href", "lang", "media", "name", "open", "rel", "rowspan",
  "sizes", "span", "src", "srcset", "start", "target", "title", "type", "valign", "width",
  // the Markdown editor's own marker for a URL it resolved for display (see markdown/convert.ts)
  "data-md-url",
];

let ready = false;

function setUp() {
  if (ready) return;
  ready = true;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    // class only for code languages (```js → class="language-js"), which the editor reads back
    if (data.attrName === "class" && !/^language-[\w+#.-]+$/.test(data.attrValue)) data.keepAttr = false;
  });
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    // the only input a README has: task list checkboxes
    if (node.tagName === "INPUT" && node.getAttribute("type") !== "checkbox") node.remove();
    // links leave the studio in a new tab, and give the opened page no handle on it
    if (node.tagName === "A" && node.getAttribute("target") === "_blank") node.setAttribute("rel", "noopener noreferrer");
  });
}

/** README HTML made safe to put on the page, keeping everything GitHub would render. */
export function sanitizeReadmeHtml(html: string): string {
  setUp();
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOW_DATA_ATTR: false });
}
