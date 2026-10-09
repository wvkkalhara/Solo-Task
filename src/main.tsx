import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/* ------------------------------------------------------------------ */
/*  PWA — offline-first shell with SILENT AUTO-UPDATE.                 */
/*  The worker calls skipWaiting()+claim(), so a new build activates   */
/*  itself; we just reload once when control changes. No prompts, no   */
/*  "click to update" button — it behaves like a native app.          */
/* ------------------------------------------------------------------ */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // check for a new version on launch, hourly, and on refocus
        const check = () => reg.update().catch(() => {});
        check();
        setInterval(check, 60 * 60 * 1000);
        document.addEventListener("visibilitychange", () => !document.hidden && check());
      })
      .catch(() => {
        /* offline shell unavailable — app still works via localStorage */
      });

    // a fresh worker took over → load the new build exactly once
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
