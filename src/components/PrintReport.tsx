/* ------------------------------------------------------------------ */
/*  Print report renderer                                              */
/*  Hidden on screen; @media print makes this the only visible area.   */
/* ------------------------------------------------------------------ */

import { useApp } from "../context/AppContext";
import type { PrintConfig } from "../lib/print";
import type { PastPaper, Session, Task } from "../lib/types";
import {
  addDays,
  dateKey,
  DAYS_FULL,
  fmtDateShort,
  fmtDuration,
  fmtTime,
} from "../lib/utils";

const REPORT_LABEL: Record<PrintConfig["type"], string> = {
  today: "Daily Study Plan",
  week: "Weekly Study Schedule",
  month: "4-Week Study Plan",
  tasks: "Task & Deadline Checklist",
  papers: "Past Paper Progress Tracker",
  full: "Complete Study Pack",
};

export default function PrintReport({ config }: { config: PrintConfig }) {
  const { sessions, weekStart, state, subject } = useApp();
  const today = new Date();

  const scheduleDays =
    config.type === "today"
      ? [today]
      : config.type === "week"
        ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
        : Array.from({ length: 28 }, (_, i) => addDays(weekStart, i));

  const showSchedule = ["today", "week", "month", "full"].includes(config.type);
  const showTasks = ["tasks", "full"].includes(config.type);
  const showPapers = ["papers", "full"].includes(config.type);

  const range = formatRange(scheduleDays);
  const visibleSessions = sessions.filter((s) => {
    if (!scheduleDays.some((d) => dateKey(d) === s.date)) return false;
    if (!config.includeMeals && s.kind === "meal") return false;
    if (!config.includeCompleted && s.done) return false;
    return true;
  });

  const totalMins = visibleSessions
    .filter((s) => s.kind !== "meal" && s.subject !== "school")
    .reduce((a, s) => a + (s.end - s.start), 0);

  const reportTasks = [...state.tasks]
    .filter((t) => config.includeCompleted || !t.completed)
    .sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      if (a.frequency !== "once" && b.frequency === "once") return 1;
      if (a.frequency === "once" && b.frequency !== "once") return -1;
      return a.deadline.localeCompare(b.deadline);
    });

  return (
    <div id="print-report" className={config.compact ? "print-compact" : ""}>
      <ReportHeader
        title={REPORT_LABEL[config.type]}
        subtitle={showSchedule ? range : "Generated from your live Solo Task data"}
        meta={showSchedule ? `${fmtDuration(totalMins)} planned study` : undefined}
      />

      {showSchedule && (
        <ScheduleSection
          days={scheduleDays}
          sessions={visibleSessions}
          allTasks={state.tasks}
          includeNotes={config.includeNotes}
          subjectName={(id) => subject(id).name}
        />
      )}

      {showTasks && (
        <div className={config.type === "full" ? "print-page-break" : ""}>
          <TaskSection
            tasks={reportTasks}
            includeNotes={config.includeNotes}
            subjectName={(id) => subject(id).name}
          />
        </div>
      )}

      {showPapers && (
        <div className={config.type === "full" ? "print-page-break" : ""}>
          <PaperSection papers={state.papers} subjectName={(id) => subject(id).name} />
        </div>
      )}

      <ReportFooter />
    </div>
  );
}

function ReportHeader({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle: string;
  meta?: string;
}) {
  return (
    <div className="print-header">
      <div>
        <div className="print-title">Solo Task · {title}</div>
        <div className="print-subtitle">{subtitle}</div>
      </div>
      <div className="print-meta">
        {meta && <div><strong>{meta}</strong></div>}
        <div>Generated {new Date().toLocaleDateString()}</div>
      </div>
    </div>
  );
}

