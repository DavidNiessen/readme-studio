import { describe, expect, it } from "vitest";
import { publishBlocker, runBranches } from "../src/branch";

const payload = (b?: string) => () => JSON.stringify(b ? { repository: { default_branch: b } } : {});
const env = (ref: string, extra: Record<string, string> = {}) => ({ GITHUB_REF_NAME: ref, GITHUB_REF_TYPE: "branch", GITHUB_EVENT_PATH: "/event.json", ...extra });

describe("publishing only from the default branch", () => {
  it("publishes from the default branch", () => {
    expect(publishBlocker("push", runBranches(env("master"), payload("master")))).toBeNull();
    expect(publishBlocker("schedule", runBranches(env("main"), payload("main")))).toBeNull();
  });

  it("renders only on other branches and tags", () => {
    expect(publishBlocker("push", runBranches(env("feature/x"), payload("main")))).toMatch(/not the default branch \(feature\/x/);
    expect(publishBlocker("workflow_dispatch", runBranches(env("v1", { GITHUB_REF_TYPE: "tag" }), payload("main")))).toMatch(/a tag/);
  });

  it("never publishes from pull requests", () => {
    expect(publishBlocker("pull_request", runBranches(env("main"), payload("main")))).toBe("pull request");
  });

  it("keeps publishing when the default branch is unknown", () => {
    expect(publishBlocker("push", runBranches(env("feature"), payload()))).toBeNull();
    expect(publishBlocker("push", runBranches({ GITHUB_REF_NAME: "feature" }))).toBeNull();
    expect(
      publishBlocker(
        "push",
        runBranches(env("feature"), () => {
          throw new Error("ENOENT");
        }),
      ),
    ).toBeNull();
  });
});
