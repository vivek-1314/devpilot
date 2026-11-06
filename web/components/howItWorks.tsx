"use client";

/**
 * DevPilot Features section
 * Usage: <Features />
 * Palette: ink #050506 · ember #FF4D1C · plasma #4F7BFF
 */

import { useEffect, useRef, useState } from "react";

type Tone = "dim" | "norm" | "plasma" | "ember";

interface Line {
  t: string;
  tone?: Tone;
}

interface Feature {
  id: string;
  title: string;
  desc: string;
  label: string;
  lines: Line[];
}

interface Tier {
  name: string;
  headline: string;
  blurb: string;
  features: Feature[];
}

const TIERS: Tier[] = [
  {
    name: "Free",
    headline: "Know the repo",
    blurb: "Connect GitHub and get a clear picture of what you have.",
    features: [
      {
        id: "graph",
        title: "File tree and dependency graph",
        desc: "See how files and modules connect without opening every folder.",
        label: "services/api",
        lines: [
          { t: "app/", tone: "norm" },
          { t: "├─ main.py            imports routes, db", tone: "dim" },
          { t: "├─ routes/analyze.py  imports services", tone: "dim" },
          { t: "└─ db.py              imports postgres", tone: "dim" },
        ],
      },
      {
        id: "stack",
        title: "Detected tech stack",
        desc: "Languages, frameworks and tools, found automatically.",
        label: "Detected",
        lines: [
          { t: "Python       FastAPI", tone: "norm" },
          { t: "TypeScript   Next.js, Tailwind CSS", tone: "norm" },
          { t: "Database     PostgreSQL", tone: "norm" },
        ],
      },
      {
        id: "summary",
        title: "AI summary of purpose",
        desc: "A plain-language explanation of what the project does, for anyone joining it.",
        label: "Summary",
        lines: [
          { t: "A web service that connects to GitHub", tone: "norm" },
          { t: "repositories and reports on code quality", tone: "norm" },
          { t: "and security for each pull request.", tone: "norm" },
        ],
      },
      {
        id: "scan",
        title: "Quality and secret scanning",
        desc: "Ruff and Gitleaks read the repository and report what they find.",
        label: "Scan results",
        lines: [
          { t: "ruff       no issues found", tone: "norm" },
          { t: "gitleaks   1 possible secret", tone: "ember" },
          { t: "           config/settings.py:12", tone: "dim" },
        ],
      },
    ],
  },
  {
    name: "Paid",
    headline: "Watch every PR",
    blurb: "DevPilot follows each pull request and CI run as it happens.",
    features: [
      {
        id: "monitor",
        title: "PR monitoring",
        desc: "Follow each pull request from the moment it opens to the moment it merges.",
        label: "#218 fix/token-logging",
        lines: [
          { t: "opened    by a teammate", tone: "dim" },
          { t: "checks    3 of 3 reported", tone: "norm" },
          { t: "review    1 approval", tone: "norm" },
          { t: "merged    into main", tone: "plasma" },
        ],
      },
      {
        id: "preflight",
        title: "Pre-flight checks",
        desc: "Checks run before a pull request merges, while a fix is still cheap.",
        label: "Pre-flight #219",
        lines: [
          { t: "ruff       no issues found", tone: "norm" },
          { t: "gitleaks   no issues found", tone: "norm" },
          { t: "bandit     subprocess call, importer.py:31", tone: "ember" },
        ],
      },
      {
        id: "ci",
        title: "CI failure tracking",
        desc: "Every failed run is recorded with the step that failed and the commit behind it.",
        label: "CI runs on main",
        lines: [
          { t: "run 482   failed   tests / pytest", tone: "ember" },
          { t: "run 483   passed", tone: "plasma" },
          { t: "run 484   failed   lint / ruff", tone: "ember" },
        ],
      },
      {
        id: "health",
        title: "Repo health and history",
        desc: "Trends and a searchable event log, so growing risk shows up early.",
        label: "Last 6 weeks",
        lines: [
          { t: "failed CI runs   ▂ ▃ ▂ ▅ ▇ ▅", tone: "ember" },
          { t: "open findings    ▇ ▅ ▄ ▃ ▂ ▂", tone: "plasma" },
          { t: "findings are falling, CI failures are not", tone: "dim" },
        ],
      },
    ],
  },
  {
    name: "Top tier",
    headline: "Fix what breaks",
    blurb: "From failure to a verified patch, with you approving every change.",
    features: [
      {
        id: "analysis",
        title: "Failed-PR analysis",
        desc: "DevPilot reads the logs and the diff and explains the likely cause.",
        label: "#220 failed",
        lines: [
          { t: "failed     tests / test_tokens", tone: "ember" },
          { t: "cause      load_token returns None for new users", tone: "norm" },
          { t: "evidence   tests/test_tokens.py:18", tone: "dim" },
        ],
      },
      {
        id: "patch",
        title: "Patch generation",
        desc: "A proposed fix as a diff you can read line by line.",
        label: "tokens.py",
        lines: [
          { t: "  def get_token(user):", tone: "dim" },
          { t: "      token = load_token(user)", tone: "dim" },
          { t: "-     return token.value", tone: "ember" },
          { t: "+     return token.value if token else None", tone: "plasma" },
        ],
      },
      {
        id: "sandbox",
        title: "Sandbox verification",
        desc: "The patch is tested in isolation. Nothing from your repository runs on the host.",
        label: "Sandbox",
        lines: [
          { t: "start    isolated container", tone: "norm" },
          { t: "apply    patch", tone: "norm" },
          { t: "run      pytest -q", tone: "norm" },
          { t: "result   12 tests executed, 0 failed", tone: "plasma" },
        ],
      },
      {
        id: "pr",
        title: "PR creation with your approval",
        desc: "DevPilot opens the pull request only after you approve it. You stay the reviewer.",
        label: "Proposed pull request",
        lines: [
          { t: "branch     fix/token-none", tone: "norm" },
          { t: "change     +1 −1 in tokens.py", tone: "norm" },
          { t: "verified   in sandbox", tone: "plasma" },
          { t: "waiting for your approval", tone: "ember" },
        ],
      },
    ],
  },
];

