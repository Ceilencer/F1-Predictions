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
   * true = FP1 / Sprint Qualifying / Sprint Race / Qualifying / Race format.
   * false (default) = FP1 / FP2 / FP3 / Qualifying / Race format.
   */
  is_sprint_weekend?: boolean;
  // ── Session start times (all UTC ISO 8601, null until populated) ─────────
  /** FP1 — present on all weekends */
  fp1_start?: string | null;
  /** FP2 — standard weekends only (null on sprint weekends) */
  fp2_start?: string | null;
  /** FP3 — standard weekends only (null on sprint weekends) */
  fp3_start?: string | null;
  /** Sprint Qualifying — sprint weekends only (null on standard weekends) */
  sprint_qualifying_start?: string | null;
  /** Sprint Race — sprint weekends only (null on standard weekends) */
  sprint_race_start?: string | null;
  /**
   * UTC datetime when qualifying starts — predictions lock at this moment.
   * Also used as the qualifying session start time.
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

/**
 * Full 2026 F1 season.
 * All times are UTC (ISO 8601). Session times converted from the official F1 app
 * displayed in US Eastern time:
 *   Pre-8 Mar (Australian GP):  CST = UTC-6  →  add 6h
 *   8 Mar – 1 Nov:              CDT = UTC-5  →  add 5h
 *   Las Vegas FP/qualifying:    PST = UTC-8  →  add 8h  (local night-race times, already correct)
 *   Nov onwards:                CST = UTC-6  →  add 6h
 *
 * Sprint weekends: FP1 / Sprint Qualifying / Sprint Race / Qualifying / Race
 * Standard weekends: FP1 / FP2 / FP3 / Qualifying / Race
 */
