# Readme Studio browser extension

The Chrome and Firefox extension that opens Readme Studio over a GitHub repository page. It mounts the studio from `apps/web` (shared, not copied); this folder adds the GitHub button (`src/content`), sign-in and storage (`src/github`, `src/settings.ts`) and the build (`scripts/build.ts`).

## Building from source (for store reviewers)

Requirements: Node.js 22 and npm 10 (`.nvmrc` in the repository root).

```bash
npm ci
RS_VERSION=<version> npm run extension
```

Run both from the repository root. `RS_VERSION` is the version being reviewed, for example `1.0.1`. The output is:

- `apps/extension/dist/firefox`: the Firefox add-on, zipped as `apps/extension/dist/readme-studio-firefox-<version>.zip`
- `apps/extension/dist/chrome`: the Chrome extension, zipped as `apps/extension/dist/readme-studio-chrome-<version>.zip`

The build bundles and minifies with Vite and esbuild. No code is downloaded or evaluated at run time. `innerHTML` is only ever given HTML sanitised by DOMPurify (`apps/web/src/lib/sanitize.ts`).

Privacy policy: https://readme.niessen.dev/privacy.html
