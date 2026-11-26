/** Pure layout operations on a config. Every function returns a new config. */
import { allBlocks, getWidget, nextBlockId, normOptions, uid, type Align, type Block, type Row, type StudioConfig } from "@readme-studio/core";

export interface FlatItem {
  block: Block;
  /** sits beside the previous block (same row) */
  join: boolean;
  align: Align;
  rowId: string;
}

export function flatten(c: StudioConfig): FlatItem[] {
  return c.layout.flatMap((r) => r.blocks.map((b, i) => ({ block: b, join: i > 0, align: r.align, rowId: r.id })));
}

export function unflatten(c: StudioConfig, items: FlatItem[]): StudioConfig {
  const rows: Row[] = [];
  for (const it of items) {
    const last = rows[rows.length - 1];
    if (it.join && last) last.blocks.push(it.block);
    else rows.push({ id: it.rowId && !rows.some((r) => r.id === it.rowId) ? it.rowId : uid(), align: it.align, blocks: [it.block] });
  }
  return { ...c, layout: rows };
}

export function findBlock(c: StudioConfig, id: string): { row: Row; rowIndex: number; index: number; block: Block } | null {
  for (let ri = 0; ri < c.layout.length; ri++) {
    const i = c.layout[ri].blocks.findIndex((b) => b.id === id);
    if (i >= 0) return { row: c.layout[ri], rowIndex: ri, index: i, block: c.layout[ri].blocks[i] };
  }
  return null;
}

function capacity(blocks: Block[]): number {
  const widths = blocks.map((b) => getWidget(b.type)?.width ?? "full");
  if (widths.includes("full")) return 1;
  return widths.includes("half") ? 2 : 3;
}

export function rowHasRoomFor(row: Row, type: string): boolean {
  const def = getWidget(type);
  if (!def || def.fixedHeight) return false;
  if (row.blocks.some((b) => getWidget(b.type)?.fixedHeight)) return false;
  return row.blocks.length < capacity([...row.blocks, { id: "_", type, options: {} }]);
}

/** Insert a new block of `type`; beside `afterId` when there's room, else in a new row after it. */
export function addBlock(c: StudioConfig, type: string, afterId?: string | null, options?: Record<string, unknown>): { config: StudioConfig; id: string } {
  const def = getWidget(type);
  if (!def) return { config: c, id: "" };
  const id = nextBlockId(type, allBlocks(c).map((b) => b.id));
  const block: Block = { id, type, options: normOptions(type, options ?? {}) };
  const layout = c.layout.map((r) => ({ ...r, blocks: [...r.blocks] }));
  const at = afterId ? findBlock(c, afterId) : null;
  if (at && def.width !== "full" && rowHasRoomFor(layout[at.rowIndex], type)) {
    layout[at.rowIndex].blocks.splice(at.index + 1, 0, block);
  } else {
    const rowIndex = at ? at.rowIndex + 1 : layout.length;
    layout.splice(rowIndex, 0, { id: uid(), align: "center", blocks: [block] });
  }
  return { config: { ...c, layout }, id };
}

export function removeBlock(c: StudioConfig, id: string): StudioConfig {
  return { ...c, layout: c.layout.map((r) => ({ ...r, blocks: r.blocks.filter((b) => b.id !== id) })).filter((r) => r.blocks.length) };
}

export function duplicateBlock(c: StudioConfig, id: string): { config: StudioConfig; id: string } {
  const at = findBlock(c, id);
  if (!at) return { config: c, id };
  const nid = nextBlockId(at.block.type, allBlocks(c).map((b) => b.id));
  const copy: Block = { ...structuredClone(at.block), id: nid };
  const layout = c.layout.map((r) => ({ ...r, blocks: [...r.blocks] }));
  if (rowHasRoomFor(layout[at.rowIndex], at.block.type)) layout[at.rowIndex].blocks.splice(at.index + 1, 0, copy);
  else layout.splice(at.rowIndex + 1, 0, { id: uid(), align: at.row.align, blocks: [copy] });
  return { config: { ...c, layout }, id: nid };
}

export function updateBlock(c: StudioConfig, id: string, patch: Partial<Block>): StudioConfig {
  return { ...c, layout: c.layout.map((r) => ({ ...r, blocks: r.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })) };
}

export function updateOptions(c: StudioConfig, id: string, patch: Record<string, unknown>): StudioConfig {
  return { ...c, layout: c.layout.map((r) => ({ ...r, blocks: r.blocks.map((b) => (b.id === id ? { ...b, options: { ...b.options, ...patch } } : b)) })) };
}

