/**
 * Writes the machine-readable files the site serves next to the studio:
 * schema.json (config JSON Schema), widgets.json, presets.json, llms.txt and llms-full.txt.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { configJsonSchema, llmsFullTxt, llmsTxt, presetCatalog, themeCatalog, widgetCatalog } from "../packages/core/src/index";

const out = join(dirname(fileURLToPath(import.meta.url)), "../apps/web/public");
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
writeFileSync(join(out, "schema.json"), json(configJsonSchema()));
writeFileSync(join(out, "widgets.json"), json({ widgets: widgetCatalog() }));
writeFileSync(join(out, "presets.json"), json({ presets: presetCatalog(), ...themeCatalog() }));
writeFileSync(join(out, "llms.txt"), llmsTxt());
writeFileSync(join(out, "llms-full.txt"), llmsFullTxt());
console.log("wrote schema.json, widgets.json, presets.json, llms.txt, llms-full.txt");
