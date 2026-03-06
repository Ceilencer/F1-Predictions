"use client";

import { useState, useTransition } from "react";
import DriverSelect from "@/components/DriverSelect";
import { TEAMS } from "@/config/drivers";
import { submitPredictions } from "./actions";
import type { Database } from "@/lib/supabase/database.types";

type RaceWeekend = Database["public"]["Tables"]["race_weekends"]["Row"];
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];

interface PredictFormProps {
  raceWeekend: RaceWeekend;
  existing: Prediction | null;
  isLocked: boolean;
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
}

interface Category {
  key: keyof Omit<FormState, "crazy_prediction">;
  label: string;
  description: string;
}

const DRIVER_CATEGORIES: Category[] = [
  { key: "pole_position", label: "Pole Position", description: "Which driver will qualify P1?" },
  { key: "top3_p1", label: "Race Winner — P1", description: "Who crosses the line first?" },
  { key: "top3_p2", label: "P2 Finisher", description: "Who finishes second?" },
  { key: "top3_p3", label: "P3 Finisher", description: "Who takes the final podium spot?" },
];

function DriverOrTeamSelect({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onWheel={(e) => e.currentTarget.blur()}
      disabled={disabled}
      className="
        w-full min-h-[44px] px-3 py-2 rounded-lg text-sm
        bg-background border border-white/10 text-white
        focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      <option value="">Select a driver or team…</option>
      <optgroup label="── Teams ──">
        {TEAMS.map((team) => (
          <option key={team.shortName} value={team.shortName}>
            {team.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="── Drivers ──">
        {TEAMS.map((team) =>
          team.drivers.map((driver) => (
            <option key={driver.code} value={driver.code}>
              {driver.name} ({team.shortName})
            </option>
          ))
        )}
      </optgroup>
    </select>
  );
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

export default function PredictForm({ raceWeekend, existing, isLocked }: PredictFormProps) {
  const [form, setForm] = useState<FormState>({
    pole_position: existing?.pole_position ?? "",
    top3_p1: existing?.top3_p1 ?? "",
    top3_p2: existing?.top3_p2 ?? "",
    top3_p3: existing?.top3_p3 ?? "",
    biggest_surprise: existing?.biggest_surprise ?? "",
    biggest_flop: existing?.biggest_flop ?? "",
    crazy_prediction: existing?.crazy_prediction ?? "",
    p_what_driver: existing?.p_what_driver ?? "",
  });

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set(field: keyof FormState) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setSuccess(false);
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Basic validation
    const required: (keyof FormState)[] = [
      "pole_position", "top3_p1", "top3_p2", "top3_p3",
      "biggest_surprise", "biggest_flop", "crazy_prediction", "p_what_driver",
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

      {/* Top 4 driver categories (pole + podium) */}
      {DRIVER_CATEGORIES.slice(0, 4).map(({ key, label, description }) => (
        <FieldCard key={key} label={label} description={description}>
          <DriverSelect
            name={key}
            value={form[key]}
            onChange={set(key)}
            disabled={isLocked || isPending}
          />
        </FieldCard>
      ))}

      {/* Biggest Good Surprise — driver or team */}
      <FieldCard
        label="Biggest Good Surprise"
        description="Pick a driver or a team who will overperform expectations."
      >
        <DriverOrTeamSelect
          name="biggest_surprise"
          value={form.biggest_surprise}
          onChange={set("biggest_surprise")}
          disabled={isLocked || isPending}
        />
      </FieldCard>

      {/* Biggest Flop — driver or team */}
      <FieldCard
        label="Biggest Flop"
        description="Pick a driver or a team who will underperform expectations."
      >
        <DriverOrTeamSelect
          name="biggest_flop"
          value={form.biggest_flop}
          onChange={set("biggest_flop")}
          disabled={isLocked || isPending}
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
        <DriverSelect
          name="p_what_driver"
          value={form.p_what_driver}
          onChange={set("p_what_driver")}
          disabled={isLocked || isPending}
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
          disabled={isLocked || isPending}
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
