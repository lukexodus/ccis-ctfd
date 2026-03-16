# Team Runbook (Option A)

This runbook defines a Docker-first workflow with a single canonical content source for your team.

Option A policy:
- Everyone develops and tests with Docker Compose.
- One canonical CTF snapshot is the source of truth for challenge content.
- Runtime infrastructure data (sessions, caches, temporary state) stays in Docker volumes.

---

## 1. First-Time Setup

### 1.1 Prerequisites

- Docker Engine 24+
- Docker Compose v2+
- Git

### 1.2 Clone and enter the repository

```bash
git clone <your-repo-url>
cd ccis_ctfd
```

### 1.3 Create secret key file

```bash
python3 -c "import secrets; print(secrets.token_hex(32))" > .ctfd_secret_key
```

### 1.4 Start the stack

```bash
docker compose up -d
docker compose ps
```

### 1.5 Initialize admin and platform

Open the app and complete setup:

- URL: `http://localhost`
- Create admin account
- Configure CTF name, time, and basic branding

### 1.6 Verify health

```bash
docker compose logs --tail=100 ctfd
docker compose logs --tail=100 db
docker compose exec ctfd sh -lc 'echo "$DATABASE_URL"'
```

Expected:
- No restart loop on `ctfd`
- No DB connection failures
- `DATABASE_URL` points to MariaDB (`mysql+pymysql://...@db/...`), not SQLite

---

## 2. Daily Commands

### 2.1 Start services

```bash
docker compose up -d
```

### 2.2 Check status

```bash
docker compose ps
```

### 2.3 Follow logs during work

```bash
docker compose logs -f ctfd
```

### 2.4 Stop services (keep data)

```bash
docker compose stop
```

### 2.5 Pull latest code and refresh app

```bash
git pull
docker compose build ctfd
docker compose up -d ctfd
```

### 2.6 Run tests

```bash
make test
```

---

## 3. Reset Commands

Use the smallest reset needed.

### 3.1 Soft reset (restart app only)

```bash
docker compose restart ctfd
```

### 3.2 Service reset (recreate containers, keep volumes)

```bash
docker compose down
docker compose up -d
```

### 3.3 Full data reset (destructive)

This removes DB/cache/upload data in Docker volumes and local `.data` bind data.

```bash
docker compose down -v
rm -rf .data/mysql .data/CTFd/uploads
mkdir -p .data/mysql .data/CTFd/uploads
docker compose up -d
```

### 3.4 Admin password reset (inside running stack)

```bash
docker compose exec ctfd python manage.py shell -c "from CTFd.models import Users, db; u=Users.query.filter_by(email='admin@example.com').first(); u.password='NewStrongPass!123'; db.session.commit(); print('password reset complete')"
```

Replace `admin@example.com` with the real admin email.

---

## 4. Export/Import Content Commands

This is the Option A core flow: use official exports for team synchronization.

### 4.1 Create export from source environment

```bash
docker compose exec ctfd sh -lc 'python manage.py export_ctf /tmp/ctfd-export-$(date +%Y%m%d-%H%M%S).zip && ls -1 /tmp/ctfd-export-*.zip | tail -n 1'
```

Note: in this repository, `/opt/CTFd` is mounted read-only in the `ctfd` container, so exports should be written to a writable path like `/tmp`.

Legacy equivalent (still available):

```bash
docker compose exec ctfd sh -lc 'python export.py /tmp/ctfd-export-$(date +%Y%m%d-%H%M%S).zip'
```

### 4.2 Copy export artifact out of container (if needed)

```bash
mkdir -p exports
CONTAINER_ID=$(docker compose ps -q ctfd)
LATEST_EXPORT=$(docker compose exec -T ctfd sh -lc 'ls -1 /tmp/ctfd-export-*.zip | tail -n 1')
docker cp "$CONTAINER_ID":"$LATEST_EXPORT" ./exports/
```

### 4.3 Import official export into local Docker stack

```bash
docker compose exec ctfd python manage.py import_ctf /opt/CTFd/exports/<official-export>.zip
```

This works when the zip is in host `./exports` because the project directory is mounted read-only at `/opt/CTFd` (read access is sufficient for import).

Legacy equivalent (still available):

```bash
docker compose exec ctfd python import.py /opt/CTFd/exports/<official-export>.zip
```

### 4.4 Recommended team sync convention

- Keep official exports in `./exports/releases/`
- Name format: `ctfd-content-vYYYY.MM.DD-HHMM.zip`
- Import only approved snapshots into shared/staging/prod

### 4.5 Mechanism selection (what to use when)

Use the existing mechanisms based on scope of change:

- Export + Import (ZIP)
	- Use for full challenge set synchronization between environments.
	- Preferred for release packaging and team-wide sync.
	- CLI (current):
		- `docker compose exec ctfd python manage.py export_ctf /tmp/<name>.zip`
		- `docker compose exec ctfd python manage.py import_ctf /opt/CTFd/exports/<name>.zip`
	- Legacy scripts still available in this repo:
		- `python export.py`
		- `python import.py <file.zip>`

- Download CSV + Import CSV
	- Use for targeted data exchange (users, teams, or challenges only).
	- Best for small edits or partial merges without full environment overwrite.
	- Admin UI path:
		- Download CSV from Admin Config page (Export CSV form).
		- Import CSV from Admin Config page (Import CSV form).
	- Supported import types: `users`, `teams`, `challenges`.

Rule of thumb:
- If multiple challenge records/files changed across the event, use ZIP Export/Import.
- If only specific table rows need to be shared or corrected, use CSV Download/Import.

---

## 5. Release Checklist Template

