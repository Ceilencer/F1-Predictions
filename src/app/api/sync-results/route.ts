import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── Jolpica API types ─────────────────────────────────────────────────────────

interface JolpicaResult {
  position: string;
  Driver: { code: string };
}
interface JolpicaRace {
  Results?: JolpicaResult[];
  QualifyingResults?: JolpicaResult[];
}
interface JolpicaData {
  MRData: { RaceTable: { Races: JolpicaRace[] } };
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin)
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  // Parse body
  let raceWeekendId: string;
  try {
    ({ raceWeekendId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!raceWeekendId) return NextResponse.json({ error: "raceWeekendId is required." }, { status: 400 });

  // Fetch race weekend
  const { data: raceWeekend } = await supabase
    .from("race_weekends")
    .select("*")
    .eq("id", raceWeekendId)
    .maybeSingle();

  if (!raceWeekend)
    return NextResponse.json({ error: "Race weekend not found." }, { status: 404 });

  // Fetch results from Jolpica
  const base = `https://api.jolpi.ca/ergast/f1/${raceWeekend.season}/${raceWeekend.round}`;
  const [raceRes, qualRes] = await Promise.all([
    fetch(`${base}/results.json`),
    fetch(`${base}/qualifying.json`),
  ]);

  if (!raceRes.ok || !qualRes.ok) {
    return NextResponse.json(
      { error: `Jolpica API returned an error. Race: ${raceRes.status}, Qual: ${qualRes.status}. The race may not have happened yet.` },
      { status: 502 }
    );
  }

  const raceData: JolpicaData = await raceRes.json();
  const qualData: JolpicaData = await qualRes.json();

  const raceResults = raceData.MRData.RaceTable.Races[0]?.Results ?? [];
  const qualResults = qualData.MRData.RaceTable.Races[0]?.QualifyingResults ?? [];

  if (raceResults.length === 0) {
    return NextResponse.json(
      { error: "No race results found. The race may not have happened yet." },
      { status: 422 }
    );
  }

  // Build position lookup maps
  const positionToCode: Record<number, string> = {};
  const codeToPosition: Record<string, number> = {};
  raceResults.forEach((r) => {
    const pos = parseInt(r.position);
    positionToCode[pos] = r.Driver.code;
    codeToPosition[r.Driver.code] = pos;
  });

  const poleSitter = qualResults.find((q) => q.position === "1")?.Driver.code ?? "";
  const p1 = positionToCode[1] ?? "";
  const p2 = positionToCode[2] ?? "";
  const p3 = positionToCode[3] ?? "";
  const pWhatActual = positionToCode[raceWeekend.p_what_position] ?? "";

  // Get all predictions for this race
  const { data: predictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("race_weekend_id", raceWeekendId);

  if (!predictions || predictions.length === 0) {
    // No predictions — still mark as synced
    await supabase
      .from("race_weekends")
      .update({ results_synced: true })
      .eq("id", raceWeekendId);
    return NextResponse.json({
      success: true,
      results: { poleSitter, p1, p2, p3, pWhatActual },
      message: "No predictions to score.",
    });
  }

  // ── P What? scoring ───────────────────────────────────────────────────────
  // Tier 1: exact match on driver who finished in p_what_position
  const exactMatches = predictions.filter(
    (p) => pWhatActual && p.p_what_driver === pWhatActual
  );

  let pWhatWinners: Set<string>;
  if (exactMatches.length > 0) {
    pWhatWinners = new Set(exactMatches.map((p) => p.user_id));
  } else {
    // Tier 2: closest driver to p_what_position by absolute position difference
    let minDist = Infinity;
    predictions.forEach((p) => {
      const driverPos = codeToPosition[p.p_what_driver] ?? Infinity;
      const dist = Math.abs(driverPos - raceWeekend.p_what_position);
      if (dist < minDist) minDist = dist;
    });
    pWhatWinners = new Set(
      predictions
        .filter((p) => {
          const driverPos = codeToPosition[p.p_what_driver] ?? Infinity;
          return Math.abs(driverPos - raceWeekend.p_what_position) === minDist;
        })
        .map((p) => p.user_id)
    );
  }

  // ── Fetch existing scores to preserve manually-set subjective values ─────
  const { data: existingScores } = await supabase
    .from("scores")
    .select("*")
    .eq("race_weekend_id", raceWeekendId);

  const existingMap = Object.fromEntries(
    (existingScores ?? []).map((s) => [s.user_id, s])
  );

  // ── Build score rows ───────────────────────────────────────────────────────
  const scoresToUpsert = predictions.map((pred) => {
    const existing = existingMap[pred.user_id];
    return {
      user_id: pred.user_id,
      race_weekend_id: raceWeekendId,
      pole_correct: !!poleSitter && pred.pole_position === poleSitter,
      top3_p1_correct: !!p1 && pred.top3_p1 === p1,
      top3_p2_correct: !!p2 && pred.top3_p2 === p2,
      top3_p3_correct: !!p3 && pred.top3_p3 === p3,
      p_what_correct: pWhatWinners.has(pred.user_id),
      // Preserve any subjective scores already set by the admin
      surprise_correct: existing?.surprise_correct ?? null,
      flop_correct: existing?.flop_correct ?? null,
      crazy_correct: existing?.crazy_correct ?? null,
      total_points: 0, // recomputed by DB trigger
    };
  });

  const { error: upsertError } = await supabase
    .from("scores")
    .upsert(scoresToUpsert, { onConflict: "user_id,race_weekend_id" });

  if (upsertError)
    return NextResponse.json({ error: upsertError.message }, { status: 500 });

  // Mark race weekend as synced
  await supabase
    .from("race_weekends")
    .update({ results_synced: true })
    .eq("id", raceWeekendId);

  return NextResponse.json({
    success: true,
    results: { poleSitter, p1, p2, p3, pWhatActual },
    pWhatWinners: [...pWhatWinners],
    scoredCount: predictions.length,
  });
}
