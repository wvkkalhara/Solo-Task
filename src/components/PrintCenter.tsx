/* ------------------------------------------------------------------ */
/*  Print Center — choose the report and exactly what it contains.     */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CalendarRange,
  CheckSquare2,
  ClipboardList,
  FileStack,
  Layers3,
  Printer,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  DEFAULT_PRINT_CONFIG,
  type PrintConfig,
  type PrintReportType,
} from "../lib/print";

const REPORTS: Array<{
  id: PrintReportType;
  title: string;
  body: string;
  icon: typeof CalendarDays;
}> = [
  { id: "today", title: "Today", body: "One-day schedule with checkboxes", icon: CalendarDays },
  { id: "week", title: "Selected week", body: "Seven-day wall timetable", icon: CalendarRange },
  { id: "month", title: "4-week plan", body: "Long-range monthly study plan", icon: Layers3 },
  { id: "tasks", title: "Task checklist", body: "Deadlines, notes and estimated time", icon: ClipboardList },
  { id: "papers", title: "Paper tracker", body: "Years, parts, marks and status", icon: FileStack },
  { id: "full", title: "Full study pack", body: "4-week plan + tasks + paper tracker", icon: CheckSquare2 },
];

export default function PrintCenter({
  open,
  initial,
  onClose,
  onPrint,
}: {
  open: boolean;
  initial: PrintConfig;
  onClose: () => void;
  onPrint: (config: PrintConfig) => void;
}) {
  const [config, setConfig] = useState<PrintConfig>(initial);

  useEffect(() => {
    if (open) setConfig(initial ?? DEFAULT_PRINT_CONFIG);
  }, [open, initial]);

  const toggle = (key: keyof Pick<PrintConfig, "includeCompleted" | "includeMeals" | "includeNotes" | "compact">) =>
    setConfig((c) => ({ ...c, [key]: !c[key] }));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="print-ui fixed inset-0 z-[75] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[94vh] w-full max-w-[620px] flex-col overflow-hidden rounded-t-3xl border border-[var(--border-strong)] sm:rounded-3xl"
            style={{
              background: "var(--surface-modal)",
              backdropFilter: "blur(24px)",
              boxShadow: "var(--shadow-lg)",
            }}
            initial={{ y: 60, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 60, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <span className="grad-bg flex h-9 w-9 items-center justify-center rounded-xl text-white">
                  <Printer size={16} />
                </span>
                <div>
                  <h3 className="font-display text-[17px] font-bold tracking-tight">Print Center</h3>
                  <p className="text-[11.5px] text-[var(--muted)]">Choose a report for your desk, file or wall.</p>
                </div>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close print center">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <div>
                <label className="field-label">Report</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {REPORTS.map(({ id, title, body, icon: Icon }) => {
                    const active = config.type === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setConfig((c) => ({ ...c, type: id }))}
                        className={`min-h-[104px] rounded-xl border p-3 text-left transition-all ${
                          active
                            ? "border-violet-400/60 bg-violet-500/12 shadow-lg shadow-violet-600/10"
                            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        <Icon size={17} className={active ? "text-violet-400" : "text-[var(--muted)]"} />
                        <span className="mt-2 block text-[12.5px] font-bold">{title}</span>
                        <span className="mt-0.5 block text-[10.5px] leading-snug text-[var(--muted)]">{body}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="field-label">Content options</label>
                <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5">
                  <PrintToggle
                    label="Include completed work"
                    body="Print finished tasks and completed calendar blocks"
                    on={config.includeCompleted}
                    onClick={() => toggle("includeCompleted")}
                  />
                  <PrintToggle
                    label="Include meals & protected breaks"
                    body="Show breakfast, lunch, dinner and your custom breaks"
                    on={config.includeMeals}
                    onClick={() => toggle("includeMeals")}
                  />
                  <PrintToggle
                    label="Include task notes"
                    body="Print chapters, exercises and instructions below tasks"
                    on={config.includeNotes}
                    onClick={() => toggle("includeNotes")}
                  />
                  <PrintToggle
                    label="Compact layout"
                    body="Fit more rows per page with tighter spacing"
                    on={config.compact}
                    onClick={() => toggle("compact")}
                  />
                </div>
              </div>

              <p className="text-[11.5px] leading-snug text-[var(--muted)]">
                The selected calendar week is used for Week and 4-week reports. In the browser dialog,
                choose “Save as PDF” for a digital copy.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4 sm:px-6">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={() => onPrint(config)}>
                <Printer size={15} /> Generate report
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PrintToggle({
  label,
  body,
  on,
  onClick,
}: {
  label: string;
  body: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button className="flex w-full items-center gap-3 py-3 text-left" onClick={onClick}>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold">{label}</span>
        <span className="block text-[10.5px] leading-snug text-[var(--muted)]">{body}</span>
      </span>
      <span className={`switch ${on ? "on" : ""}`} />
    </button>
  );
}