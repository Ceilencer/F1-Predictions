# F1 Family Predictions — Product Requirements Document (MVP)

## Overview

A private web app for a family to submit and track Formula 1 race weekend predictions. Each race weekend, family members log in and submit a set of predictions across fixed categories. After the race, results are pulled automatically from an F1 API and predictions are scored. A running leaderboard tracks cumulative points across the season.

---

## Tech Stack

- **Frontend**: Next.js (TypeScript)
- **Backend/DB**: Supabase (Postgres + Auth)
- **Hosting**: Vercel
- **F1 Data**: Jolpica F1 API (free, no key required — successor to Ergast)

---

## Authentication

- Each family member signs in with their Google account via OAuth
- Use Supabase Auth with Google OAuth provider (Google Cloud OAuth 2.0 client ID + secret)
- No public sign-up — the admin must whitelist approved Google accounts (by email) before they can access the app
- Non-whitelisted Google accounts that attempt to sign in are rejected with a friendly message
- Admin role: can whitelist/remove users, manually trigger result syncing, and view all submissions

---

## Prediction Categories

Each race weekend, every user submits one prediction per category:

| Category | Description |
|---|---|
| **Pole Position** | Which driver will qualify P1 |
| **Top 3 — P1** | Predicted race winner |
| **Top 3 — P2** | Predicted P2 finisher |
| **Top 3 — P3** | Predicted P3 finisher |
| **Biggest Good Surprise** | A driver who will overperform expectations |
| **Biggest Flop** | A driver who will underperform expectations |
| **One Crazy Prediction** | A freeform wildcard prediction (text field) |
| **P What?** | A random finishing position between P4 and P22 is generated each race weekend and shown to all users. Each user predicts which driver will finish in that position. |

All predictions must be submitted **before qualifying begins**. Submissions are locked after the deadline.

---

## Scoring

Simple right/wrong — 1 point per correct prediction.

| Category | How correctness is determined |
|---|---|
| Pole Position | Driver matches actual pole sitter |
| Top 3 — P1 | Driver matches actual P1 finisher |
| Top 3 — P2 | Driver matches actual P2 finisher |
| Top 3 — P3 | Driver matches actual P3 finisher |
| Biggest Good Surprise | Subjective — admin marks correct/incorrect |
| Biggest Flop | Subjective — admin marks correct/incorrect |
| One Crazy Prediction | Subjective — admin marks correct/incorrect |
| P What? | Two-tier scoring: (1) If any user correctly predicted the driver who finished in the generated position, they score the point — shared equally if multiple users picked the same correct driver. (2) If nobody predicted the correct driver, the point goes to whoever's predicted driver finished closest to the generated position (by absolute position difference). If multiple users are tied for closest, they share the point. |

Maximum points per race weekend: **8**

---

## F1 Data Integration

- Use the **Jolpica F1 API** (`https://api.jolpi.ca/ergast/f1/`) to fetch race results
- After each race, the app fetches:
  - Qualifying results (for pole position scoring)
  - Race results (for Top 3 and P What? scoring)
- Admin can trigger a manual sync from the admin panel
- Optionally: auto-sync can be triggered on a schedule (e.g. Sunday evening) via a Vercel cron job
- Subjective categories (Surprise, Flop, Crazy Prediction) are manually scored by the admin in the admin panel

---

## Pages & UI

### 1. Login Page
- Email + password login via Supabase Auth

