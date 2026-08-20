# Entry Item Selection Batch Fix — COMPLETE

## Root Cause
`EntryItemsTable` fires `onRowChange(index, '__batch__', { item_name, lot_no, available_lots })` when an item is selected, then asynchronously fires `onRowChange(index, '__batch__', { available_lots })` again after fetching lots from API.

Parent components were using non-functional state updates:
```js
const newItems = [...items];  // captures STALE items array in closure
newItems[index] = { ...newItems[index], ...value };
setItems(newItems);           // overwrites previous update
```

When two `__batch__` calls fire rapidly, both closures capture the SAME stale `items` array. The second update overwrites the first, **losing `item_name`**.

## Fix Applied
Converted ALL entry components to use **functional state updates**:
```js
setItems(prevItems => {
  const newItems = [...prevItems];
  newItems[index] = { ...newItems[index], ...value };
  return newItems;
});
```

This ensures each update receives the **latest state**, preventing overwrites.

## Files Modified (All Entry Components)

| File | Status |
|------|--------|
| `frontend/src/components/FlourOutCreation.jsx` | ✅ Functional `setItems` |
| `frontend/src/components/FlourOutReturnCreation.jsx` | ✅ Functional `setItems` + field key alignment |
| `frontend/src/components/GrainsCreation.jsx` | ✅ Functional `setInputItems` / `setOutputItems` |
| `frontend/src/components/QuotationCreate.jsx` | ✅ Functional `setItems` |
| `frontend/src/components/PurchaseReturn.jsx` | ✅ Functional `setItems` |
| `frontend/src/components/SalesCreate.jsx` | ✅ Functional `setRows` |
| `frontend/src/components/PapadInCreate.jsx` | ✅ Functional `setRows` |
| `frontend/src/components/PurchaseCreation.jsx` | ✅ Functional `setRows` |
| `frontend/src/components/PurchaseCreate.jsx` | ✅ Functional `setRows` (already fixed) |
| `frontend/src/components/SalesReturnCreate.jsx` | ✅ Functional `setItems` |
| `frontend/src/components/StockAdjustCreate.jsx` | ✅ Functional `setItems` |
| `frontend/src/components/WeightConversionCreate.jsx` | ✅ Functional `setItems` |

## Additional Fixes in Each File

### Field Key Alignment
Many components had mismatched field keys (e.g., `itemName` vs `item_name`, `lotNo` vs `lot_no`). All were aligned to match the `EntryItemsTable` column config:
- `item_name` (not `itemName`)
- `lot_no` (not `lotNo`)
- `total_wt` (not `totalWt`)
- `papad_kg` (not `papadKg`)
- `wages_per_bag` (not `wagesBag` / `wages_bag`)

### Column Config Updated
Added `type: 'masterSelect', masterType: 'items'` to item name columns so `EntryItemsTable` renders them as dropdowns. Added `type: 'lotSelect'` to lot number columns.

### Delete Functions
All delete functions now use functional updates:
```js
setItems(prev => {
  if (prev.length <= 1) return prev;
  return prev.filter((_, i) => i !== index);
});
```

## Verification Steps
1. Open any entry form:
   - Purchase Creation (`/entry/purchase-create`)
   - Flour Out (`/entry/flour-out-create`)
   - Flour Out Return (`/entry/flour-out-return-create`)
   - Grind (`/entry/grind-create`)
   - Purchase Return (`/entry/purchase-return-create`)
   - Quotation (`/entry/quotation-create`)
   - Sales (`/entry/sales-create`)
   - Sales Return (`/entry/sales-return-create`)
   - Papad In (`/entry/papad-in-create`)
   - Stock Adjust (`/entry/stock-adjust-create`)
   - Weight Conversion (`/entry/weight-conversion-create`)

2. Select an item from the dropdown
3. ✅ `item_name` should persist in the input field
4. ✅ `lot_no` dropdown should populate with available lots for that item
5. ✅ No console errors about stale state or missing fields

## Render Deployment Notes
- No backend changes required
- No new dependencies
- Build should succeed with `npm run build`
