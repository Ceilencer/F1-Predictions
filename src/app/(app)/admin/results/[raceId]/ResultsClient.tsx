"use client";

import { useState, useTransition } from "react";
import { syncRaceResults, type ResultEntry, type SyncType } from "./actions";
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
  return json as unknown as ResultEntry[];
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

/** Derive the sync state from what results are currently stored. */
function inferSyncType(
  alreadySynced: boolean,
  hasQualifying: boolean,
  hasRace: boolean,
  hasSprint: boolean
): SyncType | "not-synced" {
  if (!alreadySynced) return "not-synced";
  if (hasRace) return "full";
  if (hasQualifying && hasSprint) return "sprint+qualifying";
  if (hasSprint) return "sprint-only";
  return "qualifying-only";
}

// ── Sub-components ────────────────────────────────────────────────────────

function Cell({ correct, pred, actual }: { correct: boolean | null; pred: string; actual: string }) {
  if (correct === null) {
    return <span className="font-mono text-sm text-muted">{pred || "—"}</span>;
  }
  return (
    <span className={`inline-flex flex-col gap-0.5 ${correct ? "text-green-400" : "text-red-400"}`}>
      <span className="font-mono text-sm font-semibold">{pred || "—"}</span>
      {!correct && actual && (
        <span className="text-xs opacity-60">was {actual}</span>
      )}
    </span>
  );
}

function ScoreBtn({
  active,
  onClick,
  disabled,
  variant,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  variant: "yes" | "no" | "unset";
  children: React.ReactNode;
}) {
  const base = "px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 border";
  const styles = {
    yes: active
      ? "bg-green-500/25 text-green-400 border-green-500/50"
      : "bg-white/5 text-muted border-white/10 hover:bg-green-500/15 hover:text-green-400 hover:border-green-500/30",
    no: active
      ? "bg-red-500/20 text-red-400 border-red-500/40"
      : "bg-white/5 text-muted border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30",
    unset: active
      ? "bg-white/15 text-white border-white/30"
      : "bg-white/5 text-muted border-white/10 hover:bg-white/10 hover:text-white hover:border-white/30",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  );
}

