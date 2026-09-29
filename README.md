# HealthTrack — Frontend

BeTechified Capstone (Group 2) — a healthcare routine management web app. This repo is the **frontend only**, built with **React + Vite**. It is written against an API abstraction layer so it can run entirely on mock data today and switch to the real backend by changing one environment variable — no component code changes required.

## Tech stack

- React 18 + Vite
- React Router (client-side routing, `/`, `/login`, `/register`, `/app/*`)
- lucide-react (icons)
- Plain CSS with design tokens (no CSS framework) — theme is driven by CSS variables and a `data-theme="light" | "dark"` attribute on `<html>`

## Getting started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173` by default.

## Environment variables

Create a `.env.local` file in the project root:

```bash
# Base URL the app talks to. Point this at the backend dev's API once it exists.
VITE_API_BASE_URL=http://localhost:8000/api

# "true" = use in-memory mock data (no backend needed).
# "false" = call VITE_API_BASE_URL for everything.
VITE_USE_MOCK=true
```

While `VITE_USE_MOCK=true`, every service function (`authApi`, `routinesApi`, `medicationsApi`, `appointmentsApi`, `checkupsApi`, `vitalsApi`, `logsApi`) returns realistic mock data from local state instead of hitting the network, so the whole app is usable before the backend exists. Flip the flag to `false` once real endpoints are ready.

## Folder structure

```
src/
  api/              # everything that talks to the outside world
    client.js       # fetch wrapper: base URL, auth header, error handling
    services/        # one file per resource (auth, routines, dashboard, ...)
    mock/            # mock data used when VITE_USE_MOCK=true
  components/
    layout/          # Sidebar, Topbar, app shell
    ui/               # Button, Card, StatusWidget, RoutineCategoryCard, etc.
  context/           # ThemeContext (light/dark), AuthContext (current user)
  pages/             # one folder per route (auth, dashboard, routines, ...)
  styles/            # theme.css (design tokens), global.css (resets)
  App.jsx
  main.jsx
```

## Features (MVP scope)

Matches the PRD's must-have list:

- Register / log in
- Dashboard — today's health status + today's scheduled routines
- Create / edit / deactivate / delete a routine (name, type, frequency, time, start date)
- Reminders for scheduled routines
- Mark a routine completed or missed
- Routine history
- Basic adherence / progress measure (`completed ÷ total scheduled × 100`)
- Profile / settings, light & dark mode

Out of scope for this MVP (per PRD): AI recommendations, doctor consultation, diagnosis, wearable integration, EHR integration.

## API contract the backend needs to implement

The frontend expects these shapes. Any backend that returns them is a drop-in replacement for the mock layer:

| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password` — login/register return `{ user, token }` |
| Routines | `GET/POST /routines`, `PATCH/DELETE /routines/:id` |
| Routine logs | `GET /routine-logs`, `GET /routines/:id/logs`, `POST /routines/:id/logs` (`{ status: "completed" \| "missed", date }`) |
| Medications | `GET/POST /medications`, `PATCH/DELETE /medications/:id` |
| Appointments | `GET/POST /appointments`, `PATCH/DELETE /appointments/:id` |
| Checkups | `GET/POST /checkups`, `PATCH/DELETE /checkups/:id` |
| Vitals | `GET/POST /vitals`, `DELETE /vitals/:id` |
| Dashboard | `GET /dashboard/health-status`, `GET /dashboard/adherence` |

Auth uses a bearer token: the frontend stores whatever `token` the login/register response returns and sends it as `Authorization: Bearer <token>` on every subsequent request.

## Scripts

```bash
npm run dev       # start local dev server
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

## Design

UI follows the product-design mockups exactly (purple/violet accent, light & dark themes, sidebar navigation). Design tokens live in `src/styles/theme.css` (or `App.css`, depending on which version you're using) — update the hex values there if the design team provides an exact palette/Figma spec.