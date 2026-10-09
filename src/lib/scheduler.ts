/* ------------------------------------------------------------------ */
/*  AUTO-SCHEDULING ENGINE                                             */
/*                                                                     */
/*  Plans MONTHS ahead, not days. Each day is built as:                */
/*    1. wake → sleep is the only time that exists                     */
/*    2. meals/breaks from your routine are carved out (protected)     */
/*    3. fixed commitments (school, tuition) claim their slots         */
/*    4. what remains is poured with flexible work:                    */
/*         daily habits → weekly routines → deadline-ordered one-offs  */
/*    5. urgency-aware: a task due in 2 days outranks one due in 30,   */
/*       and work is spread so nothing is crammed the night before     */
/*    6. anything that cannot fit before its deadline is reported      */
/* ------------------------------------------------------------------ */

import { MEAL_SUBJECT } from "./data";
import type { Routine, Session, Task } from "./types";
import { addDays, dateKey, startOfDay, toMin } from "./utils";

export interface Interval {
  start: number; // minutes from midnight
  end: number;
}

/** Minimum block worth scheduling */
const MIN_CHUNK = 20;
/** How far ahead the engine plans (≈4 months) */
export const PLAN_DAYS = 120;
/** Cap on daily flexible study so the planner stays humane */
const DAILY_STUDY_CAP = 8 * 60;

/* ------------------------------------------------------------------ */
/*  Day shape                                                          */
/* ------------------------------------------------------------------ */

/** Protected meal/break blocks for a given day */
export function getMealIntervals(routine: Routine): Interval[] {
  return routine.meals
    .filter((m) => m.enabled)
    .map((m) => ({ start: toMin(m.start), end: toMin(m.start) + m.minutes }))
    .sort((a, b) => a.start - b.start);
}

/**
 * When may the student study? Everything between wake and sleep,
 * minus protected meals/breaks.
 */
