import { contrib } from "./contrib";
import { divider } from "./divider";
import { footer } from "./footer";
import { hero } from "./hero";
import { socials } from "./socials";
import { stats } from "./stats";
import type { WidgetDef } from "./types";

export const setCore: WidgetDef[] = [hero, socials, stats, contrib, divider, footer];
