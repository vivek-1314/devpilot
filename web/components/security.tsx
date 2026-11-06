"use client";

/**
 * DevPilot Security section (diagonal scroll collage)
 * Usage: <Security />  (place under <HowItWorks />)
 * Palette: ink #050506 · ember #FF4D1C · plasma #4F7BFF
 * Styling is Tailwind only. Scrolling pans a large collage canvas from the top-left
 * to the bottom-right. Tiles nearest the centre come forward; the rest recede.
 * With reduced motion the collage becomes a plain grid.
 */

import { useEffect, useRef, useState } from "react";

type Variant = "plain" | "ember" | "dots" | "ghost";

interface Tile {
    id: string;
    hud: string;
    title: string;
    body: string;
    variant: Variant;
    x: number;
    y: number;
    w: string;
    depth: number;
}

const TILES: Tile[] = [
    {
        id: "head",
        hud: "Security",
        title: "",
        body: "These rules shape how DevPilot is built.",
        variant: "ghost",
        x: 3,
        y: 5,
        w: "w-[min(36rem,88vw)]",
        depth: 0,
    },
    {
        id: "static",
        hud: "Scanned, never executed",
        title: "Scanned, never executed",
        body: "Ruff, Bandit and Gitleaks read your code as text. Scanning never runs it.",
        variant: "plain",
        x: 31,
        y: 9,
        w: "w-[min(20rem,78vw)]",
        depth: 1,
    },
    {
        id: "sandbox",
        hud: "Sandbox",
        title: "Anything that runs, runs in a sandbox",
        body: "Untrusted repository code never runs on the host. Docker first, hardened later.",
        variant: "dots",
        x: 11,
        y: 34,
        w: "w-[min(24rem,80vw)]",
        depth: -1,
    },
    {
        id: "secrets",
        hud: "Secrets",
        title: "Secrets stay out of logs",
        body: "Tokens and credentials are treated as sensitive and are never exposed or logged.",
        variant: "plain",
        x: 45,
        y: 26,
        w: "w-[min(21rem,78vw)]",
        depth: 1,
    },
    {
        id: "wording",
        hud: "Careful wording",
        title: "Careful wording",
        body: "Results say what the checks found, nothing more. Never “safe”, never “secure”.",
        variant: "plain",
        x: 27,
        y: 52,
        w: "w-[min(20rem,78vw)]",
        depth: -1,
    },
    {
        id: "tests",
        hud: "Tests",
        title: "Tests count only if they ran",
        body: "DevPilot never says tests passed unless they were executed.",
        variant: "dots",
        x: 62,
        y: 41,
        w: "w-[min(22rem,80vw)]",
        depth: 1,
    },
    {
        id: "approve",
        hud: "Human approval",
        title: "You approve every fix",
        body: "A patch becomes a pull request only after a person approves it.",
        variant: "ember",
        x: 43,
        y: 68,
        w: "w-[min(22rem,80vw)]",
        depth: -1,
    },
    {
        id: "limits",
        hud: "Usage limits",
        title: "Usage limits per user",
        body: "Limits are part of the design, so one user can't use up shared capacity.",
        variant: "plain",
        x: 79,
        y: 58,
        w: "w-[min(20rem,78vw)]",
        depth: 1,
    },
    {
        id: "github",
        hud: "GitHub access",
        title: "Access through GitHub",
        body: "Sign in with GitHub. Repository access and webhooks go through a GitHub App.",
        variant: "plain",
        x: 63,
        y: 82,
        w: "w-[min(22rem,80vw)]",
        depth: -1,
    },
];

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function Visual({ id }: { id: string }) {
    switch (id) {
        case "static":
            return (
                <div className="font-mono text-[12px] leading-6">
                    <p className="text-white/80">ruff <span className="text-white/35">   reads files</span></p>
                    <p className="text-white/80">bandit <span className="text-white/35"> reads files</span></p>
                    <p className="text-white/80">gitleaks <span className="text-white/35">reads files</span></p>
                    <p className="text-white/35 line-through decoration-[#FF4D1C]/70">runs your code</p>
                </div>
            );
        case "sandbox":
            return (
                <div>
                    <div className="border border-dashed border-[#4F7BFF]/60 p-3 font-mono text-[12px]">
                        <p className="text-[11px] text-[#4F7BFF]">sandbox</p>
                        <p className="text-white/80">pytest -q</p>
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-white/35">host: nothing runs here</p>
                </div>
            );
        case "secrets":
            return (
                <p className="break-all font-mono text-[12px] leading-6 text-white/50">
                    auth ok user=octocat token=
                    <span className="mx-1 inline-block h-3 w-24 translate-y-0.5 bg-white/20" />
                </p>
            );
        case "wording":
            return (
                <div className="font-mono text-[12px] leading-6">
                    <p className="text-white/35 line-through decoration-[#FF4D1C]/70">Safe</p>
                    <p className="text-white/35 line-through decoration-[#FF4D1C]/70">Secure</p>
                    <p className="text-[#4F7BFF]">No issues found by these checks</p>
                </div>
            );
        case "tests":
            return (
                <div className="font-mono text-[12px] leading-6">
                    <p className="text-[#4F7BFF]">pytest -q   executed   12 run, 0 failed</p>
                    <p className="text-white/35">pytest -q   not run    nothing claimed</p>
                </div>
            );
        case "approve":
            return (
                <span className="inline-block bg-[#050506] px-3 py-1.5 font-mono text-[11px] text-white">
                    Approve and open pull request
                </span>
            );
        case "limits":
            return (
                <div>
                    <div className="flex gap-1" aria-hidden>
                        {Array.from({ length: 10 }, (_, i) => (
                            <span key={i} className={cx("h-1.5 flex-1", i < 7 ? "bg-[#4F7BFF]" : "bg-white/10")} />
                        ))}
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-white/35">per-user limit</p>
                </div>
            );
        case "github":
            return (
                <div className="font-mono text-[12px] leading-6">
                    <p className="text-white/80">sign in <span className="text-white/35">      GitHub login</span></p>
                    <p className="text-white/80">repo access <span className="text-white/35">  GitHub App</span></p>
                    <p className="text-white/80">events <span className="text-white/35">       webhooks</span></p>
                </div>
            );
        default:
            return null;
    }
}

