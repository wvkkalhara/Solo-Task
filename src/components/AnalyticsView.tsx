/* ------------------------------------------------------------------ */
/*  Analytics — workload charts + auto-generated study insights        */
/* ------------------------------------------------------------------ */

import {
  BookOpenCheck,
  CircleSlash2,
  Coffee,
  Flame,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "../context/AppContext";
import { getFreeTime, getMissed } from "../lib/insights";
import { addDays, dateKey, DAYS_SHORT, fmtDuration, fmtHours, startOfWeek } from "../lib/utils";
import { FadeIn } from "./ui";

interface Insight {
  icon: typeof Target;
  title: string;
  body: string;
  tone: "good" | "warn" | "info";
}

const TONE_COLOR: Record<Insight["tone"], string> = {
  good: "#34d399",
  warn: "#fbbf24",
  info: "#22d3ee",
};

export default function AnalyticsView() {
  const { state, sessions, studySubjects, subject, routine } = useApp();
  /* analytics reflect the real current week, not the browsed week */
  const weekStart = startOfWeek(new Date());

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekKeys = days.map(dateKey);

  /* ---------- stacked per-subject hours for each day ---------- */
  const barData = days.map((d, i) => {
    const log = state.studyLog[weekKeys[i]] ?? {};
    const row: Record<string, string | number> = { day: DAYS_SHORT[d.getDay()] };
    let total = 0;
    for (const s of studySubjects) {
      const m = log[s.id] ?? 0;
      row[s.id] = +(m / 60).toFixed(2);
      total += m;
    }
    row.total = total;
    return row;
  });
  const weekMinutes = barData.reduce((a, r) => a + (r.total as number), 0);

  /* ---------- donut: subject share this week ---------- */
  const donut = studySubjects.map((s) => ({
    name: s.name,
    color: s.color,
    value: weekKeys.reduce((a, k) => a + ((state.studyLog[k] ?? {})[s.id] ?? 0), 0),
  })).filter((d) => d.value > 0);

  /* ---------- sessions this week (fair completion) ---------- */
  const tKey = dateKey(new Date());
  const weekSessions = sessions.filter(
    (s) => weekKeys.includes(s.date) && s.subject !== "school" && s.kind !== "meal"
  );
  const pastDone = weekSessions.filter((s) => s.date < tKey && s.done).length;
  const pending = weekSessions.filter((s) => s.date >= tKey);
  const doneSessions = pastDone + pending.filter((s) => s.done).length;
  const totalBlocks = pastDone + pending.length;
  const completionRate = totalBlocks ? Math.round((doneSessions / totalBlocks) * 100) : 0;

  /* ---------- score trend (chronological attempts) ---------- */
  const attempts = state.papers
    .filter((p) => p.status === "completed")
    .sort((a, z) => a.date.localeCompare(z.date))
    .slice(-8);
  const trend = attempts.map((p, i) => ({
    n: `#${i + 1}`,
    score: p.score ?? 0,
    label: `${subject(p.subject).short} ${p.year} ${p.paperType}`,
  }));

  /* ---------- per-subject paper stats ---------- */
  const paperStats = studySubjects.map((s) => {
    const sp = state.papers.filter((p) => p.subject === s.id);
    const spDone = sp.filter((p) => p.status === "completed");
    const avg = spDone.length
      ? Math.round(spDone.reduce((a, p) => a + (p.score ?? 0), 0) / spDone.length)
      : 0;
    return { ...s, done: spDone.length, avg };
  });

  /* ---------- insight engine ---------- */
  const insights: Insight[] = [];
  const totalMins = donut.reduce((a, d) => a + d.value, 0);
  if (totalMins > 0 && donut.length > 1) {
    const sorted = [...donut].sort((a, z) => z.value - a.value);
    const top = sorted[0];
    const share = Math.round((top.value / totalMins) * 100);
    const bottom = sorted[sorted.length - 1];
    if (share >= 45) {
      insights.push({
        icon: Scale,
        title: "Workload imbalance",
        body: `${share}% of your week went to ${top.name}. Consider reallocating a few blocks to ${bottom.name} (${Math.round(
          (bottom.value / totalMins) * 100
        )}%).`,
        tone: "warn",
      });
    } else {
      insights.push({
        icon: Scale,
        title: "Nicely balanced",
        body: `No subject dominates — ${top.name} leads at just ${share}%. Balanced revision sticks better.`,
        tone: "good",
      });
    }
  }

  insights.push({
    icon: Target,
    title: `${completionRate}% block completion`,
    body:
      completionRate >= 80
        ? "Outstanding discipline this week. Your plan is realistic — keep going."
        : completionRate >= 50
          ? "Solid. Shrink big blocks to ≤60m to push completion above 80%."
          : "Too many skipped blocks — reduce estimated times or lighten deadlines.",
    tone: completionRate >= 80 ? "good" : completionRate >= 50 ? "info" : "warn",
  });

  /* capacity insight — how much room is actually left this week */
  const freeWeek = getFreeTime(sessions, new Date(), routine, 7);
  const freeMins = freeWeek.reduce((a, d) => a + d.freeMinutes, 0);
  const avgLoad = freeWeek.reduce((a, d) => a + d.load, 0) / Math.max(1, freeWeek.length);
  insights.push({
    icon: Coffee,
    title: `${fmtHours(freeMins)} free in the next 7 days`,
    body:
      avgLoad > 0.85
        ? "You're running near capacity — adding more now risks burnout. Protect sleep first."
        : avgLoad > 0.55
          ? "A healthy load with real breathing room. Good place to slot one more past paper."
          : "Plenty of unused time. Add past papers or bring a deadline forward to use it.",
    tone: avgLoad > 0.85 ? "warn" : avgLoad > 0.55 ? "good" : "info",
  });

  /* missed-work insight */
  const missedWeek = getMissed(sessions, 7);
  const missedMins = missedWeek.reduce((a, d) => a + d.minutes, 0);
  if (missedMins > 0) {
    insights.push({
      icon: CircleSlash2,
      title: `${fmtDuration(missedMins)} skipped this week`,
      body: `${missedWeek.reduce((a, d) => a + d.sessions.length, 0)} planned block(s) were never ticked. If this repeats, your estimates are too optimistic — shorten them.`,
      tone: "warn",
    });
  }

  const fewest = [...paperStats].sort((a, z) => a.done - z.done)[0];
  if (fewest) {
    insights.push({
      icon: BookOpenCheck,
      title: `${fewest.name}: ${fewest.done} papers`,
      body:
        fewest.done < 2
          ? `This is your thinnest subject. Aim for one ${fewest.short} paper per week until results day.`
          : `Healthy pace here. Keep the streak of weekly ${fewest.short} papers going.`,
      tone: fewest.done < 2 ? "warn" : "info",
    });
  }

  if (attempts.length >= 4) {
    const last3 = attempts.slice(-3).reduce((a, p) => a + (p.score ?? 0), 0) / 3;
    const prev3 = attempts.slice(-6, -3).reduce((a, p) => a + (p.score ?? 0), 0) / Math.max(1, Math.min(3, attempts.length - 3));
    const diff = Math.round(last3 - prev3);
    insights.push({
      icon: diff >= 0 ? TrendingUp : TrendingDown,
      title: `Score trend ${diff >= 0 ? "+" : ""}${diff}%`,
      body:
        diff >= 0
          ? "Your last three papers beat the previous three. The hard work is compounding."
          : "Recent scores dipped. Review marking schemes and log mistakes after every paper.",
      tone: diff >= 0 ? "good" : "warn",
    });
  }

  const summary = [
    { label: "Hours studied · week", value: fmtHours(weekMinutes), accent: "#8b5cf6" },
    { label: "Blocks done", value: `${doneSessions}/${totalBlocks}`, accent: "#22d3ee" },
    { label: "Papers completed", value: String(state.papers.filter((p) => p.status === "completed").length), accent: "#34d399" },
    {
      label: "Average score",
      value: `${(() => {
        const d = state.papers.filter((p) => p.status === "completed");
        return d.length ? Math.round(d.reduce((a, p) => a + (p.score ?? 0), 0) / d.length) : 0;
      })()}%`,
      accent: "#f59e0b",
    },
  ];

  return (
    <FadeIn className="space-y-4">
      {/* summary strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summary.map((s, i) => (
          <FadeIn key={s.label} delay={i * 0.05}>
            <div className="card p-4">
              <div className="font-display text-[24px] font-bold tracking-tight" style={{ color: s.accent }}>
                {s.value}
              </div>
              <div className="mt-1 text-[11.5px] font-semibold text-[var(--muted)]">{s.label}</div>
            </div>
          </FadeIn>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* stacked hours */}
        <FadeIn delay={0.1} className="card p-5">
          <h3 className="font-display text-[15px] font-bold tracking-tight">
            Study hours by day <span className="text-[11px] font-medium text-[var(--muted)]">· stacked by subject</span>
          </h3>
          <div className="mt-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barSize={26} margin={{ left: -22, right: 4, top: 4 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "var(--muted)", fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--faint)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  unit="h"
                />
                <Tooltip content={<Tip unit="h" />} cursor={{ fill: "var(--surface-2)" }} />
                {studySubjects.map((s, i) => (
                  <Bar key={s.id} dataKey={s.id} name={s.name} stackId="a" fill={s.color} radius={i === studySubjects.length - 1 ? [5, 5, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* legend */}
          <div className="mt-3 flex flex-wrap gap-3">
            {studySubjects.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.short}
              </span>
            ))}
          </div>
        </FadeIn>

        {/* donut */}
        <FadeIn delay={0.15} className="card p-5">
          <h3 className="font-display text-[15px] font-bold tracking-tight">Time allocation</h3>
          <div className="relative mx-auto mt-2 h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donut}
                  dataKey="value"
                  innerRadius={66}
                  outerRadius={90}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {donut.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<Tip unit="m" />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[22px] font-bold">{fmtHours(totalMins)}</span>
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted)]">this week</span>
            </div>
          </div>
          <div className="mt-1 space-y-1.5">
            {donut.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-[11.5px]">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="font-semibold text-[var(--text-soft)]">{d.name}</span>
                <span className="ml-auto font-mono text-[var(--muted)]">
                  {fmtDuration(d.value)} · {totalMins ? Math.round((d.value / totalMins) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* score trend */}
        <FadeIn delay={0.2} className="card p-5">
          <h3 className="font-display text-[15px] font-bold tracking-tight">
            Past paper score trend <span className="text-[11px] font-medium text-[var(--muted)]">· last {trend.length} attempts</span>
          </h3>
          <div className="mt-4 h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -18, right: 8, top: 6 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="n" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--faint)", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<Tip unit="%" />} />
                <Area type="monotone" dataKey="score" stroke="#34d399" strokeWidth={2.5} fill="url(#scoreGrad)" dot={{ r: 3, fill: "#34d399", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </FadeIn>

        {/* auto insights */}
        <FadeIn delay={0.25} className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-display text-[15px] font-bold tracking-tight">
            <Flame size={15} className="text-orange-400" /> Smart insights
          </h3>
          <div className="space-y-2.5">
            {insights.map((ins, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
                style={{ borderLeftWidth: 3, borderLeftColor: TONE_COLOR[ins.tone] }}
              >
                <ins.icon size={16} className="mt-0.5 flex-none" style={{ color: TONE_COLOR[ins.tone] }} />
                <div>
                  <div className="text-[13px] font-bold">{ins.title}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-[var(--muted)]">{ins.body}</div>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </FadeIn>
  );
}

/* shared chart tooltip */
function Tip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; payload?: { label?: string } }>;
  label?: string;
  unit: "h" | "m" | "%";
}) {
  if (!active || !payload?.length) return null;
  const entries = payload.filter((p) => p.value > 0);
  if (!entries.length) return null;
  const sub = payload[0]?.payload?.label;
  return (
    <div className="chart-tip">
      {label && <div className="tt-title">{label}</div>}
      {entries.map((p, i) => (
        <div key={i} className="tt-sub flex items-center gap-1.5">
          {p.color && <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />}
          {p.name}: <strong className="text-[var(--text)]">{p.value}{unit}</strong>
        </div>
      ))}
      {sub && <div className="tt-sub mt-1">{sub}</div>}
    </div>
  );
}
