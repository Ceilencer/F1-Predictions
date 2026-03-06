import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Countdown from "@/components/Countdown";
import PredictionCard from "@/components/PredictionCard";

// ── helpers ──────────────────────────────────────────────────────────────────

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-400 font-bold text-sm w-6">1st</span>;
  if (rank === 2) return <span className="text-slate-300 font-bold text-sm w-6">2nd</span>;
  if (rank === 3) return <span className="text-amber-600 font-bold text-sm w-6">3rd</span>;
  return <span className="text-muted font-medium text-sm w-6">#{rank}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface rounded-2xl border border-white/5 p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">{children}</p>;
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date().toISOString();

  // Upcoming race: soonest deadline in the future
  const { data: upcoming } = await supabase
    .from("race_weekends")
    .select("*")
    .gt("qualifying_deadline", now)
    .order("qualifying_deadline", { ascending: true })
    .limit(1)
    .maybeSingle();

  // If no upcoming, fall back to the most recent completed race
  const { data: currentRace } = upcoming
    ? { data: upcoming }
    : await supabase
        .from("race_weekends")
        .select("*")
        .lte("qualifying_deadline", now)
        .order("qualifying_deadline", { ascending: false })
        .limit(1)
        .maybeSingle();

  const isLocked = currentRace
    ? new Date() > new Date(currentRace.qualifying_deadline)
    : true;

  // Fetch own prediction, all race predictions, profiles, and scores in parallel
  const [
    { data: ownPred },
    { data: racePredictions },
    { data: profiles },
    { data: allScores },
  ] = await Promise.all([
    currentRace
      ? supabase.from("predictions").select("*").eq("user_id", user.id).eq("race_weekend_id", currentRace.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    currentRace
      ? supabase.from("predictions").select("*").eq("race_weekend_id", currentRace.id).order("submitted_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("profiles").select("*"),
    supabase.from("scores").select("*"),
  ]);

  const hasSubmitted = !!ownPred;
  const canViewPredictions = hasSubmitted || isLocked;

  // Build profile map from already-fetched profiles
  const profileMap: Record<string, string> = {};
  for (const p of profiles ?? []) {
    profileMap[p.id] = p.display_name;
  }

  // Sort own card first, then others by submitted_at
  const allPredictions = racePredictions ?? [];
  const sortedPredictions = [
    ...allPredictions.filter((p) => p.user_id === user.id),
    ...allPredictions.filter((p) => p.user_id !== user.id),
  ];

  // Leaderboard
  type LeaderboardEntry = { id: string; display_name: string; totalPoints: number; rank: number };
  const leaderboard: LeaderboardEntry[] = (profiles ?? [])
    .map((p) => ({
      ...p,
      totalPoints: (allScores ?? [])
        .filter((s) => s.user_id === p.id)
        .reduce((sum, s) => sum + (s.total_points ?? 0), 0),
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const myEntry = leaderboard.find((e) => e.id === user.id);
  const top3 = leaderboard.slice(0, 3);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* ── Current race weekend ── */}
      {currentRace ? (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted font-medium uppercase tracking-wide">
                  Round {currentRace.round} · {currentRace.season}
                </span>
                {currentRace.results_synced && (
                  <span className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-medium">
                    Results in
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white">{currentRace.race_name}</h2>

              <div className="mt-3 flex flex-col gap-1">
                <p className="text-xs text-muted">
                  Predictions lock:{" "}
                  <span className="text-white">
                    {new Date(currentRace.qualifying_deadline).toLocaleString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
                <Countdown deadline={currentRace.qualifying_deadline} />
              </div>
            </div>

            {/* Submission status */}
            <div className="shrink-0 flex flex-col items-start sm:items-end gap-3">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  hasSubmitted
                    ? "bg-accent/15 text-accent"
                    : isLocked
                    ? "bg-white/5 text-muted"
                    : "bg-yellow-500/10 text-yellow-400"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${hasSubmitted ? "bg-accent" : isLocked ? "bg-muted" : "bg-yellow-400"}`} />
                {hasSubmitted ? "Submitted" : isLocked ? "No submission" : "Not submitted"}
              </div>

              {!isLocked && (
                <Link
                  href="/predict"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors min-h-[44px] flex items-center"
                >
                  {hasSubmitted ? "Edit predictions" : "Submit predictions"}
                </Link>
              )}

            </div>
          </div>

          {/* P What teaser */}
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
            <span className="text-xs text-muted font-semibold uppercase tracking-widest">P What?</span>
            <span className="text-white font-mono font-bold text-sm">
              P{currentRace.p_what_position}
            </span>
            <span className="text-xs text-muted">— predict which driver finishes here</span>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-muted text-sm">No race weekends scheduled yet. Check back soon.</p>
        </Card>
      )}

      {/* ── Race predictions ── */}
      {currentRace && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Race Predictions</SectionLabel>
            {canViewPredictions && sortedPredictions.length > 0 && (
              <Link href={`/predict/${currentRace.id}/others`} className="text-xs text-accent hover:underline">
                Full view →
              </Link>
            )}
          </div>

          {!canViewPredictions ? (
            <Card>
              <div className="flex flex-col items-center text-center py-4 gap-3">
                <div className="h-10 w-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Submit your picks to see everyone else&apos;s</p>
                  <p className="text-xs text-muted mt-1">Predictions are hidden until you&apos;ve submitted — no spoilers!</p>
                </div>
                <Link
                  href="/predict"
                  className="mt-1 px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Make my predictions
                </Link>
              </div>
            </Card>
          ) : sortedPredictions.length === 0 ? (
            <Card>
              <p className="text-sm text-muted text-center py-2">No predictions submitted yet for this race.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedPredictions.map((prediction) => (
                <PredictionCard
                  key={prediction.id}
                  displayName={profileMap[prediction.user_id] ?? "Unknown"}
                  pWhatPosition={currentRace.p_what_position}
                  isOwn={prediction.user_id === user.id}
                  pole_position={prediction.pole_position}
                  top3_p1={prediction.top3_p1}
                  top3_p2={prediction.top3_p2}
                  top3_p3={prediction.top3_p3}
                  biggest_surprise={prediction.biggest_surprise}
                  biggest_flop={prediction.biggest_flop}
                  p_what_driver={prediction.p_what_driver}
                  crazy_prediction={prediction.crazy_prediction}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mini leaderboard ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Season Standings</SectionLabel>
          <Link href="/leaderboard" className="text-xs text-accent hover:underline">
            Full table →
          </Link>
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted">No scores yet — race results will appear here after the first race.</p>
        ) : (
          <div className="space-y-2">
            {top3.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                  entry.id === user.id ? "bg-accent/10 border border-accent/20" : "bg-background/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Medal rank={entry.rank} />
                  <span className="text-sm font-medium text-white truncate">
                    {entry.display_name}
                    {entry.id === user.id && (
                      <span className="ml-1.5 text-xs text-muted">(you)</span>
                    )}
                  </span>
                </div>
                <span className="text-sm font-bold text-accent tabular-nums">
                  {entry.totalPoints} pts
                </span>
              </div>
            ))}

            {/* Current user if outside top 3 */}
            {myEntry && myEntry.rank > 3 && (
              <>
                <div className="border-t border-white/5 my-1" />
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-3">
                    <Medal rank={myEntry.rank} />
                    <span className="text-sm font-medium text-white truncate">
                      {myEntry.display_name}
                      <span className="ml-1.5 text-xs text-muted">(you)</span>
                    </span>
                  </div>
                  <span className="text-sm font-bold text-accent tabular-nums">
                    {myEntry.totalPoints} pts
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
