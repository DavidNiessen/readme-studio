import { layoutPresets, palettePresets, widgetList, type DesignKind, type Mode } from "@readme-studio/core";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { PresetThumb } from "../components/PresetThumb";
import { SitePage } from "../components/Site";
import { href, navigate, useRoute } from "../lib/router";

export default function Presets() {
  const [mode, setMode] = useState<Mode | undefined>(undefined);
  const route = useRoute();
  const kind: DesignKind = route.params.get("kind") === "project" ? "project" : "profile";
  const list = layoutPresets.filter((p) => (p.kind ?? "profile") === kind);
  return (
    <SitePage current="presets">
      <div className="wrap page-head page-head--split">
        <div>
          <span className="eyebrow">Presets</span>
          <h1>Finished designs, ready to make yours.</h1>
          <p>Each preset is a complete theme and layout, for your GitHub profile or for a project's README. Open one in the studio, swap in your details and change anything you like.</p>
          <div className="kind-tabs" role="tablist" aria-label="Preset type">
            {(["profile", "project"] as DesignKind[]).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => navigate(`/presets${k === "project" ? "?kind=project" : ""}`, true)}>
                {k === "profile" ? "Profile READMEs" : "Project READMEs"}
                <span>{layoutPresets.filter((p) => (p.kind ?? "profile") === k).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="hp-mode" role="group" aria-label="Preview colour scheme">
          <button type="button" aria-pressed={mode === "dark"} onClick={() => setMode("dark")} aria-label="Dark">
            <Moon />
          </button>
          <button type="button" aria-pressed={mode === "light"} onClick={() => setMode("light")} aria-label="Light">
            <Sun />
          </button>
        </div>
      </div>
      <div className="wrap">
        <div className="presets-page">
          {list.map((p, i) => {
            const blocks = p.rows.flatMap((r) => (Array.isArray(r) ? r : r.blocks));
            const types = [...new Set(blocks.map((b) => b.type))];
            const palette = palettePresets.find((x) => x.id === p.theme.preset);
            return (
              <article key={p.id} className="preset-tile">
                <a href={href(`/studio?preset=${p.id}`)} className="preset-tile__thumb" aria-label={`Open ${p.name} in the studio`}>
                  <PresetThumb id={p.id} mode={mode} height={380} maxRows={9} />
                </a>
                <div className="preset-tile__meta">
                  <span className="mono preset-tile__n">{String(i + 1).padStart(2, "0")}</span>
                  <h2>{p.name}</h2>
                  <p>{p.description}</p>
                  <dl>
                    <dt>Palette</dt>
                    <dd>
                      {palette && <i style={{ background: palette[mode ?? "dark"].accent }} />}
                      {palette?.name}
                    </dd>
                    <dt>Widgets</dt>
                    <dd>
                      {blocks.length} · {types.map((t) => widgetList.find((w) => w.type === t)?.title ?? t).slice(0, 4).join(", ")}
                      {types.length > 4 ? "…" : ""}
                    </dd>
                  </dl>
                  <a className="btn" href={href(`/studio?preset=${p.id}`)}>
                    Use this preset <ArrowRight />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </SitePage>
  );
}
