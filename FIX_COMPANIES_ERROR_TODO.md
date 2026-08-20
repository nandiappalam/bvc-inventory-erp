# Fix getCompanies Export Error - Unified Masters API Migration

## Steps:
- [x] 1. Update `frontend/src/components/CompanySelection.jsx`: 
  - Import `{ getMasters } from '../services/masterservice.js'`
  - Replace `getCompanies()` with `getMasters('papad_companies')`
- [x] 2. Clean `frontend/src/utils/api.js`:\n  - Remove all specific exports: getCustomers, getSuppliers, getItems, getCompanies, getLedgers, etc.\n  - Remove commented legacy/Tauri code.\n  - Keep only essential: login, executeQuery, executeStatement, getUsers
- [ ] 3. Clear Vite cache and restart dev server:
  - `cd frontend && rmdir /s /q node_modules\.vite` (Windows)
  - `npm run dev`
- [ ] 4. Test: Load CompanySelection page, verify companies load from papad_companies, no import error.
- [ ] 5. Check backend /api/masters/papad_companies endpoint works.
- [ ] 6. Update other components using old APIs to getMasters(type)
- [ ] COMPLETE
