<div align="center">

# Readme Studio

**Design animated, self-updating READMEs for your GitHub profile and your projects, in the browser.**<br>
A GitHub Action re-renders every image on a schedule, so streaks, stars, contributors and releases are never stale.

[Open the studio](https://readme.niessen.dev/#/studio) · [Presets](https://readme.niessen.dev/#/presets) · [Docs](https://readme.niessen.dev/#/docs)

</div>

---

## What it is

Readme Studio has three parts:

| Part | Where | What it does |
|---|---|---|
| **Studio** | [`apps/web`](apps/web) | A web designer (hosted on GitHub Pages). Design a **profile** README or a **project** README: pick one of 18 presets or start blank, arrange 54 widgets, tune 17 palettes, 12 typefaces, radius, texture and motion, and preview in GitHub's dark and light themes at desktop or phone width. Exports a ready-to-commit project. |
| **Action** | [`action.yml`](action.yml), [`packages/engine`](packages/engine) | Runs in your profile or project repository on a cron. Fetches your GitHub data (account or repository), renders every widget as an animated SVG (or GIF), force-pushes the images to an asset branch and updates `README.md` when the layout changed. |
| **Core** | [`packages/core`](packages/core) | The isomorphic renderer shared by both: themes, fonts with real text metrics, widgets, the config schema and the README composer. The studio preview and the action produce byte-identical SVGs. |

Everything is static: no server, no database, no third-party image host. Your design lives in your browser and in your repository.

## Quick start

1. Open the [studio](https://readme.niessen.dev/#/studio) and design your README (or pick a preset).
2. Click **Export** and download the project. It contains:
   ```
   readme.config.json              your design
   .github/workflows/readme.yml    the scheduled workflow
   README.md                       the generated layout
   SETUP.md                        these steps in detail
   ```
3. Push the files to the repository named after your username (`<you>/<you>`).
4. In **Settings → Actions → General**, set **Workflow permissions** to **Read and write**, then run the `readme` workflow once from the **Actions** tab.

From then on the README rebuilds itself on the schedule you picked.

## The action

```yaml
name: readme
on:
  schedule:
    - cron: "17 2 * * *"
  workflow_dispatch:
  push:
    paths: [readme.config.json, .github/workflows/readme.yml]

permissions:
  contents: write

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: DavidNiessen/readme-studio@v1
        with:
          config: readme.config.json
          # profile-token: ${{ secrets.PROFILE_TOKEN }}
```

| Input | Default | Description |
|---|---|---|
| `config` | `readme.config.json` | Path to the config exported from the studio. |
| `token` | `${{ github.token }}` | Pushes the assets and README (needs `contents: write`). |
| `profile-token` | | Optional fine-grained PAT for private contribution counts and exact totals. |
| `asset-branch` | `output.branch` | Branch the rendered images are force-pushed to. |
| `commit-readme` | `true` | Commit `README.md` when the generated layout changed. |
| `readme-path` | `README.md` | Where to write the README. |
| `output-dir` | temp dir | Keep the rendered files here. |
| `mock` | `false` | Deterministic sample data instead of the API (testing). |
| `dry-run` | `false` | Render only. Pull requests always run dry. |

Outputs: `assets-dir`, `readme-changed`, `data-source`.

**Data sources.** With a token the action uses GitHub GraphQL (calendar, totals, pinned repos, languages, releases). Without one it falls back to the REST API plus the public contributions calendar. Weather comes from Open-Meteo, blog posts from any RSS/Atom feed. Only public repositories are ever named.

## Project READMEs

Switch a design to **Project**, enter `owner/name` and, if you publish one, the npm, PyPI or crates.io package. Project widgets then read that repository: a project hero, live shields (one clickable image per badge), an install terminal, a code snippet, a features grid, repository stats, star history, a contributor wall with embedded avatars, weekly commit activity, repository vitals with CI status, package downloads, a changelog from your releases, a roadmap from your milestones, a sponsor card and a table of contents. Prose stays real Markdown, so docs remain searchable. The action runs in the project repository and publishes the images to an orphan branch there.

## Widgets

<details>
<summary><b>54 widgets in 7 categories</b></summary>

| Category | Widgets |
|---|---|
| Header | Hero banner, statement banner, project hero |
| Identity | Social pills, terminal, tech-stack orbit, about card, quick facts, badges, skills, timeline, contact card, local clock, shields, contributor wall, support card |
| Stats | Stats board, languages, trophies, streak card, language donut, year in review, follower milestone, repository stats, repository vitals, downloads |
| Activity | Contribution graph, heartbeat, 3D skyline (GIF), coding rhythm, journey, departure board, trend chart, weekday rhythm, harvester, star history, commit activity |
| Projects | Now building, project card, top repositories, releases, latest posts, changelog, roadmap |
| Content | Today (date, moon, weather, quote), quote, markdown text, install command, code snippet, features grid, table of contents |
| Decoration | Divider, footer, section heading |

</details>

Every widget is hand-drawn SVG with CSS/SMIL animation (no JavaScript, so it survives GitHub's sanitiser). Every one respects three motion levels and `prefers-reduced-motion`, renders twice (dark and light) and is served with `<picture>` so it matches the visitor's theme.

## Development

Requires Node 22.

```bash
npm ci
npm run dev          # studio at http://localhost:5173
npm test             # core + engine tests
npm run typecheck
npm run example      # render examples/ with sample data → examples/dist/preview.html
npm run bundle       # rebuild packages/engine/dist (commit the result)
```

CLI:

```bash
npx tsx packages/engine/src/cli.ts build --config readme.config.json --out dist [--mock] [--only=hero,stats] [--now=2026-12-31T23:00:00Z]
npx tsx packages/engine/src/cli.ts validate --config readme.config.json
npx tsx packages/engine/src/cli.ts init --login you --preset minimal-paper   # or --preset oss-library
npx tsx packages/engine/src/cli.ts presets
```

### Layout

```
apps/web            Vite + React studio, landing page, presets and docs (GitHub Pages)
packages/core       renderer: themes, fonts + metrics, widgets, config schema, README composer
packages/engine     Node runtime: live data, scraping fallback, resvg GIF raster, CLI, publisher, action entry
examples            the project the studio exports, rendered by CI
scripts             asset generation (fonts, icons), JSON schema, widget contact sheet
```

### Adding a widget

1. Create `packages/core/src/widgets/<name>.ts` with `defineWidget({...})`: `type`, `title`, `description`, `category`, `kind`, `width`, `defaults`, `fields` (they generate the inspector UI automatically) and `render(ctx, options)`.
2. Add it to one of the `set-*.ts` lists.
3. Run `npm test`. Every widget is rendered in several palettes, fonts, motion levels and with empty and hostile data, and the output is validated as XML.
4. `npx tsx scripts/preview-widgets.ts /tmp/sheet crimson dark` renders a contact sheet of all widgets.

### Releasing

- **Pre-releases are automatic.** Every push to `main` runs the checks and publishes a GitHub pre-release such as `v1.0.1-42` (next patch plus the run number). Pin one with `uses: DavidNiessen/readme-studio@v1.0.1-42` to try the newest work. Only the newest three are kept, and they never move the `v1` tag.
- **Full releases are manual.** Run **Actions → Release → Run workflow** on `main` and choose a `patch`/`minor`/`major` bump or type an exact version. The workflow runs the checks, commits the version onto a `vX.Y.Z` tag, publishes the release with generated notes, brings `main` up to the new version and moves the floating major tag (`v1`) that profile repositories use.

Commit the action bundle (`npm run bundle`) before merging; CI fails when it is stale.

### GitHub Pages

The `pages` workflow builds `apps/web` on every push to `main`. Enable it once in **Settings → Pages → Source: GitHub Actions**.

## License

MIT © David Nießen. Bundled fonts are licensed under the SIL Open Font License; brand icons come from Simple Icons (CC0) and Font Awesome Free (CC BY 4.0). See [`packages/core/assets/LICENSES.md`](packages/core/assets/LICENSES.md).
