import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

/**
 * A vertical list that reorders by dragging a grip (or with the keyboard: focus the grip, Space,
 * arrows, Space). Up/down buttons next to it stay for touch and for anyone who prefers them.
 */
export function SortableList({
  count,
  onMove,
  children,
}: {
  count: number;
  onMove: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = Array.from({ length: count }, (_, i) => `item-${i}`);
  const end = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onMove(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={end}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const HandleCtx = createContext<ReturnType<typeof useSortable> | null>(null);

/** One entry of a SortableList, at position `index`; render a <SortHandle /> inside it. */
export function SortableItem({
  index,
  className,
  style,
  children,
}: {
  index: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const sortable = useSortable({ id: `item-${index}` });
  const own: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    ...(sortable.isDragging ? { zIndex: 2, position: "relative", opacity: 0.85 } : {}),
  };
  return (
    <div ref={sortable.setNodeRef} className={className} style={{ ...style, ...own }}>
      <HandleCtx.Provider value={sortable}>{children}</HandleCtx.Provider>
    </div>
  );
}

/** The grip that drags its SortableItem. */
export function SortHandle({ label }: { label: string }) {
  const s = useContext(HandleCtx);
  if (!s) return null;
  return (
    <span
      className="sort-handle"
      aria-label={label}
      title="Drag to reorder"
      {...s.attributes}
      {...s.listeners}
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical />
    </span>
  );
}

export { arrayMove };
