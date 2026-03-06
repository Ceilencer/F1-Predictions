import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PredictionCard from "@/components/PredictionCard";

interface PageProps {
  params: Promise<{ raceId: string }>;
}

export default async function OthersPredictionsPage({ params }: PageProps) {
  const { raceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch race weekend
  const { data: raceWeekend } = await supabase
    .from("race_weekends")
    .select("*")
    .eq("id", raceId)
    .maybeSingle();

  if (!raceWeekend) notFound();

  const isLocked = new Date() > new Date(raceWeekend.qualifying_deadline);

  // Check current user's own submission
  const { data: ownPrediction } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", user.id)
    .eq("race_weekend_id", raceId)
    .maybeSingle();

  // Access rule: must have submitted OR deadline must have passed
  if (!ownPrediction && !isLocked) {
    redirect("/predict");
  }

  // Fetch ALL submitted predictions for this race (including own), ordered by submitted_at
  const { data: allPredictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("race_weekend_id", raceId)
    .order("submitted_at", { ascending: true });

  const predictions = allPredictions ?? [];

  // Fetch all relevant profiles in one query
  const userIds = [...new Set(predictions.map((p) => p.user_id))];
  const profileMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    for (const profile of profiles ?? []) {
      profileMap[profile.id] = profile.display_name;
    }
  }

  // Sort: own prediction first, then others by submitted_at
  const sorted = [
    ...predictions.filter((p) => p.user_id === user.id),
    ...predictions.filter((p) => p.user_id !== user.id),
  ];

  const others = sorted.filter((p) => p.user_id !== user.id);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/predict"
          className="flex items-center gap-1.5 text-muted hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          My predictions
        </Link>
      </div>

      <div className="mb-6">
        <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-1">
          Round {raceWeekend.round} · {raceWeekend.season}
        </p>
        <h1 className="text-2xl font-bold text-white">{raceWeekend.race_name}</h1>
        <p className="text-sm text-muted mt-1">Everyone&apos;s predictions</p>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-white/5 p-10 text-center">
          <p className="text-white font-semibold mb-1">No predictions submitted yet</p>
          <p className="text-sm text-muted">Check back after others have made their picks.</p>
        </div>
      ) : others.length === 0 && ownPrediction ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <PredictionCard
              key={ownPrediction.id}
              displayName={profileMap[ownPrediction.user_id] ?? "You"}
              pWhatPosition={raceWeekend.p_what_position}
              isOwn
              pole_position={ownPrediction.pole_position}
              top3_p1={ownPrediction.top3_p1}
              top3_p2={ownPrediction.top3_p2}
              top3_p3={ownPrediction.top3_p3}
              biggest_surprise={ownPrediction.biggest_surprise}
              biggest_flop={ownPrediction.biggest_flop}
              p_what_driver={ownPrediction.p_what_driver}
              crazy_prediction={ownPrediction.crazy_prediction}
            />
          </div>
          <div className="bg-surface rounded-2xl border border-white/5 p-6 text-center">
            <p className="text-sm text-muted">Nobody else has submitted yet — check back later.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map((prediction) => (
            <PredictionCard
              key={prediction.id}
              displayName={profileMap[prediction.user_id] ?? "Unknown"}
              pWhatPosition={raceWeekend.p_what_position}
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
  );
}
