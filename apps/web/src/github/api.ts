/** The few GitHub REST calls the extension makes. `fetch` is injectable for tests. */

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface RepoInfo {
  defaultBranch: string;
  private: boolean;
  /** null when not signed in */
  canPush: boolean | null;
}

export interface FileAt {
  text: string;
  /** blob SHA, needed to update the file; null when read without the API */
  sha: string | null;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const encPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export class GitHub {
  private readonly http: typeof fetch;

  constructor(
    private readonly token: string | null,
    http?: typeof fetch,
  ) {
    // a stored `fetch` called as a method throws "Illegal invocation" in browsers
    this.http = http ?? ((input, init) => fetch(input, init));
  }

  /** Whether requests carry a token. */
  get signedIn(): boolean {
    return !!this.token;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.http(`https://api.github.com${path}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = ((await res.json()) as { message?: string }).message ?? "";
      } catch {
        /* no JSON body */
      }
      throw new GitHubError(`${method} ${path} → ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
    }
    return (res.status === 204 ? null : await res.json()) as T;
  }

  /** The signed-in user and, for OAuth and classic tokens, the granted scopes. */
  async user(): Promise<{ login: string; scopes: string[] }> {
    const res = await this.http("https://api.github.com/user", {
      headers: { accept: "application/vnd.github+json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
    });
    if (!res.ok) throw new GitHubError(res.status === 401 ? "The token was rejected by GitHub" : `GitHub answered ${res.status}`, res.status);
    const scopes = (res.headers.get("x-oauth-scopes") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return { login: ((await res.json()) as { login: string }).login, scopes };
  }

  async repo(full: string): Promise<RepoInfo> {
    const r = await this.call<{ default_branch: string; private: boolean; permissions?: { push?: boolean } }>("GET", `/repos/${full}`);
    return { defaultBranch: r.default_branch, private: r.private, canPush: r.permissions ? !!r.permissions.push : null };
  }

  /** A file's text, or null when it does not exist. Uses the API when signed in, else raw.githubusercontent.com. */
  async file(full: string, path: string, ref: string): Promise<FileAt | null> {
    if (!this.token) {
      const res = await this.http(`https://raw.githubusercontent.com/${full}/${encodeURIComponent(ref)}/${encPath(path)}`, { cache: "no-store" });
      if (res.status === 404) return null;
      if (!res.ok) throw new GitHubError(`Could not read ${path} (${res.status})`, res.status);
      return { text: await res.text(), sha: null };
    }
    try {
      const r = await this.call<{ content: string; sha: string }>("GET", `/repos/${full}/contents/${encPath(path)}?ref=${encodeURIComponent(ref)}`);
      return { text: fromBase64(r.content), sha: r.sha };
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null;
      throw e;
    }
  }

  /**
   * The repository's README as GitHub finds it (README.md, readme.rst, docs/README…), or null.
   * Without a token the API may be rate-limited; then the common file names are tried directly.
   */
  async readme(full: string, ref: string): Promise<{ text: string; path: string } | null> {
    try {
      const r = await this.call<{ content: string; path: string }>("GET", `/repos/${full}/readme${ref && ref !== "HEAD" ? `?ref=${encodeURIComponent(ref)}` : ""}`);
      return { text: fromBase64(r.content), path: r.path };
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null;
      if (!(e instanceof GitHubError) || (e.status !== 403 && e.status !== 429)) throw e;
    }
    for (const path of ["README.md", "readme.md", "Readme.md", "README"]) {
      const f = await this.file(full, path, ref);
      if (f) return { text: f.text, path };
    }
    return null;
  }

  /** Create or update one file in one commit. */
  async putFile(full: string, o: { path: string; text: string; message: string; branch: string; sha?: string | null }): Promise<{ commitUrl: string }> {
    const r = await this.call<{ commit: { html_url: string } }>("PUT", `/repos/${full}/contents/${encPath(o.path)}`, {
      message: o.message,
      content: toBase64(o.text),
      branch: o.branch,
      ...(o.sha ? { sha: o.sha } : {}),
    });
    return { commitUrl: r.commit.html_url };
  }

  async branchSha(full: string, branch: string): Promise<string> {
    const r = await this.call<{ object: { sha: string } }>("GET", `/repos/${full}/git/ref/heads/${encPath(branch)}`);
    return r.object.sha;
  }

  async createBranch(full: string, name: string, fromSha: string): Promise<void> {
    await this.call("POST", `/repos/${full}/git/refs`, { ref: `refs/heads/${name}`, sha: fromSha });
  }

  async openPullRequest(full: string, o: { head: string; base: string; title: string; body: string }): Promise<{ url: string; number: number }> {
    const r = await this.call<{ html_url: string; number: number }>("POST", `/repos/${full}/pulls`, o);
    return { url: r.html_url, number: r.number };
  }
}

export const _private = { toBase64, fromBase64 };
