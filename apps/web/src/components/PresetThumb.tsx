import { layoutPresets, mockData, presetConfig, type Mode } from "@readme-studio/core";
import { useMemo } from "react";
import { renderLayout, useFontsReady } from "../lib/render";
import { WidgetImage } from "./WidgetImage";

const DATE = new Date();

/** A scaled-down, live render of the top of a layout preset. */
export function PresetThumb({ id, mode: forced, height = 210, maxRows = 5 }: { id: string; mode?: Mode; height?: number; maxRows?: number }) {
  const mode: Mode = forced ?? (layoutPresets.find((p) => p.id === id)?.tags.includes("light-first") ? "light" : "dark");
  const config = useMemo(() => presetConfig(id), [id]);
  const ready = useFontsReady([config.theme.font, config.theme.headingFont]);
  const data = useMemo(() => mockData(DATE, config.profile.login, config.profile.name, config.profile.location.timezone), [config]);
  const rows = useMemo(() => (ready ? renderLayout(config, data, mode, DATE).slice(0, maxRows) : []), [ready, config, data, mode, maxRows]);
  const bg = mode === "dark" ? "#0d1117" : "#ffffff";
  return (
    <div className="preset-thumb" style={{ background: bg, height, ["--thumb-bg" as string]: bg }} aria-hidden="true">
      {rows.map((r) => {
        const imgs = r.parts.filter((p) => p.meta.kind !== "markdown");
        if (!imgs.length) return null;
        const fixed = imgs.every((p) => p.meta.fixedHeight);
        if (fixed)
          return (
            <div key={r.rowId} style={{ display: "flex", gap: 4, justifyContent: "center", height: 16 }}>
              {imgs.slice(0, 5).map((p) => (
                <WidgetImage key={p.meta.name} part={p} style={{ height: "100%", width: "auto" }} />
              ))}
            </div>
          );
        return (
          <div key={r.rowId} className={imgs.length > 1 ? "pair" : undefined} style={imgs.length > 2 ? { gridTemplateColumns: `repeat(${imgs.length}, 1fr)` } : undefined}>
            {imgs.map((p) => (
              <WidgetImage key={p.meta.name} part={p} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
