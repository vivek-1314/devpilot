"use client";

/**
 * DevPilot Problem section
 * Usage: <Problem />  (place under <Hero />)
 * Palette: ink #050506 · ember #FF4D1C · plasma #4F7BFF
 * Fonts: the heading uses the `intro-font-1` class from your @font-face CSS.
 * Merge four pull requests by hand, see what each one hid,
 * then switch DevPilot on and replay the same four.
 */

import { useEffect, useRef, useState } from "react";

type Mode = "manual" | "pilot";
type Phase = "idle" | "scan" | "done";

interface CodeLine {
    text: string;
    hot?: boolean;
}

interface PullRequest {
    id: number;
    title: string;
    file: string;
    lines: CodeLine[];
    consequence: string;
    check: string;
}

const PRS: PullRequest[] = [
    {
        id: 214,
        title: "Log token for debugging",
        file: "auth/tokens.py",
        lines: [
            { text: "token = load_token(user)" },
            { text: 'log.info("token %s", token)', hot: true },
        ],
        consequence: "A token is written to the logs, where anyone with log access can read it.",
        check: "Gitleaks",
    },
    {
        id: 215,
        title: "Add repository importer",
        file: "repos/importer.py",
        lines: [
            { text: "clone_dir = clone(url)" },
            { text: 'subprocess.run(["make", "test"], cwd=clone_dir)', hot: true },
        ],
        consequence: "Code from a cloned repository runs on the host instead of in a sandbox.",
        check: "Bandit",
    },
    {
        id: 216,
        title: "Fix flaky tests",
        file: ".github/workflows/ci.yml",
        lines: [
            { text: "run: |" },
            { text: "  pytest -q || true", hot: true },
        ],
        consequence: "The step always passes, so a green check proves nothing about the tests.",
        check: "Workflow check",
    },
    {
        id: 217,
        title: "Add analyze endpoint",
        file: "routes/analyze.py",
        lines: [
            { text: '@router.post("/analyze")' },
            { text: "def analyze(repo: str, user=Depends(current_user)):", hot: true },
        ],
        consequence: "There is no per-user limit, so one user can use up the shared quota.",
        check: "Usage limits",
    },
];

const N = PRS.length;
const blank = <T,>(v: T): T[] => Array.from({ length: N }, () => v);
const setAt = <T,>(arr: T[], i: number, v: T): T[] => arr.map((x, k) => (k === i ? v : x));

