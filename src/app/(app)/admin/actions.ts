"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CALENDAR_2026, SEASON } from "@/config/calendar";
import { TEAMS } from "@/config/drivers";
import type { Database } from "@/lib/supabase/database.types";

type AdminDb = ReturnType<typeof createAdminClient>;
type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];

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
  race_start: string;
}): Promise<{ error?: string; success?: true; p_what_position?: number; shifted?: number }> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Unknown error." };

  const round = Number(data.round);
  const season = Number(data.season);
  if (!Number.isInteger(round) || round < 1) return { error: "Round must be a positive whole number." };

  // Inserting mid-season: bump every later round up by one to make room.
  // Updated highest-first so the (season, round) unique constraint never
  // sees two rows on the same round, even if a step fails part-way.
  const { data: later, error: laterError } = await supabase
    .from("race_weekends")
    .select("id, round")
    .eq("season", season)
    .gte("round", round)
    .order("round", { ascending: false });

  if (laterError) return { error: laterError.message };

  for (const r of later ?? []) {
    const { error } = await supabase
      .from("race_weekends")
      .update({ round: r.round + 1 })
      .eq("id", r.id);
    if (error) return { error: `Failed to shift round ${r.round}: ${error.message}` };
  }

  // Random position between 4 and 22 inclusive
  const p_what_position = Math.floor(Math.random() * 19) + 4;

  const { data: created, error } = await supabase
    .from("race_weekends")
    .insert({
      race_name: data.race_name,
      round,
      season,
      qualifying_deadline: data.qualifying_deadline,
      race_start: data.race_start,
      p_what_position,
      results_synced: false,
    })
    .select("id, season")
    .maybeSingle();

  if (error) return { error: error.message };

  // Freeze this weekend's grid from the current season default (no-op if the
  // default hasn't been seeded yet — reads fall back to the default anyway).
  if (created) {
    await snapshotWeekendGrid(createAdminClient(), created.id, created.season);
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true, p_what_position, shifted: later?.length ?? 0 };
}

export async function deleteRaceWeekend(
  id: string
): Promise<{ error?: string; success?: true }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  // No delete RLS policy on race_weekends, so use the service-role client.
  // Predictions, scores, results and grid rows cascade with it.
  const { error } = await createAdminClient()
    .from("race_weekends")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
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
  skipped?: string[];
}> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Unknown error." };

  // Fetch existing rows to preserve p_what_position and results_synced
  const { data: existing } = await supabase
    .from("race_weekends")
    .select("round, race_name, p_what_position, results_synced")
    .eq("season", SEASON);

  const existingMap = new Map((existing ?? []).map((r) => [r.round, r]));

  // A round held by a different race (e.g. rounds shifted by a mid-season
  // addition) is skipped rather than overwritten with the wrong race.
  const skipped = CALENDAR_2026.filter((r) => {
    const ex = existingMap.get(r.round);
    return ex && ex.race_name !== r.race_name;
  }).map((r) => `R${r.round} ${r.race_name} (DB has ${existingMap.get(r.round)!.race_name})`);

  // Build upsert payload: new rows get a random position; existing rows keep theirs
  const rows = CALENDAR_2026.filter((r) => {
    const ex = existingMap.get(r.round);
    return !ex || ex.race_name === r.race_name;
  }).map((r) => {
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

  // Snapshot the season default into any weekend that doesn't yet have a grid.
  const adminDb = createAdminClient();
  const { data: weekends } = await adminDb
    .from("race_weekends")
    .select("id, season")
    .eq("season", SEASON);
  for (const w of weekends ?? []) {
    await snapshotWeekendGrid(adminDb, w.id, w.season);
  }

  revalidatePath("/admin");
  revalidatePath("/");

  const created = rows.filter((r) => !existingMap.has(r.round)).length;
  const updated = rows.filter((r) => existingMap.has(r.round)).length;
  return { created, updated, skipped };
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

// ── grid: roster / teams / lineups ──────────────────────────────────────────────

/** Revalidate every page that renders drivers/teams. */
function revalidateGrid() {
  revalidatePath("/admin");
  revalidatePath("/predict");
  revalidatePath("/");
  revalidatePath("/history");
}

/**
 * Copy the season default (season_seats) into a weekend's grid
 * (race_weekend_drivers). By default this is a no-op when the weekend already
 * has a grid, so existing one-off overrides are never clobbered. Pass
 * force=true to discard the weekend's grid and re-copy the current default.
 */
async function snapshotWeekendGrid(
  db: AdminDb,
  raceWeekendId: string,
  season: number,
  force = false
): Promise<void> {
  if (force) {
    await db.from("race_weekend_drivers").delete().eq("race_weekend_id", raceWeekendId);
  } else {
    const { data: existing } = await db
      .from("race_weekend_drivers")
      .select("id")
      .eq("race_weekend_id", raceWeekendId)
      .limit(1);
    if (existing && existing.length > 0) return;
  }

  const { data: seats } = await db
    .from("season_seats")
    .select("team_id, seat_no, driver_id")
    .eq("season", season);
  if (!seats || seats.length === 0) return;

  await db.from("race_weekend_drivers").upsert(
    seats.map((s) => ({
      race_weekend_id: raceWeekendId,
      team_id: s.team_id,
      seat_no: s.seat_no,
      driver_id: s.driver_id,
    })),
    { onConflict: "race_weekend_id,team_id,seat_no" }
  );
}

/**
 * One-time seed: read the static config (src/config/drivers.ts) into the DB —
 * teams, drivers, and the season-default lineup. Idempotent (upserts on
 * teams.key / drivers.code / season_seats unique keys), so it's safe to re-run.
 */
export async function seedGridFromConfig(): Promise<{
  error?: string;
  teams?: number;
  drivers?: number;
}> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };
  const db = createAdminClient();

  // 1. Teams (sort_order = position in the config array)
  const teamRows = TEAMS.map((t, i) => ({
    key: t.shortName,
    name: t.name,
    logo_path: t.logoPath,
    colour: t.colour,
    sort_order: i,
  }));
  const { data: teams, error: teamErr } = await db
    .from("teams")
    .upsert(teamRows, { onConflict: "key" })
    .select("id, key");
  if (teamErr) return { error: teamErr.message };
  const teamIdByKey = new Map((teams ?? []).map((t) => [t.key, t.id]));

  // 2. Drivers
  const driverRows = TEAMS.flatMap((t) =>
    t.drivers.map((d) => ({
      code: d.code,
      name: d.name,
      nationality: d.nationality,
      number: d.number,
      photo_path: d.photoPath,
    }))
  );
  const { data: drivers, error: drvErr } = await db
    .from("drivers")
    .upsert(driverRows, { onConflict: "code" })
    .select("id, code");
  if (drvErr) return { error: drvErr.message };
  const driverIdByCode = new Map((drivers ?? []).map((d) => [d.code, d.id]));

  // 3. Season-default seats (2026)
  const seatRows = TEAMS.flatMap((t) =>
    t.drivers.map((d, seatIdx) => ({
      season: SEASON,
      team_id: teamIdByKey.get(t.shortName)!,
      seat_no: seatIdx + 1,
      driver_id: driverIdByCode.get(d.code)!,
    }))
  );
  const { error: seatErr } = await db
    .from("season_seats")
    .upsert(seatRows, { onConflict: "season,team_id,seat_no" });
  if (seatErr) return { error: seatErr.message };

  revalidateGrid();
  return { teams: teamRows.length, drivers: driverRows.length };
}

