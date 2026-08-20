# Master API Fixes TODO

## Priority 1: Backend Fields (500 Fix)
- [x] Updated POST route to dynamic fields, callback style matching task

## Priority 2: API.js URL Logic (404 /apimasters Fix)
- [x] Replaced api.js with task's exact logic

## Priority 3: SmartField Multi-Call (400 Fix)
- [x] No multi-type calls found in SmartField or project (searches returned 0)

## Priority 4: Null Guards
- [x] Added null/success guards in masterservice.js getMasters

## Testing
- [ ] Test POST /api/masters/item_groups
- [ ] Verify no 404/400/500
- [ ] Frontend stable, no crashes
