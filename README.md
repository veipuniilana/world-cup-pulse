# World Cup Pulse (Fully Free Stack)

A World Cup site with:
- upcoming matches + past results
- shared predictions by fan votes
- real shared per-match chat
- guest identity with name + country
- Portugal-specific highlighting and supporter badges

## Stack
- Frontend: static HTML/CSS/JS (deploy on Cloudflare Pages)
- Backend services: Supabase (Postgres + Realtime + Edge Functions)
- Match sync: football-data API via Supabase Edge Function

## Local Run
1. Open this folder in VS Code.
2. Copy `js/config.example.js` values into `js/config.js`.
3. Serve locally with any static server (for example VS Code Live Server).
4. Open `index.html` from served URL (not `file://`).

## Supabase Setup
1. Create a Supabase project.
2. Run SQL in order:
   - `supabase/schema.sql`
   - `supabase/seed.sql`
3. In Supabase project settings, copy URL and anon key into `js/config.js`.
4. Enable Realtime for `chat_messages` table.

## Edge Function (Optional but Recommended)
Path: `supabase/functions/sync-matches/index.ts`

Required secrets:
- `FOOTBALL_DATA_API_KEY`
- `FOOTBALL_DATA_BASE_URL` (optional)
- `FOOTBALL_DATA_COMP` (optional, default `WC`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then deploy function and trigger manually or on schedule.

## Free Deployment
1. Push this folder to GitHub.
2. Create a Cloudflare Pages project from the repo.
3. Build command: none
4. Output directory: `/`
5. Update `js/config.js` with production Supabase URL + anon key.

## Notes
- `js/config.js` currently contains placeholders and must be updated.
- Current version is guest-only (no passwords), as requested.
- Prediction lock is enforced at DB insert level (cannot vote after kickoff).
- One vote per user per match is enforced by a unique DB index on `(match_id, guest_id)`.
