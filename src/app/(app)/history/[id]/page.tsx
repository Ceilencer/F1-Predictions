import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDriverByCode, getTeamByShortName } from "@/config/drivers";

// ── Jolpica API types ─────────────────────────────────────────────────────────

interface JolpicaResult {
  position: string;
  Driver: { code: string; familyName: string; givenName: string };
  Constructor: { name: string };
}
interface JolpicaRace {
  Results?: JolpicaResult[];
  QualifyingResults?: JolpicaResult[];
}
interface JolpicaData {
  MRData: { RaceTable: { Races: JolpicaRace[] } };
}

async function fetchResults(season: number, round: number) {
  try {
    const base = `https://api.jolpi.ca/ergast/f1/${season}/${round}`;
    const [raceRes, qualRes] = await Promise.all([
      fetch(`${base}/results.json`, { next: { revalidate: 3600 } }),
      fetch(`${base}/qualifying.json`, { next: { revalidate: 3600 } }),
    ]);
    if (!raceRes.ok || !qualRes.ok) return null;
    const race: JolpicaData = await raceRes.json();
    const qual: JolpicaData = await qualRes.json();
    return {
      raceResults: race.MRData.RaceTable.Races[0]?.Results ?? [],
      qualResults: qual.MRData.RaceTable.Races[0]?.QualifyingResults ?? [],
    };
  } catch {
    return null;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function ScoreBadge({ correct }: { correct: boolean | null }) {
  if (correct === true)
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/15 text-green-400 text-xs font-bold">
        ✓
      </span>
    );
  if (correct === false)
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/10 text-red-400 text-xs font-bold">
        ✗
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/5 text-muted text-xs">
      —
    </span>
  );
}

function DriverTag({ code }: { code: string }) {
  const driver = getDriverByCode(code);
  const team = !driver ? getTeamByShortName(code) : null;
  const colour = driver?.team.colour ?? team?.colour ?? "#6b7280";
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="w-1 h-4 rounded-full shrink-0"
        style={{ backgroundColor: colour }}
      />
      <span className="font-mono text-sm text-white">{code}</span>
      {driver && (
        <span className="text-xs text-muted hidden sm:inline">
          {driver.name.split(" ").at(-1)}
        </span>
      )}
    </span>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  sprint_pole: "Spr Pole",
  sprint_winner: "Spr Win",
  pole_position: "Pole",
  top3_p1: "P1",
  top3_p2: "P2",
  top3_p3: "P3",
  biggest_surprise: "Surprise",
  biggest_flop: "Flop",
  crazy_prediction: "Wildcard",
  p_what_driver: "P What?",
};

// ── page ─────────────────────────────────────────────────────────────────────

