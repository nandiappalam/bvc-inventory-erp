# TODO_purchase_erp_fix.md

## Scope
Implement FINAL ERP-grade Purchase Creation module for BVC ERP:
- Correct amount calc: **baseAmount = qty * rate** (never weight for money)
- Correct weight calc: **totalWeight = qty * per_unit_weight** (weight for inventory only)
- GST flow: **discount -> GST -> net -> additions/deductions -> final payable**
- GST split: intrastate/extrastate/exempted
- Purchase deduction system (transaction table + UI)
- Backend is source of truth (recompute totals)
- Preserve existing stock updates, lot-wise flow, and ledger posting structure

## Invariants / Mandatory Rules
1) Backend recomputes all monetary totals. Frontend is display-only.
2) Preserve existing stock/lot update logic.
3) Preserve existing ledger helper; only extend using computed totals.
4) Keep old DB column compatibility (temporary mapping):
   - base_amount -> gross_amount
   - disc_amount -> discount_total
   - tax_amount -> tax_total
   - grand_total -> final_amount
5) Store both percentage and computed amounts for audit.
6) Deductions/Additions apply AFTER GST using net_amount as base for percentage.
7) Round every money field with `Number(value.toFixed(2))`.

## Implementation Tracker
### Backend / DB
- [ ] 1) Extend `database/schema.sql` purchases header columns (ERP mapping)
- [ ] 2) Create new transaction table: `purchase_deductions`
- [ ] 3) Add non-destructive migration scripts if required

### Backend recomputation + persistence
- [ ] 4) Update `backend/routes/purchases.js` POST and PUT:
  - recompute item totals with qty×rate
  - compute taxable, GST, net
  - compute additions and deductions AFTER GST
  - compute SGST/CGST/IGST split
  - final_amount = net + addition_total - deduction_total
  - persist header totals + purchase_items + purchase_deductions rows
- [ ] 5) Update GET /api/purchases/:id to include purchase_deductions if needed

### Ledger
- [ ] 6) Extend `backend/utils/ledgerHelper.js` purchase ledger call input
  - ensure ledger helper uses final computed base/tax/net/discount
  - do NOT break existing ledger entries

### Frontend
- [ ] 7) Update `frontend/src/components/PurchaseCreationPage.jsx`:
  - add deductions grid (transaction-level)
  - bottom summary fields: qty/weight/gross/discount/taxable/SGST/CGST/IGST/net/additions/deductions/final
  - payload shaped as `{ header, items, deductions, summary }` but keep backend backward compatibility
- [ ] 8) Update/verify `frontend/src/components/entry/EntryItemsTable.jsx` columns for money vs weight

### Testing
- [ ] 9) Smoke test exact expected result from test case JSON
- [ ] 10) Manual UI verification for required flow

## Required Test Case (Exact Expected)
Payload file:
- `ERP_PURCHASE_SMOKE_TEST_CASE.json`

Expected:
- Total Weight: 2500
- Gross: 100000
- Discount: 2000
- Taxable: 98000
- GST: 4900
- SGST: 2450
- CGST: 2450
- IGST: 0
- Net: 102900
- Additions: 1500
- Deductions: 2058
- Final Payable: 102342

