/* ------------------------------------------------------------------ */
/*  Date / formatting helpers                                          */
/*  NOTE: all "date keys" are built from LOCAL time (not toISOString,  */
/*  which is UTC and would shift days for many timezones).             */
/* ------------------------------------------------------------------ */

export const uid = (): string =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const pad = (n: number): string => String(n).padStart(2, "0");

/** yyyy-mm-dd in local time — the canonical key used everywhere */
export const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parse a yyyy-mm-dd key back into a local Date (midnight) */
export const parseKey = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const today = (): Date => new Date();

export const todayKey = (): string => dateKey(new Date());

export const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number): Date => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

/** Monday-start week */
export const startOfWeek = (d: Date): Date => {
  const c = startOfDay(d);
  const dow = (c.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(c, -dow);
};

export const isSameDay = (a: Date, b: Date): boolean => dateKey(a) === dateKey(b);

/** "HH:MM" → minutes since midnight */
export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** minutes since midnight → "8:30 AM" */
export const fmtTime = (min: number): string => {
  const h24 = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  const ampm = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${pad(m)} ${ampm}`;
};

/** 75 → "1h 15m" · 45 → "45m" */
export const fmtDuration = (mins: number): string => {
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${pad(m)}m`;
};

/** minutes → "4.5h" for stat cards */
export const fmtHours = (mins: number): string => {
  const h = mins / 60;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAYS_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
/* Modal day-picker starts on Monday */
export const DAY_PICKER = [
  { d: 1, label: "M" },
  { d: 2, label: "T" },
  { d: 3, label: "W" },
  { d: 4, label: "T" },
  { d: 5, label: "F" },
  { d: 6, label: "S" },
  { d: 0, label: "S" },
];

/** "Saturday, 14 June" */
export const fmtDateLong = (d: Date): string =>
  `${DAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** "Sat, 14 Jun" */
export const fmtDateShort = (key: string): string => {
  const d = parseKey(key);
  return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

/** Human relative deadline: "Today", "Tomorrow", "In 3d", "2d overdue" */
export const relDeadline = (key: string): { label: string; overdue: boolean } => {
  const diff = Math.round(
    (parseKey(key).getTime() - startOfDay(new Date()).getTime()) / 86400000
  );
  if (diff === 0) return { label: "Today", overdue: false };
  if (diff === 1) return { label: "Tomorrow", overdue: false };
  if (diff > 1) return { label: `In ${diff}d`, overdue: false };
  return { label: `${Math.abs(diff)}d overdue`, overdue: true };
};

/** Current-time greeting */
export const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export const capitalize = (s: string): string =>
  s.length ? s[0].toUpperCase() + s.slice(1) : s;