function TileBody({ tile }: { tile: Tile }) {
    if (tile.id === "head") {
        return (
            <div className="p-2">
                <h2 className="font-serif text-4xl font-light leading-[1.06] tracking-tight text-white/70 sm:text-5xl xl:text-6xl">
                    Your repository is
                    <br />
                    <span className="font-sans text-[0.78em] font-semibold uppercase tracking-[0.06em] text-white">
                        read, not run
                    </span>
                    <br />
                    outside a sandbox.
                </h2>
                <p className="mt-6 max-w-sm font-mono text-[13px] leading-6 text-white/60">{tile.body}</p>
            </div>
        );
    }
    const ember = tile.variant === "ember";
    return (
        <div
            className={cx(
                "flex h-full flex-col gap-4 p-5",
                tile.variant === "plain" && "border border-white/10 bg-[#0a0a0c]",
                tile.variant === "dots" &&
                "border border-white/10 bg-[#0a0a0c] [background-image:radial-gradient(rgba(79,123,255,0.22)_1px,transparent_1px)] [background-size:12px_12px]",
                ember && "bg-[#FF4D1C] text-white shadow-[0_0_60px_rgba(255,77,28,0.35)]"
            )}
        >
            <Visual id={tile.id} />
            <div className="mt-auto">
                <h3 className="text-base font-medium text-white">{tile.title}</h3>
                <p className={cx("mt-2 text-sm leading-6", ember ? "text-white/90" : "text-white/60")}>{tile.body}</p>
            </div>
        </div>
    );
}

