import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";

// One proxy for the backend routes the browser may call. It adds the internal key and the
// verified user id; the backend still checks that the user owns the repo.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const API_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const KEY = process.env.INTERNAL_API_KEY ?? "";

// Only these prefixes, and only plain path segments (no dots, so no "..").
const ROOTS = new Set(["repos", "quality"]);
const SEGMENT = /^[A-Za-z0-9_-]+$/;

type Ctx = { params: Promise<{ path: string[] }> | { path: string[] } };

async function forward(req: Request, ctx: Ctx, method: "GET" | "POST") {
    const { path } = await ctx.params;
    const segments = Array.isArray(path) ? path : [];
    if (segments.length < 2 || !ROOTS.has(segments[0]) || !segments.every((s) => SEGMENT.test(s))) {
        // If this prints [], the folder is named [path] instead of [...path].
        console.warn("[backend proxy] rejected path:", JSON.stringify(path));
        return NextResponse.json({ detail: "Not found." }, { status: 404 });
    }
    const joined = segments.join("/");

    const userId = await getUserId();
    if (!userId) return NextResponse.json({ detail: "Not signed in." }, { status: 401 });
    if (!KEY) return NextResponse.json({ detail: "INTERNAL_API_KEY is not set." }, { status: 500 });

    try {
        const res = await fetch(`${API_URL}/${joined}`, {
            method,
            cache: "no-store",
            headers: {
                "x-internal-key": KEY,
                "x-user-id": userId,
                ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
            },
            body: method === "POST" ? await req.text() : undefined,
            signal: AbortSignal.timeout(280_000),
        });
        const data = await res.json().catch(() => null);
        return NextResponse.json(data ?? { detail: "Empty response." }, { status: res.status });
    } catch {
        return NextResponse.json({ detail: `Cannot reach the service at ${API_URL}.` }, { status: 502 });
    }
}

export const GET = (req: Request, ctx: Ctx) => forward(req, ctx, "GET");
export const POST = (req: Request, ctx: Ctx) => forward(req, ctx, "POST");