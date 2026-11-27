import { memo, useEffect, useMemo, useRef, useState } from "react";
import { svgUrl, type RenderedPart } from "../lib/render";

/** Plays GIF widget frames as a flipbook (the real GIF is encoded by the action). */
function Flipbook({ part, epoch, alt, style }: { part: RenderedPart; epoch: number; alt: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLImageElement>(null);
  // no frames are swapped while the image is off screen: each swap decodes and paints an image
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const frames = part.frames!.frames;
  const urls = useMemo(() => frames.map((f) => svgUrl(f.svg)), [frames]);
  // restart only when the frames really change, not when the same frames are rendered again
  const sig = `${urls.join("|")}|${frames.map((f) => f.delay).join(",")}`;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!visible) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, epoch, visible]);
  return <img ref={ref} src={urls[i]} alt={alt} width={part.width} height={part.height} style={style} draggable={false} />;
}

type Props = { part: RenderedPart; epoch?: number; style?: React.CSSProperties; className?: string; /** paused: a GIF shows one frame */ still?: boolean };

/**
 * A rendered widget. Memoised: the canvas re-renders on every selection change and keystroke, and
 * an unchanged part (the same cached render) needs no work. Callers pass `style` inline, so it is
 * compared by value.
 */
export const WidgetImage = memo(WidgetImage_, (a, b) => a.part === b.part && a.epoch === b.epoch && a.still === b.still && a.className === b.className && JSON.stringify(a.style) === JSON.stringify(b.style));

function WidgetImage_({ part, epoch = 0, style, className, still }: Props) {
  if (!still && part.frames && part.frames.frames.length > 1) return <Flipbook part={part} epoch={epoch} alt={part.meta.alt} style={style} />;
  if (!part.svg) return null;
  return (
    <img
      className={className}
      src={svgUrl(part.svg, epoch)}
      alt={part.meta.alt}
      width={part.width}
      height={part.height}
      style={style}
      draggable={false}
      decoding="async"
    />
  );
}
