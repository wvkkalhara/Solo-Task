/* ------------------------------------------------------------------ */
/*  Global application state                                           */
/*  • persists locally (+ Firestore when configured)                   */
/*  • runs the auto-scheduler whenever tasks change                    */
/*  • owns the wellness reminder timer + toast queue                   */
/* ------------------------------------------------------------------ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { emptyState, FALLBACK_SUBJECT } from "../lib/data";
import { generateSchedule, PLAN_DAYS } from "../lib/scheduler";
import {
  cloudSave,
  flushIfDirty,
  initCloud,
  loadLocal,
  LS_STORAGE_KEY,
  saveLocal,
  type CloudSnapshot,
  type SyncState,
} from "../lib/storage";
import type {
  PastPaper,
  PersistedState,
  Prefs,
  Routine,
  Session,
  Subject,
  Task,
  TaskInput,
  Toast,
  View,
} from "../lib/types";
import { addDays, fmtDuration, pad, startOfWeek, todayKey, uid } from "../lib/utils";

type CloudStatus = SyncState;

interface Ctx {
  state: PersistedState;
  sessions: Session[];
  unplaced: Task[];
  view: View;
  setView: (v: View) => void;
  theme: Prefs["theme"];
  toggleTheme: () => void;
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  weekStart: Date;
  cloud: CloudStatus;
  mobileNav: boolean;
  setMobileNav: (b: boolean) => void;
  /* tasks */
  addTask: (input: TaskInput) => void;
  addInterruption: (name: string, minutes: number, startMin?: number) => void;
  updateTask: (id: string, input: TaskInput) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  toggleSession: (s: Session) => void;
  /* papers */
  addPaper: (p: Omit<PastPaper, "id">) => void;
  updatePaper: (id: string, p: Omit<PastPaper, "id">) => void;
  deletePaper: (id: string) => void;
  togglePaperStatus: (id: string) => void;
  /* subjects */
  subjects: Subject[];
  studySubjects: Subject[];
  subject: (id: string) => Subject;
  addSubject: (name: string, short: string, color: string) => void;
  updateSubject: (id: string, patch: Partial<Omit<Subject, "id">>) => void;
  deleteSubject: (id: string, cascade?: boolean) => void;
  subjectsOpen: boolean;
  setSubjectsOpen: (b: boolean) => void;
  /* routine / settings */
  routine: Routine;
  updateRoutine: (patch: Partial<Routine>) => void;
  settingsOpen: boolean;
  setSettingsOpen: (b: boolean) => void;
  /** a just-completed paper awaiting its score */
  pendingScorePaperId: string | null;
  setPendingScorePaperId: (id: string | null) => void;
  /* prefs + toasts */
  setWellness: (b: boolean) => void;
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  resetAll: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export const useApp = (): Ctx => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
};

/** Random wellness nudges — hydrated breaks, eyes, posture */
const WELLNESS: Omit<Toast, "id">[] = [
  { icon: "water", title: "Hydration check", body: "Drink a glass of water — your brain is 75% water." },
  { icon: "break", title: "20 · 20 · 20", body: "Look at something 20 feet away for 20 seconds." },
  { icon: "stretch", title: "Stretch break", body: "Roll your shoulders, stand up, reach for the ceiling." },
  { icon: "break", title: "Screen break", body: "Step away from the screen for 5 minutes. Eyes need rest too." },
  { icon: "water", title: "Sip some water", body: "Small sips keep focus high during long sessions." },
  { icon: "stretch", title: "Posture check", body: "Sit tall — shoulders back, feet flat, screen at eye level." },
];

