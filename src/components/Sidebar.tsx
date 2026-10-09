/* ------------------------------------------------------------------ */
/*  Sidebar — brand, primary nav, planner health, preferences          */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BellRing,
  BookMarked,
  CalendarDays,
  ChartNoAxesColumn,
  Clock,
  Cloud,
  CloudOff,
  Download,
  FileStack,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import type { View } from "../lib/types";

/** Chrome/Edge PWA install prompt event (not in TS's DOM lib) */
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "papers", label: "Past Papers", icon: FileStack },
  { id: "analytics", label: "Analytics", icon: ChartNoAxesColumn },
];

export default function Sidebar() {
  const {
    view,
    setView,
    state,
    unplaced,
    cloud,
    setWellness,
    mobileNav,
    setMobileNav,
    resetAll,
    pushToast,
    subjects,
    setSubjectsOpen,
    setSettingsOpen,
    routine,
  } = useApp();

  const openTasks = state.tasks.filter((t) => !t.completed).length;

  /* PWA install prompt — surfaced as an "Install app" button */
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const body = (
    <div className="flex h-full flex-col gap-1 p-4">
      {/* Brand */}
      <div className="mb-5 flex items-center gap-3 px-1 pt-1">
        <div className="grad-bg flex h-10 w-10 items-center justify-center rounded-xl shadow-lg shadow-violet-600/30">
          <GraduationCap size={20} color="#fff" />
        </div>
        <div>
          <div className="font-display text-[17px] font-bold leading-tight tracking-tight">
            Solo Task
          </div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            A-Level Planner
          </div>
        </div>
        <button
          className="icon-btn ml-auto lg:!hidden"
          onClick={() => setMobileNav(false)}
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation */}
      {NAV.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`nav-item ${view === id ? "active" : ""}`}
          onClick={() => {
            setView(id);
            setMobileNav(false);
          }}
        >
          <Icon size={17} className="nav-ico" />
          <span>{label}</span>
          {id === "tasks" && openTasks > 0 && (
            <span className="ml-auto rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--muted)]">
              {openTasks}
            </span>
          )}
        </button>
      ))}

      {/* Subject manager shortcut */}
      <button className="nav-item mt-1" onClick={() => { setSubjectsOpen(true); setMobileNav(false); }}>
        <BookMarked size={17} className="nav-ico" />
        <span>Subjects</span>
        <span className="ml-auto rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--muted)]">
          {subjects.length}
        </span>
      </button>

      {/* Daily routine / settings */}
      <button className="nav-item" onClick={() => { setSettingsOpen(true); setMobileNav(false); }}>
        <Clock size={17} className="nav-ico" />
        <span>My day</span>
        <span className="ml-auto font-mono text-[10px] text-[var(--muted)]">
          {routine.wake}–{routine.sleep}
        </span>
      </button>

      {/* Scheduler health warning */}
      {unplaced.length > 0 && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-[12px] leading-snug text-amber-500 dark:text-amber-300">
          <AlertTriangle size={15} className="mt-0.5 flex-none" />
          <span>
            <strong>{unplaced.length}</strong> task{unplaced.length > 1 ? "s" : ""} couldn’t fit
            before deadline. Extend deadlines or lighten your week.
          </span>
        </div>
      )}

      <div className="mt-auto space-y-2 pt-4">
        {/* Wellness toggle */}
        <div className="glass flex items-center gap-3 rounded-xl p-3">
          <BellRing size={16} className="text-[var(--acc2)]" />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold">Wellness nudges</div>
            <div className="text-[10.5px] text-[var(--muted)]">Water · eyes · posture</div>
          </div>
          <button
            className={`switch ${state.prefs.wellness ? "on" : ""}`}
            onClick={() => setWellness(!state.prefs.wellness)}
            aria-label="Toggle wellness reminders"
          />
        </div>

        {/* Install prompt (PWA) */}
        {installEvt && (
          <button
            className="grad-bg flex w-full items-center justify-center gap-2 rounded-xl p-2.5 text-[12.5px] font-bold text-white shadow-lg shadow-violet-600/30 transition-transform hover:scale-[1.02]"
            onClick={() => {
              void installEvt.prompt();
              setInstallEvt(null);
            }}
          >
            <Download size={14} /> Install Solo Task
          </button>
        )}

        {/* Sync status */}
        <div className="glass flex items-center gap-3 rounded-xl p-3 text-[12px] text-[var(--muted)]">
          {cloud === "synced" ? (
            <>
              <Cloud size={15} className="text-emerald-400" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-emerald-400">All changes saved</span> · synced
              </span>
            </>
          ) : cloud === "syncing" ? (
            <>
              <RefreshCw size={15} className="animate-spin text-[var(--acc2)]" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-[var(--acc2)]">Saving…</span> · saved on device
              </span>
            </>
          ) : cloud === "pending" ? (
            <>
              <CloudOff size={15} className="text-amber-400" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-amber-400">Saved offline</span> · syncs when back
                online
              </span>
            </>
          ) : (
            <>
              <CloudOff size={15} />
              <span className="min-w-0 flex-1">Offline — everything saved on this device</span>
            </>
          )}
          <button
            className="ml-auto flex-none text-[var(--faint)] transition-colors hover:text-[var(--danger)]"
            title="Reset demo data"
            onClick={() => {
              resetAll();
              pushToast({ icon: "info", title: "Fresh start", body: "Demo data restored." });
            }}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-[250px] border-r lg:block">
        {body}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNav(false)}
            />
            <motion.aside
              className="glass fixed inset-y-0 left-0 z-50 w-[270px] lg:hidden"
              style={{ background: "var(--surface-modal)" }}
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
            >
              {body}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
