"use server";

import { createClient } from "@/lib/supabase/server";
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
  skipped?: number;
}> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Unknown error." };

  // Fetch existing rounds for this season to avoid duplicates
  const { data: existing } = await supabase
    .from("race_weekends")
    .select("*")
    .eq("season", SEASON);

  const existingRounds = new Set((existing ?? []).map((r) => r.round));

  const toInsert = CALENDAR_2026.filter((r) => !existingRounds.has(r.round)).map((r) => ({
    season: SEASON,
    round: r.round,
    race_name: r.race_name,
    qualifying_deadline: r.qualifying_deadline,
    p_what_position: Math.floor(Math.random() * 19) + 4, // random P4–P22
    results_synced: false,
  }));

  if (toInsert.length === 0) {
    return { created: 0, skipped: CALENDAR_2026.length };
  }

  const { error } = await supabase.from("race_weekends").insert(toInsert);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");

  return { created: toInsert.length, skipped: existingRounds.size };
}

// ── subjective scoring ────────────────────────────────────────────────────────

export async function updateSubjectiveScore(data: {
  scoreId: string;
  field: "surprise_correct" | "flop_correct" | "crazy_correct";
  value: boolean | null;
}): Promise<{ error?: string; success?: true }> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Unknown error." };

  const { error } = await supabase
    .from("scores")
    .update({ [data.field]: data.value })
    .eq("id", data.scoreId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/history");
  return { success: true };
}
