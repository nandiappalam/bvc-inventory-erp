# TODO: Add Type Dropdown to Item Master

## Steps
- [x] Step 1: Add `type` dropdown field to `frontend/src/utils/masterConfig.js` (Item config Classification section)
- [x] Step 2: Add `type` to `item_master.fields` in `backend/routes/masters.js`
- [x] Step 3: Increase display column limit from `.slice(0, 6)` to `.slice(0, 8)` in `frontend/src/components/master/DynamicMasterDisplay.jsx`
- [x] Step 4: Fix React duplicate key warnings in `frontend/src/components/master/SmartField.jsx` (use `${optValue}-${index}` pattern)

## Result
- ✅ Item Create page now shows a **Type** dropdown with options: **Urad, Rice, Flour, Suji**
- ✅ Selected Type value is saved to the `type` column in `item_master` table
- ✅ Item Display page shows the **Type** column automatically (via DynamicMasterDisplay)
- ✅ Fixed duplicate React key warnings in SmartField dropdowns (uses `${optValue}-${index}`)
