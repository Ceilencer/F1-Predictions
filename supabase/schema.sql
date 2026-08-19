-- ============================================================
-- F1 Predictions — Supabase Database Schema
-- ============================================================
-- Run this entire file in the Supabase SQL Editor to set up the database.
-- Order matters: tables are created before their dependants.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES
-- Extends auth.users with app-specific fields.
-- Created automatically via a trigger when a user signs in.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT        NOT NULL DEFAULT '',
  is_admin      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. WHITELISTED EMAILS
-- Only Google accounts in this table can access the app.
-- Admin adds emails here before family members log in.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whitelisted_emails (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL UNIQUE,
  added_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 3. RACE WEEKENDS
-- One row per race weekend in the season.
-- Admin creates these via the admin panel.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.race_weekends (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  season                   INTEGER     NOT NULL,
  round                    INTEGER     NOT NULL,
  race_name                TEXT        NOT NULL,
  qualifying_deadline      TIMESTAMPTZ NOT NULL,  -- predictions lock at this time (= qualifying session start)
  race_start               TIMESTAMPTZ,           -- actual race start; used to determine active race
  p_what_position          INTEGER     NOT NULL CHECK (p_what_position BETWEEN 4 AND 22),
  results_synced           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Session schedule (all nullable — populated manually or via future automation)
  is_sprint_weekend        BOOLEAN     NOT NULL DEFAULT FALSE,
  fp1_start                TIMESTAMPTZ,           -- all weekends
  fp2_start                TIMESTAMPTZ,           -- standard weekends only
  fp3_start                TIMESTAMPTZ,           -- standard weekends only
  sprint_qualifying_start  TIMESTAMPTZ,           -- sprint weekends only
  sprint_race_start        TIMESTAMPTZ,           -- sprint weekends only
  UNIQUE (season, round)
);

-- ────────────────────────────────────────────────────────────
-- MIGRATION: run these if the table already exists.
-- Add race_start (older migration) and all session columns.
-- ────────────────────────────────────────────────────────────
-- ALTER TABLE public.race_weekends ADD COLUMN IF NOT EXISTS race_start TIMESTAMPTZ;
-- ALTER TABLE public.race_weekends ADD COLUMN IF NOT EXISTS is_sprint_weekend BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE public.race_weekends ADD COLUMN IF NOT EXISTS fp1_start TIMESTAMPTZ;
-- ALTER TABLE public.race_weekends ADD COLUMN IF NOT EXISTS fp2_start TIMESTAMPTZ;
-- ALTER TABLE public.race_weekends ADD COLUMN IF NOT EXISTS fp3_start TIMESTAMPTZ;
-- ALTER TABLE public.race_weekends ADD COLUMN IF NOT EXISTS sprint_qualifying_start TIMESTAMPTZ;
-- ALTER TABLE public.race_weekends ADD COLUMN IF NOT EXISTS sprint_race_start TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────
-- 4. PREDICTIONS
-- One row per user per race weekend.
-- All driver fields store the 3-letter driver code (e.g. 'VER').
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.predictions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  race_weekend_id  UUID        NOT NULL REFERENCES public.race_weekends(id) ON DELETE CASCADE,
  pole_position    TEXT        NOT NULL,  -- driver code
  top3_p1          TEXT        NOT NULL,  -- driver code
  top3_p2          TEXT        NOT NULL,  -- driver code
  top3_p3          TEXT        NOT NULL,  -- driver code
  biggest_surprise TEXT        NOT NULL,  -- driver code
  biggest_flop     TEXT        NOT NULL,  -- driver code
  crazy_prediction TEXT        NOT NULL,  -- freeform text
  p_what_driver    TEXT        NOT NULL,  -- driver code
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, race_weekend_id)
);

-- ────────────────────────────────────────────────────────────
-- 5. SCORES
-- One row per user per race weekend, populated after the race.
-- Nullable booleans = subjective categories not yet judged by admin.
-- total_points is maintained by a trigger (see below).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scores (
  id               UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID     NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  race_weekend_id  UUID     NOT NULL REFERENCES public.race_weekends(id) ON DELETE CASCADE,
  pole_correct     BOOLEAN  NOT NULL DEFAULT FALSE,
  top3_p1_correct  BOOLEAN  NOT NULL DEFAULT FALSE,
  top3_p2_correct  BOOLEAN  NOT NULL DEFAULT FALSE,
  top3_p3_correct  BOOLEAN  NOT NULL DEFAULT FALSE,
  surprise_correct BOOLEAN,          -- NULL until admin judges
  flop_correct     BOOLEAN,          -- NULL until admin judges
  crazy_correct    BOOLEAN,          -- NULL until admin judges
  p_what_correct   BOOLEAN  NOT NULL DEFAULT FALSE,
  sprint_pole_correct   BOOLEAN,     -- sprint weekends only; NULL otherwise
  sprint_winner_correct BOOLEAN,     -- sprint weekends only; NULL otherwise
  total_points     INTEGER  NOT NULL DEFAULT 0,
  UNIQUE (user_id, race_weekend_id)
);

