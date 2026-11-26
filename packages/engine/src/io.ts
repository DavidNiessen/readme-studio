import { existsSync, readFileSync } from "node:fs";
import { normalizeConfig, type Normalized } from "@readme-studio/core";

export function readConfig(path: string): Normalized {
  if (!existsSync(path)) throw new Error(`config not found: ${path}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`${path} is not valid JSON: ${(e as Error).message}`);
  }
  return normalizeConfig(raw);
}
