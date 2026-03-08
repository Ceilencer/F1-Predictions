"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CALENDAR_2026, SEASON } from "@/config/calendar";

// ── guard ─────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", supabase: null, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) return { error: "Not authorised.", supabase: null, user: null };
  return { error: null, supabase, user };
}

// ── whitelist ─────────────────────────────────────────────────────────────────

export async function addWhitelistedEmail(
  email: string
): Promise<{ error?: string; success?: true }> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError ?? "Unknown error." };

  const { error } = await supabase
    .from("whitelisted_emails")
    .insert({ email: email.toLowerCase().trim(), added_by: user.id });

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function removeWhitelistedEmail(
  id: string
): Promise<{ error?: string; success?: true }> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Unknown error." };

  const { error } = await supabase
    .from("whitelisted_emails")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

// ── race weekends ─────────────────────────────────────────────────────────────

export async function createRaceWeekend(data: {
  race_name: string;
  round: number;
  season: number;
  qualifying_deadline: string;
}): Promise<{ error?: string; success?: true; p_what_position?: number }> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Unknown error." };

  // Random position between 4 and 22 inclusive
  const p_what_position = Math.floor(Math.random() * 19) + 4;

  const { error } = await supabase.from("race_weekends").insert({
    ...data,
    round: Number(data.round),
    season: Number(data.season),
    p_what_position,
    results_synced: false,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true, p_what_position };
}

export async function updateRaceDeadline(
  id: string,
  qualifying_deadline: string
): Promise<{ error?: string; success?: true }> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Unknown error." };

  const { error } = await supabase
    .from("race_weekends")
    .update({ qualifying_deadline })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

// ── seed from calendar ────────────────────────────────────────────────────────

export async function seedFromCalendar(): Promise<{
  error?: string;
  created?: number;
  updated?: number;
}> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Unknown error." };

  // Fetch existing rows to preserve p_what_position and results_synced
  const { data: existing } = await supabase
    .from("race_weekends")
    .select("round, p_what_position, results_synced")
    .eq("season", SEASON);

  const existingMap = new Map((existing ?? []).map((r) => [r.round, r]));

  // Build upsert payload: new rows get a random position; existing rows keep theirs
  const rows = CALENDAR_2026.map((r) => {
    const ex = existingMap.get(r.round);
    return {
      season: SEASON,
      round: r.round,
      race_name: r.race_name,
      qualifying_deadline: r.qualifying_deadline,
      race_start: r.race_start,
      p_what_position: ex?.p_what_position ?? Math.floor(Math.random() * 19) + 4,
      results_synced: ex?.results_synced ?? false,
      is_sprint_weekend: r.is_sprint_weekend ?? false,
      fp1_start: r.fp1_start ?? null,
      fp2_start: r.fp2_start ?? null,
      fp3_start: r.fp3_start ?? null,
      sprint_qualifying_start: r.sprint_qualifying_start ?? null,
      sprint_race_start: r.sprint_race_start ?? null,
    };
  });

  const { error } = await supabase
    .from("race_weekends")
    .upsert(rows, { onConflict: "season,round" });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");

  const created = rows.filter((r) => !existingMap.has(r.round)).length;
  const updated = rows.filter((r) => existingMap.has(r.round)).length;
  return { created, updated };
}

// ── subjective scoring ────────────────────────────────────────────────────────

export async function updateSubjectiveScore(data: {
  scoreId: string;
  field: "surprise_correct" | "flop_correct" | "crazy_correct";
  value: boolean | null;
}): Promise<{ error?: string; success?: true }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  // Use service-role client so RLS doesn't block the update.
  const adminDb = createAdminClient();
  const { error } = await adminDb
    .from("scores")
    .update({ [data.field]: data.value })
    .eq("id", data.scoreId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/history");
  return { success: true };
}
