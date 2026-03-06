import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile — create it if the trigger somehow missed it
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").insert({
      id: user.id,
      display_name: user.user_metadata?.full_name ?? user.email ?? "Unknown",
      is_admin: false,
    });
    // Re-fetch after insert
    const { data: fresh } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    profile = fresh;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        displayName={profile?.display_name || user.email || "Unknown"}
        isAdmin={profile?.is_admin ?? false}
      />
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
