# BVC ERP - PostgreSQL Migration Guide

## Migration Strategy

This guide details how to migrate existing SQLite databases (`master.db`, `bvc.db`, `company_*.db`) into external Neon PostgreSQL.

## Prerequisites

1. Create a PostgreSQL project on [Neon.tech](https://neon.tech) (or Supabase / RDS).
2. Obtain your PostgreSQL connection string:
   ```text
   postgresql://username:password@ep-sample-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Set the environment variable `DATABASE_URL` in your `.env` or Render environment.

## Step-by-Step Migration Execution

### Step 1: Initialize PostgreSQL Schemas & Tables

Run the automated PostgreSQL schema setup script:
```bash
DATABASE_URL="your-neon-database-url" node backend/scripts/init-postgres-schema.js
```
This script creates:
- Master tables: `companies`, `database_registry`, `users`, `roles`, `permissions`, `login_history`, `_master_migrations`
- Dedicated company schemas: `company_1`, `company_2`, etc.
- All ERP transaction and master tables inside each schema.

### Step 2: Migrate SQLite Data to PostgreSQL

Run the data migration script:
```bash
DATABASE_URL="your-neon-database-url" node backend/scripts/migrate-sqlite-to-postgres.js
```
The script executes the following workflow:
1. Connects to the local SQLite database files (`database/master.db`, `database/bvc.db`, `database/company_*.db`).
2. Reads records in dependency order (Masters -> Items/Parties -> Purchases/Sales -> Stock/Ledgers -> Documents).
3. Transforms SQLite data types and inserts them into PostgreSQL with parameter binding.
4. Updates sequence counters (`setval`) for all serial primary keys.

### Step 3: Validate Migration Integrity

Verify row counts and data integrity between SQLite and PostgreSQL:
```bash
DATABASE_URL="your-neon-database-url" node backend/scripts/validate-migration.js
```
Validation checklist:
- [x] Company master records match
- [x] Users and credentials match
- [x] Items, Suppliers, Customers match
- [x] Purchases and Sales transactions match
- [x] Stock lots and Ledger entries match
- [x] Compliance and Document registers match

### Step 4: Verification in ERP UI

1. Start the backend with `DATABASE_URL` set.
2. Visit `/api/system/health` to confirm `engine: "PostgreSQL"`.
3. Log in with admin credentials.
4. Perform sample CRUD operations across Purchases, Sales, Masters, Stock, and Reports.
