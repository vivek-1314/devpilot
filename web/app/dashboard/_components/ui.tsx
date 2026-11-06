"use client";

/**
 * Shared dashboard UI. Palette: ink #070606 · ember #FF4D1C · plasma #4F7BFF
 * Keep this small: every page is built from these pieces.
 */

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Sev } from "./data";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- layout ---------- */

export function Reveal({ delay = 0, className, children }: { delay?: number; className?: string; children: ReactNode }) {
  return (
    <div className={cx("dp-rise", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function PageHeader({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="intro-font-1 text-3xl font-normal tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">{desc}</p>
      </div>
      {action}
    </div>
  );
}

export function Card({ className, interactive, children }: { className?: string; interactive?: boolean; children: ReactNode }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-white/[0.08] bg-[#0e0b0b]/80",
        interactive && "transition-colors duration-300 hover:border-[#FF4D1C]/40",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ---------- controls ---------- */

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#FF4D1C] px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-[#ff6238] hover:shadow-[0_0_28px_rgba(255,77,28,0.35)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-md border border-white/15 px-4 py-2 text-sm text-white/75 transition-all duration-300 hover:border-white/30 hover:text-white active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function Btn({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  return <button type="button" {...props} className={cx(variant === "primary" ? btnPrimary : btnGhost, className)} />;
}

export function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "rounded-md px-3 py-1.5 text-sm transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white",
            value === o.id ? "bg-[#FF4D1C]/15 text-white" : "text-white/50 hover:text-white/85"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        checked ? "bg-[#FF4D1C]" : "bg-white/15"
      )}
    >
      <span
        aria-hidden
        className={cx("absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-300", checked && "translate-x-4")}
      />
    </button>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm text-white/55">{label}</span>
      <input
        {...props}
        className="mt-1.5 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#FF4D1C]/60"
      />
    </label>
  );
}

/* ---------- display ---------- */

type Tone = "ember" | "plasma" | "amber" | "neutral";

const TONES: Record<Tone, string> = {
  ember: "border-[#FF4D1C]/30 bg-[#FF4D1C]/10 text-[#FF7A52]",
  plasma: "border-[#4F7BFF]/30 bg-[#4F7BFF]/10 text-[#7D9CFF]",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  neutral: "border-white/10 bg-white/[0.04] text-white/60",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs", TONES[tone])}>
      {children}
    </span>
  );
}

export function SevBadge({ sev }: { sev: Sev }) {
  return <Badge tone={sev === "high" ? "ember" : sev === "medium" ? "amber" : "neutral"}>{sev}</Badge>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#FF4D1C]/70 to-[#FF4D1C] transition-[width] duration-700 ease-out"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{v}</>;
}

export function Stat({
  label, value, hint, tone = "neutral", delay = 0,
}: { label: string; value: number; hint: string; tone?: "ember" | "plasma" | "neutral"; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <Card interactive className="p-5">
        <p className="text-sm text-white/55">{label}</p>
        <p className="intro-font-1 mt-3 text-4xl tracking-tight">
          <CountUp to={value} />
        </p>
        <p className={cx("mt-2 text-xs", tone === "ember" ? "text-[#FF7A52]" : tone === "plasma" ? "text-[#7D9CFF]" : "text-white/40")}>
          {hint}
        </p>
      </Card>
    </Reveal>
  );
}

export function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values);
  return (
    <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Repository activity over the last 14 days">
      {values.map((v, i) => (
        <div key={i} className="flex h-full flex-1 items-end">
          <div
            title={`${v} events`}
            className="dp-grow w-full rounded-t bg-gradient-to-t from-[#FF4D1C]/20 to-[#FF4D1C] opacity-80 transition-opacity hover:opacity-100"
            style={{ height: `${(v / max) * 100}%`, animationDelay: `${200 + i * 45}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-white/40">{children}</p>;
}