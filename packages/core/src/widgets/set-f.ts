import type { WidgetDef } from "./types";
import { pfInstall } from "./pf-install";
import { pfCode } from "./pf-code";

export const setF: WidgetDef[] = [pfInstall, pfCode];
