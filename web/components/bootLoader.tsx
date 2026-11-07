"use client";

/**
 * DevPilot BootLoader (repository scan)
 * Usage: <BootLoader onComplete={() => {}} />
 * Palette: ink #050506 · ember #FF4D1C · plasma #4F7BFF
 * Styling is Tailwind only; the code field is drawn on a <canvas>.
 *
 * Idea: the loader acts out what DevPilot does. A field of code lines fills the screen,
 * an ember beam reads down through it, lines turn plasma as they are read and a few
 * are flagged ember. A small panel ticks off the checks. At the bottom the beam becomes
 * the edge of the shutter, which lifts away and reveals the page.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "devpilot:boot-seen";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const hasSeen = (key: string) => {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const markSeen = (key: string) => {
  try {
    window.localStorage.setItem(key, "1");
  } catch { }
};

type Phase = "loading" | "ready" | "exit" | "gone";

interface BootLoaderProps {
  duration?: number;
  onComplete?: () => void;
  storageKey?: string;
}

interface Row {
  indent: number;
  segs: number[];
  flag: boolean;
}

const CHECKS = [
  { name: "ruff", note: "reads files", from: 4, to: 30 },
  { name: "bandit", note: "reads files", from: 28, to: 56 },
  { name: "gitleaks", note: "reads files", from: 54, to: 80 },
  { name: "pytest -q", note: "in a sandbox", from: 78, to: 99 },
];

const ease = (x: number) => x * x * (3 - 2 * x);

function makeRows(count: number): Row[] {
  let s = 1337;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let indent = 0;
  return Array.from({ length: count }, () => {
    const r = rnd();
    if (r < 0.12) return { indent, segs: [], flag: false };
    if (r < 0.3) indent = Math.min(5, indent + 1);
    else if (r < 0.5) indent = Math.max(0, indent - 1);
    const n = 2 + Math.floor(rnd() * 5);
    return {
      indent,
      segs: Array.from({ length: n }, () => 18 + rnd() * 80),
      flag: rnd() < 0.06,
    };
  });
}

export default function BootLoader({
  duration = 4600,
  onComplete,
  storageKey = STORAGE_KEY,
}: BootLoaderProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [percent, setPercent] = useState(0);
  const [mounted, setMounted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // ⬇ add here
  const skippedRef = useRef(false);

  useIsoLayoutEffect(() => {
    if (hasSeen(storageKey)) {
      skippedRef.current = true;
      markSeen(storageKey);
      setPhase("gone");
      onCompleteRef.current?.();
    }
  }, [storageKey]);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 80);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (phase === "gone") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase, storageKey]);

  /* progress */
  useEffect(() => {
    if (skippedRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reduced ? 1200 : duration;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const x = Math.min(1, (now - start) / total);
      const p = ease(x);
      progressRef.current = p;
      const pct = Math.floor(p * 100);
      setPercent((prev) => (prev === pct ? prev : pct));
      if (x < 1) raf = requestAnimationFrame(tick);
      else setPhase("ready");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  /* timeline */
  useEffect(() => {
    let id: number | undefined;
    if (phase === "ready") id = window.setTimeout(() => setPhase("exit"), 750);
    if (phase === "exit")
      id = window.setTimeout(() => {
        setPhase("gone");
        onCompleteRef.current?.();
      }, 1000);
    return () => {
      if (id) window.clearTimeout(id);
    };
  }, [phase]);

  /* code field and beam */
  useEffect(() => {
    if (skippedRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ROW = 18;
    let w = 0;
    let h = 0;
    let rows: Row[] = [];
    let raf = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rows = makeRows(Math.ceil(h / ROW) + 1);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const beamY = progressRef.current * h;
      ctx.clearRect(0, 0, w, h);

      rows.forEach((row, i) => {
        const y = i * ROW + ROW / 2;
        const read = y < beamY;
        const near = Math.exp(-(beamY - y) / 90);

        let color = "#FFFFFF";
        let alpha = 0.06;
        if (read) {
          color = row.flag ? "#FF4D1C" : "#4F7BFF";
          alpha = row.flag ? 0.55 + 0.45 * near : 0.2 + 0.7 * near;
        }
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.min(1, alpha);

        if (read && row.flag) ctx.fillRect(10, y - 3, 6, 6);

        let x = 28 + row.indent * 20;
        for (const sw of row.segs) {
          if (x > w - 24) break;
          ctx.fillRect(x, y - 1.5, sw, 3);
          x += sw + 8;
        }
      });
      ctx.globalAlpha = 1;

      /* beam */
      const g = ctx.createLinearGradient(0, beamY - 140, 0, beamY);
      g.addColorStop(0, "rgba(255,77,28,0)");
      g.addColorStop(1, "rgba(255,77,28,0.16)");
      ctx.fillStyle = g;
      ctx.fillRect(0, beamY - 140, w, 140);

      ctx.fillStyle = "#FF4D1C";
      ctx.shadowColor = "rgba(255,77,28,0.9)";
      ctx.shadowBlur = 18;
      ctx.fillRect(0, beamY - 1, w, 2);
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  if (phase === "gone") return null;

  const finished = phase !== "loading";
  const fadeIn = (delay: string) =>
    [
      "transition-opacity duration-700",
      delay,
      mounted ? "opacity-100" : "opacity-0",
    ].join(" ");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading DevPilot"
      className={[
        "fixed inset-0 z-[9999] bg-[#050506] text-white",
        "transition-transform duration-[900ms] ease-[cubic-bezier(0.76,0,0.24,1)]",
        phase === "exit" ? "pointer-events-none -translate-y-full" : "translate-y-0",
      ].join(" ")}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,#050506_95%)]" />

      {/* wordmark */}
      <div className={["absolute left-6 top-6 flex items-baseline gap-2 leading-none sm:left-10 sm:top-8", fadeIn("delay-300")].join(" ")}>
        <span className="font-serif text-2xl font-light italic text-white/60">Dev</span>
        <span className="text-base font-semibold tracking-[0.2em]">PILOT</span>
      </div>

      {/* ghost percent */}
      <span
        aria-hidden
        className={[
          "absolute bottom-4 right-6 font-serif text-[clamp(5rem,18vw,13rem)] font-light leading-none tabular-nums tracking-tight text-white/[0.14] sm:right-10",
          fadeIn("delay-500"),
        ].join(" ")}
      >
        {String(percent).padStart(3, "0")}
      </span>

      {/* check panel */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div
          className={[
            "w-full max-w-sm border border-white/10 bg-[#0a0a0c]/90 p-5 backdrop-blur-sm",
            "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] delay-300",
            mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          ].join(" ")}
        >
          <ul className="font-mono text-[12px] leading-7">
            {CHECKS.map((c) => {
              const done = percent >= c.to;
              const active = !done && percent >= c.from;
              return (
                <li key={c.name} className="flex items-baseline justify-between gap-4">
                  <span className={done || active ? "text-white/80" : "text-white/30"}>
                    {c.name} <span className="text-white/35">{c.note}</span>
                  </span>
                  <span
                    className={[
                      "text-[11px]",
                      done ? "text-[#4F7BFF]" : active ? "animate-pulse text-[#FF4D1C]" : "text-white/25",
                    ].join(" ")}
                  >
                    {done ? "done" : active ? "running" : "waiting"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p
            className={[
              "mt-4 border-t border-white/10 pt-3 font-mono text-[11px] transition-colors duration-500",
              finished ? "text-white/80" : "text-white/35",
            ].join(" ")}
          >
            {finished ? "Ready. Nothing ran on the host." : "host: nothing runs here"}
          </p>
        </div>
      </div>

      {/* shutter edge: the beam's last position, carried up as the screen lifts */}
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-x-0 -bottom-px h-px bg-[#FF4D1C]",
          "shadow-[0_0_28px_6px_rgba(255,77,28,0.85)] transition-opacity duration-300",
          finished ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
    </div>
  );
}