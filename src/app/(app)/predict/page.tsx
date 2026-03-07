import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PredictForm from "./PredictForm";

export default async function PredictPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date().toISOString();

  // Upcoming/active race: earliest race whose start time hasn't passed yet.
  // Uses race_start so the race shows as active through qualifying (locked) and
  // up until the race itself begins, not just until the qualifying deadline.
  const { data: upcoming } = await supabase
    .from("race_weekends")
    .select("*")
    .gt("race_start", now)
    .order("race_start", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: raceWeekend } = upcoming
    ? { data: upcoming }
    : await supabase
        .from("race_weekends")
        .select("*")
        .lte("race_start", now)
        .order("race_start", { ascending: false })
        .limit(1)
        .maybeSingle();

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
    ? new Date() > new Date(raceWeekend.qualifying_deadline)
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
        />
      )}
    </div>
  );
}
