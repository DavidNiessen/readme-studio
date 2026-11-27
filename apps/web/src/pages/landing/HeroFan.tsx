import type { DesignKind, Mode } from "@readme-studio/core";
import { BookOpen, FolderGit2, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WidgetImage } from "../../components/WidgetImage";
import { cn } from "../../components/ui";
import { reducedMotion, useScrollProgress } from "./scroll";
import { useSiteMode, useStills } from "./stills";

const WINDOWS: {
  kind: DesignKind;
  url: string;
  file: string;
  label: string;
  blocks: { type: string; options?: Record<string, unknown> }[];
}[] = [
  {
    kind: "profile",
    url: "github.com/octocat",
    file: "octocat / README.md",
    label: "Profile README",
    blocks: [{ type: "hero" }, { type: "socials" }, { type: "stats" }, { type: "contrib", options: { weekly: false } }],
  },
  {
    kind: "project",
    url: "github.com/octocat/aurora",
    file: "aurora / README.md",
    label: "Project README",
    blocks: [{ type: "project-hero" }, { type: "shields" }, { type: "repo-stats" }, { type: "star-history" }],
  },
];

/** One README in a browser window, all windows the same size, the content fading out at the foot. */
function Window({
  w,
  front,
  epoch,
  onFront,
  mode,
}: {
  w: (typeof WINDOWS)[number];
  front: boolean;
  epoch: number;
  onFront: () => void;
  mode: Mode;
}) {
  const rows = useStills(w.blocks, {
    kind: w.kind,
    mode,
    palette: w.kind === "project" ? "ocean" : "crimson",
    motion: "subtle",
    headingFont: w.kind === "project" ? "space-grotesk" : "jetbrains-mono",
  });
  return (
    <div
      className={cn("lp-win", `lp-win--${w.kind}`, front ? "is-front" : "is-back")}
      onClick={front ? undefined : onFront}
      role={front ? undefined : "button"}
      tabIndex={front ? -1 : 0}
      aria-label={front ? undefined : `Show the ${w.label.toLowerCase()}`}
      onKeyDown={(e) => !front && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onFront())}
    >
      <div className="lp-win__bar">
        <span className="lp-win__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="lp-win__url mono">{w.url}</span>
      </div>
      <div className="lp-win__file">
        <BookOpen /> {w.file}
      </div>
      <div className="lp-win__body">
        {rows.map((parts, i) => (
          <div key={i} className="lp-win__row">
            {parts.map((p) => (
              // a window coming to the front plays its entrances again
              <WidgetImage
                key={p.meta.name}
                part={p}
                epoch={front ? epoch : 0}
                style={p.meta.fixedHeight ? { height: 26, width: "auto" } : undefined}
              />
            ))}
          </div>
        ))}
        {!rows.length && <div className="lp-skeleton" />}
      </div>
    </div>
  );
}

const SWAP_MS = 6500;

/**
 * Both kinds of README at once: two browser windows fanned like cards, swapping places every few
 * seconds (or when the one behind is clicked). Scrolling past spreads them apart.
 */
export function HeroFan() {
  const [front, setFront] = useState<DesignKind>("profile");
  const [epoch, setEpoch] = useState(0);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mode = useSiteMode();
  const bring = (k: DesignKind) => {
    setFront(k);
    setEpoch((n) => n + 1);
  };
  useEffect(() => {
    if (hover || reducedMotion()) return;
    const t = window.setTimeout(() => bring(front === "profile" ? "project" : "profile"), SWAP_MS);
    return () => window.clearTimeout(t);
  }, [front, hover]);
  useScrollProgress(ref, (p) => ref.current?.style.setProperty("--p", p.toFixed(3)));
  return (
    <div className="lp-fan-wrap">
      <div
        ref={ref}
        className="lp-fan"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          setHover(false);
          ref.current?.style.setProperty("--rx", "0");
          ref.current?.style.setProperty("--ry", "0");
        }}
        // the windows lean towards the pointer
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse" || reducedMotion()) return;
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--rx", (((e.clientY - r.top) / r.height - 0.5) * -8).toFixed(2));
          e.currentTarget.style.setProperty("--ry", (((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(2));
        }}
      >
        {WINDOWS.map((w) => (
          <Window key={w.kind} w={w} front={front === w.kind} epoch={epoch} onFront={() => bring(w.kind)} mode={mode} />
        ))}
      </div>
      {/* one track, a highlight that slides to the README in front, and under it a line that fills
          until the windows swap (it holds while the pointer is over them) */}
      <div
        className={cn("lp-switch", front === "project" && "is-second", (hover || reducedMotion()) && "is-held")}
        role="group"
        aria-label="Which README to show in front"
      >
        <span className="lp-switch__thumb" aria-hidden>
          <span key={`${epoch}-${hover}`} className="lp-switch__timer" style={{ animationDuration: `${SWAP_MS}ms` }} />
        </span>
        {WINDOWS.map((w) => (
          <button key={w.kind} type="button" aria-pressed={front === w.kind} onClick={() => bring(w.kind)}>
            {w.kind === "profile" ? <User /> : <FolderGit2 />}
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}
