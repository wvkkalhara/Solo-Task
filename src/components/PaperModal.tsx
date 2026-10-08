/* ------------------------------------------------------------------ */
/*  Log / edit a past paper attempt                                    */
/*  A/L structure: Paper I (usually MCQ) & Paper II (structured/essay) */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import { FilePlus2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import type { PaperPart, PaperStatus, PaperType, PastPaper } from "../lib/types";
import { todayKey } from "../lib/utils";

/* year dropdown: current year back to 2005 */
const YEARS = Array.from({ length: new Date().getFullYear() - 2004 }, (_, i) => new Date().getFullYear() - i);

export default function PaperModal({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: PastPaper | null; // null = create mode
  onClose: () => void;
}) {
  const { addPaper, updatePaper, studySubjects } = useApp();
  const [subject, setSubject] = useState("maths");
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [paperType, setPaperType] = useState<PaperType>("MCQ");
  const [part, setPart] = useState<PaperPart | "full">("I");
  const [status, setStatus] = useState<PaperStatus>("completed");
  const [score, setScore] = useState(70);
  const [date, setDate] = useState(todayKey());

  /* hydrate when opening — edit mirrors the paper, create resets */
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setSubject(initial.subject);
      setYear(initial.year);
      setPaperType(initial.paperType);
      setPart(initial.part ?? "full");
      setStatus(initial.status);
      setScore(initial.score ?? 70);
      setDate(initial.date);
    } else {
      setSubject(studySubjects[0]?.id ?? "maths");
      setYear(new Date().getFullYear() - 1);
      setPaperType("MCQ");
      setPart("I");
      setStatus("completed");
      setScore(70);
      setDate(todayKey());
    }
  }, [open, initial, studySubjects]);

  /* picking a type suggests the realistic A/L part */
  const onTypeChange = (t: PaperType) => {
    setPaperType(t);
    setPart(t === "MCQ" ? "I" : "II");
  };

  const save = () => {
    const data = {
      subject,
      year,
      paperType,
      part: part === "full" ? undefined : part,
      status,
      score: status === "completed" ? Math.max(0, Math.min(100, Math.round(score))) : undefined,
      date,
    };
    if (initial) updatePaper(initial.id, data);
    else addPaper(data);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl border border-[var(--border-strong)] sm:rounded-3xl"
            style={{ background: "var(--surface-modal)", backdropFilter: "blur(24px)", boxShadow: "var(--shadow-lg)" }}
            initial={{ y: 60, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 60, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h3 className="font-display text-[17px] font-bold tracking-tight">
                  {initial ? "Edit past paper" : "Log past paper"}
                </h3>
                <p className="text-[11.5px] text-[var(--muted)]">
                  {initial ? "Change the year, part, marks — anything." : "Every attempt builds the vault."}
                </p>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              {/* subject */}
              <div>
                <label className="field-label">Subject</label>
                <div className="flex flex-wrap gap-2">
                  {studySubjects.map((s) => (
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
                      {s.short}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* year */}
                <div>
                  <label className="field-label">Paper year</label>
                  <select className="field font-mono" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                {/* date attempted */}
                <div>
                  <label className="field-label">{status === "completed" ? "Attempted on" : "Plan for"}</label>
                  <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              {/* part */}
              <div>
                <label className="field-label">Paper part</label>
                <div className="segmented">
                  {(["I", "II", "full"] as const).map((p) => (
                    <button key={p} className={part === p ? "active" : ""} onClick={() => setPart(p)}>
                      {p === "full" ? "Full paper" : `Paper ${p}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* type */}
              <div>
                <label className="field-label">Paper type</label>
                <div className="segmented">
                  {(["MCQ", "Structured", "Essay"] as PaperType[]).map((t) => (
                    <button key={t} className={paperType === t ? "active" : ""} onClick={() => onTypeChange(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* status */}
              <div>
                <label className="field-label">Status</label>
                <div className="segmented">
                  <button className={status === "completed" ? "active" : ""} onClick={() => setStatus("completed")}>
                    Completed
                  </button>
                  <button className={status === "planned" ? "active" : ""} onClick={() => setStatus("planned")}>
                    Planned
                  </button>
                </div>
              </div>

              {/* marks */}
              {status === "completed" && (
                <div>
                  <label className="field-label">Marks (percentage)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={score}
                      onChange={(e) => setScore(Number(e.target.value))}
                      className="field-range flex-1"
                    />
                    <div className="relative w-[76px] flex-none">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="field pr-6 text-center font-mono"
                        value={score}
                        onChange={(e) => setScore(Number(e.target.value))}
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--muted)]">
                        %
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                <FilePlus2 size={15} /> {initial ? "Save changes" : "Log paper"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
