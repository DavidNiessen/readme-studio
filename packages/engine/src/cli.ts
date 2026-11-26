/**
 * readme-studio CLI
 *
 *   readme-studio build    [--config readme.config.json] [--out dist] [--mock] [--only=id,id] [--now=ISO]
 *   readme-studio validate [--config readme.config.json]
 *   readme-studio init     [--login you] [--preset id] [--config readme.config.json]
 *   readme-studio presets
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { layoutPresets, presetConfig, serializeConfig, workflowYaml } from "@readme-studio/core";
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

const HELP = `readme-studio: build animated GitHub profile READMEs

Commands
  build      Render all assets + README.md into --out (default: dist)
  validate   Check a config and print warnings
  init       Write a starter readme.config.json and workflow
  presets    List the built-in design presets

Options
  --config <path>   config file (default: readme.config.json)
  --out <dir>       output directory for build (default: dist)
  --mock            use deterministic sample data, no network
  --only=a,b        only render these block ids
  --now=<ISO date>  pretend it is this moment
  --login <user>    GitHub login for init
  --preset <id>     design preset for init

Environment
  GITHUB_TOKEN / PROFILE_TOKEN   enables GraphQL (exact totals, private counts)
`;

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  const configPath = resolve(flag(args, "config") ?? "readme.config.json");
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
      console.log(`\n${res.assets.length} assets → ${out} (open preview.html to see the layout)`);
      if (res.errors.length) {
        console.error(res.errors.join("\n"));
        process.exit(1);
      }
      break;
    }
    case "validate": {
      const { config, warnings } = readConfig(configPath);
      const blocks = config.layout.reduce((a, r) => a + r.blocks.length, 0);
      if (warnings.length) warnings.forEach((w) => console.warn(`⚠ ${w}`));
      console.log(`${configPath}: ${config.layout.length} rows, ${blocks} blocks, theme ${config.theme.preset}${warnings.length ? `, ${warnings.length} warning(s)` : ", valid"}`);
      process.exit(warnings.length ? 2 : 0);
      break;
    }
    case "init": {
      if (existsSync(configPath) && flag(args, "force") !== "true") throw new Error(`${configPath} exists (use --force to overwrite)`);
      const login = flag(args, "login") ?? "octocat";
      const config = presetConfig(flag(args, "preset") ?? "command-center", { login, name: login });
      writeFileSync(configPath, serializeConfig(config));
      console.log(`wrote ${configPath}\n\nAdd this workflow as .github/workflows/readme.yml:\n\n${workflowYaml(config)}`);
      break;
    }
    case "presets":
      for (const p of layoutPresets) console.log(`${p.id.padEnd(22)} ${p.name}: ${p.description}`);
      break;
    default:
      console.log(HELP);
      if (cmd && cmd !== "help" && cmd !== "--help") process.exit(1);
  }
}

main().catch((e) => {
  console.error(`✖ ${(e as Error).message}`);
  process.exit(1);
});
