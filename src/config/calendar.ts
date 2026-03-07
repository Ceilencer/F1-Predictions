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
 *  • To update a date or time: change `qualifying_deadline` or `race_start`.
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
 * RACE START FORMAT
 * ─────────────────
 *  The `race_start` is the UTC time when the race begins.
 *  This is used to determine the "active" race on the home screen.
 *  A race is shown as current/upcoming until its race_start passes.
 *
 *  Times are derived from Apple TV broadcast times (US Eastern):
 *    Before 8 Mar 2026 (DST start): EST = UTC-5  →  add 5h
 *    8 Mar – 1 Nov 2026:            EDT = UTC-4  →  add 4h
 *    After 1 Nov 2026 (DST end):    EST = UTC-5  →  add 5h
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
  /**
   * UTC datetime when the race starts — home screen shows this race as active
   * until this moment passes.
   * ISO 8601 format: "YYYY-MM-DDTHH:MM:SSZ"
   */
  race_start: string;
}

/** Full 2026 F1 season. Qualifying times are set to local start time → UTC. */
export const CALENDAR_2026: CalendarRace[] = [
  {
    round: 1,
    race_name: "Australian Grand Prix",
    circuit: "Albert Park Circuit",
    country: "Australia",
    qualifying_deadline: "2026-03-07T04:00:00Z", // 15:00 AEDT (UTC+11) Sat 7 Mar
    race_start: "2026-03-08T03:00:00Z",          // 22:00 EST Sun 8 Mar (14:00 AEDT) — Apple TV 10 PM Sat 7 Mar ET
  },
  {
    round: 2,
    race_name: "Chinese Grand Prix",
    circuit: "Shanghai International Circuit",
    country: "China",
    qualifying_deadline: "2026-03-14T07:00:00Z", // 15:00 CST (UTC+8) Sat 14 Mar
    race_start: "2026-03-15T06:00:00Z",          // 02:00 EDT Sun 15 Mar (14:00 CST) — Apple TV 2 AM Sun 15 Mar ET
  },
  {
    round: 3,
    race_name: "Japanese Grand Prix",
    circuit: "Suzuka International Racing Course",
    country: "Japan",
    qualifying_deadline: "2026-03-28T06:00:00Z", // 15:00 JST (UTC+9) Sat 28 Mar
    race_start: "2026-03-29T04:00:00Z",          // 00:00 EDT Sun 29 Mar (13:00 JST) — Apple TV 12 AM Sun 29 Mar ET
  },
  {
    round: 4,
    race_name: "Bahrain Grand Prix",
    circuit: "Bahrain International Circuit",
    country: "Bahrain",
    qualifying_deadline: "2026-04-11T12:00:00Z", // 15:00 AST (UTC+3) Sat 11 Apr
    race_start: "2026-04-12T14:00:00Z",          // 10:00 EDT Sun 12 Apr (17:00 AST) — Apple TV 10 AM Sun 12 Apr ET
  },
  {
    round: 5,
    race_name: "Saudi Arabian Grand Prix",
    circuit: "Jeddah Corniche Circuit",
    country: "Saudi Arabia",
    qualifying_deadline: "2026-04-18T12:00:00Z", // 15:00 AST (UTC+3) Sat 18 Apr
    race_start: "2026-04-19T16:00:00Z",          // 12:00 EDT Sun 19 Apr (19:00 AST) — Apple TV 12 PM Sun 19 Apr ET
  },
  {
    round: 6,
    race_name: "Miami Grand Prix",
    circuit: "Miami International Autodrome",
    country: "United States",
    qualifying_deadline: "2026-05-02T19:00:00Z", // 15:00 EDT (UTC-4) Sat 2 May
    race_start: "2026-05-03T19:00:00Z",          // 15:00 EDT Sun 3 May — Apple TV 3 PM Sun 3 May ET
  },
  {
    round: 7,
    race_name: "Canadian Grand Prix",
    circuit: "Circuit Gilles Villeneuve",
    country: "Canada",
    qualifying_deadline: "2026-05-23T19:00:00Z", // 15:00 EDT (UTC-4) Sat 23 May
    race_start: "2026-05-24T19:00:00Z",          // 15:00 EDT Sun 24 May — Apple TV 3 PM Sun 24 May ET
  },
  {
    round: 8,
    race_name: "Monaco Grand Prix",
    circuit: "Circuit de Monaco",
    country: "Monaco",
    qualifying_deadline: "2026-06-06T13:00:00Z", // 15:00 CEST (UTC+2) Sat 6 Jun
    race_start: "2026-06-07T12:00:00Z",          // 08:00 EDT Sun 7 Jun (14:00 CEST) — Apple TV 8 AM Sun 7 Jun ET
  },
  {
    round: 9,
    race_name: "Barcelona-Catalunya Grand Prix",
    circuit: "Circuit de Barcelona-Catalunya",
    country: "Spain",
    qualifying_deadline: "2026-06-13T13:00:00Z", // 15:00 CEST (UTC+2) Sat 13 Jun
    race_start: "2026-06-14T12:00:00Z",          // 08:00 EDT Sun 14 Jun (14:00 CEST) — Apple TV 8 AM Sun 14 Jun ET
  },
  {
    round: 10,
    race_name: "Austrian Grand Prix",
    circuit: "Red Bull Ring",
    country: "Austria",
    qualifying_deadline: "2026-06-27T13:00:00Z", // 15:00 CEST (UTC+2) Sat 27 Jun
    race_start: "2026-06-28T12:00:00Z",          // 08:00 EDT Sun 28 Jun (14:00 CEST) — Apple TV 8 AM Sun 28 Jun ET
  },
  {
    round: 11,
    race_name: "British Grand Prix",
    circuit: "Silverstone Circuit",
    country: "Great Britain",
    qualifying_deadline: "2026-07-04T14:00:00Z", // 15:00 BST (UTC+1) Sat 4 Jul
    race_start: "2026-07-05T13:00:00Z",          // 09:00 EDT Sun 5 Jul (14:00 BST) — Apple TV 9 AM Sun 5 Jul ET
  },
  {
    round: 12,
    race_name: "Belgian Grand Prix",
    circuit: "Circuit de Spa-Francorchamps",
    country: "Belgium",
    qualifying_deadline: "2026-07-18T13:00:00Z", // 15:00 CEST (UTC+2) Sat 18 Jul
    race_start: "2026-07-19T12:00:00Z",          // 08:00 EDT Sun 19 Jul (14:00 CEST) — Apple TV 8 AM Sun 19 Jul ET
  },
  {
    round: 13,
    race_name: "Hungarian Grand Prix",
    circuit: "Hungaroring",
    country: "Hungary",
    qualifying_deadline: "2026-07-25T13:00:00Z", // 15:00 CEST (UTC+2) Sat 25 Jul
    race_start: "2026-07-26T12:00:00Z",          // 08:00 EDT Sun 26 Jul (14:00 CEST) — Apple TV 8 AM Sun 26 Jul ET
  },
  {
    round: 14,
    race_name: "Dutch Grand Prix",
    circuit: "Circuit Zandvoort",
    country: "Netherlands",
    qualifying_deadline: "2026-08-22T13:00:00Z", // 15:00 CEST (UTC+2) Sat 22 Aug
    race_start: "2026-08-23T12:00:00Z",          // 08:00 EDT Sun 23 Aug (14:00 CEST) — Apple TV 8 AM Sun 23 Aug ET
  },
  {
    round: 15,
    race_name: "Italian Grand Prix",
    circuit: "Autodromo Nazionale Monza",
    country: "Italy",
    qualifying_deadline: "2026-09-05T13:00:00Z", // 15:00 CEST (UTC+2) Sat 5 Sep
    race_start: "2026-09-06T12:00:00Z",          // 08:00 EDT Sun 6 Sep (14:00 CEST) — Apple TV 8 AM Sun 6 Sep ET
  },
  {
    round: 16,
    race_name: "Spanish Grand Prix",
    circuit: "Madring",
    country: "Spain",
    qualifying_deadline: "2026-09-12T13:00:00Z", // 15:00 CEST (UTC+2) Sat 12 Sep — new Madrid circuit
    race_start: "2026-09-13T12:00:00Z",          // 08:00 EDT Sun 13 Sep (14:00 CEST) — Apple TV 8 AM Sun 13 Sep ET
  },
  {
    round: 17,
    race_name: "Azerbaijan Grand Prix",
    circuit: "Baku City Circuit",
    country: "Azerbaijan",
    qualifying_deadline: "2026-09-25T11:00:00Z", // 15:00 AZT (UTC+4) Sat 25 Sep
    race_start: "2026-09-26T10:00:00Z",          // 06:00 EDT Sun 26 Sep (14:00 AZT) — Apple TV 6 AM Sun 26 Sep ET
  },
  {
    round: 18,
    race_name: "Singapore Grand Prix",
    circuit: "Marina Bay Street Circuit",
    country: "Singapore",
    qualifying_deadline: "2026-10-10T13:00:00Z", // 21:00 SGT (UTC+8) Sat 10 Oct — night race
    race_start: "2026-10-11T11:00:00Z",          // 07:00 EDT Sun 11 Oct (19:00 SGT) — Apple TV 7 AM Sun 11 Oct ET
  },
  {
    round: 19,
    race_name: "United States Grand Prix",
    circuit: "Circuit of the Americas",
    country: "United States",
    qualifying_deadline: "2026-10-24T20:00:00Z", // 15:00 CDT (UTC-5) Sat 24 Oct
    race_start: "2026-10-25T19:00:00Z",          // 15:00 EDT Sun 25 Oct — Apple TV 3 PM Sun 25 Oct ET
  },
  {
    round: 20,
    race_name: "Mexico City Grand Prix",
    circuit: "Autodromo Hermanos Rodriguez",
    country: "Mexico",
    qualifying_deadline: "2026-10-31T21:00:00Z", // 15:00 CST (UTC-6) Sat 31 Oct — Mexico has no DST
    race_start: "2026-11-01T18:00:00Z",          // 14:00 EDT Sun 1 Nov — Apple TV 2 PM Sun 1 Nov ET
  },
  {
    round: 21,
    race_name: "São Paulo Grand Prix",
    circuit: "Autodromo Jose Carlos Pace",
    country: "Brazil",
    qualifying_deadline: "2026-11-07T18:00:00Z", // 15:00 BRT (UTC-3) Sat 7 Nov
    race_start: "2026-11-08T16:00:00Z",          // 11:00 EST Sun 8 Nov (13:00 BRT) — Apple TV 11 AM Sun 8 Nov ET
  },
  {
    round: 22,
    race_name: "Las Vegas Grand Prix",
    circuit: "Las Vegas Strip Circuit",
    country: "United States",
    qualifying_deadline: "2026-11-21T06:00:00Z", // 22:00 PST Fri 20 Nov (UTC-8) — night race qualifying
    race_start: "2026-11-22T03:00:00Z",          // 22:00 EST Sat 21 Nov — Apple TV 10 PM Sat 21 Nov ET
  },
  {
    round: 23,
    race_name: "Qatar Grand Prix",
    circuit: "Lusail International Circuit",
    country: "Qatar",
    qualifying_deadline: "2026-11-28T12:00:00Z", // 15:00 AST (UTC+3) Sat 28 Nov
    race_start: "2026-11-29T15:00:00Z",          // 10:00 EST Sun 29 Nov (18:00 AST) — Apple TV 10 AM Sun 29 Nov ET
  },
  {
    round: 24,
    race_name: "Abu Dhabi Grand Prix",
    circuit: "Yas Marina Circuit",
    country: "UAE",
    qualifying_deadline: "2026-12-05T11:00:00Z", // 15:00 GST (UTC+4) Sat 5 Dec
    race_start: "2026-12-06T12:00:00Z",          // 07:00 EST Sun 6 Dec (16:00 GST) — Apple TV 7 AM Sun 6 Dec ET
  },
];

export const SEASON = 2026;
