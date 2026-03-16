# Database Maintenance, Troubleshooting & Debugging

> **CTFd v3.8.2** | Covers SQLite (dev) and MySQL/MariaDB (production)

---

## Table of Contents

1. [Connecting to the Database](#1-connecting-to-the-database)
2. [Flask Shell — ORM Queries](#2-flask-shell--orm-queries)
3. [Essential Health Checks](#3-essential-health-checks)
4. [Common Data Problems & Fixes](#4-common-data-problems--fixes)
   - 4.1 Duplicate or Phantom Solves
   - 4.2 Scoreboard Wrong / Out of Sync
   - 4.3 User Can't Log In
   - 4.4 Challenge Score Not Updating
   - 4.5 Submission Rate Limit Stuck
   - 4.6 Hint Unlock Not Recorded
   - 4.7 Team Mode — User Not in Team
   - 4.8 Config Value Not Taking Effect
5. [Useful Diagnostic Queries (Raw SQL)](#5-useful-diagnostic-queries-raw-sql)
6. [Data Repair Operations](#6-data-repair-operations)
7. [Migration Troubleshooting (Alembic)](#7-migration-troubleshooting-alembic)
8. [Cache & Session Debugging](#8-cache--session-debugging)
9. [Log Files](#9-log-files)
10. [Backup & Restore](#10-backup--restore)
11. [Scheduled Maintenance Tasks](#11-scheduled-maintenance-tasks)

---

## 1. Connecting to the Database

### SQLite (Dev / Local)

```bash
# Default location
sqlite3 CTFd/ctfd.db

# Useful SQLite pragmas
.tables           -- list all tables
.schema users     -- show CREATE TABLE for users
.mode column
.headers on
```

### MySQL / MariaDB (Production / Docker)

```bash
# Direct connection
mysql -h 127.0.0.1 -u ctfd -p ctfd

# Via Docker Compose
docker compose exec db mysql -u ctfd -pctfd ctfd

# Inside MySQL shell
USE ctfd;
SHOW TABLES;
DESCRIBE users;
```

### PostgreSQL

```bash
psql -h 127.0.0.1 -U ctfd -d ctfd
\dt            -- list tables
\d users       -- describe table
```

### Flask Shell (ORM-level access — safest method)

```bash
# From project root, with virtualenv active
export FLASK_APP=CTFd
flask shell
```

---

## 2. Flask Shell — ORM Queries

The Flask shell has the full SQLAlchemy ORM available. This is the **preferred** way to inspect and repair data because it respects model hooks (password hashing, polymorphism, etc.).

```python
# Imports always needed
from CTFd.models import *
from CTFd import db
from CTFd.utils import set_config, get_config

# ── Users ──────────────────────────────────────────────────
Users.query.count()                              # total users
Users.query.filter_by(type="admin").all()        # all admins
user = Users.query.filter_by(email="x@y.com").first()
user.name, user.score, user.place               # profile + score

# ── Challenges ─────────────────────────────────────────────
Challenges.query.filter_by(state="visible").count()
c = Challenges.query.filter_by(name="Hello World").first()
c.value, c.type, c.category

# ── Submissions ────────────────────────────────────────────
Submissions.query.filter_by(type="correct").count()   # total solves
Fails.query.filter_by(challenge_id=5).count()         # fails on chal 5

# ── Solves ─────────────────────────────────────────────────
Solves.query.filter_by(challenge_id=5).all()
Solves.query.filter_by(user_id=user.id).count()

# ── Config ─────────────────────────────────────────────────
get_config("ctf_name")
get_config("user_mode")
set_config("freeze", None)     # remove freeze

# ── Commit changes ─────────────────────────────────────────
db.session.commit()
db.session.rollback()    # undo uncommitted work
```

---

## 3. Essential Health Checks

Run these after deployment or when something feels wrong.

### 3.1 Quick Stats

```python
# Flask shell
print(f"Users:         {Users.query.count()}")
print(f"Teams:         {Teams.query.count()}")
print(f"Challenges:    {Challenges.query.count()}")
print(f"Total solves:  {Solves.query.count()}")
print(f"Total fails:   {Fails.query.count()}")
print(f"Tokens:        {Tokens.query.count()}")
print(f"CTF name:      {get_config('ctf_name')}")
print(f"Theme:         {get_config('ctf_theme')}")
print(f"Mode:          {get_config('user_mode')}")
print(f"Start:         {get_config('start')}")
print(f"End:           {get_config('end')}")
```

### 3.2 Detect Orphaned Records

```sql
-- Solves referring to deleted challenges
SELECT s.id, s.challenge_id FROM submissions s
LEFT JOIN challenges c ON s.challenge_id = c.id
WHERE c.id IS NULL AND s.type = 'correct';

-- Solves referring to deleted users
SELECT s.id, s.user_id FROM submissions s
LEFT JOIN users u ON s.user_id = u.id
WHERE u.id IS NULL;

-- Files without a challenge
SELECT f.id, f.location FROM files f
WHERE f.type = 'challenge' AND f.challenge_id IS NULL;
```

### 3.3 Duplicate Solves (should be impossible, but verify)

```sql
-- Users who solved the same challenge more than once
SELECT user_id, challenge_id, COUNT(*) AS cnt
FROM solves
GROUP BY user_id, challenge_id
HAVING cnt > 1;

-- Teams who solved the same challenge more than once
SELECT team_id, challenge_id, COUNT(*) AS cnt
FROM solves
WHERE team_id IS NOT NULL
GROUP BY team_id, challenge_id
HAVING cnt > 1;
```

### 3.4 Scoreboard Sanity

```python
# Flask shell
from CTFd.utils.scores import get_standings
standings = get_standings()
for s in standings[:10]:
    print(f"#{s.pos} {s.name}: {int(s.score)} pts")
```

Compare with what the UI shows. If different, the cache is stale — see [Section 8](#8-cache--session-debugging).

---

## 4. Common Data Problems & Fixes

---

### 4.1 Duplicate or Phantom Solves

**Symptom:** A user/team appears to have solved a challenge more than once, or a solve exists for a deleted user.

**Diagnose:**
```sql
SELECT user_id, challenge_id, COUNT(*) FROM solves
GROUP BY user_id, challenge_id HAVING COUNT(*) > 1;
```

**Fix (keep the earliest solve, delete duplicates):**
```sql
-- MySQL: delete all but the oldest solve per (user_id, challenge_id)
DELETE s1 FROM solves s1
INNER JOIN solves s2
  ON s1.user_id = s2.user_id
  AND s1.challenge_id = s2.challenge_id
  AND s1.id > s2.id;
```

```python
# Flask shell equivalent (safer — uses ORM)
from sqlalchemy import func
dupes = db.session.query(
    Solves.user_id, Solves.challenge_id,
    func.max(Solves.id).label("max_id")
).group_by(Solves.user_id, Solves.challenge_id).having(func.count() > 1).all()

for dupe in dupes:
    # Delete all solves for this pair EXCEPT the earliest (min id)
    earliest = Solves.query.filter_by(
        user_id=dupe.user_id, challenge_id=dupe.challenge_id
    ).order_by(Solves.id.asc()).first()
    Solves.query.filter_by(
        user_id=dupe.user_id, challenge_id=dupe.challenge_id
    ).filter(Solves.id != earliest.id).delete()

db.session.commit()
```

Then clear the scoreboard cache:
```python
from CTFd.cache import clear_standings
clear_standings()
```

---

### 4.2 Scoreboard Wrong / Out of Sync

**Symptom:** Scoreboard shows wrong ranking or stale scores after an admin operation.

**Cause:** Redis/filesystem cache not invalidated.

**Fix:**
```python
# Flask shell
from CTFd.cache import clear_standings, clear_challenges
clear_standings()
clear_challenges()
```

Or force-clear the entire cache (nuclear option):
```python
from CTFd.cache import cache
cache.clear()
```

If the problem persists after clearing cache, recheck for duplicate solves (4.1) or incorrect `Awards` with wrong `value` signs.

---

### 4.3 User Can't Log In

**Symptom:** User reports "Incorrect credentials" even with correct password, or is stuck in a loop.

**Diagnose:**
```python
# Flask shell
user = Users.query.filter_by(email="player@mmsu.edu.ph").first()
print("Exists:", user is not None)
print("Banned:", user.banned)
print("Verified:", user.verified)
print("Type:", user.type)
print("Change PW:", user.change_password)
```

**Fixes:**

```python
# Unban
user.banned = False

# Mark verified (if email verification loop)
user.verified = True

# Force password reset
user.password = "NewTemporaryPassword123!"   # hashed via @validates hook
user.change_password = False                  # clear force-reset flag

# Clear their stuck session from Redis cache
from CTFd.cache import clear_user_session
clear_user_session(user_id=user.id)

db.session.commit()
```

---

### 4.4 Challenge Score Not Updating (Dynamic Scoring)

**Symptom:** Dynamic challenge value hasn't changed despite new solves.

**Diagnose:**
```python
c = Challenges.query.get(5)
print(f"Current value: {c.value}")
print(f"Initial: {c.initial}, Min: {c.minimum}, Decay: {c.decay}")
print(f"Solves: {Solves.query.filter_by(challenge_id=c.id).count()}")
```

**Fix — manually trigger recalculation:**
```python
from CTFd.plugins.challenges import get_chal_class
c = Challenges.query.get(5)
chal_class = get_chal_class(c.type)
chal_class.calculate_value(c)
db.session.commit()

from CTFd.cache import clear_standings, clear_challenges
clear_standings()
clear_challenges()
```

---

### 4.5 Submission Rate Limit Stuck

**Symptom:** Player is permanently rate limited even after the timeout period.

**Cause:** Stale rate-limit counter in Redis.

**Fix:**
```python
# Flask shell
from CTFd.cache import cache

user_id    = 42
challenge_id = 5

# The key pattern used by CTFd
# Adjust kpm_limit and timeout to match your config
for kpm_limit in [10, 20]:
    for timeout in [300, 600]:
        key = f"account_kpm_{user_id}_{challenge_id}_{kpm_limit}_{timeout}"
        cache.delete(key)
        print(f"Cleared: {key}")
```

Or clear all rate-limit keys at once (nuclear):
```python
# Redis CLI (outside Flask)
# redis-cli KEYS "account_kpm_*" | xargs redis-cli DEL
```

---

### 4.6 Hint Unlock Not Recorded

**Symptom:** Player paid points to unlock a hint, but can't see the content.

**Diagnose:**
```python
user = Users.query.get(42)
hint_id = 3

unlock = HintUnlocks.query.filter_by(
    account_id=user.account_id,
    target=hint_id,
    type="hints"
).first()
print("Unlock exists:", unlock is not None)
```

**Fix — manually create unlock:**
```python
unlock = HintUnlocks(
    user_id=user.id,
    team_id=user.team_id,
    target=hint_id,
    type="hints"
)
db.session.add(unlock)
db.session.commit()
```

If the point deduction also didn't happen, check `Awards` for a negative-value entry for this user around that timestamp.

---

### 4.7 Team Mode — User Not in Team

**Symptom:** User can't submit flags in teams mode ("You must be in a team").

**Diagnose:**
```python
user = Users.query.get(42)
print("team_id:", user.team_id)
if user.team_id:
    team = Teams.query.get(user.team_id)
    print("Team members:", [m.name for m in team.members])
```

**Fix — assign user to a team:**
```python
team = Teams.query.filter_by(name="Team Rocket").first()
user.team_id = team.id
db.session.commit()

from CTFd.cache import clear_user_session, clear_team_session
clear_user_session(user.id)
clear_team_session(team.id)
```

**Fix — remove user from wrong team:**
```python
user.team_id = None
db.session.commit()
clear_user_session(user.id)
```

---

### 4.8 Config Value Not Taking Effect

**Symptom:** Changed a setting in Admin UI but the app still behaves as before.

**Cause 1:** Cache not expired yet.
```python
from CTFd.cache import clear_config
clear_config()
```

**Cause 2:** `config.ini` overrides the DB value (takes highest precedence).
```bash
grep -i "the_key" CTFd/config.ini
```

**Verify current effective value:**
```python
from CTFd.utils import get_config
print(get_config("verify_emails"))
print(get_config("user_mode"))
```

**Force-set directly:**
```python
from CTFd.utils import set_config
set_config("verify_emails", False)
set_config("ctf_theme", "ccis-week")
```

---

## 5. Useful Diagnostic Queries (Raw SQL)

Run these in MySQL/SQLite directly when Flask shell isn't available.

### Scoreboard (top 10 by solve score)

```sql
SELECT
    u.name,
    SUM(c.value) AS score,
    MAX(s.date)  AS last_solve
FROM solves s
JOIN challenges c ON s.challenge_id = c.id
JOIN users u      ON s.user_id = u.id
WHERE u.banned = 0 AND u.hidden = 0
GROUP BY u.id
ORDER BY score DESC, last_solve ASC
LIMIT 10;
```

### Top challenge solvers per challenge

```sql
SELECT
    c.name AS challenge,
    c.category,
    c.value,
    COUNT(s.id) AS solve_count
FROM challenges c
LEFT JOIN solves s ON s.challenge_id = c.id
GROUP BY c.id
ORDER BY solve_count DESC;
```

### Unsolved challenges

```sql
SELECT c.name, c.category, c.value
FROM challenges c
WHERE c.state = 'visible'
  AND c.id NOT IN (SELECT DISTINCT challenge_id FROM solves)
ORDER BY c.value DESC;
```

### First blood per challenge

```sql
SELECT
    c.name AS challenge,
    u.name AS first_solver,
    s.date AS solved_at
FROM solves s
JOIN challenges c ON s.challenge_id = c.id
JOIN users      u ON s.user_id = u.id
WHERE s.id IN (
    SELECT MIN(id) FROM solves GROUP BY challenge_id
)
ORDER BY s.date ASC;
```

### Most failed challenges (hardest)

```sql
SELECT
    c.name,
    c.category,
    COUNT(f.id) AS fail_count
FROM challenges c
JOIN submissions f ON f.challenge_id = c.id AND f.type = 'incorrect'
GROUP BY c.id
ORDER BY fail_count DESC
LIMIT 10;
```

### Users who registered but never solved anything

```sql
SELECT u.name, u.email, u.created
FROM users u
WHERE u.type = 'user'
  AND u.id NOT IN (SELECT DISTINCT user_id FROM solves WHERE user_id IS NOT NULL)
ORDER BY u.created DESC;
```

### Submission timeline (recent 50)

```sql
SELECT
    s.date,
    s.type,
    u.name AS player,
    c.name AS challenge,
    s.provided
FROM submissions s
JOIN users u ON s.user_id = u.id
JOIN challenges c ON s.challenge_id = c.id
ORDER BY s.date DESC
LIMIT 50;
```

### Unlocked hints by user

```sql
SELECT
    u.name,
    h.title,
    h.cost,
    ul.date
FROM unlocks ul
JOIN users u    ON ul.user_id = u.id
JOIN hints h    ON ul.target = h.id
WHERE ul.type = 'hints'
ORDER BY ul.date DESC;
```

### Config table dump (all settings)

```sql
SELECT key, value FROM config ORDER BY key;
```

---

## 6. Data Repair Operations

### 6.1 Reset a User's Password

```python
# Flask shell
user = Users.query.filter_by(email="player@mmsu.edu.ph").first()
user.password = "ResetMe123!"   # auto-bcrypted by ORM hook
db.session.commit()
```

### 6.2 Delete All Submissions for a Challenge (re-open a broken challenge)

```python
challenge_id = 5
Solves.query.filter_by(challenge_id=challenge_id).delete()
Fails.query.filter_by(challenge_id=challenge_id).delete()
db.session.commit()

from CTFd.cache import clear_standings, clear_challenges
clear_standings()
clear_challenges()
```

### 6.3 Award Bonus Points to a User or Team

```python
award = Awards(
    user_id=42,
    team_id=None,   # set if teams mode
    name="First Blood — Web-01",
    description="First team to solve Web Exploitation 01",
    value=50,
    category="special"
)
db.session.add(award)
db.session.commit()
from CTFd.cache import clear_standings
clear_standings()
```

### 6.4 Deduct Points (Penalty)

Awards support negative values:

```python
penalty = Awards(
    user_id=42,
    name="Penalty — flag sharing",
    value=-100,
    category="penalty"
)
db.session.add(penalty)
db.session.commit()
from CTFd.cache import clear_standings
clear_standings()
```

### 6.5 Ban / Unban a User

```python
user = Users.query.get(42)
user.banned = True   # or False to unban
db.session.commit()
from CTFd.cache import clear_user_session
clear_user_session(user.id)
```

### 6.6 Delete a User and All Their Data

```python
user_id = 42
from CTFd.models import Notifications, Awards, Unlocks, Submissions, Solves, Tracking
Notifications.query.filter_by(user_id=user_id).delete()
Awards.query.filter_by(user_id=user_id).delete()
Unlocks.query.filter_by(user_id=user_id).delete()
Submissions.query.filter_by(user_id=user_id).delete()
Solves.query.filter_by(user_id=user_id).delete()
Tracking.query.filter_by(user_id=user_id).delete()
Users.query.filter_by(id=user_id).delete()
db.session.commit()
from CTFd.cache import clear_standings, clear_challenges, clear_user_session
clear_standings(); clear_challenges(); clear_user_session(user_id)
```

### 6.7 Wipe All Submissions (Reset the CTF Data)

⚠️ **Destructive — irreversible without a backup.**

```python
# Wipe all solve/fail/submission records but keep users, teams, challenges
from CTFd.models import HintUnlocks, SolutionUnlocks, Unlocks
HintUnlocks.query.delete()
SolutionUnlocks.query.delete()
Unlocks.query.delete()
Solves.query.delete()
Fails.query.delete()
Submissions.query.delete()
Awards.query.delete()
db.session.commit()
cache.clear()
```

### 6.8 Transfer Solves to a Different User

```python
old_user_id = 10
new_user_id = 42

Solves.query.filter_by(user_id=old_user_id).update({"user_id": new_user_id})
Fails.query.filter_by(user_id=old_user_id).update({"user_id": new_user_id})
db.session.commit()
from CTFd.cache import clear_standings
clear_standings()
```

---

## 7. Migration Troubleshooting (Alembic)

### Check Current Migration State

```bash
export FLASK_APP=CTFd
flask db current         # prints current head revision
flask db heads           # prints latest available revision
flask db history         # full migration chain
```

### Run Pending Migrations

```bash
flask db upgrade
```

### Database Is Ahead of Code (downgrade needed)

```bash
flask db downgrade <revision_id>
```

Find `<revision_id>` from `flask db history`.

### Stamp Without Running Migrations (if DB already matches schema)

```bash
flask db stamp head
```

### Common Migration Errors

| Error | Cause | Fix |
|---|---|---|
| `Target database is not up to date` | Pending migrations | Run `flask db upgrade` |
| `Can't locate revision` | Corrupted alembic_version table | `flask db stamp head` |
| `Table already exists` | Manual schema change outside Alembic | Drop the table; re-run `flask db upgrade` |
| `Column already exists` | Same as above | Remove the column; re-migrate |
| `Foreign key constraint fails` | Orphaned FK rows | Clean orphans first (see Section 3.2), then run upgrade |

### View the alembic_version Table Directly

```sql
SELECT * FROM alembic_version;
-- Should contain exactly one row with the latest revision hash
```

---

## 8. Cache & Session Debugging

### Identify Which Cache Is Active

```python
# Flask shell
from CTFd.cache import cache
print(type(cache))  # RedisCache, FileSystemCache, SimpleCache
```

### Flush Specific Cache Namespaces

```python
from CTFd.cache import (
    clear_standings, clear_challenges,
    clear_pages, clear_config,
    clear_user_session, clear_team_session
)

clear_standings()                       # scoreboard
clear_challenges()                      # challenge data
clear_pages()                           # CMS pages
clear_config()                          # config key-value store
clear_user_session(user_id=42)          # one user's session
clear_team_session(team_id=7)           # one team's session
```

### Flush Everything

```python
from CTFd.cache import cache
cache.clear()
print("Cache cleared")
```

### Redis — Inspect Keys (via Redis CLI)

```bash
redis-cli -h 127.0.0.1 -p 6379

KEYS *               # list all keys (use carefully in production)
KEYS *session*       # session keys
KEYS *account_kpm*   # rate limit counters
TTL ctfd_session:42  # TTL of a specific session key
DEL ctfd_session:42  # delete one session key
FLUSHDB              # ⚠️ flush entire Redis DB
```

### Session Not Clearing After Password Change

```python
from CTFd.cache import clear_user_session
clear_user_session(user_id=42)
```

This forces the next request from that user to re-read from the DB.

---

## 9. Log Files

Logs are written to `CTFd/logs/`. Each is a structured text file (one JSON-like line per event).

| File | Contains |
|---|---|
| `logins.log` | Login attempts (success + failure) — date, name, IP |
| `registrations.log` | Registration events, email confirmations |
| `submissions.log` | All flag submission attempts — name, challenge_id, submission, kpm |

### Tail Live Submissions

```bash
tail -f CTFd/logs/submissions.log
```

### Search for a Specific Player's Submissions

```bash
grep "player_name" CTFd/logs/submissions.log | tail -30
```

### Search for Suspicious IPs (many fails from same IP)

```bash
grep "INCORRECT\|TOO FAST" CTFd/logs/submissions.log | \
  awk '{print $NF}' | sort | uniq -c | sort -rn | head -20
```

### Search for Login Failures

```bash
grep "FAIL" CTFd/logs/logins.log | tail -50
```

---

## 10. Backup & Restore

### Export (Full Backup)

Creates a ZIP containing all DB records (JSON) + uploaded files.

```bash
# Via CLI
python export.py

# Via Flask CLI
flask import_or_export export
```

Backup file: `CTFd_export_<timestamp>.zip`

### Import (Restore from Backup)

```bash
# Via CLI
python import.py CTFd_export_20260316.zip

# Note: imports are disabled for SQLite backends
# Use MySQL/PostgreSQL for production imports
```

> ⚠️ **Import wipes the current database before restoring.** Always backup before importing.

### MySQL — Manual Backup

```bash
# Dump
mysqldump -u ctfd -p ctfd > ctfd_backup_$(date +%F).sql

# Restore
mysql -u ctfd -p ctfd < ctfd_backup_2026-03-16.sql
```

### SQLite — Manual Backup

```bash
cp CTFd/ctfd.db CTFd/ctfd_backup_$(date +%F).db
```

### Automated Pre-Event Backup Script

```bash
#!/bin/bash
# Save as scripts/backup.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

mysqldump -u ctfd -p"$DB_PASS" ctfd | gzip > "$BACKUP_DIR/ctfd_$TIMESTAMP.sql.gz"
echo "Backup saved: $BACKUP_DIR/ctfd_$TIMESTAMP.sql.gz"
```

Schedule with cron (every 30 min during the event):

```cron
*/30 * * * * /home/ctfd/scripts/backup.sh >> /var/log/ctfd_backup.log 2>&1
```

---

## 11. Scheduled Maintenance Tasks

### Before the Event

```bash
# 1. Take a full backup
python export.py

# 2. Verify all challenges are visible and flagged correctly
flask shell -c "
from CTFd.models import Challenges, Flags
for c in Challenges.query.filter_by(state='visible').all():
    flags = Flags.query.filter_by(challenge_id=c.id).count()
    print(f'{c.name}: {flags} flags, value={c.value}')
"

# 3. Check no test submissions remain
flask shell -c "
from CTFd.models import Solves
print('Solves before event:', Solves.query.count())
"

# 4. Flush any stale cache
flask shell -c "from CTFd.cache import cache; cache.clear()"
```

### During the Event (Monitoring)

```bash
# Watch submission rate
watch -n 10 'wc -l CTFd/logs/submissions.log'

# Show last 5 solves
tail -5 CTFd/logs/submissions.log

# Check DB connection pool (MySQL)
mysql -u ctfd -p ctfd -e "SHOW STATUS LIKE 'Threads_connected';"
```

### After the Event

```bash
# 1. Final backup
python export.py

# 2. Compute final standings for poster/announcement
flask shell -c "
from CTFd.utils.scores import get_standings
for s in get_standings()[:10]:
    print(f'{s.pos}. {s.name}: {int(s.score)} pts')
"

# 3. Export submissions CSV for records
flask shell -c "
import csv, sys
from CTFd.models import Solves, Users, Challenges
writer = csv.writer(sys.stdout)
writer.writerow(['place','team','challenge','category','value','date'])
from CTFd.utils.scores import get_standings
standings = {s.account_id: s.pos for s in get_standings()}
for solve in Solves.query.order_by(Solves.date).all():
    u = Users.query.get(solve.user_id)
    c = Challenges.query.get(solve.challenge_id)
    if u and c:
        writer.writerow([standings.get(u.account_id,'?'), u.name, c.name, c.category, c.value, solve.date])
" > results.csv
```
