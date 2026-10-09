/* ------------------------------------------------------------------ */
/*  "Something came up" — quick capture for unplanned, must-do time.   */
/*  Blocks real hours today and reflows every flexible block around it */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import { Zap, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { fmtTime, pad } from "../lib/utils";
import { MicButton } from "./ui";

const PRESETS = [15, 30, 45, 60, 90, 120, 180];
const QUICK_LABELS = ["Visitor came", "Family work", "Extra class", "Errand", "Not feeling well", "Power cut"];

export default function InterruptModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addInterruption, pushToast } = useApp();
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [startNow, setStartNow] = useState(true);
  const [startTime, setStartTime] = useState("");

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    if (!open) return;
    setName("");
    setMinutes(60);
    setStartNow(true);
    setStartTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startMin = startNow
    ? nowMin
    : Number(startTime.split(":")[0]) * 60 + Number(startTime.split(":")[1] || 0);

  const save = () => {
    addInterruption(name, minutes, startMin);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="flex max-h-[92vh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-3xl border border-[var(--border-strong)] sm:rounded-3xl"
            style={{ background: "var(--surface-modal)", backdropFilter: "blur(24px)", boxShadow: "var(--shadow-lg)" }}
            initial={{ y: 60, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 60, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
                  <Zap size={16} />
                </span>
                <div>
                  <h3 className="font-display text-[17px] font-bold tracking-tight">Something came up</h3>
                  <p className="text-[11.5px] text-[var(--muted)]">
                    Your study plan reflows around it instantly.
                  </p>
                </div>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              {/* what */}
              <div>
                <label className="field-label">What is it?</label>
                <div className="flex items-center gap-2">
                  <input
                    className="field"
                    placeholder="e.g. relatives visiting"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                  <MicButton
                    onText={setName}
                    onUnsupported={() =>
                      pushToast({ icon: "info", title: "Voice typing unavailable" })
                    }
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_LABELS.map((q) => (
                    <button
                      key={q}
                      className="chip cursor-pointer !py-1 !text-[10.5px] hover:border-[var(--border-strong)]"
                      onClick={() => setName(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* how long */}
              <div>
                <label className="field-label">
                  How long? · <span className="text-amber-400">{minutes} min</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMinutes(m)}
                      className={`chip cursor-pointer !px-3 !py-1.5 font-mono transition-all ${
                        minutes === m ? "!border-transparent !bg-amber-400 !text-black" : ""
                      }`}
                    >
                      {m < 60 ? `${m}m` : `${m / 60}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* when */}
              <div>
                <label className="field-label">Starting</label>
                <div className="segmented">
                  <button className={startNow ? "active" : ""} onClick={() => setStartNow(true)}>
                    Right now
                  </button>
                  <button className={!startNow ? "active" : ""} onClick={() => setStartNow(false)}>
                    Later today
                  </button>
                </div>
                {!startNow && (
                  <input
                    type="time"
                    className="field mt-2"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                )}
                <p className="mt-2 text-[11.5px] text-[var(--muted)]">
                  Blocks {fmtTime(startMin)} – {fmtTime(Math.min(1439, startMin + minutes))}. Study
                  that no longer fits is pushed to your next free time automatically.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn !text-black"
                style={{ background: "linear-gradient(120deg,#fbbf24,#f59e0b)" }}
                onClick={save}
              >
                <Zap size={15} /> Block the time
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
