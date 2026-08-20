# Dynamic Master System — Implementation TODO

## Step 1: Fix API Layer (CRITICAL) ✅
- [x] Fix `frontend/src/services/api.js` — remove /api/api duplication, use VITE_API_URL
- [x] Fix `frontend/src/utils/api.js` — same fix for consistency

## Step 2: Fix SmartField ✅
- [x] Fix `frontend/src/components/master/SmartField.jsx` — support `masterSelect` as dropdown

## Step 3: Fix Existing Modules ✅
- [x] Fix `SenderDisplay.jsx` — remove `.success` check on array return
- [x] Fix ALL other Display components (16 files) — replaced with `DynamicMasterDisplay` wrappers
- [x] Fix `GodownDisplay.jsx` — replaced with wrapper

## Step 4: Build Dynamic System ✅
- [x] Create `DynamicMasterForm.jsx`
- [x] Create `DynamicMasterDisplay.jsx`
- [x] Update `master.css` for flat layout
- [x] Update `App.jsx` with dynamic routes `/master/:module/create` and `/master/:module/display`
- [x] Update `master/index.js` exports
- [x] Update `masterservice.js` with null safety + `api` re-export

## Step 5: Testing
- [ ] Start backend (`cd backend && npm start`)
- [ ] Start frontend (`cd frontend && npm run dev`)
- [ ] Navigate to `/master/sender/create` — test creation
- [ ] Navigate to `/master/sender/display` — verify table loads
- [ ] Test Edit button → should navigate to `/master/sender/create?edit={id}`
- [ ] Test Delete button → should refresh table
- [ ] Open browser DevTools Network tab → verify NO `/api/api` URLs
- [ ] For Render deployment: set `VITE_API_URL=https://your-backend.onrender.com`

## Deployment Notes
- Local dev: `VITE_API_URL` defaults to `http://localhost:5000`
- Render: Set `VITE_API_URL=https://your-backend.onrender.com` in environment variables
- BASE_URL must NOT contain `/api` — it is prepended per-request

