import type { WidgetDef } from "./types";
import { pfInstall } from "./pf-install";
import { pfCode } from "./pf-code";
import { pfFeatures } from "./pf-features";

export const setF: WidgetDef[] = [pfInstall, pfCode, pfFeatures];
