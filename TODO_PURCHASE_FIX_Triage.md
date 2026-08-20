# TODO_PURCHASE_FIX_Triage

## Step 1 — Verify backend route existence
- Check `backend/routes/purchases.js` for `/purchase-list`.

## Step 2 — Verify server prefix mounting
- Confirm `backend/server.js` contains `app.use('/api/purchases', purchasesRouter)`.

## Step 3 — Verify frontend API call path
- Ensure Purchase list UI calls `/api/purchases/purchase-list`.

## Step 4 — Verify delete/update calls are not causing extra “Purchase not found”
- Ensure list page does not call `/api/purchases/:id` unless an action (delete/update) is invoked.

## Step 5 — Test
- Open `http://localhost:5000/api/purchases/purchase-list`.
- Confirm UI no longer shows 404.

