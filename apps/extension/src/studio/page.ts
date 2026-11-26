/** Messages to the GitHub page when the studio is shown over it. */
export function tellPage(message: { type: "close" } | { type: "saved"; url: string; kind: "commit" | "pull-request" }): void {
  if (window.parent === window) return;
  window.parent.postMessage({ source: "readme-studio", ...message }, "https://github.com");
}
