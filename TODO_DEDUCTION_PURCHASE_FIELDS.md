# Deduction Purchase Fields Addition - TODO

## Task
Add the following fields to the Deduction Purchase create page:
- Affect Cost of Goods: "Yes and No" option
- Type: "Add and Less"
- Debit side adjust: "Supplier, A/c Head and None"
- Account Head
- Credit Side Adjust: "Supplier, A/c Head and None"
- Deduction Type: "Add and Less"
- Deduction Calculation type: "Percentage and Amount"
- Deduction Value
- Status

## Plan

### Step 1: Update Frontend Config
- **File:** `frontend/src/utils/masterConfig.js`
- Change `credit_adjust` from `type: 'text'` to `type: 'select'` with options: Supplier, A/c Head, None (default: 'None')
- Add `deduction_value` number field to Calculation section

### Step 2: Update Backend Fields
- **File:** `backend/routes/masters.js`
- Append `'deduction_value'` to `deduction_purchase` fields array

### Step 3: Update Database Schema
- **File:** `database/schema.sql`
- Add `deduction_value REAL DEFAULT 0` to `deduction_purchase` table

### Step 4: Update Auto-Migration
- **File:** `backend/autoMigrate.js`
- Add safeAddColumn for `deduction_value`

### Step 5: Update Standalone Migration
- **File:** `database/migrate_deduction_purchase_fields.js`
- Add `deduction_value` column to migration

## Progress
- [x] Step 1: Frontend Config
- [x] Step 2: Backend Fields
- [x] Step 3: Database Schema
- [x] Step 4: Auto-Migration
- [x] Step 5: Standalone Migration

