/* ------------------------------------------------------------------ */
/*  INSIGHT ENGINE                                                     */
/*  Three kinds of "smart" the planner needs:                          */
/*   1. Free time    — where are the genuinely empty gaps?             */
/*   2. Paper detect — is this task actually a past paper?             */
/*   3. Catch-up     — what did I plan but never tick off?             */
/* ------------------------------------------------------------------ */

import { getStudyWindows, subtractIntervals, type Interval } from "./scheduler";
import type { PaperMeta, PaperPart, PaperType, Routine, Session, Task } from "./types";
import { addDays, dateKey, todayKey } from "./utils";

/* ================================================================== */
/*  1 · FREE TIME                                                     */
/* ================================================================== */

export interface FreeDay {
  key: string;
  date: Date;
  /** gaps left after fixed classes + scheduled study */
  gaps: Interval[];
  freeMinutes: number;
  busyMinutes: number;
  /** % of the day's available window already committed */
  load: number;
}

/** Only gaps at least this long are worth offering to the student */
const USEFUL_GAP = 25;

/**
 * For each of the next `days`, work out which parts of the study
 * window are still genuinely empty (after fixed classes AND
 * auto-scheduled study blocks).
 */
export function getFreeTime(
  sessions: Session[],
  from: Date,
  routine: Routine,
  days = 7
): FreeDay[] {
  const out: FreeDay[] = [];
  const nowKey = todayKey();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const key = dateKey(date);
    let windows = getStudyWindows(date, routine);

    // today: ignore time that has already passed
    if (key === nowKey) {
      windows = windows
        .map((w) => ({ start: Math.max(w.start, nowMin), end: w.end }))
        .filter((w) => w.end - w.start > 0);
    }

    const windowMinutes = windows.reduce((a, w) => a + (w.end - w.start), 0);
    const busy: Interval[] = sessions
      .filter((s) => s.date === key)
      .map((s) => ({ start: s.start, end: s.end }));

    const gaps = subtractIntervals(windows, busy).filter((g) => g.end - g.start >= USEFUL_GAP);
    const freeMinutes = gaps.reduce((a, g) => a + (g.end - g.start), 0);
    const busyMinutes = Math.max(0, windowMinutes - freeMinutes);

    out.push({
      key,
      date,
      gaps,
      freeMinutes,
      busyMinutes,
      load: windowMinutes ? busyMinutes / windowMinutes : 0,
    });
  }
  return out;
}

/* ================================================================== */
/*  2 · PAPER DETECTION                                               */
/* ================================================================== */

/**
 * Reads a task name and decides whether it describes a past paper.
 * Examples it understands:
 *   "Physics 2022 Paper I MCQ"   → {2022, MCQ, I}
 *   "do 2019 chem p2 essay"      → {2019, Essay, II}
 *   "Combined Maths 2021 paper"  → {2021, Structured, undefined}
 */
export function detectPaper(text: string): PaperMeta | null {
  const s = text.toLowerCase();

  // a 19xx/20xx year is the strongest signal
  const yearMatch = s.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[0]);
  if (year > new Date().getFullYear()) return null;

  // must also look paper-ish
  const paperish = /(paper|past|mcq|essay|structured|\bp1\b|\bp2\b|\bpart\s*(i{1,2}|1|2)\b)/.test(s);
  if (!paperish) return null;

  // part: "paper 1", "paper i", "p1", "part ii"…
  let part: PaperPart | undefined;
  if (/(paper|part|p)\s*\.?\s*(ii|2)\b/.test(s)) part = "II";
  else if (/(paper|part|p)\s*\.?\s*(i|1)\b/.test(s)) part = "I";

  // type
  let paperType: PaperType = "Structured";
  if (/mcq|multiple\s*choice/.test(s)) paperType = "MCQ";
  else if (/essay/.test(s)) paperType = "Essay";
  else if (/structured/.test(s)) paperType = "Structured";
  else if (part === "I") paperType = "MCQ"; // A/L convention
  else if (part === "II") paperType = "Essay";

  return { year, paperType, part };
}

/** Human label used in the UI, e.g. "2022 Paper I · MCQ" */
export const paperLabel = (m: PaperMeta): string =>
  `${m.year}${m.part ? ` Paper ${m.part}` : ""} · ${m.paperType}`;

/* ================================================================== */
/*  3 · CATCH-UP (missed work)                                        */
/* ================================================================== */

export interface MissedDay {
  key: string;
  sessions: Session[];
  minutes: number;
}

/**
 * Study blocks that were scheduled in the past and never ticked.
 * School/fixed-class blocks are ignored — you can't "catch up" on
 * a lesson that already happened.
 */
export function getMissed(sessions: Session[], lookbackDays = 14): MissedDay[] {
  const tKey = todayKey();
  const floor = dateKey(addDays(new Date(), -lookbackDays));
  const byDay = new Map<string, Session[]>();

  for (const s of sessions) {
    if (s.done) continue;
    if (s.kind !== "flexible") continue; // only study work is catch-up-able
    if (s.date >= tKey || s.date < floor) continue;
    const list = byDay.get(s.date) ?? [];
    list.push(s);
    byDay.set(s.date, list);
  }

  return [...byDay.entries()]
    .map(([key, list]) => ({
      key,
      sessions: list,
      minutes: list.reduce((a, s) => a + (s.end - s.start), 0),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

/** Tasks whose deadline has passed while still incomplete */
export function getOverdueTasks(tasks: Task[]): Task[] {
  const tKey = todayKey();
  return tasks
    .filter((t) => !t.completed && t.frequency === "once" && t.deadline < tKey)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}
