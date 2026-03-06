/**
 * ============================================================
 * F1 Predictions — 2026 Race Calendar
 * ============================================================
 *
 * This file pre-defines every race weekend of the 2026 season.
 * Use the "Seed from calendar" button in the Admin panel to
 * create all race weekends in the database in one click.
 *
 * HOW TO UPDATE THIS FILE (no coding knowledge required):
 * ─────────────────────────────────────────────────────────
 *  • Each race is one block between { ... } in the CALENDAR_2026 array.
 *  • To update a date or time: change `qualifying_deadline`.
 *  • To add a race: copy an existing block and edit all fields.
 *  • To remove a race: delete its entire block (including the trailing comma).
 *
 * QUALIFYING DEADLINE FORMAT
 * ──────────────────────────
 *  The `qualifying_deadline` is the UTC time when qualifying STARTS.
 *  Predictions lock at this moment.
 *
 *  Formula: take the local qualifying start time, subtract the UTC offset.
 *  Example: Qualifying starts 15:00 in Melbourne (AEDT = UTC+11)
 *           → 15:00 − 11h = 04:00 UTC → "2026-03-07T04:00:00Z"
 *
 *  Common UTC offsets for F1 venues:
 *    Melbourne (AEDT)   UTC+11  →  subtract 11h
 *    Bahrain / Riyadh   UTC+3   →  subtract 3h
 *    Monaco / Barcelona UTC+2   →  subtract 2h
 *    London (BST)       UTC+1   →  subtract 1h
 *    Austin             UTC-5   →  add 5h  (CDT in October)
 *    Mexico City        UTC-6   →  add 6h  (permanent CST — no DST since 2023)
 *    Abu Dhabi          UTC+4   →  subtract 4h
 *
 *  F1 qualifying almost always starts at 15:00 local time on Saturday.
 *  Exceptions: Singapore (21:00 SGT — night race)
 *              Las Vegas (22:00 PST Friday — night race, runs Sat/Sun schedule)
 *
 * ⚠️  IMPORTANT — VERIFY DATES BEFORE EACH RACE
 * ──────────────────────────────────────────────
 *  The dates below are based on the official 2026 F1 calendar.
 *  Always confirm with formula1.com before each race weekend
 *  and update any times that have changed.
 * ============================================================
 */

export interface CalendarRace {
  /** FIA round number */
  round: number;
  /** Official race name, e.g. "Australian Grand Prix" */
  race_name: string;
  /** Circuit name, for display only */
  circuit: string;
  /** Country, for display only */
  country: string;
  /**
   * UTC datetime when qualifying starts — predictions lock at this moment.
   * ISO 8601 format: "YYYY-MM-DDTHH:MM:SSZ"
   */
  qualifying_deadline: string;
}

