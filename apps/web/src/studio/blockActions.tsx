import { getWidget } from "@readme-studio/core";
import { ArrowDown, ArrowUp, CheckSquare, Copy, Eye, EyeOff, LayoutTemplate, Plus, Trash2, XSquare } from "lucide-react";
import { MOD, openContextMenu, type MenuItem } from "../components/ui";
import { findBlock } from "../lib/layout";
import { useStudio } from "../state/store";

type Click = { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean };

/**
 * A click on a block, on the canvas or in the layers: Shift selects a range, Ctrl/⌘ adds or
 * removes one, a plain click selects only that block (`toggleOff`: or clears it when it already
 * is the only selection, as the canvas does).
 */
export function clickBlock(e: Click, id: string, toggleOff = false): void {
  const s = useStudio.getState();
  if (e.shiftKey) s.rangeSelect(id);
  else if (e.metaKey || e.ctrlKey) s.toggleSelect(id);
  else s.select(toggleOff && s.selected === id && s.selection.length <= 1 ? null : id);
}

/** The blocks an action on `id` applies to: the whole selection when `id` is part of it. */
export function targetsOf(id: string): string[] {
  const s = useStudio.getState();
  return s.selection.includes(id) ? s.selection : [id];
}

/** What can be done to one block or to the selection; the context menus and the inspector use it. */
export function blockActions(ids: string[]): (MenuItem | "sep")[] {
  const s = useStudio.getState();
  const blocks = ids.map((id) => findBlock(s.config, id)?.block).filter((b) => !!b);
  if (!blocks.length) return [];
  const many = blocks.length > 1;
  const allHidden = blocks.every((b) => b.hidden);
  const n = many ? ` ${blocks.length} widgets` : "";
  return [
    { label: `Duplicate${n}`, icon: <Copy />, shortcut: `${MOD} D`, onSelect: () => s.duplicateMany(ids) },
    { label: "Move up", icon: <ArrowUp />, shortcut: "Alt ↑", onSelect: () => useStudio.getState().moveMany(ids, -1) },
    { label: "Move down", icon: <ArrowDown />, shortcut: "Alt ↓", onSelect: () => useStudio.getState().moveMany(ids, 1) },
    { label: allHidden ? `Show${n}` : `Hide${n}`, icon: allHidden ? <Eye /> : <EyeOff />, shortcut: "H", onSelect: () => s.setHidden(ids, !allHidden) },
    ...(!many
      ? [
          {
            label: "Add widget below",
            icon: <Plus />,
            shortcut: "A",
            onSelect: () => {
              s.select(ids[0]);
              s.setRailTab("add");
              s.setPane("layers");
            },
          } satisfies MenuItem,
        ]
      : []),
    "sep",
    { label: "Select all", icon: <CheckSquare />, shortcut: `${MOD} A`, onSelect: () => useStudio.getState().selectAll() },
    ...(many ? [{ label: "Clear selection", icon: <XSquare />, shortcut: "Esc", onSelect: () => useStudio.getState().select(null) } satisfies MenuItem] : []),
    "sep",
    { label: `Delete${n}`, icon: <Trash2 />, shortcut: "Del", danger: true, onSelect: () => s.removeMany(ids) },
  ];
}

/** Right-click on a block: acts on the selection when the block is in it, else on that block alone. */
export function onBlockContextMenu(e: React.MouseEvent, id: string): void {
  e.stopPropagation();
  const s = useStudio.getState();
  if (!s.selection.includes(id)) s.select(id);
  const ids = targetsOf(id);
  const title = ids.length > 1 ? `${ids.length} widgets selected` : `${getWidget(findBlock(s.config, id)?.block.type ?? "")?.title ?? "Widget"} · ${id}`;
  openContextMenu(e, blockActions(ids), title);
}

/** Right-click on empty canvas or layer space. */
export function onEmptyContextMenu(e: React.MouseEvent): void {
  const s = useStudio.getState();
  openContextMenu(e, [
    {
      label: "Add widget",
      icon: <Plus />,
      shortcut: "A",
      onSelect: () => {
        s.setRailTab("add");
        s.setPane("layers");
      },
    },
    { label: "Select all", icon: <CheckSquare />, shortcut: `${MOD} A`, disabled: !s.config.layout.length, onSelect: () => useStudio.getState().selectAll() },
    { label: "Browse presets", icon: <LayoutTemplate />, onSelect: () => s.openDialog("presets") },
  ]);
}