-- ────────────────────────────────────────────────────────────
-- TRIGGER: auto-compute total_points on scores INSERT/UPDATE
-- Each correct category is worth 1 point, EXCEPT Biggest Surprise / Biggest
-- Flop: a correct pick is worth 2 points if a TEAM was chosen, or 1 point if a
-- driver was chosen. (Whether the pick was a team is determined by looking up
-- the player's prediction and checking it against teams.key.)
-- NULL booleans are treated as FALSE.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_total_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_surprise   TEXT;
  v_flop       TEXT;
  surprise_pts INT := 0;
  flop_pts     INT := 0;
BEGIN
  -- The player's Surprise / Flop picks, so we can tell team (2) from driver (1).
  SELECT biggest_surprise, biggest_flop
    INTO v_surprise, v_flop
    FROM public.predictions
   WHERE user_id = NEW.user_id
     AND race_weekend_id = NEW.race_weekend_id;

  IF COALESCE(NEW.surprise_correct, FALSE) THEN
    surprise_pts := CASE
      WHEN v_surprise IS NOT NULL AND EXISTS (SELECT 1 FROM public.teams WHERE key = v_surprise)
      THEN 2 ELSE 1 END;
  END IF;

  IF COALESCE(NEW.flop_correct, FALSE) THEN
    flop_pts := CASE
      WHEN v_flop IS NOT NULL AND EXISTS (SELECT 1 FROM public.teams WHERE key = v_flop)
      THEN 2 ELSE 1 END;
  END IF;

  NEW.total_points :=
    (NEW.pole_correct::int) +
    (NEW.top3_p1_correct::int) +
    (NEW.top3_p2_correct::int) +
    (NEW.top3_p3_correct::int) +
    surprise_pts +
    flop_pts +
    (COALESCE(NEW.crazy_correct, FALSE)::int) +
    (NEW.p_what_correct::int) +
    (COALESCE(NEW.sprint_pole_correct, FALSE)::int) +
    (COALESCE(NEW.sprint_winner_correct, FALSE)::int);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_total_points ON public.scores;
CREATE TRIGGER trg_compute_total_points
  BEFORE INSERT OR UPDATE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION public.compute_total_points();

-- ────────────────────────────────────────────────────────────
-- TRIGGER: auto-create a profile row when a user signs up
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email, 'Unknown')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 6. RACE RESULTS
-- Stores raw API results fetched from Jolpica for each race.
-- One row per race weekend; created/updated when admin syncs.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.race_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  race_weekend_id   UUID        NOT NULL UNIQUE REFERENCES public.race_weekends(id) ON DELETE CASCADE,
  qualifying        JSONB,      -- [{pos:1, code:"VER", name:"Max Verstappen"}, ...]
  race              JSONB,      -- same format
  sprint_qualifying JSONB,      -- null if not a sprint weekend
  sprint_race       JSONB,      -- null if not a sprint weekend
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 7. TEAMS  (constructors — the grid's teams)
-- The `key` column is the STABLE identity used everywhere, and must
-- equal the short names previously stored in predictions.biggest_surprise /
-- biggest_flop (e.g. 'Red Bull', 'Ferrari'). Never change a key once picks exist.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        NOT NULL UNIQUE,      -- = old shortName, stored in predictions
  name       TEXT        NOT NULL,
  logo_path  TEXT        NOT NULL DEFAULT '',
  colour     TEXT        NOT NULL DEFAULT '#6b7280',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 8. DRIVERS  (the full roster — every potential driver)
-- Add-only: never hard-delete a driver, or history that references their
-- code will lose its name/photo. Use is_active = FALSE to retire a driver.
-- `code` is the 3-letter FIA code stored in predictions (e.g. 'VER').
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drivers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,     -- stored in predictions
  name        TEXT        NOT NULL,
  nationality TEXT        NOT NULL DEFAULT '',
  number      INTEGER,
  photo_path  TEXT        NOT NULL DEFAULT '',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 9. SEASON SEATS  (THE DEFAULT / NORMAL LINEUP)
-- Two seats per team per season. Editing a row here is a PERMANENT
-- lineup change that applies to every future weekend's snapshot.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.season_seats (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  season     INTEGER     NOT NULL,
  team_id    UUID        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
  seat_no    INTEGER     NOT NULL CHECK (seat_no IN (1, 2)),
  driver_id  UUID        REFERENCES public.drivers(id) ON DELETE SET NULL,  -- NULL = empty seat
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season, team_id, seat_no)
);

