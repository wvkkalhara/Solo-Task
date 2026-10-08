/* ------------------------------------------------------------------ */
/*  Toast stack — wellness nudges + action confirmations               */
/* ------------------------------------------------------------------ */

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Coffee,
  Droplets,
  Info,
  Sparkles,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import type { Toast } from "../lib/types";

const ICONS: Record<Toast["icon"], { icon: typeof Droplets; color: string }> = {
  water: { icon: Droplets, color: "#38bdf8" },
  break: { icon: Coffee, color: "#f59e0b" },
  stretch: { icon: Activity, color: "#34d399" },
  check: { icon: CheckCircle2, color: "#34d399" },
  info: { icon: Info, color: "#22d3ee" },
  sparkle: { icon: Sparkles, color: "#a855f7" },
};

export default function Toasts() {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="toast-stack pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[320px] max-w-[calc(100vw-40px)] flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((t) => {
          const { icon: Icon, color } = ICONS[t.icon];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", damping: 24, stiffness: 320 }}
              className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[var(--border-strong)] p-3.5"
              style={{ background: "var(--surface-modal)", backdropFilter: "blur(20px)", boxShadow: "var(--shadow-lg)" }}
            >
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-xl"
                style={{ background: `${color}1f`, color }}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold leading-snug">{t.title}</div>
                {t.body && (
                  <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--muted)]">{t.body}</div>
                )}
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="text-[var(--faint)] transition-colors hover:text-[var(--text)]"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
              {/* shrink progress bar */}
              <motion.span
                className="absolute bottom-0 left-4 h-[2px] rounded-full"
                style={{ background: color }}
                initial={{ width: "calc(100% - 32px)" }}
                animate={{ width: 0 }}
                transition={{ duration: 6, ease: "linear" }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
