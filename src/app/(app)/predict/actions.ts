"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface PredictionPayload {
  raceWeekendId: string;
  isSprint: boolean;
  pole_position: string;
  top3_p1: string;
  top3_p2: string;
  top3_p3: string;
  biggest_surprise: string;
  biggest_flop: string;
  crazy_prediction: string;
  p_what_driver: string;
  sprint_pole: string;
  sprint_winner: string;
}

export async function submitPredictions(
  payload: PredictionPayload
): Promise<{ error?: string; success?: true }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Re-validate deadline server-side (client can't be trusted)
  const { data: raceWeekend } = await supabase
    .from("race_weekends")
    .select("*")
    .eq("id", payload.raceWeekendId)
    .maybeSingle();

  if (!raceWeekend) return { error: "Race weekend not found." };
  if (new Date() > new Date(raceWeekend.qualifying_deadline)) {
    return { error: "The prediction deadline has passed." };
  }

  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      race_weekend_id: payload.raceWeekendId,
      pole_position: payload.pole_position,
      top3_p1: payload.top3_p1,
      top3_p2: payload.top3_p2,
      top3_p3: payload.top3_p3,
      biggest_surprise: payload.biggest_surprise,
      biggest_flop: payload.biggest_flop,
      crazy_prediction: payload.crazy_prediction,
      p_what_driver: payload.p_what_driver,
      sprint_pole: payload.isSprint ? payload.sprint_pole : null,
      sprint_winner: payload.isSprint ? payload.sprint_winner : null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,race_weekend_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/predict");
  revalidatePath("/");
  return { success: true };
}