/** Add a brand-new driver to the roster. Photo is a path or URL string. */
export async function addDriver(data: {
  code: string;
  name: string;
  nationality: string;
  number: string;
  photo_path: string;
}): Promise<{ error?: string; driver?: DriverRow }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const code = data.code.trim().toUpperCase();
  if (code.length !== 3) return { error: "Driver code must be exactly 3 letters." };
  if (!data.name.trim()) return { error: "Driver name is required." };

  const { data: driver, error } = await createAdminClient()
    .from("drivers")
    .insert({
      code,
      name: data.name.trim(),
      nationality: data.nationality.trim(),
      number: data.number.trim() ? Number(data.number) : null,
      photo_path: data.photo_path.trim(),
    })
    .select("*")
    .maybeSingle();
  if (error) return { error: error.message };
  revalidateGrid();
  return { driver: driver ?? undefined };
}

/** Edit an existing roster driver (name / number / photo / nationality / active). */
export async function updateDriver(
  id: string,
  data: {
    name?: string;
    nationality?: string;
    number?: string;
    photo_path?: string;
    is_active?: boolean;
  }
): Promise<{ error?: string; success?: true }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.nationality !== undefined) patch.nationality = data.nationality.trim();
  if (data.number !== undefined) patch.number = data.number.trim() ? Number(data.number) : null;
  if (data.photo_path !== undefined) patch.photo_path = data.photo_path.trim();
  if (data.is_active !== undefined) patch.is_active = data.is_active;

  const { error } = await createAdminClient().from("drivers").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidateGrid();
  return { success: true };
}

/** Set (or clear) a seat in the season DEFAULT lineup — a permanent change. */
export async function upsertSeasonSeat(data: {
  season: number;
  teamId: string;
  seatNo: number;
  driverId: string | null;
}): Promise<{ error?: string; success?: true }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await createAdminClient().from("season_seats").upsert(
    {
      season: data.season,
      team_id: data.teamId,
      seat_no: data.seatNo,
      driver_id: data.driverId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "season,team_id,seat_no" }
  );
  if (error) return { error: error.message };
  revalidateGrid();
  return { success: true };
}

/**
 * Set (or clear) a seat for ONE weekend only (a one-off override). Ensures the
 * weekend has a full snapshot first, so overriding a single seat doesn't wipe
 * the rest of the grid.
 */
export async function upsertWeekendSeat(data: {
  raceWeekendId: string;
  season: number;
  teamId: string;
  seatNo: number;
  driverId: string | null;
}): Promise<{ error?: string; success?: true }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };
  const db = createAdminClient();

  await snapshotWeekendGrid(db, data.raceWeekendId, data.season);

  const { error } = await db.from("race_weekend_drivers").upsert(
    {
      race_weekend_id: data.raceWeekendId,
      team_id: data.teamId,
      seat_no: data.seatNo,
      driver_id: data.driverId,
    },
    { onConflict: "race_weekend_id,team_id,seat_no" }
  );
  if (error) return { error: error.message };
  revalidateGrid();
  return { success: true };
}

/** Discard a weekend's one-off overrides and re-copy the current season default. */
export async function resetWeekendGridToDefault(
  raceWeekendId: string,
  season: number
): Promise<{ error?: string; success?: true }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  await snapshotWeekendGrid(createAdminClient(), raceWeekendId, season, true);
  revalidateGrid();
  return { success: true };
}