### 2. Home / Dashboard
- Current race weekend name and round number
- Countdown to prediction deadline (qualifying start time)
- Status indicator: has the current user submitted their predictions yet?
- Quick link to submit or edit predictions (if deadline not passed)
- Season leaderboard summary (top 3 users + current user's rank)

### 3. Submit Predictions Page
- Form with all 8 prediction categories
- Driver selector (dropdown) for driver-based categories — populated from current season driver list via Jolpica API
- Position selector (number input) for P What? category
- Text input for One Crazy Prediction
- Submit button — locked after deadline
- Users can edit their predictions up until the deadline

### 4. Leaderboard Page
- Full season standings table: rank, name, total points, points per race
- Expandable per-race breakdown per user

### 5. Race History Page
- List of completed race weekends
- Clicking a race shows:
  - Actual results
  - Each family member's predictions and how many points they scored

### 6. Admin Panel (admin only)
- Create / deactivate user accounts
- Set race weekend details (race name, round, qualifying deadline)
- Trigger F1 result sync
- Manually score subjective categories (Surprise, Flop, Crazy Prediction) per user per race

---

## Data Model (Supabase)

### `users`
Managed by Supabase Auth. Extended with a `profiles` table:
- `id` (uuid, FK to auth.users)
- `display_name` (text)
- `is_admin` (boolean)

### `race_weekends`
- `id` (uuid)
- `season` (int)
- `round` (int)
- `race_name` (text)
- `qualifying_deadline` (timestamptz) — predictions lock at this time
- `p_what_position` (int) — randomly generated position between 4 and 22, set when the race weekend is created
- `results_synced` (boolean)

### `predictions`
- `id` (uuid)
- `user_id` (uuid, FK profiles)
- `race_weekend_id` (uuid)
- `pole_position` (text — driver code)
- `top3_p1` (text)
- `top3_p2` (text)
- `top3_p3` (text)
- `biggest_surprise` (text — driver code)
- `biggest_flop` (text — driver code)
- `crazy_prediction` (text — freeform)
- `p_what_driver` (text — driver code) — user's guess for who finishes in the race weekend's generated position
- `submitted_at` (timestamptz)

### `scores`
- `id` (uuid)
- `user_id` (uuid)
- `race_weekend_id` (uuid)
- `pole_correct` (boolean)
- `top3_p1_correct` (boolean)
- `top3_p2_correct` (boolean)
- `top3_p3_correct` (boolean)
- `surprise_correct` (boolean, nullable — set by admin)
- `flop_correct` (boolean, nullable — set by admin)
- `crazy_correct` (boolean, nullable — set by admin)
- `p_what_correct` (boolean)
- `total_points` (int, computed)

---

## Team & Driver Assets

The app should display team logos and driver nationality flags in an F1 timing tower style alongside driver and team names throughout the UI (leaderboard, prediction forms, race results, etc.).

- **Team logos**: Sourced as static SVG files and bundled in the Next.js `public/teams/` folder — one per constructor (10 total for the 2026 season)
- **Driver headshots or initials**: Use driver three-letter codes (e.g. VER, HAM, LEC) as a fallback; optionally include small driver portrait thumbnails if available
- **Current 2026 grid**: 22 drivers across 11 teams — assets must cover all 22 drivers at project setup
- **Mapping**: Maintain a single static config file (e.g. `src/config/drivers.ts`) that maps each driver to their team, full name, three-letter code, and asset paths. This is the sole source of truth for populating dropdowns and displaying assets everywhere in the app. **This file must be simple enough that a non-developer can open it and update a driver name, team, or code with minimal effort** — add a comment at the top of the file explaining how to make changes
- **Mid-season updates**: Driver changes (e.g. replacements, transfers) should only require editing `drivers.ts` and swapping the relevant asset file — no database migrations or code changes elsewhere should be needed
- **Updates**: Assets and the config file should be updated once per season (or mid-season if there are driver changes). This is a manual process and out of scope for any automation in the MVP
- **Sizing**: Logos should render cleanly at small sizes (24–32px height) to match a timing tower aesthetic — SVG format ensures sharpness at all sizes and screen densities

---

## Visual Design

- **Color scheme**: Dark mode only — no light mode toggle needed for MVP
- **Background**: Deep dark (e.g. `#0f0f0f` or `#111118`)
- **Surface/card color**: Slightly lighter dark (e.g. `#1a1a24`)
- **Accent color**: Purple (e.g. `#7c3aed` or similar — vivid but not neon)
- **Text**: White/off-white primary, muted grey for secondary text
- **Buttons**: Purple background with white text for primary actions; ghost/outline style for secondary actions
- **Highlights & active states**: Purple glow or border
- **Typography**: Clean, modern sans-serif (e.g. Inter or Geist — both available in Next.js by default)
- The overall aesthetic should feel sleek and sporty, fitting for an F1-themed app

---

## Responsive Design Requirements

The app must look and function well on both desktop and mobile browsers. This is a web app, not a native app.

- Use a mobile-first CSS approach (design for small screens first, enhance for larger screens)
- All pages must be fully usable on screens as small as 375px wide (iPhone SE)
- No horizontal scrolling on any page at any screen size
- Touch targets (buttons, dropdowns, links) must be large enough to tap comfortably — minimum 44x44px
- The prediction submission form in particular must be easy to complete on a phone, with large dropdowns and clear labels
- The leaderboard table should reflow or scroll gracefully on small screens — avoid cramped columns
- Navigation should collapse into a hamburger menu or bottom nav bar on mobile
- Font sizes must remain legible on mobile without requiring zoom
- Test breakpoints: 375px (mobile), 768px (tablet), 1280px (desktop)

---

## Out of Scope for MVP

- Sprint race predictions
- Push notifications / email reminders
- Social features (comments, reactions)
- Mobile app
- Public leaderboard / sharing
