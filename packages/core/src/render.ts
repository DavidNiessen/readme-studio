import { type Block, type StudioConfig } from "./config";
import { derive } from "./data/derive";
import type { ProfileData } from "./data/types";
import { localParts } from "./lib/astro";
import { esc } from "./lib/escape";
import { svg, wrapText } from "./lib/svg";
import { resolveTheme, type Mode } from "./theme";
import { getWidget } from "./widgets/registry";
import type { Ctx, GifFrames, ProfileView, ProjectView, WidgetDef } from "./widgets/types";
import { resolveMedia } from "./lib/images";

export interface RenderEnv {
  date?: Date;
  run?: string | null;
}

/** Build the render context for one colour mode. */
export function createCtx(config: StudioConfig, data: ProfileData, mode: Mode, env: RenderEnv = {}): Ctx {
  const date = env.date ?? new Date();
  const d = viewData(config, data);
  const media = Object.fromEntries((config.media ?? []).map((m) => [m.id, m.data]));
  const v = views(config, data);
  return {
    theme: resolveTheme(config.theme, mode),
    data: d,
    d: derive(d),
    now: localParts(date, config.profile.location.timezone),
    date,
    ...v,
    // profile links may use an image from the media library as their icon
    profile: { ...v.profile, links: resolveMedia(v.profile.links, media) },
    project: { ...v.project, logo: resolveMedia(v.project.logo, media) },
    kind: config.kind,
    run: env.run ?? null,
    media,
  };
}

/**
 * What widgets know about the person and the project. Nothing about them is configured globally:
 * each widget has its own name, roles, tagline and so on, and falls back to these, which come from
 * GitHub and from the first widget in the design that sets the value.
 */
export function views(config: StudioConfig, data: ProfileData): { profile: ProfileView; project: ProjectView } {
  const blocks = config.layout.flatMap((r) => r.blocks).filter((b) => !b.hidden);
  const first = <T>(types: string[], key: string, ok: (v: unknown) => v is T): T | undefined => {
    for (const b of blocks) {
      if (!types.includes(b.type)) continue;
      const v = b.options[key] ?? getWidget(b.type)?.defaults[key];
      if (ok(v)) return v;
    }
    return undefined;
  };
  const text = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
  const list = (v: unknown): v is string[] => Array.isArray(v) && v.some((x) => typeof x === "string" && x.trim() !== "");
  const pd = data.project;
  const login = config.profile.login;
  return {
    profile: {
      ...config.profile,
      name: (data.name || "").trim() || login,
      bio: data.bio || "",
      company: (data.company || "").replace(/^@/, "").trim(),
      roles: (first(["hero", "about"], "roles", list) ?? []).filter((r) => typeof r === "string" && r.trim() !== ""),
      pronouns: first(["about", "terminal"], "pronouns", text) ?? "",
      birthday: first(["terminal"], "birthday", (v): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) ?? "",
    },
    project: {
      ...config.project,
      name: config.project.repo.split("/")[1] || pd?.name || "",
      tagline: first(["project-hero"], "tagline", text) ?? pd?.description ?? "",
      logo: first(["project-hero"], "emblem", text) ?? "",
      homepage: pd?.homepage ?? "",
    },
  };
}

/**
 * The data widgets see. In project designs, shared widgets (languages, releases, …)
 * show the repository's numbers instead of the account's.
 */
export function viewData(config: Pick<StudioConfig, "kind">, data: ProfileData): ProfileData {
  const p = data.project;
  if (config.kind !== "project" || !p) return data;
  return { ...data, languages: p.languages, releases: p.releases };
}

/** The slice of context needed to work out parts, alt text and links (no theme). */
export function metaCtx(config: StudioConfig, data: ProfileData): Pick<Ctx, "profile" | "data" | "project" | "kind"> {
  return { ...views(config, data), data: viewData(config, data), kind: config.kind };
}

/** One image (or markdown snippet) produced by a block. */
export interface PartMeta {
  block: Block;
  def: WidgetDef;
  /** part key for multi-part widgets, "" otherwise */
  key: string;
  /** file name without mode/extension, e.g. `stats` or `socials-github` */
  name: string;
  kind: "svg" | "gif" | "markdown";
  alt: string;
  href?: string;
  /** fixed display height in px, for pill-style widgets */
  fixedHeight?: number;
}

