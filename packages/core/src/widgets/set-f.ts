import type { WidgetDef } from "./types";
import { pfInstall } from "./pf-install";
import { pfCode } from "./pf-code";
import { pfFeatures } from "./pf-features";
import { pfChangelog } from "./pf-changelog";
import { pfRoadmap } from "./pf-roadmap";
import { pfDownloads } from "./pf-downloads";
import { pfSupport } from "./pf-support";
import { pfToc } from "./pf-toc";

export const setF: WidgetDef[] = [pfInstall, pfCode, pfFeatures, pfChangelog, pfRoadmap, pfDownloads, pfSupport, pfToc];
