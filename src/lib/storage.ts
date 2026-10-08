/* ------------------------------------------------------------------ */
/*  PERSISTENCE — offline-first (Canva-style)                          */
/*                                                                     */
/*  • localStorage is the instant, always-available source of truth.   */
/*  • Firebase Realtime Database mirrors the whole planner state and   */
/*    live-syncs across devices when online (last-write-wins by        */
/*    `updatedAt`; identical-content echoes are ignored so two open    */
/*    tabs never ping-pong).                                           */
/*  • RTDB stores JS arrays as {0:…,1:…} objects — normalizeState()    */
/*    converts them back on every read.                                */
/*  • Everything fails soft: denied read/write → the app just keeps    */
/*    working locally and retries on the next change.                  */
/*                                                                     */
/*  SECURITY NOTE: these keys are public-by-design (like every web     */
/*  Firebase app). Protect data with Realtime Database rules in the    */
/*  Firebase console, e.g. test-mode or auth-gated rules.              */
/* ------------------------------------------------------------------ */

import { DEFAULT_SUBJECTS } from "./data";
import type { PastPaper, PersistedState, Subject, Task } from "./types";

export const LS_STORAGE_KEY = "aceplan-state-v1";
const RTDB_PATH = "aceplan/state";

export interface CloudSnapshot {
  data: PersistedState;
  updatedAt: number;
}

/* --------------------------- local tier ---------------------------- */

/** RTDB/array safety: accept arrays OR {0:…,1:…} objects, return T[] */
const arr = <T>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : v ? (Object.values(v) as T[]) : [];

/** Make any (possibly RTDB-shaped) payload a valid PersistedState */
export function normalizeState(p: Partial<PersistedState> | null | undefined): PersistedState {
  const src = p ?? {};
  const subjects = arr<Subject>(src.subjects);
  return {
    prefs: { theme: "dark", wellness: true, ...(src.prefs ?? {}) },
    doneSessions: src.doneSessions ?? {},
    studyLog: src.studyLog ?? {},
    papers: arr<PastPaper>(src.papers),
    subjects: subjects.length ? subjects : DEFAULT_SUBJECTS.map((s) => ({ ...s })),
    tasks: arr<Task>(src.tasks).map((t) => ({ ...t, weeklyDays: arr<number>(t?.weeklyDays) })),
  };
}

export function loadLocal(): PersistedState | null {
  try {
    const raw = localStorage.getItem(LS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocal(state: PersistedState): void {
  try {
    localStorage.setItem(LS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode — non-fatal */
  }
}

/* --------------------------- cloud tier ---------------------------- */

function firebaseConfig() {
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    apiKey: env.VITE_FIREBASE_API_KEY ?? "AIzaSyC8uJMyinAB17K5tX4pzjUbqjgY7F8Ho64",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "solo-task-for-studenys.firebaseapp.com",
    databaseURL:
      env.VITE_FIREBASE_DATABASE_URL ??
      "https://solo-task-for-studenys-default-rtdb.firebaseio.com",
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? "solo-task-for-studenys",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? "solo-task-for-studenys.firebasestorage.app",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "567171974456",
    appId: env.VITE_FIREBASE_APP_ID ?? "1:567171974456:web:113ad834a29dc9f0efedcd",
    measurementId: "G-Q5FFD4VH3H",
  };
}

type FirebaseDatabase = import("firebase/database").Database;

let db: FirebaseDatabase | null = null;
let initialized = false;
/** suppress cloud writes until the first remote snapshot is processed */
let initialSyncDone = false;
/** timestamp of our last write — used to ignore our own echoes */
let lastWriteAt = 0;

export const cloudEnabled = (): boolean => db !== null;

export interface CloudHandlers {
  /** called with the initial snapshot and every later remote change */
  onData: (snap: CloudSnapshot) => void;
  /** realtime online/offline indicator from RTDB `.info/connected` */
  onConnection?: (online: boolean) => void;
}

export async function initCloud({ onData, onConnection }: CloudHandlers): Promise<boolean> {
  if (initialized && db) return true;
  try {
    const { initializeApp } = await import("firebase/app");
    const rtdb = await import("firebase/database");
    const app = initializeApp(firebaseConfig());
    db = rtdb.getDatabase(app);
    initialized = true;

    /* Anonymous sign-in (harmless if the provider isn't enabled —
       recommended so RTDB rules can require auth). */
    try {
      const { getAuth, signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(getAuth(app));
    } catch {
      /* provider disabled — continue unauthenticated */
    }

    /* live connection indicator */
    if (onConnection) {
      rtdb.onValue(rtdb.ref(db, ".info/connected"), (s) => onConnection(s.val() === true));
    }

    const stateRef = rtdb.ref(db, RTDB_PATH);

    /* 1 · initial snapshot */
    try {
      const first = await rtdb.get(stateRef);
      if (first.exists()) {
        const v = first.val();
        onData({ data: normalizeState(v.data ?? v), updatedAt: v.updatedAt ?? 0 });
      }
    } catch (e) {
      console.warn("[SoloTask] RTDB read failed — staying local.", e);
    }
    initialSyncDone = true;

    /* 2 · live subscription (cross-device sync) */
    rtdb.onValue(stateRef, (s) => {
      if (!s.exists()) return;
      const v = s.val();
      if (typeof v.updatedAt === "number" && v.updatedAt <= lastWriteAt) return; // own echo
      onData({ data: normalizeState(v.data ?? v), updatedAt: v.updatedAt ?? 0 });
    });

    /* web analytics — best effort only */
    try {
      const { getAnalytics } = await import("firebase/analytics");
      getAnalytics(app);
    } catch {
      /* blocked by adblock / unsupported env */
    }

    return true;
  } catch (e) {
    console.warn("[SoloTask] Firebase unavailable — running offline-first.", e);
    db = null;
    return false;
  }
}

/** Mirror the whole planner state to RTDB (fire-and-forget). */
export function cloudSave(state: PersistedState): void {
  if (!db || !initialSyncDone) return;
  lastWriteAt = Date.now();
  const payload: CloudSnapshot = { data: state, updatedAt: lastWriteAt };
  void import("firebase/database")
    .then(({ ref, set }) => set(ref(db as NonNullable<typeof db>, RTDB_PATH), payload))
    .catch((e) => console.warn("[SoloTask] RTDB write failed — will retry on next change.", e));
}
