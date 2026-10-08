/* ------------------------------------------------------------------ */
/*  Calendar — week grid (desktop) + day agenda (mobile)               */
/* ------------------------------------------------------------------ */

import { Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import type { Session } from "../lib/types";
import { addDays, dateKey, DAYS_FULL, DAYS_LETTER, fmtDuration, fmtTime, todayKey } from "../lib/utils";
import { FadeIn } from "./ui";

const DAY_START = 6 * 60; // 6:00 AM
const DAY_END = 22 * 60; // 10:00 PM
const HOUR_PX = 52;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);

export default function CalendarView() {
  const { sessions, weekStart, weekOffset, setWeekOffset, toggleSession, subject } = useApp();

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const tKey = todayKey();
  const inCurrentWeek = weekOffset === 0;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  /* mobile agenda: which day of the viewed week is selected
     (default = today, clamped into the week when navigating) */
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [dayIdx, setDayIdx] = useState(todayIdx);
  useEffect(() => {
    if (weekOffset === 0) setDayIdx(todayIdx);
  }, [weekOffset, todayIdx]);

  const end = days[6];
  const range = `${days[0].getDate()} ${days[0].toLocaleString("en", { month: "short" })} – ${end.getDate()} ${end.toLocaleString("en", { month: "short" })}, ${end.getFullYear()}`;

  const top = (m: number) => ((m - DAY_START) / 60) * HOUR_PX;

  return (
    <FadeIn className="space-y-4">
      {/* -------- toolbar -------- */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[20px] font-bold tracking-tight">{range}</h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="mr-2 hidden items-center gap-4 text-[11.5px] font-medium text-[var(--muted)] md:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[4px] bg-[var(--acc1)]" /> Fixed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[4px] border border-dashed border-[var(--acc2)]" />
              Auto-scheduled
            </span>
          </div>
          <button className="btn btn-ghost !px-3" onClick={() => setWeekOffset(0)} disabled={inCurrentWeek}>
            Today
          </button>
          <button className="icon-btn" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">
            <ChevronLeft size={16} />
          </button>
          <button className="icon-btn" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ============ MOBILE — day agenda ============ */}
      <div className="space-y-3 lg:hidden">
        <div className="flex gap-1.5">
          {days.map((d, i) => {
            const isToday = dateKey(d) === tKey;
            const active = i === dayIdx;
            return (
              <button
                key={d.toISOString()}
                onClick={() => setDayIdx(i)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl border py-2 transition-all ${
                  active
                    ? "grad-bg border-transparent text-white shadow-lg shadow-violet-600/30"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
                }`}
              >
                <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? "text-white/80" : ""}`}>
                  {DAYS_LETTER[d.getDay()]}
                </span>
                <span className="font-display text-[14px] font-bold leading-none">{d.getDate()}</span>
                {isToday && !active && <span className="h-1 w-1 rounded-full bg-[var(--acc2)]" />}
              </button>
            );
          })}
        </div>

        <div className="card p-4">
          <h3 className="mb-3 font-display text-[14px] font-bold tracking-tight">
            {DAYS_FULL[days[dayIdx].getDay()]}, {days[dayIdx].getDate()}{" "}
            {days[dayIdx].toLocaleString("en", { month: "long" })}
          </h3>
          <AgendaList
            sessions={sessions.filter((s) => s.date === dateKey(days[dayIdx]))}
            onToggle={toggleSession}
          />
        </div>
      </div>

      {/* ============ DESKTOP — week grid ============ */}
      <div className="card hidden overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <div className="min-w-[880px]">
            {/* day header */}
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[var(--border)]">
              <div />
              {days.map((d) => {
                const isToday = dateKey(d) === tKey;
                const isPast = dateKey(d) < tKey;
                return (
                  <div
                    key={d.toISOString()}
                    className={`flex flex-col items-center gap-0.5 border-l border-[var(--border)] py-2.5 ${
                      isToday ? "bg-[var(--acc-soft)]" : ""
                    } ${isPast ? "opacity-50" : ""}`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                      {DAYS_FULL[d.getDay()].slice(0, 3)}
                    </span>
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-[14px] font-bold ${
                        isToday ? "grad-bg text-white shadow-lg shadow-violet-600/40" : "text-[var(--text-soft)]"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* body */}
            <div className="grid grid-cols-[56px_repeat(7,1fr)]">
              {/* time gutter */}
              <div className="relative" style={{ height: HOURS.length * HOUR_PX }}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute right-2 -translate-y-1/2 font-mono text-[10px] font-semibold text-[var(--faint)]"
                    style={{ top: top(h) }}
                  >
                    {fmtTime(h).replace(":00 ", " ")}
                  </div>
                ))}
              </div>

              {/* day columns */}
              {days.map((d) => {
                const key = dateKey(d);
                const isToday = key === tKey;
                const isPast = key < tKey;
                const daySessions = sessions.filter((s) => s.date === key);
                return (
                  <div
                    key={key}
                    className={`relative border-l border-[var(--border)] ${isToday ? "bg-[var(--acc-soft)]/40" : ""}`}
                    style={{
                      height: HOURS.length * HOUR_PX,
                      background: isPast ? "rgba(127,139,168,0.05)" : undefined,
                    }}
                  >
                    {/* hour lines */}
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-[var(--border)]/60"
                        style={{ top: top(h) }}
                      />
                    ))}

                    {/* now line */}
                    {isToday && nowMin > DAY_START && nowMin < DAY_END && (
                      <div className="absolute left-0 right-0 z-10" style={{ top: top(nowMin) }}>
                        <div className="relative border-t-2 border-rose-500">
                          <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-rose-500" />
                        </div>
                      </div>
                    )}

                    {/* sessions */}
                    {daySessions.map((s) => {
                      const sub = subject(s.subject);
                      const h = Math.max(18, ((s.end - s.start) / 60) * HOUR_PX - 3);
                      return (
                        <div
                          key={s.id}
                          className={`cal-event ${s.auto ? "auto-ev" : ""} ${s.done ? "ev-done" : ""} ${
                            key < tKey && !s.done ? "opacity-45" : ""
                          }`}
                          style={{
                            top: top(s.start) + 1,
                            height: h,
                            background: s.auto ? `${sub.color}14` : `${sub.color}26`,
                            borderColor: sub.color,
                            color: "var(--text)",
                          }}
                          title={`${s.taskName} · ${fmtTime(s.start)}–${fmtTime(s.end)} — click to toggle done`}
                          onClick={() => toggleSession(s)}
                        >
                          <div className="flex items-center gap-1 truncate font-semibold leading-tight">
                            {s.done ? (
                              <Check size={10} strokeWidth={3.5} className="flex-none text-emerald-400" />
                            ) : (
                              s.auto && h > 34 && <Sparkles size={9} className="flex-none" style={{ color: sub.color }} />
                            )}
                            <span className="truncate">{s.taskName}</span>
                          </div>
                          {h > 34 && (
                            <div className="truncate text-[9.5px] font-medium opacity-60">
                              {fmtTime(s.start)} – {fmtTime(s.end)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="hidden text-[12px] text-[var(--muted)] lg:block">
        Tip — click any block to mark it done. Dashed blocks were placed automatically around your
        fixed classes; completed blocks feed your analytics.
      </p>
    </FadeIn>
  );
}

/* Vertical agenda list (mobile) */
function AgendaList({
  sessions,
  onToggle,
}: {
  sessions: Session[];
  onToggle: (s: Session) => void;
}) {
  const { subject } = useApp();
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-6 text-center">
        <Sparkles size={18} className="mx-auto mb-1.5 text-[var(--acc2)]" />
        <p className="text-[12.5px] font-semibold">No blocks this day</p>
        <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">Enjoy the breather — or add a task.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const sub = subject(s.subject);
        return (
          <div
            key={s.id}
            className={`flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 ${
              s.done ? "is-done" : ""
            }`}
          >
            <button className={`check ${s.done ? "on" : ""}`} onClick={() => onToggle(s)} aria-label="Toggle done">
              {s.done && <Check size={13} strokeWidth={3.5} />}
            </button>
            <div className="w-[72px] flex-none font-mono text-[10.5px] font-semibold leading-tight text-[var(--muted)]">
              {fmtTime(s.start)}
              <br />
              <span className="opacity-60">{fmtTime(s.end)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="strike truncate text-[13px] font-semibold">{s.taskName}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[var(--muted)]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: sub.color }} />
                {sub.name} · {fmtDuration(s.end - s.start)}
              </div>
            </div>
            <span className={`chip !text-[9.5px] ${s.auto ? "!border-violet-400/40 !text-violet-400" : ""}`}>
              {s.auto ? "auto" : "fixed"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
