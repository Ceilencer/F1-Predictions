"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  addWhitelistedEmail,
  removeWhitelistedEmail,
  createRaceWeekend,
  deleteRaceWeekend,
  updateRaceDeadline,
  updateSubjectiveScore,
  seedFromCalendar,
  seedGridFromConfig,
  addDriver,
  updateDriver,
  upsertSeasonSeat,
  upsertWeekendSeat,
  resetWeekendGridToDefault,
} from "./actions";
import type { Database } from "@/lib/supabase/database.types";

type WhitelistRow = Database["public"]["Tables"]["whitelisted_emails"]["Row"];
type RaceWeekend = Database["public"]["Tables"]["race_weekends"]["Row"];
type Score = Database["public"]["Tables"]["scores"]["Row"];
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];
type SeasonSeatRow = Database["public"]["Tables"]["season_seats"]["Row"];
type WeekendDriverRow = Database["public"]["Tables"]["race_weekend_drivers"]["Row"];

interface AdminClientProps {
  whitelist: WhitelistRow[];
  raceWeekends: RaceWeekend[];
  profiles: Profile[];
  predictions: Prediction[];
  scores: Score[];
  teams: TeamRow[];
  drivers: DriverRow[];
  seasonSeats: SeasonSeatRow[];
  weekendDrivers: WeekendDriverRow[];
  season: number;
}

type Tab = "whitelist" | "races" | "lineups" | "scoring";

// ── tiny UI components ────────────────────────────────────────────────────────

function Feedback({ msg, isError }: { msg: string; isError?: boolean }) {
  return (
    <p
      className={`text-sm px-3 py-2 rounded-lg mt-2 ${
        isError
          ? "text-red-400 bg-red-500/10"
          : "text-green-400 bg-green-500/10"
      }`}
    >
      {msg}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
      {children}
    </p>
  );
}

// ── Whitelist section ─────────────────────────────────────────────────────────

