# Purchase API - fix SQLite error `no such column: im.name`

## Goal
Fix `GET /api/purchases/purchase-list` returning 500 with SQLite error: `SQLITE_ERROR: no such column: im.name`.

## Current status
- `backend/server.js` mounts `./routes/purchases_fixed` under `/api/purchases`.
- Frontend calls `/api/purchases/purchase-list`.
- Error indicates the running SQL query still references `im.name`.

## Work done
- Verified `backend/routes/purchases.js` had SQL join referencing `im.name` in some earlier revision.
- Attempted edits to `backend/routes/purchases.js` to remove invalid references.
- Accidentally introduced syntax errors into `backend/routes/purchases.js` and must repair/restore.

## Next steps (to be executed)
1. Restore `backend/routes/purchases.js` to a syntactically valid state (either revert from last known good revision or replace with `backend/routes/purchases_fixed.js` logic where appropriate).
2. Ensure `backend/routes/purchases_fixed.js` `purchase-list` query does **not** reference `im.name`.
3. Restart backend and validate `GET /api/purchases/purchase-list` returns 200.

