"use client";

/**
 * DevPilot NavBar
 * Usage: <NavBar links={[...]} cta={{ label: "Get started", href: "#start" }} />
 * Palette: ink #050506 · ember #FF4D1C · plasma #4F7BFF
 * Fonts: the wordmark and mobile menu links use the `intro-font-1` class
 * from your @font-face CSS.
 * Scroll progress is a hairline, like the BootLoader.
 */

import { useEffect, useRef, useState } from "react";

interface NavLink {
  label: string;
  href: string;
}

interface NavBarProps {
  links?: NavLink[];
  cta?: { label: string; href: string };
}

const DEFAULT_LINKS: NavLink[] = [
  { label: "Product", href: "#product" },
  { label: "Workflow", href: "#workflow" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
];

const DEFAULT_CTA = { label: "Get started", href: "#start" };

export default function NavBar({
  links = DEFAULT_LINKS,
  cta = DEFAULT_CTA,
}: NavBarProps) {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>(links[0]?.href ?? "");

  const progressRef = useRef<HTMLDivElement>(null);
  const lastY = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  /* mount reveal */
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 80);
    return () => window.clearTimeout(id);
  }, []);

  /* scroll: progress hairline, hide on down, show on up */
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${p})`;
        }
        setScrolled(y > 12);
        if (!openRef.current) {
          if (y > lastY.current && y > 120) setHidden(true);
          else if (y < lastY.current) setHidden(false);
        }
        lastY.current = y;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  /* active section */
  useEffect(() => {
    const targets = links
      .map((l) => (l.href.startsWith("#") ? document.querySelector(l.href) : null))
      .filter((el): el is Element => !!el);
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(`#${e.target.id}`);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [links]);

  /* lock body scroll + escape key while mobile menu is open */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const letter = (ch: string, i: number, base: number) => (
    <span
      key={`${base}-${i}`}
      className={[
        "inline-block transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        mounted ? "translate-y-0 opacity-100 blur-0" : "translate-y-4 opacity-0 blur-md",
      ].join(" ")}
      style={{ transitionDelay: `${base + i * 70}ms` }}
    >
      {ch}
    </span>
  );

  return (
    <>
      <header
        className={[
          "fixed inset-x-0 top-0 z-[900] transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]",
          hidden && !open ? "-translate-y-full" : "translate-y-0",
        ].join(" ")}
      >
        <nav
          aria-label="Primary"
          className={[
            "relative flex h-16 w-full items-center justify-between px-5 sm:px-8",
            "transition-[background-color,backdrop-filter] duration-500",
            scrolled || open
              ? "bg-[#050506]/70 backdrop-blur-xl"
              : "bg-transparent backdrop-blur-0",
          ].join(" ")}
        >
          {/* wordmark */}
          <a
            href="#"
            aria-label="DevPilot home"
            className="intro-font-1 group relative z-[1000] flex items-baseline text-2xl font-normal leading-none"
          >
            <span className="flex text-white/60 transition-colors duration-300 group-hover:text-white/90">
              {["D", "e", "v"].map((c, i) => letter(c, i, 100))}
            </span>
            <span className="flex text-white">
              {["P", "i", "l", "o", "t"].map((c, i) => letter(c, i, 300))}
            </span>
            <span
              aria-hidden
              className={[
                "ml-1 h-1.5 w-1.5 self-center rounded-full bg-[#FF4D1C]",
                "shadow-[0_0_10px_2px_rgba(255,77,28,0.85)] transition-opacity delay-700 duration-700",
                mounted ? "opacity-100" : "opacity-0",
              ].join(" ")}
            />
          </a>

          {/* desktop links */}
          <ul
            className={[
              "hidden items-center gap-1 md:flex transition-all delay-500 duration-700",
              mounted ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
            ].join(" ")}
          >
            {links.map((l) => {
              const isActive = active === l.href;
              return (
                <li key={l.href}>
                  <a
                    href={l.href}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "group relative block px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-300",
                      isActive ? "text-white" : "text-white/40 hover:text-white/80",
                    ].join(" ")}
                  >
                    {l.label}
                    <span
                      aria-hidden
                      className={[
                        "absolute inset-x-4 -bottom-px h-px origin-left bg-[#FF4D1C] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        "shadow-[0_0_8px_1px_rgba(255,77,28,0.8)]",
                        isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                      ].join(" ")}
                    />
                  </a>
                </li>
              );
            })}
          </ul>

          {/* desktop cta */}
          <a
            href={cta.href}
            className={[
              "group relative hidden items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] px-5 py-2",
              "font-mono text-[11px] uppercase tracking-[0.18em] text-white md:inline-flex",
              "transition-all delay-700 duration-700 hover:border-[#FF4D1C]/60 hover:shadow-[0_0_24px_rgba(255,77,28,0.35)]",
              mounted ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
            ].join(" ")}
          >
            <span
              aria-hidden
              className="absolute inset-0 origin-left scale-x-0 bg-[#FF4D1C] transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-x-100"
            />
            <span className="relative">{cta.label}</span>
            <span
              aria-hidden
              className="relative h-1.5 w-1.5 rounded-full bg-[#4F7BFF] transition-colors duration-300 group-hover:bg-white"
            />
          </a>

          {/* mobile toggle */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="relative z-[1000] flex h-10 w-10 items-center justify-center md:hidden"
          >
            <span
              aria-hidden
              className={[
                "absolute h-px w-6 bg-white transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]",
                open ? "translate-y-0 rotate-45" : "-translate-y-[4px]",
              ].join(" ")}
            />
            <span
              aria-hidden
              className={[
                "absolute h-px w-6 bg-[#FF4D1C] shadow-[0_0_8px_rgba(255,77,28,0.9)] transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]",
                open ? "translate-y-0 -rotate-45" : "translate-y-[4px]",
              ].join(" ")}
            />
          </button>

          {/* scroll progress hairline */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-white/10">
            <div
              ref={progressRef}
              className="h-full w-full origin-left scale-x-0 bg-[#FF4D1C] shadow-[0_0_10px_rgba(255,77,28,0.9)]"
            />
          </div>
        </nav>
      </header>

      {/* mobile menu: same clip-path reveal as the loader's exit */}
      <div
        id="mobile-menu"
        aria-hidden={!open}
        className={[
          "fixed inset-0 z-[950] overflow-hidden bg-[#050506] md:hidden",
          "transition-[clip-path] duration-[900ms] ease-[cubic-bezier(0.76,0,0.24,1)]",
          open
            ? "[clip-path:inset(0%_0_0%_0)]"
            : "pointer-events-none [clip-path:inset(0_0_100%_0)]",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(79,123,255,0.12),transparent_60%)]" />

        <div className="relative flex h-full flex-col justify-center px-8">
          <ul className="flex flex-col gap-2">
            {links.map((l, i) => (
              <li key={l.href} className="overflow-hidden">
                <a
                  href={l.href}
                  tabIndex={open ? 0 : -1}
                  onClick={() => setOpen(false)}
                  className={[
                    "flex items-baseline gap-4 py-2 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                    open ? "translate-y-0 opacity-100 blur-0" : "translate-y-8 opacity-0 blur-md",
                  ].join(" ")}
                  style={{ transitionDelay: open ? `${300 + i * 80}ms` : "0ms" }}
                >
                  <span className="font-mono text-[11px] tabular-nums text-[#FF4D1C]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={[
                      "intro-font-1 text-5xl font-normal transition-colors",
                      active === l.href ? "text-white" : "text-white/60 hover:text-white",
                    ].join(" ")}
                  >
                    {l.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <a
            href={cta.href}
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
            className={[
              "mt-10 inline-flex w-fit items-center gap-2 rounded-full bg-[#FF4D1C] px-6 py-3",
              "font-mono text-[11px] uppercase tracking-[0.18em] text-white shadow-[0_0_28px_rgba(255,77,28,0.5)]",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
            ].join(" ")}
            style={{ transitionDelay: open ? `${300 + links.length * 80}ms` : "0ms" }}
          >
            {cta.label}
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />
          </a>
        </div>
      </div>
    </>
  );
}