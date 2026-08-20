# Dynamic Config-Driven Master Module System — Implementation Plan

## Information Gathered

### 1. API Layer (`frontend/src/services/api.js`)
- `BASE_URL` uses `import.meta.env.VITE_API_URL || "http://localhost:5000"` (no trailing `/api`)
- **BUG:** It unconditionally prepends `/api` to every endpoint: `const url = \`${BASE_URL}/api\` + endpoint;`
- If any caller passes an endpoint already starting with `/api`, it produces `/api/api/...` → 404
- Error handling is present but lacks null-safety on JSON parse

### 2. SmartField (`frontend/src/components/master/SmartField.jsx`)
- Handles `text`, `number`, `textarea`, `select` correctly
- **BUG:** `masterSelect` fields in config have `type: 'masterSelect'`, but `SmartField` only renders `<select>` when `fieldType === 'select'`. `masterSelect` falls through to `<input type="masterSelect">` which is invalid HTML and never shows dropdown options
- `isMaster` correctly triggers API fetch via `useEffect`, but fetched options are never used because render path is wrong

### 3. Master Config (`frontend/src/utils/masterConfig.js`)
- Already contains full definitions for 15+ modules (sender, area, city, customer, supplier, item, item_group, ledger, ledger_group, etc.)
- Config has `sections` array with `title` and `fields`
- Task requires **flat form layout** — no card-style section dividers

### 4. Backend (`backend/routes/masters.js`)
- Generic CRUD already exists: `GET /:type`, `POST /:table`, `PUT /:table/:id`, `DELETE /:table/:id`
- Table aliases and field mappings are comprehensive
- `server.js` mounts router at `app.use('/api/masters', mastersRouter)`

### 5. Display Components (`*Display.jsx`)
- **BUG:** `SenderDisplay.jsx` (and likely others) checks `result.success` after calling `getMasters()`, but `getMasters()` already unwraps `result.data` and returns the raw array. This means `result.success` is `undefined` on arrays, so `setSenders` is NEVER called and tables always appear empty

### 6. App.jsx
- Contains 20+ hardcoded master routes (`/master/item-create`, `/master/item-display`, etc.)
- Need to collapse these into 2 dynamic routes

---

## Plan

### Step 1 — Fix API Layer (`frontend/src/services/api.js`)
- Sanitize endpoint: if it already starts with `/api`, do NOT prepend `/api`
- Otherwise prepend `/api` as before
- Add null-safety: `if (!res.ok)` returns safe fallback object
- Ensure `VITE_API_URL` works for Render production

### Step 2 — Fix SmartField (`frontend/src/components/master/SmartField.jsx`)
- Change render condition from `fieldType === 'select'` to `fieldType === 'select' || isMaster`
- This makes `masterSelect` fields render as actual `<select>` dropdowns with fetched API options
- Add safe null checks when mapping `options`

### Step 3 — Create DynamicMasterForm (`frontend/src/components/master/DynamicMasterForm.jsx`)
- **Props:** `configKey` (e.g., `"sender"`, `"area"`)
- **Behavior:**
  - Looks up config from `MASTER_CONFIG[configKey]`
  - Flattens all section fields into a single list (no visual section cards)
  - Initializes form state from `defaultValue` for each field
  - Renders each field via `<SmartField>` in a 2-column grid
  - On Submit: validates `required` fields, calls `createMaster(config.table, formData)`
  - On Success: shows message, resets form
  - On Error: shows error message
  - Supports Edit Mode via URL param `?edit=id` — fetches record and calls `updateMaster`
- **Null Safety:** Checks `res && res.success` before accessing data

### Step 4 — Create DynamicMasterDisplay (`frontend/src/components/master/DynamicMasterDisplay.jsx`)
- **Props:** `configKey`
- **Behavior:**
  - Looks up config
  - Auto-generates table columns from config fields (first 6 fields + status)
  - Calls `getMasters(configKeyPlural)` to fetch records
  - Renders via `<MasterTableLayout>`
  - **Edit:** navigates to `/master/${module}/create?edit=${row.id}`
  - **Delete:** calls `deleteMaster(config.table, row.id)` then refreshes
- **Null Safety:** `safeArray` wrapper, checks `Array.isArray(data)`

### Step 5 — Update `master.css`
- Remove card borders (`border`, `background`, `border-radius`) from `.form-section` for flat layout
- Keep grid spacing and label styling
- Ensure `.master-actions` stays clean

### Step 6 — Update `App.jsx`
- **Add** 2 dynamic routes:
  - `/master/:module/create` → `<DynamicMasterForm configKey={module} />`
  - `/master/:module/display` → `<DynamicMasterDisplay configKey={module} />`
- **Keep** old hardcoded routes for backward compatibility but make them render the dynamic components with the appropriate `configKey` (prevents breaking existing bookmarks/links)

### Step 7 — Update `masterservice.js`
- Ensure all functions have null-safety
- `getMasters` already unwraps — we keep this behavior and fix the **callers** instead (DynamicMasterDisplay will handle arrays correctly)

### Step 8 — Update `Navigation.jsx` (if menu links exist)
- Point master menu items to new routes like `/master/sender/create` and `/master/sender/display`

### Step 9 — Test & Validate
- Start backend (`cd backend && npm start`)
- Verify no `api/api` in browser Network tab
- Create a record in each master type via dynamic form
- Verify table displays records
- Verify Edit and Delete work

---

## Files to Edit / Create

| File | Action |
|------|--------|
| `frontend/src/services/api.js` | Edit — fix double `/api`, null safety |
| `frontend/src/components/master/SmartField.jsx` | Edit — fix `masterSelect` render |
| `frontend/src/components/master/DynamicMasterForm.jsx` | Create — reusable create/edit form |
| `frontend/src/components/master/DynamicMasterDisplay.jsx` | Create — reusable table display |
| `frontend/src/components/master/master.css` | Edit — flat layout styles |
| `frontend/src/App.jsx` | Edit — add dynamic routes |
| `frontend/src/components/master/index.js` | Edit — export new components |
| `frontend/src/services/masterservice.js` | Edit — add null safety helpers |

## Followup Steps
1. Start backend server (`cd backend && npm start`)
2. Open frontend (`cd frontend && npm run dev`)
3. Navigate to `/master/sender/create` and test creation
4. Navigate to `/master/sender/display` and verify table + delete
5. Check browser DevTools Network tab for any `404` or `/api/api` URLs
6. For Render deployment, set `VITE_API_URL=https://your-backend.onrender.com` in environment variables

---

**Do you approve this plan? Reply "yes" or suggest changes.**

