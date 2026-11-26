/**
 * GitHub Action entry point (see action.yml at the repository root).
 * Builds the assets for readme.config.json, publishes them to the asset branch
 * and commits README.md when the layout changed.
 */
import { appendFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "./build";
import { readConfig } from "./io";
import { commitReadme, publishAssets } from "./publish";

function input(name: string, fallback = ""): string {
  const v = process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`];
  return v === undefined || v === "" ? fallback : v.trim();
}

function bool(name: string, fallback: boolean): boolean {
  const v = input(name, String(fallback)).toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function output(name: string, value: string): void {
  const f = process.env.GITHUB_OUTPUT;
  if (f) appendFileSync(f, `${name}=${value}\n`);
}

function summary(md: string): void {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) appendFileSync(f, `${md}\n`);
}

function mask(secret: string): void {
  if (secret) console.log(`::add-mask::${secret}`);
}

async function main(): Promise<void> {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const configPath = resolve(workspace, input("config", "readme.config.json"));
  const token = input("token", process.env.GITHUB_TOKEN ?? "");
  const profileToken = input("profile-token");
  mask(token);
  mask(profileToken);
  const event = process.env.GITHUB_EVENT_NAME ?? "";
  const dryRun = bool("dry-run", false) || event === "pull_request";
  const mock = bool("mock", false);
  const repository = process.env.GITHUB_REPOSITORY ?? "";

  const { config, warnings } = readConfig(configPath);
  for (const w of warnings) console.log(`::warning file=${input("config", "readme.config.json")}::${w}`);
  const branch = input("asset-branch", config.output.branch);
  config.output.branch = branch;
  const assetRepo = config.output.repository || repository || `${config.profile.login}/${config.profile.login}`;
  if (config.output.repository && repository && config.output.repository.toLowerCase() !== repository.toLowerCase()) {
    console.log(`::warning::output.repository (${config.output.repository}) differs from this repository (${repository}); assets are pushed here, so README links use ${repository}.`);
  }
  const assetBase = `https://raw.githubusercontent.com/${repository || assetRepo}/${branch}`;
  const outDir = input("output-dir") ? resolve(workspace, input("output-dir")) : mkdtempSync(join(tmpdir(), "readme-studio-"));

  console.log(`::group::Render ${config.layout.reduce((a, r) => a + r.blocks.length, 0)} blocks for @${config.profile.login}`);
  const result = await build({
    config,
    outDir,
    mock,
    run: process.env.GITHUB_RUN_NUMBER ?? null,
    token: profileToken || token || undefined,
    assetBase,
    log: (m) => console.log(m),
  });
  console.log("::endgroup::");
  output("assets-dir", outDir);
  output("data-source", result.data.source);

  const total = result.assets.reduce((a, x) => a + x.bytes, 0);
  summary(
    `### Readme Studio\n\nRendered **${result.assets.length}** assets (${(total / 1024 / 1024).toFixed(2)} MB) from **${result.data.source}** data for @${config.profile.login}.\n\n| file | size | time |\n|---|---:|---:|\n${result.assets
      .map((a) => `| \`${a.file}\` | ${(a.bytes / 1024).toFixed(1)} KB | ${a.ms.toFixed(0)} ms |`)
      .join("\n")}`,
  );

  if (result.errors.length) {
    for (const e of result.errors) console.log(`::error::${e}`);
    throw new Error(`${result.errors.length} asset(s) failed`);
  }

  if (dryRun) {
    console.log(`Dry run${event === "pull_request" ? " (pull request)" : ""}: nothing published. Assets are in ${outDir}.`);
    output("readme-changed", "false");
    return;
  }
  if (!token) throw new Error("No token available to publish. Pass `token` or grant `permissions: contents: write`.");
  if (!repository) throw new Error("GITHUB_REPOSITORY is not set; cannot publish outside GitHub Actions (use dry-run).");

  console.log(`Publishing assets to ${repository}@${branch}`);
  const readmeTmp = join(outDir, "README.md");
  // publishing turns outDir into a throwaway git repo, so keep the README aside first
  const keep = join(mkdtempSync(join(tmpdir(), "readme-studio-md-")), "README.md");
  copyFileSync(readmeTmp, keep);
  publishAssets({ dir: outDir, repository, branch, token, server: process.env.GITHUB_SERVER_URL });

  let changed = false;
  if (bool("commit-readme", true)) {
    changed = commitReadme({ source: keep, target: input("readme-path", "README.md"), workspace });
    console.log(changed ? "README.md updated and pushed." : "README.md unchanged.");
  }
  output("readme-changed", String(changed));
}

main().catch((e) => {
  console.log(`::error::${(e as Error).message}`);
  process.exit(1);
});
