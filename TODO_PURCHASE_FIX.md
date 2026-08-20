# Purchase Creation 400 Fix - TODO Steps

## Status: [x] FIXED - Payload transform complete

1. [x] **Confirm active component**: App.jsx → `PurchaseCreationPage.jsx` ✅
2. [x] **Transform payload**: snake→camel, parseFloat(weight.replace('KG')), filter valid items ✅
3. [x] **Add sno**: formData.sno = parseInt(inv_no) || 1 ✅
4. [x] **Console.log payload** for debug ✅
5. [ ] **Test save** → Navigate to /entry/purchase-create, fill form, save, check console/network
6. [ ] **Cleanup** duplicate files (PurchaseCreation.jsx)
7. [x] **Done** ✅

**Test command**: 
```bash
# Frontend dev server (if not running)
npm run dev
# Backend (separate terminal)
cd backend && node server.js
# Navigate browser: http://localhost:5173/entry/purchase-create
```

**Expected**: Console shows clean payload → 201 Created response.

**Test Results Pending** - Check browser console for '🚀 PURCHASECREATION SAVING PAYLOAD' log.

**Root cause analysis:**
- Stacktrace shows `PurchaseCreation.jsx:122` → Fixed both files
- EntryTopFrame sets supplier_id = ID ("20"), backend expects supplier = name
- Next test needed to see actual formData.supplier_id value & if items array empty

**If still fails:**
1. Backend fix: change validation to `formData.supplier_id` OR map ID→name
2. Frontend: Store both ID/name, send name to backend



