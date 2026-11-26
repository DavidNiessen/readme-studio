import { glyphs, iconList, type Field } from "@readme-studio/core";
import { ArrowDown, ArrowUp, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { arrayMove, SortableItem, SortableList, SortHandle } from "../components/Sortable";
import { Button, ColorInput, Dialog, Field as FieldWrap, IconButton, Segmented, Select, Slider, TagsInput, TextArea, TextInput, ToggleRow, cn } from "../components/ui";

const GLYPHS = Object.keys(glyphs);

function IconGlyph({ id }: { id: string }) {
  const brand = iconList().find((i) => i.id === id);
  if (brand) return <svg viewBox={brand.viewBox} fill="currentColor" dangerouslySetInnerHTML={{ __html: brand.inner }} />;
  const g = (glyphs as Record<string, string>)[id];
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: g ?? glyphs.code }} />;
}

export function IconPicker({ value, onChange, label, allowGlyphs = true }: { value: string; onChange: (v: string) => void; label: string; allowGlyphs?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const all = useMemo(() => iconList(), []);
  const brand = all.filter((i) => !q || i.id.includes(q.toLowerCase()) || i.title.toLowerCase().includes(q.toLowerCase()));
  const glyphHits = allowGlyphs ? GLYPHS.filter((g) => !q || g.includes(q.toLowerCase())) : [];
  const title = all.find((i) => i.id === value)?.title ?? (value || "None");
  return (
    <>
      <button type="button" className="icon-current" onClick={() => setOpen(true)} aria-label={`${label}: ${title}`}>
        {value ? <IconGlyph id={value} /> : <Search />}
        <span>{title}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--faint)", flex: "none" }}>
          {value}
        </span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={label} subtitle="Brand icons from Simple Icons, plus line glyphs." width={460}>
        <input className="input" placeholder="Search 150+ icons" value={q} onChange={(e) => setQ(e.target.value)} data-autofocus style={{ marginBottom: 12 }} />
        {glyphHits.length > 0 && (
          <>
            <div className="subhead">Line glyphs</div>
            <div className="icon-picker">
              {glyphHits.map((g) => (
                <button
                  key={g}
                  type="button"
                  title={g}
                  aria-pressed={g === value}
                  onClick={() => {
                    onChange(g);
                    setOpen(false);
                  }}
                >
                  <IconGlyph id={g} />
                </button>
              ))}
            </div>
          </>
        )}
        <div className="subhead">Brands</div>
        <div className="icon-picker" style={{ maxHeight: 300 }}>
          {brand.map((i) => (
            <button
              key={i.id}
              type="button"
              title={i.title}
              aria-pressed={i.id === value}
              onClick={() => {
                onChange(i.id);
                setOpen(false);
              }}
            >
              <IconGlyph id={i.id} />
            </button>
          ))}
        </div>
        {!brand.length && !glyphHits.length && <div className="empty">No icon matches “{q}”.</div>}
      </Dialog>
    </>
  );
}

function ChecklistControl({ field, value, onChange }: { field: Extract<Field, { type: "checklist" }>; value: string[]; onChange: (v: string[]) => void }) {
  const max = field.max ?? Infinity;
  return (
    <div>
      {field.options.map((o) => {
        const idx = value.indexOf(o.value);
        const on = idx >= 0;
        return (
          <label className="check" key={o.value}>
            <input type="checkbox" checked={on} disabled={!on && value.length >= max} onChange={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])} />
            <span>{o.label}</span>
            {on && <span className="check__order">{idx + 1}</span>}
          </label>
        );
      })}
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
