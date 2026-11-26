/**
 * Editing operations on raw Markdown, as pure functions of the text and the selection, so the
 * toolbar, the keyboard and the tests share them.
 */
export interface Sel {
  text: string;
  start: number;
  end: number;
}

/** Bold, italic, strikethrough, inline code: wrap the selection, or unwrap it when wrapped. */
export function toggleWrap({ text, start, end }: Sel, marker: string, placeholder = "text"): Sel {
  const before = text.slice(0, start);
  const sel = text.slice(start, end);
  const after = text.slice(end);
  const m = marker.length;
  if (before.endsWith(marker) && after.startsWith(marker)) return { text: before.slice(0, -m) + sel + after.slice(m), start: start - m, end: end - m };
  if (sel.length > 2 * m && sel.startsWith(marker) && sel.endsWith(marker)) {
    const inner = sel.slice(m, -m);
    return { text: before + inner + after, start, end: start + inner.length };
  }
  const inner = sel || placeholder;
  return { text: before + marker + inner + marker + after, start: start + m, end: start + m + inner.length };
}

/** The whole lines the selection touches. */
function lineSpan(text: string, start: number, end: number): [number, number] {
  const a = text.lastIndexOf("\n", start - 1) + 1;
  const e = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const b = text.indexOf("\n", e);
  return [a, b < 0 ? text.length : b];
}

const BLOCK_PREFIX = /^(\s*)(#{1,6} |> |[-*+] \[[ xX]\] |[-*+] |\d+[.)] )/;

/**
 * Headings, quotes and lists: give every selected line the prefix, or take it away when all of
 * them have it already. A numbered list counts up. Another block prefix is replaced.
 */
export function toggleLinePrefix({ text, start, end }: Sel, prefix: string): Sel {
  const [a, b] = lineSpan(text, start, end);
  const lines = text.slice(a, b).split("\n");
  const numbered = prefix === "1. ";
  const has = (l: string) => (numbered ? /^\s*\d+[.)] /.test(l) : l.replace(/^\s*/, "").startsWith(prefix));
  const all = lines.every((l) => !l.trim() || has(l));
  let n = 0;
  const next = lines.map((l) => {
    if (!l.trim()) return l;
    const [, indent] = /^(\s*)/.exec(l)!;
    const bare = l.replace(BLOCK_PREFIX, "$1").slice(indent.length);
    if (all) return indent + bare;
    n += 1;
    return indent + (numbered ? `${n}. ` : prefix) + bare;
  });
  const out = next.join("\n");
  return { text: text.slice(0, a) + out + text.slice(b), start: a, end: a + out.length };
}

/** Insert a block (code fence, table, rule) on lines of its own, selecting `select` inside it. */
export function insertBlock({ text, start, end }: Sel, block: string, select?: string): Sel {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = !after || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const out = before + lead + block + trail + after;
  const at = before.length + lead.length;
  const i = select ? block.indexOf(select) : -1;
  return i >= 0 ? { text: out, start: at + i, end: at + i + select!.length } : { text: out, start: at + block.length, end: at + block.length };
}

/** A link or image around the selection, with the URL selected to type over. */
export function insertLink({ text, start, end }: Sel, image: boolean, url = "https://"): Sel {
  const label = text.slice(start, end) || (image ? "description" : "link text");
  const md = `${image ? "!" : ""}[${label}](${url})`;
  const out = text.slice(0, start) + md + text.slice(end);
  const u = start + md.length - 1 - url.length;
  return { text: out, start: u, end: u + url.length };
}

export const TABLE_TEMPLATE = "| Column | Column |\n| --- | --- |\n| Cell | Cell |";

/**
 * Enter at the end of a list item, task or quote line continues it; on an empty item it ends
 * the list instead. Returns null when Enter should do what it always does.
 */
export function continueBlock({ text, start, end }: Sel): Sel | null {
  if (start !== end) return null;
  const a = text.lastIndexOf("\n", start - 1) + 1;
  const line = text.slice(a, start);
  const m = /^(\s*)(> |[-*+] \[[ xX]\] |[-*+] |(\d+)([.)]) )/.exec(line);
  if (!m) return null;
  if (line.trim() === m[2].trim()) {
    // an empty item: leave the list
    return { text: text.slice(0, a) + text.slice(start), start: a, end: a };
  }
  const marker = m[3] ? `${Number(m[3]) + 1}${m[4]} ` : m[2].replace(/\[[xX]\]/, "[ ]");
  const ins = `\n${m[1]}${marker}`;
  return { text: text.slice(0, start) + ins + text.slice(end), start: start + ins.length, end: start + ins.length };
}

/** Tab / Shift+Tab: indent or outdent the selected lines by two spaces. */
export function indentLines({ text, start, end }: Sel, out: boolean): Sel {
  const [a, b] = lineSpan(text, start, end);
  const lines = text.slice(a, b).split("\n");
  const next = lines.map((l) => (out ? l.replace(/^ {1,2}/, "") : `  ${l}`));
  const moved = next[0].length - lines[0].length;
  const block = next.join("\n");
  return { text: text.slice(0, a) + block + text.slice(b), start: Math.max(a, start + moved), end: end + (block.length - (b - a)) };
}
