import { useEffect, useMemo, useState } from "react";
import { svgUrl, type RenderedPart } from "../lib/render";

/** Plays GIF widget frames as a flipbook (the real GIF is encoded by the action). */
function Flipbook({ part, epoch, alt, style }: { part: RenderedPart; epoch: number; alt: string; style?: React.CSSProperties }) {
  const frames = part.frames!.frames;
  const urls = useMemo(() => frames.map((f, i) => svgUrl(f.svg, `${part.key}:f${i}`)), [frames, part.key]);
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    let alive = true;
    let t = 0;
    let idx = 0;
    const tick = () => {
      if (!alive) return;
      idx = (idx + 1) % urls.length;
      setI(idx);
      t = window.setTimeout(tick, frames[idx]?.delay ?? 100);
    };
    // preload so the loop does not flicker
    urls.forEach((u) => {
      const im = new Image();
      im.src = u;
    });
    t = window.setTimeout(tick, frames[0]?.delay ?? 100);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [urls, frames, epoch]);
  return <img src={urls[i]} alt={alt} width={part.width} height={part.height} style={style} draggable={false} />;
}

export function WidgetImage({ part, epoch = 0, style, className }: { part: RenderedPart; epoch?: number; style?: React.CSSProperties; className?: string }) {
  if (part.frames && part.frames.frames.length > 1) return <Flipbook part={part} epoch={epoch} alt={part.meta.alt} style={style} />;
  if (!part.svg) return null;
  return (
    <img
      className={className}
      src={svgUrl(part.svg, part.key, epoch)}
      alt={part.meta.alt}
      width={part.width}
      height={part.height}
      style={style}
      draggable={false}
      decoding="async"
    />
  );
}
