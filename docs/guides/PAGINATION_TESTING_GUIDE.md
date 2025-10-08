# Pagination Testing Guide for SommOS

## Overview
This guide provides comprehensive testing instructions for the newly implemented pagination functionality with "Load More" buttons across the SommOS wine management system.

## Prerequisites
- Backend server running on port 3001
- Frontend accessible (either via Vite dev server or deployed)
- Test database with sufficient data (see Data Preparation section)

---

## 1. Data Preparation

### Create Test Dataset
To thoroughly test pagination, you need at least 150+ inventory items and 150+ wine records.

#### Option A: Use Seed Script (Recommended)
```bash
cd /Users/thijs/Documents/SommOS/backend
node database/seed.js --extended
```

#### Option B: Manual Testing
If you have fewer than 50 items currently:
1. Navigate to the Inventory view
2. Use the "Add Wine" feature to add more test wines
3. Alternatively, duplicate existing records in the database:

```sql
-- Example SQL to create test data (adjust as needed)
INSERT INTO Wines (name, producer, region, wine_type, country, grape_varieties)
SELECT 
    name || ' (Copy ' || CAST(rowid AS TEXT) || ')',
    producer,
    region,
    wine_type,
    country,
    grape_varieties
FROM Wines
LIMIT 50;
```

---

## 2. Backend Validation Testing

### Test 1: Limit Parameter Validation
**Purpose**: Verify backend rejects requests with limit > 100

```bash
# Test valid limit (should succeed)
curl "http://localhost:3001/api/inventory?limit=50&offset=0" \
  -H "Cookie: your-auth-cookie-here"

# Test limit at boundary (should succeed)
curl "http://localhost:3001/api/inventory?limit=100&offset=0" \
  -H "Cookie: your-auth-cookie-here"

# Test limit over maximum (should fail with 400 error)
curl "http://localhost:3001/api/inventory?limit=101&offset=0" \
  -H "Cookie: your-auth-cookie-here"

# Expected: {"success":false,"error":{"code":"VALIDATION_ERROR","message":"Limit must be between 1 and 100."}}
```

### Test 2: Offset Parameter Validation
**Purpose**: Verify backend validates offset parameter

```bash
# Test negative offset (should fail)
curl "http://localhost:3001/api/inventory?limit=50&offset=-1" \
  -H "Cookie: your-auth-cookie-here"

# Expected: {"success":false,"error":{"code":"VALIDATION_ERROR","message":"Offset must be zero or greater."}}
```

---

## 3. Frontend Inventory Pagination Testing

### Test 3: Initial Load
1. Navigate to Inventory view
2. Clear browser cache (Cmd+Shift+Delete on Mac)
3. Refresh the page

**Expected Results:**
- ✅ First 50 items load immediately
- ✅ Pagination controls visible at bottom
- ✅ Item counter shows "Showing 50 of X items" (where X is your total)
- ✅ "Load More" button visible (if total > 50)
- ✅ No spinner visible initially

### Test 4: Load More Functionality
1. Scroll to bottom of inventory
2. Click "Load More" button

