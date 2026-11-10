import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGithubApp } from "@/lib/github/app";

type Account = { id: number; login: string; type: string };

const REPO_CHILD_TABLES = [
  "code_edges",
  "code_nodes",
  "repo_docs",
  "quality_scans",
  "finding_states",
  "pull_requests",
  "findings",
] as const;

async function deleteRepoData(admin: ReturnType<typeof createAdminClient>, repoIds: number[]) {
  if (repoIds.length === 0) return;

  for (const table of REPO_CHILD_TABLES) {
    const { error } = await admin.from(table).delete().in("repo_id", repoIds);
    if (error) throw error;
  }

  const { error: repoDeleteErr } = await admin.from("repositories").delete().in("id", repoIds);
  if (repoDeleteErr) throw repoDeleteErr;
}

export async function syncInstallation(opts: {
  installationId: number;
  userId: string;
  account: Account;
}) {
  const { installationId, userId, account } = opts;
  const admin = createAdminClient();

  // 1. Save the installation
  const { error: instErr } = await admin.from("installations").upsert({
    id: installationId,
    account_id: account.id,
    account_login: account.login,
    account_type: account.type,
  });
  if (instErr) throw instErr;

  // 2. Link this user to it (this is what lets them see the data)
  const { error: memErr } = await admin
    .from("installation_members")
    .upsert({ user_id: userId, installation_id: installationId });
  if (memErr) throw memErr;

  // 3. Ask GitHub which repos we can read
  const githubApp = getGithubApp();
  const octokit = await githubApp.getInstallationOctokit(installationId);
  const repos = await octokit.paginate("GET /installation/repositories", {
    per_page: 100,
  });

  const { data: existingRepos, error: existingErr } = await admin
    .from("repositories")
    .select("id")
    .eq("installation_id", installationId);
  if (existingErr) throw existingErr;

  const allowedRepoIds = new Set(repos.map((r) => r.id));
  const removedRepoIds = (existingRepos ?? [])
    .map((r) => r.id)
    .filter((id) => !allowedRepoIds.has(id));

  await deleteRepoData(admin, removedRepoIds);

  // 4. Save the repos
  if (repos.length > 0) {
    const { error: repoErr } = await admin.from("repositories").upsert(
      repos.map((r) => ({
        id: r.id,
        installation_id: installationId,
        name: r.name,
        full_name: r.full_name,
        private: r.private,
        default_branch: r.default_branch ?? "main",
        language: r.language ?? null,
      }))
    );
    if (repoErr) throw repoErr;
  }

  // 5. Write an entry for the Activity page
  await admin.from("events").insert({
    installation_id: installationId,
    type: "repos_synced",
    payload: { count: repos.length, removed: removedRepoIds.length },
  });

  return repos.length;
}