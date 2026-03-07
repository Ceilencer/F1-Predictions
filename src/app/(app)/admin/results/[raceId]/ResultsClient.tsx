"use client";

import { useState, useTransition } from "react";
import { syncRaceResults, type ResultEntry } from "./actions";
import { updateSubjectiveScore } from "../../actions";
import type { Database, Json } from "@/lib/supabase/database.types";

type RaceWeekend = Database["public"]["Tables"]["race_weekends"]["Row"];
type RaceResultsRow = Database["public"]["Tables"]["race_results"]["Row"];
type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
type Score = Database["public"]["Tables"]["scores"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Props {
  raceWeekend: RaceWeekend;
  initialResults: RaceResultsRow | null;
  initialPredictions: Prediction[];
  initialScores: Score[];
  profiles: Profile[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function asResults(json: Json | null | undefined): ResultEntry[] {
  if (!json || !Array.isArray(json)) return [];
  return json as ResultEntry[];
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────

function Cell({ correct, pred, actual }: { correct: boolean | null; pred: string; actual: string }) {
  if (correct === null) {
    return (
      <span className="font-mono text-sm text-muted">{pred}</span>
    );
  }
  return (
    <span
      className={`inline-flex flex-col gap-0.5 ${
        correct ? "text-green-400" : "text-red-400"
      }`}
    >
      <span className="font-mono text-sm font-semibold">{pred}</span>
      {!correct && actual && (
        <span className="text-xs opacity-60">was {actual}</span>
      )}
    </span>
  );
}

function ToggleBtn({
  value,
  pred,
  onSet,
  pending,
}: {
  value: boolean | null;
  pred: string;
  onSet: (v: boolean | null) => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 items-start">
      <span className="font-mono text-xs text-muted truncate max-w-[80px]" title={pred}>
        {pred}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onSet(true)}
          disabled={pending}
          className={`h-6 px-2 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
            value === true
              ? "bg-green-500/30 text-green-400 border border-green-500/50"
              : "bg-white/5 text-muted border border-white/10 hover:border-green-500/30 hover:text-green-400"
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => onSet(false)}
          disabled={pending}
          className={`h-6 px-2 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
            value === false
              ? "bg-red-500/20 text-red-400 border border-red-500/40"
              : "bg-white/5 text-muted border border-white/10 hover:border-red-500/30 hover:text-red-400"
          }`}
        >
          No
        </button>
        <button
          onClick={() => onSet(null)}
          disabled={pending}
          className={`h-6 px-2 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
            value === null
              ? "bg-white/15 text-white border border-white/30"
              : "bg-white/5 text-muted border border-white/10 hover:border-white/30 hover:text-white"
          }`}
        >
          ?
        </button>
      </div>
    </div>
  );
}

function ResultsTable({ title, entries, highlight }: { title: string; entries: ResultEntry[]; highlight?: number }) {
  if (entries.length === 0) return null;
  const show = entries.slice(0, 10);
  return (
    <div className="bg-background/60 border border-white/5 rounded-xl p-4">
      <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">{title}</p>
      <div className="space-y-1.5">
        {show.map((r) => (
          <div
            key={r.pos}
            className={`flex items-center gap-3 text-sm ${
              r.pos === highlight ? "text-accent font-semibold" : "text-white"
            }`}
          >
            <span className="text-muted w-6 text-right shrink-0">P{r.pos}</span>
            <span className="font-mono w-10 shrink-0">{r.code}</span>
            <span className="text-muted text-xs truncate">{r.name}</span>
          </div>
        ))}
        {entries.length > 10 && (
          <p className="text-xs text-muted mt-2">+{entries.length - 10} more</p>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ResultsClient({
  raceWeekend,
  initialResults,
  initialPredictions,
  initialScores,
  profiles,
}: Props) {
  const [storedResults, setStoredResults] = useState(initialResults);
  const [scores, setScores] = useState(initialScores);
  const [syncMsg, setSyncMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const qualifying = asResults(storedResults?.qualifying);
  const race = asResults(storedResults?.race);
  const sprintRace = asResults(storedResults?.sprint_race);

  const poleSitter = qualifying.find((q) => q.pos === 1)?.code ?? "";
  const p1 = race.find((r) => r.pos === 1)?.code ?? "";
  const p2 = race.find((r) => r.pos === 2)?.code ?? "";
  const p3 = race.find((r) => r.pos === 3)?.code ?? "";
  const pWhatActual = race.find((r) => r.pos === raceWeekend.p_what_position)?.code ?? "";

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  function getScore(userId: string) {
    return scores.find((s) => s.user_id === userId && s.race_weekend_id === raceWeekend.id);
  }

  function sync() {
    setSyncMsg(null);
    startTransition(async () => {
      const res = await syncRaceResults(raceWeekend.id);
      if (res.error) {
        setSyncMsg({ text: res.error, error: true });
      } else {
        const msg = res.partialSync
          ? `Qualifying synced! Pole position scored for ${res.scoredCount} prediction${res.scoredCount !== 1 ? "s" : ""}. Sync again after the race to score P1–P3 and P?.`
          : `Fully synced! All categories scored for ${res.scoredCount} prediction${res.scoredCount !== 1 ? "s" : ""}.`;
        setSyncMsg({ text: msg });
        if (res.scores) setScores(res.scores as Score[]);
        setStoredResults((prev) => ({
          ...(prev ?? {
            id: "",
            race_weekend_id: raceWeekend.id,
            sprint_qualifying: null,
            created_at: new Date().toISOString(),
          }),
          qualifying: res.qualifying ?? prev?.qualifying ?? null,
          // Only update race/sprint if the full sync returned them
          race: !res.partialSync ? (res.race ?? prev?.race ?? null) : (prev?.race ?? null),
          sprint_race:
            !res.partialSync && res.sprintRace && res.sprintRace.length > 0
              ? res.sprintRace
              : prev?.sprint_race ?? null,
          last_synced_at: new Date().toISOString(),
        }));
      }
    });
  }

  function setSubjective(
    scoreId: string,
    field: "surprise_correct" | "flop_correct" | "crazy_correct",
    value: boolean | null
  ) {
    startTransition(async () => {
      const res = await updateSubjectiveScore({ scoreId, field, value });
      if (res.error) {
        setSyncMsg({ text: res.error, error: true });
      } else {
        setScores((prev) => prev.map((s) => (s.id === scoreId ? { ...s, [field]: value } : s)));
      }
    });
  }

  const hasQualifying = qualifying.length > 0;
  const hasRace = race.length > 0;
  const alreadySynced = !!storedResults?.last_synced_at;
  // Partial = qualifying stored but no race results yet
  const isPartial = alreadySynced && hasQualifying && !hasRace;

  return (
    <div className="space-y-6">
      {/* ── Sync card ── */}
      <div className="bg-surface rounded-2xl border border-white/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              {!alreadySynced && "Not yet synced"}
              {isPartial && "Qualifying synced — race pending"}
              {alreadySynced && !isPartial && "Fully synced"}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {alreadySynced
                ? `Last fetched: ${fmtTime(storedResults?.last_synced_at)}`
                : "Sync after qualifying to score pole position, then again after the race for the rest."}
            </p>
          </div>
          <button
            onClick={sync}
            disabled={pending}
            className="shrink-0 min-h-[44px] px-5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {pending
              ? "Syncing…"
              : !alreadySynced
              ? "Sync Results"
              : isPartial
              ? "Sync Race Results"
              : "Refresh Results"}
          </button>
        </div>

        {syncMsg && (
          <p
            className={`text-sm mt-3 px-3 py-2 rounded-lg ${
              syncMsg.error
                ? "text-red-400 bg-red-500/10"
                : "text-green-400 bg-green-500/10"
            }`}
          >
            {syncMsg.text}
          </p>
        )}
      </div>

      {/* ── API source note ── */}
      {!alreadySynced && (
        <p className="text-xs text-muted text-center">
          Results are fetched from{" "}
          <span className="text-white font-medium">Jolpica</span> (api.jolpi.ca) — the official
          Ergast F1 API replacement. Qualifying data appears shortly after Saturday qualifying;
          race data within minutes of the chequered flag.
        </p>
      )}

      {/* ── Results tables ── */}
      {hasQualifying && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Results</p>
          <div className={`grid gap-4 ${sprintRace.length > 0 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
            <ResultsTable title="Qualifying" entries={qualifying} />
            {hasRace ? (
              <ResultsTable
                title="Race"
                entries={race}
                highlight={raceWeekend.p_what_position}
              />
            ) : (
              <div className="bg-background/40 border border-white/5 rounded-xl p-4 flex items-center justify-center">
                <p className="text-xs text-muted text-center">
                  Race results not yet available.
                  <br />
                  Sync again after the race finishes.
                </p>
              </div>
            )}
            {sprintRace.length > 0 && (
              <ResultsTable title="Sprint Race" entries={sprintRace} />
            )}
          </div>
          {hasRace && raceWeekend.p_what_position && (
            <p className="text-xs text-muted mt-2">
              P{raceWeekend.p_what_position} is highlighted — that is the mystery question position.
              {pWhatActual ? ` Correct answer: ${pWhatActual}.` : ""}
            </p>
          )}
          {sprintRace.length > 0 && (
            <p className="text-xs text-muted mt-1">
              Sprint results are displayed for reference. Sprint categories are not auto-scored
              (no sprint predictions are collected).
            </p>
          )}
        </div>
      )}

      {/* ── Scoring breakdown ── */}
      {initialPredictions.length > 0 && (
        <div className="bg-surface rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
            Scoring breakdown
          </p>
          {hasQualifying && (
            <p className="text-xs text-muted mb-4">
              Pole: <span className="text-white font-mono">{poleSitter || "—"}</span>
              {" · "}P1: <span className="text-white font-mono">{p1 || "pending"}</span>
              {" · "}P2: <span className="text-white font-mono">{p2 || "pending"}</span>
              {" · "}P3: <span className="text-white font-mono">{p3 || "pending"}</span>
              {" · "}P{raceWeekend.p_what_position}:{" "}
              <span className="text-white font-mono">{pWhatActual || "pending"}</span>
              <br />
              <span className="text-muted">
                Use Yes / No / ? on Surprise, Flop, and Wildcard to award manual points.
              </span>
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-xs text-muted uppercase tracking-widest border-b border-white/5">
                  <th className="text-left pb-3 pr-4 font-semibold">Player</th>
                  <th className="text-left pb-3 pr-3 font-semibold">Pole</th>
                  <th className="text-left pb-3 pr-3 font-semibold">P1</th>
                  <th className="text-left pb-3 pr-3 font-semibold">P2</th>
                  <th className="text-left pb-3 pr-3 font-semibold">P3</th>
                  <th className="text-left pb-3 pr-3 font-semibold">Surprise</th>
                  <th className="text-left pb-3 pr-3 font-semibold">Flop</th>
                  <th className="text-left pb-3 pr-3 font-semibold">Wildcard</th>
                  <th className="text-left pb-3 pr-3 font-semibold">P{raceWeekend.p_what_position}</th>
                  <th className="text-right pb-3 font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {initialPredictions.map((pred) => {
                  const score = getScore(pred.user_id);
                  const name = profileMap[pred.user_id] ?? "Unknown";

                  return (
                    <tr key={pred.user_id}>
                      <td className="py-3 pr-4 text-white font-semibold whitespace-nowrap">
                        {name}
                      </td>

                      {/* Auto-scored: Pole */}
                      <td className="py-3 pr-3">
                        <Cell
                          correct={score?.pole_correct ?? null}
                          pred={pred.pole_position}
                          actual={poleSitter}
                        />
                      </td>

                      {/* Auto-scored: P1 */}
                      <td className="py-3 pr-3">
                        <Cell
                          correct={score?.top3_p1_correct ?? null}
                          pred={pred.top3_p1}
                          actual={p1}
                        />
                      </td>

                      {/* Auto-scored: P2 */}
                      <td className="py-3 pr-3">
                        <Cell
                          correct={score?.top3_p2_correct ?? null}
                          pred={pred.top3_p2}
                          actual={p2}
                        />
                      </td>

                      {/* Auto-scored: P3 */}
                      <td className="py-3 pr-3">
                        <Cell
                          correct={score?.top3_p3_correct ?? null}
                          pred={pred.top3_p3}
                          actual={p3}
                        />
                      </td>

                      {/* Manual: Surprise */}
                      <td className="py-3 pr-3">
                        {score ? (
                          <ToggleBtn
                            value={score.surprise_correct}
                            pred={pred.biggest_surprise}
                            pending={pending}
                            onSet={(v) => setSubjective(score.id, "surprise_correct", v)}
                          />
                        ) : (
                          <span className="font-mono text-xs text-muted">{pred.biggest_surprise}</span>
                        )}
                      </td>

                      {/* Manual: Flop */}
                      <td className="py-3 pr-3">
                        {score ? (
                          <ToggleBtn
                            value={score.flop_correct}
                            pred={pred.biggest_flop}
                            pending={pending}
                            onSet={(v) => setSubjective(score.id, "flop_correct", v)}
                          />
                        ) : (
                          <span className="font-mono text-xs text-muted">{pred.biggest_flop}</span>
                        )}
                      </td>

                      {/* Manual: Wildcard */}
                      <td className="py-3 pr-3">
                        {score ? (
                          <ToggleBtn
                            value={score.crazy_correct}
                            pred={`"${pred.crazy_prediction}"`}
                            pending={pending}
                            onSet={(v) => setSubjective(score.id, "crazy_correct", v)}
                          />
                        ) : (
                          <span className="text-xs text-muted italic max-w-[100px] truncate block">
                            &ldquo;{pred.crazy_prediction}&rdquo;
                          </span>
                        )}
                      </td>

                      {/* Auto-scored: P What */}
                      <td className="py-3 pr-3">
                        <Cell
                          correct={score?.p_what_correct ?? null}
                          pred={pred.p_what_driver}
                          actual={pWhatActual}
                        />
                      </td>

                      {/* Total */}
                      <td className="py-3 text-right">
                        <span
                          className={`text-sm font-bold ${
                            score ? "text-white" : "text-muted"
                          }`}
                        >
                          {score?.total_points ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {initialPredictions.length > 0 && !hasQualifying && (
            <p className="text-xs text-muted mt-4 text-center">
              Sync after qualifying finishes to score pole position, then again after the race for
              P1–P3 and P{raceWeekend.p_what_position}. You can award Surprise / Flop / Wildcard
              points at any time.
            </p>
          )}
        </div>
      )}

      {initialPredictions.length === 0 && (
        <div className="bg-surface rounded-2xl border border-white/5 p-8 text-center">
          <p className="text-muted text-sm">No predictions submitted for this race yet.</p>
        </div>
      )}

      {/* ── Debug / Test panel ── */}
      <DebugPanel raceWeekend={raceWeekend} storedResults={storedResults} scores={scores} />
    </div>
  );
}

// ── Debug panel ───────────────────────────────────────────────────────────────

function DebugPanel({
  raceWeekend,
  storedResults,
  scores,
}: {
  raceWeekend: RaceWeekend;
  storedResults: RaceResultsRow | null;
  scores: Score[];
}) {
  const [open, setOpen] = useState(false);

  const base = `https://api.jolpi.ca/ergast/f1/${raceWeekend.season}/${raceWeekend.round}`;
  const endpoints = [
    { label: "Qualifying", url: `${base}/qualifying.json` },
    { label: "Race",       url: `${base}/results.json` },
    { label: "Sprint",     url: `${base}/sprint.json` },
  ];

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs text-muted hover:text-white hover:bg-white/5 transition-colors"
      >
        <span className="font-semibold uppercase tracking-widest">Debug / Test</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 bg-background/40">
          {/* Jolpica API links */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mt-3 mb-2">
              Jolpica API endpoints (season {raceWeekend.season} round {raceWeekend.round})
            </p>
            <div className="flex flex-col gap-1.5">
              {endpoints.map((e) => (
                <a
                  key={e.label}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-accent hover:underline"
                >
                  <span className="w-20 text-muted">{e.label}</span>
                  <span className="font-mono truncate">{e.url}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Sync state */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
              Stored state
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { label: "Last synced", value: storedResults?.last_synced_at ? new Date(storedResults.last_synced_at).toLocaleTimeString() : "never" },
                { label: "Qualifying rows", value: Array.isArray(storedResults?.qualifying) ? (storedResults.qualifying as unknown[]).length : 0 },
                { label: "Race rows", value: Array.isArray(storedResults?.race) ? (storedResults.race as unknown[]).length : 0 },
                { label: "Score rows", value: scores.length },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 rounded-lg p-2">
                  <p className="text-muted">{item.label}</p>
                  <p className="text-white font-mono font-semibold mt-0.5">{String(item.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Raw stored JSON — qualifying */}
          {storedResults?.qualifying && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
                Raw qualifying JSON (stored)
              </p>
              <pre className="text-xs font-mono text-white/70 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(storedResults.qualifying, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw stored JSON — race */}
          {storedResults?.race && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
                Raw race JSON (stored)
              </p>
              <pre className="text-xs font-mono text-white/70 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(storedResults.race, null, 2)}
              </pre>
            </div>
          )}

          {/* Scores */}
          {scores.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
                Scores (current state)
              </p>
              <pre className="text-xs font-mono text-white/70 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(scores, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
