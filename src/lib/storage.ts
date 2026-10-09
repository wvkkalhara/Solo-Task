/* ------------------------------------------------------------------ */
/*  PERSISTENCE — offline-first, Canva-style                           */
/*                                                                     */
/*  Guarantees                                                         */
/*  • Every change is written to localStorage immediately. Closing the */
/*    tab, losing power or going offline can never lose work.          */
/*  • A meta record tracks updatedAt (last local edit) vs syncedAt     */
/*    (last confirmed cloud write). If they differ the state is DIRTY. */
/*  • Dirty state is flushed automatically: on launch, on reconnect,   */
/*    on tab refocus and after every edit. Edits made days offline     */
/*    still reach the cloud the moment you're back online.             */
/*  • Conflicts resolve by newest-wins on updatedAt, and our own       */
/*    echoes are ignored so two open tabs never fight.                 */
/*                                                                     */
/*  Firebase keys are public-by-design; protect data with Realtime     */
/*  Database rules in the Firebase console.                            */
/* ------------------------------------------------------------------ */

import { DEFAULT_ROUTINE, DEFAULT_SUBJECTS } from "./data";
import type { MealSlot, PastPaper, PersistedState, Subject, Task } from "./types";

export const LS_STORAGE_KEY = "aceplan-state-v1";
const LS_META_KEY = "solotask-meta-v1";
const RTDB_PATH = "aceplan/state";

/** What the sidebar pill shows */
export type SyncState = "offline" | "pending" | "syncing" | "synced";

export interface CloudSnapshot {
  data: PersistedState;
  updatedAt: number;
}

interface Meta {
  /** timestamp of the last local edit */
  updatedAt: number;
  /** timestamp of the last edit confirmed written to the cloud */
  syncedAt: number;
}

/* --------------------------- local tier ---------------------------- */

/** RTDB/array safety: accept arrays OR {0:…,1:…} objects, return T[] */
const arr = <T>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : v ? (Object.values(v) as T[]) : [];

/** Make any (possibly RTDB-shaped) payload a valid PersistedState */
export function normalizeState(p: Partial<PersistedState> | null | undefined): PersistedState {
  const src = p ?? {};
  const subjects = arr<Subject>(src.subjects);
  const rawRoutine = src.prefs?.routine;
  const meals = arr<MealSlot>(rawRoutine?.meals);
  return {
    prefs: {
      theme: "dark",
      wellness: true,
      ...(src.prefs ?? {}),
      routine: {
        ...DEFAULT_ROUTINE,
        ...(rawRoutine ?? {}),
        meals: meals.length ? meals : DEFAULT_ROUTINE.meals.map((m) => ({ ...m })),
      },
    },
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

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(LS_META_KEY);
    if (raw) return JSON.parse(raw) as Meta;
  } catch {
    /* ignore */
  }
  return { updatedAt: 0, syncedAt: 0 };
}