**Expected Results:**
- ✅ Button text changes to "Loading..."
- ✅ Spinner appears next to button text
- ✅ Button is disabled during load
- ✅ New items append to grid (don't replace existing)
- ✅ Item counter updates (e.g., "Showing 100 of X items")
- ✅ Spinner disappears after load
- ✅ Button text returns to "Load More"
- ✅ Scroll position maintained (not reset to top)

### Test 5: Load All Items
1. Continue clicking "Load More" until all items loaded

**Expected Results:**
- ✅ Button disappears when all items loaded
- ✅ Item counter shows "Showing X of X items"
- ✅ No error messages displayed

### Test 6: Filter Changes Reset Pagination
1. Load 2+ pages of items (100+ items visible)
2. Change any filter (location, wine type, region, or available only)

**Expected Results:**
- ✅ Grid resets to first 50 items matching filter
- ✅ Item counter resets
- ✅ "Load More" button appears if filtered results > 50
- ✅ Previous items are replaced (not appended)

### Test 7: Loading State
1. Network throttling enabled (Chrome DevTools: Network tab → Throttling → Fast 3G)
2. Click "Load More"

**Expected Results:**
- ✅ Loading spinner visible immediately
- ✅ Button disabled (no double-clicks possible)
- ✅ Button has reduced opacity (0.7)
- ✅ Cursor changes to "wait"

---

## 4. Error Handling Tests

### Test 8: Network Failure
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Select "Offline" mode
4. Click "Load More" button

**Expected Results:**
- ✅ Error message displays: "Failed to load more items. Please try again."
- ✅ "Load More" button hides
- ✅ "Try Again" button appears
- ✅ Item counter remains unchanged

### Test 9: Retry After Error
1. Continue from Test 8
2. Re-enable network (uncheck "Offline")
3. Click "Try Again" button

**Expected Results:**
- ✅ Error message disappears
- ✅ Loading spinner appears
- ✅ New items load successfully
- ✅ "Load More" button returns
- ✅ Item counter updates correctly

### Test 10: Server Error (500)
Temporarily modify backend to return 500 error:
```javascript
// In backend/api/routes.js, before getInventory endpoint
router.get('/inventory', (req, res) => {
    if (req.query.offset > 0) {
        return res.status(500).json({ error: { message: 'Server error' } });
    }
    // ... continue with normal flow
});
```

**Expected Results:**
- ✅ Same error handling as network failure
- ✅ Retry button works after fixing server

---

## 5. Responsive Design Testing

### Test 11: Mobile View (375px width)
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Cmd+Shift+M)
3. Select iPhone SE or similar (375px)
4. Navigate to Inventory

**Expected Results:**
- ✅ Pagination controls stack vertically
- ✅ "Load More" button full width
- ✅ Item counter text wraps properly
- ✅ Touch targets are large enough (min 44x44px)

### Test 12: Tablet View (768px width)
1. Switch to iPad size (768px)

**Expected Results:**
- ✅ Pagination controls properly spaced
- ✅ Button maintains readable size
- ✅ No horizontal scrolling

---

## 6. Accessibility Testing

### Test 13: Keyboard Navigation
1. Use only Tab key to navigate
2. Press Enter on "Load More" button

**Expected Results:**
- ✅ Can tab to "Load More" button
- ✅ Button has visible focus indicator
- ✅ Enter key triggers load
- ✅ Focus maintained after load completes

### Test 14: Screen Reader
1. Enable VoiceOver (Cmd+F5 on Mac)
2. Navigate to pagination controls

**Expected Results:**
- ✅ Item counter announced with "Showing X of Y items"
- ✅ Button announced as "Load more inventory items, button"
- ✅ aria-live region updates announce new items loaded

---

## 7. Performance Testing

### Test 15: Large Dataset Performance
Create 500+ inventory items, then:
1. Load initial page (50 items)
2. Click "Load More" 9 times (to load 500 items)

**Expected Results:**
- ✅ Each page load completes in < 1 second
- ✅ No visible lag when scrolling
- ✅ Browser doesn't freeze or become unresponsive
- ✅ Memory usage remains reasonable (check Chrome Task Manager)

### Test 16: Rapid Clicks Prevention
1. Click "Load More" button multiple times rapidly

**Expected Results:**
- ✅ Only one request fires
- ✅ Button disabled prevents double-clicks
- ✅ No duplicate items appear

---

## 8. Edge Cases

### Test 17: Exactly 50 Items Total
Create test dataset with exactly 50 items:
1. Navigate to Inventory

**Expected Results:**
- ✅ All 50 items displayed
- ✅ Pagination controls visible
- ✅ Item counter shows "Showing 50 of 50 items"
- ✅ "Load More" button NOT visible

### Test 18: Zero Items
1. Apply filters that result in no matches

