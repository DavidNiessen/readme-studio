import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui";
import { ago, dataKey, refreshInterval } from "../lib/liveData";
import { useStudio } from "../state/store";
import { useSession } from "./github/session";

/** The time, ticking every 30 seconds, for "updated 4 min ago" labels. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/** What the preview is showing, in one line: live and how old, loading, or sample and why. */
export function useDataSummary(): { text: string; tone: "ok" | "busy" | "warn"; title: string } {
  const config = useStudio((s) => s.config);
  const mode = useStudio((s) => s.dataMode);
  const status = useStudio((s) => s.dataStatus);
  const { auth } = useSession();
  const now = useNow();
  const what = config.kind === "project" ? config.project.repo : `@${config.profile.login}`;
  const every = `Refreshes every ${refreshInterval(!!auth) / 60_000} minutes${auth ? "" : " (every 5 when signed in to GitHub)"}.`;
  if (!dataKey(config)) return { text: "Sample data", tone: "warn", title: "Name an account or repository in the Data tab to load its data." };
  if (status.state === "loading") return { text: `Loading ${what}…`, tone: "busy", title: `Fetching ${what} from GitHub.` };
  if (status.state === "error") {
    const shown = mode === "live" && status.updatedAt ? ` Showing the data from ${ago(status.updatedAt, now)}.` : " Showing sample data.";
    return { text: mode === "live" ? "Live data, not refreshed" : "Sample data", tone: "warn", title: `${status.message ?? "GitHub could not be reached"}.${shown}` };
  }
  if (mode === "live" && status.updatedAt) return { text: `Updated ${ago(status.updatedAt, now)}`, tone: "ok", title: `Live data for ${what}. ${every}` };
  return { text: "Sample data", tone: "busy", title: `Loading ${what} from GitHub.` };
}

/** The top bar's refresh button: what the preview shows, and a way to fetch it again now. */
export function DataRefreshButton() {
  const refresh = useStudio((s) => s.refreshData);
  const config = useStudio((s) => s.config);
  const { text, tone, title } = useDataSummary();
  return (
    <button
      type="button"
      className={`data-refresh data-refresh--${tone}`}
      onClick={refresh}
      disabled={!dataKey(config) || tone === "busy"}
      title={`${title} Click to refresh now.`}
      aria-label={`Refresh GitHub data. ${text}`}
    >
      {tone === "warn" ? <AlertTriangle /> : <RefreshCw className={tone === "busy" ? "spin" : undefined} />}
      <span className="hide-md">{text}</span>
    </button>
  );
}

/** The Data tab's view of the same: the summary, the reason, and a refresh button. */
export function DataStatusLine() {
  const refresh = useStudio((s) => s.refreshData);
  const config = useStudio((s) => s.config);
  const { text, tone, title } = useDataSummary();
  return (
    <div className={`data-status data-status--${tone}`}>
      <div>
        <b>{text}</b>
        <p className="field__help">{title}</p>
      </div>
      <Button size="sm" onClick={refresh} disabled={!dataKey(config) || tone === "busy"}>
        <RefreshCw className={tone === "busy" ? "spin" : undefined} /> Refresh
      </Button>
    </div>
  );
}