function saveMeta(meta: Meta): void {
  try {
    localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

/** Persist locally and mark the state dirty. Returns the edit stamp. */
export function saveLocal(state: PersistedState): number {
  const updatedAt = Date.now();
  try {
    localStorage.setItem(LS_STORAGE_KEY, JSON.stringify(state));
    saveMeta({ ...loadMeta(), updatedAt });
  } catch {
    /* storage full / private mode — non-fatal */
  }
  return updatedAt;
}

/** Is there local work the cloud hasn't confirmed yet? */
export const isDirty = (): boolean => {
  const m = loadMeta();
  return m.updatedAt > m.syncedAt;
};

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
let online = false;
/** suppress cloud writes until the first remote snapshot is processed */
let initialSyncDone = false;
/** timestamp of our last write — used to ignore our own echoes */
let lastWriteAt = 0;
/** latest state provider, so we can flush whenever the link returns */
let getLocalState: (() => PersistedState) | null = null;
let reportStatus: ((s: SyncState) => void) | null = null;

export const cloudEnabled = (): boolean => db !== null;

const pushStatus = () => {
  if (!reportStatus) return;
  if (!db || !online) reportStatus(isDirty() ? "pending" : "offline");
  else reportStatus(isDirty() ? "syncing" : "synced");
};

export interface CloudHandlers {
  /** always returns the freshest in-memory state */
  getLocal: () => PersistedState;
  /** called with newer remote data (initial load + live changes) */
  onData: (snap: CloudSnapshot) => void;
  /** connection + save-state indicator */
  onStatus: (s: SyncState) => void;
}

export async function initCloud({ getLocal, onData, onStatus }: CloudHandlers): Promise<boolean> {
  getLocalState = getLocal;
  reportStatus = onStatus;
  if (initialized && db) return true;

  try {
    const { initializeApp } = await import("firebase/app");
    const rtdb = await import("firebase/database");
    const app = initializeApp(firebaseConfig());
    db = rtdb.getDatabase(app);
    initialized = true;

    /* Anonymous sign-in (harmless if the provider isn't enabled). */
    try {
      const { getAuth, signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(getAuth(app));
    } catch {
      /* provider disabled — continue unauthenticated */
    }

    const stateRef = rtdb.ref(db, RTDB_PATH);

    /* live connection indicator — flush the backlog on reconnect */
    rtdb.onValue(rtdb.ref(db, ".info/connected"), (s) => {
      online = s.val() === true;
      pushStatus();
      if (online && initialSyncDone && isDirty() && getLocalState) {
        cloudSave(getLocalState());
      }
    });

    /* 1 · initial reconciliation: newest edit wins */
    try {
      const first = await rtdb.get(stateRef);
      const meta = loadMeta();
      if (first.exists()) {
        const v = first.val();
        const remoteAt = typeof v.updatedAt === "number" ? v.updatedAt : 0;
        if (remoteAt > meta.updatedAt) {
          onData({ data: normalizeState(v.data ?? v), updatedAt: remoteAt });
          saveMeta({ updatedAt: remoteAt, syncedAt: remoteAt });
        }
      }
    } catch (e) {
      console.warn("[SoloTask] RTDB read failed — staying local.", e);
    }
    initialSyncDone = true;

    /* 2 · push anything edited while we were offline */
    if (isDirty() && getLocalState) cloudSave(getLocalState());

    /* 3 · live subscription (cross-device sync) */
    rtdb.onValue(stateRef, (s) => {
      if (!s.exists()) return;
      const v = s.val();
      const remoteAt = typeof v.updatedAt === "number" ? v.updatedAt : 0;
      if (remoteAt <= lastWriteAt) return; // our own echo
      if (remoteAt <= loadMeta().updatedAt) return; // our local copy is newer
      onData({ data: normalizeState(v.data ?? v), updatedAt: remoteAt });
      saveMeta({ updatedAt: remoteAt, syncedAt: remoteAt });
      pushStatus();
    });

    /* web analytics — best effort only */
    try {
      const { getAnalytics } = await import("firebase/analytics");
      getAnalytics(app);
    } catch {
      /* blocked by adblock / unsupported env */
    }

    pushStatus();
    return true;
  } catch (e) {
    console.warn("[SoloTask] Firebase unavailable — running offline-first.", e);
    db = null;
    pushStatus();
    return false;
  }
}

/**
 * Mirror state to RTDB. Safe to call constantly: while offline the
 * write simply stays queued and the dirty flag keeps it pending until
 * the connection returns.
 */
export function cloudSave(state: PersistedState): void {
  if (!db || !initialSyncDone) {
    pushStatus();
    return;
  }
  const stamp = loadMeta().updatedAt || Date.now();
  lastWriteAt = stamp;
  pushStatus();

  void import("firebase/database")
    .then(({ ref, set }) =>
      set(ref(db as NonNullable<typeof db>, RTDB_PATH), { data: state, updatedAt: stamp })
    )
    .then(() => {
      const m = loadMeta();
      // only clear the flag if no newer edit happened mid-flight
      saveMeta({ ...m, syncedAt: Math.max(m.syncedAt, stamp) });
      pushStatus();
    })
    .catch((e) => {
      console.warn("[SoloTask] RTDB write queued — will retry when online.", e);
      pushStatus();
    });
}

/** Force a flush (used on tab refocus / manual retry) */
export function flushIfDirty(): void {
  if (isDirty() && getLocalState) cloudSave(getLocalState());
}
