import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  ] = await Promise.all([
    supabase.from("whitelisted_emails").select("*").order("created_at", { ascending: false }),
    supabase.from("race_weekends").select("*").order("round", { ascending: false }),
    supabase.from("profiles").select("*"),
    supabase.from("predictions").select("*"),
    supabase.from("scores").select("*"),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <SyncButton raceWeekends={raceWeekends ?? []} />
      </div>

      <AdminClient
        whitelist={whitelist ?? []}
        raceWeekends={raceWeekends ?? []}
        profiles={profiles ?? []}
        predictions={predictions ?? []}
        scores={scores ?? []}
      />
    </div>
  );
}
