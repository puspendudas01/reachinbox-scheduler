# ReachInbox Scheduler

An npm workspace with an Express API and a separate worker in `backend/`, plus a Vite, React, and Tailwind scaffold in `frontend/`.

## Local development

Install Node.js 22.13+ (22.x) or 24+ and Docker Compose. From the repository root, run these commands in PowerShell.

```powershell
Copy-Item .env.example .env
npm ci
npm run dev:all
```

The API and worker validate the root `.env` on startup. Shell environment variables take precedence. If you already have a `.env`, add the missing settings from `.env.example`, including `BULL_BOARD_USER` and `BULL_BOARD_PASS`. The worker provisions `ETHEREAL_SENDER_COUNT` test accounts when the sender table is empty.

Open the Vite frontend at `http://localhost:5173`. Check API liveness in a second terminal.

```powershell
curl.exe -i http://localhost:3000/health
```

The endpoint returns HTTP 200 with `{"status":"ok"}` while the API is listening. The API and worker require PostgreSQL and Redis. `npm run dev:all` starts the Docker services, applies the migration, and generates the Prisma client before launching the apps.

If another PostgreSQL instance already uses port 5432, set `POSTGRES_HOST_PORT` to a free port in `.env` and use the same port in `DATABASE_URL`.

## Scheduler API

Scheduler routes require a Google session and operate on the signed-in user's emails. Use a timezone-qualified ISO 8601 value for `startTime`, unique email addresses, a nonnegative integer `delayMs`, and a positive integer `hourlyLimit`. A successful schedule returns HTTP 202 with `campaignId` and `scheduledCount`.

| Method | Path                      | Result                                                                                          |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------------- |
| POST   | `/api/campaigns/schedule` | Schedule a campaign with `subject`, `body`, `emails`, `startTime`, `delayMs`, and `hourlyLimit` |
| GET    | `/api/emails/scheduled`   | List scheduled emails, including deferred emails                                                |
| GET    | `/api/emails/sent`        | List sent and failed emails with attempt counts and available Ethereal preview URLs             |
| GET    | `/api/emails/search`      | Search the signed-in user's emails by text and optional status                                  |
| POST   | `/api/emails/:id/cancel`  | Cancel a scheduled email                                                                        |

The worker takes the lower of the campaign hourly limit and `MAX_EMAILS_PER_HOUR_PER_SENDER`. Quota windows use UTC, and deferred jobs keep their IDs. The API and worker reconcile missing jobs at startup. The worker also reconciles while running. If the worker exits between SMTP acceptance and the database commit, a retry can send the message again.

## Google sign-in

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a random `SESSION_SECRET` of at least 32 characters. Register `BACKEND_URL/api/auth/google/callback` as the authorized redirect URI in your Google OAuth web client, using the actual backend origin.

Navigate to `GET /api/auth/google` to sign in. The callback sets an HttpOnly session cookie and redirects to `FRONTEND_URL/dashboard`. Use `GET /api/auth/me` for the current profile and `POST /api/auth/logout` to clear the cookie. Browser API calls from `FRONTEND_URL` need `credentials: 'include'`. Use HTTPS for a deployed backend.

## Slack notifications

Set `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`. Register `BACKEND_URL/api/slack/callback` in the Slack app and enable the `incoming-webhook` scope.

While signed in, navigate to `GET /api/slack/connect` and select a destination channel. The callback saves the connection and returns to the dashboard. `GET /api/slack/status` returns the workspace and channel ID for a connected user. `POST /api/slack/disconnect` removes the scheduler's saved connection.

When a sender hits its quota, the worker attempts one notification per connected user and sender per UTC hour. Slack delivery errors leave the email schedule intact.

## Elasticsearch and queue dashboard

`GET /api/emails/search?q=invoice&status=sent` searches recipients, subjects, and bodies and returns up to 50 results. Omit `status` to search across all statuses. The worker retries pending index updates, and search returns HTTP 503 while Elasticsearch is unavailable. Run `npm run search:reindex` after restoring or replacing the `emails` index, or to backfill existing messages.

Visit `BACKEND_URL/admin/queues` and enter `BULL_BOARD_USER` and `BULL_BOARD_PASS` to view Bull Board in read-only mode.

## Scripts

| Command                                                             | Purpose                                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                                                       | Start the API, worker, and frontend in watch mode                          |
| `npm run dev:backend`, `npm run dev:worker`, `npm run dev:frontend` | Start one development process                                              |
| `npm run infra:up`, `npm run infra:down`                            | Start or stop the Docker services and retain their named volumes           |
| `npm run db:deploy`, `npm run db:generate`                          | Apply Prisma migrations and generate the client                            |
| `npm run loadtest`                                                  | Schedule 1,000 test emails at the same time using `LOADTEST_SESSION_TOKEN` |
| `npm run search:reindex`                                            | Rebuild search documents from PostgreSQL                                   |
| `npm run build`                                                     | Build both workspaces                                                      |
| `npm start`                                                         | Start the compiled API and worker                                          |
| `npm run preview:frontend`                                          | Preview the built frontend                                                 |
| `npm run typecheck`, `npm run lint`, `npm run format:check`         | Check TypeScript, backend linting, and formatting                          |

For a local load test, set `LOADTEST_SESSION_TOKEN` in your shell to the `reachinbox_session` cookie value from your signed-in browser session. Treat it like a password.
