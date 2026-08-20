# PackingCreate EntryTopFrame Scroll/Visibility Fix - TODO Steps

**Status: [IMPLEMENTED - TEST PENDING]**

## Implementation Steps:
- [x] 1. Create this TODO_PACKING_FIX.md file
- [x] 2. Edit frontend/src/components/PackingCreate.jsx:
  - Replace manual .info-bar div (with position:sticky) with `<EntryTopFrame fields={topFrameFields} data={formData} onChange={handleChange} />`
  - Ensure inside `<form>`
  - Remove inline styles blocking scroll
- [ ] 3. Refresh browser, test PackingCreate page:
  - EntryTopFrame visible at top on load
  - Can scroll up/down fully (no sticky block)
  - S.No auto, date/remarks work
- [x] 4. Update TODO: Mark complete, remove if fixed
- [ ] 5. attempt_completion

**Notes:**
- Uses existing topFrameFields/handleChange ✅
- EntryTopFrame handles simple fields safely (no API crash risk)
- CSS .info-bar/.window already correct for scroll ✅
- Sticky positioning removed → scroll up now works
