"use client";

import { useState, useTransition } from "react";
import DriverPickerModal from "@/components/DriverPickerModal";
import { submitPredictions } from "./actions";
import type { Database } from "@/lib/supabase/database.types";
import type { DriverMap, TeamMap, GridTeamWithDrivers } from "@/lib/grid-types";

type RaceWeekend = Database["public"]["Tables"]["race_weekends"]["Row"];
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];

interface PredictFormProps {
  raceWeekend: RaceWeekend;
  existing: Prediction | null;
  isLocked: boolean;
  /** ISO string of when predictions open — shown to the user */
  predictionsOpenAt: string | null;
  /** Server-computed gate: true if predictions aren't open yet */
  notOpenYet: boolean;
  /** This weekend's grid + lookups, resolved server-side. */
  grid: GridTeamWithDrivers[];
  driverMap: DriverMap;
  teamMap: TeamMap;
}

interface FormState {
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

function FieldCard({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-white/5 p-4 space-y-2">
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function PredictForm({ raceWeekend, existing, isLocked, predictionsOpenAt, notOpenYet, grid, driverMap, teamMap }: PredictFormProps) {
  // Shared grid data every driver/team picker needs.
  const pickerProps = { grid, driverMap, teamMap };
  const [form, setForm] = useState<FormState>({
    pole_position:    existing?.pole_position    ?? "",
    top3_p1:          existing?.top3_p1          ?? "",
    top3_p2:          existing?.top3_p2          ?? "",
    top3_p3:          existing?.top3_p3          ?? "",
    biggest_surprise: existing?.biggest_surprise ?? "",
    biggest_flop:     existing?.biggest_flop     ?? "",
    crazy_prediction: existing?.crazy_prediction ?? "",
    p_what_driver:    existing?.p_what_driver    ?? "",
    sprint_pole:      existing?.sprint_pole      ?? "",
    sprint_winner:    existing?.sprint_winner    ?? "",
  });

  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Unlocked once the user has submitted (either previously or just now) or deadline has passed
  const canViewOthers = isLocked || !!existing || success;

  function set(field: keyof FormState) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setSuccess(false);
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const required: (keyof FormState)[] = [
      "pole_position", "top3_p1", "top3_p2", "top3_p3",
      "biggest_surprise", "biggest_flop", "crazy_prediction", "p_what_driver",
      ...(raceWeekend.is_sprint_weekend ? ["sprint_pole", "sprint_winner"] as (keyof FormState)[] : []),
    ];
    for (const k of required) {
      if (!form[k].trim()) {
        setError("Please fill in all fields before submitting.");
        return;
      }
    }

    startTransition(async () => {
      const result = await submitPredictions({
        raceWeekendId: raceWeekend.id,
        isSprint: raceWeekend.is_sprint_weekend,
        ...form,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const locked = isLocked || isPending;

  if (notOpenYet) {
    return (
      <div className="space-y-4">
        <div className="bg-surface rounded-xl border border-white/5 p-4">
          <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-1">
            Round {raceWeekend.round} · {raceWeekend.season}
          </p>
          <h2 className="text-lg font-bold text-white">{raceWeekend.race_name}</h2>
        </div>
        <div className="bg-surface rounded-xl border border-white/5 p-6 text-center space-y-2">
          <p className="text-white font-semibold">Predictions not open yet</p>
          <p className="text-sm text-muted">
            Opens{" "}
            {new Date(predictionsOpenAt!).toLocaleString("en-GB", {
              weekday: "short", day: "numeric", month: "short",
              hour: "2-digit", minute: "2-digit", timeZoneName: "short",
            })}
          </p>
          <p className="text-xs text-muted">12 hours after the previous race finishes.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Race header */}
      <div className="bg-surface rounded-xl border border-white/5 p-4">
        <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-1">
          Round {raceWeekend.round} · {raceWeekend.season}
        </p>
        <h2 className="text-lg font-bold text-white">{raceWeekend.race_name}</h2>
        {isLocked ? (
          <p className="mt-2 text-sm text-red-400 font-medium">
            Predictions are locked — the qualifying deadline has passed.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Deadline:{" "}
            {new Date(raceWeekend.qualifying_deadline).toLocaleString("en-GB", {
              weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {/* Success banner */}
      {success && (
        <div className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
          Predictions saved successfully!
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Sprint weekend badge */}
      {raceWeekend.is_sprint_weekend && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <span className="text-yellow-400 text-sm font-semibold">⚡ Sprint Weekend</span>
          <span className="text-xs text-muted">Extra predictions required for the sprint race.</span>
        </div>
      )}

      {/* Pole Position */}
      <FieldCard label="Pole Position" description="Which driver will qualify P1 for the main race?">
        <DriverPickerModal
          value={form.pole_position}
          onChange={set("pole_position")}
          disabled={locked}
          {...pickerProps}
        />
      </FieldCard>

      {/* Sprint fields — only on sprint weekends */}
      {raceWeekend.is_sprint_weekend && (
        <>
          <FieldCard label="Sprint Pole" description="Which driver will take P1 in sprint qualifying?">
            <DriverPickerModal
              value={form.sprint_pole}
              onChange={set("sprint_pole")}
              disabled={locked}
              {...pickerProps}
            />
          </FieldCard>

          <FieldCard label="Sprint Winner" description="Which driver will win the sprint race?">
            <DriverPickerModal
              value={form.sprint_winner}
              onChange={set("sprint_winner")}
              disabled={locked}
              {...pickerProps}
            />
          </FieldCard>
        </>
      )}

      {/* Race Winner */}
      <FieldCard label="Race Winner — P1" description="Who crosses the line first?">
        <DriverPickerModal
          value={form.top3_p1}
          onChange={set("top3_p1")}
          disabled={locked}
          {...pickerProps}
        />
      </FieldCard>

      {/* P2 */}
      <FieldCard label="P2 Finisher" description="Who finishes second?">
        <DriverPickerModal
          value={form.top3_p2}
          onChange={set("top3_p2")}
          disabled={locked}
          {...pickerProps}
        />
      </FieldCard>

      {/* P3 */}
      <FieldCard label="P3 Finisher" description="Who takes the final podium spot?">
        <DriverPickerModal
          value={form.top3_p3}
          onChange={set("top3_p3")}
          disabled={locked}
          {...pickerProps}
        />
      </FieldCard>

      {/* Biggest Good Surprise — driver or team */}
      <FieldCard
        label="Biggest Good Surprise"
        description="Pick a driver or a team who will overperform expectations."
      >
        <DriverPickerModal
          value={form.biggest_surprise}
          onChange={set("biggest_surprise")}
          disabled={locked}
          allowTeams
          {...pickerProps}
        />
      </FieldCard>

      {/* Biggest Flop — driver or team */}
      <FieldCard
        label="Biggest Flop"
        description="Pick a driver or a team who will underperform expectations."
      >
        <DriverPickerModal
          value={form.biggest_flop}
          onChange={set("biggest_flop")}
          disabled={locked}
          allowTeams
          {...pickerProps}
        />
      </FieldCard>

      {/* P What? */}
      <FieldCard
        label={`P What? — Position ${raceWeekend.p_what_position}`}
        description={`Which driver will finish in P${raceWeekend.p_what_position}? Everyone sees the same target position.`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full bg-accent/15 text-accent text-sm font-bold tracking-wide">
            P{raceWeekend.p_what_position}
          </span>
          <span className="text-xs text-muted">is this race's generated position</span>
        </div>
        <DriverPickerModal
          value={form.p_what_driver}
          onChange={set("p_what_driver")}
          disabled={locked}
          {...pickerProps}
        />
      </FieldCard>

      {/* One Crazy Prediction */}
      <FieldCard
        label="One Crazy Prediction"
        description="A wildcard freeform prediction — anything goes. Scored manually by the admin."
      >
        <textarea
          name="crazy_prediction"
          value={form.crazy_prediction}
          onChange={(e) => set("crazy_prediction")(e.target.value)}
          disabled={locked}
          placeholder="e.g. Safety car on lap 1, Hamilton retires from the lead…"
          rows={3}
          className="
            w-full px-3 py-2.5 rounded-lg text-sm
            bg-background border border-white/10
            text-white placeholder:text-muted
            focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent
            disabled:opacity-50 disabled:cursor-not-allowed resize-none
          "
        />
      </FieldCard>

      {/* See others' predictions */}
      {canViewOthers && (
        <a
          href={`/predict/${raceWeekend.id}/others`}
          className="
            flex items-center justify-center gap-2
            w-full min-h-[44px] px-6 py-3 rounded-xl
            bg-white/5 hover:bg-white/10 border border-white/10
            text-white font-semibold text-sm transition-colors
          "
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          See what everyone else picked
        </a>
      )}

      {/* Submit */}
      {!isLocked && (
        <button
          type="submit"
          disabled={isPending}
          className="
            w-full min-h-[48px] px-6 py-3 rounded-xl
            bg-accent hover:bg-accent-hover active:scale-[0.98]
            text-white font-semibold text-sm transition-all
            disabled:opacity-60 disabled:cursor-not-allowed
          "
        >
          {isPending ? "Saving…" : existing ? "Update predictions" : "Submit predictions"}
        </button>
      )}
    </form>
  );
}
