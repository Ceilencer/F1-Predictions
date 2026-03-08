import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

// ── Jolpica API types ──────────────────────────────────────────────────────────

interface JolpicaDriver {
  code: string;
  givenName: string;
  familyName: string;
}
interface JolpicaResult {
  position: string;
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

interface ResultEntry {
  pos: number;
  code: string;
  name: string;
}

function toEntries(raw: JolpicaResult[]): ResultEntry[] {
  return raw
    .map((r) => ({
      pos: parseInt(r.position),
      code: r.Driver.code,
      name: `${r.Driver.givenName} ${r.Driver.familyName}`,
    }))
    .sort((a, b) => a.pos - b.pos);
}

// ── Cron handler ───────────────────────────────────────────────────────────────
//
// Runs on a schedule (see vercel.json). Finds race weekends where:
//   - results_synced is false
//   - qualifying_deadline + 1h has passed  (triggers qualifying sync)
//   - race_start + 2.5h has passed         (triggers full race sync)
//   - We're within a 48h window of race_start (stops retrying stale races)
//
// Safe to run multiple times — if race results aren't out yet, it does a
// partial qualifying sync and leaves results_synced=false for the next run.

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const adminDb = createAdminClient();
  const now = new Date();

  // Fetch all unsynced race weekends that have qualifying_deadline set
  const { data: candidates, error: fetchError } = await adminDb
    .from("race_weekends")
    .select("*")
    .eq("results_synced", false)
    .not("qualifying_deadline", "is", null)
    .not("race_start", "is", null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ message: "No races pending sync.", synced: [] });
  }

  const syncLog: { race: string; status: string; detail?: string }[] = [];

  for (const rw of candidates) {
    const qualDeadline = new Date(rw.qualifying_deadline);
    const raceStart = new Date(rw.race_start ?? "");

    const qualSyncAfter = new Date(qualDeadline.getTime() + 60 * 60 * 1000);       // +1h
    const raceSyncAfter = new Date(raceStart.getTime() + 2.5 * 60 * 60 * 1000);    // +2.5h
    const syncWindowEnd = new Date(raceStart.getTime() + 48 * 60 * 60 * 1000);     // +48h

    // Skip if qualifying hasn't finished yet
    if (now < qualSyncAfter) {
      syncLog.push({ race: rw.race_name, status: "skipped", detail: "qualifying not done yet" });
      continue;
    }

    // Skip if we're past the 48h window (race is long over, assume data issue)
    if (now > syncWindowEnd) {
      syncLog.push({ race: rw.race_name, status: "skipped", detail: "outside 48h window" });
      continue;
    }

    // Determine if we should attempt a full sync or qualifying-only
    const attemptFullSync = now >= raceSyncAfter;

    const base = `https://api.jolpi.ca/ergast/f1/${rw.season}/${rw.round}`;

    try {
      const [raceRes, qualRes, sprintRes] = await Promise.all([
        fetch(`${base}/results.json`, { cache: "no-store" }),
        fetch(`${base}/qualifying.json`, { cache: "no-store" }),
        fetch(`${base}/sprint.json`, { cache: "no-store" }),
      ]);

      if (!qualRes.ok) {
        syncLog.push({ race: rw.race_name, status: "error", detail: `qualifying HTTP ${qualRes.status}` });
        continue;
      }

      const qualData: JolpicaResponse = await qualRes.json();
      const rawQual = qualData.MRData.RaceTable.Races[0]?.QualifyingResults ?? [];
      if (rawQual.length === 0) {
        syncLog.push({ race: rw.race_name, status: "skipped", detail: "no qualifying results yet" });
        continue;
      }
      const qualifying = toEntries(rawQual);

      // Race results — may not be available yet
      let race: ResultEntry[] = [];
      if (attemptFullSync && raceRes.ok) {
        const raceData: JolpicaResponse = await raceRes.json();
        race = toEntries(raceData.MRData.RaceTable.Races[0]?.Results ?? []);
      }

      let sprintRace: ResultEntry[] = [];
      if (sprintRes.ok) {
        const sprintData: JolpicaResponse = await sprintRes.json();
        sprintRace = toEntries(sprintData.MRData.RaceTable.Races[0]?.SprintResults ?? []);
      }

      const partialSync = race.length === 0;

      // Store results — only write race/sprint fields when we have them
      const upsertPayload = {
        race_weekend_id: rw.id,
        qualifying: qualifying as unknown as Json,
        last_synced_at: now.toISOString(),
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
        syncLog.push({ race: rw.race_name, status: "error", detail: storeError.message });
        continue;
      }

      // ── Auto-scoring ───────────────────────────────────────────────────────
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

      const { data: predictions } = await adminDb
        .from("predictions")
        .select("*")
        .eq("race_weekend_id", rw.id);

      const { data: existingScores } = await adminDb
        .from("scores")
        .select("*")
        .eq("race_weekend_id", rw.id);

      const existingMap = Object.fromEntries(
        (existingScores ?? []).map((s) => [s.user_id, s])
      );

      if (predictions && predictions.length > 0) {
        const pWhatActual = posToCode[rw.p_what_position] ?? "";

        const exactMatches = predictions.filter(
          (p) => pWhatActual && p.p_what_driver === pWhatActual
        );
        let pWhatWinners: Set<string>;
        if (exactMatches.length > 0) {
          pWhatWinners = new Set(exactMatches.map((p) => p.user_id));
        } else {
          let minDist = Infinity;
          predictions.forEach((p) => {
            const dist = Math.abs((codeToPos[p.p_what_driver] ?? Infinity) - rw.p_what_position);
            if (dist < minDist) minDist = dist;
          });
          pWhatWinners = new Set(
            predictions
              .filter(
                (p) =>
                  Math.abs((codeToPos[p.p_what_driver] ?? Infinity) - rw.p_what_position) === minDist
              )
              .map((p) => p.user_id)
          );
        }

        await adminDb.from("scores").upsert(
          predictions.map((pred) => {
            const ex = existingMap[pred.user_id];
            return {
              user_id: pred.user_id,
              race_weekend_id: rw.id,
              pole_correct: !!poleSitter && pred.pole_position === poleSitter,
              top3_p1_correct: partialSync ? (ex?.top3_p1_correct ?? false) : !!p1 && pred.top3_p1 === p1,
              top3_p2_correct: partialSync ? (ex?.top3_p2_correct ?? false) : !!p2 && pred.top3_p2 === p2,
              top3_p3_correct: partialSync ? (ex?.top3_p3_correct ?? false) : !!p3 && pred.top3_p3 === p3,
              p_what_correct: partialSync ? (ex?.p_what_correct ?? false) : pWhatWinners.has(pred.user_id),
              surprise_correct: ex?.surprise_correct ?? null,
              flop_correct: ex?.flop_correct ?? null,
              crazy_correct: ex?.crazy_correct ?? null,
              total_points: 0,
            };
          }),
          { onConflict: "user_id,race_weekend_id" }
        );
      }

      if (!partialSync) {
        await adminDb
          .from("race_weekends")
          .update({ results_synced: true })
          .eq("id", rw.id);
      }

      syncLog.push({
        race: rw.race_name,
        status: partialSync ? "partial" : "complete",
        detail: partialSync
          ? `qualifying synced (${qualifying.length} entries), race not available yet`
          : `qualifying (${qualifying.length}), race (${race.length}), sprint (${sprintRace.length}) synced`,
      });
    } catch (err) {
      syncLog.push({
        race: rw.race_name,
        status: "error",
        detail: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ message: "Cron sync complete.", synced: syncLog });
}
