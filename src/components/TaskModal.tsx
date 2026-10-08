/* ------------------------------------------------------------------ */
/*  Add / Edit task modal                                              */
/*  • voice typing on text fields (Web Speech API)                     */
/*  • flexible tasks are auto-scheduled; fixed tasks lock a time slot  */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, FileStack, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { detectPaper, paperLabel } from "../lib/insights";
import type { Frequency, Task, TaskInput, TaskKind } from "../lib/types";
import { addDays, dateKey, DAY_PICKER } from "../lib/utils";
import { MicButton } from "./ui";

const TIME_PRESETS = [15, 30, 45, 60, 90, 120, 180];

export default function TaskModal({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: Task | null; // null = create mode
  onClose: () => void;
}) {
  const { addTask, updateTask, pushToast, subjects } = useApp();

  /* form state */
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [subject, setSubject] = useState("maths");
  const [minutes, setMinutes] = useState(60);
  const [deadline, setDeadline] = useState(dateKey(addDays(new Date(), 3)));
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [weeklyDays, setWeeklyDays] = useState<number[]>([6]);
  const [kind, setKind] = useState<TaskKind>("flexible");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:00");
  const [error, setError] = useState("");
  /** user's choice to mirror this task into the Past Paper vault */
  const [asPaper, setAsPaper] = useState(false);
  const [paperTouched, setPaperTouched] = useState(false);

  /* live detection: "Physics 2022 Paper I MCQ" → paper metadata */
  const detected = useMemo(() => detectPaper(`${name} ${notes}`), [name, notes]);

  /* auto-tick the vault option the first time we spot a paper */
  useEffect(() => {
    if (!paperTouched) setAsPaper(!!detected);
  }, [detected, paperTouched]);

  /* hydrate when opening (edit vs create) */
  useEffect(() => {
    if (!open) return;
    setError("");
    setPaperTouched(!!initial); // keep the saved choice when editing
    setAsPaper(!!initial?.paperMeta);
    if (initial) {
      setName(initial.name);
      setNotes(initial.notes ?? "");
      setSubject(initial.subject);
      setMinutes(initial.estimatedMinutes);
      setDeadline(initial.deadline);
      setFrequency(initial.frequency);
      setWeeklyDays(initial.weeklyDays.length ? initial.weeklyDays : [6]);
      setKind(initial.kind);
      setStartTime(initial.startTime ?? "17:00");
      setEndTime(initial.endTime ?? "18:00");
    } else {
      setName("");
      setNotes("");
      setSubject("maths");
      setMinutes(60);
      setDeadline(dateKey(addDays(new Date(), 3)));
      setFrequency("once");
      setWeeklyDays([6]);
      setKind("flexible");
      setStartTime("17:00");
      setEndTime("18:00");
    }
  }, [open, initial]);

  const unsupportedVoice = () =>
    pushToast({ icon: "info", title: "Voice typing unavailable", body: "Your browser doesn’t support the Web Speech API." });

  const save = () => {
    if (!name.trim()) return setError("Give the task a name first.");
    if (frequency === "weekly" && weeklyDays.length === 0)
      return setError("Pick at least one day for a weekly task.");
    if (kind === "fixed" && endTime <= startTime)
      return setError("End time must be after start time.");

    const input: TaskInput = {
      name: name.trim(),
      notes: notes.trim() || undefined,
      subject,
      estimatedMinutes: minutes,
      deadline,
      frequency,
      weeklyDays: frequency === "weekly" ? weeklyDays : [],
      kind,
      startTime: kind === "fixed" ? startTime : undefined,
      endTime: kind === "fixed" ? endTime : undefined,
      paperMeta: asPaper && detected ? detected : undefined,
    };
    if (initial) updateTask(initial.id, input);
    else addTask(input);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-3xl border border-[var(--border-strong)] sm:rounded-3xl"
            style={{ background: "var(--surface-modal)", backdropFilter: "blur(24px)", boxShadow: "var(--shadow-lg)" }}
            initial={{ y: 60, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 60, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h3 className="font-display text-[17px] font-bold tracking-tight">
                  {initial ? "Edit task" : "New task"}
                </h3>
                <p className="text-[11.5px] text-[var(--muted)]">
                  {kind === "flexible"
                    ? "The scheduler will find free time for it."
                    : "Locked to an exact time slot."}
                </p>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {/* body */}
            <div className="space-y-5 overflow-y-auto px-6 py-5">
              {/* name + voice */}
              <div>
                <label className="field-label">Task name</label>
                <div className="flex items-center gap-2">
                  <input
                    className="field"
                    placeholder='e.g. "Physics 2021 MCQ paper — timed"'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                  <MicButton onText={setName} onUnsupported={unsupportedVoice} />
                </div>
              </div>

              {/* notes + voice */}
              <div>
                <label className="field-label">Notes <span className="normal-case opacity-60">(optional)</span></label>
                <div className="flex items-center gap-2">
                  <input
                    className="field"
                    placeholder="chapter, exercise numbers, marking scheme…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <MicButton onText={setNotes} onUnsupported={unsupportedVoice} />
                </div>
              </div>

              {/* smart past-paper detection */}
              <AnimatePresence>
                {detected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPaperTouched(true);
                        setAsPaper((v) => !v);
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                        asPaper
                          ? "border-emerald-400/50 bg-emerald-500/10"
                          : "border-[var(--border)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <FileStack
                        size={17}
                        className={`mt-0.5 flex-none ${asPaper ? "text-emerald-400" : "text-[var(--muted)]"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold">
                          This looks like a past paper
                        </span>
                        <span className="block text-[11.5px] leading-snug text-[var(--muted)]">
                          {paperLabel(detected)} — {asPaper ? "will be added to" : "tap to add to"} your
                          Past Paper vault. Marks are requested when you finish it.
                        </span>
                      </span>
                      <span className={`switch mt-0.5 ${asPaper ? "on" : ""}`} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* subject */}
              <div>
                <label className="field-label">Subject</label>
                <div className="flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSubject(s.id)}
                      className={`chip cursor-pointer !py-1.5 transition-all ${
                        subject === s.id ? "!text-white" : "hover:border-[var(--border-strong)]"
                      }`}
                      style={
                        subject === s.id
                          ? { background: s.color, borderColor: "transparent", boxShadow: `0 4px 14px ${s.color}55` }
                          : undefined
                      }
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: subject === s.id ? "#fff" : s.color }} />
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* estimated time */}
              <div>
                <label className="field-label">
                  Estimated time · <span className="text-[var(--acc2)]">{minutes} min</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {TIME_PRESETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMinutes(m)}
                      className={`chip cursor-pointer !px-3 !py-1.5 font-mono transition-all ${
                        minutes === m ? "!border-transparent !text-white grad-bg" : "hover:border-[var(--border-strong)]"
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                  <input
                    type="range"
                    min={10}
                    max={240}
                    step={5}
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="field-range mt-1"
                  />
                </div>
              </div>

              {/* frequency */}
              <div>
                <label className="field-label">Frequency</label>
                <div className="segmented">
                  {(["once", "daily", "weekly"] as Frequency[]).map((f) => (
                    <button key={f} className={frequency === f ? "active" : ""} onClick={() => setFrequency(f)}>
                      {f === "once" ? "One-off" : f === "daily" ? "Daily" : "Weekly"}
                    </button>
                  ))}
                </div>
              </div>

              {/* weekly day picker */}
              {frequency === "weekly" && (
                <div>
                  <label className="field-label">On which days?</label>
                  <div className="flex gap-2">
                    {DAY_PICKER.map(({ d, label }) => (
                      <button
                        key={d}
                        className={`day-chip ${weeklyDays.includes(d) ? "on" : ""}`}
                        onClick={() =>
                          setWeeklyDays((ds) =>
                            ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]
                          )
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* deadline for one-offs */}
              {frequency === "once" && (
                <div>
                  <label className="field-label">{kind === "fixed" ? "Date" : "Deadline"}</label>
                  <input
                    type="date"
                    className="field"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              )}

              {/* scheduling mode */}
              <div>
                <label className="field-label">Scheduling</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setKind("flexible")}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      kind === "flexible"
                        ? "border-violet-400/60 bg-violet-500/10"
                        : "border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <Sparkles size={16} className="mt-0.5 flex-none text-violet-400" />
                    <span>
                      <span className="block text-[13px] font-bold">Auto-schedule</span>
                      <span className="block text-[11px] leading-snug text-[var(--muted)]">
                        Finds free blocks around your classes
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => setKind("fixed")}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      kind === "fixed"
                        ? "border-cyan-400/60 bg-cyan-500/10"
                        : "border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <CalendarClock size={16} className="mt-0.5 flex-none text-cyan-400" />
                    <span>
                      <span className="block text-[13px] font-bold">Fixed time</span>
                      <span className="block text-[11px] leading-snug text-[var(--muted)]">
                        Classes, tuition, exams — exact slot
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              {/* fixed time inputs */}
              {kind === "fixed" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Starts</label>
                    <input type="time" className="field" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Ends</label>
                    <input type="time" className="field" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-400">
                  {error}
                </p>
              )}
            </div>

            {/* footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                <Sparkles size={15} />
                {initial ? "Save changes" : "Add & schedule"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
