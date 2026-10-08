/* ------------------------------------------------------------------ */
/*  Past Paper Hub — track attempts, scores, parts and year coverage   */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleDashed, FilePlus2, Pencil, Settings2, Trash2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import type { PastPaper } from "../lib/types";
import { fmtDateShort } from "../lib/utils";
import { FadeIn, Ring } from "./ui";

const TYPE_TONE: Record<PastPaper["paperType"], string> = {
  MCQ: "#22d3ee",
  Structured: "#f59e0b",
  Essay: "#f472b6",
};

export default function PastPapersView({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (p: PastPaper) => void;
}) {
  const { state, deletePaper, togglePaperStatus, studySubjects, setSubjectsOpen } = useApp();
  const [filter, setFilter] = useState("all");

  const papers = useMemo(
    () =>
      [...state.papers]
        .filter((p) => filter === "all" || p.subject === filter)
        .sort((a, z) => z.date.localeCompare(a.date)),
    [state.papers, filter]
  );

  const done = state.papers.filter((p) => p.status === "completed");
  const avg = done.length ? Math.round(done.reduce((a, p) => a + (p.score ?? 0), 0) / done.length) : 0;

  /* per-subject summary for coverage strips */
  const perSubject = studySubjects.map((s) => {
    const sp = state.papers.filter((p) => p.subject === s.id);
    const spDone = sp.filter((p) => p.status === "completed");
    const years = new Set(spDone.map((p) => p.year));
    const savg = spDone.length
      ? Math.round(spDone.reduce((a, p) => a + (p.score ?? 0), 0) / spDone.length)
      : 0;
    return { ...s, total: spDone.length, years, avg: savg };
  });

  return (
    <FadeIn className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="font-display text-[20px] font-bold tracking-tight">Past paper vault</h2>
          <p className="text-[12.5px] text-[var(--muted)]">
            {done.length} completed · {state.papers.length - done.length} planned · avg {avg}%
          </p>
        </div>
        <button className="btn btn-ghost !px-3" onClick={() => setSubjectsOpen(true)} title="Add, edit or remove subjects">
          <Settings2 size={15} />
          <span className="hidden sm:inline">Subjects</span>
        </button>
        <button className="btn btn-primary" onClick={onAdd}>
          <FilePlus2 size={15} /> Log paper
        </button>
      </div>

      {/* subject strips with year coverage */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {perSubject.map((s, i) => (
          <FadeIn key={s.id} delay={i * 0.05}>
            <button
              className={`card card-hover w-full p-4 text-left ${filter === s.id ? "!border-[var(--acc1)]" : ""}`}
              onClick={() => setFilter(filter === s.id ? "all" : s.id)}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold"
                  style={{ background: `${s.color}1c`, color: s.color }}
                >
                  {s.short}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold">{s.name}</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {s.total} done {s.avg > 0 && `· avg ${s.avg}%`}
                  </div>
                </div>
                {s.avg >= 70 && <TrendingUp size={15} className="text-emerald-400" />}
              </div>
              {/* 2015 → 2025 coverage */}
              <div className="flex items-center gap-1">
                {Array.from({ length: 11 }, (_, i) => 2015 + i).map((y) => (
                  <span
                    key={y}
                    title={String(y)}
                    className="h-3.5 flex-1 rounded-[4px] transition-all"
                    style={{
                      background: s.years.has(y) ? s.color : "var(--track)",
                      boxShadow: s.years.has(y) ? `0 0 8px ${s.color}66` : undefined,
                    }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[9px] text-[var(--faint)]">
                <span>2015</span>
                <span>2025</span>
              </div>
            </button>
          </FadeIn>
        ))}
      </div>

      {/* paper cards */}
      {papers.length === 0 ? (
        <div className="card p-10 text-center">
          <CircleDashed size={22} className="mx-auto mb-2 text-[var(--muted)]" />
          <p className="text-[14px] font-semibold">No papers logged yet</p>
          <p className="mt-1 text-[12.5px] text-[var(--muted)]">
            Log your first attempt to start building the vault.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {papers.map((p) => (
              <PaperCard
                key={p.id}
                paper={p}
                onToggle={() => togglePaperStatus(p.id)}
                onEdit={() => onEdit(p)}
                onDelete={() => deletePaper(p.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </FadeIn>
  );
}

function PaperCard({
  paper: p,
  onToggle,
  onEdit,
  onDelete,
}: {
  paper: PastPaper;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { subject } = useApp();
  const sub = subject(p.subject);
  const isDone = p.status === "completed";
  const scoreColor = (p.score ?? 0) >= 70 ? "#34d399" : (p.score ?? 0) >= 50 ? "#fbbf24" : "#fb7185";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`card card-hover group relative overflow-hidden p-4 ${isDone ? "" : "border-dashed"}`}
    >
      {/* subject glow strip */}
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${sub.color}, transparent 70%)` }} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-[26px] font-bold leading-none tracking-tight">
            {p.year}
            {p.part && (
              <span className="ml-2 align-middle font-mono text-[11px] font-bold text-[var(--muted)]">
                P.{p.part}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-[var(--muted)]">
            {fmtDateShort(p.date)}
          </div>
        </div>

        {isDone ? (
          <Ring size={56} stroke={5.5} pct={(p.score ?? 0) / 100} color={scoreColor}>
            <span className="font-mono text-[12px] font-bold">{p.score}%</span>
          </Ring>
        ) : (
          <span className="chip !border-dashed !text-[10px] uppercase tracking-wider">planned</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="chip !py-0.5 !text-[10.5px]" style={{ color: sub.color, borderColor: `${sub.color}44` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: sub.color }} />
          {sub.name}
        </span>
        <span
          className="chip !py-0.5 !text-[10.5px]"
          style={{ color: TYPE_TONE[p.paperType], borderColor: `${TYPE_TONE[p.paperType]}44` }}
        >
          {p.part ? `Paper ${p.part} · ` : ""}{p.paperType}
        </span>
      </div>

      <div className="mt-3.5 flex items-center gap-2 border-t border-[var(--border)] pt-3">
        <button
          onClick={onToggle}
          className={`btn !px-3 !py-1.5 !text-[11.5px] ${isDone ? "btn-ghost" : "btn-primary"}`}
        >
          <CheckCircle2 size={13} />
          {isDone ? "Reopen" : "Mark done"}
        </button>
        <div className="ml-auto flex items-center gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
          <button onClick={onEdit} className="icon-btn !h-8 !w-8" aria-label="Edit paper" title="Edit year, part, marks…">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="icon-btn btn-danger !h-8 !w-8" aria-label="Delete paper">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
