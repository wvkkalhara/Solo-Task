/* ------------------------------------------------------------------ */
/*  Printable weekly report                                            */
/*  Hidden on screen (#print-report), becomes the ONLY visible node    */
/*  under @media print — clean black-on-white, wall-pinnable layout.   */
/* ------------------------------------------------------------------ */

import { useApp } from "../context/AppContext";
import { addDays, dateKey, DAYS_FULL, fmtDuration, fmtTime } from "../lib/utils";

export default function PrintReport() {
  const { sessions, weekStart, state, subject } = useApp();

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const end = days[6];
  const range = `${days[0].getDate()} ${days[0].toLocaleString("en", { month: "long" })} — ${end.getDate()} ${end.toLocaleString("en", { month: "long" })} ${end.getFullYear()}`;

  const totalMins = sessions
    .filter((s) => days.some((d) => dateKey(d) === s.date) && s.subject !== "school")
    .reduce((a, s) => a + (s.end - s.start), 0);

  const dueThisWeek = state.tasks.filter(
    (t) =>
      t.frequency === "once" &&
      !t.completed &&
      t.deadline >= dateKey(days[0]) &&
      t.deadline <= dateKey(days[6])
  );

  return (
    <div id="print-report">
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "3px solid #111", paddingBottom: 10 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            Solo Task · Weekly Study Schedule
          </div>
          <div style={{ fontSize: 14, color: "#444", marginTop: 2 }}>{range}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#555" }}>
          <div>Total planned: <strong>{fmtDuration(totalMins)}</strong></div>
          <div>Generated {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* days */}
      {days.map((d) => {
        const key = dateKey(d);
        const daySessions = sessions.filter((s) => s.date === key);
        return (
          <div key={key} style={{ marginTop: 16, breakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between", background: "#111", color: "#fff", padding: "5px 12px", borderRadius: 6, fontSize: 13, fontWeight: 700 }}>
              <span>
                {DAYS_FULL[d.getDay()]} · {d.getDate()}/{d.getMonth() + 1}
              </span>
              <span>
                {daySessions.length} block{daySessions.length === 1 ? "" : "s"}
              </span>
            </div>
            {daySessions.length === 0 ? (
              <div style={{ padding: "8px 12px", fontSize: 12, color: "#777", fontStyle: "italic" }}>
                Rest / buffer day — keep it light.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <tbody>
                  {daySessions.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #ddd" }}>
                      <td style={{ width: 26, padding: "7px 8px", verticalAlign: "top" }}>
                        <span style={{ display: "inline-block", width: 13, height: 13, border: "1.8px solid #111", borderRadius: 3 }} />
                      </td>
                      <td style={{ width: 128, padding: "7px 4px", fontFamily: "monospace", color: "#333", whiteSpace: "nowrap" }}>
                        {fmtTime(s.start)} – {fmtTime(s.end)}
                      </td>
                      <td style={{ padding: "7px 4px", fontWeight: 650 }}>
                        {s.taskName}
                        {s.auto && <span style={{ color: "#666", fontWeight: 400 }}>&nbsp;(auto-planned)</span>}
                      </td>
                      <td style={{ width: 120, padding: "7px 4px", color: "#444" }}>
                        {subject(s.subject).name}
                      </td>
                      <td style={{ width: 56, padding: "7px 8px", textAlign: "right", color: "#444" }}>
                        {fmtDuration(s.end - s.start)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* deadlines this week */}
      {dueThisWeek.length > 0 && (
        <div style={{ marginTop: 22, breakInside: "avoid" }}>
          <div style={{ fontSize: 14, fontWeight: 800, borderBottom: "2px solid #111", paddingBottom: 4 }}>
            Deadlines this week
          </div>
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", fontSize: 12.5 }}>
            {dueThisWeek.map((t) => (
              <li key={t.id} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px dashed #ccc" }}>
                <span style={{ display: "inline-block", width: 13, height: 13, border: "1.8px solid #111", borderRadius: 3, marginTop: 1 }} />
                <span style={{ fontWeight: 650 }}>{t.name}</span>
                <span style={{ color: "#555" }}>
                  — due {t.deadline} · {subject(t.subject).name} · {fmtDuration(t.estimatedMinutes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* footer */}
      <div style={{ marginTop: 26, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", borderTop: "1px solid #bbb", paddingTop: 8 }}>
        <span>Discipline beats motivation — tick every box.</span>
        <span>Printed from Solo Task · Ultimate A-Level Study Planner</span>
      </div>
    </div>
  );
}
