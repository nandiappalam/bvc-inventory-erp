# TODO: Fix Purchase ERP calculation + 400 API error

## Information Gathered
- `backend/server.js` already uses `express.json()` before mounting routes.
- `backend/routes/purchases.js` currently contains a TEMP `POST /api/purchases` handler that returns `{ success: true, message: "Validation passed" }` **before** the insert logic.
- `frontend/src/components/entry/EntryItemsTable.jsx` has row calculation logic using `calculateRow(...)` and also attempts to guard amount/tax when `rate` is 0.
- `frontend/src/components/PurchaseCreation.jsx` builds payload with `date` and `supplier_id` and sends to `api('/purchases', ...)` with `Content-Type: application/json`.
- The environment indicates the user’s reported issues: wrong formula (base computed from weight * rate), default values not handled, and backend 400 "Date and supplier are required".

## Plan
1. **Fix row calculation to use reference logic exactly (qty × rate)**
   - Update `frontend/src/components/entry/EntryItemsTable.jsx`:
     - Ensure base amount uses `qty * rate`.
     - Ensure discount uses `baseAmount * (disc/100)`.
     - Ensure amount uses `baseAmount - discountAmount`.
     - Ensure tax uses `amount * (taxRate/100)`.
     - Ensure totalWeight uses `qty * per_unit_weight` (or `qty * weight` when `weight` is already total).
   - Add numeric safe parsing with `Number(x) || 0` so empty inputs don’t produce NaN or ghost values.

2. **Fix header totals aggregation (PurchaseCreation)**
   - Update `frontend/src/components/PurchaseCreation.jsx` totals calculation to match:
     - `totalAmount` = sum(row.amount)
     - `taxAmount` = sum(row.amount * (tax_rate/100))
     - `netAmount` = totalAmount + taxAmount
   - Ensure `amount` and `tax_amount` are both based on the corrected row formula.

3. **Fix backend 400 error**
   - In `backend/routes/purchases.js`:
     - Confirm the actual request body keys arriving at the route match what validation expects: `date` and `supplier_id`.
     - Temporarily (for debugging), enhance validation logs to show missing keys.
     - Remove/disable the TEMP success early-return once client payload is verified.

4. **Verification / Testing**
   - Run a quick local/manual test:
     - Load Purchase Creation page.
     - Enter qty, per unit weight, rate, disc, tax.
     - Confirm amount appears only when rate is entered.
     - Submit; confirm backend returns success and saves purchase.
   - Run basic backend endpoint test (if existing scripts are present).

## Dependent Files to be edited
- `frontend/src/components/entry/EntryItemsTable.jsx`
- `frontend/src/components/PurchaseCreation.jsx`
- `backend/routes/purchases.js`

## Followup Steps
- Start backend and frontend.
- Submit a sample purchase and confirm:
  - No huge/unreal amounts.
  - No 400 error.
  - Tax/Net calculations match reference logic.

