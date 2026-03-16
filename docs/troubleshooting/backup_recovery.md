# Backup & Recovery Plan

This document describes the data backup strategy, recovery procedures, and RPO/RTO targets for the CTFd production deployment.

---

## Recovery Objectives

| Metric | Target |
|---|---|
| **RPO** (Recovery Point Objective) — max data loss tolerated | 24 hours (daily backup) |
| **RTO** (Recovery Time Objective) — max time to restore | 1 hour |

Adjust these targets based on the CTF event requirements. During an active CTF event, a more aggressive RPO (e.g. 1-hour incremental backups) is recommended.

---

## What Needs to Be Backed Up

| Data | Storage Location | Criticality |
|---|---|---|
| MariaDB database | `.data/mysql/` (volume) | **Critical** — all platform data |
| Uploaded files | `.data/CTFd/uploads/` (volume) | High — challenge attachments |
| Application config | `CTFd/config.ini` | Medium — can be recreated |
| Secret key | `.ctfd_secret_key` | High — loss invalidates all sessions |
| Redis cache | `.data/redis/` | Low — cache is ephemeral, auto-rebuilds |
| CTFd application logs | `.data/CTFd/logs/` | Low — operational records only |

---

## Backup Types

| Type | Frequency | Retained For | Tool |
|---|---|---|---|
| Full DB dump | Daily | 30 days | `mysqldump` |
| Uploaded files snapshot | Daily | 30 days | `rsync` or `tar` |
| DB dump (pre-event) | Before each CTF starts | Indefinitely | `mysqldump` |
| DB dump (post-event) | After each CTF ends | Indefinitely | `mysqldump` |
| CTFd export (JSON) | Weekly | 90 days | `python export.py` |

---

## Backup Procedures

### 1. MariaDB Full Dump (Daily)

```bash
#!/bin/bash
# backup_db.sh

DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backups/ctfd/db"
COMPOSE_DIR="/path/to/ccis_ctfd"

mkdir -p "$BACKUP_DIR"

docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db \
  mysqldump \
    --user=ctfd \
    --password=<DB_PASSWORD> \
    --single-transaction \
    --routines \
    --triggers \
    ctfd \
  | gzip > "$BACKUP_DIR/ctfd_db_$DATE.sql.gz"

echo "Database backup complete: ctfd_db_$DATE.sql.gz"
```

Schedule with cron (runs daily at 02:00):

```cron
0 2 * * * /opt/scripts/backup_db.sh >> /var/log/ctfd_backup.log 2>&1
```

The `--single-transaction` flag ensures a consistent snapshot without locking tables, making it safe to run during CTF events.

---

### 2. Uploaded Files Backup (Daily)

```bash
#!/bin/bash
# backup_uploads.sh

DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backups/ctfd/uploads"
UPLOAD_SOURCE="/path/to/ccis_ctfd/.data/CTFd/uploads"

mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C "$UPLOAD_SOURCE" .

echo "Uploads backup complete: uploads_$DATE.tar.gz"
```

Schedule with cron (runs daily at 02:30):

```cron
30 2 * * * /opt/scripts/backup_uploads.sh >> /var/log/ctfd_backup.log 2>&1
```

---

### 3. CTFd JSON Export (Weekly)

CTFd provides a built-in export that captures all competition data (challenges, users, teams, solves, flags, etc.) as a JSON-based zip archive.

```bash
# Automated (non-interactive)
docker compose exec ctfd python export.py

# The export file is written to the CTFd process working directory
# Move it to your backup location:
EXPORT_FILE=$(ls -t /opt/CTFd/*.zip 2>/dev/null | head -1)
cp "$EXPORT_FILE" /backups/ctfd/exports/
```

This export can be used to seed a fresh CTFd installation.

---

### 4. Pre/Post-Event Snapshots

Before starting a CTF and immediately after it ends, take a manual point-in-time backup:

```bash
# Pre-event
docker compose exec -T db mysqldump \
  -u ctfd -p<PASSWORD> --single-transaction ctfd \
  | gzip > /backups/pre_event_$(date +%Y%m%d).sql.gz

# Post-event
docker compose exec -T db mysqldump \
  -u ctfd -p<PASSWORD> --single-transaction ctfd \
  | gzip > /backups/post_event_$(date +%Y%m%d).sql.gz
```

---

### 5. Secret Key Backup

```bash
# Store the secret key in a separate secure location
cp /path/to/ccis_ctfd/.ctfd_secret_key /backups/ctfd/secrets/ctfd_secret_key.$(date +%Y%m%d)

# Restrict permissions
chmod 600 /backups/ctfd/secrets/ctfd_secret_key.*
```

---

## Backup Retention & Cleanup

Add this script to cron to enforce retention policies:

```bash
#!/bin/bash
# cleanup_backups.sh

BACKUP_DIR="/backups/ctfd"

# Keep DB dumps for 30 days
find "$BACKUP_DIR/db" -name "*.sql.gz" -mtime +30 -delete

# Keep upload snapshots for 30 days
find "$BACKUP_DIR/uploads" -name "*.tar.gz" -mtime +30 -delete

# Keep weekly exports for 90 days
find "$BACKUP_DIR/exports" -name "*.zip" -mtime +90 -delete

echo "Backup cleanup done."
```

