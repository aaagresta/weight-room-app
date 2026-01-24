import { supabase } from "@/lib/supabase";

export async function requireAdmin() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return { ok: false as const, reason: "no_session" as const };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (error) return { ok: false as const, reason: "profile_error" as const, error };
  if (profile.role !== "admin") return { ok: false as const, reason: "not_admin" as const };

  return { ok: true as const, user, profile };
}

