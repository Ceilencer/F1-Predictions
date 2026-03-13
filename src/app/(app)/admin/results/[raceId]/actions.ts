"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/database.types";

// ── Jolpica Ergast API types ───────────────────────────────────────────────

interface JolpicaDriver {
  code: string;
  givenName: string;
  familyName: string;
}
interface JolpicaResult {
  position: string;
  grid?: string;
  Driver: JolpicaDriver;
}
interface JolpicaRace {
  Results?: JolpicaResult[];
  QualifyingResults?: JolpicaResult[];
  SprintResults?: JolpicaResult[];
}
interface JolpicaResponse {
  MRData: { RaceTable: { Races: JolpicaRace[] } };
}

// ── Exported types ─────────────────────────────────────────────────────────

export interface ResultEntry {
  pos: number;
  code: string;
  name: string;
}

/**
 * Describes how much data was available when the sync ran.
 *
 * Standard weekends:
 *   qualifying-only → qualifying done, race pending  (scores: pole)
 *   full            → race done                      (scores: everything)
 *
 * Sprint weekends:
 *   sprint-only        → sprint race done, main qualifying pending
 *                        (scores: sprint_pole + sprint_winner)
 *   sprint+qualifying  → sprint + main qualifying done, race pending
 *                        (scores: sprint_pole + sprint_winner + pole)
 *   full               → race done                   (scores: everything)
 */
export type SyncType =
  | "sprint-only"
  | "qualifying-only"
  | "sprint+qualifying"
  | "full";

// ── Auth guard ────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", supabase: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return { error: "Not authorised.", supabase: null };
  return { error: null, supabase };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toEntries(raw: JolpicaResult[]): ResultEntry[] {
  return raw
    .map((r) => ({
      pos: parseInt(r.position),
      code: r.Driver.code,
      name: `${r.Driver.givenName} ${r.Driver.familyName}`,
    }))
    .sort((a, b) => a.pos - b.pos);
}

/**
 * Derive the sprint qualifying order from sprint race grid positions.
 * Jolpica has no dedicated sprint-qualifying endpoint; the grid field on
 * each sprint-race entry tells us each driver's sprint-qualifying result.
 */
function sprintQualifyingFromGrid(rawSprint: JolpicaResult[]): ResultEntry[] {
  return rawSprint
    .filter((r) => r.grid && parseInt(r.grid) > 0)
    .map((r) => ({
      pos: parseInt(r.grid!),
      code: r.Driver.code,
      name: `${r.Driver.givenName} ${r.Driver.familyName}`,
    }))
    .sort((a, b) => a.pos - b.pos);
}

// ── Sync results & award points ───────────────────────────────────────────
//
// Fetches whatever results Jolpica has for this race weekend, scores every
// prediction for the categories that have data, and preserves scores for
// categories that are still pending. Safe to call multiple times.
//
// Sprint weekend sync flow (3 steps):
//   1. After sprint race   → scores sprint_pole_correct + sprint_winner_correct
//   2. After main qualifying → also scores pole_correct
//   3. After main race     → full sync, scores everything
//
// Standard weekend sync flow (2 steps):
//   1. After qualifying → scores pole_correct
//   2. After race       → full sync, scores everything

