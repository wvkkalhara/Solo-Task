/* ------------------------------------------------------------------ */
/*  Score prompt — appears right after a past-paper task is ticked.    */
/*  Captures the marks while they're fresh so the trend stays honest.  */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";

export default function ScorePrompt() {
  const { pendingScorePaperId, setPendingScorePaperId, state, updatePaper, subject } = useApp();
  const [score, setScore] = useState(70);

  const paper = state.papers.find((p) => p.id === pendingScorePaperId) ?? null;

  useEffect(() => {
    if (paper) setScore(paper.score || 70);
  }, [paper]);

  const close = () => setPendingScorePaperId(null);

  const save = () => {
    if (!paper) return close();
    const { id, ...rest } = paper;
    void id;
    updatePaper(paper.id, { ...rest, status: "completed", score });
    close();
  };

  const tone = score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#fb7185";

  return (
    <AnimatePresence>
      {paper && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="w-full max-w-[400px] overflow-hidden rounded-t-3xl border border-[var(--border-strong)] sm:rounded-3xl"
            style={{ background: "var(--surface-modal)", backdropFilter: "blur(24px)", boxShadow: "var(--shadow-lg)" }}
            initial={{ y: 50, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 50, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pb-5 pt-6 text-center">
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: `${tone}1f`, color: tone }}
              >
                <Trophy size={22} />
              </div>
              <h3 className="font-display text-[18px] font-bold tracking-tight">Paper done — what did you get?</h3>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                {subject(paper.subject).name} · {paper.year}
                {paper.part ? ` Paper ${paper.part}` : ""} · {paper.paperType}
              </p>

              <div className="my-5">
                <div className="font-display text-[44px] font-bold leading-none" style={{ color: tone }}>
                  {score}%
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="field-range mt-4"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="btn btn-ghost flex-1 justify-center" onClick={close}>
                  Later
                </button>
                <button className="btn btn-primary flex-1 justify-center" onClick={save}>
                  Save marks
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