-- ────────────────────────────────────────────────────────────
-- 10. RACE WEEKEND DRIVERS  (THE PER-WEEKEND GRID — snapshot / one-off)
-- Populated by snapshotting season_seats when a weekend is created.
-- Editing a row here is a ONE-OFF override for that weekend only and
-- freezes what the history pages show for that race, forever.
-- If a weekend has no rows here, the grid falls back to season_seats.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.race_weekend_drivers (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  race_weekend_id  UUID    NOT NULL REFERENCES public.race_weekends(id) ON DELETE CASCADE,
  team_id          UUID    NOT NULL REFERENCES public.teams(id)         ON DELETE CASCADE,
  seat_no          INTEGER NOT NULL CHECK (seat_no IN (1, 2)),
  driver_id        UUID    REFERENCES public.drivers(id) ON DELETE SET NULL,  -- NULL = empty seat
  UNIQUE (race_weekend_id, team_id, seat_no)
);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelisted_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_weekends     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_seats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_weekend_drivers ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────
-- Anyone authenticated can read all profiles (for leaderboard display).
CREATE POLICY "Profiles are readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated USING (TRUE);

-- Users can update their own profile.
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── whitelisted_emails ────────────────────────────────────
-- Authenticated users can check whether their own email is whitelisted
-- (used by middleware). Only admins can manage the list.
CREATE POLICY "Authenticated users can read whitelisted_emails"
  ON public.whitelisted_emails FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "Only admins can insert whitelisted_emails"
  ON public.whitelisted_emails FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Only admins can delete whitelisted_emails"
  ON public.whitelisted_emails FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ── race_weekends ─────────────────────────────────────────
-- All authenticated users can read race weekends.
CREATE POLICY "Race weekends are readable by authenticated users"
  ON public.race_weekends FOR SELECT
  TO authenticated USING (TRUE);

-- Only admins can create / update race weekends.
CREATE POLICY "Only admins can insert race_weekends"
  ON public.race_weekends FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Only admins can update race_weekends"
  ON public.race_weekends FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ── predictions ───────────────────────────────────────────
-- Users can read all predictions (for history page).
CREATE POLICY "Predictions are readable by authenticated users"
  ON public.predictions FOR SELECT
  TO authenticated USING (TRUE);

-- Users can only insert / update their own predictions.
CREATE POLICY "Users can insert own predictions"
  ON public.predictions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own predictions"
  ON public.predictions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── race_results ──────────────────────────────────────────
-- All authenticated users can read race results.
CREATE POLICY "Race results readable by authenticated users"
  ON public.race_results FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "Only admins can insert race_results"
  ON public.race_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Only admins can update race_results"
  ON public.race_results FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ── scores ────────────────────────────────────────────────
-- All authenticated users can read scores (for leaderboard).
CREATE POLICY "Scores are readable by authenticated users"
  ON public.scores FOR SELECT
  TO authenticated USING (TRUE);

-- Only admins or server-side functions (via service role) can write scores.
CREATE POLICY "Only admins can insert scores"
  ON public.scores FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Only admins can update scores"
  ON public.scores FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ── grid tables: teams / drivers / season_seats / race_weekend_drivers ──
-- All readable by any authenticated user; all writes are admin-only.
-- A helper predicate for "current user is admin".
DO $$
DECLARE
  t   TEXT;
  adm TEXT := 'EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)';
BEGIN
  FOREACH t IN ARRAY ARRAY['teams', 'drivers', 'season_seats', 'race_weekend_drivers'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_insert" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_update" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_delete" ON public.%1$s;', t);

    EXECUTE format(
      'CREATE POLICY "%1$s_select" ON public.%1$s FOR SELECT TO authenticated USING (TRUE);', t);
    EXECUTE format(
      'CREATE POLICY "%1$s_insert" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (%2$s);', t, adm);
    EXECUTE format(
      'CREATE POLICY "%1$s_update" ON public.%1$s FOR UPDATE TO authenticated USING (%2$s) WITH CHECK (%2$s);', t, adm);
    EXECUTE format(
      'CREATE POLICY "%1$s_delete" ON public.%1$s FOR DELETE TO authenticated USING (%2$s);', t, adm);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════
-- SEED: add your first admin email so you can log in
-- Replace the email below with the Google account that will be admin.
-- ════════════════════════════════════════════════════════════
-- INSERT INTO public.whitelisted_emails (email) VALUES ('your-admin@gmail.com');
