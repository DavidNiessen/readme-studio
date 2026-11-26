/** JSON Schema for readme.config.json (editor completion and validation). */
import { FONTS } from "./fonts";
import { SCHEMA_URL } from "./config";
import { palettePresets } from "./theme";
import { widgetList } from "./widgets/registry";
import type { Field } from "./widgets/types";

const hex = { type: "string", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" };

function fieldSchema(f: Field): Record<string, unknown> {
  const base = { title: f.label, ...(f.help ? { description: f.help } : {}) };
  switch (f.type) {
    case "text":
    case "icon":
      return { ...base, type: "string" };
    case "color":
      return { ...base, anyOf: [hex, { const: "" }] };
    case "number":
      return { ...base, type: "number", minimum: f.min, maximum: f.max };
    case "toggle":
      return { ...base, type: "boolean" };
    case "select":
    case "segmented":
      return { ...base, enum: f.options.map((o) => o.value) };
    case "tags":
      return { ...base, type: "array", items: { type: "string" } };
    case "checklist":
      return { ...base, type: "array", items: { enum: f.options.map((o) => o.value) } };
    case "list":
      return { ...base, type: "array", items: { type: "object", properties: Object.fromEntries(f.item.map((i) => [i.key, fieldSchema(i)])) } };
  }
}

const blockVariants = widgetList.map((w) => ({
  if: { properties: { type: { const: w.type } } },
  then: { properties: { options: { type: "object", description: w.description, properties: Object.fromEntries(w.fields.map((f) => [f.key, fieldSchema(f)])) } } },
}));

export function configJsonSchema(): Record<string, unknown> {
  return {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SCHEMA_URL,
  title: "Readme Studio config",
  description: "Design of an animated GitHub profile README, rendered by the Readme Studio action.",
  type: "object",
  properties: {
    $schema: { type: "string" },
    version: { const: 1 },
    kind: { enum: ["profile", "project"], description: "profile: the <login>/<login> README; project: a repository README" },
    project: {
      type: "object",
      properties: {
        repo: { type: "string", description: "owner/name of the public repository. Its name, tagline and logo are project-hero options." },
        packages: { type: "object", properties: { npm: { type: "string" }, pypi: { type: "string" }, crates: { type: "string" } } },
      },
    },
    profile: {
      type: "object",
      properties: {
        login: { type: "string", description: "GitHub username the data is fetched for. Name, roles, bio and the like are options of the widgets that show them." },
        location: {
          type: "object",
          properties: { city: { type: "string" }, latitude: { type: "number" }, longitude: { type: "number" }, timezone: { type: "string", description: "IANA time zone" } },
        },
        links: {
          type: "array",
          items: { type: "object", properties: { icon: { type: "string" }, label: { type: "string" }, url: { type: "string" }, handle: { type: "string" } } },
        },
      },
    },
    theme: {
      type: "object",
      properties: {
        preset: { enum: palettePresets.map((p) => p.id) },
        accent: hex,
        overrides: { type: "object", properties: { dark: { type: "object" }, light: { type: "object" } } },
        font: { enum: FONTS.map((f) => f.id) },
        headingFont: { enum: FONTS.map((f) => f.id) },
        radius: { type: "number", minimum: 0, maximum: 32 },
        border: { type: "number", minimum: 0, maximum: 4 },
        texture: { enum: ["dots", "grid", "lines", "none"] },
        motion: { enum: ["full", "subtle", "off"] },
        surface: { type: "boolean" },
      },
    },
    layout: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          align: { enum: ["center", "left", "right"] },
          blocks: {
            type: "array",
            items: {
              type: "object",
              required: ["type"],
              properties: {
                id: { type: "string", description: "Asset file name prefix" },
                type: { enum: widgetList.map((w) => w.type) },
                options: { type: "object" },
                hidden: { type: "boolean" },
                link: { type: "string" },
              },
              allOf: blockVariants,
            },
          },
        },
      },
    },
    output: {
      type: "object",
      properties: {
        branch: { type: "string" },
        modes: { type: "array", items: { enum: ["dark", "light"] } },
        repository: { type: "string", description: "owner/repo hosting the assets (default: login/login)" },
        schedule: { type: "string", description: "5-field cron expression" },
      },
    },
  },
};
}
