import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PredictForm from "./PredictForm";

export default async function PredictPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();

  // Upcoming/active race: first race whose results haven't been synced yet.
  // This keeps AUS GP as the "current" race until results are published,
  // regardless of whether race_start has passed — preventing the next race's
  // predictions from opening prematurely.
  const { data: upcoming } = await supabase
    .from("race_weekends")
    .select("*")
    .eq("results_synced", false)
    .order("race_start", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: raceWeekend } = upcoming
    ? { data: upcoming }
    : await supabase
        .from("race_weekends")
        .select("*")
        .eq("results_synced", true)
        .order("race_start", { ascending: false })
        .limit(1)
        .maybeSingle();

  // Previous race — used to compute when predictions open (12h after it ends).
  // Only relevant when there's an upcoming race (not the current/most-recent one).
  const { data: previousRace } = upcoming
    ? await supabase
        .from("race_weekends")
        .select("race_start")
        .lt("race_start", upcoming.race_start)
        .order("race_start", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Predictions open 12 hours after the previous race starts.
  // If there's no previous race (season opener), predictions open immediately.
  const predictionsOpenAt = previousRace
    ? new Date(new Date(previousRace.race_start).getTime() + 12 * 60 * 60 * 1000).toISOString()
    : null;

  // Computed server-side so the gate is based on server time, not the client clock.
  const notOpenYet = !!predictionsOpenAt && now < new Date(predictionsOpenAt);

  // Existing prediction for this race
  const { data: existing } = raceWeekend
    ? await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id)
        .eq("race_weekend_id", raceWeekend.id)
        .maybeSingle()
    : { data: null };

  const isLocked = raceWeekend
    ? now > new Date(raceWeekend.qualifying_deadline)
    : true;

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Predictions</h1>

      {!raceWeekend ? (
        <div className="bg-surface rounded-2xl border border-white/5 p-8 text-center">
          <p className="text-muted">No race weekends have been scheduled yet.</p>
          <p className="text-sm text-muted mt-1">The admin will add races before the season begins.</p>
        </div>
      ) : (
        <PredictForm
          raceWeekend={raceWeekend}
          existing={existing}
          isLocked={isLocked}
          predictionsOpenAt={predictionsOpenAt}
          notOpenYet={notOpenYet}
        />
      )}
    </div>
  );
}
