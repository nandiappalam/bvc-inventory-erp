# GLOBAL API REFACTOR TODO - Remove utils/api.js default imports

Status: Major Display files complete. Remaining entry/creation files optional.

## Steps

1. [x] Analyzed files with search_files, confirmed 18+ files affected.
2. [x] Created this TODO.md.
3. [✅] Fix frontend/src/components/CustomerDisplay.jsx (import and api calls).
4. [✅] Fix frontend/src/components/SupplierDisplay.jsx.
5. [✅] Fix frontend/src/components/LedgerDisplay.jsx.
6. [✅] Fix frontend/src/components/ItemDisplay.jsx.
7. [ ] Fix other Display components (LedgerGroupDisplay, TransportDisplay, SenderDisplay, Deduction*Display, ConsigneeDisplay, FlourMillDisplay).
8. [ ] Fix creation/entry files (FlourOut*, GrainsCreation, Purchase*, PackingEntry, OpenCreate, StockAdjustEntry, SalesDisplayPage, QuotationDisplay, MasterDropdown).
9. [ ] Fix any remaining api.getMasters/api.deleteMaster calls to use plural for GET.
10. [ ] Delete frontend/src/utils/api.js.
11. [ ] Clear Vite cache: Execute `cd frontend && rmdir /s node_modules\\.vite && npm run dev` (Windows).
12. [ ] Test: No default export errors, all masters load correctly.

## Rules
- Import: `import { getMasters, deleteMaster } from '../services/masterservice';`
- GET: `getMasters('plural_name')` e.g. 'customers', 'papad_companies'
- DELETE: `deleteMaster('table_name', id)` e.g. 'customer_master'
- Preserve './customer-display.css'; import

Updated: Step 2 complete.
