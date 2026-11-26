import { Check, Copy, X } from "lucide-react";
import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export function cn(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = isMac ? "⌘" : "Ctrl";

// ---------------------------------------------------------------- buttons

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "ghost" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  block?: boolean;
};

export function Button({ variant = "secondary", size = "md", block, className, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cn("btn", variant !== "secondary" && `btn--${variant}`, size !== "md" && `btn--${size}`, block && "btn--block", className)}
      {...rest}
    />
  );
}

type IconBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; shortcut?: string; size?: "sm" | "md"; active?: boolean; tipSide?: "top" | "bottom" };

export function IconButton({ label, shortcut, size = "md", active, className, tipSide = "bottom", ...rest }: IconBtnProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={tipSide}>
      <button type="button" aria-label={label} aria-pressed={active} className={cn("icon-btn", size === "sm" && "icon-btn--sm", className)} {...rest} />
    </Tooltip>
  );
}

// ---------------------------------------------------------------- tooltip

export function Tooltip({ label, shortcut, side = "bottom", children }: { label: string; shortcut?: string; side?: "top" | "bottom"; children: ReactElement<Record<string, unknown>> }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number>(0);
  const show = (e: { currentTarget: EventTarget }) => {
    const el = e.currentTarget as HTMLElement;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: side === "bottom" ? r.bottom + 6 : r.top - 6 });
    }, 450);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const child = cloneElement(children, {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: (e: { currentTarget: EventTarget }) => {
      if ((e.currentTarget as HTMLElement).matches(":focus-visible")) show(e);
    },
    onBlur: hide,
    onPointerDown: hide,
  });
  return (
    <>
      {child}
      {pos &&
        createPortal(
          <div className="tooltip" role="tooltip" style={{ left: pos.x, top: pos.y, transform: `translate(-50%, ${side === "bottom" ? "0" : "-100%"})` }}>
            {label}
            {shortcut && <span className="kbd">{shortcut}</span>}
          </div>,
          document.body,
        )}
    </>
  );
}

// ---------------------------------------------------------------- form controls

