# BVC Inventory ERP — API Documentation

## Overview

The BVC Inventory ERP API provides a RESTful interface for managing inventory, purchases, sales, and company data. All protected endpoints require JWT authentication.

## Authentication

### POST /api/auth/login

Login with username, password, and company_id.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123",
  "company_id": 1
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "name": "Admin User",
    "role": "Admin",
    "company_id": 1,
    "company_name": "BVC Company"
  },
  "company": {
    "id": 1,
    "name": "BVC Company",
    "company_code": "BVC001",
    "address": "123 Main Street",
    "gst_number": "27AABCV1234A1Z5",
    "contact": "9876543210",
    "email": "info@bvc.com"
  },
  "permissions": [],
  "isAdmin": true
}
```

**Error Responses:**
- `401 AUTHENTICATION_REQUIRED` — No token provided
- `401 INVALID_SESSION` — Token expired or invalid
- `401 INVALID_CREDENTIALS` — Wrong username/password
- `403 COMPANY_ACCESS_DENIED` — User doesn't belong to company
- `403 ACCOUNT_INACTIVE` — User account is inactive

### POST /api/auth/logout

Logout and record logout time.

**Request:**
```json
{
  "login_history_id": 123
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

## Company Context

After login, the JWT token carries the `companyId`. All subsequent API requests must include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

The backend derives `company_id` from the JWT token — **never trust `company_id` from the frontend**.

## Companies

### GET /api/companies

List all companies. (Public — no auth required)

**Response (200):**
```json
[
  {
    "id": 1,
    "company_code": "BVC001",
    "name": "BVC Company",
    "address": "123 Main Street",
    "gst_number": "27AABCV1234A1Z5",
    "contact": "9876543210",
    "email": "info@bvc.com",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### GET /api/companies/:id

Get a single company by ID. (Public)

### POST /api/companies

Create a new company. New company starts with clean/fresh business data.

**Request:**
```json
{
  "name": "New Company",
  "address": "456 New Street",
  "gst_number": "27AABCV9999A1Z5",
  "contact": "9876543210",
  "email": "info@newcompany.com"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Company created successfully!",
  "id": 2,
  "company_code": "BVC002"
}
```

### PUT /api/companies/:id

Update a company.

### DELETE /api/companies/:id

Delete a company.

## Health Check

### GET /api/health

Check application and database health. (Public)

**Response (200):**
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected",
  "databaseType": "sqlite",
  "version": "1.0.0",
  "environment": "development",
  "requestId": "REQ-1234567890-ABCD"
}
```

### GET /api/health/database

Check database connectivity only. (Public)

## Masters

### GET /api/masters/:type

Get all active records for a master type. Company-scoped.

**Supported types:** `items`, `item`, `item_group`, `item_groups`, `customer`, `customers`, `supplier`, `suppliers`, `godown`, `godowns`, `area`, `areas`, `city`, `cities`, `transport`, `transports`, `flour_mill`, `flour_mills`, `papad_company`, `papad_companies`, `weight`, `weights`, `ledger_group`, `ledger_groups`, `ledger`, `ledgers`, `tax`, `taxes`, `tax_master`, `employee`, `employees`, `consignee`, `consignees`, `sender`, `senders`, `ptrans`, `person_master`, `deduction_sale`, `deduction_sales`, `deduction_purchase`

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Urad Gotta", "item_name": "Urad Gotta", ... }
  ]
}
```

### GET /api/masters/all/:table

Get all records (including inactive) for a master table. Company-scoped.

### GET /api/masters/record/:table/:id

Get a single record by ID. Company-scoped.

### POST /api/masters/:table

Create a new master record. Company-scoped.

### PUT /api/masters/:table/:id

Update a master record. Company-scoped.

### DELETE /api/masters/:table/:id

Delete a master record. Company-scoped.

### GET /api/masters/lots/next

Get the next sequential lot number.

**Response (200):**
```json
{
  "lot_no": "LOT0007"
}
```

## Financial Years

### GET /api/financial-years/current

Get the current active financial year for the authenticated company.

**Response (200):**
```json
{
  "id": 1,
  "company_id": 1,
  "financial_year": "2026-2027",
  "year_name": "2026-2027",
  "start_date": "2026-04-01",
  "end_date": "2027-03-31",
  "status": "Active",
  "is_current": 1,
  "is_active": 1
}
```

### GET /api/financial-years

List all financial years for the authenticated company.

### POST /api/financial-years

Create a new financial year. Company-scoped.

### PUT /api/financial-years/:id

Update a financial year. Company-scoped.

### POST /api/financial-years/:id/set-current

Set a financial year as current. Company-scoped.

### POST /api/financial-years/:id/close

Close a financial year. Company-scoped.

### DELETE /api/financial-years/:id

Delete a financial year. Company-scoped.

## Users

### POST /api/auth/users

Create a new user.

### GET /api/auth/users/:companyId

List users for a company.

### GET /api/auth/users

List all users.

### GET /api/auth/users/:companyId/:userId

Get a single user with permissions.

### PUT /api/auth/users/:userId

Update a user.

### DELETE /api/auth/users/:userId

Delete a user.

### POST /api/auth/change-password

Change user password.

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | No authentication token provided |
| `INVALID_SESSION` | 401 | Token is expired or invalid |
| `INVALID_CREDENTIALS` | 401 | Wrong username or password |
| `COMPANY_ACCESS_DENIED` | 403 | User doesn't belong to the requested company |
| `ACCOUNT_INACTIVE` | 403 | User account is inactive |
| `RECORD_NOT_FOUND` | 404 | Requested resource not found |
| `DUPLICATE_RECORD` | 409 | Record already exists |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |
| `DATABASE_ERROR` | 503 | Database connection or query error |
| `NETWORK_ERROR` | 0 | Network failure (client-side) |
| `ROUTE_NOT_FOUND` | 404 | API route not found |

## Request/Response Format

All API responses follow a standardized format:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

**Error:**
```json
{
  "success": false,
  "errorCode": "ERROR_CODE",
  "message": "Human-readable error message",
  "requestId": "REQ-1234567890-ABCD"
}
```

## Company Isolation

Every company-owned table includes a `company_id` column. All queries are automatically scoped to the authenticated user's company. Company B can never access Company A's data, even if they guess the record ID.

## Deployment

- **GitHub** contains application source code
- **Render PostgreSQL** contains business data
- **Render deployment** replaces application code, not business data
- **Migrations** are safe and non-destructive
- **Health check**: `GET /api/health`
