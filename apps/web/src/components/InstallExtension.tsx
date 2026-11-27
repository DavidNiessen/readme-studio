import { ArrowUpRight, Puzzle } from "lucide-react";
import { useMemo } from "react";

/** The extension's store listings. Firefox's stays empty until Mozilla has reviewed it. */
export const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/readme-studio/khjacbeebimgffcjldkojaflahigfhko";
export const FIREFOX_ADDON_URL = "";

/**
 * Where this browser installs the extension from, or null when it cannot: phones and tablets run
 * no extensions, and Firefox has no listing yet. Chrome, Edge, Brave, Opera and Arc all install
 * from the Chrome Web Store.
 */
export function extensionStore(): { url: string; browser: string } | null {
  if (typeof navigator === "undefined" || typeof matchMedia === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad/i.test(ua) || !matchMedia("(pointer: fine)").matches) return null;
  if (/Firefox\//.test(ua)) return FIREFOX_ADDON_URL ? { url: FIREFOX_ADDON_URL, browser: "Firefox" } : null;
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands ?? [];
  if (brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/.test(b.brand)) || /Chrome\//.test(ua)) return { url: CHROME_STORE_URL, browser: "Chrome" };
  return null;
}

/**
 * The website's call to install the extension. Only the website shows it: inside the extension
 * (its overlay on GitHub, or its own window) the studio has a host and never renders this.
 */
export function InstallExtensionButton({ className }: { className?: string }) {
  const store = useMemo(extensionStore, []);
  if (!store) return null;
  return (
    <a
      className={`install-ext${className ? ` ${className}` : ""}`}
      href={store.url}
      target="_blank"
      rel="noopener"
      title={`Readme Studio for ${store.browser}: design and save any repository's README right on GitHub`}
    >
      <span className="install-ext__icon" aria-hidden>
        <Puzzle />
      </span>
      <span className="install-ext__label">Install extension</span>
      <ArrowUpRight className="install-ext__arrow" aria-hidden />
    </a>
  );
}
