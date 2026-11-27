/**
 * Machine-readable descriptions of widgets, presets, palettes and fonts, for AI agents and tools.
 * Published by the site as widgets.json / presets.json / llms.txt and printed by the CLI.
 */
import { CONFIG_VERSION, SCHEMA_URL, type DesignKind } from "./config";
import { FONTS } from "./fonts";
import { layoutPresets } from "./presets";
import { palettePresets } from "./theme";
import { iconList, moreIconsLoaded } from "./lib/icons";
import { glyphNames } from "./widgets/parts";
import { widgetList } from "./widgets/registry";
import { PLACEHOLDERS } from "./widgets/placeholders";
import { widgetFits, type Field } from "./widgets/types";
import { ACTION_REF, STUDIO_URL } from "./workflow";

export interface OptionInfo {
  key: string;
  label: string;
  type: Field["type"];
  default: unknown;
  help?: string;
  /** allowed values for select / segmented / checklist */
  choices?: { value: string; label: string }[];
  min?: number;
  max?: number;
  /** fields of each item, for list options */
  item?: OptionInfo[];
  /** only applies when another option has one of these values */
  when?: { key: string; is: unknown[] };
}

export interface WidgetInfo {
  type: string;
  title: string;
  description: string;
  category: string;
  /** svg: animated image; gif: raster animation; markdown: written into the README as text */
  output: "svg" | "gif" | "markdown";
  width: "full" | "half" | "third";
  scope: "profile" | "project" | "any";
  needs: string[];
  /** one image per item (e.g. one per social link) */
  multiPart: boolean;
  options: OptionInfo[];
}

function optionInfo(f: Field, defaults: Record<string, unknown>): OptionInfo {
  const o: OptionInfo = { key: f.key, label: f.label, type: f.type, default: defaults[f.key] };
  if (f.help) o.help = f.help;
  if (f.when) o.when = f.when;
  if (f.type === "select" || f.type === "segmented" || f.type === "checklist") o.choices = f.options;
  if (f.type === "number") Object.assign(o, { min: f.min, max: f.max });
  if ((f.type === "tags" || f.type === "checklist" || f.type === "list" || f.type === "text") && f.max) o.max = f.max;
  if (f.type === "list") {
    const sample = (f.newItem ?? {}) as Record<string, unknown>;
    o.item = f.item.map((i) => optionInfo(i, sample));
  }
  return o;
}

/** All widgets (optionally only those that fit a kind of README), with their options. */
export function widgetCatalog(kind?: DesignKind): WidgetInfo[] {
  return widgetList
    .filter((w) => !kind || widgetFits(w, kind))
    .map((w) => ({
      type: w.type,
      title: w.title,
      description: w.description,
      category: w.category,
      output: w.kind,
      width: w.width,
      scope: w.scope ?? "any",
      needs: w.needs ?? [],
      multiPart: Boolean(w.parts),
      options: w.fields.map((f) => optionInfo(f, w.defaults as Record<string, unknown>)),
    }));
}

export interface PresetInfo {
  id: string;
  kind: DesignKind;
  name: string;
  description: string;
  tags: string[];
  palette: string;
  widgets: string[];
}

export function presetCatalog(kind?: DesignKind): PresetInfo[] {
  return layoutPresets
    .filter((p) => !kind || (p.kind ?? "profile") === kind)
    .map((p) => ({
      id: p.id,
      kind: p.kind ?? "profile",
      name: p.name,
      description: p.description,
      tags: p.tags,
      palette: p.theme.preset ?? "crimson",
      widgets: p.rows.flatMap((r) => (Array.isArray(r) ? r : r.blocks)).map((b) => b.type),
    }));
}

export function themeCatalog(): { palettes: { id: string; name: string; description: string }[]; fonts: { id: string; name: string; category: string }[] } {
  return {
    palettes: palettePresets.map((p) => ({ id: p.id, name: p.name, description: p.description })),
    fonts: FONTS.map((f) => ({ id: f.id, name: f.name, category: f.category })),
  };
}

function optionLine(o: OptionInfo, indent = ""): string {
  const bits = [`\`${o.key}\` (${o.type}${o.choices ? `: ${o.choices.map((c) => c.value).join(" | ")}` : ""}${o.min !== undefined ? `, ${o.min}–${o.max}` : ""})`];
  bits.push(`default ${JSON.stringify(o.default)}`);
  if (o.help) bits.push(o.help);
  const head = `${indent}- ${bits.join(" · ")}`;
  return o.item ? `${head}\n${o.item.map((i) => optionLine(i, `${indent}  `)).join("\n")}` : head;
}

