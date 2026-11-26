import { about } from "./about";
import { badges } from "./badges";
import { banner } from "./banner";
import { contact } from "./contact";
import { facts } from "./facts";
import { heading } from "./heading";
import { markdown } from "./markdown";
import { quote } from "./quote";
import { skills } from "./skills";
import { timeline } from "./timeline";
import type { WidgetDef } from "./types";

export const setC: WidgetDef[] = [about, facts, quote, banner, heading, markdown, badges, skills, timeline, contact];
