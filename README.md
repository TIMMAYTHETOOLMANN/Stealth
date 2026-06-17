# STEALTH // Autonomous Job Application Agent

A full-stack, cyberpunk-themed job-application agent. It maintains your **master
profile**, ingests **real** job postings (driven through the configured
`mcp-stealth-chrome` browser, or pasted manually), and for **every** target
generates a **tailored resume and cover letter** that are intelligently
re-weighted to match that exact position — maximising keyword/ATS alignment.

> No placeholder or simulated data. Every document is produced from your real
> profile against a real job description. If the stealth browser bridge is
> offline, the app tells you and lets you paste the description instead — it
> never fabricates job content.

---

## What it does

- **Central GUI** — a single cyberpunk console (Next.js App Router) that is the
  control surface for the whole pipeline.
- **Operator account** — create and sign in to your own local account
  (scrypt-hashed credentials, HMAC-signed httpOnly session cookies).
- **Master profile** — your real identity, summary, skills, experience bullets
  and education. This is the single source of truth.
- **Target ingestion**
  - **Stealth Fetch** — drives the `mcp-stealth-chrome` browser via the MCP
    Streamable-HTTP bridge to load a job URL and extract its real text.
  - **Paste** — paste a description directly (always available fallback).
- **Per-application tailoring engine** — for each job it computes:
  - a **match score** (profile ↔ job keyword coverage),
  - **matched** keywords and **missing** keywords (ATS gap analysis),
  - a **resume** with skills and experience bullets reordered to lead with the
    content most relevant to that role,
  - a **cover letter** assembled from your real, most-relevant achievements and
    addressed to the specific company and role.
- **Application tracking** — status pipeline (draft → ready → submitted →
  interview → offer / rejected), copy/download of every generated document.

The tailoring engine **only selects, reorders and emphasises content you have
actually provided**. It never invents skills, employers or accomplishments.

---

## Architecture

| Layer | Implementation |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, hand-built cyberpunk design system in `src/app/globals.css` |
| Backend | Next.js Route Handlers under `src/app/api/**` |
| Auth | `src/lib/auth.ts` — scrypt hashing, `timingSafeEqual`, signed session cookie |
| Storage | `src/lib/store.ts` — atomic, serialized JSON document store (zero native deps) under `./data` |
| Stealth browser bridge | `src/lib/mcp.ts` — MCP Streamable-HTTP JSON-RPC client (initialize → tools/list → tools/call) |
| Tailoring engine | `src/lib/tailor/*` — keyword extraction, JD parsing, match scoring, resume/cover-letter generation |

### API surface

| Method & path | Purpose |
| --- | --- |
| `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` | Account / session |
| `GET` / `PUT /api/profile` | Read / upsert master profile |
| `GET` / `POST /api/jobs` | List jobs / add from pasted text |
| `POST /api/jobs/fetch` | Fetch a job URL via the stealth browser |
| `GET` / `POST /api/applications` | List / generate tailored application |
| `GET` / `PATCH` / `DELETE /api/applications/:id` | Read / update status / delete |

---

## Getting started

### 1. Start the always-on stealth browser bridge (optional but recommended)

This powers **Stealth Fetch**. Keep it running in a separate terminal:

```bash
npx -y supergateway \
  --stdio "uvx mcp-stealth-chrome@latest" \
  --outputTransport streamableHttp \
  --stateful \
  --sessionTimeout 3600000 \
  --port 8000 \
  --streamableHttpPath /mcp \
  --healthEndpoint /healthz
```

- MCP endpoint: `http://127.0.0.1:8000/mcp`
- Health endpoint: `http://127.0.0.1:8000/healthz`
- `sessionTimeout` is in **milliseconds** (`3600000` = 1 hour).

Verify:

```bash
curl -fsS http://127.0.0.1:8000/healthz
```

> The Copilot cloud agent bootstrap (`.github/workflows/copilot-setup-steps.yml`)
> installs Node.js, `uv`, Chrome/Chromium and warms both `mcp-stealth-chrome`
> and `supergateway`. Project-level MCP client config lives in `.mcp.json` and
> `.vscode/mcp.json`.

### 2. Configure and run the app

```bash
cp .env.example .env.local
# Set a long random AUTH_SECRET:
node -e "console.log('AUTH_SECRET='+require('crypto').randomBytes(48).toString('hex'))" >> .env.local

npm install
npm run dev      # http://localhost:3000
```

Environment variables (`.env.example`):

- `AUTH_SECRET` — **required**; signs session tokens. The app refuses to start a
  session with a missing/short secret.
- `STEALTH_MCP_URL` — MCP bridge endpoint (default `http://127.0.0.1:8000/mcp`).
- `DATA_DIR` — JSON store location (default `./data`).

### 3. Use it

1. **Create Account** on the landing console.
2. Fill in your **Master Profile** and save.
3. Go to **Targets** → **Stealth Fetch** a job URL, or **Paste** a description.
4. Click **Tailor & Apply** to generate the tailored documents.
5. Open **Applications** to review the match analysis, copy/download the
   resume and cover letter, and track status.

---

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # run the production build
npm run lint       # ESLint (flat config)
npm run typecheck  # tsc --noEmit
```

---

## Responsible use

This tool is built to help **you** apply to jobs with documents tailored from
**your own** real experience:

- The "account" it creates is **your own** local operator account for this app.
  It does **not** fabricate identities or credentials for third-party sites.
- Generated resumes and cover letters are derived strictly from the profile you
  enter — nothing is invented.
- Submission stays **human-in-the-loop**: the agent prepares and tailors
  everything; you review and submit. Always respect the terms of service and
  rate limits of any site you interact with.