Schedule:

```cron
0 4 * * * /opt/scripts/cleanup_backups.sh >> /var/log/ctfd_backup.log 2>&1
```

---

## Offsite / Remote Backup

For disaster recovery, sync backups to an offsite location:

### Using `rclone` to S3 / Object Storage

```bash
# Install rclone and configure a remote named 'backup-s3'
rclone copy /backups/ctfd backup-s3:my-ctfd-backups/ \
  --transfers 4 \
  --log-file /var/log/rclone.log

# Via cron after local backup completes (03:00)
0 3 * * * rclone copy /backups/ctfd backup-s3:my-ctfd-backups/ >> /var/log/rclone.log 2>&1
```

### Using `rsync` to a Remote Host

```bash
rsync -avz --delete \
  /backups/ctfd/ \
  backup-user@backup-server:/remote-backups/ctfd/
```

---

## Recovery Procedures

### Scenario A — Restore Database from Dump

> Use when: database is corrupted, accidentally truncated, or migrated to a new server.

```bash
# 1. Stop CTFd to prevent writes during restore
docker compose stop ctfd

# 2. Drop and recreate the database
docker compose exec db mysql -u root -p<ROOT_PASSWORD> -e \
  "DROP DATABASE ctfd; CREATE DATABASE ctfd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Restore from the dump
gunzip < /backups/ctfd/db/ctfd_db_<TIMESTAMP>.sql.gz \
  | docker compose exec -T db mysql -u ctfd -p<PASSWORD> ctfd

# 4. Run migrations to ensure schema is current
docker compose exec ctfd flask db upgrade

# 5. Restart CTFd
docker compose start ctfd

# 6. Verify
curl http://localhost:8000/healthcheck
```

---

### Scenario B — Restore Uploaded Files

> Use when: upload volume is lost or mounted incorrectly.

```bash
# Stop CTFd
docker compose stop ctfd

# Clear and restore uploads
rm -rf /path/to/ccis_ctfd/.data/CTFd/uploads/*
tar -xzf /backups/ctfd/uploads/uploads_<TIMESTAMP>.tar.gz \
  -C /path/to/ccis_ctfd/.data/CTFd/uploads/

# Fix ownership
docker compose exec --user root ctfd chown -R 1001:1001 /var/uploads

# Restart
docker compose start ctfd
```

---

### Scenario C — Full Disaster Recovery (New Server)

> Use when: the entire host is lost. Starting fresh.

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ccis_ctfd.git
cd ccis_ctfd

# 2. Restore the secret key
cp /secured-storage/ctfd_secret_key .ctfd_secret_key

# 3. Start DB and cache first
docker compose up -d db cache

# Wait for DB to be ready (check logs)
docker compose logs -f db

# 4. Restore the database (see Scenario A, steps 2-3)

# 5. Restore uploaded files (see Scenario B, steps 3-4)

# 6. Start all services
docker compose up -d

# 7. Verify
curl http://localhost/healthcheck
```

---

### Scenario D — Restore from CTFd JSON Export

> Use when: you need to seed a fresh instance (useful for migration or reconstruction).

```bash
# Ensure CTFd is running and set up with a fresh database

# Import via admin panel:
# Admin → Config → Backup → Import
# Upload the .zip export file

# Or via CLI:
docker compose exec ctfd python import.py /path/to/export.zip
```

> **Warning:** Importing overwrites all existing data. Only use on a fresh or test instance.

---

## Backup Verification

Regularly test backup integrity — at minimum before and after each CTF event.

```bash
#!/bin/bash
# verify_backup.sh — tests that the latest DB backup can be restored

BACKUP_FILE=$(ls -t /backups/ctfd/db/*.sql.gz | head -1)
TEST_DB="ctfd_verify_$(date +%s)"

echo "Verifying: $BACKUP_FILE"

# Create a test database
docker compose exec db mysql -u root -p<ROOT_PASSWORD> \
  -e "CREATE DATABASE $TEST_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Restore into test database
gunzip < "$BACKUP_FILE" \
  | docker compose exec -T db mysql -u root -p<ROOT_PASSWORD> "$TEST_DB"

if [ $? -eq 0 ]; then
  echo "✅ Backup verification PASSED"
else
  echo "❌ Backup verification FAILED — alert on-call!"
fi

# Cleanup
docker compose exec db mysql -u root -p<ROOT_PASSWORD> \
  -e "DROP DATABASE $TEST_DB;"
```

Schedule weekly:

```cron
0 5 * * 0 /opt/scripts/verify_backup.sh >> /var/log/ctfd_backup.log 2>&1
```

---

## Backup Summary Table

| Item | Method | Frequency | Retention | Offsite |
|---|---|---|---|---|
| MariaDB dump | `mysqldump` → gzip | Daily 02:00 | 30 days | Yes (S3/rsync) |
| Uploaded files | `tar` → gzip | Daily 02:30 | 30 days | Yes |
| CTFd JSON export | `export.py` | Weekly | 90 days | Yes |
| Pre/post-event DB | Manual `mysqldump` | Per event | Indefinitely | Yes |
| Secret key | `cp` to secure storage | On change | Indefinitely | Yes (encrypted) |
| Backup verification | Restore test script | Weekly | — | — |
