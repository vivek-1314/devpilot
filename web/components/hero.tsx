"use client";

/**
 * DevPilot Hero
 * Usage: <Hero />
 * Palette: ink #050506 · ember #FF4D1C · plasma #4F7BFF
 * Fonts: the headline uses the `intro-font-1` class from your @font-face CSS.
 * Swap it for `intro-font-2` or `intro-font-3` to try another face.
 */

import { useEffect, useState } from "react";
import { connectGitHub } from "@/lib/connect";

type LineKind = "ctx" | "del" | "add";

interface DiffLine {
  n: number;
  kind: LineKind;
  text: string;
}

const DIFF: DiffLine[] = [
  { n: 1, kind: "ctx", text: "def get_token(user):" },
  { n: 2, kind: "ctx", text: "    token = load_token(user)" },
  { n: 3, kind: "del", text: '    log.info("token %s", token)' },
  { n: 4, kind: "add", text: '    log.info("token for %s", user.login)' },
  { n: 5, kind: "ctx", text: "    return token" },
];

const CHECKS = [
  { tool: "Ruff", scope: "style and lint" },
  { tool: "Bandit", scope: "Python security" },
  { tool: "Gitleaks", scope: "secrets" },
];

export default function Hero() {
  const [mounted, setMounted] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const a = window.setTimeout(() => setMounted(true), 60);
    const b = window.setTimeout(() => setResolved(true), reduced ? 100 : 1800);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, []);

  const fade = (delay: number) => ({
    className: [
      "transition-all duration-700 ease-out motion-reduce:transition-none",
      mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
    ].join(" "),
    style: { transitionDelay: `${delay}ms` },
  });

  const lineClass = (kind: LineKind) => {
    if (kind === "del")
      return resolved
        ? "bg-[#FF4D1C]/10 text-white/40 line-through decoration-[#FF4D1C]/60"
        : "bg-[#FF4D1C]/15 text-white";
    if (kind === "add") return resolved ? "bg-[#4F7BFF]/20 text-white" : "text-white/25";
    return "text-white/55";
  };

  const marker = (kind: LineKind) => (kind === "del" ? "−" : kind === "add" ? "+" : " ");

  const left = fade(0);
  const right = fade(250);

  return (
    <section className="relative flex min-h-svh w-full items-center bg-[#050506] pt-16 text-white">
      <div className="grid w-full items-center gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20 lg:px-16 lg:py-24 xl:gap-28 xl:px-24">
        {/* message */}
        <div {...left} className={left.className}>
          <h1 className="intro-font-1 text-5xl font-normal leading-[1.05] tracking-tight sm:text-6xl xl:text-7xl">
            Review every pull request before it merges.
          </h1>

          <p className="mt-6 max-w-md text-base leading-7 text-white/60">
            DevPilot reads your GitHub repositories and reports on code quality and security in
            each pull request. Nothing from your repository runs outside a sandbox.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <button
                type="button"
                onClick={connectGitHub}
                className="inline-flex items-center rounded-md bg-[#FF4D1C] px-5 py-3 text-sm font-medium text-white transition-colors duration-300 hover:bg-[#ff6238] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                Connect GitHub
            </button>
            <a
              href="#how-it-works"
              className="inline-flex items-center rounded-md border border-white/15 px-5 py-3 text-sm text-white/75 transition-colors duration-300 hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              How it works
            </a>
          </div>
        </div>

        {/* example pull request */}
        <div {...right} className={right.className}>
          <div
            className="overflow-hidden rounded-lg border bg-white/[0.02] transition-colors duration-700"
            style={{ borderColor: resolved ? "rgba(79,123,255,0.25)" : "rgba(255,77,28,0.3)" }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-xs">
              <span className="truncate font-mono text-white/85">
                auth/tokens.py <span className="text-white/35">· fix/token-logging</span>
              </span>
              <span className="shrink-0 text-white/40">Example</span>
            </div>

            {/* diff */}
            <div className="overflow-x-auto py-3 font-mono text-[12.5px] leading-7">
              {DIFF.map((l) => (
                <div
                  key={l.n}
                  className={[
                    "flex items-center transition-colors duration-700 motion-reduce:transition-none",
                    lineClass(l.kind),
                  ].join(" ")}
                >
                  <span className="w-10 shrink-0 select-none text-right text-white/25">{l.n}</span>
                  <span
                    aria-hidden
                    className={[
                      "w-6 shrink-0 select-none text-center",
                      l.kind === "del" ? "text-[#FF6A3D]" : "text-[#6E94FF]",
                    ].join(" ")}
                  >
                    {marker(l.kind)}
                  </span>
                  <span className="whitespace-pre pr-4">{l.text}</span>
                </div>
              ))}
            </div>

            {/* finding, then resolution */}
            <div className="border-t border-white/10 px-4 py-3 text-sm" aria-live="polite">
              {resolved ? (
                <p className="text-[#6E94FF]">
                  Fixed <span className="text-white/60">· logs the login, not the token</span>
                </p>
              ) : (
                <p className="text-[#FF6A3D]">
                  Finding <span className="text-white/60">· line 3 writes a token to the logs</span>
                </p>
              )}
            </div>

            {/* checks */}
            <ul className="border-t border-white/10">
              {CHECKS.map((c) => (
                <li
                  key={c.tool}
                  className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 font-mono text-xs last:border-b-0"
                >
                  <span className="text-white/85">
                    {c.tool} <span className="text-white/40">{c.scope}</span>
                  </span>
                  <span className="flex items-center gap-2 text-white/60">
                    <span
                      aria-hidden
                      className={[
                        "h-1.5 w-1.5 rounded-full transition-colors duration-700 motion-reduce:transition-none",
                        resolved
                          ? "bg-[#4F7BFF]"
                          : "animate-pulse bg-white/30 motion-reduce:animate-none",
                      ].join(" ")}
                    />
                    {resolved ? "No issues found" : "Scanning"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}