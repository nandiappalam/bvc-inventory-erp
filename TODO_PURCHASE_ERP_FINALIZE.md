# TODO: Purchase ERP totals + deductions layout fix

- [ ] Update `frontend/src/components/PurchaseCreation.jsx`
  - [ ] Replace current `layout-row` section with 2-column final ERP layout:
    - [ ] Left: Deduction table (Deduction, %, Amt, Calculation = ADD/LESS)
    - [ ] Right: ERP totals summary (Total Qty/Weight, Base Amount, Discount, Taxable, Tax (GST%), Net Total, Deductions, Grand Total)
  - [ ] Remove old/duplicated totals UI blocks and old totals rows (Qty/Weight/Amount zeros)
  - [ ] Fix `erpTotals` calculation to canonical flow:
    - Base = Qty × Rate
    - Discount = Base × Disc%
    - Taxable = Base − Discount
    - Tax = Taxable × GST%
    - Net Total = Taxable + Tax
  - [ ] Grand Total logic:
    - Grand Total = Net Total + (sum ADD deductions) − (sum LESS deductions)
  - [ ] Deduction total:
    - deductionTotal = Σ(ADD amount) − Σ(LESS amount)
  - [ ] Deduction controls:
    - [ ] Deduction select
    - [ ] % input
    - [ ] Amt input
    - [ ] Calculation select ADD/LESS
  - [ ] Update handlers so edits instantly recalc totals
  - [ ] Ensure existing items/lot behavior remains: lot auto-generate only on Add Row, not on edit.
  - [ ] Keep backend payload compatible with existing schema aliases (qty/rate/base_amount/disc_percent/disc_amount/tax_percent/tax_amount/netAmount/deduction_amount/grandTotal as needed).


