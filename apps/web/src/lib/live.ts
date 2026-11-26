import { fetchProfileData, type ProfileData, type StudioConfig } from "@readme-studio/core";
import { syntheticCalendar } from "../state/store";

/**
 * Live public data for the preview. Without a token the browser can't read the contribution
 * calendar (GitHub serves it as HTML without CORS), so a plausible calendar is synthesised;
 * the action always uses the real one.
 */
export async function fetchLive(config: StudioConfig, token?: string): Promise<ProfileData> {
  const p = config.profile;
  const feeds = config.layout.flatMap((r) => r.blocks).flatMap((b) => Object.entries(b.options).filter(([k, v]) => (k === "feed" || k === "feedUrl") && typeof v === "string" && /^https?:\/\//.test(v)).map(([, v]) => v as string));
  return fetchProfileData({
    login: p.login,
    token: token || undefined,
    timeZone: p.location.timezone,
    location: { latitude: p.location.latitude, longitude: p.location.longitude },
    feeds,
    include: { weather: true, events: true, hours: Boolean(token), releases: true },
    syntheticCalendar,
    timeoutMs: 15_000,
  });
}