/** A compact, agent-oriented guide to the product (llms.txt). */
export function llmsTxt(): string {
  const w = widgetCatalog();
  const t = themeCatalog();
  return `# Readme Studio

> Design animated, self-updating GitHub READMEs (profile READMEs and project/repository READMEs) as a JSON config. A GitHub Action (\`${ACTION_REF}\`) renders every widget to dark/light SVG (or GIF), pushes the images to an asset branch and rewrites README.md on a schedule.

Everything is driven by one file, \`readme.config.json\` (schema: ${SCHEMA_URL}). An agent can create it, validate it, render it offline and hand the user a link to fine-tune it visually.

## Workflow for agents

1. Get the CLI (self-contained bundle, no install):
   \`git clone --depth 1 https://github.com/DavidNiessen/readme-studio ~/.cache/readme-studio\`
   then \`node ~/.cache/readme-studio/packages/engine/dist/cli.mjs <command>\`.
2. Discover: \`widgets --json [--kind profile|project]\`, \`presets --json\`, \`themes --json\`, \`schema\`.
3. Start: \`init --login <user> [--kind project --repo owner/name --npm <pkg>] [--preset <id>] --workflow\`
   writes readme.config.json and .github/workflows/readme-studio.yml in the current directory.
4. Edit readme.config.json (layout rows → blocks with \`type\`, \`id\`, \`options\`; theme; profile/project).
5. Check: \`validate --json\` (repairs are reported as warnings), then \`build --mock --out /tmp/rs\` renders every asset and README.md offline (open preview.html to look at it).
6. Hand off: \`link\` prints a ${STUDIO_URL} URL that opens the design in the visual studio.
   A committed config can also be opened with ${STUDIO_URL}#/studio?repo=owner/name.
7. Commit readme.config.json, README.md (from the build) and the workflow; the user enables
   Settings → Actions → General → Workflow permissions → Read and write, and runs the "Readme Studio" workflow once.

## Config essentials

- \`kind\`: "profile" (the <login>/<login> repository) or "project" (any public repository; set \`project.repo\`).
- \`profile\`: \`login\` (whose data is fetched), \`location\` (city, latitude, longitude, timezone) and \`links\`. \`project\`: \`repo\` and \`packages\` (npm, pypi, crates).
- Names, roles, bios, taglines and logos are options of the widgets that show them (hero \`title\`/\`roles\`, about \`name\`/\`bio\`, project-hero \`title\`/\`tagline\`/\`emblem\`) and default to the GitHub profile or repository.
- \`layout\`: array of rows \`{ align, blocks: [{ id, type, options, hidden?, link? }] }\`. Blocks in one row sit side by side (use half-width widgets in pairs). \`id\` becomes the image file name.
- \`theme\`: \`preset\` (palette), \`font\`, \`headingFont\`, \`radius\`, \`border\`, \`texture\` (dots|grid|lines|none), \`motion\` (full|subtle|off), \`surface\`, optional \`accent\` to generate a palette.
- \`output\`: \`branch\` (asset branch, default "readme-studio"), \`modes\` (["dark","light"]), \`schedule\` (cron), \`repository\`.
- Free text accepts placeholders: ${PLACEHOLDERS.map((p) => p.token).join(" ")}.
- Icon options take a line icon (\`rocket\`, \`database\`, \`git-branch\`) or a brand (\`rust\`, \`docker\`, \`figma\`). llms-full.txt lists every id.
- Unknown widgets are skipped and invalid values repaired; \`validate\` lists every repair.

## Palettes

${t.palettes.map((p) => `- \`${p.id}\`: ${p.name}. ${p.description}`).join("\n")}

## Fonts

${t.fonts.map((f) => `\`${f.id}\``).join(", ")}

## Presets

${presetCatalog()
  .map((p) => `- \`${p.id}\` (${p.kind}): ${p.name}. ${p.description}`)
  .join("\n")}

## Widgets (${w.length})

${w.map((x) => `- \`${x.type}\` (${x.scope === "any" ? "profile + project" : x.scope}, ${x.width}): ${x.title}. ${x.description}`).join("\n")}

Full option reference: ${STUDIO_URL}llms-full.txt · JSON: ${STUDIO_URL}widgets.json, ${STUDIO_URL}presets.json
`;
}

/** llms.txt plus every widget's options. */
export function llmsFullTxt(): string {
  const w = widgetCatalog();
  const brands = iconList().map((i) => i.id);
  return `${llmsTxt()}
## Widget options

${w
  .map(
    (x) => `### ${x.type}

${x.title}: ${x.description}
Category ${x.category} · output ${x.output} · width ${x.width} · for ${x.scope === "any" ? "profile and project" : x.scope} READMEs${x.multiPart ? " · one image per item" : ""}

${x.options.length ? x.options.map((o) => optionLine(o)).join("\n") : "No options."}
`,
  )
  .join("\n")}
## Icons

Any option of type icon takes one of these ids. Line icons are drawn in the theme's colours; brands keep their own colour where the widget allows it.

Line icons (${glyphNames.length}): ${glyphNames.join(", ")}

Brands (${brands.length}${moreIconsLoaded() ? "" : ", built-in set only"}): ${brands.join(", ")}

Config version ${CONFIG_VERSION}.
`;
}
