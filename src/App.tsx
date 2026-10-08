/* ------------------------------------------------------------------ */
/*  Solo Task — Ultimate A-Level Study Planner                         */
/*  App shell: sidebar + topbar + routed views + modals + toasts       */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import AnalyticsView from "./components/AnalyticsView";
import CalendarView from "./components/CalendarView";
import Dashboard from "./components/Dashboard";
import PaperModal from "./components/PaperModal";
import PastPapersView from "./components/PastPapersView";
import PrintReport from "./components/PrintReport";
import ScorePrompt from "./components/ScorePrompt";
import Sidebar from "./components/Sidebar";
import SubjectManager from "./components/SubjectManager";
import TaskModal from "./components/TaskModal";
import TasksView from "./components/TasksView";
import Toasts from "./components/Toasts";
import TopBar from "./components/TopBar";
import { AppProvider, useApp } from "./context/AppContext";
import type { PastPaper, Task } from "./lib/types";

function Shell() {
  const { view } = useApp();
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: Task | null }>({
    open: false,
    task: null,
  });
  const [paperModal, setPaperModal] = useState<{ open: boolean; paper: PastPaper | null }>({
    open: false,
    paper: null,
  });

  return (
    <>
      {/* ambient aurora background */}
      <div className="ambient">
        <div className="grid-dots" />
        <div className="blob-c" />
      </div>

      {/* app (hidden while printing) */}
      <div className="app-shell print:hidden">
        <Sidebar />
        <div className="lg:pl-[250px]">
          <TopBar onAddTask={() => setTaskModal({ open: true, task: null })} />
          <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {view === "dashboard" && <Dashboard />}
                {view === "calendar" && <CalendarView />}
                {view === "tasks" && (
                  <TasksView onEdit={(t) => setTaskModal({ open: true, task: t })} />
                )}
                {view === "papers" && (
                  <PastPapersView
                    onAdd={() => setPaperModal({ open: true, paper: null })}
                    onEdit={(p) => setPaperModal({ open: true, paper: p })}
                  />
                )}
                {view === "analytics" && <AnalyticsView />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* overlays */}
      <TaskModal
        open={taskModal.open}
        initial={taskModal.task}
        onClose={() => setTaskModal((m) => ({ ...m, open: false }))}
      />
      <PaperModal
        open={paperModal.open}
        initial={paperModal.paper}
        onClose={() => setPaperModal((m) => ({ ...m, open: false }))}
      />
      <SubjectManager />
      <ScorePrompt />
      <Toasts />

      {/* print-only weekly report */}
      <PrintReport />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
