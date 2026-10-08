/* ------------------------------------------------------------------ */
/*  Tasks — manage everything the scheduler works with                 */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Clock3,
  FileStack,
  Pencil,
  Plus,
  Repeat,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import type { Task } from "../lib/types";
import { addDays, dateKey, fmtDuration, relDeadline, todayKey } from "../lib/utils";
import { FadeIn } from "./ui";

interface Group {
  label: string;
  tone: "danger" | "accent" | "normal" | "muted";
  items: Task[];
}

export default function TasksView({ onEdit }: { onEdit: (t: Task | null) => void }) {
  const { state, toggleTask, deleteTask, unplaced, studySubjects, setSubjectsOpen } = useApp();
  const [filter, setFilter] = useState<string>("all");

  const tKey = todayKey();

  const groups = useMemo<Group[]>(() => {
    const tasks = state.tasks.filter((t) => filter === "all" || t.subject === filter);
    const open = tasks.filter((t) => t.frequency === "once" && !t.completed);
    const done = tasks.filter((t) => t.completed);
    const recurring = tasks.filter((t) => t.frequency !== "once");
    const soonKey = dateKey(addDays(new Date(), 3));

    const all: Group[] = [
      { label: "Overdue", tone: "danger", items: open.filter((t) => t.deadline < tKey) },
      { label: "Due soon", tone: "accent", items: open.filter((t) => t.deadline >= tKey && t.deadline <= soonKey) },
      { label: "Later", tone: "normal", items: open.filter((t) => t.deadline > soonKey) },
      { label: "Recurring", tone: "normal", items: recurring },
      { label: "Completed", tone: "muted", items: done },
    ];
    return all.filter((g) => g.items.length > 0);
  }, [state.tasks, filter, tKey]);

  const unplacedIds = new Set(unplaced.map((t) => t.id));

  return (
    <FadeIn className="space-y-5">
      {/* header + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-[20px] font-bold tracking-tight">
          Tasks <span className="text-[13px] font-medium text-[var(--muted)]">· {state.tasks.filter((t) => !t.completed).length} open</span>
        </h2>
        <div className="ml-auto flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-nowrap items-center gap-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
            {studySubjects.map((s) => (
              <FilterChip
                key={s.id}
                active={filter === s.id}
                onClick={() => setFilter(filter === s.id ? "all" : s.id)}
                label={s.short}
                color={s.color}
              />
            ))}
          </div>
          <button
            className="icon-btn !h-8 !w-8 flex-none"
            onClick={() => setSubjectsOpen(true)}
            title="Manage subjects"
            aria-label="Manage subjects"
          >
            <Settings2 size={14} />
          </button>
          <button className="btn btn-primary flex-none" onClick={() => onEdit(null)}>
            <Plus size={15} /> Task
          </button>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="card p-10 text-center">
          <Sparkles size={22} className="mx-auto mb-2 text-[var(--acc2)]" />
          <p className="text-[14px] font-semibold">Nothing here</p>
          <p className="mt-1 text-[12.5px] text-[var(--muted)]">
            Add a task — the scheduler will place it in your next free block.
          </p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.label}>
          <h3
            className={`mb-2 text-[11px] font-bold uppercase tracking-[0.14em] ${
              g.tone === "danger"
                ? "text-rose-400"
                : g.tone === "accent"
                  ? "text-[var(--acc2)]"
                  : "text-[var(--muted)]"
            }`}
          >
            {g.label} · {g.items.length}
          </h3>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {g.items.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  warn={unplacedIds.has(t.id)}
                  onToggle={() => toggleTask(t.id)}
                  onEdit={() => onEdit(t)}
                  onDelete={() => deleteTask(t.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </FadeIn>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip cursor-pointer transition-all hover:border-[var(--border-strong)] ${
        active ? "!border-transparent !text-white" : ""
      }`}
      style={active ? { background: color ?? "linear-gradient(120deg,var(--acc1),var(--acc2))" } : undefined}
    >
      {color && !active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}

function TaskRow({
  task: t,
  warn,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  warn: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { subject } = useApp();
  const sub = subject(t.subject);
  const rel = t.frequency === "once" ? relDeadline(t.deadline) : null;
  const recurring = t.frequency !== "once";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, height: 0, marginBottom: 0, overflow: "hidden" }}
      transition={{ duration: 0.25 }}
      className={`group flex items-center gap-3.5 rounded-xl border bg-[var(--surface)] px-4 py-3.5 transition-colors ${
        warn
          ? "border-amber-400/40"
          : "border-[var(--border)] hover:border-[var(--border-strong)]"
      } ${t.completed ? "is-done" : ""}`}
    >
      {/* recurring tasks are ticked per-session on the calendar instead */}
      {recurring ? (
        <span
          className="check !cursor-default"
          style={{ borderColor: `${sub.color}66`, background: `${sub.color}14`, color: sub.color }}
          title="Recurring — tick each block on the calendar"
        >
          <Repeat size={11} />
        </span>
      ) : (
        <button className={`check ${t.completed ? "on" : ""}`} onClick={onToggle} aria-label="Mark done">
          {t.completed && <Check size={13} strokeWidth={3.5} />}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <div className="strike text-[14px] font-semibold leading-snug">{t.name}</div>
        {t.notes && (
          <div className="strike truncate text-[11.5px] text-[var(--muted)]">{t.notes}</div>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="chip !py-0.5 !text-[10px]" style={{ color: sub.color, borderColor: `${sub.color}44` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: sub.color }} />
            {sub.name}
          </span>
          <span className="chip !py-0.5 !text-[10px]">
            <Clock3 size={10} /> {fmtDuration(t.estimatedMinutes)}
          </span>
          {recurring ? (
            <span className="chip !py-0.5 !text-[10px]">
              <Repeat size={10} /> {t.frequency === "daily" ? "Daily" : "Weekly"}
              {t.kind === "fixed" && t.startTime ? ` · ${t.startTime}` : ""}
            </span>
          ) : (
            rel && (
              <span
                className={`chip !py-0.5 !text-[10px] ${
                  rel.overdue && !t.completed ? "!border-rose-400/50 !text-rose-400" : ""
                }`}
              >
                {rel.label}
              </span>
            )
          )}
          {t.paperMeta && (
            <span
              className="chip !py-0.5 !text-[10px] !border-emerald-400/40 !text-emerald-400"
              title="Linked to your Past Paper vault"
            >
              <FileStack size={10} /> in vault
            </span>
          )}
          {t.kind === "flexible" && !t.completed && (
            <span className="chip !py-0.5 !text-[10px] !border-violet-400/40 !text-violet-400">
              <Sparkles size={10} /> auto-planned
            </span>
          )}
          {warn && (
            <span className="chip !py-0.5 !text-[10px] !border-amber-400/50 !text-amber-400">
              won’t fit in time
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button className="icon-btn !h-8 !w-8" onClick={onEdit} aria-label="Edit task">
          <Pencil size={13} />
        </button>
        <button className="icon-btn btn-danger !h-8 !w-8" onClick={onDelete} aria-label="Delete task">
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}