export function blockParts(block: Block, ctx: Pick<Ctx, "profile" | "data" | "project" | "kind">): PartMeta[] {
  const def = getWidget(block.type);
  if (!def) return [];
  const o = { ...def.defaults, ...block.options };
  const linkOverride = block.link !== undefined ? block.link || undefined : undefined;
  if (def.parts) {
    return def.parts(ctx, o).map((p) => ({
      block,
      def,
      key: p.key,
      name: `${block.id}-${p.key}`,
      kind: def.kind,
      alt: p.alt,
      href: p.href,
      fixedHeight: def.fixedHeight,
    }));
  }
  let href: string | undefined;
  try {
    href = block.link !== undefined ? linkOverride : def.href?.(ctx, o);
  } catch {
    href = undefined;
  }
  return [{ block, def, key: "", name: block.id, kind: def.kind, alt: def.alt(ctx, o), href, fixedHeight: def.fixedHeight }];
}

/** A visible placeholder when a widget fails, instead of breaking the whole build. */
export function errorCard(ctx: Ctx, title: string, err: unknown): string {
  const t = ctx.theme;
  const msg = err instanceof Error ? err.message : String(err);
  const lines = wrapText(t, msg, 12, 780, 3);
  return svg({
    width: 840,
    height: 96 + lines.length * 16,
    theme: t,
    title: `${title} failed to render`,
    body: `<rect x=".5" y=".5" width="839" height="${95 + lines.length * 16}" rx="${t.radius}" fill="${t.card}" stroke="${t.accent}" stroke-dasharray="4 4"/>
<text x="24" y="40" font-size="14" class="t b">${esc(title)} could not be rendered</text>
${lines.map((l, i) => `<text x="24" y="${66 + i * 16}" font-size="12" class="m">${esc(l)}</text>`).join("")}`,
  });
}

/** Render one part of a block to SVG (or markdown text for markdown widgets). */
export function renderPart(part: PartMeta, ctx: Ctx): string {
  // images from the media library are swapped in here, so a replaced image reaches every widget using it
  const o = resolveMedia({ ...part.def.defaults, ...part.block.options }, ctx.media ?? {});
  try {
    if (part.key && part.def.renderPart) return part.def.renderPart(ctx, o, part.key);
    return part.def.render(ctx, o);
  } catch (e) {
    if (part.kind === "markdown") return `<!-- ${part.block.id} failed: ${e instanceof Error ? e.message : String(e)} -->`;
    return errorCard(ctx, part.def.title, e);
  }
}

/** Frames for GIF widgets; falls back to a single static frame. */
export function renderFrames(part: PartMeta, ctx: Ctx): GifFrames {
  const o = resolveMedia({ ...part.def.defaults, ...part.block.options }, ctx.media ?? {});
  if (part.def.frames) {
    try {
      return part.def.frames(ctx, o);
    } catch (e) {
      const s = errorCard(ctx, part.def.title, e);
      return { width: 840, height: 120, frames: [{ svg: s, delay: 1000 }] };
    }
  }
  const s = renderPart(part, ctx);
  const m = /width="(\d+)" height="(\d+)"/.exec(s);
  return { width: m ? +m[1] : 840, height: m ? +m[2] : 200, frames: [{ svg: s, delay: 1000 }] };
}

/** All visible parts of a config in layout order. */
export function layoutParts(config: StudioConfig, data: ProfileData): PartMeta[][] {
  const ctx = metaCtx(config, data);
  return config.layout.map((row) => row.blocks.filter((b) => !b.hidden).flatMap((b) => blockParts(b, ctx)));
}

export function assetFileName(name: string, mode: Mode, kind: "svg" | "gif" | "markdown"): string {
  return `${name}-${mode}.${kind === "gif" ? "gif" : "svg"}`;
}

/** Fonts referenced by a config (for preloading). */
export function configFonts(config: StudioConfig): string[] {
  return [config.theme.font, config.theme.headingFont];
}
