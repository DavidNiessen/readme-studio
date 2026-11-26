/** A small, dependency-free syntax highlighter for the code widget (line based, with block state). */

export type TokClass = "t" | "kw" | "str" | "num" | "com" | "fn" | "ty" | "pun" | "prop" | "var";

export interface Tok {
  s: string;
  c: TokClass;
}

export type Lang = "ts" | "python" | "rust" | "go" | "shell" | "json" | "yaml" | "plain";

export const LANGS: { value: Lang | "auto"; label: string }[] = [
  { value: "auto", label: "Detect from file name" },
  { value: "ts", label: "TypeScript / JavaScript" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "shell", label: "Shell" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "plain", label: "Plain text" },
];

export const LANG_NAME: Record<Lang, string> = {
  ts: "TypeScript",
  python: "Python",
  rust: "Rust",
  go: "Go",
  shell: "Shell",
  json: "JSON",
  yaml: "YAML",
  plain: "Text",
};

/** Brand icon id for the language (shown on the file tab). */
export const LANG_ICON: Record<Lang, string> = {
  ts: "typescript",
  python: "python",
  rust: "rust",
  go: "go",
  shell: "terminal",
  json: "code",
  yaml: "code",
  plain: "book",
};

const words = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

interface LangDef {
  line: string[];
  block?: [string, string];
  quotes: string[];
  /** quote characters whose strings may span lines */
  multi?: string[];
  triple?: boolean;
  kw: Set<string>;
  consts: Set<string>;
  /** keywords after which the next identifier is a declared name */
  decl: Set<string>;
  builtinTypes?: Set<string>;
}

const DEFS: Record<Exclude<Lang, "shell" | "yaml" | "json" | "plain">, LangDef> = {
  ts: {
    line: ["//"],
    block: ["/*", "*/"],
    quotes: ['"', "'", "`"],
    multi: ["`"],
    kw: words(
      "import export from as default const let var function return if else for while do switch case break continue new class extends implements interface type enum async await yield try catch finally throw typeof instanceof in of void delete this super static public private protected readonly declare namespace module keyof satisfies get set",
    ),
    consts: words("true false null undefined NaN Infinity"),
    decl: words("function class interface type enum"),
    builtinTypes: words("string number boolean any unknown never object bigint symbol Promise Record Array Map Set"),
  },
  python: {
    line: ["#"],
    quotes: ['"', "'"],
    triple: true,
    kw: words("import from as def return if elif else for while in not and or is class with try except finally raise lambda yield async await pass break continue global nonlocal del assert match case self"),
    consts: words("True False None"),
    decl: words("def class"),
    builtinTypes: words("int str float bool list dict tuple set bytes"),
  },
  rust: {
    line: ["//"],
    block: ["/*", "*/"],
    quotes: ['"'],
    kw: words("use mod pub crate fn let mut const static struct enum impl trait for in while loop if else match return break continue as where ref move async await dyn unsafe extern type self Self super"),
    consts: words("true false None Some Ok Err"),
    decl: words("fn struct enum trait type mod"),
    builtinTypes: words("i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box"),
  },
  go: {
    line: ["//"],
    block: ["/*", "*/"],
    quotes: ['"', "`"],
    multi: ["`"],
    kw: words("package import func return if else for range switch case default break continue go defer select chan map struct interface type var const fallthrough goto"),
    consts: words("true false nil iota"),
    decl: words("func type"),
    builtinTypes: words("int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 string bool byte rune error any"),
  },
};

export interface HlState {
  /** open block comment or multi-line string terminator */
  open: { end: string; c: TokClass } | null;
}

export function newState(): HlState {
  return { open: null };
}

const NUM = /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)(?:n|[iuf](?:8|16|32|64|128|size)|[jJ])?/;
const IDENT = /^[A-Za-z_$][\w$]*/;

function push(out: Tok[], s: string, c: TokClass): void {
  if (!s) return;
  const last = out[out.length - 1];
  if (last && last.c === c) last.s += s;
  else out.push({ s, c });
}