export const CALENDAR_2026: CalendarRace[] = [
  // ── Round 1 ──────────────────────────────────────────────────────────────
  {
    round: 1,
    race_name: "Australian Grand Prix",
    circuit: "Albert Park Circuit",
    country: "Australia",
    fp1_start:           "2026-03-06T01:30:00Z", // Fri  6 Mar 19:30 CST
    fp2_start:           "2026-03-06T05:00:00Z", // Fri  6 Mar 23:00 CST
    fp3_start:           "2026-03-07T01:30:00Z", // Sat  7 Mar 19:30 CST
    qualifying_deadline: "2026-03-07T05:00:00Z", // Sat  7 Mar 23:00 CST — predictions lock
    race_start:          "2026-03-08T04:00:00Z", // Sun  8 Mar 22:00 CST (10pm — user confirmed)
  },
  // ── Round 2 ──────────────────────────────────────────────────────────────
  {
    round: 2,
    race_name: "Chinese Grand Prix",
    circuit: "Shanghai International Circuit",
    country: "China",
    is_sprint_weekend: true,
    fp1_start:                "2026-03-13T03:30:00Z", // Fri 13 Mar 22:30 CDT
    sprint_qualifying_start:  "2026-03-13T07:30:00Z", // Sat 13 Mar 02:30 CDT — predictions lock
    sprint_race_start:        "2026-03-14T03:00:00Z", // Sat 13 Mar 22:00 CDT
    qualifying_deadline:      "2026-03-13T07:30:00Z", // = sprint_qualifying_start (locks before any competitive session)
    race_start:               "2026-03-15T07:00:00Z", // Mon 15 Mar 02:00 CDT
  },
  // ── Round 3 ──────────────────────────────────────────────────────────────
  {
    round: 3,
    race_name: "Japanese Grand Prix",
    circuit: "Suzuka International Racing Course",
    country: "Japan",
    fp1_start:           "2026-03-27T02:30:00Z", // Fri 27 Mar 21:30 CDT
    fp2_start:           "2026-03-27T06:00:00Z", // Sat 27 Mar 01:00 CDT
    fp3_start:           "2026-03-28T02:30:00Z", // Sat 28 Mar 21:30 CDT
    qualifying_deadline: "2026-03-28T06:00:00Z", // Sun 28 Mar 01:00 CDT — predictions lock
    race_start:          "2026-03-29T05:00:00Z", // Sun 29 Mar 00:00 CDT
  },
  // ── Round 4 ──────────────────────────────────────────────────────────────
  {
    round: 4,
    race_name: "Bahrain Grand Prix",
    circuit: "Bahrain International Circuit",
    country: "Bahrain",
    fp1_start:           "2026-04-10T11:30:00Z", // Fri 10 Apr 06:30 CDT
    fp2_start:           "2026-04-10T15:00:00Z", // Fri 10 Apr 10:00 CDT
    fp3_start:           "2026-04-11T12:30:00Z", // Sat 11 Apr 07:30 CDT
    qualifying_deadline: "2026-04-11T16:00:00Z", // Sat 11 Apr 11:00 CDT — predictions lock
    race_start:          "2026-04-12T15:00:00Z", // Sun 12 Apr 10:00 CDT
  },
  // ── Round 5 ──────────────────────────────────────────────────────────────
  {
    round: 5,
    race_name: "Saudi Arabian Grand Prix",
    circuit: "Jeddah Corniche Circuit",
    country: "Saudi Arabia",
    fp1_start:           "2026-04-17T13:30:00Z", // Fri 17 Apr 08:30 CDT
    fp2_start:           "2026-04-17T17:00:00Z", // Fri 17 Apr 12:00 CDT
    fp3_start:           "2026-04-18T13:30:00Z", // Sat 18 Apr 08:30 CDT
    qualifying_deadline: "2026-04-18T17:00:00Z", // Sat 18 Apr 12:00 CDT — predictions lock
    race_start:          "2026-04-19T17:00:00Z", // Sun 19 Apr 12:00 CDT
  },
  // ── Round 6 ──────────────────────────────────────────────────────────────
  {
    round: 6,
    race_name: "Miami Grand Prix",
    circuit: "Miami International Autodrome",
    country: "United States",
    is_sprint_weekend: true,
    fp1_start:                "2026-05-01T16:30:00Z", // Fri  1 May 11:30 CDT
    sprint_qualifying_start:  "2026-05-01T20:30:00Z", // Fri  1 May 15:30 CDT — predictions lock
    sprint_race_start:        "2026-05-02T16:00:00Z", // Sat  2 May 11:00 CDT
    qualifying_deadline:      "2026-05-01T20:30:00Z", // = sprint_qualifying_start (locks before any competitive session)
    race_start:               "2026-05-03T20:00:00Z", // Sun  3 May 15:00 CDT
  },
  // ── Round 7 ──────────────────────────────────────────────────────────────
  {
    round: 7,
    race_name: "Canadian Grand Prix",
    circuit: "Circuit Gilles Villeneuve",
    country: "Canada",
    is_sprint_weekend: true,
    fp1_start:                "2026-05-22T16:30:00Z", // Fri 22 May 11:30 CDT
    sprint_qualifying_start:  "2026-05-22T20:30:00Z", // Fri 22 May 15:30 CDT — predictions lock
    sprint_race_start:        "2026-05-23T16:00:00Z", // Sat 23 May 11:00 CDT
    qualifying_deadline:      "2026-05-22T20:30:00Z", // = sprint_qualifying_start (locks before any competitive session)
    race_start:               "2026-05-24T20:00:00Z", // Sun 24 May 15:00 CDT
  },
  // ── Round 8 ──────────────────────────────────────────────────────────────
  {
    round: 8,
    race_name: "Monaco Grand Prix",
    circuit: "Circuit de Monaco",
    country: "Monaco",
    fp1_start:           "2026-06-05T11:30:00Z", // Fri  5 Jun 06:30 CDT
    fp2_start:           "2026-06-05T15:00:00Z", // Fri  5 Jun 10:00 CDT
    fp3_start:           "2026-06-06T10:30:00Z", // Sat  6 Jun 05:30 CDT
    qualifying_deadline: "2026-06-06T14:00:00Z", // Sat  6 Jun 09:00 CDT — predictions lock
    race_start:          "2026-06-07T13:00:00Z", // Sun  7 Jun 08:00 CDT
  },
  // ── Round 9 ──────────────────────────────────────────────────────────────
  {
    round: 9,
    race_name: "Barcelona-Catalunya Grand Prix",
    circuit: "Circuit de Barcelona-Catalunya",
    country: "Spain",
    fp1_start:           "2026-06-12T11:30:00Z", // Fri 12 Jun 06:30 CDT
    fp2_start:           "2026-06-12T15:00:00Z", // Fri 12 Jun 10:00 CDT
    fp3_start:           "2026-06-13T10:30:00Z", // Sat 13 Jun 05:30 CDT
    qualifying_deadline: "2026-06-13T14:00:00Z", // Sat 13 Jun 09:00 CDT — predictions lock
    race_start:          "2026-06-14T13:00:00Z", // Sun 14 Jun 08:00 CDT
  },
  // ── Round 10 ─────────────────────────────────────────────────────────────
  {
    round: 10,
    race_name: "Austrian Grand Prix",
    circuit: "Red Bull Ring",
    country: "Austria",
    fp1_start:           "2026-06-26T11:30:00Z", // Fri 26 Jun 06:30 CDT
    fp2_start:           "2026-06-26T15:00:00Z", // Fri 26 Jun 10:00 CDT
    fp3_start:           "2026-06-27T10:30:00Z", // Sat 27 Jun 05:30 CDT
    qualifying_deadline: "2026-06-27T14:00:00Z", // Sat 27 Jun 09:00 CDT — predictions lock
    race_start:          "2026-06-28T13:00:00Z", // Sun 28 Jun 08:00 CDT
  },
  // ── Round 11 ─────────────────────────────────────────────────────────────
  {
    round: 11,
    race_name: "British Grand Prix",
    circuit: "Silverstone Circuit",
    country: "Great Britain",
    is_sprint_weekend: true,
    fp1_start:                "2026-07-03T11:30:00Z", // Fri  3 Jul 06:30 CDT
    sprint_qualifying_start:  "2026-07-03T15:30:00Z", // Fri  3 Jul 10:30 CDT — predictions lock
    sprint_race_start:        "2026-07-04T11:00:00Z", // Sat  4 Jul 06:00 CDT
    qualifying_deadline:      "2026-07-03T15:30:00Z", // = sprint_qualifying_start (locks before any competitive session)
    race_start:               "2026-07-05T14:00:00Z", // Sun  5 Jul 09:00 CDT
  },
  // ── Round 12 ─────────────────────────────────────────────────────────────
  {
    round: 12,
    race_name: "Belgian Grand Prix",
    circuit: "Circuit de Spa-Francorchamps",
    country: "Belgium",
    fp1_start:           "2026-07-17T11:30:00Z", // Fri 17 Jul 06:30 CDT
    fp2_start:           "2026-07-17T15:00:00Z", // Fri 17 Jul 10:00 CDT
    fp3_start:           "2026-07-18T10:30:00Z", // Sat 18 Jul 05:30 CDT
    qualifying_deadline: "2026-07-18T14:00:00Z", // Sat 18 Jul 09:00 CDT — predictions lock
    race_start:          "2026-07-19T13:00:00Z", // Sun 19 Jul 08:00 CDT
  },
  // ── Round 13 ─────────────────────────────────────────────────────────────
  {
    round: 13,
    race_name: "Hungarian Grand Prix",
    circuit: "Hungaroring",
    country: "Hungary",
    fp1_start:           "2026-07-24T11:30:00Z", // Fri 24 Jul 06:30 CDT
    fp2_start:           "2026-07-24T15:00:00Z", // Fri 24 Jul 10:00 CDT
    fp3_start:           "2026-07-25T10:30:00Z", // Sat 25 Jul 05:30 CDT
    qualifying_deadline: "2026-07-25T14:00:00Z", // Sat 25 Jul 09:00 CDT — predictions lock
    race_start:          "2026-07-26T13:00:00Z", // Sun 26 Jul 08:00 CDT
  },
  // ── Round 14 ─────────────────────────────────────────────────────────────
  {
    round: 14,
    race_name: "Dutch Grand Prix",
    circuit: "Circuit Zandvoort",
    country: "Netherlands",
    is_sprint_weekend: true,
    fp1_start:                "2026-08-21T10:30:00Z", // Fri 21 Aug 05:30 CDT
    sprint_qualifying_start:  "2026-08-21T14:30:00Z", // Fri 21 Aug 09:30 CDT — predictions lock
    sprint_race_start:        "2026-08-22T10:00:00Z", // Sat 22 Aug 05:00 CDT
    qualifying_deadline:      "2026-08-21T14:30:00Z", // = sprint_qualifying_start (locks before any competitive session)
    race_start:               "2026-08-23T13:00:00Z", // Sun 23 Aug 08:00 CDT
  },
  // ── Round 15 ─────────────────────────────────────────────────────────────
  {
    round: 15,
    race_name: "Italian Grand Prix",
    circuit: "Autodromo Nazionale Monza",
    country: "Italy",
    fp1_start:           "2026-09-04T10:30:00Z", // Fri  4 Sep 05:30 CDT
    fp2_start:           "2026-09-04T14:00:00Z", // Fri  4 Sep 09:00 CDT
    fp3_start:           "2026-09-05T10:30:00Z", // Sat  5 Sep 05:30 CDT
    qualifying_deadline: "2026-09-05T14:00:00Z", // Sat  5 Sep 09:00 CDT — predictions lock
    race_start:          "2026-09-06T13:00:00Z", // Sun  6 Sep 08:00 CDT
  },
  // ── Round 16 ─────────────────────────────────────────────────────────────
  {
    round: 16,
    race_name: "Spanish Grand Prix",
    circuit: "Madring",
    country: "Spain",
    fp1_start:           "2026-09-11T11:30:00Z", // Fri 11 Sep 06:30 CDT
    fp2_start:           "2026-09-11T15:00:00Z", // Fri 11 Sep 10:00 CDT
    fp3_start:           "2026-09-12T10:30:00Z", // Sat 12 Sep 05:30 CDT
    qualifying_deadline: "2026-09-12T14:00:00Z", // Sat 12 Sep 09:00 CDT — predictions lock
    race_start:          "2026-09-13T13:00:00Z", // Sun 13 Sep 08:00 CDT
  },
  // ── Round 17 ─────────────────────────────────────────────────────────────
  {
    round: 17,
    race_name: "Azerbaijan Grand Prix",
    circuit: "Baku City Circuit",
    country: "Azerbaijan",
    fp1_start:           "2026-09-24T08:30:00Z", // Thu 24 Sep 03:30 CDT
    fp2_start:           "2026-09-24T12:00:00Z", // Thu 24 Sep 07:00 CDT
    fp3_start:           "2026-09-25T08:30:00Z", // Fri 25 Sep 03:30 CDT
    qualifying_deadline: "2026-09-25T12:00:00Z", // Fri 25 Sep 07:00 CDT — predictions lock
    race_start:          "2026-09-26T11:00:00Z", // Sat 26 Sep 06:00 CDT
  },
  // ── Round 18 ─────────────────────────────────────────────────────────────
  {
    round: 18,
    race_name: "Singapore Grand Prix",
    circuit: "Marina Bay Street Circuit",
    country: "Singapore",
    is_sprint_weekend: true,
    fp1_start:                "2026-10-09T08:30:00Z", // Fri  9 Oct 03:30 CDT
    sprint_qualifying_start:  "2026-10-09T12:30:00Z", // Fri  9 Oct 07:30 CDT — predictions lock
    sprint_race_start:        "2026-10-10T09:00:00Z", // Sat 10 Oct 04:00 CDT
    qualifying_deadline:      "2026-10-09T12:30:00Z", // = sprint_qualifying_start (locks before any competitive session)
    race_start:               "2026-10-11T12:00:00Z", // Sun 11 Oct 07:00 CDT
  },
  // ── Round 19 ─────────────────────────────────────────────────────────────
  {
    round: 19,
    race_name: "United States Grand Prix",
    circuit: "Circuit of the Americas",
    country: "United States",
    fp1_start:           "2026-10-23T17:30:00Z", // Fri 23 Oct 12:30 CDT
    fp2_start:           "2026-10-23T21:00:00Z", // Fri 23 Oct 16:00 CDT
    fp3_start:           "2026-10-24T17:30:00Z", // Sat 24 Oct 12:30 CDT
    qualifying_deadline: "2026-10-24T21:00:00Z", // Sat 24 Oct 16:00 CDT — predictions lock
    race_start:          "2026-10-25T20:00:00Z", // Sun 25 Oct 15:00 CDT
  },
  // ── Round 20 ─────────────────────────────────────────────────────────────
  {
    round: 20,
    race_name: "Mexico City Grand Prix",
    circuit: "Autodromo Hermanos Rodriguez",
    country: "Mexico",
    fp1_start:           "2026-10-30T18:30:00Z", // Fri 30 Oct 13:30 CDT
    fp2_start:           "2026-10-30T22:00:00Z", // Fri 30 Oct 17:00 CDT
    fp3_start:           "2026-10-31T17:30:00Z", // Sat 31 Oct 12:30 CDT
    qualifying_deadline: "2026-10-31T21:00:00Z", // Sat 31 Oct 16:00 CDT — predictions lock
    race_start:          "2026-11-01T19:00:00Z", // Sun  1 Nov 14:00 CDT
  },
  // ── Round 21 ─────────────────────────────────────────────────────────────
  {
    round: 21,
    race_name: "São Paulo Grand Prix",
    circuit: "Autodromo Jose Carlos Pace",
    country: "Brazil",
    fp1_start:           "2026-11-06T15:30:00Z", // Fri  6 Nov 09:30 CST
    fp2_start:           "2026-11-06T19:00:00Z", // Fri  6 Nov 13:00 CST
    fp3_start:           "2026-11-07T14:30:00Z", // Sat  7 Nov 08:30 CST
    qualifying_deadline: "2026-11-07T18:00:00Z", // Sat  7 Nov 12:00 CST — predictions lock
    race_start:          "2026-11-08T17:00:00Z", // Sun  8 Nov 11:00 CST
  },
  // ── Round 22 ─────────────────────────────────────────────────────────────
  // Las Vegas FP/qualifying shown in PST (local night-race times, UTC-8)
  // PST+8h = CST+6h so these are already correct — no adjustment needed.
  {
    round: 22,
    race_name: "Las Vegas Grand Prix",
    circuit: "Las Vegas Strip Circuit",
    country: "United States",
    fp1_start:           "2026-11-20T02:30:00Z", // Thu 19 Nov 18:30 PST / 20:30 CST
    fp2_start:           "2026-11-20T06:00:00Z", // Thu 19 Nov 22:00 PST / Fri 00:00 CST
    fp3_start:           "2026-11-21T02:30:00Z", // Fri 20 Nov 18:30 PST / 20:30 CST
    qualifying_deadline: "2026-11-21T06:00:00Z", // Fri 20 Nov 22:00 PST / Sat 00:00 CST — predictions lock
    race_start:          "2026-11-22T03:00:00Z", // Sat 21 Nov 21:00 CST
  },
  // ── Round 23 ─────────────────────────────────────────────────────────────
  {
    round: 23,
    race_name: "Qatar Grand Prix",
    circuit: "Lusail International Circuit",
    country: "Qatar",
    fp1_start:           "2026-11-27T13:30:00Z", // Fri 27 Nov 07:30 CST
    fp2_start:           "2026-11-27T17:00:00Z", // Fri 27 Nov 11:00 CST
    fp3_start:           "2026-11-28T14:30:00Z", // Sat 28 Nov 08:30 CST
    qualifying_deadline: "2026-11-28T18:00:00Z", // Sat 28 Nov 12:00 CST — predictions lock
    race_start:          "2026-11-29T16:00:00Z", // Sun 29 Nov 10:00 CST
  },
  // ── Round 24 ─────────────────────────────────────────────────────────────
  {
    round: 24,
    race_name: "Abu Dhabi Grand Prix",
    circuit: "Yas Marina Circuit",
    country: "UAE",
    fp1_start:           "2026-12-04T09:30:00Z", // Fri  4 Dec 03:30 CST
    fp2_start:           "2026-12-04T13:00:00Z", // Fri  4 Dec 07:00 CST
    fp3_start:           "2026-12-05T10:30:00Z", // Sat  5 Dec 04:30 CST
    qualifying_deadline: "2026-12-05T14:00:00Z", // Sat  5 Dec 08:00 CST — predictions lock
    race_start:          "2026-12-06T13:00:00Z", // Sun  6 Dec 07:00 CST
  },
];

export const SEASON = 2026;
