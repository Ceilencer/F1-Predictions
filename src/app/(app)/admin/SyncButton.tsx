"use client";

import { useState } from "react";
import type { Database } from "@/lib/supabase/database.types";

type RaceWeekend = Database["public"]["Tables"]["race_weekends"]["Row"];

export default function SyncButton({ raceWeekends }: { raceWeekends: RaceWeekend[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const eligibleRaces = raceWeekends.filter(
    (r) => new Date(r.qualifying_deadline) < new Date()
  );

  async function sync() {
    if (!selectedId) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceWeekendId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error ?? "Sync failed.", error: true });
      } else {
        setMsg({ text: `Sync complete! Pole: ${data.results.poleSitter}, P1: ${data.results.p1}, P2: ${data.results.p2}, P3: ${data.results.p3}.` });
        setSelectedId("");
      }
    } catch {
      setMsg({ text: "Network error. Check your connection.", error: true });
    } finally {
      setLoading(false);
    }
  }

  if (eligibleRaces.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 items-center">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="min-h-[44px] px-3 py-2 rounded-lg text-sm bg-surface border border-white/10 text-white focus:border-accent focus:outline-none"
        >
          <option value="">Sync results for…</option>
          {eligibleRaces.map((r) => (
            <option key={r.id} value={r.id}>
              R{r.round} — {r.race_name} {r.results_synced ? "(already synced)" : ""}
            </option>
          ))}
        </select>
        <button
          onClick={sync}
          disabled={!selectedId || loading}
          className="min-h-[44px] px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          {loading ? "Syncing…" : "Sync F1 results"}
        </button>
      </div>
      {msg && (
        <p className={`text-xs ${msg.error ? "text-red-400" : "text-green-400"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
