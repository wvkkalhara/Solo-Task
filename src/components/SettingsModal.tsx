/* ------------------------------------------------------------------ */
/*  Settings — the shape of your day.                                  */
/*  Wake/sleep bounds, protected meal breaks and focus-block length    */
/*  feed straight into the auto-scheduler.                             */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import { Clock, Moon, Plus, Sunrise, Trash2, Utensils, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { MealSlot } from "../lib/types";
import { fmtDuration, toMin, uid } from "../lib/utils";

const FOCUS_OPTIONS = [25, 45, 60, 90, 120];
const BREAK_OPTIONS = [5, 10, 15, 20];

export default function SettingsModal() {
  const { settingsOpen, setSettingsOpen, routine, updateRoutine } = useApp();

  const setMeal = (id: string, patch: Partial<MealSlot>) =>
    updateRoutine({ meals: routine.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)) });

  const addMeal = () =>
    updateRoutine({
      meals: [
        ...routine.meals,
        { id: uid(), label: "New break", start: "17:00", minutes: 30, enabled: true },
      ],
    });

  const removeMeal = (id: string) =>
    updateRoutine({ meals: routine.meals.filter((m) => m.id !== id) });

  /* how much study time the day actually offers */
  const awake = Math.max(0, toMin(routine.sleep) - toMin(routine.wake));
  const mealMins = routine.meals.filter((m) => m.enabled).reduce((a, m) => a + m.minutes, 0);
  const usable = Math.max(0, awake - mealMins);

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          className="fixed inset-0 z-[65] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSettingsOpen(false)}
        >
          <motion.div
            className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-3xl border border-[var(--border-strong)] sm:rounded-3xl"
            style={{ background: "var(--surface-modal)", backdropFilter: "blur(24px)", boxShadow: "var(--shadow-lg)" }}
            initial={{ y: 60, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 60, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <Clock size={17} className="text-[var(--acc2)]" />
                <div>
                  <h3 className="font-display text-[17px] font-bold tracking-tight">Your day</h3>
                  <p className="text-[11.5px] text-[var(--muted)]">
                    {fmtDuration(usable)} of usable study time per day
                  </p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto px-6 py-5">
              {/* wake / sleep */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    <Sunrise size={12} /> Wake up
                  </label>
                  <input
                    type="time"
                    className="field"
                    value={routine.wake}
                    onChange={(e) => updateRoutine({ wake: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    <Moon size={12} /> Sleep
                  </label>
                  <input
                    type="time"
                    className="field"
                    value={routine.sleep}
                    onChange={(e) => updateRoutine({ sleep: e.target.value })}
                  />
                </div>
              </div>
              <p className="-mt-3 text-[11.5px] leading-snug text-[var(--muted)]">
                Nothing is ever scheduled outside these hours — your sleep is protected.
              </p>

              {/* meals */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <label className="field-label !mb-0 flex items-center gap-1.5">
                    <Utensils size={12} /> Meals & daily breaks
                  </label>
                  <button className="btn btn-ghost !px-2.5 !py-1 !text-[11px]" onClick={addMeal}>
                    <Plus size={12} /> Add
                  </button>
                </div>

                <div className="space-y-2">
                  {routine.meals.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 transition-opacity ${
                        m.enabled ? "" : "opacity-50"
                      }`}
                    >
                      <button
                        className={`switch flex-none ${m.enabled ? "on" : ""}`}
                        onClick={() => setMeal(m.id, { enabled: !m.enabled })}
                        aria-label={`Toggle ${m.label}`}
                      />
                      <input
                        className="field !w-[108px] flex-1 !py-1.5 !text-[12.5px]"
                        value={m.label}
                        onChange={(e) => setMeal(m.id, { label: e.target.value })}
                        placeholder="Label"
                      />
                      <input
                        type="time"
                        className="field !w-[108px] flex-none !py-1.5 !text-[12.5px]"
                        value={m.start}
                        onChange={(e) => setMeal(m.id, { start: e.target.value })}
                      />
                      <div className="relative w-[72px] flex-none">
                        <input
                          type="number"
                          min={5}
                          max={180}
                          step={5}
                          className="field !py-1.5 pr-7 text-center !text-[12.5px]"
                          value={m.minutes}
                          onChange={(e) =>
                            setMeal(m.id, { minutes: Math.max(5, Number(e.target.value) || 5) })
                          }
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] text-[var(--muted)]">
                          m
                        </span>
                      </div>
                      <button
                        className="icon-btn btn-danger !h-8 !w-8 flex-none"
                        onClick={() => removeMeal(m.id)}
                        aria-label={`Remove ${m.label}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {routine.meals.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[var(--border-strong)] p-4 text-center text-[12px] text-[var(--muted)]">
                      No breaks yet — add breakfast, lunch and dinner so study never eats your meals.
                    </p>
                  )}
                </div>
              </div>

              {/* focus block */}
              <div>
                <label className="field-label">
                  Focus block · <span className="text-[var(--acc2)]">{routine.focusBlock} min</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() => updateRoutine({ focusBlock: f })}
                      className={`chip cursor-pointer !px-3 !py-1.5 font-mono transition-all ${
                        routine.focusBlock === f ? "grad-bg !border-transparent !text-white" : ""
                      }`}
                    >
                      {f}m
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] leading-snug text-[var(--muted)]">
                  Long tasks are split into chunks of this length so you never sit for hours straight.
                </p>
              </div>

              {/* break length */}
              <div>
                <label className="field-label">
                  Break between blocks ·{" "}
                  <span className="text-[var(--acc2)]">{routine.breakMinutes} min</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {BREAK_OPTIONS.map((b) => (
                    <button
                      key={b}
                      onClick={() => updateRoutine({ breakMinutes: b })}
                      className={`chip cursor-pointer !px-3 !py-1.5 font-mono transition-all ${
                        routine.breakMinutes === b ? "grad-bg !border-transparent !text-white" : ""
                      }`}
                    >
                      {b}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-6 py-4">
              <span className="text-[11.5px] text-[var(--muted)]">Changes re-plan instantly.</span>
              <button className="btn btn-primary" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
