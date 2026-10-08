/* ------------------------------------------------------------------ */
/*  Small shared UI primitives                                         */
/* ------------------------------------------------------------------ */

import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { capitalize } from "../lib/utils";

/* ------------------------- entrance wrapper ------------------------ */

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------- voice typing ---------------------------- */

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function MicButton({
  onText,
  onUnsupported,
}: {
  onText: (text: string) => void;
  onUnsupported: () => void;
}) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggle = useCallback(() => {
    if (!supported) {
      onUnsupported();
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as Record<string, new () => SpeechRec>;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      onText(capitalize(txt.trim()));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [listening, onText, onUnsupported, supported]);

  return (
    <button
      type="button"
      onClick={toggle}
      title={supported ? "Voice typing" : "Voice typing not supported in this browser"}
      className={`icon-btn !w-9 !h-9 ${listening ? "mic-live" : ""}`}
      aria-pressed={listening}
    >
      <Mic size={15} />
    </button>
  );
}

/* --------------------------- progress ring --------------------------- */

export function Ring({
  size = 64,
  stroke = 7,
  pct,
  color,
  track = "var(--track)",
  children,
}: {
  size?: number;
  stroke?: number;
  pct: number; // 0..1
  color: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.5,0,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
