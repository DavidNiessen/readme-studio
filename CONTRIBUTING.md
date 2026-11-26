# Contributing to Readme Studio

Thanks for wanting to help. Bug reports, widget ideas, presets and pull requests are all welcome.

## Before you start

- **Bugs and ideas:** open an issue first, so we agree on the problem before anyone writes code. Use the templates: a bug report with your `readme.config.json` (or a studio share link) and the failing workflow run gets fixed far sooner.
- **Larger changes** (a new data source, a change to the config format, the action's inputs or how assets are published): describe the plan in an issue and wait for a go-ahead.
- **Security problems:** do not open an issue; see [SECURITY.md](SECURITY.md).
- **Questions:** see [SUPPORT.md](SUPPORT.md).

## Setting up

You need [Node.js](https://nodejs.org/) 22 or newer.

```bash
npm ci
npm run dev          # the studio at http://localhost:5173
npm test             # core, engine and studio tests
npm run typecheck
npm run example      # render examples/ with sample data → examples/dist/preview.html
```

## How the code fits together

| Path | What lives there |
|---|---|
| `packages/core` | The isomorphic renderer shared by the studio and the action: config schema and repair (`config.ts`), themes, fonts with glyph metrics, every widget (`src/widgets/`), the README composer, presets and the machine-readable catalog. No Node APIs. |
| `packages/engine` | Node only: live GitHub data with fallbacks, GIF rasterising (resvg), the CLI, publishing to the asset branch and the action entry point. `dist/` is the committed bundle the action runs. |
| `apps/web` | The studio, landing page, presets and docs (React + Vite), deployed to GitHub Pages. |
| `scripts/` | Asset generation (fonts, icons), the published catalog files and a widget contact sheet. |

The studio preview and the action call the same renderer, so a widget that looks right in the studio ships exactly like that.

## Checks

Pull requests run the same checks as [CI](.github/workflows/ci.yml). Run them before you push:

```bash
npm run typecheck
npm test
npm run bundle       # rebuilds packages/engine/dist: commit the result when engine or core changed
npm run build        # the studio
```

CI fails when `packages/engine/dist` is stale, because profile repositories run the committed bundle.

## Adding a widget

1. Create `packages/core/src/widgets/<name>.ts` with `defineWidget({ … })`: `type`, `title`, a one-sentence `description`, `category`, `scope` (`"profile"`, `"project"` or leave out for both), `kind`, `width`, `defaults`, `fields` and `render(ctx, options)`. Fields generate the studio's inspector, the docs and `widgets.json` automatically.
2. Register it in one of the `set-*.ts` lists.
3. Match the house style: use `card()` for surfaces, measure every text with `textWidth`/`fitText`/`wrapText` (never assume monospace), escape every user or data string with `esc`, give ambient loops the `loop` class and keep the SVG well under 1.5 MB.
4. Render a contact sheet and look at it in both modes and a few palettes:

   ```bash
   npx tsx scripts/preview-widgets.ts /tmp/sheet crimson dark jetbrains-mono   # add "project" for project widgets
   ```

5. `npm test` renders every widget in several palettes, fonts and motion levels, with empty and hostile data, and validates the SVG. It must stay green.

Presets live in `packages/core/src/presets.ts`; palettes in `packages/core/src/theme.ts`.

## Style

- **Code:** TypeScript everywhere, strict. Prefer plain functions and small modules; follow the patterns already in the folder you work in.
- **Comments** say why, in plain sentences.
- **Interface and docs text** is plain and specific: say what something does, not how clever it is.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(core): …`, `fix(web): …`, `docs: …`, `ci: …`.

## Pull requests

1. Fork the repository and branch from `main`.
2. Keep a pull request to one change; small ones are reviewed quickly.
3. Fill in the template: what changes, why, and how you checked it (with a screenshot for anything visible).
4. Make sure the checks pass.

Every push to `main` publishes a pre-release; full releases are made by hand (see [Releasing](README.md#releasing)).

## Licence

Readme Studio is licensed under the [MIT License](LICENSE). By submitting a contribution you agree that it is licensed under the same terms, and that you have the right to submit it.
