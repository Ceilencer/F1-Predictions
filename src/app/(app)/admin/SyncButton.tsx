"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { syncRaceResults, type SyncType } from "./results/[raceId]/actions";
import type { Database } from "@/lib/supabase/database.types";

type RaceWeekend = Database["public"]["Tables"]["race_weekends"]["Row"];

export default function SyncButton({ race }: { race: RaceWeekend | null }) {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!race) return null;

  function sync() {
    if (!race) return;
    setMsg(null);
    startTransition(async () => {
      const res = await syncRaceResults(race.id);
      if (res.error) {
        setMsg({ text: res.error, error: true });
      } else {
        const messages: Record<SyncType, string> = {
          "sprint-only":       `Sprint synced! Sync again after main qualifying.`,
          "qualifying-only":   `Qualifying synced! Sync again after the race.`,
          "sprint+qualifying": `Sprint + qualifying synced! Sync again after the race.`,
          "full":              `Fully synced! ${res.scoredCount} prediction${res.scoredCount !== 1 ? "s" : ""} scored.`,
        };
        setMsg({ text: messages[res.syncType ?? "full"] });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2 items-center">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted">Ready to sync</p>
          <p className="text-sm text-white font-medium truncate max-w-[200px]">
            R{race.round} — {race.race_name}
          </p>
        </div>
        <button
          onClick={sync}
          disabled={pending}
          className="min-h-[44px] px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {pending ? "Syncing…" : "Sync Results"}
        </button>
        <Link
          href={`/admin/results/${race.id}`}
          className="min-h-[44px] px-4 rounded-lg border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center whitespace-nowrap"
        >
          Details →
        </Link>
      </div>
      {msg && (
        <p className={`text-xs text-right max-w-sm ${msg.error ? "text-red-400" : "text-green-400"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
