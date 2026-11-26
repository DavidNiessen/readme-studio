/**
 * readme-studio CLI: everything the studio does, scriptable (and friendly to AI agents).
 * Run with `node packages/engine/dist/cli.mjs <command>` (self-contained) or `npx tsx packages/engine/src/cli.ts`.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import {
  allBlocks,
  configJsonSchema,
  getLayoutPreset,
  getWidget,
  layoutPresets,
  presetCatalog,
  presetConfig,
  serializeConfig,
  STUDIO_URL,
  themeCatalog,
  widgetCatalog,
  workflowYaml,
  type DesignKind,
  type StudioConfig,
  WORKFLOW_FILE,
} from "@readme-studio/core";
import { build } from "./build";
import { readConfig } from "./io";

function flag(args: string[], name: string): string | undefined {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const a = args[i];
  if (a.includes("=")) return a.slice(a.indexOf("=") + 1);
  const next = args[i + 1];
  return next && !next.startsWith("--") ? next : "true";
}

const HELP = `readme-studio: animated, self-updating GitHub READMEs (profile and project)

Commands
  init       Write readme.config.json from a preset (and the workflow with --workflow)
  validate   Check a config; lists every repair (exit 2 when something was repaired)
  build      Render all assets, README.md and preview.html into --out
  link       Print a studio URL that opens the config in the visual editor
  widgets    List widgets and their options (--kind, --type, --json)
  presets    List design presets (--kind, --json)
  themes     List palettes and fonts (--json)
  schema     Print the JSON Schema of readme.config.json

Options
  --config <path>     config file (default: readme.config.json)
  --json              machine-readable output (widgets, presets, themes, validate)
  --kind <kind>       profile | project
  --type <widget>     one widget's full option reference (widgets)

  init
  --login <user>      GitHub login (profile READMEs: the <login>/<login> repository)
  --repo <owner/name> repository (project READMEs; implies --kind project)
  --npm/--pypi/--crate <name>   published package (project READMEs)
  --preset <id>       design preset (default: command-center, or oss-library for projects)
  --workflow          also write .github/workflows/readme-studio.yml
  --force             overwrite existing files

  build
  --out <dir>         output directory (default: dist)
  --mock              deterministic sample data, no network
  --readme <path>     also copy the generated README.md to this path
  --only=a,b          only render these block ids
  --now=<ISO date>    pretend it is this moment

Environment
  GITHUB_TOKEN / PROFILE_TOKEN   enables GraphQL (exact totals, private counts)

Docs: ${STUDIO_URL}#/docs · agent guide: ${STUDIO_URL}llms.txt
`;

/** Studio share token: base64url(zlib(JSON)), the format the studio's ?design= link reads. */
export function shareToken(c: StudioConfig): string {
  const { $schema: _drop, ...rest } = c;
  return deflateSync(Buffer.from(JSON.stringify(rest)), { level: 9 }).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function kindOf(args: string[]): DesignKind | undefined {
  const k = flag(args, "kind");
  if (k === undefined) return undefined;
  if (k !== "profile" && k !== "project") throw new Error(`--kind must be profile or project, not "${k}"`);
  return k;
}

function print(v: unknown): void {
  process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  const configPath = resolve(flag(args, "config") ?? "readme.config.json");
  const json = flag(args, "json") === "true";
  switch (cmd) {
    case "build": {
      const { config, warnings } = readConfig(configPath);
      warnings.forEach((w) => console.warn(`⚠ ${w}`));
      const out = resolve(flag(args, "out") ?? "dist");
      const now = flag(args, "now");
      const res = await build({
        config,
        outDir: out,
        mock: flag(args, "mock") === "true",
        only: flag(args, "only")?.split(","),
        now: now ? new Date(now) : undefined,
        token: process.env.PROFILE_TOKEN || process.env.GITHUB_TOKEN || undefined,
        log: (m) => console.log(m),
      });
      const readme = flag(args, "readme");
      if (readme && readme !== "true") {
        mkdirSync(dirname(resolve(readme)), { recursive: true });
        copyFileSync(join(out, "README.md"), resolve(readme));
        console.log(`README.md → ${resolve(readme)}`);
      }
      console.log(`\n${res.assets.length} assets → ${out} (open preview.html to see the layout)`);
      if (res.errors.length) {
        console.error(res.errors.join("\n"));
        process.exit(1);
      }
      break;
    }
    case "validate": {
      const raw = existsSync(configPath) ? readFileSync(configPath, "utf8") : null;
      if (raw === null) throw new Error(`config not found: ${configPath}`);
      const { config, warnings } = readConfig(configPath);
      const blocks = allBlocks(config);
      if (json) {
        print({
          valid: warnings.length === 0,
          warnings,
          kind: config.kind,
          repository: config.kind === "project" ? config.project.repo : `${config.profile.login}/${config.profile.login}`,
          rows: config.layout.length,
          blocks: blocks.map((b) => ({ id: b.id, type: b.type, hidden: Boolean(b.hidden), fits: !getWidget(b.type)?.scope || getWidget(b.type)!.scope === "any" || getWidget(b.type)!.scope === config.kind })),
          normalized: config,
        });
      } else {
        warnings.forEach((w) => console.warn(`⚠ ${w}`));
        const misfits = blocks.filter((b) => {
          const s = getWidget(b.type)?.scope;
          return s && s !== "any" && s !== config.kind;
        });
        misfits.forEach((b) => console.warn(`⚠ ${b.id} (${b.type}) is meant for ${getWidget(b.type)!.scope} READMEs`));
        console.log(`${configPath}: ${config.kind}, ${config.layout.length} rows, ${blocks.length} blocks, theme ${config.theme.preset}${warnings.length ? `, ${warnings.length} repair(s)` : ", valid"}`);
      }
      process.exit(warnings.length ? 2 : 0);
      break;
    }
    case "init": {
      const repo = flag(args, "repo");
      const kind: DesignKind = kindOf(args) ?? (repo ? "project" : "profile");
      const presetId = flag(args, "preset") ?? (kind === "project" ? "oss-library" : "command-center");
      if (!layoutPresets.some((p) => p.id === presetId)) throw new Error(`unknown preset "${presetId}"; run: presets`);
      const login = flag(args, "login") ?? repo?.split("/")[0] ?? "octocat";
      const files: [string, string][] = [];
      if (existsSync(configPath) && flag(args, "force") !== "true") throw new Error(`${configPath} exists (use --force to overwrite)`);
      const base = presetConfig(presetId, { login, name: login }, repo ? { repo, packages: { npm: flag(args, "npm") ?? "", pypi: flag(args, "pypi") ?? "", crates: flag(args, "crate") ?? "" } } : {});
      const config: StudioConfig = { ...base, kind };
      files.push([configPath, serializeConfig(config)]);
      const wantWorkflow = flag(args, "workflow") === "true";
      const wf = resolve(dirname(configPath), WORKFLOW_FILE);
      if (wantWorkflow) {
        if (existsSync(wf) && flag(args, "force") !== "true") throw new Error(`${wf} exists (use --force to overwrite)`);
        files.push([wf, workflowYaml(config)]);
      }
      for (const [p, content] of files) {
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, content);
        console.log(`wrote ${p}`);
      }
      if (getLayoutPreset(presetId).kind && getLayoutPreset(presetId).kind !== kind) console.warn(`⚠ preset ${presetId} is made for ${getLayoutPreset(presetId).kind} READMEs`);
      if (!wantWorkflow) console.log(`\nAdd the workflow with --workflow, or as ${WORKFLOW_FILE}:\n\n${workflowYaml(config)}`);
      console.log(`\nNext: edit the config, run validate and build --mock, or open it in the studio: run link`);
      break;
    }
    case "link": {
      const { config } = readConfig(configPath);
      const base = (flag(args, "base") ?? STUDIO_URL).replace(/\/?$/, "/");
      console.log(`${base}#/studio?design=${shareToken(config)}`);
      break;
    }
    case "widgets": {
      const type = flag(args, "type");
      const list = widgetCatalog(kindOf(args));
      if (type) {
        const w = list.find((x) => x.type === type);
        if (!w) throw new Error(`unknown widget "${type}"; run: widgets`);
        print(w);
      } else if (json) print({ widgets: list });
      else for (const w of list) console.log(`${w.type.padEnd(18)} ${w.width.padEnd(5)} ${w.scope.padEnd(8)} ${w.title}: ${w.description}`);
      break;
    }
    case "presets": {
      const list = presetCatalog(kindOf(args));
      if (json) print({ presets: list });
      else for (const p of list) console.log(`${p.id.padEnd(22)} ${p.kind.padEnd(8)} ${p.name}: ${p.description}`);
      break;
    }
    case "themes": {
      const t = themeCatalog();
      if (json) print(t);
      else {
        console.log("Palettes");
        for (const p of t.palettes) console.log(`  ${p.id.padEnd(12)} ${p.name}: ${p.description}`);
        console.log("\nFonts");
        for (const f of t.fonts) console.log(`  ${f.id.padEnd(16)} ${f.category.padEnd(6)} ${f.name}`);
      }
      break;
    }
    case "schema":
      print(configJsonSchema());
      break;
    default:
      console.log(HELP);
      if (cmd && cmd !== "help" && cmd !== "--help") process.exit(1);
  }
}

if (process.argv[1] && /cli\.(m?[jt]s)$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(`✖ ${(e as Error).message}`);
    process.exit(1);
  });
}
