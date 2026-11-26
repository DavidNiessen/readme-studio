import { commitActivity } from "./p-commits";
import { contributorWall } from "./p-contributors";
import { repoHealth } from "./p-health";
import { projectHero } from "./p-hero";
import { shields } from "./p-shields";
import { starHistory } from "./p-stars";
import { repoStats } from "./p-stats";
import type { WidgetDef } from "./types";

export const setE: WidgetDef[] = [projectHero, shields, repoStats, starHistory, contributorWall, commitActivity, repoHealth];
