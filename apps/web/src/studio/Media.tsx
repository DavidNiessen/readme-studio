import { imageKb, MAX_MEDIA, type MediaItem } from "@readme-studio/core";
import { AlertTriangle, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { IconButton, cn, useConfirm, useToast } from "../components/ui";
import { mediaUses } from "../lib/media";
import { shrinkImage } from "../lib/uploadImage";
import { useStudio } from "../state/store";

/**
 * The design's media library. Images are uploaded once, shrunk, and stored in the design; any icon
 * option can use them. Replacing an image here changes it in every widget that uses it.
 */
export function MediaPanel() {
  const media = useStudio((s) => s.config.media);
  const addMedia = useStudio((s) => s.addMedia);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | File[] | null | undefined) => {
    const list = [...(files ?? [])];
    if (!list.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of list) addMedia(f.name, await shrinkImage(f));
      toast(list.length === 1 ? `Added ${list[0].name}` : `Added ${list.length} images`, <ImagePlus />);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="media">
      <p className="media__intro">
        Images for your logo, emblems and icons. Use one with the image button next to any icon field; replace it here and every widget using it updates.
      </p>
      <UploadZone busy={busy} full={media.length >= MAX_MEDIA} onFiles={upload} />
      {error && (
        <p className="media__error" role="alert">
          <AlertTriangle /> {error}
        </p>
      )}
      <div className="media__list">
        {media.map((m) => (
          <MediaRow key={m.id} item={m} />
        ))}
      </div>
      {!media.length && <div className="empty">No images yet. Upload one, then use it with the image button next to any icon field.</div>}
    </div>
  );
}

/** Click to choose files, or drop them here. */
export function UploadZone({
  busy,
  full,
  onFiles,
  label,
}: {
  busy: boolean;
  full: boolean;
  onFiles: (f: FileList | File[]) => void;
  label?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={cn("icon-drop", busy && "is-busy", over && "is-over", full && "is-full")}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!full) onFiles(e.dataTransfer.files);
      }}
    >
      <ImagePlus />
      <span>
        <b>{busy ? "Preparing the image…" : full ? `The library is full (${MAX_MEDIA} images)` : (label ?? "Upload images")}</b>
        <small>PNG, JPEG, SVG, GIF or WebP, or drop them here. Each is shrunk to 256 px and saved in your design.</small>
      </span>
      <input type="file" accept="image/*" multiple hidden disabled={full} onChange={(e) => onFiles(e.target.files ?? [])} />
    </label>
  );
}

function MediaRow({ item }: { item: MediaItem }) {
  const config = useStudio((s) => s.config);
  const { replaceMedia, renameMedia, removeMedia } = useStudio.getState();
  const confirm = useConfirm();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const uses = mediaUses(config, item.id);

  const replace = async (f: File | undefined) => {
    if (!f) return;
    try {
      replaceMedia(item.id, await shrinkImage(f));
      toast(uses.length > 1 ? `Replaced ${item.name} in ${uses.length} places` : `Replaced ${item.name}`, <RefreshCw />);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), <AlertTriangle />);
    }
  };
  const remove = async () => {
    if (uses.length) {
      const ok = await confirm({
        title: `Delete ${item.name}?`,
        body: (
          <>
            It is used by {uses.join(", ")}. {uses.length === 1 ? "That widget" : "Those widgets"} will show no icon until you pick another.
          </>
        ),
        confirmLabel: "Delete image",
        danger: true,
      });
      if (ok !== "confirm") return;
    }
    removeMedia(item.id);
  };

  return (
    <div className="media__item">
      <img className="media__thumb" src={item.data} alt="" />
      <div className="media__meta">
        <input className="media__name" aria-label="Image name" value={item.name} onChange={(e) => renameMedia(item.id, e.target.value)} />
        <span className="mono">
          media:{item.id} · {imageKb(item.data)} KB · {uses.length ? `used by ${uses.length}` : "unused"}
        </span>
      </div>
      <IconButton label={`Replace ${item.name}`} onClick={() => file.current?.click()}>
        <RefreshCw />
      </IconButton>
      <IconButton label={`Delete ${item.name}`} onClick={() => void remove()}>
        <Trash2 />
      </IconButton>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void replace(e.target.files?.[0])} />
    </div>
  );
}
