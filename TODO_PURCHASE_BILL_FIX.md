# Purchase Create - Remove Bill No Field - TODO Steps

**Status: [IN PROGRESS]**

## Plan:
Purchase create pages with bill_no:
1. frontend/src/components/PurchaseCreate.jsx - { name: 'bill_no', label: 'Bill No', type: 'text' } in topFrameFields[0]
2. frontend/src/components/PurchaseCreation.jsx - same

Main page: PurchaseCreate.jsx (open tab, matches pattern)

**Implementation Steps:**
- [ ] 1. Create this TODO_PURCHASE_BILL_FIX.md
- [x] 2. Edit frontend/src/components/PurchaseCreate.jsx - remove bill_no from topFrameFields, formData.bill_no
- [ ] 3. If needed, edit PurchaseCreation.jsx similarly
- [ ] 4. Refresh /entry/purchase-create - verify Bill No gone
- [ ] 5. Update TODO + attempt_completion

**Notes:**
- App.jsx routes /entry/purchase-create to PurchaseCreationPage (no bill_no, has inv_no)
- Safe: bill_no likely auto-generated backend
