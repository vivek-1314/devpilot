import { NextResponse } from "next/server";
import { getUserId } from "../../../../lib/session";

// Scans clone repos, so they can be slow. Raise this if your host allows it.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const TOOLS = new Set(["ruff", "bandit", "gitleaks", "eslint"]);

type Ctx = { params: Promise<{ tool: string }> | { tool: string } };

export async function POST(req: Request, ctx: Ctx) {
    const { tool } = await ctx.params;
    if (!TOOLS.has(tool)) {
        return NextResponse.json({ detail: "Unknown check." }, { status: 404 });
    }

    // The user id comes from the verified session, never from the request body.
    const userId = await getUserId();
    if (!userId) {
        return NextResponse.json({ detail: "Not signed in." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const repoId = body?.repo_id;
    const ref = body?.ref;
    if (!Number.isInteger(repoId) || (ref !== undefined && ref !== null && typeof ref !== "string")) {
        return NextResponse.json({ detail: "repo_id (integer) is required." }, { status: 422 });
    }

    // after
    const backend = process.env.CODE_INTEL_API_URL ?? "http://127.0.0.1:8000";
    const key = process.env.INTERNAL_API_KEY;
    if (!key) {
        return NextResponse.json({ detail: "INTERNAL_API_KEY is not set." }, { status: 500 });
    }

    try {
        const res = await fetch(`${backend}/quality/${tool}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-key": key,
                "x-user-id": userId,
            },
            body: JSON.stringify({ repo_id: repoId, ...(ref ? { ref } : {}) }),
            cache: "no-store",
            signal: AbortSignal.timeout(280_000),
        });

        const data = await res.json().catch(() => null);
        return NextResponse.json(data ?? { detail: "Empty response from scanner." }, { status: res.status });
    } catch {
        return NextResponse.json({ detail: "Scanner did not respond in time." }, { status: 504 });
    }
}