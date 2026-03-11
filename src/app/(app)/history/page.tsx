import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: races } = await supabase
    .from("race_weekends")
    .select("*")
    .order("round", { ascending: false });

  const past = (races ?? []).filter(
    (r) => new Date(r.qualifying_deadline) < new Date()
  );
  const upcoming = (races ?? []).filter(
    (r) => new Date(r.qualifying_deadline) >= new Date()
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Race History</h1>

      {races?.length === 0 && (
        <div className="bg-surface rounded-2xl border border-white/5 p-8 text-center">
          <p className="text-muted">No race weekends yet.</p>
        </div>
      )}

      {past.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Completed</p>
          <div className="space-y-2">
            {past.map((r) => (
              <Link
                key={r.id}
                href={`/history/${r.id}`}
                className="
                  bg-surface rounded-xl border border-white/5 px-4 py-3
                  flex items-center justify-between
                  hover:border-accent/30 hover:bg-surface-hover
                  transition-colors group
                "
              >
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-accent transition-colors">
                    {r.race_name}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Round {r.round} · {r.season}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.results_synced ? (
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                      Results in
                    </span>
                  ) : (
                    <span className="text-xs text-muted bg-white/5 px-2 py-0.5 rounded-full">
                      Pending
                    </span>
                  )}
                  <svg
                    className="w-4 h-4 text-muted group-hover:text-accent transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Upcoming</p>
          <div className="space-y-2">
            {[...upcoming].reverse().map((r) => (
              <div
                key={r.id}
                className="bg-surface rounded-xl border border-white/5 px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{r.race_name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    Round {r.round} · {r.season}
                  </p>
                </div>
                <span className="text-xs text-muted">
                  {new Date(r.qualifying_deadline).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