export function getStudyWindows(_day: Date, routine: Routine): Interval[] {
  const wake = toMin(routine.wake);
  let sleep = toMin(routine.sleep);
  if (sleep <= wake) sleep = 24 * 60 - 1; // guard against inverted input
  return subtractIntervals([{ start: wake, end: sleep }], getMealIntervals(routine));
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

export function generateSchedule(
  tasks: Task[],
  fromDate: Date,
  routine: Routine,
  days = PLAN_DAYS,
  fromFlex?: Date
): ScheduleResult {
  const from = startOfDay(fromDate);
  const flexStart = fromFlex ? startOfDay(fromFlex) : from;
  const sessions: Session[] = [];
  const maxChunk = Math.max(MIN_CHUNK, routine.focusBlock || 90);
  const breakMin = Math.max(0, routine.breakMinutes ?? 10);

  /* Minutes still waiting to be placed, per one-off task id */
  const remaining = new Map<string, number>();
  const placed = new Map<string, number>();
  const oneOffPool = tasks.filter(
    (t) => t.kind === "flexible" && t.frequency === "once" && !t.completed
  );
  oneOffPool.forEach((t) => {
    remaining.set(t.id, t.estimatedMinutes);
    placed.set(t.id, 0);
  });

  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    const key = dateKey(day);
    const dow = day.getDay();

    /* ---- 1 · meals are protected, and shown on the calendar -------- */
    for (const m of routine.meals) {
      if (!m.enabled) continue;
      const start = toMin(m.start);
      sessions.push({
        id: `meal_${m.id}__${key}`,
        taskId: `meal_${m.id}`,
        taskName: m.label,
        subject: MEAL_SUBJECT,
        date: key,
        start,
        end: start + m.minutes,
        kind: "meal",
        auto: false,
        done: false,
      });
    }

    /* ---- 2 · fixed commitments claim their time -------------------- */
    const busy: Interval[] = [];
    for (const t of tasks) {
      if (t.kind !== "fixed" || t.completed || !occursOn(t, day)) continue;
      const start = t.startTime ? toMin(t.startTime) : 18 * 60;
      let end = t.endTime ? toMin(t.endTime) : start + (t.estimatedMinutes || 60);
      if (end <= start) end = start + 60;
      sessions.push(makeSession(t, key, start, end, "fixed", false));
      busy.push({ start, end });
    }

    /* ---- 3 · what is left becomes placeable study blocks ----------- */
    const blocks = subtractIntervals(getStudyWindows(day, routine), busy)
      .filter((b) => b.end - b.start >= MIN_CHUNK)
      .map((b) => ({ ...b }));

    let dailyUsed = 0;

    /** Pour `need` minutes of task t into the day's blocks. */
    const pour = (t: Task, need: number, contStart = false): number => {
      /* ---- unbroken tasks: all-or-nothing in ONE contiguous gap ---- */
      if (t.noSplit) {
        if (need > DAILY_STUDY_CAP - dailyUsed) return need; // no room today
        for (const b of blocks) {
          if (b.end - b.start >= need) {
            sessions.push(makeSession(t, key, b.start, b.start + need, "flexible", false));
            dailyUsed += need;
            b.start += need + breakMin;
            return 0;
          }
        }
        return need; // no single gap big enough — try tomorrow
      }

      let left = need;
      let chunks = 0;
      for (const b of blocks) {
        if (left <= 0 || dailyUsed >= DAILY_STUDY_CAP) break;
        while (b.end - b.start >= MIN_CHUNK && left > 0 && dailyUsed < DAILY_STUDY_CAP) {
          const room = Math.min(left, maxChunk, b.end - b.start, DAILY_STUDY_CAP - dailyUsed);
          if (room < MIN_CHUNK && left > room) break;
          const chunk = Math.max(MIN_CHUNK, Math.min(room, left));
          if (chunk > b.end - b.start) break;
          sessions.push(makeSession(t, key, b.start, b.start + chunk, "flexible", contStart || chunks > 0));
          chunks++;
          left -= chunk;
          dailyUsed += chunk;
          b.start += chunk + (left > 0 ? breakMin : 0);
        }
      }
      return left;
    };

    /* Flexible placement only from `flexStart` onward — past days
       render meals + fixed classes for context only. */
    if (day >= flexStart) {
      /* daily habits keep the streak alive */
      for (const t of tasks) {
        if (t.kind !== "flexible" || t.frequency !== "daily" || t.completed) continue;
        pour(t, t.estimatedMinutes);
      }

      /* weekly routines on their chosen days */
      for (const t of tasks) {
        if (t.kind !== "flexible" || t.frequency !== "weekly" || t.completed) continue;
        if (t.weeklyDays.includes(dow)) pour(t, t.estimatedMinutes);
      }

      /* ---- one-offs: urgency first, then spread the load ----------- */
      const live = oneOffPool
        .filter((t) => (remaining.get(t.id) ?? 0) > 0 && t.deadline >= key)
        .map((t) => {
          const daysLeft = Math.max(1, dayDiff(key, t.deadline) + 1);
          const left = remaining.get(t.id) ?? 0;
          return { t, left, daysLeft, pace: left / daysLeft };
        })
        /* most urgent (least slack per day) first */
        .sort((a, b) => b.pace - a.pace || a.t.deadline.localeCompare(b.t.deadline));

      for (const item of live) {
        if (dailyUsed >= DAILY_STUDY_CAP) break;
        /* Spread: aim for today's fair share, but always allow a full
           push when the deadline is imminent (≤2 days). */
        const fairShare =
          item.t.noSplit || item.daysLeft <= 2
            ? item.left // unbroken work can never be paced in pieces
            : Math.min(item.left, Math.ceil(item.pace / 15) * 15);
        const target = Math.max(MIN_CHUNK, Math.min(item.left, fairShare));
        const leftover = pour(item.t, target, (placed.get(item.t.id) ?? 0) > 0);
        const done = target - leftover;
        placed.set(item.t.id, (placed.get(item.t.id) ?? 0) + done);
        remaining.set(item.t.id, (remaining.get(item.t.id) ?? 0) - done);
      }
    }
  }

  /* ---- report anything that never fit ----------------------------- */
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

/** whole days between two yyyy-mm-dd keys */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000
  );
}