Copy this checklist into each release issue/PR.

### 5.1 Content freeze

- [ ] Challenge text, files, hints, flags reviewed
- [ ] Scoring logic validated (dynamic/static)
- [ ] Visibility and category checks completed
- [ ] Test team dry-run completed

### 5.2 Platform checks

- [ ] `docker compose ps` all core services healthy
- [ ] `docker compose logs --tail=200 ctfd` clean
- [ ] Admin login works
- [ ] User registration policy confirmed
- [ ] Email/webhook integrations verified (if enabled)

### 5.3 Data safety

- [ ] Fresh DB backup created
- [ ] Uploads backup created
- [ ] Official content export zip generated and archived
- [ ] Restore drill tested on staging

### 5.4 Security and configuration

- [ ] Secret key set and not committed
- [ ] DB credentials rotated from defaults
- [ ] Trusted hosts/domain settings verified
- [ ] HTTPS/TLS certs valid

### 5.5 Final go-live

- [ ] Release tag created
- [ ] Deployment completed on target host
- [ ] Smoke test complete (home, login, challenge solve, scoreboard)
- [ ] On-call owner assigned

---

## 6. Ownership and Change Control

- Content owner: approves challenge content exports
- Platform owner: approves infra/config changes
- Any change to this runbook requires PR review from both owners

This keeps content and infrastructure decisions explicit and reproducible for the full team.

---

## 7. Team-to-Team Workflow

This section defines how Content, Platform, QA, and Operations collaborate each cycle.

### 7.1 Team roles

- Content Team: creates and updates challenges, files, hints, tags, and scoring intent.
- Platform Team: maintains Docker stack, configuration, secrets, monitoring, and backups.
- QA Team: validates challenge behavior, solve paths, visibility, and regressions.
- Operations Team: executes release, go-live checks, rollback readiness, and on-call response.

### 7.2 Working model (single content source)

- Content changes are made in a dedicated source instance.
- Content Team publishes an official export zip.
- QA and Platform only test approved export snapshots.
- Staging and production import the same approved export artifact.

### 7.3 Handoff workflow

1. Content Team prepares changes and self-reviews challenge quality.
2. Content Team generates export zip and opens a release ticket with:
	- export filename
	- short change summary
	- known risk notes
3. Platform Team imports export to staging and verifies service health.
4. QA Team runs validation pass on staging:
	- expected solves
	- flag correctness
	- scoring behavior
	- attachment access
5. QA Team records pass/fail with blockers in the same release ticket.
6. Content Team fixes issues and republishes a new export if needed.
7. Platform Team imports final approved export to production.
8. Operations Team executes go-live smoke tests and starts on-call window.

### 7.4 Communication cadence

- Daily standup (10 to 15 min): blockers and owner updates.
- Content freeze meeting: final challenge lock and approval to package export.
- Go-live checkpoint: final sign-off from Content, QA, and Platform leads.
- Post-event review: incidents, solve analytics, and improvement actions.

### 7.5 Required artifacts per release

- Official export zip in `exports/releases/`
- Release ticket with approvals from Content, QA, and Platform
- Staging validation report (pass/fail + evidence)
- Production smoke test log

### 7.6 Escalation path

- Content issue (wrong flag, broken hint): Content lead owns immediate fix.
- Platform issue (service down, DB errors): Platform lead owns rollback/fix.
- Cross-team blocker: Operations lead decides ship/hold based on risk.

### 7.7 Definition of done

- Export artifact approved by all three leads (Content, QA, Platform).
- Staging and production both running the same approved export version.
- Smoke tests pass and on-call owner is assigned.

### 7.8 Challenge build-share-sync protocol

Use this protocol for every challenge update so all teams stay aligned.

1. Build (Content Team)
	- Create or update challenges in the source authoring instance.
	- Validate required fields before packaging:
	  - title and category
	  - challenge description
	  - flag and points/scoring mode
	  - files, hints, tags, and visibility
	- Run a self-check solve path before handing off.
2. Package (Content Team)
	- Choose package type based on change scope (see Section 4.5):
	  - Full sync: export ZIP
	  - Partial sync: CSV package (`challenges`, `users`, `teams` as needed)
	- Save artifacts using release naming convention.
	- Add release notes in the ticket with:
	  - added challenges
	  - modified challenges
	  - removed or hidden challenges
3. Share (Content Team -> Platform + QA)
	- Place approved ZIP in `exports/releases/` for full syncs.
	- For partial syncs, attach CSV files to the release ticket and list csv_type.
	- Post ticket link and artifact names in the team channel.
	- Mark handoff status as `ready-for-import`.
4. Sync to staging (Platform Team)
	- Import using the matching mechanism:
	  - ZIP: Section 4.3 command
	  - CSV: Admin Config -> Import CSV with matching csv_type
	- Post import confirmation with artifact names and import time.
	- Mark status as `ready-for-qa`.
5. Verify sync integrity (QA Team)
	- Confirm challenge counts match release notes.
	- Spot-check all changed challenges end-to-end:
	  - files downloadable
	  - flags accepted/rejected correctly
	  - hints and scoring behavior correct
	- Mark status as `qa-pass` or `qa-fail` with blocker details.
6. Promote to production (Platform + Operations)
	- Only import artifacts marked `qa-pass`.
	- Re-run smoke tests after import.
	- Mark status as `released` with final artifact version.

Status flow for challenge sync:
- `draft` -> `ready-for-import` -> `ready-for-qa` -> `qa-pass` -> `released`
- If QA fails: `qa-fail` -> Content fixes -> new artifact -> repeat from `ready-for-import`