function WhitelistSection({
  initial,
}: {
  initial: WhitelistRow[];
}) {
  const [list, setList] = useState(initial);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!email.trim()) return;
    startTransition(async () => {
      const res = await addWhitelistedEmail(email.trim());
      if (res.error) {
        setMsg({ text: res.error, error: true });
      } else {
        setList((prev) => [
          ...prev,
          { id: crypto.randomUUID(), email: email.toLowerCase().trim(), added_by: null, created_at: new Date().toISOString() },
        ]);
        setEmail("");
        setMsg({ text: `${email} added.` });
      }
    });
  }

  function remove(id: string, emailVal: string) {
    startTransition(async () => {
      const res = await removeWhitelistedEmail(id);
      if (res.error) {
        setMsg({ text: res.error, error: true });
      } else {
        setList((prev) => prev.filter((e) => e.id !== id));
        setMsg({ text: `${emailVal} removed.` });
      }
    });
  }

  return (
    <div>
      <SectionTitle>Approved accounts</SectionTitle>
      <p className="text-xs text-muted mb-4">
        Only Google accounts on this list can sign in. Add each family member's Gmail address before they try to log in.
      </p>

      {/* Add */}
      <div className="flex gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="name@gmail.com"
          className="
            flex-1 min-h-[44px] px-3 py-2 rounded-lg text-sm
            bg-background border border-white/10 text-white placeholder:text-muted
            focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent
          "
        />
        <button
          onClick={add}
          disabled={pending}
          className="min-h-[44px] px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          Add
        </button>
      </div>

      {msg && <Feedback msg={msg.text} isError={msg.error} />}

      {/* List */}
      <div className="mt-4 space-y-2">
        {list.length === 0 && (
          <p className="text-sm text-muted">No approved emails yet.</p>
        )}
        {list.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between bg-background/60 border border-white/5 rounded-lg px-3 py-2.5"
          >
            <span className="text-sm text-white truncate">{entry.email}</span>
            <button
              onClick={() => remove(entry.id, entry.email)}
              disabled={pending}
              className="ml-3 text-xs text-red-400 hover:text-red-300 shrink-0 min-h-[36px] px-2"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Race Weekends section ─────────────────────────────────────────────────────

function RaceSection({ initial }: { initial: RaceWeekend[] }) {
  const [races, setRaces] = useState(initial);
  // Pick up server-side changes (e.g. rounds shifted by a mid-season insert).
  useEffect(() => setRaces(initial), [initial]);
  const emptyForm = {
    race_name: "",
    round: "",
    season: new Date().getFullYear().toString(),
    qualifying_deadline: "",
    race_start: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDeadline, setEditDeadline] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function createRace() {
    if (!form.race_name || !form.round || !form.season || !form.qualifying_deadline || !form.race_start) {
      setMsg({ text: "All fields are required.", error: true });
      return;
    }
    const round = parseInt(form.round);
    const season = parseInt(form.season);
    const later = races.filter((r) => r.season === season && r.round >= round).length;
    if (
      later > 0 &&
      !confirm(
        `Round ${round} already exists. Insert "${form.race_name}" as round ${round} and move ${later} later race${later !== 1 ? "s" : ""} back one round?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await createRaceWeekend({
        race_name: form.race_name,
        round,
        season,
        qualifying_deadline: new Date(form.qualifying_deadline).toISOString(),
        race_start: new Date(form.race_start).toISOString(),
      });
      if (res.error) {
        setMsg({ text: res.error, error: true });
      } else {
        const shifted = res.shifted ? ` Rounds ${round}+ moved back by one (${res.shifted} race${res.shifted !== 1 ? "s" : ""}).` : "";
        setMsg({ text: `Race created! P What? position: P${res.p_what_position}.${shifted}` });
        setForm(emptyForm);
      }
    });
  }

  function saveDeadline(id: string) {
    startTransition(async () => {
      const res = await updateRaceDeadline(id, new Date(editDeadline).toISOString());
      if (res.error) {
        setMsg({ text: res.error, error: true });
      } else {
        setRaces((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, qualifying_deadline: new Date(editDeadline).toISOString() } : r
          )
        );
        setEditId(null);
        setMsg({ text: "Deadline updated." });
      }
    });
  }

  function removeRace(r: RaceWeekend) {
    if (
      !confirm(
        `Delete "${r.race_name}" (Round ${r.round}, ${r.season})? This also deletes every prediction, score and result for it. This cannot be undone.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteRaceWeekend(r.id);
      if (res.error) {
        setMsg({ text: res.error, error: true });
      } else {
        setRaces((prev) => prev.filter((x) => x.id !== r.id));
        setMsg({ text: `Deleted ${r.race_name}.` });
      }
    });
  }

  function seed() {
    startTransition(async () => {
      const res = await seedFromCalendar();
      if (res.error) {
        setMsg({ text: res.error, error: true });
      } else {
        const base =
          res.created === 0
            ? `All 2026 races updated (${res.updated} in DB).`
            : `Seeded ${res.created} new race${res.created !== 1 ? "s" : ""} and updated ${res.updated} existing from the 2026 calendar.`;
        const skipped = res.skipped?.length
          ? ` Skipped rounds held by a different race: ${res.skipped.join("; ")}.`
          : "";
        setMsg({ text: base + skipped, error: !!res.skipped?.length });
      }
    });
  }

  return (
    <div>
      <SectionTitle>Race weekends</SectionTitle>

      {/* Seed from calendar */}
      <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Seed 2026 season from calendar</p>
          <p className="text-xs text-muted mt-0.5">
            Creates any missing race weekends and refreshes session times for existing ones. Rounds held by a different race are left untouched. P What? positions are randomly assigned.
          </p>
        </div>
        <button
          onClick={seed}
          disabled={pending}
          className="shrink-0 min-h-[44px] px-5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          Seed from calendar
        </button>
      </div>

      {/* Create form */}
      <div className="bg-background/60 border border-white/5 rounded-xl p-4 mb-6 space-y-3">
        <p className="text-sm font-medium text-white">Add a race weekend</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            placeholder="Race name (e.g. Australian Grand Prix)"
            value={form.race_name}
            onChange={(e) => setForm((f) => ({ ...f, race_name: e.target.value }))}
            className="col-span-full min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <input
            type="number"
            placeholder="Round (e.g. 1)"
            value={form.round}
            onChange={(e) => setForm((f) => ({ ...f, round: e.target.value }))}
            className="min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <input
            type="number"
            placeholder="Season year"
            value={form.season}
            onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
            className="min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <div>
            <label className="text-xs text-muted mb-1 block">Qualifying deadline (predictions lock at this time)</label>
            <input
              type="datetime-local"
              value={form.qualifying_deadline}
              onChange={(e) => setForm((f) => ({ ...f, qualifying_deadline: e.target.value }))}
              className="w-full min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Race start (orders the season and triggers results sync)</label>
            <input
              type="datetime-local"
              value={form.race_start}
              onChange={(e) => setForm((f) => ({ ...f, race_start: e.target.value }))}
              className="w-full min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white focus:border-accent focus:outline-none"
            />
          </div>
        </div>
        <button
          onClick={createRace}
          disabled={pending}
          className="w-full sm:w-auto min-h-[44px] px-6 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60"
        >
          Create race weekend
        </button>
        <p className="text-xs text-muted">
          The P What? position is generated randomly (P4–P22) when you click Create. Using a round that already
          exists inserts the race there and moves every later round back by one.
        </p>
      </div>

      {msg && <Feedback msg={msg.text} isError={msg.error} />}

      {/* Race list */}
      <div className="space-y-2 mt-4">
        {races.length === 0 && <p className="text-sm text-muted">No races yet.</p>}
        {[...races].sort((a, b) => b.round - a.round).map((r) => (
          <div key={r.id} className="bg-background/60 border border-white/5 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{r.race_name}</p>
                <p className="text-xs text-muted mt-0.5">
                  Round {r.round} · {r.season} · P{r.p_what_position} · {r.results_synced ? "✓ Synced" : "Not synced"}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Deadline:{" "}
                  {new Date(r.qualifying_deadline).toLocaleString("en-GB", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href={`/admin/results/${r.id}`}
                  className="text-xs text-accent hover:underline"
                >
                  Results
                </Link>
                <button
                  onClick={() => {
                    setEditId(r.id);
                    // Convert ISO to datetime-local format
                    const local = new Date(r.qualifying_deadline);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    setEditDeadline(
                      `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`
                    );
                  }}
                  className="text-xs text-muted hover:text-white"
                >
                  Edit deadline
                </button>
                <button
                  onClick={() => removeRace(r)}
                  disabled={pending}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>

            {editId === r.id && (
              <div className="mt-3 flex gap-2 items-center">
                <input
                  type="datetime-local"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="flex-1 min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => saveDeadline(r.id)}
                  disabled={pending}
                  className="min-h-[44px] px-4 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="min-h-[44px] px-3 rounded-lg border border-white/10 text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Subjective scoring section ────────────────────────────────────────────────

function ScoringSection({
  raceWeekends,
  profiles,
  predictions,
  scores: initialScores,
}: {
  raceWeekends: RaceWeekend[];
  profiles: Profile[];
  predictions: Prediction[];
  scores: Score[];
}) {
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");
  const [scores, setScores] = useState(initialScores);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const syncedRaces = raceWeekends.filter((r) => r.results_synced);
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const racePredictions = predictions.filter(
    (p) => p.race_weekend_id === selectedRaceId
  );

  function getScore(userId: string) {
    return scores.find(
      (s) => s.user_id === userId && s.race_weekend_id === selectedRaceId
    );
  }

  function setScore(
    scoreId: string,
    field: "surprise_correct" | "flop_correct" | "crazy_correct",
    value: boolean | null
  ) {
    startTransition(async () => {
      const res = await updateSubjectiveScore({ scoreId, field, value });
      if (res.error) {
        setMsg({ text: res.error, error: true });
      } else {
        setScores((prev) =>
          prev.map((s) => (s.id === scoreId ? { ...s, [field]: value } : s))
        );
      }
    });
  }

  function ScoreBtns({
    scoreId,
    field,
    value,
  }: {
    scoreId: string;
    field: "surprise_correct" | "flop_correct" | "crazy_correct";
    value: boolean | null;
  }) {
    return (
      <div className="flex gap-1 mt-1">
        <button
          onClick={() => setScore(scoreId, field, true)}
          disabled={pending}
          className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
            value === true
              ? "bg-green-500/30 text-green-300 border border-green-500/40"
              : "bg-white/5 text-muted border border-white/10 hover:bg-green-500/10 hover:text-green-400"
          }`}
        >
          ✓
        </button>
        <button
          onClick={() => setScore(scoreId, field, false)}
          disabled={pending}
          className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
            value === false
              ? "bg-red-500/20 text-red-300 border border-red-500/30"
              : "bg-white/5 text-muted border border-white/10 hover:bg-red-500/10 hover:text-red-400"
          }`}
        >
          ✗
        </button>
        <button
          onClick={() => setScore(scoreId, field, null)}
          disabled={pending}
          className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
            value === null
              ? "bg-white/15 text-white border border-white/20"
              : "bg-white/5 text-muted border border-white/10 hover:bg-white/10 hover:text-white"
          }`}
        >
          ?
        </button>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>Score subjective categories</SectionTitle>
      <p className="text-xs text-muted mb-4">
        These categories are judged manually. Use ✓ / ✗ / ? to mark each player's answer as Correct, Incorrect, or Unset.
        Scores update automatically.
      </p>

      {syncedRaces.length === 0 ? (
        <p className="text-sm text-muted">Sync results for a race first to score subjective categories.</p>
      ) : (
        <>
          <select
            value={selectedRaceId}
            onChange={(e) => setSelectedRaceId(e.target.value)}
            className="w-full sm:w-64 min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white focus:border-accent focus:outline-none mb-4"
          >
            <option value="">Select a race…</option>
            {syncedRaces.map((r) => (
              <option key={r.id} value={r.id}>
                R{r.round} — {r.race_name}
              </option>
            ))}
          </select>

          {msg && <Feedback msg={msg.text} isError={msg.error} />}

          {selectedRaceId && racePredictions.length === 0 && (
            <p className="text-sm text-muted mt-4">No predictions found for this race.</p>
          )}

          {racePredictions.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-xs text-muted uppercase tracking-widest border-b border-white/5">
                    <th className="text-left pb-3 pr-4 font-semibold">Player</th>
                    <th className="text-left pb-3 pr-4 font-semibold">Surprise</th>
                    <th className="text-left pb-3 pr-4 font-semibold">Flop</th>
                    <th className="text-left pb-3 font-semibold">Wildcard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {racePredictions.map((pred) => {
                    const score = getScore(pred.user_id);
                    const name = profileMap[pred.user_id] ?? "Unknown";
                    return (
                      <tr key={pred.user_id}>
                        <td className="py-3 pr-4 text-white font-medium">{name}</td>

                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs text-muted">{pred.biggest_surprise}</span>
                            {score ? (
                              <ScoreBtns scoreId={score.id} field="surprise_correct" value={score.surprise_correct} />
                            ) : (
                              <span className="text-xs text-muted">No score row</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs text-muted">{pred.biggest_flop}</span>
                            {score ? (
                              <ScoreBtns scoreId={score.id} field="flop_correct" value={score.flop_correct} />
                            ) : (
                              <span className="text-xs text-muted">No score row</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted italic max-w-[200px] truncate">
                              &ldquo;{pred.crazy_prediction}&rdquo;
                            </span>
                            {score ? (
                              <ScoreBtns scoreId={score.id} field="crazy_correct" value={score.crazy_correct} />
                            ) : (
                              <span className="text-xs text-muted">No score row</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Lineups (grid) section ────────────────────────────────────────────────────

function SeatSelect({
  drivers,
  value,
  onChange,
  disabled,
}: {
  drivers: DriverRow[];
  value: string | null;
  onChange: (driverId: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="w-full min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white focus:border-accent focus:outline-none disabled:opacity-60"
    >
      <option value="">— empty —</option>
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.code} — {d.name}
          {d.is_active ? "" : " (inactive)"}
        </option>
      ))}
    </select>
  );
}

function DriverThumb({ driver }: { driver: DriverRow }) {
  if (driver.photo_path) {
    return (
      <div className="relative h-9 w-9 rounded-full overflow-hidden shrink-0 bg-white/10">
        <Image src={driver.photo_path} alt={driver.name} fill unoptimized className="object-cover object-top" sizes="36px" />
      </div>
    );
  }
  return (
    <div className="h-9 w-9 rounded-full shrink-0 bg-white/10 flex items-center justify-center">
      <span className="text-[10px] font-bold text-muted">{driver.code}</span>
    </div>
  );
}

function LineupsSection({
  teams,
  drivers: initialDrivers,
  seasonSeats: initialSeasonSeats,
  weekendDrivers: initialWeekendDrivers,
  raceWeekends,
  season,
}: {
  teams: TeamRow[];
  drivers: DriverRow[];
  seasonSeats: SeasonSeatRow[];
  weekendDrivers: WeekendDriverRow[];
  raceWeekends: RaceWeekend[];
  season: number;
}) {
  const [view, setView] = useState<"roster" | "season" | "weekend">("roster");
  const [drivers, setDrivers] = useState(initialDrivers);
  const [seasonSeats, setSeasonSeats] = useState(initialSeasonSeats);
  const [weekendSeats, setWeekendSeats] = useState(initialWeekendDrivers);
  const [selectedWeekendId, setSelectedWeekendId] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  // New-driver form
  const [nd, setNd] = useState({ code: "", name: "", nationality: "", number: "", photo_path: "" });
  // Inline driver editing
  const [editId, setEditId] = useState<string | null>(null);
  const [ed, setEd] = useState({ name: "", nationality: "", number: "", photo_path: "" });

  const rosterSorted = [...drivers].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    const sa = a.name.split(" ").at(-1) ?? a.name;
    const sb = b.name.split(" ").at(-1) ?? b.name;
    return sa.localeCompare(sb);
  });

  const seasonSeatValue = (teamId: string, seatNo: number) =>
    seasonSeats.find((s) => s.team_id === teamId && s.seat_no === seatNo)?.driver_id ?? null;

  const weekendSeatValue = (weekendId: string, teamId: string, seatNo: number) => {
    const row = weekendSeats.find(
      (w) => w.race_weekend_id === weekendId && w.team_id === teamId && w.seat_no === seatNo
    );
    if (row) return row.driver_id;
    return seasonSeatValue(teamId, seatNo); // fall back to the default
  };

  // ── handlers ──
  function doSeed() {
    startTransition(async () => {
      const res = await seedGridFromConfig();
      if (res.error) setMsg({ text: res.error, error: true });
      else setMsg({ text: `Seeded ${res.teams} teams and ${res.drivers} drivers from config. Reload to see them.` });
    });
  }

  function doAddDriver() {
    if (nd.code.trim().length !== 3) {
      setMsg({ text: "Driver code must be exactly 3 letters.", error: true });
      return;
    }
    startTransition(async () => {
      const res = await addDriver(nd);
      if (res.error) setMsg({ text: res.error, error: true });
      else {
        if (res.driver) setDrivers((prev) => [...prev, res.driver!]);
        setNd({ code: "", name: "", nationality: "", number: "", photo_path: "" });
        setMsg({ text: "Driver added." });
      }
    });
  }

  function toggleActive(d: DriverRow) {
    startTransition(async () => {
      const res = await updateDriver(d.id, { is_active: !d.is_active });
      if (res.error) setMsg({ text: res.error, error: true });
      else setDrivers((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_active: !d.is_active } : x)));
    });
  }

  function saveDriver(id: string) {
    startTransition(async () => {
      const res = await updateDriver(id, ed);
      if (res.error) setMsg({ text: res.error, error: true });
      else {
        setDrivers((prev) =>
          prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  name: ed.name.trim(),
                  nationality: ed.nationality.trim(),
                  number: ed.number.trim() ? Number(ed.number) : null,
                  photo_path: ed.photo_path.trim(),
                }
              : x
          )
        );
        setEditId(null);
        setMsg({ text: "Driver updated." });
      }
    });
  }

  function setSeasonSeat(teamId: string, seatNo: number, driverId: string | null) {
    startTransition(async () => {
      const res = await upsertSeasonSeat({ season, teamId, seatNo, driverId });
      if (res.error) {
        setMsg({ text: res.error, error: true });
        return;
      }
      setSeasonSeats((prev) => {
        const idx = prev.findIndex((s) => s.team_id === teamId && s.seat_no === seatNo);
        if (idx >= 0) return prev.map((s, i) => (i === idx ? { ...s, driver_id: driverId } : s));
        return [
          ...prev,
          { id: `local-${teamId}-${seatNo}`, season, team_id: teamId, seat_no: seatNo, driver_id: driverId, updated_at: new Date().toISOString() },
        ];
      });
    });
  }

  function setWeekendSeat(weekendId: string, wknSeason: number, teamId: string, seatNo: number, driverId: string | null) {
    startTransition(async () => {
      const res = await upsertWeekendSeat({ raceWeekendId: weekendId, season: wknSeason, teamId, seatNo, driverId });
      if (res.error) {
        setMsg({ text: res.error, error: true });
        return;
      }
      setWeekendSeats((prev) => {
        let rows = prev;
        // First override on this weekend: materialise the full snapshot locally,
        // mirroring what the server just did, so the rest of the grid stays put.
        if (!rows.some((w) => w.race_weekend_id === weekendId)) {
          rows = [
            ...rows,
            ...seasonSeats.map((s) => ({
              id: `local-${weekendId}-${s.team_id}-${s.seat_no}`,
              race_weekend_id: weekendId,
              team_id: s.team_id,
              seat_no: s.seat_no,
              driver_id: s.driver_id,
            })),
          ];
        }
        const idx = rows.findIndex(
          (w) => w.race_weekend_id === weekendId && w.team_id === teamId && w.seat_no === seatNo
        );
        if (idx >= 0) return rows.map((w, i) => (i === idx ? { ...w, driver_id: driverId } : w));
        return [
          ...rows,
          { id: `local-${weekendId}-${teamId}-${seatNo}`, race_weekend_id: weekendId, team_id: teamId, seat_no: seatNo, driver_id: driverId },
        ];
      });
    });
  }

  function doReset(weekendId: string, wknSeason: number) {
    startTransition(async () => {
      const res = await resetWeekendGridToDefault(weekendId, wknSeason);
      if (res.error) setMsg({ text: res.error, error: true });
      else {
        setWeekendSeats((prev) => prev.filter((w) => w.race_weekend_id !== weekendId));
        setMsg({ text: "Weekend reset to the season default lineup." });
      }
    });
  }

  const subTabs: { id: typeof view; label: string }[] = [
    { id: "roster", label: "Roster" },
    { id: "season", label: "Season default" },
    { id: "weekend", label: "Per-weekend" },
  ];

  const selectedWeekend = raceWeekends.find((r) => r.id === selectedWeekendId) ?? null;

  return (
    <div>
      <SectionTitle>Driver line-ups</SectionTitle>

      {teams.length === 0 && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mb-4">
          <p className="text-sm text-white font-medium">The grid is empty.</p>
          <p className="text-xs text-muted mt-0.5">
            Click “Seed grid from config” below to load the teams, drivers and the season-default
            lineup from the built-in config. You only need to do this once.
          </p>
        </div>
      )}

      {/* sub-tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === t.id ? "bg-accent text-white" : "bg-white/5 text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <Feedback msg={msg.text} isError={msg.error} />}

      {/* ── Roster ── */}
      {view === "roster" && (
        <div className="mt-4 space-y-5">
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Seed grid from config</p>
              <p className="text-xs text-muted mt-0.5">
                Loads teams, drivers and the {season} default lineup from the built-in config.
                Safe to re-run — it never deletes anything.
              </p>
            </div>
            <button
              onClick={doSeed}
              disabled={pending}
              className="shrink-0 min-h-[44px] px-5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              Seed grid from config
            </button>
          </div>

          {/* Add driver */}
          <div className="bg-background/60 border border-white/5 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-white">Add a driver to the roster</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <input
                placeholder="Code (e.g. TSU)"
                maxLength={3}
                value={nd.code}
                onChange={(e) => setNd((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white placeholder:text-muted focus:border-accent focus:outline-none uppercase"
              />
              <input
                placeholder="Full name"
                value={nd.name}
                onChange={(e) => setNd((f) => ({ ...f, name: e.target.value }))}
                className="col-span-1 sm:col-span-2 min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <input
                placeholder="Nationality"
                value={nd.nationality}
                onChange={(e) => setNd((f) => ({ ...f, nationality: e.target.value }))}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <input
                type="number"
                placeholder="Number"
                value={nd.number}
                onChange={(e) => setNd((f) => ({ ...f, number: e.target.value }))}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <input
                placeholder="Photo path or URL"
                value={nd.photo_path}
                onChange={(e) => setNd((f) => ({ ...f, photo_path: e.target.value }))}
                className="min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <p className="text-xs text-muted">
              Photo: drop an image in <span className="font-mono">public/drivers/</span> and use a path like{" "}
              <span className="font-mono">/drivers/tsunoda.avif</span>, or paste a full image URL.
            </p>
            <button
              onClick={doAddDriver}
              disabled={pending}
              className="w-full sm:w-auto min-h-[44px] px-6 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              Add driver
            </button>
          </div>

          {/* Roster list */}
          <div className="space-y-2">
            {rosterSorted.length === 0 && <p className="text-sm text-muted">No drivers yet.</p>}
            {rosterSorted.map((d) => (
              <div key={d.id} className="bg-background/60 border border-white/5 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <DriverThumb driver={d} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      <span className="font-mono text-xs text-muted mr-2">{d.code}</span>
                      {d.name}
                    </p>
                    <p className="text-xs text-muted">
                      {d.nationality || "—"}
                      {d.number != null ? ` · #${d.number}` : ""}
                      {d.is_active ? "" : " · inactive"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleActive(d)}
                      disabled={pending}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                        d.is_active
                          ? "border-white/10 text-muted hover:text-white"
                          : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                      }`}
                    >
                      {d.is_active ? "Retire" : "Reactivate"}
                    </button>
                    <button
                      onClick={() => {
                        setEditId(editId === d.id ? null : d.id);
                        setEd({
                          name: d.name,
                          nationality: d.nationality,
                          number: d.number != null ? String(d.number) : "",
                          photo_path: d.photo_path,
                        });
                      }}
                      className="text-xs px-2 py-1 rounded-lg border border-white/10 text-muted hover:text-white"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {editId === d.id && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <input
                      placeholder="Full name"
                      value={ed.name}
                      onChange={(e) => setEd((f) => ({ ...f, name: e.target.value }))}
                      className="col-span-2 min-h-[40px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white focus:border-accent focus:outline-none"
                    />
                    <input
                      placeholder="Nationality"
                      value={ed.nationality}
                      onChange={(e) => setEd((f) => ({ ...f, nationality: e.target.value }))}
                      className="min-h-[40px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white focus:border-accent focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Number"
                      value={ed.number}
                      onChange={(e) => setEd((f) => ({ ...f, number: e.target.value }))}
                      className="min-h-[40px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white focus:border-accent focus:outline-none"
                    />
                    <input
                      placeholder="Photo path or URL"
                      value={ed.photo_path}
                      onChange={(e) => setEd((f) => ({ ...f, photo_path: e.target.value }))}
                      className="col-span-2 min-h-[40px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white focus:border-accent focus:outline-none"
                    />
                    <div className="col-span-2 flex gap-2">
                      <button
                        onClick={() => saveDriver(d.id)}
                        disabled={pending}
                        className="min-h-[40px] px-4 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="min-h-[40px] px-3 rounded-lg border border-white/10 text-white text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Season default ── */}
      {view === "season" && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted">
            The <span className="text-white font-medium">normal lineup</span>. Changing a seat here is a
            permanent swap that applies to every future weekend created from now on.
          </p>
          {teams.map((team) => (
            <div key={team.id} className="bg-background/60 border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-4 rounded-full" style={{ backgroundColor: team.colour }} />
                <p className="text-sm font-semibold text-white">{team.name}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[1, 2].map((seatNo) => (
                  <SeatSelect
                    key={seatNo}
                    drivers={rosterSorted}
                    value={seasonSeatValue(team.id, seatNo)}
                    onChange={(driverId) => setSeasonSeat(team.id, seatNo, driverId)}
                    disabled={pending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Per-weekend override ── */}
      {view === "weekend" && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted">
            A <span className="text-white font-medium">one-off</span> lineup for a single weekend (e.g. an
            injury replacement). It does not change the season default, and it freezes what the history
            pages show for that race.
          </p>
          <select
            value={selectedWeekendId}
            onChange={(e) => setSelectedWeekendId(e.target.value)}
            className="w-full sm:w-72 min-h-[44px] px-3 py-2 rounded-lg text-sm bg-background border border-white/10 text-white focus:border-accent focus:outline-none"
          >
            <option value="">Select a race weekend…</option>
            {[...raceWeekends]
              .sort((a, b) => a.round - b.round)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  R{r.round} — {r.race_name}
                </option>
              ))}
          </select>

          {selectedWeekend && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  {weekendSeats.some((w) => w.race_weekend_id === selectedWeekend.id)
                    ? "This weekend has its own grid."
                    : "Using the season default (no overrides yet)."}
                </p>
                <button
                  onClick={() => doReset(selectedWeekend.id, selectedWeekend.season)}
                  disabled={pending}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-muted hover:text-white disabled:opacity-60"
                >
                  Reset to season default
                </button>
              </div>
              {teams.map((team) => (
                <div key={team.id} className="bg-background/60 border border-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-4 rounded-full" style={{ backgroundColor: team.colour }} />
                    <p className="text-sm font-semibold text-white">{team.name}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[1, 2].map((seatNo) => (
                      <SeatSelect
                        key={seatNo}
                        drivers={rosterSorted}
                        value={weekendSeatValue(selectedWeekend.id, team.id, seatNo)}
                        onChange={(driverId) =>
                          setWeekendSeat(selectedWeekend.id, selectedWeekend.season, team.id, seatNo, driverId)
                        }
                        disabled={pending}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Root AdminClient ──────────────────────────────────────────────────────────

export default function AdminClient({
  whitelist,
  raceWeekends,
  profiles,
  predictions,
  scores,
  teams,
  drivers,
  seasonSeats,
  weekendDrivers,
  season,
}: AdminClientProps) {
  const [tab, setTab] = useState<Tab>("whitelist");

  const tabs: { id: Tab; label: string }[] = [
    { id: "whitelist", label: "Whitelist" },
    { id: "races", label: "Race Weekends" },
    { id: "lineups", label: "Lineups" },
    { id: "scoring", label: "Score Results" },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-white/5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-surface rounded-2xl border border-white/5 p-5">
        {tab === "whitelist" && <WhitelistSection initial={whitelist} />}
        {tab === "races" && <RaceSection initial={raceWeekends} />}
        {tab === "lineups" && (
          <LineupsSection
            teams={teams}
            drivers={drivers}
            seasonSeats={seasonSeats}
            weekendDrivers={weekendDrivers}
            raceWeekends={raceWeekends}
            season={season}
          />
        )}
        {tab === "scoring" && (
          <ScoringSection
            raceWeekends={raceWeekends}
            profiles={profiles}
            predictions={predictions}
            scores={scores}
          />
        )}
      </div>
    </div>
  );
}
