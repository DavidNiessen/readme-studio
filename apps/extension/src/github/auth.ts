/**
 * "Sign in with GitHub" through the OAuth device flow: no server and no client secret.
 * The user enters a short code on github.com/login/device; the extension polls for the token.
 * It needs a GitHub OAuth App with "Enable Device Flow" ticked, and only its client ID.
 */

/** Enough to commit the design and add the workflow file to public repositories. */
export const OAUTH_SCOPES = "public_repo workflow";

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** seconds between polls */
  interval: number;
  expiresAt: number;
}

async function post<T>(http: typeof fetch, url: string, body: Record<string, string>): Promise<T> {
  const res = await http(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`GitHub sign-in failed (${res.status})`);
  return (await res.json()) as T;
}

export async function requestDeviceCode(clientId: string, http: typeof fetch = fetch, now = Date.now()): Promise<DeviceCode> {
  const r = await post<{ device_code?: string; user_code?: string; verification_uri?: string; interval?: number; expires_in?: number; error?: string; error_description?: string }>(
    http,
    "https://github.com/login/device/code",
    { client_id: clientId, scope: OAUTH_SCOPES },
  );
  if (r.error || !r.device_code || !r.user_code) {
    throw new Error(
      r.error === "device_flow_disabled"
        ? "Device flow is turned off for this OAuth App: tick “Enable Device Flow” in its settings."
        : r.error_description || r.error || "GitHub did not return a sign-in code",
    );
  }
  return {
    deviceCode: r.device_code,
    userCode: r.user_code,
    verificationUri: r.verification_uri || "https://github.com/login/device",
    interval: Math.max(1, r.interval ?? 5),
    expiresAt: now + (r.expires_in ?? 900) * 1000,
  };
}

export interface PollOptions {
  http?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  signal?: AbortSignal;
}

/** Polls until the user approves (resolves with the token), denies or the code expires (rejects). */
export async function waitForToken(clientId: string, code: DeviceCode, o: PollOptions = {}): Promise<string> {
  const http = o.http ?? fetch;
  const sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  let interval = code.interval;
  while (now() < code.expiresAt) {
    if (o.signal?.aborted) throw new Error("Sign-in cancelled");
    await sleep(interval * 1000);
    if (o.signal?.aborted) throw new Error("Sign-in cancelled");
    const r = await post<{ access_token?: string; error?: string; interval?: number; error_description?: string }>(http, "https://github.com/login/oauth/access_token", {
      client_id: clientId,
      device_code: code.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
    if (r.access_token) return r.access_token;
    if (r.error === "authorization_pending") continue;
    // GitHub asks for a longer interval; keep it from now on
    if (r.error === "slow_down") {
      interval = Math.max(interval + 5, r.interval ?? 0);
      continue;
    }
    if (r.error === "access_denied") throw new Error("Sign-in was cancelled on GitHub");
    if (r.error === "expired_token") break;
    throw new Error(r.error_description || r.error || "GitHub sign-in failed");
  }
  throw new Error("The sign-in code expired. Start again.");
}