function ScheduleSection({
  days,
  sessions,
  allTasks,
  includeNotes,
  subjectName,
}: {
  days: Date[];
  sessions: Session[];
  allTasks: Task[];
  includeNotes: boolean;
  subjectName: (id: string) => string;
}) {
  const firstKey = dateKey(days[0]);
  const lastKey = dateKey(days[days.length - 1]);
  const deadlines = allTasks.filter(
    (t) => t.frequency === "once" && !t.completed && t.deadline >= firstKey && t.deadline <= lastKey
  );

  return (
    <section>
      {days.map((d) => {
        const key = dateKey(d);
        const daySessions = sessions.filter((s) => s.date === key);
        const studyBlocks = daySessions.filter((s) => s.kind !== "meal").length;
        return (
          <div key={key} className="print-day">
            <div className="print-day-head">
              <span>{DAYS_FULL[d.getDay()]} · {d.getDate()}/{d.getMonth() + 1}/{d.getFullYear()}</span>
              <span>{studyBlocks} study block{studyBlocks === 1 ? "" : "s"}</span>
            </div>

            {daySessions.length === 0 ? (
              <div className="print-empty">No work scheduled — rest, buffer or catch-up.</div>
            ) : (
              <table className="print-table schedule-table">
                <tbody>
                  {daySessions.map((s) => {
                    const isMeal = s.kind === "meal";
                    const sourceTask = allTasks.find((t) => t.id === s.taskId);
                    return (
                      <tr key={s.id} className={isMeal ? "print-meal" : ""}>
                        <td className="print-check-cell">
                          {!isMeal && <PrintCheckbox checked={s.done} />}
                        </td>
                        <td className="print-time">{fmtTime(s.start)} – {fmtTime(s.end)}</td>
                        <td>
                          <div className="print-row-title">
                            {s.taskName}
                            {s.auto && <span className="print-muted"> (auto-planned)</span>}
                            {isMeal && <span className="print-muted"> (protected break)</span>}
                          </div>
                          {includeNotes && sourceTask?.notes && (
                            <div className="print-note">{sourceTask.notes}</div>
                          )}
                        </td>
                        <td className="print-subject">{isMeal ? "Break" : subjectName(s.subject)}</td>
                        <td className="print-duration">{fmtDuration(s.end - s.start)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {deadlines.length > 0 && (
        <div className="print-section-block">
          <h2 className="print-section-title">Deadlines in this period</h2>
          {deadlines.map((t) => (
            <div key={t.id} className="print-list-row">
              <PrintCheckbox checked={false} />
              <strong>{t.name}</strong>
              <span className="print-muted">
                due {fmtDateShort(t.deadline)} · {subjectName(t.subject)} · {fmtDuration(t.estimatedMinutes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TaskSection({
  tasks,
  includeNotes,
  subjectName,
}: {
  tasks: Task[];
  includeNotes: boolean;
  subjectName: (id: string) => string;
}) {
  const open = tasks.filter((t) => !t.completed).length;
  const totalMins = tasks.filter((t) => !t.completed).reduce((a, t) => a + t.estimatedMinutes, 0);

  return (
    <section className="print-section-block">
      <div className="print-section-heading">
        <h2 className="print-section-title">Task & Deadline Checklist</h2>
        <span>{open} open · {fmtDuration(totalMins)} estimated</span>
      </div>

      {tasks.length === 0 ? (
        <div className="print-empty">No matching tasks.</div>
      ) : (
        <table className="print-table task-table">
          <thead>
            <tr><th /><th>Task</th><th>Subject</th><th>Due / repeats</th><th>Time</th></tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className={t.completed ? "print-complete" : ""}>
                <td className="print-check-cell"><PrintCheckbox checked={t.completed} /></td>
                <td>
                  <div className="print-row-title">{t.name}</div>
                  {includeNotes && t.notes && <div className="print-note">{t.notes}</div>}
                  {t.paperMeta && (
                    <div className="print-note">
                      Linked paper: {t.paperMeta.year}{t.paperMeta.part ? ` Paper ${t.paperMeta.part}` : ""} · {t.paperMeta.paperType}
                    </div>
                  )}
                </td>
                <td>{subjectName(t.subject)}</td>
                <td>
                  {t.frequency === "once"
                    ? fmtDateShort(t.deadline)
                    : t.frequency === "daily"
                      ? "Daily"
                      : "Weekly"}
                </td>
                <td className="print-duration">{fmtDuration(t.estimatedMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PaperSection({
  papers,
  subjectName,
}: {
  papers: PastPaper[];
  subjectName: (id: string) => string;
}) {
  const sorted = [...papers].sort(
    (a, b) => subjectName(a.subject).localeCompare(subjectName(b.subject)) || b.year - a.year
  );
  const done = papers.filter((p) => p.status === "completed");
  const avg = done.length
    ? Math.round(done.reduce((a, p) => a + (p.score ?? 0), 0) / done.length)
    : 0;

  return (
    <section className="print-section-block">
      <div className="print-section-heading">
        <h2 className="print-section-title">Past Paper Progress Tracker</h2>
        <span>{done.length}/{papers.length} complete · {avg}% average</span>
      </div>

      {sorted.length === 0 ? (
        <div className="print-empty">No past papers logged.</div>
      ) : (
        <table className="print-table paper-table">
          <thead>
            <tr><th /><th>Subject</th><th>Year</th><th>Part</th><th>Type</th><th>Date</th><th>Marks</th></tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id}>
                <td className="print-check-cell"><PrintCheckbox checked={p.status === "completed"} /></td>
                <td><strong>{subjectName(p.subject)}</strong></td>
                <td>{p.year}</td>
                <td>{p.part ? `Paper ${p.part}` : "Full"}</td>
                <td>{p.paperType}</td>
                <td>{fmtDateShort(p.date)}</td>
                <td className="print-score">{p.score == null ? "—" : `${p.score}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PrintCheckbox({ checked }: { checked: boolean }) {
  return <span className={`print-checkbox ${checked ? "checked" : ""}`} />;
}

function ReportFooter() {
  return (
    <div className="print-footer">
      <span>Plan realistically. Protect sleep. Tick every finished block.</span>
      <span>Printed from Solo Task</span>
    </div>
  );
}

function formatRange(days: Date[]): string {
  if (days.length === 1) {
    const d = days[0];
    return `${DAYS_FULL[d.getDay()]}, ${d.getDate()} ${d.toLocaleString("en", { month: "long" })} ${d.getFullYear()}`;
  }
  const first = days[0];
  const last = days[days.length - 1];
  return `${first.getDate()} ${first.toLocaleString("en", { month: "long" })} ${first.getFullYear()} — ${last.getDate()} ${last.toLocaleString("en", { month: "long" })} ${last.getFullYear()}`;
}