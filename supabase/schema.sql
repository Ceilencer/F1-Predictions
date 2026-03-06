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
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  season               INTEGER     NOT NULL,
  round                INTEGER     NOT NULL,
  race_name            TEXT        NOT NULL,
  qualifying_deadline  TIMESTAMPTZ NOT NULL,  -- predictions lock at this time
  p_what_position      INTEGER     NOT NULL CHECK (p_what_position BETWEEN 4 AND 22),
  results_synced       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season, round)
);

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
  total_points     INTEGER  NOT NULL DEFAULT 0,
  UNIQUE (user_id, race_weekend_id)
);

-- ────────────────────────────────────────────────────────────
-- TRIGGER: auto-compute total_points on scores INSERT/UPDATE
-- Counts each TRUE boolean, treating NULL as FALSE.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_total_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_points :=
    (NEW.pole_correct::int) +
    (NEW.top3_p1_correct::int) +
    (NEW.top3_p2_correct::int) +
    (NEW.top3_p3_correct::int) +
    (COALESCE(NEW.surprise_correct, FALSE)::int) +
    (COALESCE(NEW.flop_correct, FALSE)::int) +
    (COALESCE(NEW.crazy_correct, FALSE)::int) +
    (NEW.p_what_correct::int);
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

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelisted_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_weekends     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores            ENABLE ROW LEVEL SECURITY;

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

-- ════════════════════════════════════════════════════════════
-- SEED: add your first admin email so you can log in
-- Replace the email below with the Google account that will be admin.
-- ════════════════════════════════════════════════════════════
-- INSERT INTO public.whitelisted_emails (email) VALUES ('your-admin@gmail.com');
