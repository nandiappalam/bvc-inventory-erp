# Purchase Create - Supplier Auto-fill Address + Layout Fix

**Status: [COMPLETED]**


**Information Gathered:**
- Current PurchaseCreate.jsx (visible): topFrameFields Column 1: date/pay_type, Column 2: supplier/inv_no/inv_date, Column 3: godown/address/phone/lorry/tax_type/tax_percent
- EntryTopFrame.jsx: MasterFieldWrapper has supplier auto-fill logic (address, phone_res/off, mobile, gst_no)
- Layout is already beside (3-col grid, supplier/address in different columns but visible).
- App.jsx /entry/purchase-create → PurchaseCreationPage (different, has supplier/address auto?).

**Plan:**
- frontend/src/components/PurchaseCreate.jsx:
  1. Reorder topFrameFields: put address next to supplier (same column or adjacent).
  2. Ensure auto-fill triggers (already does via masterType='suppliers').
- Test supplier select → address autofill.

**Dependent Files:** EntryTopFrame.jsx (auto-fill logic OK)

**Followup steps:**
- Save, refresh /entry/purchase-create
- Select supplier → verify address fills beside it
- No backend changes needed.

Confirm plan? Which Purchase page exactly (PurchaseCreate or PurchaseCreationPage)? Proceed?

