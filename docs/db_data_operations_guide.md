# Database Data Operations Guide

This guide covers day-2 operations for CTFd database data: maintenance, troubleshooting, and debugging.

Scope:
- Data quality and consistency checks
- Safe read-only diagnostics and targeted fixes
- Incident playbooks for common data issues

Out of scope:
- Engine internals and host-level tuning
- Backup/restore policy design (see `docs/backup_recovery.md`)
- The in-progress `db_maintenance.db` artifact

---

## 1. Before You Touch Data

1. Confirm active stack and DB URL:

```bash
docker compose ps
docker compose exec ctfd env | grep DATABASE_URL
```

2. Freeze writes for invasive fixes:

```bash
docker compose stop ctfd
```

3. Always take a point-in-time dump before manual updates/deletes:

```bash
mkdir -p /tmp/ctfd-db-snapshots
docker compose exec -T db mysqldump -u ctfd -pctfd --single-transaction ctfd \
  > /tmp/ctfd-db-snapshots/ctfd_pre_fix_$(date +%Y%m%d_%H%M%S).sql
```

4. Run changes in this order:
- Read-only query
- Verify expected row set
- Apply minimal write
- Re-check invariants

---

## 2. Access Patterns

### 2.1 MariaDB via Docker Compose (default in this repo)

```bash
docker compose exec db mysql -u ctfd -pctfd ctfd
```

One-off query:

```bash
docker compose exec db mysql -u ctfd -pctfd ctfd -e "SELECT COUNT(*) FROM users;"
```

### 2.2 SQLite fallback (non-docker local dev)

If `DATABASE_URL` is not set, CTFd defaults to `CTFd/ctfd.db`.

```bash
sqlite3 CTFd/ctfd.db "SELECT COUNT(*) FROM users;"
```

---

## 3. Core Data Health Checks

Run these checks during pre-event validation and when debugging score/data anomalies.

### 3.1 Cardinality Snapshot

```sql
SELECT 'users' AS t, COUNT(*) AS c FROM users
UNION ALL SELECT 'teams', COUNT(*) FROM teams
UNION ALL SELECT 'challenges', COUNT(*) FROM challenges
UNION ALL SELECT 'submissions', COUNT(*) FROM submissions
UNION ALL SELECT 'solves', COUNT(*) FROM solves
UNION ALL SELECT 'awards', COUNT(*) FROM awards;
```

### 3.2 Orphan Detection

Orphan solves (challenge removed, solve left behind):

```sql
SELECT s.id, s.challenge_id
FROM solves s
LEFT JOIN challenges c ON c.id = s.challenge_id
WHERE c.id IS NULL;
```

Orphan submissions to missing users:

```sql
SELECT sb.id, sb.user_id
FROM submissions sb
LEFT JOIN users u ON u.id = sb.user_id
WHERE sb.user_id IS NOT NULL AND u.id IS NULL;
```

### 3.3 Duplicate Solve Detection

Per-user duplicates:

```sql
SELECT challenge_id, user_id, COUNT(*) AS dup_count
FROM solves
WHERE user_id IS NOT NULL
GROUP BY challenge_id, user_id
HAVING COUNT(*) > 1;
```

Per-team duplicates:

```sql
SELECT challenge_id, team_id, COUNT(*) AS dup_count
FROM solves
WHERE team_id IS NOT NULL
GROUP BY challenge_id, team_id
HAVING COUNT(*) > 1;
```

### 3.4 Hidden/Banned Consistency Check

```sql
SELECT id, name, hidden, banned
FROM users
WHERE hidden = 1 OR banned = 1
ORDER BY id DESC
LIMIT 50;
```

Use this when users report missing scoreboard entries.

---

## 4. Score Debugging Queries

### 4.1 Reconstruct Team Scores (from solves + awards)

```sql
SELECT
  t.id,
  t.name,
  COALESCE(sol.solve_points, 0) + COALESCE(aw.award_points, 0) AS recomputed_score
FROM teams t
LEFT JOIN (
  SELECT team_id, SUM(ch.value) AS solve_points
  FROM solves s
  JOIN challenges ch ON ch.id = s.challenge_id
  WHERE team_id IS NOT NULL
  GROUP BY team_id
) sol ON sol.team_id = t.id
LEFT JOIN (
  SELECT team_id, SUM(value) AS award_points
  FROM awards
  WHERE team_id IS NOT NULL
  GROUP BY team_id
) aw ON aw.team_id = t.id
ORDER BY recomputed_score DESC, t.id ASC;
```

### 4.2 Reconstruct User Scores (users mode)

```sql
SELECT
  u.id,
  u.name,
  COALESCE(sol.solve_points, 0) + COALESCE(aw.award_points, 0) AS recomputed_score
FROM users u
LEFT JOIN (
  SELECT user_id, SUM(ch.value) AS solve_points
  FROM solves s
  JOIN challenges ch ON ch.id = s.challenge_id
  WHERE user_id IS NOT NULL
  GROUP BY user_id
) sol ON sol.user_id = u.id
LEFT JOIN (
  SELECT user_id, SUM(value) AS award_points
  FROM awards
  WHERE user_id IS NOT NULL
  GROUP BY user_id
) aw ON aw.user_id = u.id
ORDER BY recomputed_score DESC, u.id ASC;
```

