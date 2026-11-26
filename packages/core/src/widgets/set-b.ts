import { board } from "./board";
import { journey } from "./journey";
import { nowBuilding } from "./nowbuilding";
import { project } from "./project";
import { rhythm } from "./rhythm";
import { today } from "./today";
import { trophies } from "./trophies";
import type { WidgetDef } from "./types";

export const setB: WidgetDef[] = [rhythm, nowBuilding, journey, board, project, trophies, today];
