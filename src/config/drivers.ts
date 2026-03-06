/**
 * ============================================================
 * F1 Predictions — 2026 Driver & Team Configuration
 * ============================================================
 *
 * This is the SINGLE SOURCE OF TRUTH for all driver and team data in the app.
 * It is used to populate dropdown menus, display names, and team logos everywhere.
 *
 * HOW TO MAKE CHANGES (no coding knowledge required):
 * ─────────────────────────────────────────────────────
 *  • To update a driver's name:   change the `name` field in their entry below.
 *  • To update a driver's code:   change the `code` field (must be 3 capital letters).
 *  • To swap a driver mid-season: find their team's entry and replace the driver
 *    object entirely with the new driver's details (name, code, nationality, number).
 *  • To change a team name:       update the `name` and/or `shortName` fields.
 *  • To update a team logo:       swap the SVG file in public/teams/ — keep the same
 *    filename, or update the `logoPath` here to match the new filename.
 *  • To add a new team:           copy any existing team block and edit all fields,
 *    then add it to the TEAMS array below.
 *
 * After saving, the app picks up changes on the next page load.
 * No database migrations or code changes are required anywhere else.
 * ============================================================
 *
 * NOTE — 2026 grid accuracy:
 * This file was compiled from information available at project setup.
 * Mid-season driver changes are common in F1 — update this file and
 * swap the relevant asset in public/teams/ as needed.
 * ============================================================
 */

export interface Driver {
  /** Full name, e.g. "Max Verstappen" */
  name: string;
  /** Official 3-letter FIA code, e.g. "VER" — stored in the database for predictions */
  code: string;
  /** Driver's nationality, e.g. "Dutch" */
  nationality: string;
  /** Permanent car number */
  number: number;
}

export interface Team {
  /** Full constructor name shown in the UI */
  name: string;
  /** Short name for compact displays (e.g. timing tower column) */
  shortName: string;
  /** Path to the team logo SVG relative to /public — e.g. "/teams/red-bull.svg" */
  logoPath: string;
  /** Hex colour for the team's branding stripe in the timing tower */
  colour: string;
  /** The two drivers currently racing for this team */
  drivers: [Driver, Driver];
}

/**
 * 2026 F1 grid — 11 constructors, 22 drivers.
 *
 * The PRD mentions 11 teams / 22 drivers. If a new constructor (e.g. Andretti
 * Cadillac) joins the grid for 2026, add them here as an additional entry.
 */
