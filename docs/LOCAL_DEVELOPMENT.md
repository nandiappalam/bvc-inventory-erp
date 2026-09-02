# BVC ERP - Local Development Guide

## Quick Start

### 1. Prerequisites
- Node.js (v18 or v20+)
- npm

### 2. Installation
```bash
npm install
```

### 3. Environment Modes

#### Option A: Local SQLite Mode (Default / Zero Config)
No additional database setup is needed. When `DATABASE_URL` is omitted, BVC ERP automatically initializes isolated SQLite databases inside the `database/` folder.

```bash
npm run dev
```

#### Option B: Neon PostgreSQL Mode (Cloud / Staging Testing)
To run local development against Neon PostgreSQL:

1. Create a `.env` file in the root or `backend/` directory:
```env
DATABASE_URL=postgresql://user:pass@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require
NODE_ENV=development
PORT=3000
JWT_SECRET=bvc-erp-secure-jwt-secret-key-2026
```

2. Run schema initialization:
```bash
npm run db:init-pg # or node backend/scripts/init-postgres-schema.js
```

3. Start development server:
```bash
npm run dev
```

### 4. Default Credentials
- **Company**: BVC Exports Pvt Ltd (Company 1)
- **Admin**: `admin` / `admin123`
- **Staff**: `staff` / `staff123`
