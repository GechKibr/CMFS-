# CMFS - VBFinal

This repository contains the CMFS application. The project is split into two primary parts: the frontend (single-page application) and the backend (Django application). This README documents setup, running, and common troubleshooting steps for both parts.

---

## Frontend

- **Location:** `VBFinal/frontend`

- **Overview:** The frontend is a modern SPA built with Vite (React). It communicates with the backend API and realtime endpoints.

- **Prerequisites:**
  - Node.js (recommended LTS >= 16)
  - npm, yarn, or pnpm

- **Install dependencies:**

```bash
cd VBFinal/frontend
npm ci            # or `npm install` / `yarn` / `pnpm install`
```

- **Environment variables:**
  - Create a `.env` or `.env.local` in `VBFinal/frontend` if the project expects one.
  - Typical variables: `VITE_API_BASE_URL`, `VITE_WEBSOCKET_URL`, feature flags, etc. Check `VBFinal/frontend/.env.example` if present.

- **Run development server:**

```bash
cd VBFinal/frontend
npm run dev
# Open the URL printed by Vite (usually http://localhost:5173)
```

- **Build for production:**

```bash
cd VBFinal/frontend
npm run build
# Serve `dist/` with a static server or hook into your production pipeline
```

- **Lint / Test / Format:**

```bash
npm run lint
npm run test
npm run format
```

- **Common issues & troubleshooting:**
  - "Port already in use": change Vite port with `--port` or stop the conflicting process.
  - Missing environment variables: Ensure `.env` is created and restart dev server.
  - CORS errors when calling API: enable CORS on the backend or use a proxy in Vite config.
  - Dependency/build failures: delete `node_modules` and `package-lock.json`/`pnpm-lock.yaml` and reinstall (`npm ci`).
  - Static asset 404s after build: check `base` path in `vite.config.js` and ensure assets are referenced correctly.

---

## Backend

- **Location:** `VBFinal/backend` (Django project)

- **Overview:** Django backend provides the API, realtime channels, and scheduled tasks. Default dev DB is `db.sqlite3` in the `backend/` folder.

- **Prerequisites:**
  - Python 3.10+ (match the version used for the project)
  - `pip` (packaged with Python) or a virtual environment manager

- **Create and activate virtual environment (recommended):**

Windows (PowerShell):
```powershell
cd VBFinal/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Windows (cmd):
```cmd
cd VBFinal/backend
python -m venv .venv
.\.venv\Scripts\activate.bat
```

macOS / Linux:
```bash
cd VBFinal/backend
python -m venv .venv
source .venv/bin/activate
```

- **Install Python dependencies:**

```bash
cd VBFinal/backend
pip install -r requirements.txt
```

- **Environment configuration:**
  - Use a `.env` file or set environment variables for sensitive settings.
  - Common variables: `SECRET_KEY`, `DEBUG=1` (development), `ALLOWED_HOSTS`, `DATABASE_URL` (if using non-default DB), `REDIS_URL` (if using channels/celery), email SMTP settings.

- **Database migrations & initial setup:**

```bash
cd VBFinal/backend
python manage.py migrate
python manage.py createsuperuser   # create admin account
```

- **Run development server (Django):**

```bash
cd VBFinal/backend
python manage.py runserver 0.0.0.0:8000
```

- **ASGI / Channels / Websockets:**
  - If using Channels/ASGI, you can run with `daphne` or `uvicorn` in development:

```bash
# Example with uvicorn
uvicorn conf.asgi:application --reload --host 0.0.0.0 --port 8000
```

- **Celery (if used):**

```bash
# Start worker (example)
celery -A backend worker -l info
# Start beat scheduler if scheduled tasks are used
celery -A backend beat -l info
```

- **Collect static files (for production):**

```bash
cd VBFinal/backend
python manage.py collectstatic --noinput
```

- **Running tests and checks:**

```bash
cd VBFinal/backend
python manage.py test
flake8 .               # if flake8 is configured
```

- **Common backend issues & troubleshooting:**
  - ModuleNotFoundError / ImportError: ensure the virtualenv is active and `pip install -r requirements.txt` completed successfully.
  - Database locked (SQLite): occurs when multiple processes access the DB; stop other processes or use a different DB for concurrency (Postgres recommended).
  - Missing migrations: run `python manage.py makemigrations` then `migrate` when schema changes exist.
  - `OperationalError: unable to open database file`: check file permissions and path for `db.sqlite3`.
  - Redis connection refused: confirm Redis is running and `REDIS_URL` is correct for channels/celery.
  - WebSocket 403/401: verify websocket auth tokens and JWT/session settings used by `websocket_auth.py` or middleware.
  - Static files returning 404: run `collectstatic` and verify web server (nginx) is configured to serve the static directory.
  - Port already in use: switch port or stop the conflicting service.

- **Production notes & recommendations:**
  - Use PostgreSQL or another production-grade RDBMS instead of SQLite.
  - Set `DEBUG=False` and provide a strong `SECRET_KEY` via environment variables.
  - Serve the application with an ASGI server (Daphne/Uvicorn) behind a reverse proxy (Nginx) for HTTPS and static serving.
  - Configure a process manager (systemd, supervisor, or container orchestration) for `gunicorn`/`uvicorn`, Celery workers, and background schedulers.
  - Use a proper cache/broker (Redis) for channels and Celery.

---

## Quick verification checklist

- Frontend: after `npm run dev`, open the dev URL and check the browser console for network errors.
- Backend: after `python manage.py runserver`, visit `http://localhost:8000/api/` (or your API root) and verify responses.
- Run `python manage.py test` to exercise backend tests and surface obvious issues.

If you need this README adjusted to include exact environment variable names or CI/CD steps used by your deployment, tell me which service (Vercel, Docker, systemd, etc.) you plan to use and I'll add a production-ready section.
