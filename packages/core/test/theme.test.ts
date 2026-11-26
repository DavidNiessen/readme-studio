import { describe, expect, it } from "vitest";
import { contrast, deriveFromAccent, isHex, MODES, PALETTE_KEYS, palettePresets, resolvePalette, resolveTheme, DEFAULT_THEME } from "../src/index";

describe("themes", () => {
  it("every preset defines every token for both modes", () => {
    for (const p of palettePresets) {
      for (const m of MODES) {
        const pal = p[m];
        for (const k of PALETTE_KEYS) expect(isHex(pal[k]), `${p.id}.${m}.${k} = ${pal[k]}`).toBe(true);
        expect(pal.heat).toHaveLength(5);
        pal.heat.forEach((h) => expect(isHex(h)).toBe(true));
      }
    }
  });

  it("text is readable on cards in every preset", () => {
    for (const p of palettePresets) {
      for (const m of MODES) {
        expect(contrast(p[m].text, p[m].card), `${p.id} ${m} text`).toBeGreaterThan(7);
        expect(contrast(p[m].muted, p[m].card), `${p.id} ${m} muted`).toBeGreaterThan(2.8);
      }
    }
  });

  it("preset ids are unique", () => {
    const ids = palettePresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("generates a full palette from an accent", () => {
    const d = deriveFromAccent("#22c55e", "dark");
    const l = deriveFromAccent("#22c55e", "light");
    expect(contrast(d.text, d.card)).toBeGreaterThan(10);
    expect(contrast(l.text, l.card)).toBeGreaterThan(10);
    expect(d.accent).toBe("#22c55e");
  });

  it("applies overrides and accent generation", () => {
    const s = { ...DEFAULT_THEME, overrides: { dark: { accent: "#00ff00" } } };
    expect(resolvePalette(s, "dark").accent).toBe("#00ff00");
    expect(resolvePalette(s, "light").accent).toBe("#dc2626");
    expect(resolvePalette({ ...DEFAULT_THEME, accent: "#3366ff" }, "light").accent).toBe("#3366ff");
    expect(resolveTheme({ ...DEFAULT_THEME, radius: 99 }, "dark").radius).toBe(32);
  });
});
