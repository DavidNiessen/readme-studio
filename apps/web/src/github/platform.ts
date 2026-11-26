import type { SaveResult } from "./design";
import type { RepoRef } from "./repo";

/**
 * What saving to GitHub needs from the surface it runs on. The website and the browser
 * extension share the save dialog; they differ in where a sign-in is kept, which sign-in
 * methods work (the device flow needs the extension: GitHub's sign-in endpoints do not answer
 * web pages), and how GitHub's own editor gets the new text.
 */

/** How a design gets back into the repository. */
export type SaveMode = "commit" | "pull-request" | "editor";

export interface Auth {
  token: string;
  /** how the token was obtained */
  via: "oauth" | "token";
  login: string;
  /** scopes GitHub reported for the token (classic tokens and OAuth only) */
  scopes: string[];
}

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** seconds between polls */
  interval: number;
  expiresAt: number;
}

export interface EditorFile {
  path: string;
  text: string;
  /** whether the file is already in the repository */
  exists: boolean;
}

export interface GitHubPlatform {
  loadAuth(): Promise<Auth | null>;
  saveAuth(auth: Auth | null): Promise<void>;
  /** "Sign in with GitHub" through the device flow, where the surface can do it */
  deviceFlow?: {
    /** the OAuth App's client ID; empty when none is configured */
    clientId(): Promise<string>;
    /** shown when there is no client ID */
    missingClientId: string;
    request(clientId: string): Promise<DeviceCode>;
    wait(clientId: string, code: DeviceCode, o: { signal: AbortSignal }): Promise<string>;
  };
  /** where a token stays, said under the token field */
  tokenNote: string;
  loadSaveMode(): Promise<SaveMode>;
  saveSaveMode(mode: SaveMode): Promise<void>;
  /** how the "GitHub editor" save mode works here, said in the dialog */
  editorNote: string;
  /** Opens GitHub's editor with the files; returns what to tell the user. */
  openEditor(repo: RepoRef, branch: string, files: EditorFile[]): Promise<string>;
  /** after a commit or pull request */
  onSaved?(result: SaveResult): void;
}
