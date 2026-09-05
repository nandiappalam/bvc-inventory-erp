# BVC ERP - Render Web Service Deployment Guide

## Architecture Summary

```text
GitHub Repo ──► Render Free Web Service (Node/Express API + Built React SPA)
                        │
                  DATABASE_URL (SSL)
                        ▼
               Neon PostgreSQL Database (External Cloud DB)
```

## Step-by-Step Render Deployment

### 1. Set Up Neon PostgreSQL
1. Sign up at [Neon.tech](https://neon.tech) and create a project (e.g. `bvc-erp-production`).
2. Copy the connection string (with pooled or direct connection):
   `postgres://username:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require`

### 2. Configure Render Web Service
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Set configuration parameters:
   - **Name**: `bvc-inventory-erp`
   - **Environment**: `Node`
   - **Region**: Closest to your users (e.g., `Singapore`, `Frankfurt`, `Oregon`)
   - **Branch**: `main`
   - **Build Command**:
     ```bash
     npm run build
     ```
   - **Start Command**:
     ```bash
     node backend/server.js
     ```

### 3. Configure Environment Variables in Render
Under the **Environment** tab on Render, add:

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Production mode |
| `PORT` | `3000` | Render standard port |
| `DATABASE_URL` | `postgresql://...` | Neon connection string with SSL |
| `JWT_SECRET` | `your-secure-random-key` | Token signing secret |

### 4. Zero-Downtime Re-deploys
- Render redeploys and container restarts will connect to Neon PostgreSQL instantly with zero data loss.
- Master schemas and tenant schemas are auto-verified on startup via `migrationRunner.js`.

### 5. Health Check URL
Render Health Check Path: `/api/health` or `/api/system/health`
