import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const API_URL = process.env.CODE_INTEL_API_URL ?? "http://127.0.0.1:8000";
const KEY = process.env.INTERNAL_API_KEY ?? "";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function requireRepo(repo: string | null) {
  if (!repo || !/^\d+$/.test(repo)) throw new HttpError(400, "Missing or invalid repo id.");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new HttpError(401, "Sign in to continue.");
  const { data, error } = await supabase.from("repositories").select("id").eq("id", repo).maybeSingle();
  if (error) {
    console.error("[code-intelligence] repository lookup failed:", error.message);
    throw new HttpError(500, `Repository lookup failed: ${error.message}`);
  }
  if (!data) {
    console.error(`[code-intelligence] repo ${repo} is not visible to user ${auth.user.id}`);
    throw new HttpError(404, "Repository not found.");
  }
  return { repo, userId: auth.user.id };;
}

async function service(path: string, method: "GET" | "POST", userId: string) {
  if (!KEY) throw new HttpError(500, "INTERNAL_API_KEY is not set in web/.env.local.");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      cache: "no-store",
      headers: { "x-internal-key": KEY, "x-user-id": userId },
    });
  } catch {
    throw new HttpError(502, `Cannot reach the code intelligence service at ${API_URL}. Is it running?`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new HttpError(502, "Service rejected the request. Check INTERNAL_API_KEY in both .env files and that the user id is sent.");
    throw new HttpError(res.status, typeof body?.detail === "string" ? body.detail : "The code intelligence service failed.");
  }
  return body;
}

async function run(req: Request, method: "GET" | "POST") {
  try {
    const url = new URL(req.url);
    const op = url.searchParams.get("op");
    if (op === "ping") return NextResponse.json({ ok: true, serviceUrl: API_URL, keySet: KEY.length > 0 });

    const { repo: id, userId } = await requireRepo(url.searchParams.get("repo"));

    if (op === "graph" && method === "GET") return NextResponse.json(await service(`/code-intelligence/repos/${id}/graph`, "GET", userId));
    if (op === "index" && method === "POST") return NextResponse.json(await service(`/code-intelligence/repos/${id}/index`, "POST", userId));
    throw new HttpError(400, "Unknown operation.");
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[code-intelligence]", e);
    return NextResponse.json({ error: "Server error. Check the next dev terminal." }, { status: 500 });
  }
}

export const GET = (req: Request) => run(req, "GET");
export const POST = (req: Request) => run(req, "POST");
