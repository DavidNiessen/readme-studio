import { ArrowUpRight, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { href } from "../lib/router";
import { Logo } from "./Logo";

export const REPO_URL = "https://github.com/DavidNiessen/readme-studio";

function ThemeToggle() {
  const [dark, setDark] = useState(() => (document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("rs:ui-theme", dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [dark]);
  return (
    <button type="button" className="icon-btn" aria-label={dark ? "Use light theme" : "Use dark theme"} onClick={() => setDark(!dark)}>
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}

export function SiteHeader({ current }: { current?: "presets" | "docs" | "home" }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="wrap site-header__inner">
        <Logo />
        <nav className="site-nav" aria-label="Main">
          <a href={href("/presets")} aria-current={current === "presets" ? "page" : undefined}>
            Presets
          </a>
          <a href={href("/docs")} aria-current={current === "docs" ? "page" : undefined}>
            Docs
          </a>
          <a href={REPO_URL} target="_blank" rel="noopener" className="hide-sm">
            GitHub <ArrowUpRight />
          </a>
        </nav>
        <div className="site-header__end">
          <ThemeToggle />
          <a className="btn btn--primary" href={href("/studio")}>
            Open studio
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__inner">
        <div className="site-footer__brand">
          <Logo />
          <p>Animated, self-updating GitHub profile READMEs. Designed in the browser, rendered by a GitHub Action, served from your own repository.</p>
        </div>
        <FooterCol title="Product" links={[["Studio", href("/studio")], ["Presets", href("/presets")], ["Widgets", href("/docs/widgets")]]} />
        <FooterCol title="Docs" links={[["Getting started", href("/docs")], ["Action reference", href("/docs/action")], ["Config reference", href("/docs/config")], ["AI agents", href("/docs/agents")], ["FAQ", href("/docs/faq")]]} />
        <FooterCol title="Source" links={[["GitHub", REPO_URL], ["Issues", `${REPO_URL}/issues`], ["MIT License", `${REPO_URL}/blob/main/LICENSE`], ["Privacy", "./privacy.html"], ["Terms", "./terms.html"], ["Impressum", "./impressum.html"]]} />
      </div>
      <div className="wrap site-footer__base">
        <span>No servers, no tracking. Your design lives in your browser and your repository.</span>
        <span className="mono">v1</span>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="site-footer__col">
      <h4>{title}</h4>
      {links.map(([l, h]) => (
        <a key={l} href={h} {...(h.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}>
          {l}
        </a>
      ))}
    </div>
  );
}

export function SitePage({ children, current }: { children: ReactNode; current?: "presets" | "docs" | "home" }) {
  return (
    <div className="site">
      <SiteHeader current={current} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
