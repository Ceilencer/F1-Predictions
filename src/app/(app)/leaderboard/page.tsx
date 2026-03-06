import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="w-8 text-center text-sm font-bold text-yellow-400">1st</span>
    );
  if (rank === 2)
    return (
      <span className="w-8 text-center text-sm font-bold text-slate-300">2nd</span>
    );
  if (rank === 3)
    return (
      <span className="w-8 text-center text-sm font-bold text-amber-600">3rd</span>
    );
  return (
    <span className="w-8 text-center text-sm font-medium text-muted">#{rank}</span>
  );
}

function PointDot({ value }: { value: boolean | null }) {
  if (value === true)
    return <span className="w-2 h-2 rounded-full bg-accent inline-block" title="Correct" />;
  if (value === false)
    return <span className="w-2 h-2 rounded-full bg-white/10 inline-block" title="Incorrect" />;
  return <span className="w-2 h-2 rounded-full bg-white/5 inline-block" title="Not scored" />;
}

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profiles }, { data: allScores }, { data: races }] =
    await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("scores").select("*"),
      supabase
        .from("race_weekends")
        .select("*")
        .order("round", { ascending: true }),
    ]);

  type Row = {
    id: string;
    display_name: string;
    totalPoints: number;
    rank: number;
    scoresByRace: Record<string, number>;
    expanded: boolean;
  };

  const leaderboard: Row[] = (profiles ?? [])
    .map((p) => {
      const userScores = (allScores ?? []).filter((s) => s.user_id === p.id);
      const totalPoints = userScores.reduce(
        (sum, s) => sum + (s.total_points ?? 0),
        0
      );
      const scoresByRace: Record<string, number> = {};
      userScores.forEach((s) => {
        scoresByRace[s.race_weekend_id] = s.total_points ?? 0;
      });
      return { ...p, totalPoints, scoresByRace, expanded: false };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const completedRaces = (races ?? []).filter((r) =>
    (allScores ?? []).some((s) => s.race_weekend_id === r.id)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Season Standings</h1>

      {leaderboard.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-white/5 p-8 text-center">
          <p className="text-muted">No scores yet. Check back after the first race weekend.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden md:grid md:grid-cols-[auto_1fr_auto] items-center px-5 py-3 border-b border-white/5">
            <span className="w-8 text-xs text-muted font-semibold uppercase tracking-widest">#</span>
            <span className="text-xs text-muted font-semibold uppercase tracking-widest">Player</span>
            <span className="text-xs text-muted font-semibold uppercase tracking-widest text-right">Pts</span>
          </div>

          {leaderboard.map((entry, idx) => {
            const isMe = entry.id === user.id;
            const racePoints = completedRaces.map(
              (r) => entry.scoresByRace[r.id] ?? "-"
            );

            return (
              <div
                key={entry.id}
                className={`border-b border-white/5 last:border-0 ${
                  isMe ? "bg-accent/5" : ""
                }`}
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-4">
                  <RankBadge rank={entry.rank} />

                  {/* Left accent stripe by position */}
                  <div
                    className={`w-0.5 self-stretch rounded-full ${
                      entry.rank === 1
                        ? "bg-yellow-400"
                        : entry.rank === 2
                        ? "bg-slate-300"
                        : entry.rank === 3
                        ? "bg-amber-600"
                        : "bg-white/10"
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {entry.display_name}
                      {isMe && (
                        <span className="ml-2 text-xs text-accent font-normal">you</span>
                      )}
                    </p>
                    {/* Mobile: per-race dots */}
                    {completedRaces.length > 0 && (
                      <div className="mt-1 md:hidden flex flex-wrap gap-1.5 items-center">
                        {completedRaces.map((r) => (
                          <span
                            key={r.id}
                            className="text-xs text-muted tabular-nums"
                            title={r.race_name}
                          >
                            R{r.round}:{" "}
                            <span className="text-white">
                              {entry.scoresByRace[r.id] ?? "-"}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Desktop: per-race points */}
                  <div className="hidden md:flex items-center gap-2 mr-4">
                    {completedRaces.map((r) => (
                      <span
                        key={r.id}
                        className="text-xs tabular-nums text-muted w-5 text-center"
                        title={`${r.race_name}: ${entry.scoresByRace[r.id] ?? "-"} pts`}
                      >
                        {entry.scoresByRace[r.id] ?? "-"}
                      </span>
                    ))}
                  </div>

                  <span className="text-base font-bold text-accent tabular-nums shrink-0 ml-auto pl-3">
                    {entry.totalPoints}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Race header key (desktop) */}
      {completedRaces.length > 0 && (
        <div className="mt-4 hidden md:flex items-center gap-2 px-1">
          <span className="text-xs text-muted">Rounds: </span>
          {completedRaces.map((r) => (
            <span key={r.id} className="text-xs text-muted">
              R{r.round} = {r.race_name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
