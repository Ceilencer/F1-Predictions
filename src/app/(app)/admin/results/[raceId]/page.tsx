import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ResultsClient from "./ResultsClient";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ raceId: string }>;
}) {
  const { raceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/");

  const [
    { data: raceWeekend },
    { data: raceResults },
    { data: predictions },
    { data: scores },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("race_weekends").select("*").eq("id", raceId).maybeSingle(),
    supabase.from("race_results").select("*").eq("race_weekend_id", raceId).maybeSingle(),
    supabase.from("predictions").select("*").eq("race_weekend_id", raceId),
    supabase.from("scores").select("*").eq("race_weekend_id", raceId),
    supabase.from("profiles").select("*"),
  ]);

  if (!raceWeekend) redirect("/admin");

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Admin
      </Link>

      <div className="mb-6">
        <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
          Round {raceWeekend.round} · {raceWeekend.season}
        </p>
        <h1 className="text-2xl font-bold text-white">{raceWeekend.race_name}</h1>
        <p className="text-sm text-muted mt-1">
          P{raceWeekend.p_what_position} mystery question ·{" "}
          {predictions?.length ?? 0} prediction{predictions?.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ResultsClient
        raceWeekend={raceWeekend}
        initialResults={raceResults ?? null}
        initialPredictions={predictions ?? []}
        initialScores={scores ?? []}
        profiles={profiles ?? []}
      />
    </div>
  );
}
