"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, MapPin } from "lucide-react";
import { Deadline, DateText } from "@/components/dates";
import { RatingBadge } from "@/components/rating-select";
import { statusColor } from "@/lib/domain";
import { moveApplication } from "@/lib/actions/applications";
import { positionBetween } from "@/lib/tracker/status-logic";
import type { ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusSelect } from "./status-select";
import type { TrackerItem } from "./types";

type Columns = Record<string, TrackerItem[]>;

function group(items: TrackerItem[], statuses: ApplicationStatus[]): Columns {
  const cols: Columns = Object.fromEntries(statuses.map((s) => [s.id, []]));
  for (const it of items) (cols[it.statusId] ??= []).push(it);
  for (const k of Object.keys(cols)) cols[k].sort((a, b) => a.position - b.position);
  return cols;
}

function CardBody({ item, today, statuses, onStatusChange }: {
  item: TrackerItem;
  today: string;
  statuses: ApplicationStatus[];
  onStatusChange?: (statusId: string) => void;
}) {
  const t = useTranslations();
  return (
    <>
      <Link href={`/tracker/${item.id}`} className="block min-w-0 after:absolute after:inset-0" draggable={false}>
        <p className="eyebrow flex items-center justify-between gap-2 text-[10px] text-muted">
          <span className="truncate">{item.company}</span>
          {item.rating && <RatingBadge rating={item.rating} className="h-4 min-w-8 text-[9px]" />}
        </p>
        <p className="mt-1 line-clamp-2 font-serif text-[15px] font-semibold leading-snug">{item.title}</p>
      </Link>
      <div className="mt-2 flex flex-col gap-1 text-xs text-muted">
        {item.cities.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {item.cities.map((c) => t(`enums.city.${c}`)).join(" · ")}
          </span>
        )}
        {item.nextStepAt ? (
          <span className="inline-flex items-center gap-1 text-foreground">
            <CalendarClock className="size-3" />
            <span className="truncate">{item.nextStep ?? t("application.nextStep")}</span>
            <span className="shrink-0">· <DateText value={item.nextStepAt} /></span>
          </span>
        ) : item.deadline && !item.appliedAt ? (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" />
            <Deadline value={item.deadline} today={today} />
          </span>
        ) : null}
      </div>
      {onStatusChange && (
        <div className="relative z-10 mt-2">
          <StatusSelect statuses={statuses} value={item.statusId} onChange={onStatusChange} />
        </div>
      )}
    </>
  );
}

function SortableCard(props: {
  item: TrackerItem;
  today: string;
  statuses: ApplicationStatus[];
  onStatusChange: (statusId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "relative cursor-grab touch-manipulation rounded-lg border border-border bg-surface p-3 shadow-xs transition-shadow hover:shadow-sm active:cursor-grabbing",
        isDragging && "opacity-40",
        props.item.jobClosed && "opacity-75",
      )}
    >
      <CardBody {...props} />
    </li>
  );
}

function Column({
  status,
  items,
  today,
  statuses,
  onStatusChange,
}: {
  status: ApplicationStatus;
  items: TrackerItem[];
  today: string;
  statuses: ApplicationStatus[];
  onStatusChange: (item: TrackerItem, statusId: string) => void;
}) {
  const t = useTranslations("tracker");
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const color = statusColor(status.color);
  return (
    <section
      aria-label={status.label}
      className="flex w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-lg border border-border bg-surface-muted/60 sm:w-72"
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className={cn("size-2 rounded-full", color.dot)} />
        <h2 className="eyebrow truncate text-foreground">{status.label}</h2>
        <span className="num ml-auto rounded-sm bg-surface px-1.5 text-xs text-muted">{items.length}</span>
      </header>
      <SortableContext id={status.id} items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 rounded-b-xl px-2 pb-3 transition-colors",
            isOver && "bg-accent-soft/60",
          )}
        >
          {items.map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              today={today}
              statuses={statuses}
              onStatusChange={(sid) => onStatusChange(item, sid)}
            />
          ))}
          {items.length === 0 && (
            <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-6 text-xs text-muted">
              {t("columnEmpty")}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

export function Board({ items, statuses, today }: { items: TrackerItem[]; statuses: ApplicationStatus[]; today: string }) {
  const t = useTranslations("tracker");
  const router = useRouter();
  const [columns, setColumns] = useState<Columns>(() => group(items, statuses));
  const [activeId, setActiveId] = useState<string | null>(null);
  const originStatus = useRef<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const activeItem = activeId ? Object.values(columns).flat().find((i) => i.id === activeId) : undefined;

  const findContainer = (id: string, cols: Columns = columns) =>
    id in cols ? id : Object.keys(cols).find((k) => cols[k].some((i) => i.id === id));

  function persist(item: TrackerItem, statusId: string, position: number, from: string | null) {
    startTransition(async () => {
      const res = await moveApplication({ applicationId: item.id, statusId, position });
      if (!res.ok) {
        toast.error(res.error);
        setColumns(group(items, statuses));
        router.refresh();
        return;
      }
      if (from && from !== statusId) {
        toast.success(t("moved", { status: statusById.get(statusId)?.label ?? "" }));
      }
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    originStatus.current = findContainer(String(e.active.id)) ?? null;
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findContainer(String(active.id));
    const to = findContainer(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const moving = cols[from].find((i) => i.id === active.id);
      if (!moving) return cols;
      const target = cols[to];
      const overIndex = target.findIndex((i) => i.id === over.id);
      const index = overIndex >= 0 ? overIndex : target.length;
      return {
        ...cols,
        [from]: cols[from].filter((i) => i.id !== active.id),
        [to]: [...target.slice(0, index), { ...moving, statusId: to }, ...target.slice(index)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const from = originStatus.current;
    originStatus.current = null;
    if (!over) {
      setColumns(group(items, statuses));
      return;
    }
    const to = findContainer(String(over.id));
    if (!to) return;

    let list = columns[to];
    const oldIndex = list.findIndex((i) => i.id === active.id);
    const overIndex = list.findIndex((i) => i.id === over.id);
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) list = arrayMove(list, oldIndex, overIndex);
    const index = list.findIndex((i) => i.id === active.id);
    if (index < 0) return;

    const position = positionBetween(list[index - 1]?.position, list[index + 1]?.position);
    const item = { ...list[index], statusId: to, position };
    if (from === to && item.position === columns[to][oldIndex]?.position && oldIndex === index) return;

    list = list.map((i, idx) => (idx === index ? item : i));
    setColumns((cols) => ({ ...cols, [to]: list }));
    persist(item, to, position, from);
  }

  function onStatusChange(item: TrackerItem, statusId: string) {
    if (statusId === item.statusId) return;
    const target = columns[statusId] ?? [];
    const position = positionBetween(undefined, target[0]?.position);
    const moved = { ...item, statusId, position };
    setColumns((cols) => ({
      ...cols,
      [item.statusId]: cols[item.statusId].filter((i) => i.id !== item.id),
      [statusId]: [moved, ...(cols[statusId] ?? [])],
    }));
    persist(moved, statusId, position, item.statusId);
  }

  return (
    <DndContext
      id="tracker-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setColumns(group(items, statuses));
      }}
    >
      <p className="mb-3 text-xs text-muted">{t("dragHint")}</p>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {statuses.map((s) => (
          <Column
            key={s.id}
            status={s}
            items={columns[s.id] ?? []}
            today={today}
            statuses={statuses}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem && (
          <div className="relative w-64 rotate-2 cursor-grabbing rounded-lg border border-border bg-surface p-3 shadow-lg">
            <CardBody item={activeItem} today={today} statuses={statuses} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
