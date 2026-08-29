# BVC ERP - Database Backup & Disaster Recovery Guide

## Backup Strategy

### 1. External PostgreSQL (Neon / Managed Cloud)
- **Point-in-Time Restore (PITR)**: Neon includes automatic WAL branching and instant point-in-time recovery.
- **Manual Logical Backup (pg_dump)**:
  ```bash
  pg_dump "$DATABASE_URL" -Fc -f bvc_backup_$(date +%Y%m%d_%H%M%S).dump
  ```
- **Schema-only Backup**:
  ```bash
  pg_dump "$DATABASE_URL" --schema-only -f bvc_schema_backup.sql
  ```
- **Single Company Restore**:
  ```bash
  pg_restore -d "$DATABASE_URL" --schema=company_1 bvc_backup.dump
  ```

### 2. Local SQLite Backup
- SQLite databases are automatically backed up prior to any schema modification or restore operation in `database/backups/`.
- The in-app Database Manager (`/api/db/backup`) allows downloading full SQL/DB snapshots on demand.
