/* ------------------------------------------------------------------ */
/*  Default subjects + first-run seed data                             */
/*  Subjects live in app STATE (editable by the user) — this file only */
/*  provides the defaults + a realistic starter dataset for A/L        */
/*  students (physical-science stream, Paper I / Paper II structure).  */
/*  Seeded dates are RELATIVE to "today" so the app feels alive.       */
/* ------------------------------------------------------------------ */

import type { PastPaper, PersistedState, Subject, Task } from "./types";
import { addDays, dateKey, startOfDay, uid } from "./utils";

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: "maths", name: "Combined Maths", short: "CM", color: "#8b5cf6" },
  { id: "physics", name: "Physics", short: "PHY", color: "#22d3ee" },
  { id: "chem", name: "Chemistry", short: "CHE", color: "#34d399" },
  { id: "ict", name: "ICT", short: "ICT", color: "#f59e0b" },
  { id: "english", name: "General English", short: "ENG", color: "#f472b6" },
  { id: "school", name: "School", short: "SCH", color: "#64748b", excluded: true },
];

/** Fallback for archived/orphan subject ids */
export const FALLBACK_SUBJECT = (id: string): Subject => ({
  id,
  name: "Archived",
  short: id.slice(0, 3).toUpperCase(),
  color: "#94a3b8",
});

/** Palette offered when creating / editing subjects */
export const SUBJECT_PALETTE = [
  "#8b5cf6", "#22d3ee", "#34d399", "#f59e0b", "#f472b6",
  "#fb7185", "#a3e635", "#60a5fa", "#f97316", "#64748b",
];

/* ------------------------------------------------------------------ */

const task = (t: Partial<Task> & Pick<Task, "name" | "subject">): Task => ({
  id: uid(),
  estimatedMinutes: 60,
  deadline: dateKey(addDays(new Date(), 3)),
  frequency: "once",
  weeklyDays: [],
  kind: "flexible",
  completed: false,
  createdAt: Date.now() - 86400000 * 4,
  ...t,
});

export function seedState(): PersistedState {
  const now = new Date();
  const key = (offset: number) => dateKey(addDays(now, offset));

  /* A believable A/L week: school hours, weekend tuition, and a pile
     of flexible work for the auto-scheduler to juggle. */
  const tasks: Task[] = [
    task({
      name: "School hours",
      subject: "school",
      kind: "fixed",
      frequency: "weekly",
      weeklyDays: [1, 2, 3, 4, 5],
      startTime: "07:30",
      endTime: "13:30",
      estimatedMinutes: 360,
    }),
    task({
      name: "Combined Maths tuition",
      subject: "maths",
      kind: "fixed",
      frequency: "weekly",
      weeklyDays: [6],
      startTime: "08:00",
      endTime: "11:00",
      estimatedMinutes: 180,
    }),
    task({
      name: "Physics revision class",
      subject: "physics",
      kind: "fixed",
      frequency: "weekly",
      weeklyDays: [0],
      startTime: "08:30",
      endTime: "10:30",
      estimatedMinutes: 120,
    }),
    task({
      name: "Physics 2022 Paper I — MCQ",
      subject: "physics",
      estimatedMinutes: 120,
      deadline: key(2),
      notes: "Timed conditions, then mark with the scheme",
    }),
    task({
      name: "Integration by parts — problem set",
      subject: "maths",
      estimatedMinutes: 90,
      deadline: key(3),
      notes: "Ex 7.3 questions 1–20",
    }),
    task({
      name: "ICT — Python past paper questions",
      subject: "ict",
      estimatedMinutes: 60,
      deadline: key(4),
    }),
    task({
      name: "Combined Maths 2021 Paper II",
      subject: "maths",
      estimatedMinutes: 180,
      deadline: key(5),
    }),
    task({
      name: "Organic chemistry flashcards",
      subject: "chem",
      estimatedMinutes: 40,
      frequency: "daily",
    }),
    task({
      name: "General English essay practice",
      subject: "english",
      estimatedMinutes: 45,
      frequency: "weekly",
      weeklyDays: [0, 3],
    }),
    task({
      name: "Waves & sound unit review",
      subject: "physics",
      estimatedMinutes: 75,
      deadline: key(6),
    }),
    /* One already-completed task so the list feels real */
    task({
      name: "Kinematics summary notes",
      subject: "physics",
      estimatedMinutes: 50,
      deadline: key(-1),
      completed: true,
      completedAt: Date.now() - 86400000,
    }),
  ];

  /* Papers mirror the real A/L structure: Paper I (MCQ for science
     subjects) and Paper II (structured / essay). */
  const papers: PastPaper[] = [
    { id: uid(), subject: "maths", year: 2023, paperType: "Structured", part: "I", status: "completed", score: 74, date: key(-9) },
    { id: uid(), subject: "maths", year: 2022, paperType: "Essay", part: "II", status: "completed", score: 68, date: key(-16) },
    { id: uid(), subject: "maths", year: 2021, paperType: "Structured", part: "I", status: "completed", score: 61, date: key(-23) },
    { id: uid(), subject: "maths", year: 2020, paperType: "Essay", part: "II", status: "planned", date: key(7) },
    { id: uid(), subject: "physics", year: 2023, paperType: "MCQ", part: "I", status: "completed", score: 80, date: key(-6) },
    { id: uid(), subject: "physics", year: 2022, paperType: "Structured", part: "II", status: "completed", score: 72, date: key(-13) },
    { id: uid(), subject: "physics", year: 2021, paperType: "Essay", part: "II", status: "planned", date: key(5) },
    { id: uid(), subject: "chem", year: 2023, paperType: "MCQ", part: "I", status: "completed", score: 70, date: key(-4) },
    { id: uid(), subject: "chem", year: 2021, paperType: "Structured", part: "II", status: "planned", date: key(9) },
    { id: uid(), subject: "ict", year: 2023, paperType: "Essay", part: "II", status: "completed", score: 77, date: key(-11) },
    { id: uid(), subject: "ict", year: 2022, paperType: "MCQ", part: "I", status: "planned", date: key(8) },
    { id: uid(), subject: "english", year: 2023, paperType: "Essay", status: "planned", date: key(12) },
  ];

  /* Backfilled study minutes for the past week (drives streak + charts) */
  const log = (offset: number, entries: Record<string, number>) => ({
    [key(offset)]: entries,
  });
  const studyLog: PersistedState["studyLog"] = {
    ...log(-6, { maths: 100, chem: 35 }),
    ...log(-5, { physics: 90, ict: 30 }),
    ...log(-4, { maths: 120, physics: 45 }),
    ...log(-3, { chem: 40, english: 30, maths: 60 }),
    ...log(-2, { physics: 70, maths: 90 }),
    ...log(-1, { maths: 110, ict: 45, physics: 35 }),
  };

  return {
    tasks,
    papers,
    subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s })),
    doneSessions: {},
    studyLog,
    prefs: { theme: "dark", wellness: true },
  };
}

export const TODAY_START = () => startOfDay(new Date());
