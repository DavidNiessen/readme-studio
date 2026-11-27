import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CATEGORIES, getWidget, normalizeConfig, widgetFits, widgetList, type Block, type StudioConfig, type WidgetCategory, type WidgetDef } from "@readme-studio/core";
import { Eye, EyeOff, GripVertical, Layers, MoreHorizontal, Plus, LayoutTemplate } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Button, IconButton, Menu, Tabs, cn } from "../components/ui";
import { WidgetImage } from "../components/WidgetImage";
import { reorderFlat, updateBlock } from "../lib/layout";
import { renderBlock, useFontsReady } from "../lib/render";
import { useStudio } from "../state/store";
import { blockActions, clickBlock, onBlockContextMenu, onEmptyContextMenu, targetsOf } from "./blockActions";
import { WidgetIcon } from "./icons";
import { pressLibraryWidget } from "./useCanvasDrag";
import { wholeElementDrag } from "../components/Sortable";

/**
 * One layer. It reads only what it shows from the store, and is memoised, so typing in the
 * inspector or selecting another widget does not re-render every row.
 */
const LayerRow = memo(function LayerRow({ block, joined, overlay }: { block: Block; joined: boolean; overlay?: boolean }) {
  const isSelected = useStudio((s) => s.selection.includes(block.id));
  const isPrimary = useStudio((s) => s.selected === block.id);
  const kind = useStudio((s) => s.config.kind);
  const commit = useStudio((s) => s.commit);
  const setPane = useStudio((s) => s.setPane);
  const def = getWidget(block.type);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: overlay });
  const style = { transform: CSS.Translate.toString(transform), transition };
  if (!def) return null;
  return (
    <li
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      // the whole row drags (the grip too, and the grip alone by touch and keyboard)
      {...(overlay ? {} : wholeElementDrag(listeners))}
      className={cn("layer", joined && "layer--joined", isSelected && "is-selected", isDragging && "is-dragging", overlay && "is-overlay", block.hidden && "is-hidden")}
      onClick={(e) => {
        clickBlock(e, block.id);
        const plain = !e.shiftKey && !e.metaKey && !e.ctrlKey;
        if (plain && window.matchMedia("(max-width: 960px)").matches) setPane("inspect");
      }}
      onContextMenu={(e) => onBlockContextMenu(e, block.id)}
      aria-current={isPrimary ? "true" : undefined}
      aria-selected={isSelected}
    >
      <span className="layer__grip" {...attributes} {...listeners} aria-label={`Reorder ${def.title}`} onClick={(e) => e.stopPropagation()}>
        <GripVertical />
      </span>
      <span className="layer__icon">
        <WidgetIcon type={def.type} category={def.category} />
      </span>
      <span className="layer__text">
        <span className="layer__title">{def.title}</span>
        <span className="layer__id" title={def.scope && def.scope !== "any" && def.scope !== kind ? `Made for ${def.scope} READMEs` : undefined}>
          {def.scope && def.scope !== "any" && def.scope !== kind ? `${def.scope} widget · ` : ""}
          {block.id}
          {def.kind === "gif" ? ".gif" : def.kind === "markdown" ? ".md" : ".svg"}
        </span>
      </span>
      <span className="layer__actions" onClick={(e) => e.stopPropagation()}>
        <IconButton size="sm" label={block.hidden ? "Show" : "Hide"} onClick={() => commit((c) => updateBlock(c, block.id, { hidden: block.hidden ? undefined : true }))}>
          {block.hidden ? <EyeOff /> : <Eye />}
        </IconButton>
        <Menu
          trigger={
            <button type="button" className="icon-btn icon-btn--sm" aria-label="More actions">
              <MoreHorizontal />
            </button>
          }
          items={() => blockActions(targetsOf(block.id))}
        />
      </span>
    </li>
  );
});

/** What the layer list shows of each widget: typing a widget's options changes none of it. */
const layerKey = (c: StudioConfig) => c.layout.map((r) => r.blocks.map((b) => `${b.id}\t${b.type}\t${b.hidden ? 1 : ""}`).join("\n")).join("\n\n");

const Layers_ = memo(function Layers_() {
  const commit = useStudio((s) => s.commit);
  const openDialog = useStudio((s) => s.openDialog);
  const setRailTab = useStudio((s) => s.setRailTab);
  // re-renders only when the list itself changes: dnd-kit re-renders every row with the list
  const key = useStudio((s) => layerKey(s.config));
  const items = useMemo(
    () =>
      key
        ? key.split("\n\n").flatMap((row) =>
            row.split("\n").map((line, i) => {
              const [id, type, hidden] = line.split("\t");
              return { block: { id, type, options: {}, ...(hidden ? { hidden: true } : {}) } as Block, join: i > 0 };
            }),
          )
        : [],
    [key],
  );
  const ids = useMemo(() => items.map((x) => x.block.id), [items]);
  const [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((x) => x.block.id === e.active.id);
    const to = items.findIndex((x) => x.block.id === e.over!.id);
    if (from < 0 || to < 0) return;
    commit((c) => reorderFlat(c, from, to));
  };
  if (!items.length) {
    return (
      <div className="empty">
        <Layers />
        <strong>No widgets yet</strong>
        <span>Add your first widget or start from a preset.</span>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <Button size="sm" variant="primary" onClick={() => setRailTab("add")}>
            <Plus /> Add widget
          </Button>
          <Button size="sm" onClick={() => openDialog("presets")}>
            <LayoutTemplate /> Presets
          </Button>
        </div>
      </div>
    );
  }
  const activeItem = items.find((x) => x.block.id === active);
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActive(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="layers" aria-label="Layers" aria-multiselectable="true" onContextMenu={onEmptyContextMenu}>
          {items.map((x) => (
            <LayerRow key={x.block.id} block={x.block} joined={x.join} />
          ))}
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.7,.2,1)" }}>{activeItem ? <LayerRow block={activeItem.block} joined={false} overlay /> : null}</DragOverlay>
    </DndContext>
  );
});

