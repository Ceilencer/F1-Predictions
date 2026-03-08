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

// ── Exported result type (used by client) ─────────────────────────────────

export interface ResultEntry {
  pos: number;
  code: string;
  name: string;
}

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

// ── Helper ────────────────────────────────────────────────────────────────

function toEntries(raw: JolpicaResult[]): ResultEntry[] {
  return raw
    .map((r) => ({
      pos: parseInt(r.position),
      code: r.Driver.code,
      name: `${r.Driver.givenName} ${r.Driver.familyName}`,
    }))
    .sort((a, b) => a.pos - b.pos);
}

// ── Sync results & award points ───────────────────────────────────────────
//
// Fetches qualifying, race, and (if available) sprint results from Jolpica,
// stores them in race_results, auto-scores all predictions, and preserves any
// manually-set subjective scores (surprise/flop/wildcard).
// Safe to call multiple times — repoll-safe.

export async function syncRaceResults(raceWeekendId: string): Promise<{
  error?: string;
  qualifying?: ResultEntry[];
  race?: ResultEntry[];
  sprintRace?: ResultEntry[];
  scoredCount?: number;
  /** true when qualifying was available but the race hasn't finished yet */
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

  // Use service-role client for writes so RLS doesn't block admin operations.
  // Auth is already verified above.
  const adminDb = createAdminClient();

  const { data: raceWeekend } = await supabase
    .from("race_weekends")
    .select("*")
    .eq("id", raceWeekendId)
    .maybeSingle();

  if (!raceWeekend) return { error: "Race weekend not found." };

  // Fetch qualifying, race, and sprint results in parallel.
  // Sprint returns 200 with empty Races[] when it's not a sprint weekend.
  // Race results return 200 with empty Races[] before the race starts — that is
  // NOT an error; we handle it as a qualifying-only (partial) sync below.
  const base = `https://api.jolpi.ca/ergast/f1/${raceWeekend.season}/${raceWeekend.round}`;
  const [raceRes, qualRes, sprintRes] = await Promise.all([
    fetch(`${base}/results.json`, { cache: "no-store" }),
    fetch(`${base}/qualifying.json`, { cache: "no-store" }),
    fetch(`${base}/sprint.json`, { cache: "no-store" }),
  ]);

  if (!qualRes.ok) {
    return {
      error: `Qualifying results not available yet (HTTP ${qualRes.status}). Try again after qualifying finishes.`,
    };
  }

  const qualData: JolpicaResponse = await qualRes.json();
  const rawQual = qualData.MRData.RaceTable.Races[0]?.QualifyingResults ?? [];

  // If Jolpica returns empty qualifying, fall back to whatever is already stored.
  // This happens when re-syncing after a partial sync while the API is still catching up.
  let qualifying: ResultEntry[];
  if (rawQual.length === 0) {
    const { data: existingResults } = await supabase
      .from("race_results")
      .select("qualifying")
      .eq("race_weekend_id", raceWeekendId)
      .maybeSingle();
    const storedQual = existingResults?.qualifying;
    if (!storedQual || !Array.isArray(storedQual) || storedQual.length === 0) {
      return { error: "No qualifying results found yet. Try again after qualifying finishes." };
    }
    qualifying = storedQual as unknown as ResultEntry[];
  } else {
    qualifying = toEntries(rawQual);
  }

  // Race results — may be empty if the race hasn't happened yet
  let race: ResultEntry[] = [];
  const raceAvailable = raceRes.ok;
  if (raceAvailable) {
    const raceData: JolpicaResponse = await raceRes.json();
    const rawRace = raceData.MRData.RaceTable.Races[0]?.Results ?? [];
    race = toEntries(rawRace);
  }

  let sprintRace: ResultEntry[] = [];
  let sprintPoleCode = "";
  let sprintWinnerCode = "";
  if (sprintRes.ok) {
    const sprintData: JolpicaResponse = await sprintRes.json();
    const rawSprint = sprintData.MRData.RaceTable.Races[0]?.SprintResults ?? [];
    sprintRace = toEntries(rawSprint);
    // Sprint pole = driver who started from grid position 1 (set by sprint qualifying)
    sprintPoleCode = rawSprint.find((r) => r.grid === "1")?.Driver.code ?? "";
    // Sprint winner = driver who finished P1
    sprintWinnerCode = sprintRace.find((r) => r.pos === 1)?.code ?? "";
  }

  const partialSync = race.length === 0;

  // Store raw results — only update race/sprint fields when we actually have data,
  // so a qualifying-only sync doesn't wipe previously stored race results.
  const upsertPayload = {
    race_weekend_id: raceWeekendId,
    qualifying: qualifying as unknown as Json,
    last_synced_at: new Date().toISOString(),
    ...(!partialSync && {
      race: race as unknown as Json,
      sprint_qualifying: null,
      sprint_race: (sprintRace.length > 0 ? sprintRace : null) as unknown as Json,
    }),
  };

  const { error: storeError } = await adminDb
    .from("race_results")
    .upsert(upsertPayload, { onConflict: "race_weekend_id" });

  if (storeError) {
    return { error: `Failed to store results: ${storeError.message}` };
  }

  // ── Auto-scoring ──────────────────────────────────────────────────────────
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

  // Fetch existing scores so we can preserve manually-set fields
  const { data: existingScores } = await supabase
    .from("scores")
    .select("*")
    .eq("race_weekend_id", raceWeekendId);

  const existingMap = Object.fromEntries(
    (existingScores ?? []).map((s) => [s.user_id, s])
  );

  if (predictions && predictions.length > 0) {
    const pWhatActual = posToCode[raceWeekend.p_what_position] ?? "";

    // Tier 1: exact match on the driver who finished at p_what_position.
    // Tier 2 (if nobody exact): the player whose pick finished closest to that
    //         position (ties share the point).
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

    const isSprint = raceWeekend.is_sprint_weekend;

    await adminDb.from("scores").upsert(
      predictions.map((pred) => {
        const ex = existingMap[pred.user_id];
        return {
          user_id: pred.user_id,
          race_weekend_id: raceWeekendId,
          pole_correct: !!poleSitter && pred.pole_position === poleSitter,
          // When only qualifying is available, preserve any existing race scores
          // rather than zeroing them out. They will be overwritten on the full sync.
          top3_p1_correct: partialSync ? (ex?.top3_p1_correct ?? false) : !!p1 && pred.top3_p1 === p1,
          top3_p2_correct: partialSync ? (ex?.top3_p2_correct ?? false) : !!p2 && pred.top3_p2 === p2,
          top3_p3_correct: partialSync ? (ex?.top3_p3_correct ?? false) : !!p3 && pred.top3_p3 === p3,
          p_what_correct: partialSync ? (ex?.p_what_correct ?? false) : pWhatWinners.has(pred.user_id),
          // Sprint scores — only relevant on sprint weekends; preserve on partial sync
          sprint_pole_correct: !isSprint ? null
            : partialSync ? (ex?.sprint_pole_correct ?? null)
            : sprintPoleCode ? (pred.sprint_pole === sprintPoleCode)
            : null,
          sprint_winner_correct: !isSprint ? null
            : partialSync ? (ex?.sprint_winner_correct ?? null)
            : sprintWinnerCode ? (pred.sprint_winner === sprintWinnerCode)
            : null,
          // Preserve manually-set subjective scores — never overwrite with auto-sync
          surprise_correct: ex?.surprise_correct ?? null,
          flop_correct: ex?.flop_correct ?? null,
          crazy_correct: ex?.crazy_correct ?? null,
          total_points: 0, // recomputed by DB trigger
        };
      }),
      { onConflict: "user_id,race_weekend_id" }
    );
  }

  // Only mark results_synced=true once the full race results are in
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

  // Return updated scores so the client can update state without a full page reload
  const { data: updatedScores } = await supabase
    .from("scores")
    .select("*")
    .eq("race_weekend_id", raceWeekendId);

  return {
    qualifying,
    race,
    sprintRace,
    scoredCount: predictions?.length ?? 0,
    partialSync,
    scores: updatedScores ?? [],
  };
}
