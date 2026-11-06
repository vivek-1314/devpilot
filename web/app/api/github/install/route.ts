import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/`);

  const admin = createAdminClient();
  const { count } = await admin
    .from("installation_members")
    .select("installation_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (count && count > 0) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  return NextResponse.redirect(
    `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`
  );
}