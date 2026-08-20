# Autofill Fix - EntryTopFrame Master Select

Status: Frontend code correct, cache issue

## Steps
- [ ] 1. Stop Vite dev server (Ctrl+C)
- [ ] 2. Delete frontend/node_modules/.vite folder if exists
- [ ] 3. npm run dev (restart server)
- [ ] 4. Browser DevTools > Application > Storage > Clear site data
- [ ] 5. Hard reload (Ctrl+Shift+R)
- [ ] 6. Test: PurchaseCreate > Select Supplier ABC Traders (id:17)
  Expected logs:
  ```
  🔧 Autofill table for suppliers: supplier_master
  🌐 FINAL URL: /api/masters/record/supplier_master/17
  📋 Record: {id:17, name:'ABC Traders', address1:'...', phone_res:'...'}
  ```
- [ ] 7. Verify address/phone fields autofill in form

## Backend Verified ✅
- /api/masters/suppliers → 24 records OK
- /api/masters/godowns → 2 records OK
- /api/masters/record/supplier_master/:id → SELECT * FROM supplier_master WHERE id=?

## Code Status ✅
- EntryTopFrame.jsx line 195: `await api(...)` (no api2)
- masterTableMap: 'suppliers' → 'supplier_master' correct

If still fails after restart, check browser console for bundle source (F12 Sources tab → EntryTopFrame.jsx → search api2)