export function Field({ label, aside, help, children, htmlFor }: { label?: ReactNode; aside?: ReactNode; help?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          <span>{label}</span>
          {aside && <span className="field__aside">{aside}</span>}
        </label>
      )}
      {children}
      {help && <div className="field__help">{help}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function ToggleRow({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  return (
    <div className="toggle-row" onClick={() => onChange(!checked)} style={{ cursor: "pointer" }}>
      <span style={{ display: "grid", gap: 2 }}>
        <span>{label}</span>
        {help && <span className="field__help">{help}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; icon?: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          title={o.title ?? (typeof o.label === "string" ? o.label : undefined)}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {/* a text label in its own box, so a long one ends in "…" instead of being cut on both sides */}
          {typeof o.label === "string" ? <span className="seg__text">{o.label}</span> : o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ value, min, max, step = 1, onChange, unit, label }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string; label: string }) {
  const fill = ((value - min) / (max - min || 1)) * 100;
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <div className="slider">
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} style={{ ["--fill" as string]: `${fill}%` }} onChange={(e) => onChange(Number(e.target.value))} />
      <input
        className="input"
        aria-label={`${label} value`}
        inputMode="decimal"
        value={unit && document.activeElement !== null ? text : text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          else setText(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function Select({ value, options, onChange, label, id }: { value: string; options: { value: string; label: string; group?: string }[]; onChange: (v: string) => void; label: string; id?: string }) {
  const groups = [...new Set(options.map((o) => o.group ?? ""))];
  return (
    <select id={id} aria-label={label} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      {groups.map((g) =>
        g ? (
          <optgroup key={g} label={g}>
            {options
              .filter((o) => o.group === g)
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        ) : (
          options
            .filter((o) => !o.group)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
        ),
      )}
    </select>
  );
}

export function TextInput({ value, onChange, mono, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void; mono?: boolean }) {
  return <input className={cn("input", mono && "input--mono")} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} {...rest} />;
}

export function TextArea({ value, onChange, rows = 3, ...rest }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void }) {
  return <textarea className="textarea" value={value} rows={rows} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function TagsInput({ value, onChange, placeholder, max, suggestions, label }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; suggestions?: string[]; label: string }) {
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const listId = useId();
  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p) && (!max || next.length < max)) next.push(p);
    onChange(next);
    setDraft("");
  };
  return (
    <div className="tags" onClick={() => ref.current?.focus()}>
      {value.map((t, i) => (
        <span className="chip" key={`${t}-${i}`}>
          <span>{t}</span>
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X />
          </button>
        </span>
      ))}
      {(!max || value.length < max) && (
        <input
          ref={ref}
          aria-label={label}
          value={draft}
          list={suggestions ? listId : undefined}
          placeholder={value.length ? "" : placeholder ?? "Type and press Enter"}
          onChange={(e) => {
            if (e.target.value.endsWith(",")) add(e.target.value);
            else setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
        />
      )}
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

export function ColorInput({ value, onChange, placeholder, onReset, label }: { value: string; onChange: (v: string) => void; placeholder?: string; onReset?: () => void; label: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const shown = /^#[0-9a-f]{6}$/i.test(value) ? value : placeholder && /^#[0-9a-f]{6}$/i.test(placeholder) ? placeholder : "#000000";
  return (
    <div className="color">
      <label className="color__swatch" title={label}>
        <span style={{ background: value || placeholder || "transparent" }} />
        <input type="color" aria-label={label} value={shown} onChange={(e) => onChange(e.target.value)} />
      </label>
      <input
        className="input input--mono"
        aria-label={`${label} hex`}
        value={text}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(e.target.value)) onChange(e.target.value.toLowerCase());
        }}
        onBlur={() => setText(value)}
      />
      {onReset ? (
        <IconButton label="Reset to theme" size="sm" onClick={onReset} disabled={!value}>
          <X />
        </IconButton>
      ) : (
        <span />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- tabs

export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; icon?: ReactNode }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value} onClick={() => onChange(t.value)}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- dialog

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  icon?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Callers pass inline closures; keep the latest one in a ref so the effect below
  // runs once per open/close instead of on every render (which stole input focus).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => {
      const target = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current;
      target?.focus({ preventScroll: true });
    });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={width ? { ["--w" as string]: `${width}px` } : undefined}>
        <div className="dialog__head">
          {icon && <div className="dialog__icon">{icon}</div>}
          <div style={{ minWidth: 0 }}>
            <h2 className="dialog__title" id={titleId}>
              {title}
            </h2>
            {subtitle && <p className="dialog__sub">{subtitle}</p>}
          </div>
          <IconButton label="Close" className="dialog__close" onClick={onClose}>
            <X />
          </IconButton>
        </div>
        <div className="dialog__body">{children}</div>
        {footer && <div className="dialog__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- menu / popover

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function Menu({ trigger, items, align = "end" }: { trigger: ReactElement<Record<string, unknown>>; items: (MenuItem | "sep")[]; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; w: number }>({ x: 0, y: 0, w: 0 });
  const anchor = useRef<HTMLElement | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const els = [...(pop.current?.querySelectorAll<HTMLElement>(".menu-item:not(:disabled)") ?? [])];
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    requestAnimationFrame(() => pop.current?.querySelector<HTMLElement>(".menu-item")?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);
  useLayoutEffect(() => {
    if (!open || !pop.current) return;
    const r = pop.current.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) pop.current.style.left = `${window.innerWidth - r.width - 8}px`;
    if (r.bottom > window.innerHeight - 8) pop.current.style.top = `${Math.max(8, pos.y - r.height - 44)}px`;
  }, [open, pos]);
  const t = cloneElement(trigger, {
    ref: (el: HTMLElement | null) => {
      anchor.current = el;
    },
    "aria-haspopup": "menu",
    "aria-expanded": open,
    onClick: (e: { currentTarget: EventTarget }) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPos({ x: align === "end" ? r.right : r.left, y: r.bottom + 6, w: r.width });
      setOpen((o) => !o);
    },
  });
  return (
    <>
      {t}
      {open &&
        createPortal(
          <div ref={pop} className="popover" role="menu" style={{ top: pos.y, left: align === "end" ? undefined : pos.x, right: align === "end" ? window.innerWidth - pos.x : undefined }}>
            {items.map((it, i) =>
              it === "sep" ? (
                <div key={i} className="menu-sep" />
              ) : (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={it.disabled}
                  className={cn("menu-item", it.danger && "menu-item--danger")}
                  onClick={() => {
                    close();
                    it.onSelect();
                  }}
                >
                  {it.icon}
                  <span>{it.label}</span>
                  {it.shortcut && <span className="kbd">{it.shortcut}</span>}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

// ---------------------------------------------------------------- toasts

type Toast = { id: number; text: string; icon?: ReactNode };
const ToastCtx = createContext<(text: string, icon?: ReactNode) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, icon?: ReactNode) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, icon }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="toast-region" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div className="toast" key={t.id}>
              {t.icon ?? <Check />}
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

// ---------------------------------------------------------------- clipboard + code

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label = "Copy", small }: { text: string; label?: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size={small ? "sm" : "md"}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        }
      }}
    >
      {done ? <Check /> : <Copy />}
      {done ? "Copied" : label}
    </Button>
  );
}

export function CodeBlock({ code, maxHeight }: { code: string; maxHeight?: number }) {
  return (
    <div className="code">
      <pre style={maxHeight ? { maxHeight } : undefined}>
        <code>{code}</code>
      </pre>
      <div className="code__copy">
        <CopyButton text={code} small />
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** Debounce a changing value. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    on();
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}