export function AppProvider({ children }: { children: ReactNode }) {
  /* ---------- core persisted state (lazy init: local → seed) ------- */
  const [state, setState] = useState<PersistedState>(() => loadLocal() ?? emptyState());
  const [view, setView] = useState<View>("dashboard");
  const [weekOffset, setWeekOffset] = useState(0);
  const [cloud, setCloud] = useState<CloudStatus>("offline");
  const [mobileNav, setMobileNav] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  /** set when a paper-task is completed → opens the "add marks" modal */
  const [pendingScorePaperId, setPendingScorePaperId] = useState<string | null>(null);

  /* ------------- subjects (editable, state-driven) ------------------ */
  const subjects = state.subjects;
  const studySubjects = useMemo(() => subjects.filter((s) => !s.excluded), [subjects]);
  const subject = useCallback(
    (id: string): Subject => subjects.find((s) => s.id === id) ?? FALLBACK_SUBJECT(id),
    [subjects]
  );

  const theme = state.prefs.theme;
  const weekStart = useMemo(
    () => startOfWeek(addDays(new Date(), weekOffset * 7)),
    [weekOffset]
  );

  /* ------------------------- toasts -------------------------------- */
  const dismissToast = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = uid();
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]); // keep max 4
    window.setTimeout(() => dismissToast(id), 6000);
  }, [dismissToast]);

  /* Latest state as JSON — lets the cloud handler skip identical data
     so two open tabs never bounce the same snapshot back and forth. */
  const stateJsonRef = useRef("");
  useEffect(() => {
    stateJsonRef.current = JSON.stringify(state);
  }, [state]);

  /* --------------- cloud bootstrap + live sync ---------------------- */
  useEffect(() => {
    let cancelled = false;
    const handleRemote = (snap: CloudSnapshot) => {
      if (cancelled || !snap?.data) return;
      if (JSON.stringify(snap.data) === stateJsonRef.current) return; // identical
      setState(snap.data);
      saveLocal(snap.data); // keep the offline copy fresh too
    };
    void initCloud({
      getLocal: () => JSON.parse(stateJsonRef.current) as PersistedState,
      onData: handleRemote,
      onStatus: (s) => {
        if (!cancelled) setCloud(s);
      },
    });

    /* flush any offline backlog when the tab regains focus */
    const onFocus = () => !document.hidden && flushIfDirty();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", flushIfDirty);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", flushIfDirty);
    };
  }, []);

  /* ----------------- persistence (debounced) ------------------------ */
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveLocal(state);
      cloudSave(state); // guards internally (not-ready → skipped)
    }, 350);
    return () => window.clearTimeout(saveTimer.current);
  }, [state]);

  /* ------------- final flush when the tab hides/closes -------------- */
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(LS_STORAGE_KEY, stateJsonRef.current);
      } catch {
        /* ignore */
      }
    };
    const onHide = () => document.hidden && flush();
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  /* ---------------------- theme side-effect ------------------------- */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  /* ------------------- welcome toast (once) ------------------------- */
  const welcomed = useRef(false);
  useEffect(() => {
    if (welcomed.current) return;
    welcomed.current = true;
    const t = window.setTimeout(
      () =>
        pushToast({
          icon: "sparkle",
          title: "Welcome back",
          body: "Your week is auto-planned. Tick blocks as you finish them.",
        }),
      1400
    );
    return () => window.clearTimeout(t);
  }, [pushToast]);

  /* --------------- wellness reminder timer -------------------------- */
  useEffect(() => {
    if (!state.prefs.wellness) return;
    const fire = () => {
      const tip = WELLNESS[Math.floor(Math.random() * WELLNESS.length)];
      pushToast(tip);
    };
    // first nudge arrives shortly after launch so the feature is visible,
    // then settles into a gentle 25-minute rhythm
    const first = window.setTimeout(fire, 25000);
    const iv = window.setInterval(fire, 25 * 60 * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(iv);
    };
  }, [state.prefs.wellness, pushToast]);

  /* ------------------- derived: auto-schedule ----------------------- */
  /* Render from this week's Monday (so past fixed classes stay visible),
     but only PLACE flexible work from today onward. */
  const { sessions, unplaced } = useMemo(() => {
    const r = generateSchedule(
      state.tasks,
      startOfWeek(new Date()),
      state.prefs.routine,
      PLAN_DAYS,
      new Date()
    );
    for (const s of r.sessions) s.done = !!state.doneSessions[s.id];
    return r;
  }, [state.tasks, state.doneSessions]);

  /* --------------------------- actions ------------------------------ */
  const addTask = useCallback(
    (input: TaskInput) => {
      const t: Task = { ...input, id: uid(), createdAt: Date.now(), completed: false };

      /* If the task describes a past paper, mirror it into the vault
         as a "planned" attempt so the two stay in sync. */
      let paper: PastPaper | null = null;
      if (input.paperMeta) {
        paper = {
          id: uid(),
          subject: input.subject,
          year: input.paperMeta.year,
          paperType: input.paperMeta.paperType,
          part: input.paperMeta.part,
          status: "planned",
          date: input.deadline,
        };
        t.linkedPaperId = paper.id;
      }

      setState((s) => ({
        ...s,
        tasks: [...s.tasks, t],
        papers: paper ? [...s.papers, paper] : s.papers,
      }));

      pushToast(
        paper
          ? {
              icon: "check",
              title: "Task + paper logged",
              body: `Scheduled, and added to your Past Paper vault as planned.`,
            }
          : {
              icon: "sparkle",
              title: "Task added",
              body:
                input.kind === "flexible"
                  ? "Auto-scheduler placed it in your free time."
                  : "Locked into your timetable.",
            }
      );
    },
    [pushToast]
  );

  /**
   * Quick-capture an unplanned commitment that is happening NOW
   * (visitor, errand, extra class). It claims real time today, and
   * every flexible block is instantly re-planned around it.
   */
  const addInterruption = useCallback(
    (name: string, minutes: number, startMin?: number) => {
      const now = new Date();
      const begin = startMin ?? now.getHours() * 60 + now.getMinutes();
      const end = Math.min(24 * 60 - 1, begin + minutes);
      const date = todayKey();

      const task: Task = {
        id: uid(),
        name: name.trim() || "Something came up",
        subject: state.subjects[0]?.id ?? "",
        estimatedMinutes: minutes,
        deadline: date,
        frequency: "once",
        weeklyDays: [],
        kind: "fixed",
        urgent: true,
        startTime: `${pad(Math.floor(begin / 60))}:${pad(begin % 60)}`,
        endTime: `${pad(Math.floor(end / 60))}:${pad(end % 60)}`,
        completed: false,
        createdAt: Date.now(),
      };

      /* measure how much study today gets pushed out, so the toast
         can tell the truth instead of a vague "rescheduled" */
      const before = generateSchedule(state.tasks, now, state.prefs.routine, 1, now)
        .sessions.filter((s) => s.date === date && s.kind === "flexible")
        .reduce((a, s) => a + (s.end - s.start), 0);
      const after = generateSchedule([...state.tasks, task], now, state.prefs.routine, 1, now)
        .sessions.filter((s) => s.date === date && s.kind === "flexible")
        .reduce((a, s) => a + (s.end - s.start), 0);
      const moved = Math.max(0, before - after);

      setState((s) => ({ ...s, tasks: [...s.tasks, task] }));
      pushToast({
        icon: "sparkle",
        title: `Blocked ${fmtDuration(minutes)} — plan updated`,
        body:
          moved > 0
            ? `${fmtDuration(moved)} of study moved to your next free time.`
            : "Nothing was displaced — you had room for this.",
      });
    },
    [state.tasks, state.subjects, state.prefs.routine, pushToast]
  );

  const updateTask = useCallback((id: string, input: TaskInput) => {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...input } : t)),
    }));
  }, []);

  /** Deleting a task also removes the paper record it created */
  const deleteTask = useCallback((id: string) => {
    setState((s) => {
      const t = s.tasks.find((x) => x.id === id);
      return {
        ...s,
        tasks: s.tasks.filter((x) => x.id !== id),
        papers: t?.linkedPaperId ? s.papers.filter((p) => p.id !== t.linkedPaperId) : s.papers,
      };
    });
  }, []);

  /** Complete / reopen a one-off task (keeps any linked paper in sync) */
  const toggleTask = useCallback(
    (id: string) => {
      let finishedPaperId: string | undefined;
      setState((s) => {
        const task = s.tasks.find((t) => t.id === id);
        const nowDone = task ? !task.completed : false;
        if (task?.linkedPaperId && nowDone) finishedPaperId = task.linkedPaperId;

        return {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, completed: nowDone, completedAt: nowDone ? Date.now() : undefined }
              : t
          ),
          // mirror completion onto the linked past paper
          papers: task?.linkedPaperId
            ? s.papers.map((p) =>
                p.id === task.linkedPaperId
                  ? {
                      ...p,
                      status: nowDone ? "completed" : "planned",
                      date: nowDone ? todayKey() : p.date,
                      score: nowDone ? (p.score ?? 0) : undefined,
                    }
                  : p
              )
            : s.papers,
        };
      });

      // nudge the student to record their marks
      if (finishedPaperId) {
        setPendingScorePaperId(finishedPaperId);
        pushToast({
          icon: "sparkle",
          title: "Paper finished — add your marks",
          body: "Logged in the vault. Pop in the score to track your trend.",
        });
      }
    },
    [pushToast]
  );

  /** Tick a calendar session — also writes into the study log */
  const toggleSession = useCallback((session: Session) => {
    setState((s) => {
      const done = !s.doneSessions[session.id];
      const minutes = session.end - session.start;
      const dayLog = { ...(s.studyLog[session.date] ?? {}) };
      dayLog[session.subject] = Math.max(
        0,
        (dayLog[session.subject] ?? 0) + (done ? minutes : -minutes)
      );
      return {
        ...s,
        doneSessions: { ...s.doneSessions, [session.id]: done },
        studyLog: { ...s.studyLog, [session.date]: dayLog },
      };
    });
  }, []);

  /* ------------------------- papers --------------------------------- */
  const addPaper = useCallback(
    (p: Omit<PastPaper, "id">) => {
      setState((s) => ({ ...s, papers: [...s.papers, { ...p, id: uid() }] }));
      pushToast({ icon: "check", title: "Paper logged", body: `${p.year} ${p.paperType} added to the vault.` });
    },
    [pushToast]
  );

  const updatePaper = useCallback((id: string, input: Omit<PastPaper, "id">) => {
    setState((s) => ({
      ...s,
      papers: s.papers.map((p) => (p.id === id ? { ...p, ...input } : p)),
    }));
  }, []);

  const deletePaper = useCallback((id: string) => {
    setState((s) => ({ ...s, papers: s.papers.filter((p) => p.id !== id) }));
  }, []);

  const togglePaperStatus = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      papers: s.papers.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === "completed" ? "planned" : "completed",
              score: p.status === "completed" ? undefined : p.score ?? 65,
            }
          : p
      ),
    }));
  }, []);

  /* ------------------------- subjects --------------------------------- */
  const addSubject = useCallback(
    (name: string, short: string, color: string) => {
      const s: Subject = {
        id: `sub_${uid()}`,
        name: name.trim(),
        short: (short.trim() || name.trim().slice(0, 3)).toUpperCase(),
        color,
      };
      setState((st) => ({ ...st, subjects: [...st.subjects, s] }));
      pushToast({ icon: "check", title: "Subject added", body: `${s.name} is ready for planning.` });
    },
    [pushToast]
  );

  const updateSubject = useCallback((id: string, patch: Partial<Omit<Subject, "id">>) => {
    setState((st) => ({
      ...st,
      subjects: st.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }, []);

  /**
   * Deletes a subject. Unused subjects go straight away; subjects that
   * still have tasks/papers require `cascade: true` (the manager shows
   * a confirmation) which also removes every linked task & paper.
   */
  const deleteSubject = useCallback(
    (id: string, cascade = false) => {
      const usedTasks = state.tasks.filter((t) => t.subject === id).length;
      const usedPapers = state.papers.filter((p) => p.subject === id).length;
      if ((usedTasks > 0 || usedPapers > 0) && !cascade) {
        pushToast({
          icon: "info",
          title: "Subject in use",
          body: `Linked to ${usedTasks} task(s) & ${usedPapers} paper(s) — confirm “Delete everything” in the Subjects panel.`,
        });
        return;
      }
      setState((st) => {
        const next: PersistedState = {
          ...st,
          subjects: st.subjects.filter((s) => s.id !== id),
        };
        if (cascade) {
          next.tasks = st.tasks.filter((t) => t.subject !== id);
          next.papers = st.papers.filter((p) => p.subject !== id);
          // prune the subject's minutes from the study log
          const log: PersistedState["studyLog"] = {};
          for (const [day, entry] of Object.entries(st.studyLog)) {
            const rest = { ...entry };
            delete rest[id];
            log[day] = rest;
          }
          next.studyLog = log;
          // prune done-flags belonging to deleted tasks
          const remaining = new Set(next.tasks.map((t) => t.id));
          next.doneSessions = Object.fromEntries(
            Object.entries(st.doneSessions).filter(([sid]) => remaining.has(sid.split("__")[0]))
          );
        }
        return next;
      });
      pushToast({
        icon: "check",
        title: "Subject removed",
        body:
          cascade && (usedTasks > 0 || usedPapers > 0)
            ? `Also removed ${usedTasks} task(s) & ${usedPapers} paper(s).`
            : undefined,
      });
    },
    [state.tasks, state.papers, pushToast]
  );

  /* -------------------------- prefs --------------------------------- */
  const toggleTheme = useCallback(() => {
    setState((s) => ({
      ...s,
      prefs: { ...s.prefs, theme: s.prefs.theme === "dark" ? "light" : "dark" },
    }));
  }, []);

  const setWellness = useCallback((b: boolean) => {
    setState((s) => ({ ...s, prefs: { ...s.prefs, wellness: b } }));
  }, []);

  const resetAll = useCallback(() => {
    localStorage.clear();
    setState(emptyState());
    setWeekOffset(0);
  }, []);

  /* ------------------------ daily routine --------------------------- */
  const updateRoutine = useCallback((patch: Partial<Routine>) => {
    setState((s) => ({
      ...s,
      prefs: { ...s.prefs, routine: { ...s.prefs.routine, ...patch } },
    }));
  }, []);

  const value: Ctx = {
    state,
    sessions,
    unplaced,
    view,
    setView,
    theme,
    toggleTheme,
    weekOffset,
    setWeekOffset,
    weekStart,
    cloud,
    mobileNav,
    setMobileNav,
    addTask,
    addInterruption,
    updateTask,
    deleteTask,
    toggleTask,
    toggleSession,
    addPaper,
    updatePaper,
    deletePaper,
    togglePaperStatus,
    subjects,
    studySubjects,
    subject,
    addSubject,
    updateSubject,
    deleteSubject,
    subjectsOpen,
    setSubjectsOpen,
    routine: state.prefs.routine,
    updateRoutine,
    settingsOpen,
    setSettingsOpen,
    pendingScorePaperId,
    setPendingScorePaperId,
    setWellness,
    toasts,
    pushToast,
    dismissToast,
    resetAll,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