/**
 * Library thumbnails render once scrolled into view, through one queue that works in short slices:
 * the library has 60+ widgets, and rendering them all at once froze the page for seconds.
 */
const thumbQueue: (() => void)[] = [];
let thumbTimer = 0;
function drainThumbs() {
  thumbTimer = 0;
  const t0 = performance.now();
  while (thumbQueue.length && performance.now() - t0 < 12) thumbQueue.shift()!();
  if (thumbQueue.length) thumbTimer = window.setTimeout(drainThumbs, 0);
}
function queueThumb(fn: () => void) {
  thumbQueue.push(fn);
  if (!thumbTimer) thumbTimer = window.setTimeout(drainThumbs, 0);
}

const Thumb = memo(function Thumb({ def }: { def: WidgetDef }) {
  const config = useStudio((s) => s.config);
  const data = useStudio((s) => s.data);
  const mode = useStudio((s) => s.mode);
  const ready = useFontsReady([config.theme.font, config.theme.headingFont]);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setVisible(true);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setVisible(true);
      io.disconnect();
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [parts, setParts] = useState<ReturnType<typeof renderBlock>>([]);
  useEffect(() => {
    if (!ready || !visible) return;
    let live = true;
    queueThumb(() => {
      if (!live) return;
      // stills: a library full of animated images kept the browser drawing every frame
      const c = normalizeConfig({ ...config, theme: { ...config.theme, motion: "off" }, layout: [{ blocks: [{ type: def.type, id: def.type }] }] }).config;
      setParts(renderBlock(c.layout[0].blocks[0], c, data, mode));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, config.theme, config.profile, config.project, config.kind, data, mode, ready, visible]);
  const p = parts[0];
  return (
    <div ref={ref} className="lib-thumb">
      {!p ? (
        <div style={{ height: 56 }} />
      ) : p.markdown !== undefined ? (
        <div style={{ fontSize: 11, color: "var(--muted)", padding: 6, lineHeight: 1.4, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", maxHeight: 90, overflow: "hidden", width: "100%" }}>{p.markdown.slice(0, 160)}</div>
      ) : (
        <WidgetImage part={p} />
      )}
    </div>
  );
});

function Library() {
  const { add, setPane, mode, config } = useStudio();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<WidgetCategory | "all">("all");
  const fitting = widgetList.filter((w) => widgetFits(w, config.kind));
  const list = fitting.filter(
    (w) => (cat === "all" || w.category === cat) && (!q || `${w.title} ${w.description} ${w.type} ${w.category}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div style={{ ["--thumb-bg" as string]: mode === "dark" ? "#0d1117" : "#ffffff" }}>
      <div className="lib-search">
        <input className="input" placeholder={`Search ${fitting.length} ${config.kind} widgets`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search widgets" />
        <div className="lib-cats" role="group" aria-label="Category">
          <button type="button" aria-pressed={cat === "all"} onClick={() => setCat("all")}>
            All
          </button>
          {CATEGORIES.filter((c) => fitting.some((w) => w.category === c.id)).map((c) => (
            <button type="button" key={c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              {c.id}
            </button>
          ))}
        </div>
      </div>
      {CATEGORIES.filter((c) => list.some((w) => w.category === c.id)).map((c) => (
        <section className="lib-group" key={c.id}>
          <div className="lib-group__head">
            <h4>{c.id}</h4>
            <span>{c.blurb}</span>
          </div>
          <div className="lib-grid">
            {list
              .filter((w) => w.category === c.id)
              .map((w) => (
                <button
                  type="button"
                  key={w.type}
                  className="lib-card"
                  // drag it onto the canvas to place it, or click to add it after the selection
                  onPointerDown={(e) => pressLibraryWidget(e, w.type)}
                  title="Click to add, or drag onto the canvas"
                  onClick={() => {
                    add(w.type);
                    if (window.matchMedia("(max-width: 960px)").matches) setPane("canvas");
                  }}
                  aria-label={`Add ${w.title}`}
                >
                  <div className="lib-card__thumb">
                    <Thumb def={w} />
                  </div>
                  <div className="lib-card__meta">
                    <div className="lib-card__title">
                      {w.title}
                      {w.width !== "full" && <span className="badge">{w.width}</span>}
                      {w.kind === "gif" && <span className="badge">gif</span>}
                      {w.scope === "project" && <span className="badge badge--accent">project</span>}
                    </div>
                    <div className="lib-card__desc">{w.description}</div>
                  </div>
                </button>
              ))}
          </div>
        </section>
      ))}
      {!list.length && <div className="empty">No widget matches “{q}”.</div>}
    </div>
  );
}

export function Rail() {
  const { railTab, setRailTab, config } = useStudio();
  const count = config.layout.reduce((a, r) => a + r.blocks.length, 0);
  return (
    <aside className="panel panel--rail" aria-label="Layers and widgets">
      <Tabs
        label="Left panel"
        value={railTab}
        onChange={setRailTab}
        tabs={[
          { value: "layers", label: `Layers · ${count}`, icon: <Layers /> },
          { value: "add", label: "Add widget", icon: <Plus /> },
        ]}
      />
      <div className="panel__scroll">{railTab === "layers" ? <Layers_ /> : <Library />}</div>
    </aside>
  );
}
