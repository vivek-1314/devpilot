import { createClient } from "@/lib/supabase/browser";

export async function connectGitHub() {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}