import { href } from "../lib/router";

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg className="logo__mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--ink)" />
      <rect x="7" y="8" width="18" height="3" rx="1.5" fill="var(--paper)" />
      <rect x="7" y="14.5" width="11" height="3" rx="1.5" fill="var(--paper)" opacity=".55" />
      <rect x="7" y="21" width="7" height="3" rx="1.5" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ to = "/", compact }: { to?: string; compact?: boolean }) {
  return (
    <a className="logo" href={href(to)} aria-label="Readme Studio home">
      <LogoMark />
      {!compact && (
        <span className="logo__word">
          Readme <em>Studio</em>
        </span>
      )}
    </a>
  );
}
