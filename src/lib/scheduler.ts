/* ------------------------------------------------------------------ */
/*  AUTO-SCHEDULING ENGINE                                             */
/*                                                                     */
/*  Strategy                                                           */
/*  1. Every day has "study windows" (when the student is available).  */
/*  2. Fixed tasks (school, tuition classes…) claim their slots first. */
/*  3. Remaining free windows become placeable blocks.                 */
/*  4. Flexible tasks are poured into those blocks in priority order:  */
/*        daily habits → weekly routines → one-offs (earliest deadline) */
/*  5. A chunk never exceeds MAX_CHUNK minutes (focus limit) and a     */
/*     short BREAK is inserted between consecutive chunks.             */
/*  6. Whatever still doesn't fit is reported as "unplaced" so the UI  */
/*     can warn the student instead of silently dropping work.         */
/* ------------------------------------------------------------------ */

import type { Session, Task } from "./types";
import { addDays, dateKey, startOfDay, toMin } from "./utils";

export interface Interval {
  start: number; // minutes from midnight
  end: number;
}

/** Longest single focus block the engine will create */
const MAX_CHUNK = 90;
/** Minimum block worth scheduling */
const MIN_CHUNK = 20;
/** Breath of fresh air inserted after a chunk when more work follows */
const BREAK = 10;
/** How many days ahead the engine plans */
export const PLAN_DAYS = 14;

/** When is the student available to study? */
export function getStudyWindows(day: Date): Interval[] {
  const dow = day.getDay();
  if (dow === 0 || dow === 6) {
    // Weekend — long, generous windows
    return [
      { start: 8 * 60, end: 12 * 60 },
      { start: 13 * 60, end: 21 * 60 },
    ];
  }
  // Weekday — early morning + after school
  return [
    { start: 6 * 60, end: 7 * 60 + 15 },
    { start: 15 * 60, end: 22 * 60 },
  ];
}

/** Does this task occur on the given calendar day? */
export function occursOn(t: Task, day: Date): boolean {
  switch (t.frequency) {
    case "once":
      return t.deadline === dateKey(day);
    case "daily":
      return true;
    case "weekly":
      return t.weeklyDays.includes(day.getDay());
  }
}

/** windows − busy = free intervals */
export function subtractIntervals(windows: Interval[], busy: Interval[]): Interval[] {
  let free = windows.map((w) => ({ ...w }));
  for (const b of [...busy].sort((a, z) => a.start - z.start)) {
    const next: Interval[] = [];
    for (const w of free) {
      if (b.end <= w.start || b.start >= w.end) {
        next.push(w); // no overlap
        continue;
      }
      if (b.start > w.start) next.push({ start: w.start, end: b.start });
      if (b.end < w.end) next.push({ start: b.end, end: w.end });
    }
    free = next;
  }
  return free;
}

function makeSession(
  t: Task,
  key: string,
  start: number,
  end: number,
  kind: "fixed" | "flexible",
  continued: boolean
): Session {
  return {
    id: `${t.id}__${key}__${start}`,
    taskId: t.id,
    taskName: continued ? `${t.name} · cont.` : t.name,
    subject: t.subject,
    date: key,
    start,
    end,
    kind,
    auto: kind === "flexible",
    done: false,
  };
}

export interface ScheduleResult {
  sessions: Session[];
  /** flexible one-off tasks that could not fully fit before deadline */
  unplaced: Task[];
}

/**
 * @param tasks    all tasks
 * @param fromDate first day to RENDER (e.g. Monday of this week)
 * @param days     how many days to render
 * @param fromFlex flexible work is only PLACED on/after this day
 *                 (keeps the past intact while showing fixed history)
 */