/** Rename a block id (the asset file name); returns the id actually used. */
export function renameBlock(c: StudioConfig, id: string, wanted: string): { config: StudioConfig; id: string } {
  const clean = wanted
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!clean || clean === id) return { config: c, id };
  const taken = allBlocks(c)
    .map((b) => b.id)
    .filter((x) => x !== id);
  const nid = taken.includes(clean) ? nextBlockId(clean, taken) : clean;
  return { config: updateBlock(c, id, { id: nid }), id: nid };
}

/** Move a block one step up/down through the layout (rows are units; a block in a shared row is lifted out). */
export function moveBlock(c: StudioConfig, id: string, dir: -1 | 1): StudioConfig {
  const items = flatten(c);
  const i = items.findIndex((x) => x.block.id === id);
  if (i < 0) return c;
  const at = findBlock(c, id)!;
  if (at.row.blocks.length > 1) {
    // lift out of the shared row into its own row above/below that row
    const without = removeBlock(c, id);
    const layout = [...without.layout];
    const rowIndex = layout.findIndex((r) => r.id === at.row.id);
    layout.splice(dir < 0 ? rowIndex : rowIndex + 1, 0, { id: uid(), align: at.row.align, blocks: [at.block] });
    return { ...c, layout };
  }
  const target = at.rowIndex + dir;
  if (target < 0 || target >= c.layout.length) return c;
  const layout = [...c.layout];
  [layout[at.rowIndex], layout[target]] = [layout[target], layout[at.rowIndex]];
  return { ...c, layout };
}

/** Move a block left/right within its row. */
export function shiftInRow(c: StudioConfig, id: string, dir: -1 | 1): StudioConfig {
  const at = findBlock(c, id);
  if (!at) return c;
  const j = at.index + dir;
  if (j < 0 || j >= at.row.blocks.length) return c;
  const blocks = [...at.row.blocks];
  [blocks[at.index], blocks[j]] = [blocks[j], blocks[at.index]];
  return { ...c, layout: c.layout.map((r) => (r.id === at.row.id ? { ...r, blocks } : r)) };
}

/** Toggle whether a block shares the row of the block before it. */
export function setJoin(c: StudioConfig, id: string, join: boolean): StudioConfig {
  const items = flatten(c).map((x) => (x.block.id === id ? { ...x, join } : x));
  if (items[0]) items[0].join = false;
  return unflatten(c, items);
}

export function canJoin(c: StudioConfig, id: string): boolean {
  const items = flatten(c);
  const i = items.findIndex((x) => x.block.id === id);
  if (i <= 0) return false;
  const prevRow = findBlock(c, items[i - 1].block.id)!.row;
  const block = items[i].block;
  if (items[i].join) return true;
  return rowHasRoomFor(prevRow, block.type);
}

export function setRowAlign(c: StudioConfig, blockId: string, align: Align): StudioConfig {
  const at = findBlock(c, blockId);
  if (!at) return c;
  return { ...c, layout: c.layout.map((r) => (r.id === at.row.id ? { ...r, align } : r)) };
}

export function reorderFlat(c: StudioConfig, from: number, to: number): StudioConfig {
  const items = flatten(c);
  const [it] = items.splice(from, 1);
  items.splice(to, 0, it);
  // a dragged block lands in its own row unless it was dropped between joined siblings
  const landed = items[to];
  const next = items[to + 1];
  landed.join = Boolean(next?.join && to > 0 && rowHasRoomFor({ id: "", align: "center", blocks: [items[to - 1].block] }, landed.block.type));
  if (items[0]) items[0].join = false;
  return unflatten(c, items);
}

/**
 * Moves blocks (one, or a selection, in their layer order) to just before or after `targetId`,
 * as a drag on the canvas does. Rows stay whole: dropping beside a block that shares a row puts
 * the blocks before or after that row, and blocks that shared a row with each other still do.
 */
export function moveBlocksTo(c: StudioConfig, ids: string[], targetId: string, after: boolean): StudioConfig {
  if (ids.includes(targetId)) return c;
  const items = flatten(c);
  const moving = items.filter((x) => ids.includes(x.block.id));
  const rest = items.filter((x) => !ids.includes(x.block.id));
  if (!moving.length) return c;
  // a block only stays joined to the one before it if that one is still its row-mate
  const rejoin = (list: FlatItem[]) => list.forEach((x, i) => (x.join = x.join && i > 0 && list[i - 1].rowId === x.rowId));
  rejoin(rest);
  rejoin(moving);
  let at = rest.findIndex((x) => x.block.id === targetId);
  if (at < 0) return c;
  if (after) {
    at += 1;
    while (rest[at]?.join) at++;
  } else while (at > 0 && rest[at].join) at--;
  moving[0].join = false;
  rest.splice(at, 0, ...moving);
  return unflatten(c, rest);
}
