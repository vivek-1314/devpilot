"use client";

/**
 * Dashboard shell: sidebar (drawer on mobile), top bar, ambient ember glow.
 * The active marker slides between items, so every nav item is exactly 44px tall.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cx } from "./ui";

const ICONS: Record<string, string> = {
  overview: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  repos: "M6 3h12v15H6a2 2 0 0 0-2 2V5a2 2 0 0 1 2-2zM6 21h12",
  pr: "M4 5a2 2 0 1 0 4 0 2 2 0 1 0-4 0M4 19a2 2 0 1 0 4 0 2 2 0 1 0-4 0M16 19a2 2 0 1 0 4 0 2 2 0 1 0-4 0M6 7v10M18 17V10a3 3 0 0 0-3-3h-3",
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12",
  shield: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4",
  agent: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6",
  menu: "M4 7h16M4 12h16M4 17h16",
};

const NAV = [
  { label: "Overview", href: "/dashboard", icon: "overview" },
  { label: "Repositories", href: "/dashboard/repositories", icon: "repos" },
  { label: "Pull requests", href: "/dashboard/pull-requests", icon: "pr" },
  { label: "Code intelligence", href: "/dashboard/code-intelligence", icon: "code" },
  { label: "Quality & security", href: "/dashboard/quality-security", icon: "shield" },
  { label: "AI agent", href: "/dashboard/ai-agent", icon: "agent" },
  { label: "Activity", href: "/dashboard/activity", icon: "pulse" },
  { label: "Settings", href: "/dashboard/settings", icon: "sliders" },
];

const ITEM = 44; // item height 40px + 4px gap

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const active = NAV.findIndex((n) => (n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href)));

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative min-h-svh bg-[#070606] text-white">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed -right-40 -top-40 h-[40rem] w-[40rem] bg-[radial-gradient(circle,rgba(255,77,28,0.10),transparent_62%)]"
      />

      {/* mobile overlay */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cx(
          "fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* sidebar */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-white/[0.08] bg-[#090707] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Link
          href="/"
          aria-label="DevPilot, back to the website"
          className="intro-font-1 flex h-14 items-center px-6 text-xl leading-none"
        >
          <span className="text-white/60">Dev</span>
          <span>Pilot</span>
          <span aria-hidden className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[#FF4D1C] shadow-[0_0_10px_2px_rgba(255,77,28,0.8)]" />
        </Link>

        <nav aria-label="Dashboard" className="relative mt-4 px-3">
          <div
            aria-hidden
            className="absolute inset-x-3 top-0 h-10 rounded-lg bg-[#FF4D1C]/10 ring-1 ring-inset ring-[#FF4D1C]/20 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateY(${Math.max(active, 0) * ITEM}px)`, opacity: active < 0 ? 0 : 1 }}
          >
            <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#FF4D1C] shadow-[0_0_10px_rgba(255,77,28,0.9)]" />
          </div>

          <ul>
            {NAV.map((n, i) => (
              <li key={n.href} className="mb-1">
                <Link
                  href={n.href}
                  aria-current={active === i ? "page" : undefined}
                  className={cx(
                    "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white",
                    active === i ? "text-white" : "text-white/50 hover:text-white/90"
                  )}
                >
                  <Icon
                    name={n.icon}
                    className={cx(
                      "h-[18px] w-[18px] transition-colors duration-300",
                      active === i ? "text-[#FF6A3D]" : "group-hover:text-white/80"
                    )}
                  />
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto border-t border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF4D1C]/15 text-xs text-[#FF7A52]">D</span>
            <div className="min-w-0">
              <p className="truncate text-sm">devon</p>
              <p className="truncate text-xs text-white/40">Signed in with GitHub</p>
            </div>
          </div>
        </div>
      </aside>

      {/* content */}
      <div className="relative lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#070606]/70 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="-ml-2 flex h-9 w-9 items-center justify-center rounded-md text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white lg:hidden"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <span className="text-sm text-white/60">{NAV[active]?.label ?? "Dashboard"}</span>
          </div>

          <span className="flex items-center gap-2 text-xs text-white/55">
            <span aria-hidden className="dp-ping h-1.5 w-1.5 rounded-full bg-[#4F7BFF]" />
            GitHub connected
          </span>
        </header>

        <main className="px-5 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}