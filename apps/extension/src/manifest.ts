/** Builds manifest.json for each browser from one description. */

export type Browser = "chrome" | "firefox";

export const GECKO_ID = "readme-studio@niessen.dev";

/**
 * Store versions are one to four dot-separated integers. Pre-releases ("1.0.3-42") become
 * "1.0.3.42", and Chrome shows the original text as version_name.
 */
export function manifestVersion(version: string): { version: string; name: string } {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-(\d+))?$/.exec(version.trim());
  if (!m) throw new Error(`Unsupported version "${version}"; expected x.y.z or x.y.z-n`);
  const parts = m.slice(1, 4).map(Number);
  if (m[4] !== undefined) parts.push(Number(m[4]));
  if (parts.some((n) => n > 65535)) throw new Error(`Version part above 65535 in "${version}"`);
  return { version: parts.join("."), name: version.trim() };
}

export function buildManifest(browser: Browser, version: string): Record<string, unknown> {
  const v = manifestVersion(version);
  const icons = { 16: "icons/16.png", 32: "icons/32.png", 48: "icons/48.png", 128: "icons/128.png" };
  const base: Record<string, unknown> = {
    manifest_version: 3,
    name: "Readme Studio",
    short_name: "Readme Studio",
    description: "Edit a repository's animated, self-updating README right on GitHub, with the full Readme Studio editor.",
    version: v.version,
    homepage_url: "https://readme.niessen.dev",
    icons,
    action: { default_title: "Readme Studio", default_icon: { 16: icons[16], 32: icons[32] } },
    options_ui: { page: "options.html", open_in_tab: true },
    permissions: ["storage"],
    host_permissions: ["https://github.com/*", "https://api.github.com/*", "https://raw.githubusercontent.com/*"],
    content_scripts: [{ matches: ["https://github.com/*"], js: ["content.js"], run_at: "document_idle" }],
    web_accessible_resources: [{ resources: ["studio.html"], matches: ["https://github.com/*"] }],
  };
  if (browser === "chrome") {
    return { ...base, version_name: v.name, minimum_chrome_version: "116", background: { service_worker: "background.js" } };
  }
  return {
    ...base,
    background: { scripts: ["background.js"] },
    browser_specific_settings: {
      gecko: {
        id: GECKO_ID,
        strict_min_version: "128.0",
        // Firefox Add-ons asks every extension to declare what it collects: nothing is sent anywhere but GitHub.
        data_collection_permissions: { required: ["none"] },
      },
    },
  };
}