export function generateSchedule(
  tasks: Task[],
  fromDate: Date,
  days = PLAN_DAYS,
  fromFlex?: Date
): ScheduleResult {
  const from = startOfDay(fromDate);
  const flexStart = fromFlex ? startOfDay(fromFlex) : from;
  const sessions: Session[] = [];

  /* Minutes still waiting to be placed, per one-off task id */
  const remaining = new Map<string, number>();
  /* Minutes already placed (for "· cont." labels) */
  const placed = new Map<string, number>();
  tasks
    .filter((t) => t.kind === "flexible" && t.frequency === "once" && !t.completed)
    .forEach((t) => {
      remaining.set(t.id, t.estimatedMinutes);
      placed.set(t.id, 0);
    });

  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    const key = dateKey(day);
    const dow = day.getDay();

    /* ---- 1 · fixed commitments claim their time -------------------- */
    const busy: Interval[] = [];
    for (const t of tasks) {
      if (t.kind !== "fixed" || t.completed || !occursOn(t, day)) continue;
      const start = t.startTime ? toMin(t.startTime) : 18 * 60;
      let end = t.endTime ? toMin(t.endTime) : start + (t.estimatedMinutes || 60);
      if (end <= start) end = start + 60;
      sessions.push(makeSession(t, key, start, end, "fixed", false));
      busy.push({ start, end });
    }

    /* ---- 2 · what is left becomes placeable study blocks ----------- */
    const blocks = subtractIntervals(getStudyWindows(day), busy)
      .filter((b) => b.end - b.start >= MIN_CHUNK)
      .map((b) => ({ ...b }));

    /** Pour `need` minutes of task t into the day's blocks.
        `contStart` marks one-offs already partially planned on earlier
        days (so follow-up chunks read "· cont."). Returns leftover. */
    const pour = (t: Task, need: number, contStart = false): number => {
      let left = need;
      let chunks = 0;
      for (const b of blocks) {
        if (left <= 0) break;
        while (b.end - b.start >= MIN_CHUNK && left > 0) {
          const chunk = Math.min(left, MAX_CHUNK, b.end - b.start);
          sessions.push(
            makeSession(t, key, b.start, b.start + chunk, "flexible", contStart || chunks > 0)
          );
          chunks++;
          left -= chunk;
          // leave a small break after the chunk when more work follows
          b.start += chunk + (left > 0 ? BREAK : 0);
        }
      }
      return left;
    };

    /* Flexible placement only happens from `flexStart` onward —
       past days render fixed commitments for context/history only. */
    if (day >= flexStart) {
      /* ---- 3 · daily habits first (they keep the streak alive) ----- */
      for (const t of tasks) {
        if (t.kind !== "flexible" || t.frequency !== "daily" || t.completed) continue;
        pour(t, t.estimatedMinutes);
      }

      /* ---- 4 · weekly routines on their chosen days ---------------- */
      for (const t of tasks) {
        if (t.kind !== "flexible" || t.frequency !== "weekly" || t.completed) continue;
        if (t.weeklyDays.includes(dow)) pour(t, t.estimatedMinutes);
      }

      /* ---- 5 · one-offs, nearest deadline gets earliest blocks ----- */
      const oneOffs = tasks
        .filter((t) => t.kind === "flexible" && t.frequency === "once" && !t.completed)
        .sort((a, z) => a.deadline.localeCompare(z.deadline));

      for (const t of oneOffs) {
        const left0 = remaining.get(t.id) ?? 0;
        if (left0 <= 0) continue;
        if (t.deadline < key) continue; // deadline already passed — flagged below
        const left = pour(t, left0, (placed.get(t.id) ?? 0) > 0);
        placed.set(t.id, (placed.get(t.id) ?? 0) + (left0 - left));
        remaining.set(t.id, left);
      }
    }
  }

  /* ---- 6 · report anything that never fit -------------------------- */
  const unplaced: Task[] = [];
  for (const [id, left] of remaining) {
    if (left > 0) {
      const t = tasks.find((x) => x.id === id);
      if (t) unplaced.push(t);
    }
  }

  sessions.sort((a, b) =>
    a.date === b.date ? a.start - b.start : a.date.localeCompare(b.date)
  );
  return { sessions, unplaced };
}
