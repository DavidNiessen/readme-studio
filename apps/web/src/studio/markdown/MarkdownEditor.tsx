import { PLACEHOLDERS } from "@readme-studio/core";
import {
  Bold,
  Braces,
  Check,
  Code,
  Columns2,
  Eye,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  SquareCode,
  Strikethrough,
  Table,
  Undo2,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Button, Menu, MOD, Segmented, cn } from "../../components/ui";
import { sanitizeReadmeHtml } from "../../lib/sanitize";
import { toEditableHtml, toMarkdown } from "./convert";
import { continueBlock, indentLines, insertBlock, insertLink, TABLE_TEMPLATE, toggleLinePrefix, toggleWrap, type Sel } from "./rawEdit";

export type EditorMode = "rich" | "markdown" | "split";
const MODE_KEY = "rs:md-mode";
const MAX = 20000;

function savedMode(): EditorMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === "markdown" || m === "split" ? m : "rich";
  } catch {
    return "rich";
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One toolbar button: same look in every mode. */
function Tool({ label, keys, onClick, children, disabled }: { label: string; keys?: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="md-tool"
      title={keys ? `${label} (${keys})` : label}
      aria-label={label}
      disabled={disabled}
      // keep the caret where it is in the text while clicking the toolbar
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * The Markdown editor shown in place of a Markdown block on the canvas. Rich edits the rendered
 * text; Markdown edits the source with list continuation and indenting; Split shows both. The
 * text goes into the design as it is typed; Cancel puts back what was there when editing began.
 */
export function MarkdownEditor({ text, repo, onChange, onClose }: { text: string; repo: string; onChange: (text: string) => void; onClose: () => void }) {
  const [mode, setModeState] = useState<EditorMode>(savedMode);
  const [value, setValue] = useState(text);
  const original = useRef(text);
  const raw = useRef<HTMLTextAreaElement>(null);
  const rich = useRef<HTMLDivElement>(null);
  const richDirty = useRef(false);
  const syncTimer = useRef(0);
  const savedRange = useRef<Range | null>(null);
  const rawSel = useRef<{ start: number; end: number }>({ start: text.length, end: text.length });
  const [ask, setAsk] = useState<null | { kind: "link" | "image"; url: string }>(null);
  const [inTable, setInTable] = useState(false);

  const setMode = (m: EditorMode) => {
    flushRich();
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* the choice is just not remembered */
    }
  };

  const update = (next: string) => {
    setValue(next);
    onChange(next);
  };

  // ---------------------------------------------------------------- rich view

  // the rich view is filled when it appears; React never re-renders its content (the browser edits it)
  useEffect(() => {
    if (mode !== "rich" || !rich.current) return;
    rich.current.innerHTML = toEditableHtml(value, repo) || "<p><br></p>";
    richDirty.current = false;
    rich.current.focus();
    placeCaretAtEnd(rich.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /** Write the rich view back as Markdown, if it was edited (looking at it changes nothing). */
  function flushRich() {
    window.clearTimeout(syncTimer.current);
    if (mode === "rich" && richDirty.current && rich.current) {
      richDirty.current = false;
      update(toMarkdown(rich.current.innerHTML));
    }
  }
  const richChanged = () => {
    richDirty.current = true;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(flushRich, 250);
  };
  useEffect(() => () => window.clearTimeout(syncTimer.current), []);

  // toolbar menus take the focus; the last place in the text is kept and put back for the command
  const lastRange = useRef<Range | null>(null);
  const remember = () => {
    const s = window.getSelection();
    if (s && s.rangeCount && rich.current?.contains(s.anchorNode)) lastRange.current = s.getRangeAt(0).cloneRange();
    setInTable(!!cell());
  };
  const cmd = (name: string, arg?: string) => {
    const el = rich.current;
    if (!el) return;
    el.focus();
    const s = window.getSelection();
    if (s && lastRange.current && !el.contains(s.anchorNode)) {
      s.removeAllRanges();
      s.addRange(lastRange.current);
    }
    document.execCommand(name, false, arg);
    richChanged();
    remember();
  };
  const selectedText = () => window.getSelection()?.toString() ?? "";

  const cell = (): HTMLTableCellElement | null => {
    const n = window.getSelection()?.anchorNode;
    const el = n ? (n.nodeType === 1 ? (n as HTMLElement) : n.parentElement) : null;
    return el && rich.current?.contains(el) ? el.closest("td, th") : null;
  };
  const tableOp = (op: "row" | "col" | "delRow" | "delCol") => {
    const c = cell();
    if (!c) return;
    const row = c.parentElement as HTMLTableRowElement;
    const table = c.closest("table")!;
    const col = c.cellIndex;
    if (op === "row") {
      const body = table.tBodies[0] ?? table.createTBody();
      const fresh = document.createElement("tr");
      for (let i = 0; i < row.cells.length; i++) fresh.appendChild(document.createElement("td")).textContent = "";
      if (row.parentElement?.tagName === "THEAD") body.insertBefore(fresh, body.firstChild);
      else row.after(fresh);
    } else if (op === "col") {
      for (const r of table.rows) {
        const ref = r.cells[col];
        const n = document.createElement(r.parentElement?.tagName === "THEAD" ? "th" : "td");
        n.textContent = r.parentElement?.tagName === "THEAD" ? "Column" : "";
        if (ref) ref.after(n);
        else r.appendChild(n);
      }
    } else if (op === "delRow") {
      if (row.parentElement?.tagName === "THEAD") return;
      row.remove();
    } else {
      if (row.cells.length <= 1) return table.remove(), richChanged();
      for (const r of table.rows) r.cells[col]?.remove();
    }
    richChanged();
  };

  // ---------------------------------------------------------------- markdown view

  // the caret goes where the edit leaves it right after React writes the text, before more typing
  const pendingSel = useRef<{ start: number; end: number } | null>(null);
  useLayoutEffect(() => {
    const t = raw.current;
    const p = pendingSel.current;
    if (!t || !p) return;
    pendingSel.current = null;
    t.focus();
    t.setSelectionRange(p.start, p.end);
  }, [value]);
  const applyRaw = (next: Sel) => {
    pendingSel.current = { start: next.start, end: next.end };
    update(next.text);
  };
  const sel = (): Sel => {
    const t = raw.current;
    return { text: value, start: t?.selectionStart ?? rawSel.current.start, end: t?.selectionEnd ?? rawSel.current.end };
  };

  // ---------------------------------------------------------------- shared actions

  const isRich = mode === "rich";
  const act = {
    bold: () => (isRich ? cmd("bold") : applyRaw(toggleWrap(sel(), "**"))),
    italic: () => (isRich ? cmd("italic") : applyRaw(toggleWrap(sel(), "_"))),
    strike: () => (isRich ? cmd("strikeThrough") : applyRaw(toggleWrap(sel(), "~~"))),
    code: () => (isRich ? cmd("insertHTML", `<code>${esc(selectedText() || "code")}</code>`) : applyRaw(toggleWrap(sel(), "`", "code"))),
    heading: (level: 1 | 2 | 3 | 0) => (isRich ? cmd("formatBlock", level ? `h${level}` : "p") : applyRaw(toggleLinePrefix(sel(), level ? `${"#".repeat(level)} ` : ""))),
    quote: () => (isRich ? cmd("formatBlock", "blockquote") : applyRaw(toggleLinePrefix(sel(), "> "))),
    bullets: () => (isRich ? cmd("insertUnorderedList") : applyRaw(toggleLinePrefix(sel(), "- "))),
    numbers: () => (isRich ? cmd("insertOrderedList") : applyRaw(toggleLinePrefix(sel(), "1. "))),
    tasks: () => (isRich ? cmd("insertHTML", `<ul><li><input type="checkbox"> ${esc(selectedText() || "To do")}</li></ul>`) : applyRaw(toggleLinePrefix(sel(), "- [ ] "))),
    codeBlock: () => (isRich ? cmd("insertHTML", `<pre><code>${esc(selectedText() || "code")}</code></pre><p><br></p>`) : applyRaw(insertBlock(sel(), "```\ncode\n```", "code"))),
    table: () =>
      isRich
        ? cmd("insertHTML", "<table><thead><tr><th>Column</th><th>Column</th></tr></thead><tbody><tr><td>Cell</td><td>Cell</td></tr></tbody></table><p><br></p>")
        : applyRaw(insertBlock(sel(), TABLE_TEMPLATE, "Column")),
    rule: () => (isRich ? cmd("insertHorizontalRule") : applyRaw(insertBlock(sel(), "---"))),
    placeholder: (token: string) => {
      if (isRich) return cmd("insertText", token);
      const s = sel();
      const at = s.start + token.length;
      applyRaw({ text: s.text.slice(0, s.start) + token + s.text.slice(s.end), start: at, end: at });
    },
    askLink: (kind: "link" | "image") => {
      if (isRich) {
        remember();
        savedRange.current = lastRange.current;
      } else {
        const t = raw.current;
        if (t) rawSel.current = { start: t.selectionStart, end: t.selectionEnd };
      }
      setAsk({ kind, url: "https://" });
    },
  };

  const finishLink = (url: string) => {
    const kind = ask?.kind;
    setAsk(null);
    if (!kind || !url.trim()) return;
    if (isRich) {
      rich.current?.focus();
      const s = window.getSelection();
      if (savedRange.current && s) {
        s.removeAllRanges();
        s.addRange(savedRange.current);
      }
      if (kind === "image") cmd("insertHTML", `<img src="${esc(url)}" alt="${esc(selectedText() || "image")}">`);
      else if (selectedText()) cmd("createLink", url);
      else cmd("insertHTML", `<a href="${esc(url)}">${esc(url)}</a>`);
    } else {
      const r = insertLink({ text: value, ...rawSel.current }, kind === "image", url);
      applyRaw({ ...r, start: r.end + 1, end: r.end + 1 });
    }
  };

  const done = () => {
    flushRich();
    onClose();
  };
  const cancel = () => {
    window.clearTimeout(syncTimer.current);
    richDirty.current = false;
    onChange(original.current);
    onClose();
  };

  const keys = (e: ReactKeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (ask) setAsk(null);
      else done();
      return;
    }
    if (mod && k === "enter") return e.preventDefault(), done();
    if (mod && k === "b") return e.preventDefault(), act.bold();
    if (mod && k === "i") return e.preventDefault(), act.italic();
    if (mod && k === "k") return e.preventDefault(), act.askLink("link");
    if (mod && e.shiftKey && k === "x") return e.preventDefault(), act.strike();
    if (mod && k === "e") return e.preventDefault(), act.code();
    // undo and redo stay with the text being edited
    if (mod && (k === "z" || k === "y")) e.stopPropagation();
  };
  const rawKeys = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    keys(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const next = continueBlock(sel());
      if (next) {
        e.preventDefault();
        applyRaw(next);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      applyRaw(indentLines(sel(), e.shiftKey));
    }
  };
  const richKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    keys(e);
    if (e.defaultPrevented) return;
    if (e.key === "Tab") {
      e.preventDefault();
      cmd(e.shiftKey ? "outdent" : "indent");
    }
  };

  const preview = useMemo(() => (mode === "split" ? toEditableHtml(value, repo) : ""), [mode, value, repo]);

  return (
    <div className="md-editor" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <div className="md-editor__bar" role="toolbar" aria-label="Markdown formatting">
        <Menu
          align="start"
          label="Text style"
          trigger={
            <button type="button" className="md-tool" aria-label="Heading" title="Heading" onMouseDown={(e) => e.preventDefault()}>
              <Heading2 />
            </button>
          }
          items={[
            { label: "Heading 1", icon: <Heading1 />, onSelect: () => act.heading(1) },
            { label: "Heading 2", icon: <Heading2 />, onSelect: () => act.heading(2) },
            { label: "Heading 3", icon: <Heading3 />, onSelect: () => act.heading(3) },
            { label: "Paragraph", icon: <Pilcrow />, onSelect: () => act.heading(0) },
          ]}
        />
        <Tool label="Bold" keys={`${MOD} B`} onClick={act.bold}>
          <Bold />
        </Tool>
        <Tool label="Italic" keys={`${MOD} I`} onClick={act.italic}>
          <Italic />
        </Tool>
        <Tool label="Strikethrough" keys={`${MOD} ⇧ X`} onClick={act.strike}>
          <Strikethrough />
        </Tool>
        <Tool label="Inline code" keys={`${MOD} E`} onClick={act.code}>
          <Code />
        </Tool>
        <span className="md-sep" />
        <Tool label="Link" keys={`${MOD} K`} onClick={() => act.askLink("link")}>
          <Link2 />
        </Tool>
        <Tool label="Image" onClick={() => act.askLink("image")}>
          <Image />
        </Tool>
        <span className="md-sep" />
        <Tool label="Bulleted list" onClick={act.bullets}>
          <List />
        </Tool>
        <Tool label="Numbered list" onClick={act.numbers}>
          <ListOrdered />
        </Tool>
        <Tool label="Task list" onClick={act.tasks}>
          <ListChecks />
        </Tool>
        <Tool label="Quote" onClick={act.quote}>
          <Quote />
        </Tool>
        <Tool label="Code block" onClick={act.codeBlock}>
          <SquareCode />
        </Tool>
        <Tool label="Table" onClick={act.table}>
          <Table />
        </Tool>
        <Tool label="Divider" onClick={act.rule}>
          <Minus />
        </Tool>
        <Menu
          align="start"
          label="Placeholders"
          trigger={
            <button type="button" className="md-tool" aria-label="Insert a placeholder" title="Insert a placeholder (filled with live data)" onMouseDown={(e) => e.preventDefault()}>
              <Braces />
            </button>
          }
          items={() => [{ heading: "Filled in when the README is built" }, ...PLACEHOLDERS.map((p) => ({ label: p.token, hint: p.help, onSelect: () => act.placeholder(p.token) }))]}
        />
        {isRich && inTable && (
          <span className="md-table-tools">
            <span className="md-sep" />
            <button type="button" className="md-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => tableOp("row")}>
              + row
            </button>
            <button type="button" className="md-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => tableOp("col")}>
              + column
            </button>
            <button type="button" className="md-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => tableOp("delRow")}>
              − row
            </button>
            <button type="button" className="md-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => tableOp("delCol")}>
              − column
            </button>
          </span>
        )}
        <span className="md-editor__modes">
          <Segmented<EditorMode>
            label="Editor view"
            value={mode}
            onChange={setMode}
            options={[
              { value: "rich", label: "Rich", icon: <Eye />, title: "Edit the rendered text" },
              { value: "markdown", label: "Markdown", icon: <FileCode2 />, title: "Edit the Markdown source" },
              { value: "split", label: "Split", icon: <Columns2 />, title: "Markdown with a live preview" },
            ]}
          />
        </span>
      </div>
      {ask && (
        <form
          className="md-editor__ask"
          onSubmit={(e) => {
            e.preventDefault();
            finishLink(ask.url);
          }}
        >
          <label>
            {ask.kind === "image" ? "Image address" : "Link address"}
            <input className="input input--mono" autoFocus value={ask.url} onChange={(e) => setAsk({ ...ask, url: e.target.value })} onKeyDown={keys} onFocus={(e) => e.target.select()} />
          </label>
          <Button size="sm" variant="primary" type="submit">
            {ask.kind === "image" ? "Insert image" : "Add link"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAsk(null)}>
            Cancel
          </Button>
        </form>
      )}
      <div className={cn("md-editor__body", mode === "split" && "is-split")}>
        {mode === "rich" ? (
          <div
            ref={rich}
            className="md-editor__rich cv-md-body"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Markdown, as it renders"
            spellCheck
            onInput={richChanged}
            onPaste={(e) => {
              // pasted HTML goes through the same sanitiser as a README; plain text stays plain text
              const html = e.clipboardData.getData("text/html");
              if (!html) return;
              e.preventDefault();
              cmd("insertHTML", sanitizeReadmeHtml(html));
            }}
            onKeyDown={richKeys}
            onKeyUp={remember}
            onMouseUp={remember}
            onBlur={flushRich}
            onClick={(e) => (e.target as HTMLElement).closest("a") && e.preventDefault()}
          />
        ) : (
          <>
            <textarea
              ref={raw}
              className="md-editor__raw"
              aria-label="Markdown source"
              spellCheck={false}
              value={value}
              autoFocus
              onChange={(e) => update(e.target.value)}
              onKeyDown={rawKeys}
              onSelect={(e) => (rawSel.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })}
            />
            {mode === "split" && <div className="md-editor__preview cv-md-body" aria-label="Preview" dangerouslySetInnerHTML={{ __html: preview }} />}
          </>
        )}
      </div>
      <div className="md-editor__foot">
        <span className={cn("md-count", value.length > MAX && "is-over")}>
          {value.length.toLocaleString()} / {MAX.toLocaleString()}
        </span>
        <span className="muted md-hint">
          {isRich ? "Edit as it renders." : "Markdown: Enter continues lists, Tab indents."} {MOD} Enter or Esc to finish.
        </span>
        <Button size="sm" variant="ghost" onClick={cancel} title="Put back the text from before editing">
          <Undo2 /> Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={done}>
          <Check /> Done
        </Button>
      </div>
    </div>
  );
}

function placeCaretAtEnd(el: HTMLElement) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const s = window.getSelection();
  s?.removeAllRanges();
  s?.addRange(r);
}