export default function Security() {
    const [reduced, setReduced] = useState<boolean | null>(null);
    const [active, setActive] = useState(0);

    const sectionRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const beamRef = useRef<HTMLDivElement>(null);
    const outerRefs = useRef<(HTMLDivElement | null)[]>([]);
    const innerRefs = useRef<(HTMLDivElement | null)[]>([]);
    const activeRef = useRef(0);

    useEffect(() => {
        setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }, []);

    useEffect(() => {
        if (reduced !== false) return;
        const section = sectionRef.current;
        const canvas = canvasRef.current;
        const beam = beamRef.current;
        if (!section || !canvas || !beam) return;

        let raf = 0;
        let cur = 0;
        let visible = false;

        const io = new IntersectionObserver(
            ([e]) => {
                visible = e.isIntersecting;
            },
            { rootMargin: "20% 0px" }
        );
        io.observe(section);

        const tick = () => {
            raf = requestAnimationFrame(tick);
            if (!visible) return;

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const rect = section.getBoundingClientRect();
            const total = Math.max(1, rect.height - vh);
            const target = clamp(-rect.top / total, 0, 1);
            cur += (target - cur) * 0.12;
            if (Math.abs(target - cur) < 0.0004) cur = target;

            const cw = canvas.offsetWidth;
            const ch = canvas.offsetHeight;
            canvas.style.transform = `translate3d(${-cur * (cw - vw)}px, ${-cur * (ch - vh)}px, 0)`;

            beam.style.width = `${Math.hypot(cw, ch)}px`;
            beam.style.transform = `rotate(${Math.atan2(ch, cw)}rad) scaleX(${cur})`;

            const diag = Math.hypot(vw, vh);
            let best = 0;
            let bestD = Infinity;
            TILES.forEach((tile, i) => {
                const outer = outerRefs.current[i];
                const inner = innerRefs.current[i];
                if (!outer || !inner) return;
                const r = outer.getBoundingClientRect();
                const d = Math.hypot(r.left + r.width / 2 - vw / 2, r.top + r.height / 2 - vh / 2) / diag;
                const f = clamp(d / 0.55, 0, 1);
                const px = (cur - 0.5) * tile.depth * 140;
                inner.style.transform = `translate3d(${px}px, ${px * 0.6}px, 0) scale(${1 - 0.1 * f})`;
                inner.style.opacity = String(1 - 0.6 * f);
                if (d < bestD) {
                    bestD = d;
                    best = i;
                }
            });
            if (best !== activeRef.current) {
                activeRef.current = best;
                setActive(best);
            }
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            io.disconnect();
        };
    }, [reduced]);

    /* reduced motion: a plain grid, no scroll-linked movement */
    if (reduced) {
        return (
            <section id="security" className="relative border-t border-white/10 bg-[#050506] text-white">
                <div className="mx-auto max-w-7xl border-x border-white/10 p-6 sm:p-10">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {TILES.map((t) => (
                            <div key={t.id} className={t.id === "head" ? "sm:col-span-2 lg:col-span-3" : ""}>
                                <TileBody tile={t} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section
            ref={sectionRef}
            id="security"
            className="relative border-t border-white/10 bg-[#050506] text-white"
            style={{ height: "450svh" }}
        >
            <div className="sticky top-0 overflow-hidden" style={{ height: "100svh" }}>
                {/* collage canvas */}
                <div
                    ref={canvasRef}
                    className="absolute left-0 top-0 will-change-transform [background-image:radial-gradient(rgba(79,123,255,0.2)_1px,transparent_1px)] [background-size:28px_28px]"
                    style={{ width: "max(220vw, 1800px)", height: "max(220svh, 1400px)" }}
                >
                    {/* diagonal track and beam */}
                    <div
                        aria-hidden
                        className="absolute left-0 top-0 h-px origin-left bg-white/10"
                        style={{
                            width: "100%",
                            transform: "rotate(var(--a, 0.6rad))",
                            display: "none",
                        }}
                    />
                    <div
                        ref={beamRef}
                        aria-hidden
                        className="absolute left-0 top-0 h-px origin-top-left bg-[#FF4D1C] shadow-[0_0_14px_3px_rgba(255,77,28,0.8)]"
                        style={{ width: 0, transform: "rotate(0.6rad) scaleX(0)" }}
                    />

                    {TILES.map((t, i) => (
                        <div
                            key={t.id}
                            ref={(el) => {
                                outerRefs.current[i] = el;
                            }}
                            className={cx("absolute", t.w)}
                            style={{ left: `${t.x}%`, top: `${t.y}%` }}
                        >
                            <div
                                ref={(el) => {
                                    innerRefs.current[i] = el;
                                }}
                                className="will-change-transform"
                            >
                                <TileBody tile={t} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* edge fade */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,#050506_100%)]" />

                {/* HUD */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 sm:p-10">
                    <div className="flex items-center gap-3 font-mono text-[11px] text-white/40">
                        <span className="flex gap-1" aria-hidden>
                            {TILES.map((t, i) => (
                                <span
                                    key={t.id}
                                    className={cx(
                                        "h-[3px] w-4 transition-all duration-500",
                                        i === active ? "bg-[#FF4D1C] shadow-[0_0_10px_rgba(255,77,28,0.9)]" : "bg-white/15"
                                    )}
                                />
                            ))}
                        </span>
                        <span>Scroll to move across</span>
                    </div>
                    <span className="font-mono text-[11px] text-white/70" aria-live="polite">
                        {TILES[active].hud}
                    </span>
                </div>
            </div>
        </section>
    );
}