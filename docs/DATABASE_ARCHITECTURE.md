# BVC ERP - Database Architecture (PostgreSQL & SQLite Dual Engine)

## Overview

BVC ERP features a robust **Dual-Engine Multi-Tenant Database Architecture** designed for high-availability cloud deployments (Render Web Service + External Neon PostgreSQL) as well as offline/desktop environments (Tauri + SQLite).

```text
                                  BVC INVENTORY ERP
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                   ONLINE WEB                            DESKTOP
                  (React/Vite)                        (Tauri .exe)
                        │                                   │
                        ▼                                   ▼
             ┌─────────────────────┐             ┌─────────────────────┐
             │ Render Web Service  │             │ Local SQLite Engine │
             │ Node + Express API  │             │ (Multi-tenant DBs)  │
             └──────────┬──────────┘             └─────────────────────┘
                        │
                  DATABASE_URL (SSL)
                        │
                        ▼
             ┌─────────────────────┐
             │  Neon PostgreSQL    │
             │ (External / Cloud)  │
             └──────────┬──────────┘
                        │
             ┌──────────┴──────────┐
             │                     │
       Company 1 (BVC)       Company 2 (Papad)
       Isolated Schema       Isolated Schema
```

## Key Architectural Principles

1. **Independent Database Hosting**:
   - Render hosts the stateless Node.js/Express backend API and React frontend.
   - Neon provides managed PostgreSQL with serverless auto-scaling and zero reliance on Render's ephemeral disk.
   - Moving or restarting the Render service never risks data loss.

2. **Multi-Company Data Isolation**:
   - Each company has its own isolated schema (`company_1`, `company_2`, etc.) in PostgreSQL, or dedicated SQLite database (`company_1.db`, `company_2.db`).
   - Master entities (Companies, Users, Roles, Database Registry, Login History) reside in the master schema/database.
   - Creating a new company via the UI automatically provisions all ERP business tables, default chart of accounts, tax masters, and financial years without manual intervention.

3. **Transparent Query Compatibility**:
   - The unified database adapter (`backend/config/database.js`) transparently handles both PostgreSQL and SQLite dialects.
   - Positional parameters (`?` vs `$1, $2`), `INSERT OR IGNORE` vs `ON CONFLICT DO NOTHING`, autoincrement IDs, and timestamps are normalized automatically.

4. **Zero-Crash Resilient Error Handling**:
   - Global exception handling, self-healing connections, and graceful auth fallbacks prevent unhandled 500/401/403 errors.