const toneClass: Record<Tone, string> = {
  dim: "text-white/45",
  norm: "text-white/85",
  plasma: "text-[#6E94FF]",
  ember: "text-[#FF6A3D]",
};

export default function Features() {
  const [tier, setTier] = useState(0);
  const [featIdx, setFeatIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const [inView, setInView] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const current = TIERS[tier];
  const active = current.features[featIdx];
  const isTop = tier === TIERS.length - 1;

  const accent = isTop ? "#FF4D1C" : "#4F7BFF";
  const accentText = isTop ? "text-[#FF6A3D]" : "text-[#6E94FF]";
  const accentBg = isTop ? "bg-[#FF4D1C]" : "bg-[#4F7BFF]";

  /* reveal once, when the section scrolls into view */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* stream the example lines in, one at a time */
  useEffect(() => {
    if (!inView) return;

    const total = active.lines.length;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduced) {
      setShown(total);
      return;
    }

    setShown(0);
    let n = 0;

    const id = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= total) window.clearInterval(id);
    }, 160);

    return () => window.clearInterval(id);
  }, [tier, featIdx, inView, active.lines.length]);

  const pickTier = (i: number) => {
    setTier(i);
    setFeatIdx(0);
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % TIERS.length;
    else if (e.key === "ArrowLeft") next = (i + TIERS.length - 1) % TIERS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TIERS.length - 1;
    else return;

    e.preventDefault();
    pickTier(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section
      ref={sectionRef}
      id="features"
      className="w-full border-t border-white/10 bg-[#050506] text-white"
    >
      <div
        className={[
          "w-full px-6 py-20 transition-opacity duration-700 motion-reduce:transition-none sm:px-10 lg:px-16 lg:py-28 xl:px-24",
          inView ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        {/* heading */}
        <div className="max-w-2xl">
          <h2 className="intro-font-1 text-4xl font-normal leading-[1.1] tracking-tight sm:text-5xl">
            From first scan to a verified fix
          </h2>
          <p className="mt-4 text-base leading-7 text-white/60">
            Start free, add PR monitoring when you need it, and let DevPilot
            propose fixes when you are ready.
          </p>
        </div>

        {/* tier tabs */}
        <div
          role="tablist"
          aria-label="Plans"
          className="mt-12 flex gap-8 border-b border-white/10"
        >
          {TIERS.map((t, i) => {
            const on = tier === i;
            const top = i === TIERS.length - 1;

            return (
              <button
                key={t.name}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`tier-${i}`}
                aria-selected={on}
                aria-controls="feature-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => pickTier(i)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={[
                  "relative -mb-px pb-4 text-sm transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
                  on ? "text-white" : "text-white/50 hover:text-white/80",
                ].join(" ")}
              >
                {t.name}
                <span
                  aria-hidden
                  className={[
                    "absolute inset-x-0 bottom-0 h-px origin-left transition-transform duration-500 motion-reduce:transition-none",
                    top ? "bg-[#FF4D1C]" : "bg-[#4F7BFF]",
                    on ? "scale-x-100" : "scale-x-0",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>

        <div
          id="feature-panel"
          role="tabpanel"
          aria-labelledby={`tier-${tier}`}
          className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-20 xl:gap-28"
        >
          {/* left: tier summary + feature list */}
          <div>
            <h3 className="intro-font-1 text-3xl font-normal tracking-tight sm:text-4xl">
              {current.headline}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/60">
              {current.blurb}
            </p>

            <ul
              key={tier}
              aria-label={`${current.name} features`}
              className="mt-8 border-t border-white/10"
            >
              {current.features.map((f, i) => {
                const on = featIdx === i;

                return (
                  <li key={f.id} className="border-b border-white/10">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setFeatIdx(i)}
                      className="group flex w-full items-start gap-4 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
                    >
                      <span
                        aria-hidden
                        className={[
                          "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300",
                          on ? accentBg : "bg-white/25 group-hover:bg-white/50",
                        ].join(" ")}
                      />
                      <span className="min-w-0">
                        <span
                          className={[
                            "block text-[15px] leading-6 transition-colors duration-300",
                            on
                              ? "text-white"
                              : "text-white/55 group-hover:text-white/85",
                          ].join(" ")}
                        >
                          {f.title}
                        </span>

                        {on && (
                          <span className="mt-1 block max-w-md text-sm leading-6 text-white/60">
                            {f.desc}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* right: example output */}
          <div className="self-start lg:sticky lg:top-24">
            <div
              className="overflow-hidden rounded-lg border bg-white/[0.02]"
              style={{ borderColor: `${accent}40` }}
            >
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-xs">
                <span className="truncate font-mono text-white/85">
                  {active.label}
                </span>
                <span className="shrink-0 text-white/40">Example</span>
              </div>

              <div
                aria-label={`Example output for ${active.title}`}
                role="img"
                className="min-h-[10rem] overflow-x-auto px-4 py-5 font-mono text-[12.5px] leading-7"
              >
                {active.lines.map((l, i) => (
                  <div
                    key={`${active.id}-${i}`}
                    aria-hidden
                    className={[
                      "whitespace-pre transition-all duration-500 ease-out motion-reduce:transition-none",
                      toneClass[l.tone ?? "norm"],
                      i < shown
                        ? "translate-x-0 opacity-100"
                        : "-translate-x-2 opacity-0",
                    ].join(" ")}
                  >
                    {l.t}
                    {i === shown - 1 && shown < active.lines.length && (
                      <span
                        className={[
                          "ml-1 inline-block h-3.5 w-1.5 animate-pulse align-middle motion-reduce:animate-none",
                          accentBg,
                        ].join(" ")}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className={["mt-4 text-sm", accentText].join(" ")}>
              {active.title}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}