/** Full 2026 F1 season. Qualifying times are set to local start time → UTC. */
export const CALENDAR_2026: CalendarRace[] = [
  {
    round: 1,
    race_name: "Australian Grand Prix",
    circuit: "Albert Park Circuit",
    country: "Australia",
    qualifying_deadline: "2026-03-07T04:00:00Z", // 15:00 AEDT (UTC+11), race 8 Mar
  },
  {
    round: 2,
    race_name: "Chinese Grand Prix",
    circuit: "Shanghai International Circuit",
    country: "China",
    qualifying_deadline: "2026-03-14T07:00:00Z", // 15:00 CST (UTC+8), race 15 Mar
  },
  {
    round: 3,
    race_name: "Japanese Grand Prix",
    circuit: "Suzuka International Racing Course",
    country: "Japan",
    qualifying_deadline: "2026-03-28T06:00:00Z", // 15:00 JST (UTC+9), race 29 Mar
  },
  {
    round: 4,
    race_name: "Bahrain Grand Prix",
    circuit: "Bahrain International Circuit",
    country: "Bahrain",
    qualifying_deadline: "2026-04-11T12:00:00Z", // 15:00 AST (UTC+3), race 12 Apr
  },
  {
    round: 5,
    race_name: "Saudi Arabian Grand Prix",
    circuit: "Jeddah Corniche Circuit",
    country: "Saudi Arabia",
    qualifying_deadline: "2026-04-18T12:00:00Z", // 15:00 AST (UTC+3), race 19 Apr
  },
  {
    round: 6,
    race_name: "Miami Grand Prix",
    circuit: "Miami International Autodrome",
    country: "United States",
    qualifying_deadline: "2026-05-02T19:00:00Z", // 15:00 EDT (UTC-4), race 3 May
  },
  {
    round: 7,
    race_name: "Canadian Grand Prix",
    circuit: "Circuit Gilles Villeneuve",
    country: "Canada",
    qualifying_deadline: "2026-05-23T19:00:00Z", // 15:00 EDT (UTC-4), race 24 May
  },
  {
    round: 8,
    race_name: "Monaco Grand Prix",
    circuit: "Circuit de Monaco",
    country: "Monaco",
    qualifying_deadline: "2026-06-06T13:00:00Z", // 15:00 CEST (UTC+2), race 7 Jun
  },
  {
    round: 9,
    race_name: "Barcelona-Catalunya Grand Prix",
    circuit: "Circuit de Barcelona-Catalunya",
    country: "Spain",
    qualifying_deadline: "2026-06-13T13:00:00Z", // 15:00 CEST (UTC+2), race 14 Jun
  },
  {
    round: 10,
    race_name: "Austrian Grand Prix",
    circuit: "Red Bull Ring",
    country: "Austria",
    qualifying_deadline: "2026-06-27T13:00:00Z", // 15:00 CEST (UTC+2), race 28 Jun
  },
  {
    round: 11,
    race_name: "British Grand Prix",
    circuit: "Silverstone Circuit",
    country: "Great Britain",
    qualifying_deadline: "2026-07-04T14:00:00Z", // 15:00 BST (UTC+1), race 5 Jul
  },
  {
    round: 12,
    race_name: "Belgian Grand Prix",
    circuit: "Circuit de Spa-Francorchamps",
    country: "Belgium",
    qualifying_deadline: "2026-07-18T13:00:00Z", // 15:00 CEST (UTC+2), race 19 Jul
  },
  {
    round: 13,
    race_name: "Hungarian Grand Prix",
    circuit: "Hungaroring",
    country: "Hungary",
    qualifying_deadline: "2026-07-25T13:00:00Z", // 15:00 CEST (UTC+2), race 26 Jul
  },
  {
    round: 14,
    race_name: "Dutch Grand Prix",
    circuit: "Circuit Zandvoort",
    country: "Netherlands",
    qualifying_deadline: "2026-08-22T13:00:00Z", // 15:00 CEST (UTC+2), race 23 Aug
  },
  {
    round: 15,
    race_name: "Italian Grand Prix",
    circuit: "Autodromo Nazionale Monza",
    country: "Italy",
    qualifying_deadline: "2026-09-05T13:00:00Z", // 15:00 CEST (UTC+2), race 6 Sep
  },
  {
    round: 16,
    race_name: "Spanish Grand Prix",
    circuit: "Madring",
    country: "Spain",
    qualifying_deadline: "2026-09-12T13:00:00Z", // 15:00 CEST (UTC+2), race 13 Sep — new Madrid circuit
  },
  {
    round: 17,
    race_name: "Azerbaijan Grand Prix",
    circuit: "Baku City Circuit",
    country: "Azerbaijan",
    qualifying_deadline: "2026-09-26T11:00:00Z", // 15:00 AZT (UTC+4), race 27 Sep
  },
  {
    round: 18,
    race_name: "Singapore Grand Prix",
    circuit: "Marina Bay Street Circuit",
    country: "Singapore",
    qualifying_deadline: "2026-10-10T13:00:00Z", // 21:00 SGT (UTC+8) — night race, race 11 Oct
  },
  {
    round: 19,
    race_name: "United States Grand Prix",
    circuit: "Circuit of the Americas",
    country: "United States",
    qualifying_deadline: "2026-10-24T20:00:00Z", // 15:00 CDT (UTC-5), race 25 Oct
  },
  {
    round: 20,
    race_name: "Mexico City Grand Prix",
    circuit: "Autodromo Hermanos Rodriguez",
    country: "Mexico",
    qualifying_deadline: "2026-10-31T21:00:00Z", // 15:00 CST (UTC-6, no DST in Mexico), race 1 Nov
  },
  {
    round: 21,
    race_name: "São Paulo Grand Prix",
    circuit: "Autodromo Jose Carlos Pace",
    country: "Brazil",
    qualifying_deadline: "2026-11-07T18:00:00Z", // 15:00 BRT (UTC-3), race 8 Nov
  },
  {
    round: 22,
    race_name: "Las Vegas Grand Prix",
    circuit: "Las Vegas Strip Circuit",
    country: "United States",
    qualifying_deadline: "2026-11-21T06:00:00Z", // 22:00 PST Fri 20 Nov (UTC-8) — night race, race 21 Nov
  },
  {
    round: 23,
    race_name: "Qatar Grand Prix",
    circuit: "Lusail International Circuit",
    country: "Qatar",
    qualifying_deadline: "2026-11-28T12:00:00Z", // 15:00 AST (UTC+3), race 29 Nov
  },
  {
    round: 24,
    race_name: "Abu Dhabi Grand Prix",
    circuit: "Yas Marina Circuit",
    country: "UAE",
    qualifying_deadline: "2026-12-05T11:00:00Z", // 15:00 GST (UTC+4), race 6 Dec
  },
];

export const SEASON = 2026;