function ResultsTable({
  title,
  entries,
  highlight,
}: {
  title: string;
  entries: ResultEntry[];
  highlight?: number;
}) {
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

  const isSprint = raceWeekend.is_sprint_weekend;

  const qualifying = asResults(storedResults?.qualifying);
  const race = asResults(storedResults?.race);
  const sprintRace = asResults(storedResults?.sprint_race);
  const sprintQualifying = asResults(storedResults?.sprint_qualifying);

  const poleSitter = qualifying.find((q) => q.pos === 1)?.code ?? "";
  const p1 = race.find((r) => r.pos === 1)?.code ?? "";
  const p2 = race.find((r) => r.pos === 2)?.code ?? "";
  const p3 = race.find((r) => r.pos === 3)?.code ?? "";
  const pWhatActual = race.find((r) => r.pos === raceWeekend.p_what_position)?.code ?? "";
  const sprintPole = sprintQualifying.find((r) => r.pos === 1)?.code ?? "";
  const sprintWinner = sprintRace.find((r) => r.pos === 1)?.code ?? "";

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]));

  const hasQualifying = qualifying.length > 0;
  const hasRace = race.length > 0;
  const hasSprint = sprintRace.length > 0;
  const alreadySynced = !!storedResults?.last_synced_at;
  const hasAnyResults = hasQualifying || hasSprint;

  const syncState = inferSyncType(alreadySynced, hasQualifying, hasRace, hasSprint);

  function getScore(userId: string) {
    return scores.find((s) => s.user_id === userId && s.race_weekend_id === raceWeekend.id);
  }

  function sync() {
    setSyncMsg(null);
    startTransition(async () => {
      const res = await syncRaceResults(raceWeekend.id);
      if (res.error) {
        setSyncMsg({ text: res.error, error: true });
        return;
      }

      const msg: Record<string, string> = {
        "sprint-only":
          `Sprint synced! Sprint pole & winner scored for ${res.scoredCount} prediction${res.scoredCount !== 1 ? "s" : ""}. Sync again after main qualifying.`,
        "qualifying-only":
          `Qualifying synced! Pole position scored for ${res.scoredCount} prediction${res.scoredCount !== 1 ? "s" : ""}. Sync again after the race.`,
        "sprint+qualifying":
          `Sprint + qualifying synced! Sprint & pole scored. Sync again after the race for P1–P3 and P?.`,
        "full":
          `Fully synced! All categories scored for ${res.scoredCount} prediction${res.scoredCount !== 1 ? "s" : ""}.`,
      };
      setSyncMsg({ text: msg[res.syncType ?? "full"] });

      if (res.scores) setScores(res.scores as Score[]);
      setStoredResults((prev) => ({
        ...(prev ?? {
          id: "",
          race_weekend_id: raceWeekend.id,
          created_at: new Date().toISOString(),
        }),
        qualifying: (res.qualifying?.length ? res.qualifying : prev?.qualifying ?? null) as Json,
        race: (!res.partialSync ? (res.race ?? prev?.race ?? null) : (prev?.race ?? null)) as Json,
        sprint_race: (
          res.sprintRace?.length
            ? res.sprintRace
            : prev?.sprint_race ?? null
        ) as Json,
        sprint_qualifying: (
          res.sprintQualifying?.length
            ? res.sprintQualifying
            : prev?.sprint_qualifying ?? null
        ) as Json,
        last_synced_at: new Date().toISOString(),
      }));
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

  // Sync button label
  const btnLabel = pending
    ? "Syncing…"
    : syncState === "not-synced"
    ? "Sync Results"
    : syncState === "sprint-only"
    ? "Sync Qualifying"
    : syncState === "sprint+qualifying" || syncState === "qualifying-only"
    ? "Sync Race Results"
    : "Refresh Results";

  // Status text
  const statusText: Record<SyncType | "not-synced", string> = {
    "not-synced": "Not yet synced",
    "sprint-only": "Sprint synced — qualifying & race pending",
    "qualifying-only": "Qualifying synced — race pending",
    "sprint+qualifying": "Sprint + qualifying synced — race pending",
    "full": "Fully synced",
  };

  return (
    <div className="space-y-6">
      {/* ── Sync card ── */}
      <div className="bg-surface rounded-2xl border border-white/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">{statusText[syncState]}</p>
            <p className="text-xs text-muted mt-0.5">
              {alreadySynced
                ? `Last fetched: ${fmtTime(storedResults?.last_synced_at)}`
                : isSprint
                ? "Sync after the sprint race, then after main qualifying, then after the race."
                : "Sync after qualifying to score pole position, then again after the race for the rest."}
            </p>
          </div>
          <button
            onClick={sync}
            disabled={pending}
            className="shrink-0 min-h-[44px] px-5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {btnLabel}
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
          <span className="text-white font-medium">Jolpica</span> (api.jolpi.ca).
          {isSprint
            ? " Sprint qualifying order is derived from the sprint race grid. Sync after the sprint race, then after main qualifying, then after the race."
            : " Qualifying data appears shortly after Saturday qualifying; race data within minutes of the chequered flag."}
        </p>
      )}

      {/* ── Results tables ── */}
      {alreadySynced && hasAnyResults && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Results</p>
          <div className={`grid gap-4 ${
            isSprint
              ? "grid-cols-1 sm:grid-cols-2"
              : hasRace
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2"
          }`}>
            {sprintQualifying.length > 0 && (
              <ResultsTable title="Sprint Qualifying" entries={sprintQualifying} />
            )}
            {sprintRace.length > 0 && (
              <ResultsTable title="Sprint Race" entries={sprintRace} />
            )}
            {hasQualifying && (
              <ResultsTable title="Qualifying" entries={qualifying} />
            )}
            {hasRace ? (
              <ResultsTable
                title="Race"
                entries={race}
                highlight={raceWeekend.p_what_position}
              />
            ) : alreadySynced && hasQualifying && (
              <div className="bg-background/40 border border-white/5 rounded-xl p-4 flex items-center justify-center">
                <p className="text-xs text-muted text-center">
                  Race results not yet available.
                  <br />
                  Sync again after the race finishes.
                </p>
              </div>
            )}
          </div>
          {hasRace && raceWeekend.p_what_position && (
            <p className="text-xs text-muted mt-2">
              P{raceWeekend.p_what_position} is highlighted — that is the mystery question position.
              {pWhatActual ? ` Correct answer: ${pWhatActual}.` : ""}
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
          {hasAnyResults && (
            <p className="text-xs text-muted mb-4 leading-relaxed">
              {isSprint && (
                <>
                  S.Pole: <span className="text-white font-mono">{sprintPole || "pending"}</span>
                  {" · "}
                  S.Win: <span className="text-white font-mono">{sprintWinner || "pending"}</span>
                  {" · "}
                </>
              )}
              Pole: <span className="text-white font-mono">{poleSitter || (hasQualifying ? "—" : "pending")}</span>
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

          {/* Auto-scored table */}
          <div className="overflow-x-auto">
            <table className={`w-full text-sm ${isSprint ? "min-w-[680px]" : "min-w-[500px]"}`}>
              <thead>
                <tr className="text-xs text-muted uppercase tracking-widest border-b border-white/5">
                  <th className="text-left pb-3 pr-4 font-semibold">Player</th>
                  {isSprint && <th className="text-left pb-3 pr-3 font-semibold">S.Pole</th>}
                  {isSprint && <th className="text-left pb-3 pr-3 font-semibold">S.Win</th>}
                  <th className="text-left pb-3 pr-3 font-semibold">Pole</th>
                  <th className="text-left pb-3 pr-3 font-semibold">P1</th>
                  <th className="text-left pb-3 pr-3 font-semibold">P2</th>
                  <th className="text-left pb-3 pr-3 font-semibold">P3</th>
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
                      <td className="py-3 pr-4 text-white font-semibold whitespace-nowrap">{name}</td>
                      {isSprint && (
                        <td className="py-3 pr-3">
                          <Cell
                            correct={score?.sprint_pole_correct ?? null}
                            pred={pred.sprint_pole ?? "—"}
                            actual={sprintPole}
                          />
                        </td>
                      )}
                      {isSprint && (
                        <td className="py-3 pr-3">
                          <Cell
                            correct={score?.sprint_winner_correct ?? null}
                            pred={pred.sprint_winner ?? "—"}
                            actual={sprintWinner}
                          />
                        </td>
                      )}
                      <td className="py-3 pr-3">
                        <Cell correct={score?.pole_correct ?? null} pred={pred.pole_position} actual={poleSitter} />
                      </td>
                      <td className="py-3 pr-3">
                        <Cell correct={score?.top3_p1_correct ?? null} pred={pred.top3_p1} actual={p1} />
                      </td>
                      <td className="py-3 pr-3">
                        <Cell correct={score?.top3_p2_correct ?? null} pred={pred.top3_p2} actual={p2} />
                      </td>
                      <td className="py-3 pr-3">
                        <Cell correct={score?.top3_p3_correct ?? null} pred={pred.top3_p3} actual={p3} />
                      </td>
                      <td className="py-3 pr-3">
                        <Cell correct={score?.p_what_correct ?? null} pred={pred.p_what_driver} actual={pWhatActual} />
                      </td>
                      <td className="py-3 text-right">
                        <span className={`text-sm font-bold ${score ? "text-white" : "text-muted"}`}>
                          {score?.total_points ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Manual scoring panels */}
          {([
            { label: "Biggest Surprise", field: "surprise_correct" as const, getPred: (p: typeof initialPredictions[0]) => p.biggest_surprise },
            { label: "Biggest Flop",     field: "flop_correct" as const,     getPred: (p: typeof initialPredictions[0]) => p.biggest_flop },
            { label: "Wildcard",         field: "crazy_correct" as const,    getPred: (p: typeof initialPredictions[0]) => p.crazy_prediction },
          ]).map(({ label, field, getPred }) => (
            <div key={field} className="mt-4 pt-4 border-t border-white/5">
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">{label}</p>
              <div className="space-y-2">
                {initialPredictions.map((pred) => {
                  const score = getScore(pred.user_id);
                  const name = profileMap[pred.user_id] ?? "Unknown";
                  const prediction = getPred(pred);
                  const value = score ? score[field] : null;
                  return (
                    <div key={pred.user_id} className="flex items-center justify-between gap-4 bg-background/40 rounded-lg px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{name}</p>
                        <p className="text-xs text-muted truncate">{field === "crazy_correct" ? `"${prediction}"` : prediction}</p>
                      </div>
                      {score ? (
                        <div className="flex gap-2 shrink-0">
                          <ScoreBtn active={value === true}  onClick={() => setSubjective(score.id, field, true)}  disabled={pending} variant="yes">✓</ScoreBtn>
                          <ScoreBtn active={value === false} onClick={() => setSubjective(score.id, field, false)} disabled={pending} variant="no">✗</ScoreBtn>
                          <ScoreBtn active={value === null}  onClick={() => setSubjective(score.id, field, null)}  disabled={pending} variant="unset">?</ScoreBtn>
                        </div>
                      ) : (
                        <span className="text-xs text-muted shrink-0">Sync first</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {initialPredictions.length > 0 && !hasAnyResults && (
            <p className="text-xs text-muted mt-4 text-center">
              {isSprint
                ? "Sync after the sprint race to score sprint pole & winner. Then sync after main qualifying for pole, and after the race for everything else."
                : "Sync after qualifying to score pole position, then again after the race for P1–P3 and P?. You can award Surprise / Flop / Wildcard at any time after the first sync."}
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {[
                { label: "Last synced", value: storedResults?.last_synced_at ? new Date(storedResults.last_synced_at).toLocaleTimeString() : "never" },
                { label: "Qual rows",   value: Array.isArray(storedResults?.qualifying) ? (storedResults.qualifying as unknown[]).length : 0 },
                { label: "Race rows",   value: Array.isArray(storedResults?.race) ? (storedResults.race as unknown[]).length : 0 },
                { label: "Sprint rows", value: Array.isArray(storedResults?.sprint_race) ? (storedResults.sprint_race as unknown[]).length : 0 },
                { label: "Score rows",  value: scores.length },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 rounded-lg p-2">
                  <p className="text-muted">{item.label}</p>
                  <p className="text-white font-mono font-semibold mt-0.5">{String(item.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {storedResults?.qualifying && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Raw qualifying JSON</p>
              <pre className="text-xs font-mono text-white/70 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(storedResults.qualifying, null, 2)}
              </pre>
            </div>
          )}

          {storedResults?.sprint_qualifying && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Raw sprint qualifying JSON (derived from grid)</p>
              <pre className="text-xs font-mono text-white/70 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(storedResults.sprint_qualifying, null, 2)}
              </pre>
            </div>
          )}

          {storedResults?.sprint_race && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Raw sprint race JSON</p>
              <pre className="text-xs font-mono text-white/70 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(storedResults.sprint_race, null, 2)}
              </pre>
            </div>
          )}

          {storedResults?.race && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Raw race JSON</p>
              <pre className="text-xs font-mono text-white/70 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(storedResults.race, null, 2)}
              </pre>
            </div>
          )}

          {scores.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Scores (current state)</p>
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
