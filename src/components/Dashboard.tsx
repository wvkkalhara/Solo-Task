/* ------------------------------------------------------------------ */
/*  Dashboard — "what matters right now" overview                      */
/* ------------------------------------------------------------------ */

import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleSlash2,
  Coffee,
  Droplets,
  FileCheck2,
  Flame,
  Hourglass,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { getFreeTime, getMissed, getOverdueTasks } from "../lib/insights";
import type { Session } from "../lib/types";
import {
  addDays,
  dateKey,
  DAYS_SHORT,
  fmtDateLong,
  fmtDateShort,
  fmtDuration,
  fmtHours,
  fmtTime,
  greeting,
  relDeadline,
  startOfWeek,
  todayKey,
} from "../lib/utils";
import { FadeIn } from "./ui";

export default function Dashboard() {
  const { state, sessions, unplaced, setView, toggleSession, toggleTask, studySubjects, subject } =
    useApp();
  /* dashboard always reflects the REAL current week */
  const weekStart = startOfWeek(new Date());

  const tKey = todayKey();

  /* ---- derived stats ------------------------------------------------ */
  const weekKeys = Array.from({ length: 7 }, (_, i) => dateKey(addDays(weekStart, i)));

  const weekMinutes = weekKeys.reduce((sum, k) => {
    const log = state.studyLog[k] ?? {};
    return (
      sum +
      Object.entries(log)
        .filter(([s]) => s !== "school")
        .reduce((a, [, m]) => a + m, 0)
    );
  }, 0);

  /* Fair block counting: past blocks only count once done,
     today/future blocks count as pending. */
  const weekSessions = sessions.filter((s) => weekKeys.includes(s.date) && s.subject !== "school");
  const pastDone = weekSessions.filter((s) => s.date < tKey && s.done).length;
  const pending = weekSessions.filter((s) => s.date >= tKey);
  const doneCount = pastDone + pending.filter((s) => s.done).length;
  const totalBlocks = pastDone + pending.length;

  /* streak = consecutive days (ending today) with any logged study */
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const log = state.studyLog[dateKey(addDays(new Date(), -i))];
    const total = log
      ? Object.entries(log).filter(([s]) => s !== "school").reduce((a, [, m]) => a + m, 0)
      : 0;
    if (total > 0) streak++;
    else if (i === 0) continue; // an untouched today shouldn't break the streak
    else break;
  }

  const papersDone = state.papers.filter((p) => p.status === "completed");
  const avgScore = papersDone.length
    ? Math.round(papersDone.reduce((a, p) => a + (p.score ?? 0), 0) / papersDone.length)
    : 0;

  const todaySessions = sessions.filter((s) => s.date === tKey);
  const todayPlanned = todaySessions
    .filter((s) => s.subject !== "school")
    .reduce((a, s) => a + (s.end - s.start), 0);

  /* subject focus this week */
  const subjectMins = studySubjects.map((sub) => ({
    ...sub,
    mins: weekKeys.reduce(
      (a, k) => a + ((state.studyLog[k] ?? {})[sub.id] ?? 0),
      0
    ),
  }));
  const maxMin = Math.max(1, ...subjectMins.map((s) => s.mins));

  /* ---- free time + catch-up intelligence ---- */
  const freeDays = getFreeTime(sessions, new Date(), 7);
  const freeToday = freeDays[0];
  const freeWeekMins = freeDays.reduce((a, d) => a + d.freeMinutes, 0);
  const missed = getMissed(sessions);
  const missedMins = missed.reduce((a, d) => a + d.minutes, 0);
  const overdue = getOverdueTasks(state.tasks);

  /* up next: first 3 unfinished sessions from now-ish onward */
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const upcoming = sessions
    .filter((s) => !s.done && s.subject !== "school" && (s.date > tKey || (s.date === tKey && s.end >= nowMin)))
    .slice(0, 3);

  const stats = [
    {
      icon: Hourglass,
      label: "Studied this week",
      value: fmtHours(weekMinutes),
      sub: `${fmtDuration(todayPlanned)} planned today`,
      accent: "#8b5cf6",
    },
    {
      icon: Zap,
      label: "Blocks completed",
      value: `${doneCount}/${totalBlocks}`,
      sub: "this week",
      accent: "#22d3ee",
    },
    {
      icon: Flame,
      label: "Study streak",
      value: `${streak}d`,
      sub: streak > 2 ? "Keep the fire alive" : "Build momentum",
      accent: "#fb923c",
    },
    {
      icon: FileCheck2,
      label: "Papers done",
      value: `${papersDone.length}`,
      sub: papersDone.length ? `avg score ${avgScore}%` : "log your first paper",
      accent: "#34d399",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ------------- hero greeting ------------- */}
      <FadeIn className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">
            {greeting()}, <span className="grad-text">future A* student.</span>
          </h2>
          <p className="mt-1 text-[13.5px] text-[var(--muted)]">
            {fmtDateLong(new Date())} · {todaySessions.length} blocks on your plate ·{" "}
            {fmtDuration(todayPlanned)} of study
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => setView("calendar")}>
          View week <ArrowRight size={14} />
        </button>
      </FadeIn>

      {/* ------------- catch-up: what you didn't do ------------- */}
      {(missed.length > 0 || overdue.length > 0) && (
        <FadeIn delay={0.04}>
          <div className="card overflow-hidden border-amber-400/30 p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-amber-400/20 bg-amber-400/10 px-4 py-3">
              <CircleSlash2 size={17} className="flex-none text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-amber-400">Catch-up needed</div>
                <div className="text-[11.5px] text-[var(--muted)]">
                  {missed.length > 0 && `${fmtDuration(missedMins)} of study you planned but didn’t tick`}
                  {missed.length > 0 && overdue.length > 0 && " · "}
                  {overdue.length > 0 && `${overdue.length} task${overdue.length > 1 ? "s" : ""} past deadline`}
                </div>
              </div>
              <button className="btn btn-ghost !py-1.5 !text-[11.5px]" onClick={() => setView("tasks")}>
                Review <ArrowRight size={13} />
              </button>
            </div>

            <div className="space-y-3 p-4">
              {/* overdue tasks — still actionable */}
              {overdue.slice(0, 3).map((t) => {
                const sub = subject(t.subject);
                return (
                  <div key={t.id} className="flex items-center gap-3">
                    <button
                      className="check"
                      onClick={() => toggleTask(t.id)}
                      aria-label={`Complete ${t.name}`}
                      title="Mark as done now"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">{t.name}</div>
                      <div className="text-[11px] text-[var(--muted)]">
                        {sub.name} · was due {fmtDateShort(t.deadline)}
                      </div>
                    </div>
                    <span className="chip !py-0.5 !text-[10px] !border-rose-400/50 !text-rose-400">
                      {relDeadline(t.deadline).label}
                    </span>
                  </div>
                );
              })}

              {/* missed blocks, grouped by day */}
              {missed.slice(0, 3).map((d) => (
                <div key={d.key} className="flex items-center gap-3">
                  <RotateCcw size={15} className="flex-none text-[var(--muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">
                      {fmtDateShort(d.key)} — {d.sessions.length} block
                      {d.sessions.length > 1 ? "s" : ""} skipped
                    </div>
                    <div className="truncate text-[11px] text-[var(--muted)]">
                      {d.sessions.map((s) => s.taskName.replace(" · cont.", "")).join(", ")}
                    </div>
                  </div>
                  <span className="chip !py-0.5 !text-[10px]">{fmtDuration(d.minutes)}</span>
                </div>
              ))}

              <p className="text-[11.5px] leading-snug text-[var(--muted)]">
                Unfinished one-off work is automatically re-planned into your upcoming free time —
                you don’t need to reschedule it by hand.
              </p>
            </div>
          </div>
        </FadeIn>
      )}

      {/* ------------- stat cards ------------- */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s, i) => (
          <FadeIn key={s.label} delay={0.05 + i * 0.06}>
            <div className="card card-hover p-4">
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `${s.accent}1f`, color: s.accent }}
              >
                <s.icon size={17} />
              </div>
              <div className="font-display text-[24px] font-bold leading-none tracking-tight">
                {s.value}
              </div>
              <div className="mt-1.5 text-[12px] font-semibold text-[var(--text-soft)]">
                {s.label}
              </div>
              <div className="text-[11px] text-[var(--muted)]">{s.sub}</div>
            </div>
          </FadeIn>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* ------------- today's timeline ------------- */}
        <FadeIn delay={0.15} className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold tracking-tight">Today’s plan</h3>
            <span className="chip">
              <Sparkles size={12} className="text-[var(--acc2)]" /> auto-scheduled
            </span>
          </div>

          {unplaced.length > 0 && (
            <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-[12px] leading-snug text-amber-400">
              <AlertTriangle size={14} className="mt-0.5 flex-none" />
              {unplaced.map((t) => t.name).join(", ")} — couldn’t fit before deadline.
            </div>
          )}

          {todaySessions.length === 0 ? (
            <EmptyToday />
          ) : (
            <div className="space-y-2">
              {todaySessions.map((s) => (
                <TodayRow key={s.id} session={s} onToggle={() => toggleSession(s)} />
              ))}
            </div>
          )}
        </FadeIn>

        {/* ------------- right column ------------- */}
        <div className="space-y-4">
          {/* free time finder */}
          <FadeIn delay={0.18} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-[15px] font-bold tracking-tight">
                <Coffee size={15} className="text-[var(--acc2)]" /> Free time
              </h3>
              <span className="chip !text-[10px]">{fmtHours(freeWeekMins)} this week</span>
            </div>

            {freeToday && freeToday.freeMinutes > 0 ? (
              <>
                <p className="text-[12.5px] leading-snug text-[var(--text-soft)]">
                  You have <strong className="text-[var(--acc2)]">{fmtDuration(freeToday.freeMinutes)}</strong>{" "}
                  genuinely free today, in {freeToday.gaps.length} gap
                  {freeToday.gaps.length > 1 ? "s" : ""}:
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {freeToday.gaps.map((g, i) => (
                    <span key={i} className="chip !py-1 font-mono !text-[10.5px]">
                      {fmtTime(g.start)} – {fmtTime(g.end)}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[12.5px] leading-snug text-[var(--muted)]">
                No open gaps left today — your plan is full. Protect your sleep and start fresh
                tomorrow.
              </p>
            )}

            {/* next 7 days load bars */}
            <div className="mt-4 space-y-2">
              {freeDays.map((d) => (
                <div key={d.key} className="flex items-center gap-2.5">
                  <span className="w-8 flex-none text-[10.5px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    {DAYS_SHORT[d.date.getDay()]}
                  </span>
                  <div className="track flex-1 !h-2">
                    <div
                      style={{
                        width: `${Math.round(d.load * 100)}%`,
                        background:
                          d.load > 0.85
                            ? "linear-gradient(90deg,#fb718566,#fb7185)"
                            : d.load > 0.6
                              ? "linear-gradient(90deg,#fbbf2466,#fbbf24)"
                              : "linear-gradient(90deg,#34d39966,#34d399)",
                      }}
                    />
                  </div>
                  <span className="w-[52px] flex-none text-right font-mono text-[10px] text-[var(--muted)]">
                    {fmtDuration(d.freeMinutes)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-snug text-[var(--faint)]">
              Bars show how committed each day is — green means room to breathe or add more work.
            </p>
          </FadeIn>

          <FadeIn delay={0.2} className="card p-5">
            <h3 className="mb-4 font-display text-[15px] font-bold tracking-tight">
              Subject focus <span className="text-[11px] font-medium text-[var(--muted)]">· this week</span>
            </h3>
            <div className="space-y-3.5">
              {subjectMins.map((s) => (
                <div key={s.id}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
                    <span className="font-semibold text-[var(--text-soft)]">{s.name}</span>
                    <span className="font-mono text-[11px] text-[var(--muted)]">
                      {fmtDuration(s.mins)}
                    </span>
                  </div>
                  <div className="track">
                    <div
                      style={{
                        width: `${(s.mins / maxMin) * 100}%`,
                        background: `linear-gradient(90deg, ${s.color}66, ${s.color})`,
                        boxShadow: `0 0 12px ${s.color}55`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.26} className="card p-5">
            <h3 className="mb-3 font-display text-[15px] font-bold tracking-tight">Up next</h3>
            {upcoming.length === 0 ? (
              <p className="text-[12.5px] text-[var(--muted)]">All clear — nothing left scheduled.</p>
            ) : (
              <div className="space-y-2.5">
                {upcoming.map((s) => {
                  const sub = subject(s.subject);
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[10px] font-bold"
                        style={{ background: `${sub.color}1c`, color: sub.color }}
                      >
                        {sub.short}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{s.taskName}</div>
                        <div className="text-[11px] text-[var(--muted)]">
                          {s.date === tKey ? "Today" : s.date === dateKey(addDays(new Date(), 1)) ? "Tomorrow" : s.date} ·{" "}
                          {fmtTime(s.start)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FadeIn>

          <FadeIn delay={0.32}>
            <div className="card overflow-hidden p-0">
              <div className="grad-bg flex items-center gap-3 p-4">
                <Droplets size={18} color="#fff" />
                <div className="text-[13px] font-semibold leading-snug text-white">
                  Small habits win exams — water, breaks, sleep.
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

/* Single row in "Today’s plan" */
function TodayRow({ session: s, onToggle }: { session: Session; onToggle: () => void }) {
  const { subject } = useApp();
  const sub = subject(s.subject);
  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 transition-all hover:border-[var(--border-strong)] ${
        s.done ? "is-done" : ""
      }`}
    >
      <button className={`check ${s.done ? "on" : ""}`} onClick={onToggle} aria-label="Toggle done">
        {s.done && <Check size={13} strokeWidth={3.5} />}
      </button>
      <div className="w-[86px] flex-none font-mono text-[11px] font-semibold leading-tight text-[var(--muted)]">
        {fmtTime(s.start)}
        <br />
        <span className="opacity-60">{fmtTime(s.end)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="strike truncate text-[13.5px] font-semibold">{s.taskName}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: sub.color }} />
            {sub.name}
          </span>
          <span>· {fmtDuration(s.end - s.start)}</span>
        </div>
      </div>
      <span
        className={`chip !text-[10px] ${
          s.auto ? "!border-violet-400/40 !text-violet-400" : ""
        }`}
      >
        {s.auto ? "auto" : "fixed"}
      </span>
    </div>
  );
}

function EmptyToday() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-8 text-center">
      <Sparkles size={20} className="mx-auto mb-2 text-[var(--acc2)]" />
      <p className="text-[13px] font-semibold">No study blocks today</p>
      <p className="mt-1 text-[12px] text-[var(--muted)]">
        Add a task and the auto-scheduler will find time for it.
      </p>
    </div>
  );
}
