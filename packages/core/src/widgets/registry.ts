import type { WidgetDef } from "./types";
import { setCore } from "./set-core";
import { setA } from "./set-a";
import { setB } from "./set-b";
import { setC } from "./set-c";
import { setD } from "./set-d";
import { setE } from "./set-e";
import { setF } from "./set-f";

const ORDER = ["Header", "Identity", "Stats", "Activity", "Projects", "Content", "Decoration"];

export const widgetList: WidgetDef[] = [...setCore, ...setA, ...setB, ...setC, ...setD, ...setE, ...setF].sort(
  (a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category),
);

const byType = new Map(widgetList.map((w) => [w.type, w]));

export function getWidget(type: string): WidgetDef | undefined {
  return byType.get(type);
}
