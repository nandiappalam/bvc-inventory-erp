# BVC ERP - Multi-Company Data Isolation Architecture

## Isolation Model

BVC ERP implements **Multi-Tenant Schema and Database Isolation**:

### 1. PostgreSQL Schema Isolation
In PostgreSQL mode (`DATABASE_URL` set):
- **Master Schema (`public`)**:
  - `companies`: Company registrations, codes, database names
  - `database_registry`: Engine status, migration timestamps
  - `users`: User credentials, company binding, roles
  - `roles` & `permissions`: Granular role-based access control
  - `login_history`: Audit trail of user logins
- **Company Schemas (`company_1`, `company_2`, ...)**:
  - Every tenant receives a dedicated PostgreSQL schema.
  - All company transactions (`purchases`, `sales`, `stock`, `lots`, `ledgermaster`, `vouchers`, `compliance_documents`, etc.) live strictly within that schema.
  - Cross-tenant queries are blocked at the database engine level by dynamic `search_path` routing and `company_id` enforcement.

### 2. SQLite Database Isolation
In SQLite mode (Offline / Tauri / Local Dev):
- `master.db`: Global master registry and users.
- `company_1.db` (or legacy `bvc.db`): Company 1 records.
- `company_2.db`: Company 2 records.
- `company_N.db`: Dynamically initialized when Company N is created.

### 3. Automated On-Demand Company Provisioning
When a new company is created via `POST /api/companies`:
1. Master record is created in `companies` table.
2. Tenant schema (`company_N`) or SQLite database (`company_N.db`) is provisioned.
3. Clean ERP tables are created.
4. Default Chart of Accounts (Cash, Bank, Purchase, Sales, Tax) is seeded.
5. Default Tax Rates (GST 0%, 5%, 12%, 18%, 28%) are seeded.
6. Initial Financial Year is configured.
7. Admin credentials are registered.
8. Ready for immediate CRUD operations with 0 errors.
