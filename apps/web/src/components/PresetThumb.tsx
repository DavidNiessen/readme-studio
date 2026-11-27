import { layoutPresets, mockData, presetConfig, type Mode, type Motion, type ProfileData, type StudioConfig } from "@readme-studio/core";
import { useMemo } from "react";
import { renderLayout, useFontsReady } from "../lib/render";
import { WidgetImage } from "./WidgetImage";

const DATE = new Date();
const data = new Map<string, ProfileData>();
const configs = new Map<string, StudioConfig>();

/** A preset's config, optionally with its motion overridden; the same object each time, so renders are cached. */
export function thumbConfig(id: string, motion?: Motion): StudioConfig {
  const key = `${id}|${motion ?? ""}`;
  let c = configs.get(key);
  if (!c) {
    const base = presetConfig(id);
    configs.set(key, (c = motion ? { ...base, theme: { ...base.theme, motion } } : base));
  }
  return c;
}

/** The rows of a preset's README in one colour scheme (cached by the renderer). */
export function presetRows(id: string, mode: Mode, motion?: Motion, maxRows = 5) {
  const config = thumbConfig(id, motion);
  const k = `${config.profile.login}|${config.profile.location.timezone}`;
  let d = data.get(k);
  if (!d) data.set(k, (d = mockData(DATE, config.profile.login, "", config.profile.location.timezone)));
  return renderLayout(config, d, mode, DATE).slice(0, maxRows);
}

/** A scaled-down, live render of the top of a layout preset. */
export function PresetThumb({
  id,
  mode: forced,
  height = 210,
  maxRows = 5,
  motion,
}: {
  id: string;
  mode?: Mode;
  height?: number;
  maxRows?: number;
  /** overrides the preset's motion, e.g. "off" for a still preview */
  motion?: Motion;
}) {
  const mode: Mode = forced ?? (layoutPresets.find((p) => p.id === id)?.tags.includes("light-first") ? "light" : "dark");
  const config = thumbConfig(id, motion);
  const ready = useFontsReady([config.theme.font, config.theme.headingFont]);
  const rows = useMemo(() => (ready ? presetRows(id, mode, motion, maxRows) : []), [ready, id, mode, motion, maxRows]);
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
          <div
            key={r.rowId}
            className={imgs.length > 1 ? "pair" : undefined}
            style={imgs.length > 2 ? { gridTemplateColumns: `repeat(${imgs.length}, 1fr)` } : undefined}
          >
            {imgs.map((p) => (
              <WidgetImage key={p.meta.name} part={p} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