**Expected Results:**
- ✅ Empty state message displayed
- ✅ Pagination controls hidden
- ✅ No errors in console

### Test 19: Single Page (< 50 items)
1. Apply filter resulting in 25 items

**Expected Results:**
- ✅ All 25 items displayed
- ✅ Pagination controls visible
- ✅ Item counter shows "Showing 25 of 25 items"
- ✅ "Load More" button NOT visible

---

## 9. Integration Tests

### Test 20: Pagination + Filters
1. Load 100 items (2 pages)
2. Apply location filter
3. Load more filtered results
4. Clear filter

**Expected Results:**
- ✅ Filter applies to paginated results
- ✅ Pagination resets on filter change
- ✅ Clearing filter loads initial 50 again
- ✅ All transitions smooth without errors

### Test 21: Pagination + Sorting
1. Load 100 items
2. Change sort order
3. Click "Load More"

**Expected Results:**
- ✅ Sort applies to all loaded items
- ✅ Newly loaded items respect current sort
- ✅ No duplicate items after sort change

---

## 10. Browser Compatibility

### Test 22: Cross-Browser Testing
Test in the following browsers:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

**Expected Results:**
- ✅ Spinner animation works in all browsers
- ✅ Button styles consistent
- ✅ No JavaScript errors
- ✅ All functionality works identically

---

## Regression Testing Checklist

After implementing pagination, verify these didn't break:
- ✅ Adding new wine to inventory
- ✅ Consuming wine (updates quantities correctly)
- ✅ Reserving wine
- ✅ Moving wine between locations
- ✅ Wine detail modal opens correctly
- ✅ Dashboard statistics still accurate
- ✅ Pairing recommendations work
- ✅ Search functionality works

---

## Automated Test Script

For quick regression testing, you can use this JavaScript console snippet:

```javascript
// Run in browser console after loading inventory page
async function testPagination() {
    console.log('🧪 Starting pagination tests...');
    
    // Test 1: Check initial load
    const initialItems = document.querySelectorAll('.wine-card').length;
    console.log(`✓ Initial items loaded: ${initialItems}`);
    
    // Test 2: Check pagination UI exists
    const paginationContainer = document.getElementById('inventory-pagination');
    const loadMoreBtn = document.getElementById('load-more-inventory');
    console.log(`✓ Pagination UI present: ${!!paginationContainer}`);
    console.log(`✓ Load More button present: ${!!loadMoreBtn}`);
    
    // Test 3: Check item counter
    const loaded = document.getElementById('items-loaded').textContent;
    const total = document.getElementById('items-total').textContent;
    console.log(`✓ Item counter: ${loaded} of ${total}`);
    
    // Test 4: Simulate load more (if button visible)
    if (loadMoreBtn && loadMoreBtn.style.display !== 'none') {
        console.log('🔄 Testing Load More...');
        loadMoreBtn.click();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const newItems = document.querySelectorAll('.wine-card').length;
        console.log(`✓ Items after load more: ${newItems}`);
        console.log(`✓ New items added: ${newItems - initialItems}`);
    }
    
    console.log('✅ Basic pagination tests complete!');
}

testPagination();
```

---

## Reporting Issues

If you find bugs during testing, please document:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser and version
5. Console errors (if any)
6. Screenshots/videos (if applicable)

---

## Success Criteria

All tests should pass with:
- ✅ Zero console errors
- ✅ No visual glitches
- ✅ Smooth user experience
- ✅ Accessible to keyboard/screen reader users
- ✅ Works on mobile, tablet, desktop
- ✅ Handles errors gracefully
- ✅ Performance remains good with large datasets

---

## Notes
- The inventory module has been updated with full Load More pagination
- Wine catalog already has traditional page-based pagination (different implementation)
- Dashboard requests limited data (50 items) for performance
- Backend validates limit (max 100) and offset (min 0) parameters
- Error handling includes retry mechanism with user-friendly messages
