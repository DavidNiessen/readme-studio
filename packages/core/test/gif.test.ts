import { describe, expect, it } from "vitest";
import { encodeGif, lzw } from "../src/lib/gif";

/** Reference GIF LZW decoder (independent of the encoder) for round-trip checks. */
function unlzw(data: Uint8Array, minCodeSize: number, count: number): number[] {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let size = minCodeSize + 1;
  let dict: number[][] = [];
  const reset = () => {
    dict = Array.from({ length: clear + 2 }, (_, i) => (i < clear ? [i] : []));
    size = minCodeSize + 1;
  };
  reset();
  const out: number[] = [];
  let bit = 0;
  let prev: number[] | null = null;
  const read = () => {
    let v = 0;
    for (let i = 0; i < size; i++, bit++) v |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
    return v;
  };
  while (out.length < count) {
    const code = read();
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    if (code === eoi) break;
    let entry: number[];
    if (code < dict.length) entry = dict[code];
    else entry = [...prev!, prev![0]];
    out.push(...entry);
    if (prev) dict.push([...prev, entry[0]]);
    prev = entry;
    if (dict.length === 1 << size && size < 12) size++;
  }
  return out;
}

describe("gif encoder", () => {
  it("LZW round-trips long, repetitive input (including table resets)", () => {
    const input = new Uint8Array(60_000);
    let s = 7;
    for (let i = 0; i < input.length; i++) {
      s = (s * 1103515245 + 12345) >>> 0;
      input[i] = i % 97 < 40 ? 3 : (s >>> 16) % 200;
    }
    expect(unlzw(lzw(input, 8), 8, input.length)).toEqual([...input]);
  });

  it("writes a looping GIF89a with every frame", () => {
    const frame = (v: number) => ({ rgba: new Uint8Array(4 * 4 * 4).map((_, i) => (i % 4 === 3 ? 255 : v)), delay: 100 });
    const gif = encodeGif(4, 4, [frame(10), frame(200), frame(10)]);
    expect(new TextDecoder().decode(gif.subarray(0, 6))).toBe("GIF89a");
    expect(Buffer.from(gif).includes(Buffer.from("NETSCAPE2.0"))).toBe(true);
    expect(gif.filter((b, i) => b === 0x21 && gif[i + 1] === 0xf9).length).toBe(3);
    expect(gif[gif.length - 1]).toBe(0x3b);
  });
});

describe("frame cropping", () => {
  it("stores only the rectangle that changed since the previous frame", () => {
    const w = 40;
    const h = 30;
    const solid = () => {
      const px = new Uint8Array(w * h * 4);
      for (let i = 0; i < px.length; i += 4) px.set([20, 20, 30, 255], i);
      return px;
    };
    const second = solid();
    // a 5×4 patch at (10, 7) changes colour
    for (let y = 7; y < 11; y++) for (let x = 10; x < 15; x++) second.set([240, 80, 40, 255], (y * w + x) * 4);
    const gif = encodeGif(w, h, [
      { rgba: solid(), delay: 40 },
      { rgba: second, delay: 40 },
    ]);
    // image descriptors: 0x2c, then left, top, width, height as little-endian words
    const descriptors: number[][] = [];
    for (let i = 0; i < gif.length - 9; i++) {
      if (gif[i] !== 0x2c || gif[i - 1] !== 0 || gif[i - 8] !== 0x21) continue;
      const word = (o: number) => gif[i + o] | (gif[i + o + 1] << 8);
      descriptors.push([word(1), word(3), word(5), word(7)]);
    }
    expect(descriptors).toEqual([
      [0, 0, w, h],
      [10, 7, 5, 4],
    ]);
  });
});
