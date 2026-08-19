-- ============================================================
-- MIGRATION: Biggest Surprise / Flop — team picks worth 2 points
-- ============================================================
-- A correct Surprise/Flop pick now scores:
--   • 2 points if a TEAM was picked, or
--   • 1 point if a DRIVER was picked.
-- Every other category is unchanged (1 point each).
--
-- Requires the grid tables (teams) from grid-migration.sql to already exist.
-- Safe to run more than once.
-- ============================================================

-- Make sure the sprint-scoring columns exist (no-op if they already do).
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS sprint_pole_correct   BOOLEAN;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS sprint_winner_correct BOOLEAN;

-- Replace the scoring function. The trigger (trg_compute_total_points) already
-- points at this function, so replacing it is enough.
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

-- Recompute every existing score under the new rule so past team picks and the
-- leaderboard update too. (Touching a row fires the BEFORE-UPDATE trigger.)
-- Remove this line if you want the new rule to apply to future scoring only.
UPDATE public.scores SET total_points = total_points;
