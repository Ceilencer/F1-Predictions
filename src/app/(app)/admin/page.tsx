import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SEASON } from "@/config/calendar";
import AdminClient from "./AdminClient";
import SyncButton from "./SyncButton";

export default async function AdminPage() {
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
    { data: whitelist },
    { data: raceWeekends },
    { data: profiles },
    { data: predictions },
    { data: scores },
    { data: teams },
    { data: drivers },
    { data: seasonSeats },
    { data: weekendDrivers },
  ] = await Promise.all([
    supabase.from("whitelisted_emails").select("*").order("created_at", { ascending: false }),
    supabase.from("race_weekends").select("*").order("round", { ascending: false }),
    supabase.from("profiles").select("*"),
    supabase.from("predictions").select("*"),
    supabase.from("scores").select("*"),
    supabase.from("teams").select("*").order("sort_order", { ascending: true }),
    supabase.from("drivers").select("*"),
    supabase.from("season_seats").select("*").eq("season", SEASON),
    supabase.from("race_weekend_drivers").select("*"),
  ]);

  // Auto-detect the race to sync: earliest unsynced race whose qualifying
  // deadline has already passed (works for both standard and sprint weekends).
  const now = new Date().toISOString();
  const raceToSync =
    (raceWeekends ?? [])
      .filter((r) => !r.results_synced && r.qualifying_deadline < now)
      .sort((a, b) => a.round - b.round)[0] ?? null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <SyncButton race={raceToSync} />
      </div>

      <AdminClient
        whitelist={whitelist ?? []}
        raceWeekends={raceWeekends ?? []}
        profiles={profiles ?? []}
        predictions={predictions ?? []}
        scores={scores ?? []}
        teams={teams ?? []}
        drivers={drivers ?? []}
        seasonSeats={seasonSeats ?? []}
        weekendDrivers={weekendDrivers ?? []}
        season={SEASON}
      />
    </div>
  );
}
