/**
 * Client-safe grid types + pure resolve helpers.
 *
 * This module has NO server-only imports, so it can be imported from client
 * components (e.g. DriverPickerModal). The server-side data loaders live in
 * `src/lib/grid.ts`, which re-exports everything here.
 */

export interface GridTeam {
  /** Stable identity — equals the value stored in predictions for team picks. */
  shortName: string;
  name: string;
  logoPath: string;
  colour: string;
  sortOrder: number;
}

export interface GridDriver {
  code: string;
  name: string;
  nationality: string;
  number: number | null;
  photoPath: string;
  /** The team this driver is resolved against (null for a roster-only driver). */
  team: GridTeam | null;
}

export interface GridTeamWithDrivers extends GridTeam {
  /** Seated drivers for this team, in seat order (0–2 entries). */
  drivers: GridDriver[];
}

export type DriverMap = Record<string, GridDriver>;
export type TeamMap = Record<string, GridTeam>;

export function resolveDriver(map: DriverMap, code: string | null | undefined): GridDriver | null {
  return code ? map[code] ?? null : null;
}

export function resolveTeam(map: TeamMap, key: string | null | undefined): GridTeam | null {
  return key ? map[key] ?? null : null;
}
