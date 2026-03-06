"use client";

import { TEAMS } from "@/config/drivers";

interface DriverSelectProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function DriverSelect({
  name,
  value,
  onChange,
  disabled = false,
  placeholder = "Select a driver…",
}: DriverSelectProps) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onWheel={(e) => e.currentTarget.blur()}
      disabled={disabled}
      className={`
        w-full min-h-[44px] px-3 py-2.5 rounded-lg text-sm
        bg-background border border-white/10
        text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      `}
    >
      <option value="">{placeholder}</option>
      {TEAMS.map((team) => (
        <optgroup
          key={team.shortName}
          label={`── ${team.shortName} ──`}
        >
          {team.drivers.map((driver) => (
            <option key={driver.code} value={driver.code}>
              {driver.code} — {driver.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
