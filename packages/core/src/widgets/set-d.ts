import { area } from "./area";
import { clock } from "./clock";
import { donut } from "./donut";
import { followers } from "./followers";
import { harvest } from "./harvest";
import { posts } from "./posts";
import { releases } from "./releases";
import { repos } from "./repos";
import { streak } from "./streak";
import type { WidgetDef } from "./types";
import { weekdays } from "./weekdays";
import { year } from "./year";

export const setD: WidgetDef[] = [streak, repos, releases, donut, year, area, weekdays, clock, posts, harvest, followers];
