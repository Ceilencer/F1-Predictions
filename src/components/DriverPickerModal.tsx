"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { resolveDriver, resolveTeam } from "@/lib/grid-types";
import type { DriverMap, TeamMap, GridTeamWithDrivers } from "@/lib/grid-types";

interface DriverPickerModalProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** When true, teams can be selected in addition to drivers (for Surprise / Flop fields) */
  allowTeams?: boolean;
  placeholder?: string;
  /** This weekend's grid (teams + their seated drivers), in team order. */
  grid: GridTeamWithDrivers[];
  /** code → driver lookup for rendering the current selection. */
  driverMap: DriverMap;
  /** key → team lookup for rendering the current team selection. */
  teamMap: TeamMap;
}

export default function DriverPickerModal({
  value,
  onChange,
  disabled = false,
  allowTeams = false,
  placeholder,
  grid,
  driverMap,
  teamMap,
}: DriverPickerModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<GridTeamWithDrivers | null>(null);

  const defaultPlaceholder = allowTeams ? "Select a driver or team…" : "Select a driver…";

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedTeam) setSelectedTeam(null);
        else closeModal();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, selectedTeam]);

  function closeModal() {
    setOpen(false);
    setSelectedTeam(null);
  }

  function pick(v: string) {
    onChange(v);
    closeModal();
  }

  const driver = resolveDriver(driverMap, value);
  const team   = !driver ? resolveTeam(teamMap, value) : null;
  const driverColour = driver?.team?.colour ?? "#9ca3af";

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="
          w-full min-h-[44px] px-3 py-2 rounded-lg text-sm text-left
          bg-background border border-white/10
          hover:border-white/25 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors flex items-center gap-3
        "
      >
        {driver ? (
          <>
            <div
              className="relative h-8 w-8 rounded-full overflow-hidden shrink-0"
              style={{ background: driverColour + "33" }}
            >
              <Image
                src={driver.photoPath}
                alt={driver.name}
                fill
                unoptimized
                className="object-cover object-top"
                sizes="32px"
              />
            </div>
            <span
              className="px-1.5 py-0.5 rounded text-xs font-bold tracking-wide shrink-0"
              style={{ background: driverColour + "33", color: driverColour }}
            >
              {driver.code}
            </span>
            <span className="text-white truncate">{driver.name}</span>
          </>
        ) : team ? (
          <>
            <div className="relative h-7 w-7 shrink-0">
              <Image src={team.logoPath} alt={team.shortName} fill unoptimized className="object-contain" sizes="28px" />
            </div>
            <span className="text-white truncate">{team.name}</span>
          </>
        ) : (
          <span className="text-muted">{placeholder ?? defaultPlaceholder}</span>
        )}
      </button>

      {/* ── Modal overlay ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Panel — bottom sheet on mobile, centred modal on desktop */}
          <div className="
            relative z-10 w-full sm:max-w-lg
            bg-surface border border-white/10
            rounded-t-2xl sm:rounded-2xl
            max-h-[85vh] sm:max-h-[80vh] flex flex-col
            max-sm:animate-slide-up sm:animate-fade-scale
          ">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              {selectedTeam ? (
                <button
                  type="button"
                  onClick={() => setSelectedTeam(null)}
                  className="flex items-center gap-1.5 text-muted hover:text-white transition-colors text-sm"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  All teams
                </button>
              ) : (
                <p className="text-sm font-semibold text-white">
                  {allowTeams ? "Select driver or team" : "Select driver"}
                </p>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-4">
              {selectedTeam ? (
                <DriverPanel team={selectedTeam} allowTeams={allowTeams} onPick={pick} />
              ) : (
                <TeamGrid teams={grid} onSelect={setSelectedTeam} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Team grid (step 1) ────────────────────────────────────────────────────────

function TeamGrid({
  teams,
  onSelect,
}: {
  teams: GridTeamWithDrivers[];
  onSelect: (t: GridTeamWithDrivers) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
      {teams.map((team) => (
        <button
          key={team.shortName}
          type="button"
          onClick={() => onSelect(team)}
          className="
            flex flex-col items-center gap-2 p-3 rounded-xl
            bg-background border border-white/5
            hover:border-white/20 hover:bg-white/5
            active:scale-95 transition-all
          "
        >
          <div className="relative h-9 w-full">
            <Image
              src={team.logoPath}
              alt={team.shortName}
              fill
              unoptimized
              className="object-contain"
              sizes="80px"
            />
          </div>
          <span className="text-[11px] text-muted text-center leading-tight">{team.shortName}</span>
        </button>
      ))}
    </div>
  );
}

// ── Driver panel (step 2) ─────────────────────────────────────────────────────

function DriverPanel({
  team,
  allowTeams,
  onPick,
}: {
  team: GridTeamWithDrivers;
  allowTeams: boolean;
  onPick: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Team header */}
      <div className="flex items-center gap-3">
        <div className="relative h-8 w-8 shrink-0">
          <Image src={team.logoPath} alt={team.shortName} fill unoptimized className="object-contain" sizes="32px" />
        </div>
        <p className="text-sm font-semibold text-white truncate">{team.name}</p>
      </div>

      {/* Colour stripe */}
      <div className="h-0.5 rounded-full" style={{ background: team.colour }} />

      {/* Select team button */}
      {allowTeams && (
        <button
          type="button"
          onClick={() => onPick(team.shortName)}
          className="
            w-full py-2.5 rounded-xl text-sm font-semibold
            border transition-colors
            hover:bg-white/5 active:scale-[0.98]
          "
          style={{
            borderColor: team.colour + "66",
            color: team.colour,
          }}
        >
          Select {team.shortName} (team)
        </button>
      )}

      {/* Driver cards */}
      <div className="grid grid-cols-2 gap-3">
        {team.drivers.map((driver) => (
          <button
            key={driver.code}
            type="button"
            onClick={() => onPick(driver.code)}
            className="
              flex flex-col rounded-xl overflow-hidden
              bg-background border border-white/5
              hover:border-white/25 active:scale-95 transition-all
              group
            "
          >
            {/* Photo */}
            <div
              className="relative w-full aspect-[3/4]"
              style={{ background: team.colour + "1a" }}
            >
              <Image
                src={driver.photoPath}
                alt={driver.name}
                fill
                unoptimized
                className="object-cover object-[center_top] group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 640px) 45vw, 200px"
              />
            </div>
            {/* Name bar */}
            <div className="px-2.5 py-2 border-t border-white/5">
              <p
                className="text-xs font-bold tracking-widest"
                style={{ color: team.colour }}
              >
                {driver.code}
              </p>
              <p className="text-xs text-white font-medium leading-tight mt-0.5 truncate">
                {driver.name.split(" ").slice(-1)[0]}
              </p>
              <p className="text-[11px] text-muted leading-tight truncate">
                {driver.name.split(" ").slice(0, -1).join(" ")}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
