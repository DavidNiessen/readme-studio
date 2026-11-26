import { Pipette } from "lucide-react";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

/** Colours worth offering in every picker: the current theme's, provided by the studio. */
export const ThemeSwatchesContext = createContext<{ label: string; color: string }[]>([]);

const HEX6 = /^#[0-9a-f]{6}$/i;

type Hsv = { h: number; s: number; v: number };

export function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

const RECENT_KEY = "rs:recent-colors";
function recentColors(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === "string" && HEX6.test(c)).slice(0, 10) : [];
  } catch {
    return [];
  }
}
function remember(color: string): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([color, ...recentColors().filter((c) => c !== color)].slice(0, 10)));
  } catch {
    /* storage blocked: no recent colours, nothing else changes */
  }
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/**
 * The colour picker that opens from a swatch: saturation and brightness on a square, hue on a
 * slider, both by pointer or arrow keys; the theme's colours and recently used ones as
 * swatches; the eyedropper where the browser has one.
 */
export function ColorPopover({ anchor, value, onChange, onClose, label }: { anchor: HTMLElement; value: string; onChange: (v: string) => void; onClose: () => void; label: string }) {
  const theme = useContext(ThemeSwatchesContext);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(HEX6.test(value) ? value : "#808080"));
  const [recent] = useState(recentColors);
  const pop = useRef<HTMLDivElement>(null);
  const square = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  const hex = hsvToHex(hsv);

  // follow outside changes (undo, the hex field) without fighting a drag in progress
  useEffect(() => {
    if (HEX6.test(value) && value.toLowerCase() !== hsvToHex(hsv)) setHsv(hexToHsv(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const set = (next: Hsv) => {
    setHsv(next);
    const h = hsvToHex(next);
    last.current = h;
    onChange(h);
  };
  const pick = (h: string) => {
    setHsv(hexToHsv(h));
    last.current = h;
    onChange(h);
  };

  useEffect(() => {
    const down = (e: MouseEvent) => !pop.current?.contains(e.target as Node) && !anchor.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchor.focus();
      }
    };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", onClose);
      // the colour the picker ended on becomes a recent one
      if (HEX6.test(last.current)) remember(last.current.toLowerCase());
    };
  }, [anchor, onClose]);

  // below the swatch, or above it when there is no room
  useLayoutEffect(() => {
    const el = pop.current;
    if (!el) return;
    const a = anchor.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const top = a.bottom + 6 + r.height > window.innerHeight - 8 ? Math.max(8, a.top - 6 - r.height) : a.bottom + 6;
    el.style.top = `${top}px`;
    el.style.left = `${Math.min(Math.max(8, a.left), window.innerWidth - r.width - 8)}px`;
    el.querySelector<HTMLElement>(".cp__square")?.focus();
  }, [anchor]);

  const fromPointer = (e: { clientX: number; clientY: number }) => {
    const r = square.current!.getBoundingClientRect();
    set({ ...hsv, s: clamp((e.clientX - r.left) / r.width), v: clamp(1 - (e.clientY - r.top) / r.height) });
  };
  const squareKeys = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d) return;
    e.preventDefault();
    set({ ...hsv, s: clamp(hsv.s + d[0]), v: clamp(hsv.v + d[1]) });
  };

  const dropper = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
  const swatch = (c: string, title: string) => (
    <button key={title + c} type="button" className={`cp__swatch${c.toLowerCase() === hex ? " is-current" : ""}`} style={{ background: c }} title={`${title} ${c}`} aria-label={`${title} ${c}`} onClick={() => pick(c.toLowerCase())} />
  );

  return createPortal(
    <div ref={pop} className="popover cp" role="dialog" aria-label={`${label} colour`}>
      <div
        ref={square}
        className="cp__square"
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={`saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        style={{ background: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && fromPointer(e)}
        onKeyDown={squareKeys}
      >
        <span className="cp__thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <input className="cp__hue" type="range" min={0} max={359} aria-label="Hue" value={Math.round(hsv.h)} onChange={(e) => set({ ...hsv, h: Number(e.target.value) })} />
      <div className="cp__row">
        <span className="cp__now" style={{ background: hex }} />
        <span className="mono cp__hex">{hex}</span>
        {dropper && (
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            aria-label="Pick a colour from the screen"
            title="Pick a colour from the screen"
            onClick={async () => {
              try {
                pick((await new dropper().open()).sRGBHex.toLowerCase());
              } catch {
                /* cancelled */
              }
            }}
          >
            <Pipette />
          </button>
        )}
      </div>
      {theme.length > 0 && (
        <>
          <div className="cp__label">Theme</div>
          <div className="cp__swatches">{theme.filter((t) => HEX6.test(t.color)).map((t) => swatch(t.color, t.label))}</div>
        </>
      )}
      {recent.length > 0 && (
        <>
          <div className="cp__label">Recent</div>
          <div className="cp__swatches">{recent.map((c) => swatch(c, "Recent"))}</div>
        </>
      )}
    </div>,
    document.body,
  );
}

/** A bare swatch that opens the picker (for compact rows such as the heat scale). */
export function ColorSwatchButton({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={ref} type="button" className="cp-swatch-btn" style={{ background: value }} title={`${label} ${value}`} aria-label={`${label}: ${value}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {open && ref.current && <ColorPopover anchor={ref.current} value={value} onChange={onChange} onClose={() => setOpen(false)} label={label} />}
    </>
  );
}
