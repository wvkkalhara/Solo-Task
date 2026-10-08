/* ------------------------------------------------------------------ */
/*  Subject manager — add, edit and delete subjects                    */
/*  Subjects drive filters, calendar colors, analytics & the donut.    */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BookMarked, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { SUBJECT_PALETTE } from "../lib/data";
import type { Subject } from "../lib/types";

export default function SubjectManager() {
  const { subjects, subjectsOpen, setSubjectsOpen, addSubject, updateSubject, deleteSubject, state } = useApp();

  /* add-new form */
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [color, setColor] = useState(SUBJECT_PALETTE[0]);
  /* edit-in-place */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShort, setEditShort] = useState("");
  const [editColor, setEditColor] = useState("");
  /* cascade-delete confirmation for in-use subjects */
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    if (subjectsOpen) {
      setEditingId(null);
      setConfirmDel(null);
      setName("");
      setShort("");
      setColor(SUBJECT_PALETTE[Math.floor(Math.random() * SUBJECT_PALETTE.length)]);
    }
  }, [subjectsOpen]);

  /* auto-derive the short code while typing a new subject name */
  const onNameChange = (v: string) => {
    setName(v);
    setShort(v.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase());
  };

  const save = () => {
    if (!name.trim()) return;
    addSubject(name, short || name.slice(0, 3), color);
    setName("");
    setShort("");
    setColor(SUBJECT_PALETTE[Math.floor(Math.random() * SUBJECT_PALETTE.length)]);
  };

  const startEdit = (s: Subject) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditShort(s.short);
    setEditColor(s.color);
  };

  const commitEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateSubject(editingId, {
      name: editName.trim(),
      short: (editShort.trim() || editName.slice(0, 3)).toUpperCase(),
      color: editColor,
    });
    setEditingId(null);
  };

  const usage = (id: string) => ({
    tasks: state.tasks.filter((t) => t.subject === id).length,
    papers: state.papers.filter((p) => p.subject === id).length,
  });

  return (
    <AnimatePresence>
      {subjectsOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSubjectsOpen(false)}
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
              <div className="flex items-center gap-2.5">
                <BookMarked size={17} className="text-[var(--acc2)]" />
                <div>
                  <h3 className="font-display text-[17px] font-bold tracking-tight">Subjects</h3>
                  <p className="text-[11.5px] text-[var(--muted)]">
                    They power filters, colors, analytics & the donut.
                  </p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSubjectsOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto px-6 py-5">
              {subjects.map((s) => {
                const u = usage(s.id);
                const editing = editingId === s.id;
                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors"
                  >
                    {editing ? (
                      /* ------- edit mode ------- */
                      <div className="space-y-2.5">
                        <div className="flex gap-2">
                          <input
                            className="field flex-1"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Subject name"
                            autoFocus
                          />
                          <input
                            className="field w-[76px] text-center font-mono uppercase"
                            value={editShort}
                            maxLength={4}
                            onChange={(e) => setEditShort(e.target.value.toUpperCase())}
                            placeholder="CODE"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {SUBJECT_PALETTE.map((c) => (
                            <button
                              key={c}
                              className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                              style={{
                                background: c,
                                boxShadow: editColor === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${c}` : undefined,
                              }}
                              onClick={() => setEditColor(c)}
                              aria-label={`Color ${c}`}
                            />
                          ))}
                          <div className="ml-auto flex gap-1.5">
                            <button className="btn btn-ghost !px-3 !py-1.5 !text-[11.5px]" onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                            <button className="btn btn-primary !px-3 !py-1.5 !text-[11.5px]" onClick={commitEdit}>
                              <Check size={13} /> Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ------- display mode ------- */
                      <>
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[10px] font-bold"
                            style={{ background: `${s.color}1c`, color: s.color }}
                          >
                            {s.short}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13.5px] font-bold">
                              {s.name}
                              {s.excluded && (
                                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
                                  not in stats
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--muted)]">
                              {u.tasks} task{u.tasks === 1 ? "" : "s"} · {u.papers} paper{u.papers === 1 ? "" : "s"}
                            </div>
                          </div>
                          <button className="icon-btn !h-8 !w-8" onClick={() => startEdit(s)} aria-label={`Edit ${s.name}`}>
                            <Pencil size={13} />
                          </button>
                          <button
                            className="icon-btn btn-danger !h-8 !w-8"
                            onClick={() => {
                              if (u.tasks + u.papers === 0) deleteSubject(s.id);
                              else setConfirmDel(confirmDel === s.id ? null : s.id);
                            }}
                            aria-label={`Delete ${s.name}`}
                            title={u.tasks + u.papers > 0 ? "In use — click to reveal delete options" : "Delete subject"}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* cascade-delete confirmation */}
                        {confirmDel === s.id && (
                          <div className="mt-2.5 rounded-lg border border-rose-400/40 bg-rose-500/10 p-3">
                            <p className="flex items-start gap-2 text-[12px] font-semibold leading-snug text-rose-400">
                              <AlertTriangle size={14} className="mt-0.5 flex-none" />
                              {s.name} is linked to {u.tasks} task{u.tasks === 1 ? "" : "s"} and {u.papers} paper
                              {u.papers === 1 ? "" : "s"}. Delete all of them together?
                            </p>
                            <div className="mt-2.5 flex gap-2">
                              <button
                                className="btn btn-ghost !px-3 !py-1.5 !text-[11.5px]"
                                onClick={() => setConfirmDel(null)}
                              >
                                Keep it
                              </button>
                              <button
                                className="btn !px-3 !py-1.5 !text-[11.5px] text-white"
                                style={{ background: "linear-gradient(120deg,#f43f5e,#e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,.35)" }}
                                onClick={() => {
                                  deleteSubject(s.id, true);
                                  setConfirmDel(null);
                                }}
                              >
                                <Trash2 size={12} /> Delete everything
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* ------- add new ------- */}
              <div className="mt-4 rounded-xl border border-dashed border-[var(--border-strong)] p-3.5">
                <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Add subject
                </div>
                <div className="flex gap-2">
                  <input
                    className="field flex-1"
                    placeholder='e.g. "Accounting" or "Biology"'
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && save()}
                  />
                  <input
                    className="field w-[76px] text-center font-mono uppercase"
                    value={short}
                    maxLength={4}
                    onChange={(e) => setShort(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    title="Short code shown on chips"
                  />
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  {SUBJECT_PALETTE.map((c) => (
                    <button
                      key={c}
                      className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                      style={{
                        background: c,
                        boxShadow: color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${c}` : undefined,
                      }}
                      onClick={() => setColor(c)}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                  <button
                    className="btn btn-primary ml-auto !px-3.5 !py-1.5 !text-[11.5px]"
                    onClick={save}
                    disabled={!name.trim()}
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