export default function Problem() {
    const [mode, setMode] = useState<Mode>("manual");
    const [merged, setMerged] = useState<boolean[]>(blank(false));
    const [revealed, setRevealed] = useState<boolean[]>(blank(false));
    const [phase, setPhase] = useState<Phase[]>(blank<Phase>("idle"));
    const [sentBack, setSentBack] = useState<boolean[]>(blank(false));
    const [inView, setInView] = useState(false);

    const sectionRef = useRef<HTMLElement>(null);
    const timers = useRef<number[]>([]);
    const reducedRef = useRef(false);

    const later = (fn: () => void, ms: number) => {
        timers.current.push(window.setTimeout(fn, ms));
    };
    const clearTimers = () => {
        timers.current.forEach((t) => window.clearTimeout(t));
        timers.current = [];
    };

    useEffect(() => {
        reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
        return () => {
            io.disconnect();
            clearTimers();
        };
    }, []);

    const reset = () => {
        clearTimers();
        setMerged(blank(false));
        setRevealed(blank(false));
        setPhase(blank<Phase>("idle"));
        setSentBack(blank(false));
    };

    const switchMode = (next: Mode) => {
        reset();
        setMode(next);
        if (next === "pilot") {
            const fast = reducedRef.current;
            for (let i = 0; i < N; i++) {
                const t = (fast ? 100 : 500) + i * (fast ? 150 : 900);
                later(() => setPhase((p) => setAt(p, i, "scan")), t);
                later(() => setPhase((p) => setAt(p, i, "done")), t + (fast ? 50 : 650));
            }
        }
    };

    const merge = (i: number) => {
        if (merged[i]) return;
        setMerged((m) => setAt(m, i, true));
        later(() => setRevealed((r) => setAt(r, i, true)), reducedRef.current ? 50 : 550);
    };

    const count =
        mode === "manual" ? revealed.filter(Boolean).length : phase.filter((p) => p === "done").length;
    const allDone = count === N;
    const manual = mode === "manual";

    const enter = (delay: number, extra = "") => ({
        className: [
            "transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
            extra,
        ].join(" "),
        style: { transitionDelay: `${delay}ms` },
    });

    return (
        <section ref={sectionRef} id="problem" className="relative w-full bg-[#050506] text-white">
            <div className="grid w-full gap-12 px-6 py-20 sm:px-10 sm:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20 lg:px-16 xl:gap-28 xl:px-24">
                {/* left: statement and controls */}
                <div>
                    <div className="lg:sticky lg:top-28">
                        <h2
                            {...enter(
                                0,
                                "intro-font-1 text-4xl font-normal leading-[1.1] tracking-tight text-white sm:text-5xl"
                            )}
                        >
                            Every pull request looks routine until it reaches main.
                        </h2>

                        <p
                            {...enter(150, "mt-5 max-w-sm text-sm leading-6 text-white/60")}
                        >
                            Merge these four the way a busy reviewer would. Then switch DevPilot on.
                        </p>

                        <div {...enter(300, "mt-8")}>
                            {/* mode switch */}
                            <div
                                role="group"
                                aria-label="Review mode"
                                className="relative inline-grid grid-cols-2 border border-white/15 p-0.5 font-mono text-xs"
                            >
                                <span
                                    aria-hidden
                                    className={[
                                        "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] transition-all duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] motion-reduce:transition-none",
                                        manual
                                            ? "translate-x-0 bg-white/10"
                                            : "translate-x-full bg-[#4F7BFF] shadow-[0_0_20px_rgba(79,123,255,0.5)]",
                                    ].join(" ")}
                                />
                                {(
                                    [
                                        ["manual", "By hand"],
                                        ["pilot", "With DevPilot"],
                                    ] as const
                                ).map(([m, label]) => (
                                    <button
                                        key={m}
                                        type="button"
                                        aria-pressed={mode === m}
                                        onClick={() => mode !== m && switchMode(m)}
                                        className={[
                                            "relative px-5 py-2.5 transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                                            mode === m ? "text-white" : "text-white/40 hover:text-white/70",
                                        ].join(" ")}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* counter */}
                            <p aria-live="polite" className="mt-6 font-mono text-xs text-white/60">
                                <span className={manual ? "text-[#FF4D1C]" : "text-[#4F7BFF]"}>
                                    {count} of {N}
                                </span>{" "}
                                {manual ? "problems reached main" : "caught before merge"}
                            </p>

                            <div className="mt-4 flex h-10 items-center gap-4">
                                {manual && allDone && (
                                    <button
                                        type="button"
                                        onClick={() => switchMode("pilot")}
                                        className="bg-[#FF4D1C] px-4 py-2.5 font-mono text-xs text-white shadow-[0_0_28px_rgba(255,77,28,0.35)] transition-shadow duration-300 hover:shadow-[0_0_40px_rgba(255,77,28,0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                    >
                                        Replay with DevPilot
                                    </button>
                                )}
                                {count > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => switchMode(mode)}
                                        className="font-mono text-xs text-white/40 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                    >
                                        Start over
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* right: pull requests */}
                <ul className="border border-white/10 bg-[#0a0a0c]">
                    {PRS.map((pr, i) => {
                        const open = manual ? revealed[i] : phase[i] === "done";
                        const ph = phase[i];
                        const tone = manual ? "bg-[#FF4D1C]" : "bg-[#4F7BFF]";

                        return (
                            <li
                                key={pr.id}
                                {...enter(250 + i * 100, "relative overflow-hidden border-b border-white/10 last:border-b-0")}
                            >
                                {/* status bar */}
                                <span
                                    aria-hidden
                                    className={[
                                        "absolute inset-y-0 left-0 w-[2px] origin-top transition-transform duration-700 motion-reduce:transition-none",
                                        tone,
                                        open ? "scale-y-100" : "scale-y-0",
                                    ].join(" ")}
                                />

                                {/* scan sweep */}
                                {!manual && (
                                    <span
                                        aria-hidden
                                        className={[
                                            "pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#4F7BFF]/25 to-transparent transition-[transform,opacity] duration-[650ms] ease-linear motion-reduce:transition-none",
                                            ph === "idle" && "-translate-x-full opacity-0",
                                            ph === "scan" && "translate-x-[300%] opacity-100",
                                            ph === "done" && "translate-x-[300%] opacity-0",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    />
                                )}

                                <div className="relative flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-white">
                                            <span className="mr-2 font-mono text-[11px] text-white/30">#{pr.id}</span>
                                            {pr.title}
                                        </p>
                                        <p className="mt-0.5 truncate font-mono text-[11px] text-white/40">{pr.file}</p>
                                    </div>

                                    <div className="shrink-0 font-mono text-xs">
                                        {manual &&
                                            (merged[i] ? (
                                                <span className="inline-flex items-center gap-2 text-white/60">
                                                    <span aria-hidden className="h-1.5 w-1.5 bg-[#FF4D1C]" />
                                                    Merged
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => merge(i)}
                                                    className="border border-white/15 px-4 py-1.5 text-white/80 transition-all duration-300 hover:border-[#FF4D1C] hover:bg-[#FF4D1C] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                                >
                                                    Merge
                                                </button>
                                            ))}

                                        {!manual && ph === "idle" && <span className="text-white/30">Waiting</span>}

                                        {!manual && ph === "scan" && (
                                            <span className="inline-flex items-center gap-2 text-white/60">
                                                <span
                                                    aria-hidden
                                                    className="h-1.5 w-1.5 animate-pulse bg-[#4F7BFF] motion-reduce:animate-none"
                                                />
                                                Scanning
                                            </span>
                                        )}

                                        {!manual && ph === "done" && (
                                            <span className="inline-flex items-center gap-2 text-white/70">
                                                <span aria-hidden className="h-1.5 w-1.5 bg-[#4F7BFF]" />
                                                Flagged
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* finding */}
                                <div
                                    className={[
                                        "grid transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                                        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                                    ].join(" ")}
                                >
                                    <div className="min-h-0 overflow-hidden">
                                        <div className="px-5 pb-5 sm:px-6">
                                            <pre className="overflow-x-auto border border-white/10 bg-white/[0.02] py-2 font-mono text-[12px] leading-6">
                                                {pr.lines.map((l, k) => (
                                                    <span
                                                        key={k}
                                                        className={[
                                                            "block whitespace-pre px-4",
                                                            l.hot
                                                                ? manual
                                                                    ? "bg-[#FF4D1C]/15 text-white"
                                                                    : "bg-[#4F7BFF]/20 text-white"
                                                                : "text-white/40",
                                                        ].join(" ")}
                                                    >
                                                        {l.text}
                                                    </span>
                                                ))}
                                            </pre>

                                            <p className="mt-3 text-sm leading-6 text-white/70">{pr.consequence}</p>
                                            <p
                                                className={[
                                                    "mt-1.5 font-mono text-[11px]",
                                                    manual ? "text-[#FF4D1C]" : "text-[#4F7BFF]",
                                                ].join(" ")}
                                            >
                                                {manual ? "Found after merge" : `Flagged by ${pr.check} before merge`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}