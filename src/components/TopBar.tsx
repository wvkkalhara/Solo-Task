/* ------------------------------------------------------------------ */
/*  TopBar — page context + global actions (print, theme, add task)    */
/* ------------------------------------------------------------------ */

import { Menu, Moon, Plus, Printer, Sun, Zap } from "lucide-react";
import { useApp } from "../context/AppContext";
import { DAYS_SHORT } from "../lib/utils";

const TITLES: Record<string, string> = {
  dashboard: "Overview",
  calendar: "Weekly schedule",
  tasks: "Task manager",
  papers: "Past paper vault",
  analytics: "Workload analytics",
};

export default function TopBar({
  onAddTask,
  onPrint,
  onInterrupt,
}: {
  onAddTask: () => void;
  onPrint: () => void;
  onInterrupt: () => void;
}) {
  const { view, theme, toggleTheme, setMobileNav } = useApp();
  const now = new Date();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3 sm:px-6">
        <button
          className="icon-btn lg:hidden"
          onClick={() => setMobileNav(true)}
          aria-label="Open menu"
        >
          <Menu size={17} />
        </button>

        <div className="min-w-0">
          <h1 className="truncate font-display text-[15px] font-bold tracking-tight sm:text-[17px]">
            {TITLES[view]}
          </h1>
          <p className="hidden text-[11.5px] font-medium text-[var(--muted)] sm:block">
            {DAYS_SHORT[now.getDay()]}, {now.getDate()}/{now.getMonth() + 1} · planned by your
            auto-scheduler
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="btn btn-ghost !px-3 !border-amber-400/40 !text-amber-400"
            onClick={onInterrupt}
            title="Something came up — block time now and reflow the plan"
          >
            <Zap size={15} />
            <span className="hidden md:inline">Came up</span>
          </button>
          <button
            className="btn btn-ghost !px-3"
            onClick={onPrint}
            title="Open Print Center"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="btn btn-primary" onClick={onAddTask}>
            <Plus size={16} />
            <span className="hidden sm:inline">Add task</span>
          </button>
        </div>
      </div>
    </header>
  );
}