/** Read a quoted string starting at i (the opening quote already identified). Returns end index (exclusive) and whether it closed. */
function readString(line: string, i: number, q: string): { end: number; closed: boolean } {
  let j = i + q.length;
  while (j < line.length) {
    if (line[j] === "\\") {
      j += 2;
      continue;
    }
    if (line.startsWith(q, j)) return { end: j + q.length, closed: true };
    j++;
  }
  return { end: line.length, closed: false };
}

function codeLine(line: string, def: LangDef, lang: Lang, st: HlState): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  let prevWord = "";
  if (st.open) {
    const k = line.indexOf(st.open.end);
    if (k < 0) {
      push(out, line, st.open.c);
      return out;
    }
    push(out, line.slice(0, k + st.open.end.length), st.open.c);
    i = k + st.open.end.length;
    st.open = null;
  }
  while (i < line.length) {
    const rest = line.slice(i);
    const ch = line[i];
    if (/\s/.test(ch)) {
      const m = /^\s+/.exec(rest)![0];
      push(out, m, "t");
      i += m.length;
      continue;
    }
    if (def.line.some((p) => rest.startsWith(p))) {
      push(out, rest, "com");
      break;
    }
    if (def.block && rest.startsWith(def.block[0])) {
      const k = line.indexOf(def.block[1], i + 2);
      if (k < 0) {
        push(out, rest, "com");
        st.open = { end: def.block[1], c: "com" };
        break;
      }
      push(out, line.slice(i, k + 2), "com");
      i = k + 2;
      continue;
    }
    // python string prefixes (f"", r'', b"")
    let pre = 0;
    if (lang === "python") {
      const m = /^[rRbBfFuU]{1,2}(?=["'])/.exec(rest);
      if (m) pre = m[0].length;
    }
    const qch = line[i + pre];
    if (def.quotes.includes(qch) || (lang === "rust" && ch === "'")) {
      if (lang === "rust" && ch === "'") {
        const c = /^'(?:\\.|[^\\'])'/.exec(rest);
        if (c) {
          push(out, c[0], "str");
          i += c[0].length;
          continue;
        }
        const lt = /^'[A-Za-z_]\w*/.exec(rest);
        if (lt) {
          push(out, lt[0], "ty");
          i += lt[0].length;
          continue;
        }
      }
      const triple = def.triple && line.startsWith(qch.repeat(3), i + pre) ? qch.repeat(3) : "";
      const q = triple || qch;
      const r = readString(line, i + pre, q);
      push(out, line.slice(i, r.end), "str");
      if (!r.closed && (triple || def.multi?.includes(qch))) st.open = { end: q, c: "str" };
      i = r.end;
      continue;
    }
    const num = NUM.exec(rest);
    if (num && /\d/.test(ch)) {
      push(out, num[0], "num");
      i += num[0].length;
      continue;
    }
    if (lang === "python" && ch === "@") {
      const m = /^@[\w.]+/.exec(rest);
      if (m) {
        push(out, m[0], "fn");
        i += m[0].length;
        continue;
      }
    }
    if (lang === "rust" && ch === "#") {
      const m = /^#!?\[[^\]]*\]/.exec(rest);
      if (m) {
        push(out, m[0], "pun");
        i += m[0].length;
        continue;
      }
    }
    const id = IDENT.exec(rest);
    if (id) {
      const w = id[0];
      const after = line.slice(i + w.length);
      let c: TokClass = "t";
      const prevChar = line.slice(0, i).trimEnd().slice(-1);
      if (def.kw.has(w) && prevChar !== ".") c = "kw";
      else if (def.consts.has(w)) c = "num";
      else if (def.decl.has(prevWord)) c = prevWord === "class" || prevWord === "struct" || prevWord === "interface" || prevWord === "type" || prevWord === "enum" || prevWord === "trait" ? "ty" : "fn";
      else if (lang === "rust" && after.startsWith("!")) {
        push(out, `${w}!`, "fn");
        i += w.length + 1;
        prevWord = w;
        continue;
      } else if (/^\s*(?:<[^()]*>)?\s*\(/.test(after)) c = "fn";
      else if (def.builtinTypes?.has(w) || /^[A-Z][a-z0-9]+[A-Za-z0-9]*$/.test(w)) c = "ty";
      else if (prevChar === ".") c = "prop";
      else if (lang === "ts" && /^\s*\??:(?!:)/.test(after) && /[{,(]\s*$|^\s*$/.test(line.slice(0, i))) c = "prop";
      push(out, w, c);
      prevWord = w;
      i += w.length;
      continue;
    }
    push(out, ch, "pun");
    i++;
  }
  return out;
}

function shellLine(line: string, st: HlState): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  let cmdPos = true;
  if (st.open) {
    const k = line.indexOf(st.open.end);
    if (k < 0) {
      push(out, line, "str");
      return out;
    }
    push(out, line.slice(0, k + 1), "str");
    i = k + 1;
    st.open = null;
    cmdPos = false;
  }
  while (i < line.length) {
    const rest = line.slice(i);
    const ch = line[i];
    if (/\s/.test(ch)) {
      const m = /^\s+/.exec(rest)![0];
      push(out, m, "t");
      i += m.length;
      continue;
    }
    if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      push(out, rest, "com");
      break;
    }
    if (ch === '"' || ch === "'") {
      const r = readString(line, i, ch);
      push(out, line.slice(i, r.end), "str");
      if (!r.closed) st.open = { end: ch, c: "str" };
      i = r.end;
      cmdPos = false;
      continue;
    }
    if (ch === "$") {
      const m = /^\$(?:\{[^}]*\}|\(|[A-Za-z_]\w*|[@#?$!0-9*])/.exec(rest);
      if (m) {
        push(out, m[0], "var");
        i += m[0].length;
        if (m[0] === "$(") cmdPos = true;
        continue;
      }
      if (i === 0 || /^\s*$/.test(line.slice(0, i))) {
        // a prompt symbol
        push(out, "$", "pun");
        i++;
        continue;
      }
    }
    if (/[|;&()<>]/.test(ch)) {
      const m = /^(?:\|\||&&|[|;&()<>]+)/.exec(rest)![0];
      push(out, m, "pun");
      i += m.length;
      if (/[|;&(]/.test(m)) cmdPos = true;
      continue;
    }
    if (ch === "\\" && i === line.length - 1) {
      push(out, ch, "pun");
      i++;
      continue;
    }
    const word = /^[^\s|;&()<>"'$]+/.exec(rest)![0];
    if (cmdPos && /^[A-Za-z_]\w*=/.test(word)) {
      const eq = word.indexOf("=");
      push(out, word.slice(0, eq), "var");
      push(out, "=", "pun");
      push(out, word.slice(eq + 1), "str");
    } else if (cmdPos) {
      push(out, word, /^(if|then|else|fi|for|do|done|while|case|esac|function|export|sudo|in)$/.test(word) ? "kw" : "fn");
      if (!/^(sudo|if|then|do|else|export)$/.test(word)) cmdPos = false;
    } else if (/^--?[A-Za-z]/.test(word)) push(out, word, "ty");
    else if (/^\d[\d.]*$/.test(word)) push(out, word, "num");
    else push(out, word, "t");
    i += word.length;
  }
  return out;
}

function jsonLine(line: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    const ch = line[i];
    if (/\s/.test(ch)) {
      const m = /^\s+/.exec(rest)![0];
      push(out, m, "t");
      i += m.length;
      continue;
    }
    if (rest.startsWith("//")) {
      push(out, rest, "com");
      break;
    }
    if (ch === '"') {
      const r = readString(line, i, '"');
      const isKey = /^\s*:/.test(line.slice(r.end));
      push(out, line.slice(i, r.end), isKey ? "prop" : "str");
      i = r.end;
      continue;
    }
    const n = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest);
    if (n) {
      push(out, n[0], "num");
      i += n[0].length;
      continue;
    }
    const w = /^(true|false|null)\b/.exec(rest);
    if (w) {
      push(out, w[0], "kw");
      i += w[0].length;
      continue;
    }
    push(out, ch, "pun");
    i++;
  }
  return out;
}

function yamlValue(out: Tok[], v: string): void {
  const lead = /^\s*/.exec(v)![0];
  push(out, lead, "t");
  let body = v.slice(lead.length);
  // trailing comment
  const ci = body.search(/(^|\s)#/);
  let comment = "";
  if (ci >= 0 && !/^["']/.test(body)) {
    comment = body.slice(ci);
    body = body.slice(0, ci);
  }
  const trimmed = body.trimEnd();
  const tail = body.slice(trimmed.length);
  if (!trimmed) {
  } else if (/^["']/.test(trimmed)) push(out, trimmed, "str");
  else if (/^(true|false|yes|no|on|off|null|~)$/i.test(trimmed)) push(out, trimmed, "kw");
  else if (/^-?\d+(\.\d+)?$/.test(trimmed)) push(out, trimmed, "num");
  else if (/^[|>][-+]?$/.test(trimmed) || /^[[{]/.test(trimmed)) push(out, trimmed, "pun");
  else if (/^[&*!]/.test(trimmed)) push(out, trimmed, "ty");
  else push(out, trimmed, "str");
  push(out, tail, "t");
  if (comment) {
    const sp = /^\s*/.exec(comment)![0];
    push(out, sp, "t");
    push(out, comment.slice(sp.length), "com");
  }
}

function yamlLine(line: string): Tok[] {
  const out: Tok[] = [];
  const com = /^(\s*)(#.*)$/.exec(line);
  if (com) {
    push(out, com[1], "t");
    push(out, com[2], "com");
    return out;
  }
  if (/^(---|\.\.\.)\s*$/.test(line)) {
    push(out, line, "pun");
    return out;
  }
  const m = /^(\s*)(-\s+)?((?:"[^"]*"|'[^']*'|[^\s:#][^:#]*?))(:)(\s.*|$)/.exec(line);
  if (m) {
    push(out, m[1], "t");
    if (m[2]) push(out, m[2], "pun");
    push(out, m[3], "prop");
    push(out, m[4], "pun");
    yamlValue(out, m[5]);
    return out;
  }
  const li = /^(\s*)(-)(\s.*|$)/.exec(line);
  if (li) {
    push(out, li[1], "t");
    push(out, li[2], "pun");
    yamlValue(out, li[3]);
    return out;
  }
  yamlValue(out, line);
  return out;
}

/** Tokenise source into lines of styled runs. */
export function highlight(code: string, lang: Lang): Tok[][] {
  const st = newState();
  return code.split("\n").map((raw) => {
    const line = raw.replace(/\t/g, "  ").replace(/\s+$/, "");
    if (lang === "plain") return line ? [{ s: line, c: "t" as TokClass }] : [];
    if (lang === "shell") return shellLine(line, st);
    if (lang === "json") return jsonLine(line);
    if (lang === "yaml") return yamlLine(line);
    return codeLine(line, DEFS[lang], lang, st);
  });
}

/** Language from a file name, then from the content. */
export function detectLang(filename: string, code: string): Lang {
  const ext = /\.([a-z0-9]+)$/i.exec(filename.trim())?.[1]?.toLowerCase() ?? "";
  const byExt: Record<string, Lang> = {
    ts: "ts", tsx: "ts", js: "ts", jsx: "ts", mjs: "ts", cjs: "ts", mts: "ts", cts: "ts",
    py: "python", pyi: "python",
    rs: "rust",
    go: "go",
    sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
    json: "json", jsonc: "json",
    yml: "yaml", yaml: "yaml",
    txt: "plain", md: "plain",
  };
  if (byExt[ext]) return byExt[ext];
  const name = filename.trim().toLowerCase();
  if (name === "dockerfile" || name === "makefile") return "shell";
  if (/^\s*[{[]/.test(code) && /"\s*:/.test(code)) return "json";
  if (/^\s*(def |from \S+ import |import \S+$|class \w+:)/m.test(code)) return "python";
  if (/^\s*(fn |use \w+::|let mut |impl )/m.test(code)) return "rust";
  if (/^\s*(package \w+|func )/m.test(code)) return "go";
  if (/^\s*(\$ |npm |npx |pip |cargo |curl |git |brew |docker )/m.test(code)) return "shell";
  if (/^\s*[\w-]+:\s/m.test(code) && !/[;{}()]/.test(code)) return "yaml";
  return "ts";
}
