import { getWidget } from "@readme-studio/core";
import { ArrowDown, ArrowUp, BookOpen, Copy, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { marked } from "marked";
import { useMemo } from "react";
import { Button, IconButton, cn } from "../components/ui";
import { WidgetImage } from "../components/WidgetImage";
import { useRenderedLayout, type RenderedPart } from "../lib/render";
import { useStudio } from "../state/store";

marked.setOptions({ gfm: true, breaks: false });

function widthFor(count: number): string {
  return count <= 1 ? "100%" : `${Math.floor(100 / count) - 1}%`;
}

function Tools({ id }: { id: string }) {
  const { move, duplicate, remove } = useStudio();
  return (
    <div className="cv-tools" onClick={(e) => e.stopPropagation()}>
      <IconButton size="sm" label="Move up" onClick={() => move(id, -1)} tipSide="top">
        <ArrowUp />
      </IconButton>
      <IconButton size="sm" label="Move down" onClick={() => move(id, 1)} tipSide="top">
        <ArrowDown />
      </IconButton>
      <IconButton size="sm" label="Duplicate" onClick={() => duplicate(id)} tipSide="top">
        <Copy />
      </IconButton>
      <IconButton size="sm" label="Delete" onClick={() => remove(id)} tipSide="top">
        <Trash2 />
      </IconButton>
    </div>
  );
}

function Markdown({ part, selected, onSelect }: { part: RenderedPart; selected: boolean; onSelect: () => void }) {
  const html = useMemo(() => marked.parse(part.markdown ?? "", { async: false }) as string, [part.markdown]);
  return (
    <div className={cn("cv-md", selected && "is-selected")} onClick={onSelect}>
      {selected && <div className="cv-tag">{part.meta.block.id}</div>}
      {selected && <Tools id={part.meta.block.id} />}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function Canvas() {
  const { config, data, mode, device, epoch, selected, select, openDialog, setRailTab, setPane } = useStudio();
  const { rows } = useRenderedLayout(config, data, mode);
  const empty = !config.layout.length;
  const parts = rows.reduce((a, r) => a + r.parts.length, 0);
  const bytes = rows.reduce((a, r) => a + r.parts.reduce((b, p) => b + (p.svg?.length ?? 0), 0), 0);
  const pick = (id: string) => select(selected === id ? null : id);
  return (
    <main className="canvas" onClick={() => select(null)} aria-label="Preview">
      <div className="canvas__inner">
        <div className="canvas__meta">
          <span className="mono">
            {config.profile.login}/{config.profile.login} · README.md
          </span>
          <span className="mono hide-sm">
            {parts} images · ~{Math.round(bytes / 1024)} KB per theme · {data.source === "mock" ? "sample data" : `live: ${data.source}`}
          </span>
        </div>
        <div className={cn("gh", mode === "dark" ? "gh--dark" : "gh--light", device === "mobile" && "gh--mobile")}>
          <div className="gh__head">
            <BookOpen />
            <span>README</span>
            <span className="gh__login">· {config.profile.login}</span>
          </div>
          <div className="gh__body">
            {empty ? (
              <div className="canvas-empty" onClick={(e) => e.stopPropagation()}>
                <h3>Start with a blank page, or a finished design</h3>
                <p>Add widgets one by one from the library, or load one of the presets and make it yours.</p>
                <div className="row">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setRailTab("add");
                      setPane("layers");
                    }}
                  >
                    <Plus /> Add a widget
                  </Button>
                  <Button onClick={() => openDialog("presets")}>
                    <LayoutTemplate /> Browse presets
                  </Button>
                </div>
              </div>
            ) : (
              rows.map((row) => {
                const fluid = row.parts.filter((p) => !p.meta.fixedHeight && p.meta.kind !== "markdown").length;
                const images = row.parts.filter((p) => p.meta.kind !== "markdown");
                const md = row.parts.filter((p) => p.meta.kind === "markdown");
                return (
                  <div key={row.rowId}>
                    {md.map((p) => (
                      <Markdown
                        key={p.meta.name}
                        part={p}
                        selected={selected === p.meta.block.id}
                        onSelect={() => {
                          pick(p.meta.block.id);
                        }}
                      />
                    ))}
                    {images.length > 0 && (
                      <div className="cv-row" style={{ textAlign: row.align as "left" }}>
                        {images.map((p, i) => {
                          const id = p.meta.block.id;
                          const isSel = selected === id;
                          const firstOfBlock = images.findIndex((x) => x.meta.block.id === id) === i;
                          const def = getWidget(p.meta.block.type);
                          return (
                            <span
                              key={p.meta.name}
                              className={cn("cv-item", Boolean(p.meta.fixedHeight) && "cv-item--fixed", isSel && "is-selected", p.meta.block.hidden && "is-hidden")}
                              style={p.meta.fixedHeight ? { height: p.meta.fixedHeight * (device === "mobile" ? 0.85 : 1) } : { width: widthFor(fluid) }}
                              onClick={(e) => {
                                e.stopPropagation();
                                pick(id);
                              }}
                              title={def?.title}
                            >
                              {isSel && firstOfBlock && (
                                <span className="cv-tag">
                                  {def?.title} · {id}
                                </span>
                              )}
                              {isSel && firstOfBlock && <Tools id={id} />}
                              <WidgetImage part={p} epoch={epoch} style={p.meta.fixedHeight ? { height: "100%", width: "auto" } : undefined} />
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
