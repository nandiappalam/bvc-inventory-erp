# TODO_PURCHASE_ERP_FINAL (Final Purchase ERP Structure)

- [x] Update `frontend/src/components/PurchaseCreationPage.jsx`

  - [ ] Remove `contact_person`, `area`, `phone`, `email`, `gst_no` from UI + state payload mapping
  - [ ] Add/maintain single address textarea field (`address`) and use it as combined autofill target
  - [ ] Update item grid columns to exact ERP structure (Lot No, Item, Wt, Qty, UOM, Total Wt, Rate, Disc%, Tax%, Amount, Action)
  - [ ] Implement formulas exactly:
    - [ ] `total_weight = qty × per_unit_weight`
    - [ ] `base_amount = total_weight × rate`
    - [ ] `disc_amount = base_amount × disc%`
    - [ ] `taxable = base_amount - disc_amount`
    - [ ] `tax_amount = taxable × tax%`
    - [ ] `net_amount = taxable + tax_amount`
  - [ ] Enforce LOT continuous generation rule for NEW rows only (no regeneration on UPDATE)
  - [ ] Replace deductions section with exact bottom-right ERP layout:
    - [ ] Columns: Deduction, %, Amt, Calculation
    - [ ] Dropdown load from `deduction_purchase` master
    - [ ] Implement GST effect ordering:
      - [ ] affect_gst=YES => deductions affect taxable BEFORE tax
      - [ ] affect_gst=NO => deductions apply AFTER tax
  - [ ] Implement bottom summary frame exactly:
    - [ ] Left: Qty, Weight, Amount
    - [ ] Center: Base, Tax, Discount, Net
    - [ ] Right: Grand Total (right aligned)
    - [ ] Grand total formula: `Grand Total = Net Amount + ADD deductions - LESS deductions`

- [ ] Update `frontend/src/components/entry/EntryTopFrame.jsx`
  - [ ] Modify supplier/customer autofill to fill ONLY `address` textarea with formatted text
  - [ ] Remove autofill to separate fields (contact_person/area/phone/email/gst_no)

- [ ] Update `frontend/src/components/entry/EntryItemsTable.jsx`
  - [ ] Ensure computed fields support required formulas (`total_wt`, `amount` etc.)
  - [ ] Preserve provided `lot_no` on edit (no new lot generation on UPDATE)
  - [ ] Add/maintain `UOM` column if derived from item master

- [ ] Update `frontend/src/components/PurchaseDisplay.jsx`
  - [ ] Adjust columns to exact ERP display column set
  - [ ] Ensure correct totals (deduction total + grand total + tax values)
  - [ ] Fix Update action to load full purchase including items+deductions+totals+preserve lots

- [ ] Update backend: `backend/routes/purchases_fixed.js`
  - [ ] Align create/update/list/get-by-id to ONE ERP field naming + formulas
  - [ ] LOT generation only for NEW rows; do not overwrite provided `lot_no` on update
  - [ ] Fix item base_amount formula to use `total_weight × rate`
  - [ ] Fix deduction storage schema mapping to match:
    - [ ] affect_gst
    - [ ] calculation_type (Percentage/Amount)
    - [ ] type (ADD/LESS)
  - [ ] Implement update to preserve `lot_no` and reload items+deductions totals

- [ ] Testing / smoke
  - [ ] Create purchase with 2+ items + multiple deductions mixing:
    - [ ] affect_gst YES & NO
    - [ ] ADD & LESS
  - [ ] Verify totals and LOT sequence:
    - [ ] LOT0001/LOT0002 continuous
    - [ ] update keeps same lot_no values