export default async function RaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const [{ data: raceWeekend }, { data: predictions }, { data: profiles }, { data: scores }] =
    await Promise.all([
      supabase.from("race_weekends").select("*").eq("id", id).maybeSingle(),
      supabase.from("predictions").select("*").eq("race_weekend_id", id),
      supabase.from("profiles").select("*"),
      supabase.from("scores").select("*").eq("race_weekend_id", id),
    ]);

  if (!raceWeekend) notFound();

  // Only fetch actual results if the race is synced
  const actualResults = raceWeekend.results_synced
    ? await fetchResults(raceWeekend.season, raceWeekend.round)
    : null;

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.display_name])
  );
  const scoreMap = Object.fromEntries(
    (scores ?? []).map((s) => [s.user_id, s])
  );

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/history" className="inline-flex items-center gap-1 text-sm text-muted hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Race History
      </Link>

      {/* Race header */}
      <div>
        <p className="text-xs text-muted uppercase tracking-widest font-semibold">
          Round {raceWeekend.round} · {raceWeekend.season}
        </p>
        <h1 className="text-2xl font-bold text-white mt-1">{raceWeekend.race_name}</h1>
        <p className="text-sm text-muted mt-1">
          P What? position: <span className="text-accent font-bold">P{raceWeekend.p_what_position}</span>
        </p>
      </div>

      {/* Actual results */}
      {actualResults && (
        <div className="bg-surface rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">Actual Results</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted mb-2">Qualifying</p>
              <div className="space-y-1">
                {actualResults.qualResults.slice(0, 5).map((r) => (
                  <div key={r.position} className="flex items-center gap-2 text-sm">
                    <span className="text-muted w-4 text-right">{r.position}</span>
                    <DriverTag code={r.Driver.code} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted mb-2">Race</p>
              <div className="space-y-1">
                {actualResults.raceResults.slice(0, 5).map((r) => (
                  <div key={r.position} className="flex items-center gap-2 text-sm">
                    <span className="text-muted w-4 text-right">{r.position}</span>
                    <DriverTag code={r.Driver.code} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* P What actual */}
          {(() => {
            const pWhatDriver = actualResults.raceResults.find(
              (r) => parseInt(r.position) === raceWeekend.p_what_position
            );
            return pWhatDriver ? (
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-sm">
                <span className="text-muted">P{raceWeekend.p_what_position} was:</span>
                <DriverTag code={pWhatDriver.Driver.code} />
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Per-user predictions */}
      {predictions && predictions.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest">Predictions</p>
          {predictions.map((pred) => {
            const score = scoreMap[pred.user_id];
            const name = profileMap[pred.user_id] ?? "Unknown";
            const totalPoints = score?.total_points ?? null;

            return (
              <div
                key={pred.user_id}
                className="bg-surface rounded-2xl border border-white/5 overflow-hidden"
              >
                {/* User header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <p className="font-semibold text-white text-sm">
                    {name}
                    {pred.user_id === user.id && (
                      <span className="ml-2 text-xs text-accent">you</span>
                    )}
                  </p>
                  {totalPoints !== null ? (
                    <span className="text-sm font-bold text-accent">{totalPoints} pts</span>
                  ) : (
                    <span className="text-xs text-muted">Not scored</span>
                  )}
                </div>

                {/* Predictions list */}
                <div className="divide-y divide-white/5">
                  {(
                    [
                      ...(raceWeekend.is_sprint_weekend ? [
                        ["sprint_pole",   pred.sprint_pole   ?? "", score?.sprint_pole_correct],
                        ["sprint_winner", pred.sprint_winner ?? "", score?.sprint_winner_correct],
                      ] : []),
                      ["pole_position",   pred.pole_position,   score?.pole_correct],
                      ["top3_p1",         pred.top3_p1,         score?.top3_p1_correct],
                      ["top3_p2",         pred.top3_p2,         score?.top3_p2_correct],
                      ["top3_p3",         pred.top3_p3,         score?.top3_p3_correct],
                      ["biggest_surprise", pred.biggest_surprise, score?.surprise_correct],
                      ["biggest_flop",    pred.biggest_flop,    score?.flop_correct],
                      ["p_what_driver",   pred.p_what_driver,   score?.p_what_correct],
                    ] as [string, string, boolean | null | undefined][]
                  ).map(([key, value, correct]) => (
                    <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-xs text-muted w-16 shrink-0">
                        {CATEGORY_LABELS[key]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <DriverTag code={value} />
                      </div>
                      <ScoreBadge correct={correct ?? null} />
                    </div>
                  ))}

                  {/* Crazy prediction */}
                  <div className="flex items-start gap-3 px-4 py-2.5">
                    <span className="text-xs text-muted w-16 shrink-0 pt-0.5">Wildcard</span>
                    <p className="flex-1 text-sm text-white italic min-w-0">
                      &ldquo;{pred.crazy_prediction}&rdquo;
                    </p>
                    <ScoreBadge correct={score?.crazy_correct ?? null} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-white/5 p-8 text-center">
          <p className="text-muted text-sm">No predictions were submitted for this race.</p>
        </div>
      )}
    </div>
  );
}
