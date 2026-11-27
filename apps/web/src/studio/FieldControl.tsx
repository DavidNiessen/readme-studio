import { glyphNames, glyphShape, hasIcon, icon, iconList, imageKb, isGlyphName, isImageData, loadMoreIcons, MAX_MEDIA, mediaRef, type Field } from "@readme-studio/core";
import { ArrowDown, ArrowUp, ChevronRight, Images, Plus, Search, Shapes, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { arrayMove, SortableItem, SortableList, SortHandle } from "../components/Sortable";
import { mediaValue } from "../lib/media";
import { shrinkImage } from "../lib/uploadImage";
import { useStudio } from "../state/store";
import { UploadZone } from "./Media";
import { Button, ColorInput, Dialog, Field as FieldWrap, IconButton, Segmented, Select, Slider, TagsInput, TextArea, TextInput, Tabs, ToggleRow, cn } from "../components/ui";

function IconGlyph({ id }: { id: string }) {
  const media = useStudio((st) => st.config.media);
  const ref = mediaRef(id);
  if (ref !== null) {
    const m = media.find((x) => x.id === ref);
    return m ? <img src={m.data} alt="" className="icon-upload" /> : <Search />;
  }
  if (isImageData(id)) return <img src={id} alt="" className="icon-upload" />;
  if (isGlyphName(id)) {
    const g = glyphShape(id);
    return <svg viewBox={g.viewBox} fill="none" stroke="currentColor" strokeWidth={g.strokeWidth} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: g.inner }} />;
  }
  const brand = icon(id);
  return <svg viewBox={brand.viewBox} fill="currentColor" dangerouslySetInnerHTML={{ __html: brand.inner }} />;
}

/** A line icon's name as words, for its tooltip and for search: `git-branch` → `git branch`. */
const words = (id: string) => id.replace(/-/g, " ");