export const TEAMS: Team[] = [
  // ── 1. Red Bull ──────────────────────────────────────────
  {
    name: "Oracle Red Bull Racing",
    shortName: "Red Bull",
    logoPath: "/teams/red-bull.svg",
    colour: "#3671C6",
    drivers: [
      { name: "Max Verstappen", code: "VER", nationality: "Dutch",    number: 3  },
      { name: "Isack Hadjar",   code: "HAD", nationality: "French", number: 6 },
    ],
  },

  // ── 2. Ferrari ───────────────────────────────────────────
  {
    name: "Scuderia Ferrari",
    shortName: "Ferrari",
    logoPath: "/teams/ferrari.svg",
    colour: "#E8002D",
    drivers: [
      { name: "Charles Leclerc", code: "LEC", nationality: "Monégasque", number: 16 },
      { name: "Lewis Hamilton",  code: "HAM", nationality: "British",    number: 44 },
    ],
  },

  // ── 3. Mercedes ──────────────────────────────────────────
  {
    name: "Mercedes-AMG Petronas F1 Team",
    shortName: "Mercedes",
    logoPath: "/teams/mercedes.svg",
    colour: "#27F4D2",
    drivers: [
      { name: "George Russell",        code: "RUS", nationality: "British", number: 63 },
      { name: "Andrea Kimi Antonelli", code: "ANT", nationality: "Italian", number: 12 },
    ],
  },

  // ── 4. McLaren ───────────────────────────────────────────
  {
    name: "McLaren F1 Team",
    shortName: "McLaren",
    logoPath: "/teams/mclaren.svg",
    colour: "#FF8000",
    drivers: [
      { name: "Lando Norris",  code: "NOR", nationality: "British",    number: 4  },
      { name: "Oscar Piastri", code: "PIA", nationality: "Australian", number: 81 },
    ],
  },

  // ── 5. Aston Martin ──────────────────────────────────────
  {
    name: "Aston Martin Aramco F1 Team",
    shortName: "Aston Martin",
    logoPath: "/teams/aston-martin.svg",
    colour: "#229971",
    drivers: [
      { name: "Fernando Alonso", code: "ALO", nationality: "Spanish",  number: 14 },
      { name: "Lance Stroll",    code: "STR", nationality: "Canadian", number: 18 },
    ],
  },

  // ── 6. Alpine ────────────────────────────────────────────
  {
    name: "BWT Alpine F1 Team",
    shortName: "Alpine",
    logoPath: "/teams/alpine.svg",
    colour: "#FF87BC",
    drivers: [
      { name: "Pierre Gasly", code: "GAS", nationality: "French",     number: 10 },
      { name: "Franco Colapinto",  code: "COL", nationality: "Argentinian", number: 43  },
    ],
  },

  // ── 7. Williams ──────────────────────────────────────────
  {
    name: "Williams Racing",
    shortName: "Williams",
    logoPath: "/teams/williams.svg",
    colour: "#64C4FF",
    drivers: [
      { name: "Alexander Albon", code: "ALB", nationality: "Thai",    number: 23 },
      { name: "Carlos Sainz",    code: "SAI", nationality: "Spanish", number: 55 },
    ],
  },

  // ── 8. Haas ──────────────────────────────────────────────
  {
    name: "MoneyGram Haas F1 Team",
    shortName: "Haas",
    logoPath: "/teams/haas.svg",
    colour: "#B6BABD",
    drivers: [
      { name: "Esteban Ocon",   code: "OCO", nationality: "French",  number: 31 },
      { name: "Oliver Bearman", code: "BEA", nationality: "British", number: 87 },
    ],
  },

  // ── 9. Racing Bulls ──────────────────────────────────────
  {
    name: "Visa Cash App RB F1 Team",
    shortName: "Racing Bulls",
    logoPath: "/teams/racing-bulls.svg",
    colour: "#6692FF",
    drivers: [
      { name: "Arvid Lindblad", code: "LIN", nationality: "British",      number: 41  },
      { name: "Liam Lawson",  code: "LAW", nationality: "New Zealander",  number: 30 },
    ],
  },

  // ── 10. Audi (formerly Kick Sauber) ──────────────────────
  {
    name: "Audi F1 Team",
    shortName: "Audi",
    logoPath: "/teams/audi.svg",
    colour: "#52E252",
    drivers: [
      { name: "Nico Hülkenberg",   code: "HUL", nationality: "German",    number: 27 },
      { name: "Gabriel Bortoleto", code: "BOR", nationality: "Brazilian", number: 5  },
    ],
  },

  // ── 11. Andretti Cadillac ──────────────────
  {
    name: "Andretti Cadillac F1 Team",
    shortName: "Cadillac",
    logoPath: "/teams/andretti.svg",
    colour: "#ffffffa1",
    drivers: [
      { name: "Sergio Perez", code: "PER", nationality: "Mexican", number: 11 },
      { name: "Valtteri Bottas", code: "BOT", nationality: "Finnish", number: 77 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers — computed automatically from TEAMS above. Do not edit.
// ─────────────────────────────────────────────────────────────────────────────

/** Flat list of all drivers, sorted alphabetically by surname. */
export const ALL_DRIVERS: (Driver & { team: Team })[] = TEAMS.flatMap(
  (team) => team.drivers.map((driver) => ({ ...driver, team }))
).sort((a, b) => {
  const surnameA = a.name.split(" ").at(-1) ?? a.name;
  const surnameB = b.name.split(" ").at(-1) ?? b.name;
  return surnameA.localeCompare(surnameB);
});

/** Look up a driver by their 3-letter code. Returns undefined if not found. */
export function getDriverByCode(
  code: string
): (Driver & { team: Team }) | undefined {
  return ALL_DRIVERS.find((d) => d.code === code);
}

/** Look up a team by its short name. Returns undefined if not found. */
export function getTeamByShortName(shortName: string): Team | undefined {
  return TEAMS.find((t) => t.shortName === shortName);
}
