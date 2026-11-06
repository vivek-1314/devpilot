"use client";

/**
 * DevPilot Footer
 * Usage: <Footer />  (place under <Security />)
 * Palette: ink #050506 · ember #FF4D1C · plasma #4F7BFF
 * Fonts: the headline and wordmark use the `intro-font-1` class from your @font-face CSS.
 * Section links use the ids of the sections already on the page.
 */

import { useEffect, useState } from "react";

const NAV = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Problem", href: "#problem" },
    { label: "Security", href: "#security" },
];

export default function Footer() {
    const [year, setYear] = useState<number | null>(null);

    useEffect(() => {
        setYear(new Date().getFullYear());
    }, []);

    return (
        <footer className="w-full border-t border-white/10 bg-[#050506] text-white">
            <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24">
                {/* call to action */}
                <div className="grid gap-8 py-16 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:py-24">
                    <h2 className="intro-font-1 text-4xl font-normal leading-[1.1] tracking-tight sm:text-5xl xl:text-6xl">
                        Find the problem. You approve the fix.
                    </h2>

                    <div className="lg:justify-self-end">
                        <p className="max-w-sm text-base leading-7 text-white/60">
                            Sign in with GitHub and point DevPilot at a repository. Nothing changes until you say so.
                        </p>
                        <a
                            href="#start"
                            className="mt-6 inline-flex items-center rounded-md bg-[#FF4D1C] px-5 py-3 text-sm font-medium text-white transition-colors duration-300 hover:bg-[#ff6238] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                            Sign in with GitHub
                        </a>
                    </div>
                </div>

                {/* bottom row */}
                <div className="flex flex-col gap-6 border-t border-white/10 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <a
                        href="#"
                        aria-label="DevPilot, back to top"
                        className="intro-font-1 text-xl font-normal leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4F7BFF]"
                    >
                        <span className="text-white/60">Dev</span>
                        <span className="text-white">Pilot</span>
                    </a>

                    <nav aria-label="Footer">
                        <ul className="flex flex-wrap gap-x-6 gap-y-2">
                            {NAV.map((n) => (
                                <li key={n.href}>
                                    <a
                                        href={n.href}
                                        className="text-white/60 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4F7BFF]"
                                    >
                                        {n.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <span className="text-white/40">© {year ?? ""} DevPilot</span>
                </div>
            </div>
        </footer>
    );
}