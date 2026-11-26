import { describe, expect, it } from "vitest";
import { normalizeConfig, presetConfig } from "@readme-studio/core";
import { addBlock, canJoin, duplicateBlock, findBlock, flatten, moveBlock, removeBlock, renameBlock, reorderFlat, setJoin, setRowAlign, shiftInRow, unflatten } from "../src/lib/layout";
import { decodeShare, encodeShare } from "../src/lib/share";

const base = () =>
  normalizeConfig({
    layout: [
      { blocks: [{ type: "hero", id: "hero" }] },
      { blocks: [{ type: "languages", id: "langs" }, { type: "rhythm", id: "rhythm" }] },
      { blocks: [{ type: "footer", id: "footer" }] },
    ],
  }).config;

const ids = (c: ReturnType<typeof base>) => c.layout.map((r) => r.blocks.map((b) => b.id));

describe("layout operations", () => {
  it("flatten/unflatten round-trips", () => {
    const c = base();
    expect(ids(unflatten(c, flatten(c)))).toEqual(ids(c));
  });

  it("adds full-width widgets in a new row after the selection", () => {
    const r = addBlock(base(), "stats", "hero");
    expect(ids(r.config)).toEqual([["hero"], ["stats"], ["langs", "rhythm"], ["footer"]]);
    expect(r.id).toBe("stats");
  });

  it("adds half-width widgets beside a lone half-width widget", () => {
    const c = removeBlock(base(), "rhythm");
    const r = addBlock(c, "donut", "langs");
    expect(ids(r.config)).toEqual([["hero"], ["langs", "donut"], ["footer"]]);
  });

  it("does not overfill a row", () => {
    const r = addBlock(base(), "donut", "langs");
    expect(ids(r.config)).toEqual([["hero"], ["langs", "rhythm"], ["donut"], ["footer"]]);
  });

  it("duplicates with a unique id", () => {
    const r = duplicateBlock(base(), "hero");
    expect(r.id).toBe("hero-2");
    expect(findBlock(r.config, "hero-2")?.block.type).toBe("hero");
  });

  it("moves rows and lifts blocks out of shared rows", () => {
    expect(ids(moveBlock(base(), "footer", -1))).toEqual([["hero"], ["footer"], ["langs", "rhythm"]]);
    expect(ids(moveBlock(base(), "rhythm", 1))).toEqual([["hero"], ["langs"], ["rhythm"], ["footer"]]);
    expect(ids(moveBlock(base(), "hero", -1))).toEqual(ids(base()));
    expect(ids(shiftInRow(base(), "rhythm", -1))).toEqual([["hero"], ["rhythm", "langs"], ["footer"]]);
  });

  it("joins and splits rows", () => {
    const split = setJoin(base(), "rhythm", false);
    expect(ids(split)).toEqual([["hero"], ["langs"], ["rhythm"], ["footer"]]);
    expect(canJoin(split, "rhythm")).toBe(true);
    expect(canJoin(base(), "footer")).toBe(false);
    expect(ids(setJoin(split, "rhythm", true))).toEqual(ids(base()));
  });

  it("reorders the flat list via drag and drop", () => {
    const c = reorderFlat(base(), 3, 0);
    expect(ids(c)[0]).toEqual(["footer"]);
  });

  it("renames to unique, file-safe ids", () => {
    expect(renameBlock(base(), "hero", "My Hero!").id).toBe("my-hero");
    expect(renameBlock(base(), "hero", "footer").id).toBe("footer-2");
  });

  it("sets row alignment", () => {
    expect(setRowAlign(base(), "rhythm", "left").layout[1].align).toBe("left");
  });
});

describe("share links", () => {
  it("round-trips a full preset", () => {
    const c = presetConfig("command-center", { login: "mona" });
    const token = encodeShare(c);
    expect(token).toMatch(/^[\w-]+$/);
    expect(decodeShare(token)).toEqual(c);
    expect(decodeShare("garbage")).toBeNull();
  });
});