export async function syncRaceResults(raceWeekendId: string): Promise<{
  error?: string;
  qualifying?: ResultEntry[];
  race?: ResultEntry[];
  sprintRace?: ResultEntry[];
  sprintQualifying?: ResultEntry[];
  scoredCount?: number;
  syncType?: SyncType;
  /** true when syncType !== 'full' */
  partialSync?: boolean;
  scores?: {
    id: string;
    user_id: string;
    race_weekend_id: string;
    pole_correct: boolean;
    top3_p1_correct: boolean;
    top3_p2_correct: boolean;
    top3_p3_correct: boolean;
    surprise_correct: boolean | null;
    flop_correct: boolean | null;
    crazy_correct: boolean | null;
    p_what_correct: boolean;
    sprint_pole_correct: boolean | null;
    sprint_winner_correct: boolean | null;
    total_points: number;
  }[];
}> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError ?? "Unknown error." };

  const adminDb = createAdminClient();

  const { data: raceWeekend } = await supabase
    .from("race_weekends")
    .select("*")
    .eq("id", raceWeekendId)
    .maybeSingle();

  if (!raceWeekend) return { error: "Race weekend not found." };

  const isSprint = raceWeekend.is_sprint_weekend;

  // ── Fetch all three endpoints in parallel ───────────────────────────────
  const base = `https://api.jolpi.ca/ergast/f1/${raceWeekend.season}/${raceWeekend.round}`;
  const [raceRes, qualRes, sprintRes] = await Promise.all([
    fetch(`${base}/results.json`, { cache: "no-store" }),
    fetch(`${base}/qualifying.json`, { cache: "no-store" }),
    fetch(`${base}/sprint.json`, { cache: "no-store" }),
  ]);

  // ── Process qualifying ──────────────────────────────────────────────────
  // May be empty before main qualifying runs; fall back to stored data.
  let qualifying: ResultEntry[] = [];
  if (qualRes.ok) {
    const qualData: JolpicaResponse = await qualRes.json();
    const rawQual = qualData.MRData.RaceTable.Races[0]?.QualifyingResults ?? [];
    if (rawQual.length > 0) {
      qualifying = toEntries(rawQual);
    } else {
      // Try to use previously-stored qualifying results
      const { data: stored } = await supabase
        .from("race_results")
        .select("qualifying")
        .eq("race_weekend_id", raceWeekendId)
        .maybeSingle();
      const storedQual = stored?.qualifying;
      if (storedQual && Array.isArray(storedQual) && storedQual.length > 0) {
        qualifying = storedQual as unknown as ResultEntry[];
      }
    }
  }

  // ── Process race ────────────────────────────────────────────────────────
  let race: ResultEntry[] = [];
  if (raceRes.ok) {
    const raceData: JolpicaResponse = await raceRes.json();
    const rawRace = raceData.MRData.RaceTable.Races[0]?.Results ?? [];
    race = toEntries(rawRace);
  }

  // ── Process sprint ──────────────────────────────────────────────────────
  // Sprint race results also give us the sprint-qualifying grid order via the
  // `grid` field on each entry — there is no dedicated sprint-qualifying
  // endpoint in the Jolpica / Ergast API.
  let sprintRace: ResultEntry[] = [];
  let sprintQualifying: ResultEntry[] = [];
  let sprintPoleCode = "";
  let sprintWinnerCode = "";
  if (sprintRes.ok) {
    const sprintData: JolpicaResponse = await sprintRes.json();
    const rawSprint = sprintData.MRData.RaceTable.Races[0]?.SprintResults ?? [];
    if (rawSprint.length > 0) {
      sprintRace = toEntries(rawSprint);
      sprintQualifying = sprintQualifyingFromGrid(rawSprint);
      sprintPoleCode = sprintQualifying.find((r) => r.pos === 1)?.code ?? "";
      sprintWinnerCode = sprintRace.find((r) => r.pos === 1)?.code ?? "";
    } else {
      // Fall back to stored sprint data
      const { data: stored } = await supabase
        .from("race_results")
        .select("sprint_race, sprint_qualifying")
        .eq("race_weekend_id", raceWeekendId)
        .maybeSingle();
      if (stored?.sprint_race && Array.isArray(stored.sprint_race)) {
        sprintRace = stored.sprint_race as unknown as ResultEntry[];
        sprintWinnerCode = sprintRace.find((r) => r.pos === 1)?.code ?? "";
      }
      if (stored?.sprint_qualifying && Array.isArray(stored.sprint_qualifying)) {
        sprintQualifying = stored.sprint_qualifying as unknown as ResultEntry[];
        sprintPoleCode = sprintQualifying.find((r) => r.pos === 1)?.code ?? "";
      }
    }
  }

  // ── Validate: need at least something to work with ─────────────────────
  const hasQualifying = qualifying.length > 0;
  const hasRace = race.length > 0;
  const hasSprint = sprintRace.length > 0;

  if (!hasQualifying && !hasSprint) {
    return {
      error: isSprint
        ? "No results available yet. Sync after the sprint race finishes."
        : "No qualifying results found yet. Try again after qualifying finishes.",
    };
  }

  // ── Classify the sync ───────────────────────────────────────────────────
  const syncType: SyncType = hasRace
    ? "full"
    : hasQualifying && hasSprint
    ? "sprint+qualifying"
    : hasSprint
    ? "sprint-only"
    : "qualifying-only";

  const partialSync = syncType !== "full";

  // ── Store raw results ───────────────────────────────────────────────────
  // Only write a column when we have data for it so a sprint-only sync
  // doesn't wipe previously-stored qualifying or race results.
  const upsertPayload: Record<string, unknown> = {
    race_weekend_id: raceWeekendId,
    last_synced_at: new Date().toISOString(),
  };
  if (hasQualifying) upsertPayload.qualifying = qualifying as unknown as Json;
  if (hasSprint) {
    upsertPayload.sprint_race = sprintRace as unknown as Json;
    upsertPayload.sprint_qualifying = sprintQualifying as unknown as Json;
  }
  if (hasRace) upsertPayload.race = race as unknown as Json;

  const { error: storeErr } = await adminDb
    .from("race_results")
    .upsert(
      upsertPayload as {
        race_weekend_id: string;
        last_synced_at: string;
        qualifying?: Json;
        race?: Json;
        sprint_qualifying?: Json;
        sprint_race?: Json;
      },
      { onConflict: "race_weekend_id" }
    );

  if (storeErr) return { error: `Failed to store results: ${storeErr.message}` };

  // ── Auto-scoring ────────────────────────────────────────────────────────
  const poleSitter = qualifying.find((q) => q.pos === 1)?.code ?? "";
  const posToCode: Record<number, string> = {};
  const codeToPos: Record<string, number> = {};
  race.forEach((r) => {
    posToCode[r.pos] = r.code;
    codeToPos[r.code] = r.pos;
  });
  const p1 = posToCode[1] ?? "";
  const p2 = posToCode[2] ?? "";
  const p3 = posToCode[3] ?? "";

  const { data: predictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("race_weekend_id", raceWeekendId);

  const { data: existingScores } = await supabase
    .from("scores")
    .select("*")
    .eq("race_weekend_id", raceWeekendId);

  const existingMap = Object.fromEntries(
    (existingScores ?? []).map((s) => [s.user_id, s])
  );

  if (predictions && predictions.length > 0) {
    const pWhatActual = posToCode[raceWeekend.p_what_position] ?? "";

    // P What? scoring — exact match first, then closest by position
    const exactMatches = predictions.filter(
      (p) => pWhatActual && p.p_what_driver === pWhatActual
    );
    let pWhatWinners: Set<string>;
    if (exactMatches.length > 0) {
      pWhatWinners = new Set(exactMatches.map((p) => p.user_id));
    } else {
      let minDist = Infinity;
      predictions.forEach((p) => {
        const dist = Math.abs(
          (codeToPos[p.p_what_driver] ?? Infinity) - raceWeekend.p_what_position
        );
        if (dist < minDist) minDist = dist;
      });
      pWhatWinners = new Set(
        predictions
          .filter(
            (p) =>
              Math.abs(
                (codeToPos[p.p_what_driver] ?? Infinity) - raceWeekend.p_what_position
              ) === minDist
          )
          .map((p) => p.user_id)
      );
    }

    await adminDb.from("scores").upsert(
      predictions.map((pred) => {
        const ex = existingMap[pred.user_id];
        return {
          user_id: pred.user_id,
          race_weekend_id: raceWeekendId,
          // Pole: score if we have qualifying, otherwise preserve
          pole_correct: hasQualifying
            ? !!poleSitter && pred.pole_position === poleSitter
            : (ex?.pole_correct ?? false),
          // Race podium + P?: score only on full sync
          top3_p1_correct: !hasRace ? (ex?.top3_p1_correct ?? false) : !!p1 && pred.top3_p1 === p1,
          top3_p2_correct: !hasRace ? (ex?.top3_p2_correct ?? false) : !!p2 && pred.top3_p2 === p2,
          top3_p3_correct: !hasRace ? (ex?.top3_p3_correct ?? false) : !!p3 && pred.top3_p3 === p3,
          p_what_correct: !hasRace ? (ex?.p_what_correct ?? false) : pWhatWinners.has(pred.user_id),
          // Sprint: score if sprint data is available, otherwise preserve
          sprint_pole_correct: !isSprint
            ? null
            : hasSprint
            ? sprintPoleCode
              ? pred.sprint_pole === sprintPoleCode
              : null
            : (ex?.sprint_pole_correct ?? null),
          sprint_winner_correct: !isSprint
            ? null
            : hasSprint
            ? sprintWinnerCode
              ? pred.sprint_winner === sprintWinnerCode
              : null
            : (ex?.sprint_winner_correct ?? null),
          // Subjective scores: never overwritten by auto-sync
          surprise_correct: ex?.surprise_correct ?? null,
          flop_correct: ex?.flop_correct ?? null,
          crazy_correct: ex?.crazy_correct ?? null,
          total_points: 0, // recomputed by DB trigger
        };
      }),
      { onConflict: "user_id,race_weekend_id" }
    );
  }

  // Mark results_synced=true only when the race is complete
  if (!partialSync) {
    await adminDb
      .from("race_weekends")
      .update({ results_synced: true })
      .eq("id", raceWeekendId);
  }

  revalidatePath(`/admin/results/${raceWeekendId}`);
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/history");

  const { data: updatedScores } = await supabase
    .from("scores")
    .select("*")
    .eq("race_weekend_id", raceWeekendId);

  return {
    qualifying,
    race,
    sprintRace,
    sprintQualifying,
    scoredCount: predictions?.length ?? 0,
    syncType,
    partialSync,
    scores: updatedScores ?? [],
  };
}