export function IconPicker({ value, onChange, label, allowGlyphs = true }: { value: string; onChange: (v: string) => void; label: string; allowGlyphs?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // the larger brand set comes in on demand; the list refreshes once it is here
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadMoreIcons().then(() => alive && setLoaded((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [open]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => (open ? iconList() : []), [open, loaded]);
  const needle = q.trim().toLowerCase();
  const brand = open ? all.filter((i) => !needle || i.id.includes(needle.replace(/[^a-z0-9]/g, "")) || i.title.toLowerCase().includes(needle)) : [];
  const glyphHits = open && allowGlyphs ? glyphNames.filter((g) => !needle || words(g).includes(needle) || g.includes(needle)) : [];
  const media = useStudio((st) => st.config.media);
  const addMedia = useStudio((st) => st.addMedia);
  const ref = mediaRef(value);
  const used = ref !== null ? media.find((m) => m.id === ref) : undefined;
  const uploaded = isImageData(value);
  const title = ref !== null ? (used ? used.name : "Missing image") : uploaded ? "Uploaded image" : isGlyphName(value) ? words(value) : value && hasIcon(value) ? icon(value).title : value || "None";
  // icons and the media library are separate tabs; a field that already uses an image opens on media
  const [tab, setTab] = useState<"icons" | "media">("icons");
  const openPicker = () => {
    setTab(ref !== null || uploaded ? "media" : "icons");
    setQ("");
    setOpen(true);
  };
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };
  // an upload goes into the design's media library (a README's images cannot load anything from
  // elsewhere), and the field refers to it: replacing it there updates everything that uses it
  const [upload, setUpload] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const take = async (files: FileList | File[]) => {
    const file = [...files][0];
    if (!file) return;
    setUpload({ busy: true });
    try {
      const id = addMedia(file.name, await shrinkImage(file));
      setUpload({ busy: false });
      pick(mediaValue(id));
    } catch (e) {
      setUpload({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <>
      <button type="button" className="icon-current" onClick={openPicker} aria-label={`${label}: ${title}`}>
        {value ? <IconGlyph id={value} /> : <Search />}
        <span>{title}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--faint)", flex: "none" }}>
          {used ? `media · ${imageKb(used.data)} KB` : uploaded ? `${imageKb(value)} KB` : value}
        </span>
      </button>
      {/* built only while open: the grid is hundreds of buttons, and the inspector re-renders on every keystroke */}
      {open && (
      <Dialog
        open
        onClose={() => setOpen(false)}
        title={label}
        subtitle={allowGlyphs ? "Line icons, brand logos, or an image from your media library." : "Brand logos, or an image from your media library."}
        width={560}
      >
        <Tabs
          label="Icon source"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "icons", label: "Icons", icon: <Shapes /> },
            { value: "media", label: media.length ? `Media · ${media.length}` : "Media", icon: <Images /> },
          ]}
        />
        {tab === "icons" ? (
          <>
            <input
              className="input"
              placeholder={`Search ${(allowGlyphs ? glyphNames.length : 0) + all.length} icons, e.g. rocket, database, rust`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-autofocus
              style={{ margin: "14px 0 12px" }}
            />
            <div className="icon-picker__scroll">
              {glyphHits.length > 0 && (
                <>
                  <div className="subhead">Line icons · {glyphHits.length}</div>
                  <div className="icon-picker">
                    {glyphHits.map((g) => (
                      <button key={g} type="button" title={words(g)} aria-label={words(g)} aria-pressed={g === value} onClick={() => pick(g)}>
                        <IconGlyph id={g} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {brand.length > 0 && (
                <>
                  <div className="subhead">Brands · {brand.length}</div>
                  <div className="icon-picker">
                    {brand.map((i) => (
                      <button key={i.id} type="button" title={i.title} aria-label={i.title} aria-pressed={i.id === value} onClick={() => pick(i.id)}>
                        <IconGlyph id={i.id} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!brand.length && !glyphHits.length && <div className="empty">No icon matches “{q}”.</div>}
            </div>
          </>
        ) : (
          <div className="icon-media">
            <UploadZone busy={upload.busy} full={media.length >= MAX_MEDIA} onFiles={(f) => void take(f)} label="Upload an image" />
            {upload.error && (
              <p className="icon-drop__error" role="alert">
                {upload.error}
              </p>
            )}
            {media.length > 0 ? (
              <div className="icon-media__grid">
                {media.map((m) => (
                  <button key={m.id} type="button" className="icon-media__tile" aria-pressed={mediaValue(m.id) === value} onClick={() => pick(mediaValue(m.id))}>
                    <img src={m.data} alt="" />
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty">No images in this design yet. Upload one: it goes into the media library, where you can reuse or replace it.</div>
            )}
          </div>
        )}
      </Dialog>
      )}
    </>
  );
}

/**
 * Ticked options come first, in the order the widget shows them, and reorder by their grip or
 * the arrows; unticked ones follow. Ticking one adds it at the end.
 */
function ChecklistControl({ field, value, onChange }: { field: Extract<Field, { type: "checklist" }>; value: string[]; onChange: (v: string[]) => void }) {
  const max = field.max ?? Infinity;
  const byValue = new Map(field.options.map((o) => [o.value, o]));
  const picked = value.filter((v) => byValue.has(v));
  const rest = field.options.filter((o) => !picked.includes(o.value));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j >= 0 && j < picked.length) onChange(arrayMove(picked, i, j));
  };
  return (
    <div>
      <SortableList count={picked.length} onMove={(from, to) => onChange(arrayMove(picked, from, to))}>
        {picked.map((v, i) => {
          const o = byValue.get(v)!;
          return (
            <SortableItem key={v} index={i} className="check check--sortable">
              <SortHandle label={`Reorder ${o.label}`} />
              <input type="checkbox" checked aria-label={o.label} onChange={() => onChange(picked.filter((x) => x !== v))} />
              <span className="check__label" onClick={() => onChange(picked.filter((x) => x !== v))}>
                {o.label}
              </span>
              <span className="check__order">{i + 1}</span>
              {picked.length > 1 && (
                <span className="check__moves">
                  <IconButton size="sm" label={`Move ${o.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton size="sm" label={`Move ${o.label} down`} disabled={i === picked.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </IconButton>
                </span>
              )}
            </SortableItem>
          );
        })}
      </SortableList>
      {rest.map((o) => (
        <label className="check check--off" key={o.value}>
          <input type="checkbox" checked={false} disabled={picked.length >= max} onChange={() => onChange([...picked, o.value])} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function ListControl({ field, value, onChange }: { field: Extract<Field, { type: "list" }>; value: Record<string, unknown>[]; onChange: (v: Record<string, unknown>[]) => void }) {
  const [open, setOpen] = useState<number | null>(value.length === 1 ? 0 : null);
  const max = field.max ?? 24;
  const set = (i: number, patch: Record<string, unknown>) => onChange(value.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(j);
  };
  return (
    <div className="list-ed">
      <SortableList
        count={value.length}
        onMove={(from, to) => {
          onChange(arrayMove(value, from, to));
          setOpen(open === from ? to : null);
        }}
      >
        {value.map((item, i) => {
          const title = String(item[field.titleKey] ?? "").trim() || `${field.itemLabel} ${i + 1}`;
          return (
            <SortableItem key={i} index={i} className={cn("list-ed__item", open === i && "is-open")}>
              <div className="list-ed__head" onClick={() => setOpen(open === i ? null : i)}>
                <SortHandle label={`Reorder ${title}`} />
                <ChevronRight className="chev" />
                <span>{title}</span>
                <div onClick={(e) => e.stopPropagation()} style={{ display: "flex" }}>
                  <IconButton size="sm" label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton size="sm" label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </IconButton>
                  <IconButton size="sm" label={`Remove ${field.itemLabel.toLowerCase()}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </IconButton>
                </div>
              </div>
              {open === i && (
                <div className="list-ed__body">
                  {field.item.map((f) => (
                    <FieldControl key={f.key} field={f} values={item} onChange={(patch) => set(i, patch)} />
                  ))}
                </div>
              )}
            </SortableItem>
          );
        })}
      </SortableList>
      {value.length < max && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange([...value, structuredClone(field.newItem)]);
            setOpen(value.length);
          }}
          style={{ justifySelf: "start" }}
        >
          <Plus /> Add {field.itemLabel.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

/** Renders the right control for a widget option field. */
export function FieldControl({ field, values, onChange }: { field: Field; values: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  if (field.when && !field.when.is.includes(values[field.when.key])) return null;
  const v = values[field.key];
  const set = (x: unknown) => onChange({ [field.key]: x });
  switch (field.type) {
    case "toggle":
      return <ToggleRow label={field.label} help={field.help} checked={Boolean(v)} onChange={set} />;
    case "text":
      return (
        <FieldWrap label={field.label} help={field.help}>
          {field.multiline ? (
            <TextArea
              value={String(v ?? "")}
              onChange={set}
              placeholder={field.placeholder}
              rows={field.rows ?? 4}
              // a value already over the limit (an imported section, an older config) must stay
              // editable: browsers refuse every keystroke in a textarea that is past its maxLength
              maxLength={field.max && String(v ?? "").length <= field.max ? field.max : undefined}
            />
          ) : (
            <TextInput value={String(v ?? "")} onChange={set} placeholder={field.placeholder} maxLength={field.max} aria-label={field.label} />
          )}
        </FieldWrap>
      );
    case "number":
      return (
        <FieldWrap label={field.label} help={field.help} aside={field.unit}>
          <Slider label={field.label} value={Number(v ?? field.min)} min={field.min} max={field.max} step={field.step} onChange={set} unit={field.unit} />
        </FieldWrap>
      );
    case "select":
      return (
        <FieldWrap label={field.label} help={field.help}>
          <Select label={field.label} value={String(v ?? "")} options={field.options} onChange={set} />
        </FieldWrap>
      );
    case "segmented":
      return (
        <FieldWrap label={field.label} help={field.help}>
          {field.options.length > 4 ? (
            <Select label={field.label} value={String(v ?? "")} options={field.options} onChange={set} />
          ) : (
            <Segmented label={field.label} value={String(v ?? "")} options={field.options} onChange={set} />
          )}
        </FieldWrap>
      );
    case "color":
      return (
        <FieldWrap label={field.label} help={field.help ?? (field.allowTheme ? "Leave empty to follow the theme." : undefined)}>
          <ColorInput label={field.label} value={String(v ?? "")} placeholder="theme" onChange={set} onReset={field.allowTheme !== false ? () => set("") : undefined} />
        </FieldWrap>
      );
    case "icon":
      return (
        <FieldWrap label={field.label} help={field.help}>
          <IconPicker label={field.label} value={String(v ?? "")} onChange={set} />
        </FieldWrap>
      );
    case "tags":
      return (
        <FieldWrap label={field.label} help={field.help} aside={field.max ? `${Array.isArray(v) ? v.length : 0}/${field.max}` : undefined}>
          <TagsInput label={field.label} value={Array.isArray(v) ? (v as string[]) : []} onChange={set} placeholder={field.placeholder} max={field.max} />
        </FieldWrap>
      );
    case "checklist":
      return (
        <FieldWrap label={field.label} help={field.help} aside={field.max ? `${Array.isArray(v) ? v.length : 0}/${field.max}` : undefined}>
          <ChecklistControl field={field} value={Array.isArray(v) ? (v as string[]) : []} onChange={set} />
        </FieldWrap>
      );
    case "list":
      return (
        <FieldWrap label={field.label} help={field.help} aside={`${Array.isArray(v) ? v.length : 0}${field.max ? `/${field.max}` : ""}`}>
          <ListControl field={field} value={Array.isArray(v) ? (v as Record<string, unknown>[]) : []} onChange={set} />
        </FieldWrap>
      );
    default:
      return null;
  }
}
