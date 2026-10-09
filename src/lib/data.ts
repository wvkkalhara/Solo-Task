/* ------------------------------------------------------------------ */
/*  Defaults — subjects, daily routine, and a CLEAN empty state.       */
/*  No demo/sample data: the app starts empty and fills with your      */
/*  real work. Subjects are editable defaults, not fake records.       */
/* ------------------------------------------------------------------ */

import type { PersistedState, Routine, Subject } from "./types";

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
  name: id === MEAL_SUBJECT ? "Break" : "Archived",
  short: id.slice(0, 3).toUpperCase(),
  color: "#94a3b8",
});

/** Palette offered when creating / editing subjects */
export const SUBJECT_PALETTE = [
  "#8b5cf6", "#22d3ee", "#34d399", "#f59e0b", "#f472b6",
  "#fb7185", "#a3e635", "#60a5fa", "#f97316", "#64748b",
];

/** Pseudo-subject id used by meal/break blocks */
export const MEAL_SUBJECT = "__meal";
export const MEAL_COLOR = "#94a3b8";

/** A sensible A/L day — every value is editable in Settings */
export const DEFAULT_ROUTINE: Routine = {
  wake: "05:30",
  sleep: "22:30",
  focusBlock: 90,
  breakMinutes: 10,
  meals: [
    { id: "breakfast", label: "Breakfast", start: "06:30", minutes: 30, enabled: true },
    { id: "lunch", label: "Lunch", start: "12:30", minutes: 45, enabled: true },
    { id: "tea", label: "Tea break", start: "16:00", minutes: 20, enabled: true },
    { id: "dinner", label: "Dinner", start: "19:30", minutes: 45, enabled: true },
  ],
};

/** A brand-new, empty planner */
export const emptyState = (): PersistedState => ({
  tasks: [],
  papers: [],
  subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s })),
  doneSessions: {},
  studyLog: {},
  prefs: {
    theme: "dark",
    wellness: true,
    routine: { ...DEFAULT_ROUTINE, meals: DEFAULT_ROUTINE.meals.map((m) => ({ ...m })) },
  },
});
