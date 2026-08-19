-- ============================================================
-- MIGRATION: DB-backed driver grid
-- ============================================================
-- Run this in the Supabase SQL Editor to add the grid tables to an EXISTING
-- database. It is fully idempotent (safe to run more than once) and only adds
-- new objects — it does NOT touch profiles / race_weekends / predictions / etc.
--
-- (This is the same content as the grid section of schema.sql, extracted so you
--  don't have to re-run the whole schema — the original policies in schema.sql
--  use plain CREATE POLICY and error if they already exist.)
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.teams (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        NOT NULL UNIQUE,      -- = old shortName, stored in predictions
  name       TEXT        NOT NULL,
  logo_path  TEXT        NOT NULL DEFAULT '',
  colour     TEXT        NOT NULL DEFAULT '#6b7280',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.season_seats (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  season     INTEGER     NOT NULL,
  team_id    UUID        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
  seat_no    INTEGER     NOT NULL CHECK (seat_no IN (1, 2)),
  driver_id  UUID        REFERENCES public.drivers(id) ON DELETE SET NULL,  -- NULL = empty seat
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season, team_id, seat_no)
);

CREATE TABLE IF NOT EXISTS public.race_weekend_drivers (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  race_weekend_id  UUID    NOT NULL REFERENCES public.race_weekends(id) ON DELETE CASCADE,
  team_id          UUID    NOT NULL REFERENCES public.teams(id)         ON DELETE CASCADE,
  seat_no          INTEGER NOT NULL CHECK (seat_no IN (1, 2)),
  driver_id        UUID    REFERENCES public.drivers(id) ON DELETE SET NULL,  -- NULL = empty seat
  UNIQUE (race_weekend_id, team_id, seat_no)
);

-- ── Row Level Security ──────────────────────────────────────
-- Readable by any authenticated user; all writes are admin-only.

ALTER TABLE public.teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_seats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_weekend_drivers ENABLE ROW LEVEL SECURITY;

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
