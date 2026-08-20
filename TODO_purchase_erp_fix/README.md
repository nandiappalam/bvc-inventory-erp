# TODO_purchase_erp_fix

## Step 1 (Backend)
- Update `backend/routes/purchases_fixed.js` route `/purchase-list`
  - Replace SQL SELECT with ERP-safe join + correct aliases:
    - item_name, weight, total_weight, base_amount, disc_amount, tax_amount, grand_total
  - Join `item_master im` for `im.name AS item_name`
  - Add dynamic filters via query params:
    - from_date, to_date, supplier, item, lot_no

## Step 2 (Frontend)
- Update `frontend/src/components/PurchaseDisplay.jsx`
  - Align `columns` keys EXACTLY with backend payload:
    - item_name, weight, total_weight, base_amount, disc_amount, tax_amount, grand_total
  - Update print mapping to use grand_total.

## Step 3 (Next, after list works)
- Fix Purchase create/update payload so backend receives `item_id` (not `item_name: "5"`).

