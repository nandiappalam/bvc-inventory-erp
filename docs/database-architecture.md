# BVC Inventory ERP — Centralized Multi-Company Database Architecture

This document describes the unified multi-tenant database architecture for **BVC Inventory ERP**, connecting **Tauri Desktop**, **Local Web Browser**, and **Render Cloud Production** to a centralized **Neon PostgreSQL** database.

---

## 1. Architectural Topology

```text
                               ┌─────────────────────────────┐
                               │       Neon PostgreSQL       │
                               │   Centralized Cloud DB      │
                               └──────────────┬──────────────┘
                                              │
                         ┌────────────────────┼────────────────────┐
                         │                    │                    │
                         ▼                    ▼                    ▼
               ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
               │  Tauri Desktop   │ │  Local Web Dev   │ │   Render Cloud   │
               │ (Node/HTTP API)  │ │ (Node/HTTP API)  │ │ (Node HTTPS API) │
               └─────────┬────────┘ └─────────┬────────┘ └─────────┬────────┘
                         │                    │                    │
                         └────────────────────┼────────────────────┘
                                              │
                                    Same PostgreSQL Database
                                    Same Multi-Company Isolation
                                    Same Data & User Accounts
```

---

## 2. Multi-Company Schema Isolation

BVC Inventory ERP uses PostgreSQL **Schemas** for company-level multi-tenancy:

* **`public` Schema** (Master / Global Data):
  * `companies`: Global registry of organizations
  * `users`: Authentication records, password hashes, and company assignments
  * `database_registry`: Registered database schemas and version metadata
  * `roles`, `permissions`, `user_permissions`: Access control definitions
  * `login_history`: Auditing log of user sessions

* **`company_<id>` Schemas** (Company-Specific Isolated Data):
  * e.g., `company_1`, `company_2`, `company_N`
  * Contains all company-isolated business tables:
    * `item_master`, `item_groups`, `godown_master`, `stock`, `stock_lots`
    * `purchases`, `purchase_items`, `purchase_returns`, `purchase_requests`, `purchase_orders`
    * `sales`, `sales_items`, `sales_return`, `sales_export_orders`
    * `grains`, `grain_input_items`, `grain_output_items`, `flour_out`, `papad_in`
    * `ledgermaster`, `ledgergroupmaster`, `voucher`, `voucher_entry`, `ledger_entries`
    * `tax_master`, `financial_years`, `customer_master`, `supplier_master`
    * `compliance_documents`, `compliance_production_records`, `compliance_cleaning_records`

---

## 3. Security & Context Resolution

1. **Authentication:**
   * Login produces a signed JWT containing `userId`, `username`, `role`, and `companyId`.
2. **Context Derivation:**
   * Incoming requests pass through `companyContextMiddleware`.
   * The backend validates the JWT and binds the request execution context to `AsyncLocalStorage`.
   * Schema switching is managed on server-side connections via `SET search_path TO company_<id>, public;`.
3. **Zero Frontend Credential Exposure:**
   * `DATABASE_URL` is **strictly private to the server-side environment**.
   * Neither React nor the Tauri frontend contains database credentials. All operations go via standard HTTP/HTTPS REST API endpoints (`/api/...`).

---

## 4. Local Development in VS Code & Windows

### Step 1: Extract & Open
1. Extract the project ZIP or clone the repository into your development directory.
2. Open the folder in **VS Code**.

### Step 2: Configure Environment Variables
Create a `.env` file in the project root (or copy from `.env.example`):
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@ep-sample-pooler.neon.tech/neondb?sslmode=require
JWT_SECRET=your-secure-jwt-secret-key
```

### Step 3: Install & Start
```bash
# 1. Install dependencies
npm install

# 2. Build or start frontend & backend
npm run dev
# or start server directly:
npm start
```
The application will launch on `http://localhost:3000`.

---

## 5. Tauri Desktop Application Setup

1. For desktop mode, Tauri executes against the local or remote Node/Express API endpoint.
2. Configure `VITE_API_URL` (or default to `/api` or `http://localhost:3000/api`).
3. Build the desktop binary:
```bash
npm run tauri build
```

---

## 6. Render Production Deployment

1. **Repository:** Push your repository to GitHub / GitLab.
2. **Create Web Service on Render:**
   * **Runtime:** Node.js
   * **Build Command:** `npm run build`
   * **Start Command:** `node backend/server.js`
3. **Environment Variables on Render Dashboard:**
   * `DATABASE_URL`: Your Neon PostgreSQL connection string (`postgresql://...@...neon.tech/neondb?sslmode=require`)
   * `NODE_ENV`: `production`
   * `JWT_SECRET`: A high-entropy secret key
   * `PORT`: `3000` (or leave default, Render sets `PORT` automatically)
4. Deploy and verify `/api/health`.

---

## 7. Migration & Backup Management

* **Auto-Migrations:**
  * When the backend boots, `migrationRunner.js` automatically verifies and provisions `public` master tables and all active `company_<id>` tenant schemas.
* **Backup & Export:**
  * Endpoint: `GET /api/db/backup`
  * When connected to PostgreSQL, exports tenant tables as a clean JSON backup file.
  * When in SQLite mode, streams the `.db` file with WAL truncation.
* **Restore:**
  * Endpoint: `POST /api/db/restore` (accepts database backup file).
