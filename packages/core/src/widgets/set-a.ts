import { languages } from "./languages";
import { pulse } from "./pulse";
import { skyline } from "./skyline";
import { stack } from "./stack";
import { terminal } from "./terminal";
import type { WidgetDef } from "./types";

export const setA: WidgetDef[] = [terminal, stack, languages, pulse, skyline];
