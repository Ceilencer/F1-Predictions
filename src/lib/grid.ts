/**
 * ============================================================
 * Grid resolution layer (server-only)
 * ============================================================
 * Replaces the old static lookups from `src/config/drivers.ts`.
 *
 * Source of truth is the database:
 *   • teams / drivers            — the roster (who exists)
 *   • season_seats               — the DEFAULT / normal lineup
 *   • race_weekend_drivers       — a per-weekend SNAPSHOT (one-off overrides)
 *
 * A weekend uses its snapshot if it has one; otherwise it falls back to the
 * season default. Snapshots are what freeze history so past race cards keep
 * showing exactly who raced that weekend.
 *
 * These functions read via the request-scoped Supabase client and must only be
 * called from Server Components / Server Actions. The resulting plain objects
 * (GridTeam / GridDriver / *Map) are serialisable and can be passed as props to
 * client components (e.g. DriverPickerModal).
 * ============================================================
 */

import { createClient } from "@/lib/supabase/server";
import type { GridTeam, GridDriver, GridTeamWithDrivers, DriverMap, TeamMap } from "@/lib/grid-types";

// Re-export the client-safe types + pure helpers so server code can import
// everything from a single place (`@/lib/grid`).
export * from "@/lib/grid-types";

// ── Internal loaders ────────────────────────────────────────────────────────────

type TeamRow = {
  id: string;
  key: string;
  name: string;
  logo_path: string;
  colour: string;
  sort_order: number;
};
type DriverRow = {
  id: string;
  code: string;
  name: string;
  nationality: string;
  number: number | null;
  photo_path: string;
  is_active: boolean;
};

function toGridTeam(t: TeamRow): GridTeam {
  return {
    shortName: t.key,
    name: t.name,
    logoPath: t.logo_path,
    colour: t.colour,
    sortOrder: t.sort_order,
  };
}

function toGridDriver(d: DriverRow, team: GridTeam | null): GridDriver {
  return {
    code: d.code,
    name: d.name,
    nationality: d.nationality,
    number: d.number,
    photoPath: d.photo_path,
    team,
  };
}

/** Build the grid for a set of seat rows (weekend snapshot OR season default). */
function buildGrid(
  seatRows: { team_id: string; seat_no: number; driver_id: string | null }[],
  teams: TeamRow[],
  driversById: Map<string, DriverRow>
): GridTeamWithDrivers[] {
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const seatsByTeam = new Map<string, { seat_no: number; driver_id: string | null }[]>();
  for (const s of seatRows) {
    const arr = seatsByTeam.get(s.team_id) ?? [];
    arr.push({ seat_no: s.seat_no, driver_id: s.driver_id });
    seatsByTeam.set(s.team_id, arr);
  }

  return [...teams]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((teamRow) => {
      const gridTeam = toGridTeam(teamRow);
      const seats = (seatsByTeam.get(teamRow.id) ?? []).sort((a, b) => a.seat_no - b.seat_no);
      const drivers = seats
        .map((s) => (s.driver_id ? driversById.get(s.driver_id) : null))
        .filter((d): d is DriverRow => !!d)
        .map((d) => toGridDriver(d, gridTeam));
      return { ...gridTeam, drivers };
    });
}

// ── Public API ──────────────────────────────────────────────────────────────────

/** All teams, keyed by their short name (used to resolve Surprise / Flop team picks). */
export async function getTeamMap(): Promise<TeamMap> {
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("*");
  const map: TeamMap = {};
  for (const t of (data ?? []) as TeamRow[]) map[t.key] = toGridTeam(t);
  return map;
}

/**
 * The full roster as a flat list, sorted by surname then name.
 * Used to populate admin seat dropdowns. Team is left null here (not needed there).
 * Pass `activeOnly` to hide retired drivers.
 */
export async function getRoster(activeOnly = false): Promise<GridDriver[]> {
  const supabase = await createClient();
  let query = supabase.from("drivers").select("*");
  if (activeOnly) query = query.eq("is_active", true);
  const { data } = await query;
  return ((data ?? []) as DriverRow[])
    .map((d) => toGridDriver(d, null))
    .sort((a, b) => {
      const sa = a.name.split(" ").at(-1) ?? a.name;
      const sb = b.name.split(" ").at(-1) ?? b.name;
      return sa.localeCompare(sb);
    });
}

/** The season DEFAULT lineup, as teams-with-drivers (for the admin default panel). */
export async function getSeasonGrid(season: number): Promise<GridTeamWithDrivers[]> {
  const supabase = await createClient();
  const [{ data: teams }, { data: seats }, { data: drivers }] = await Promise.all([
    supabase.from("teams").select("*"),
    supabase.from("season_seats").select("team_id, seat_no, driver_id").eq("season", season),
    supabase.from("drivers").select("*"),
  ]);
  const driversById = new Map(((drivers ?? []) as DriverRow[]).map((d) => [d.id, d]));
  return buildGrid((seats ?? []) as never[], (teams ?? []) as TeamRow[], driversById);
}

/**
 * The grid for a given race weekend: its snapshot if one exists, otherwise the
 * season default. This is what the predict picker and history render against.
 */
export async function getWeekendGrid(raceWeekendId: string): Promise<GridTeamWithDrivers[]> {
  const supabase = await createClient();

  const { data: weekend } = await supabase
    .from("race_weekends")
    .select("season")
    .eq("id", raceWeekendId)
    .maybeSingle();
  if (!weekend) return [];

  const [{ data: teams }, { data: snapshot }, { data: drivers }] = await Promise.all([
    supabase.from("teams").select("*"),
    supabase
      .from("race_weekend_drivers")
      .select("team_id, seat_no, driver_id")
      .eq("race_weekend_id", raceWeekendId),
    supabase.from("drivers").select("*"),
  ]);

  let seats = (snapshot ?? []) as { team_id: string; seat_no: number; driver_id: string | null }[];
  if (seats.length === 0) {
    // Fall back to the season default for weekends created before snapshotting.
    const { data: seasonSeats } = await supabase
      .from("season_seats")
      .select("team_id, seat_no, driver_id")
      .eq("season", weekend.season);
    seats = (seasonSeats ?? []) as typeof seats;
  }

  const driversById = new Map(((drivers ?? []) as DriverRow[]).map((d) => [d.id, d]));
  return buildGrid(seats, (teams ?? []) as TeamRow[], driversById);
}

/**
 * code → driver map for a specific weekend. Every driver in that weekend's grid
 * resolves with the team they raced for that weekend; every other roster driver
 * still resolves (team = null) so historical / off-grid codes keep a name & photo.
 */
export async function getWeekendDriverMap(raceWeekendId: string): Promise<DriverMap> {
  const supabase = await createClient();
  const [grid, { data: allDrivers }] = await Promise.all([
    getWeekendGrid(raceWeekendId),
    supabase.from("drivers").select("*"),
  ]);

  const map: DriverMap = {};
  // Roster first (team null), then overlay the weekend grid (team set) so the
  // weekend's teams win for anyone actually seated this weekend.
  for (const d of (allDrivers ?? []) as DriverRow[]) map[d.code] = toGridDriver(d, null);
  for (const team of grid) {
    for (const driver of team.drivers) map[driver.code] = driver;
  }
  return map;
}
