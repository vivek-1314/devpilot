import { NextResponse } from "next/server";
import { Octokit } from "octokit";
import { createClient } from "@/lib/supabase/server";
import { getGithubApp } from "@/lib/github/app";
import { syncInstallation } from "@/lib/github/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const installationId = Number(searchParams.get("installation_id"));

  if (!code || !installationId) {
    return NextResponse.redirect(`${origin}/dashboard?error=github_setup`);
  }

  // Who is logged in to DevPilot?
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/`);

  try {
    const githubApp = getGithubApp();

    // Trade the code for the GitHub user's token
    const { authentication } = await githubApp.oauth.createToken({ code });
    const userOctokit = new Octokit({ auth: authentication.token });

    // Check that this installation really belongs to this GitHub user
    const installs = await userOctokit.paginate("GET /user/installations", {
      per_page: 100,
    });
    const inst = installs.find((i) => i.id === installationId);
    if (!inst || !inst.account) {
      return NextResponse.redirect(`${origin}/dashboard?error=not_your_installation`);
    }

    const account = inst.account as unknown as {
      id: number;
      login: string;
      type: string;
    };

    // Make sure the profile row exists before linking the installation
    const admin = createAdminClient();
    await admin.from("profiles").upsert({
      id: user.id,
      github_id: Number(user.user_metadata?.provider_id) || null,
      username: user.user_metadata?.user_name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      email: user.email ?? null,
    });

    await syncInstallation({
      installationId,
      userId: user.id,
      account: { id: account.id, login: account.login, type: account.type ?? "User" },
    });

    return NextResponse.redirect(`${origin}/dashboard/repositories`);
  } catch (e) {
    console.error("GitHub setup failed:", e);
    return NextResponse.redirect(`${origin}/dashboard?error=github_setup`);
  }
}