### 4.3 Challenge Value Sanity (dynamic scoring)

```sql
SELECT id, name, value, initial, minimum, decay, function, state
FROM challenges
ORDER BY id;
```

If values look wrong, verify challenge type/plugin logic before editing values directly.

---

## 5. Incident Playbooks

### INC-DATA-01: "Team/User score is wrong"

1. Confirm expected solves/awards exist for entity.
2. Run recompute queries in Section 4.
3. Check hidden/banned state and bracket assignment.
4. Check duplicate solves and orphan records.
5. If mismatch is still unexplained, inspect app logs for scoring plugin behavior:

```bash
docker compose logs --tail=200 ctfd | grep -Ei "score|award|solve|challenge"
```

### INC-DATA-02: "Solve exists in UI but not in export/report"

1. Validate presence in `submissions` and `solves`.
2. Confirm related challenge/user/team rows still exist.
3. Check for direct SQL edits that bypassed normal workflows.
4. If needed, repair by inserting missing linked row only after snapshot.

### INC-DATA-03: "Submission accepted but no points awarded"

1. Verify the submission type and whether a solve row was created:

```sql
SELECT id, challenge_id, user_id, team_id, type, date
FROM submissions
WHERE challenge_id = <challenge_id>
ORDER BY id DESC
LIMIT 20;
```

2. Verify challenge visibility/state and scoring function.
3. Check if solve already existed (duplicate should not add points).

### INC-DATA-04: "Missing user/team from scoreboard"

1. Check `hidden`, `banned`, and bracket fields.
2. Check event time/freeze settings in config/options.
3. Validate user/team has at least one scoring event (solve or award).

---

## 6. Safe Repair Patterns

Use transactions for manual updates where possible.

### 6.1 Delete one duplicate solve, keep oldest

```sql
START TRANSACTION;

-- Inspect duplicate set first
SELECT id, challenge_id, user_id, team_id, date
FROM solves
WHERE challenge_id = <challenge_id> AND user_id = <user_id>
ORDER BY date ASC;

-- Example: remove newer duplicate id
DELETE FROM solves WHERE id = <duplicate_solve_id>;

COMMIT;
```

### 6.2 Correct a mistaken award value

```sql
START TRANSACTION;

SELECT id, user_id, team_id, value, name
FROM awards
WHERE id = <award_id>;

UPDATE awards
SET value = <correct_value>
WHERE id = <award_id>;

COMMIT;
```

### 6.3 Reverse a bad user/team state flag

```sql
START TRANSACTION;

UPDATE users
SET hidden = 0, banned = 0
WHERE id = <user_id>;

COMMIT;
```

After any repair:
- Re-run relevant checks from Sections 3 and 4
- Verify behavior in UI/API
- Record what changed, who approved it, and backup file used

---

## 7. Debugging with API Cross-Checks

When DB rows look correct but UI output is wrong, compare API output with SQL.

1. Query DB entity directly.
2. Query related API endpoint.
3. Diff fields and identify transformation layer mismatch.

Example workflow:

```bash
# API response snapshot
curl -s http://localhost:8000/api/v1/scoreboard | jq '.data[0:10]'

# DB recompute snapshot (run in db shell)
-- use query from Section 4.1 or 4.2
```

If API and DB diverge, inspect:
- Cache behavior (`REDIS_URL` / cache invalidation)
- Plugin signal handlers or custom challenge types
- Scoreboard-specific filters (hidden, banned, bracket, freeze)

---

## 8. Performance-Focused Data Diagnostics

Use these checks when queries time out or admin pages load slowly.

Top table sizes:

```sql
SELECT
  table_name,
  table_rows,
  ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'ctfd'
ORDER BY size_mb DESC;
```

Long-running queries:

```sql
SHOW FULL PROCESSLIST;
```

If needed, add narrowly scoped indexes only after measuring and testing on staging.

---

## 9. Post-Incident Checklist

1. Capture incident window and impact.
2. Save read-only evidence queries and outputs.
3. Document exact repair SQL and row counts changed.
4. Record verification steps (UI, API, SQL).
5. Add regression test or admin guardrail where practical.

---

## 10. Quick Command Reference

```bash
# Open DB shell
docker compose exec db mysql -u ctfd -pctfd ctfd

# Count key entities quickly
docker compose exec db mysql -u ctfd -pctfd ctfd -e \
"SELECT (SELECT COUNT(*) FROM users) users, \
        (SELECT COUNT(*) FROM teams) teams, \
        (SELECT COUNT(*) FROM challenges) challenges, \
        (SELECT COUNT(*) FROM solves) solves;"

# Tail CTFd logs for scoring/data issues
docker compose logs -f ctfd | grep -Ei "error|score|solve|award|sql|traceback"
```

This guide should be used together with:
- `docs/data_dictionary.md` for field-level meaning
- `docs/database_schema.md` and `docs/erd.md` for relational context
- `docs/backup_recovery.md` for restore operations