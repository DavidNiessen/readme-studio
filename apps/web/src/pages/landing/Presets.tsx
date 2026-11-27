import { fontFaceCss, fontInfo, fontStack, layoutPresets, presetConfig, resolveTheme, type Mode } from "@readme-studio/core";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PresetThumb } from "../../components/PresetThumb";
import { cn } from "../../components/ui";
import { useFontsReady } from "../../lib/render";
import { href } from "../../lib/router";
import { Reveal } from "./scroll";
import { useSiteMode } from "./stills";

const LIST = [
  ...layoutPresets.filter((p) => (p.kind ?? "profile") === "profile").slice(0, 2),
  ...layoutPresets.filter((p) => p.kind === "project").slice(0, 2),
];

/** The page's own copy of the fonts the presets use, so the section can set its text in them. */
const pageFonts = new Set<string>();
export function usePageFonts(ids: string[]): boolean {
  const ready = useFontsReady(ids);
  useEffect(() => {
    const fresh = ids.filter((id) => !pageFonts.has(fontInfo(id).id));
    if (!ready || !fresh.length) return;
    fresh.forEach((id) => pageFonts.add(fontInfo(id).id));
    const style = document.createElement("style");
    style.dataset.presetFonts = fresh.join(" ");
    style.textContent = fontFaceCss(fresh);
    document.head.appendChild(style);
  }, [ready, ids]);
  return ready;
}

/** A preset's look as CSS variables: its colours in the site's scheme, typefaces, corners and texture. */
function presetStyle(id: string, mode: Mode): { style: CSSProperties; texture: string } {
  const theme = resolveTheme(presetConfig(id).theme, mode);
  const vars: Record<string, string> = {
    "--pz-bg": theme.card,
    "--pz-card": theme.bg,
    "--pz-raised": theme.raised,
    "--pz-border": theme.border,
    "--pz-text": theme.text,
    "--pz-muted": theme.muted,
    "--pz-subtle": theme.subtle,
    "--pz-accent": theme.accent,
    "--pz-glow": theme.glow,
    "--pz-radius": `${Math.min(24, theme.radius + 4)}px`,
    "--pz-head": fontStack(theme.headingFont),
    "--pz-body": fontStack(theme.font),
    "--pz-head-weight": fontInfo(theme.headingFont).category === "serif" ? "600" : "700",
  };
  return { style: vars as CSSProperties, texture: theme.texture };
}

/**
 * Four presets, and a section that takes on the look of the selected one: its colours, typefaces,
 * corners and texture. The first is selected to begin with; hovering another selects it, and the
 * choice stays after the pointer leaves. On touch screens the first tap selects, the second opens.
 */
export function PresetShowcase({ head }: { head: ReactNode }) {
  const mode = useSiteMode();
  const [selected, setSelected] = useState(LIST[0].id);
  const hover = useRef(typeof matchMedia !== "undefined" && matchMedia("(hover: hover)").matches);
  const fonts = useMemo(() => LIST.flatMap((p) => [presetConfig(p.id).theme.font, presetConfig(p.id).theme.headingFont]), []);
  const fontsReady = usePageFonts(fonts);
  const look = presetStyle(selected, mode);

  return (
    <section className={cn("lp-section lp-pz", `is-tex-${look.texture}`, fontsReady && "is-fonts")} style={look.style}>
      <div className="lp-pz__bg" aria-hidden>
        {(["dots", "grid", "lines"] as const).map((t) => (
          <span key={t} className={cn("lp-pz__tex", `lp-pz__tex--${t}`, look.texture === t && "is-on")} />
        ))}
      </div>
      <div className="wrap">
        {head}
        <div className="preset-row">
          {LIST.map((p, i) => (
            <Reveal key={p.id} delay={i * 90}>
              <a
                className={cn("preset-card lp-tilt", p.id === selected && "is-selected")}
                href={href(`/studio?preset=${p.id}`)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setSelected(p.id)}
                onFocus={() => setSelected(p.id)}
                onClick={(e) => {
                  if (hover.current || p.id === selected) return;
                  e.preventDefault();
                  setSelected(p.id);
                }}
              >
                <PresetThumb id={p.id} height={260} mode={mode} />
                <div className="preset-meta">
                  <h4>{p.name}</h4>
                  <p>{p.description}</p>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
        <div className="center-link">
          <a href={href("/presets")}>
            All {layoutPresets.length} presets <ArrowRight />
          </a>
        </div>
      </div>
    </section>
  );
}
