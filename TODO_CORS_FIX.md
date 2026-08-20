# CORS Fix TODO

## Problem
Frontend running on `http://localhost:5173` is hardcoded to call the Render production backend directly (`https://bvc-inventory-ilakkiya.onrender.com`), causing browser CORS blocks.

## Steps

- [x] 1. Update `frontend/src/services/api.js` — use relative URLs in dev, Render URL only in production
- [x] 2. Update `frontend/src/utils/api.js` — same environment-aware BASE_URL
- [x] 3. Update `backend/server.js` — explicit CORS config with localhost & Render origins
- [x] 4. Verify `frontend/vite.config.js` proxy covers `/api`
- [x] 5. Fix `backend/server.js` PORT default to 10000 for Render
- [x] 6. Add process-level crash protection (`uncaughtException`, `unhandledRejection`)
- [x] 7. Improve global error handler with detailed logging
- [x] 8. Fix `backend/routes/masters.js` dangerous raw-SQL POST route — validate table exists before insert
- [x] 9. Add `asyncHandler` wrapper to prevent async route crashes
- [ ] 10. Test locally & redeploy to Render

## Files to Edit
- `frontend/src/services/api.js`
- `frontend/src/utils/api.js`
- `backend/server.js`

