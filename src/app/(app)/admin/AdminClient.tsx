"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  addWhitelistedEmail,
  removeWhitelistedEmail,
  createRaceWeekend,
  updateRaceDeadline,
  updateSubjectiveScore,
  seedFromCalendar,
} from "./actions";
import type { Database } from "@/lib/supabase/database.types";

type WhitelistRow = Database["public"]["Tables"]["whitelisted_emails"]["Row"];
type RaceWeekend = Database["public"]["Tables"]["race_weekends"]["Row"];
type Score = Database["public"]["Tables"]["scores"]["Row"];
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AdminClientProps {
  whitelist: WhitelistRow[];
  raceWeekends: RaceWeekend[];
  profiles: Profile[];
  predictions: Prediction[];
  scores: Score[];
}

type Tab = "whitelist" | "races" | "scoring";

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
  const [form, setForm] = useState({
    race_name: "",
    round: "",
    season: new Date().getFullYear().toString(),
    qualifying_deadline: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [editDeadline, setEditDeadline] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function createRace() {
    if (!form.race_name || !form.round || !form.season || !form.qualifying_deadline) {
      setMsg({ text: "All fields are required.", error: true });
      return;
    }
    startTransition(async () => {
      const res = await createRaceWeekend({
        race_name: form.race_name,
        round: parseInt(form.round),
        season: parseInt(form.season),
        qualifying_deadline: new Date(form.qualifying_deadline).toISOString(),
      });
      if (res.error) {
        setMsg({ text: res.error, error: true });
      } else {
        setMsg({ text: `Race created! P What? position: P${res.p_what_position}` });
        setForm({ race_name: "", round: "", season: new Date().getFullYear().toString(), qualifying_deadline: "" });
        // Optimistically add to list — page will revalidate on next nav
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

  function seed() {
    startTransition(async () => {
      const res = await seedFromCalendar();
      if (res.error) {
        setMsg({ text: res.error, error: true });
      } else if (res.created === 0) {
        setMsg({ text: `All 2026 races updated (${res.updated} in DB).` });
      } else {
        setMsg({ text: `Seeded ${res.created} new race${res.created !== 1 ? "s" : ""} and updated ${res.updated} existing from the 2026 calendar.` });
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
            Creates all 24 race weekends at once. Skips any that already exist. P What? positions are randomly assigned.
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
          <div className="col-span-full">
            <label className="text-xs text-muted mb-1 block">Qualifying deadline (predictions lock at this time)</label>
            <input
              type="datetime-local"
              value={form.qualifying_deadline}
              onChange={(e) => setForm((f) => ({ ...f, qualifying_deadline: e.target.value }))}
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
        <p className="text-xs text-muted">The P What? position is generated randomly (P4–P22) when you click Create.</p>
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

// ── Root AdminClient ──────────────────────────────────────────────────────────

export default function AdminClient({
  whitelist,
  raceWeekends,
  profiles,
  predictions,
  scores,
}: AdminClientProps) {
  const [tab, setTab] = useState<Tab>("whitelist");

  const tabs: { id: Tab; label: string }[] = [
    { id: "whitelist", label: "Whitelist" },
    { id: "races", label: "Race Weekends" },
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
