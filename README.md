# Viralize

AI content orchestrator for TikTok/Reels/Shorts. Three agents run in sequence to help with topic research, script writing, and scheduling:

- Agent Hook (Trend Agent): researches trends and keywords, produces 10 candidate topics and 3 hook variations.
- Agent Director (Script Writer): builds the script outline, full script, visual notes, and caption from the chosen topic.
- Agent Scheduler: schedules publication, optionally creating a real Google Calendar event (Agency accounts only).

## Layout

```
content-agent-uts/
  app.py              backend FastAPI app, exposes the three agents above as a REST API
  main.py              agent definitions, model config, and guardrails used by app.py
  requirements.txt
  .env.example          copy to .env and fill in real values
  Viralist/              frontend, React + Vite + TypeScript
    src/
    supabase/schema.sql
    .env.local.example    copy to .env.local and fill in real values
```

Frontend handles login and data (briefs, schedule, user profile) through Supabase (Auth + Postgres). Backend is FastAPI, wrapping agents built with Agno (https://github.com/agno-agi/agno). It only verifies the Supabase token sent with each request as an access gate, it does not own the login flow itself.

Two MCP servers are used by the backend:

- Firecrawl MCP (mcp.firecrawl.dev, streamable-http) for the Agent Hook's research.
- Google Calendar MCP (@cocal/google-calendar-mcp, run locally through npx), restricted to only the create-event and delete-event tools for Agent Scheduler.

One thing worth knowing: Google Calendar authorization is a single shared account for all users (held by the gcp-oauth-keys.json credential on the server), not a per-user connection. Every event created through the app lands in the same calendar regardless of who is logged in.

Frontend and backend are deployed separately. The frontend can go on something like Netlify. The backend needs its own host that can run a long-lived Python process (a VPS, Render, Railway, etc.) since Netlify only serves static frontends.

## Setup

Backend:

```
cd content-agent-uts
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `.env` with real values. Also place `gcp-oauth-keys.json` (a "Desktop app" OAuth client from Google Cloud Console) in the `content-agent-uts` root. It is gitignored and won't be committed.

Run it with:

```
uvicorn app:app --reload --port 8001
```

Frontend:

```
cd content-agent-uts/Viralist
npm install
cp .env.local.example .env.local
npm run dev
```

Database: create a Supabase project and run all of `Viralist/supabase/schema.sql` in its SQL editor. Google Sign-In also needs to be configured under Authentication > Providers > Google, using a "Web application" OAuth client.

## Deploy

The frontend is ready for Netlify (`Viralist/netlify.toml` is already set up, build command `npm run build`, publish directory `dist`). The backend needs to be hosted separately since it runs a long-lived Python process and spawns an `npx` subprocess.
