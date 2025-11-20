# Troubleshooting: Feature Management Link Not Visible

## Issue
The Feature Management link is not appearing in the sidebar even though the code is correctly implemented.

## Verification Steps

### 1. Check Your User Role
The link is **only visible to users with `super_admin` role**.

**How to check:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Type: `localStorage.getItem('user')`
4. Check if the role is `super_admin`

**Expected output:**
```json
{
  "role": "super_admin",
  // ... other user data
}
```

If your role is NOT `super_admin`, the link will not appear. This is by design.

### 2. Verify the Code is Loaded
1. Open browser DevTools (F12)
2. Go to Sources tab
3. Find `Sidebar.tsx` in the file tree
4. Search for "Feature Management"
5. Verify the code is present

### 3. Check for JavaScript Errors
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for any red error messages
4. If there are errors, they might be preventing the sidebar from rendering correctly

### 4. Clear Browser Cache
Sometimes the browser caches old JavaScript files:

**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete` (Windows/Linux) or `Cmd + Shift + Delete` (Mac)
2. Select "Cached images and files"
3. Click "Clear data"
4. Refresh the page (`Ctrl + F5` or `Cmd + Shift + R`)

**Or use hard refresh:**
- Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`
- Mac: `Cmd + Shift + R`

### 5. Restart the Development Server
If you're running the dev server:

```bash
# Stop the server (Ctrl + C)
cd frontend
npm run dev
```

### 6. Check if RBAC Hook is Working
The link uses `hasRole('super_admin')` to determine visibility.

**Test in Console:**
```javascript
// In browser console
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('User role:', user.role);
console.log('Is super_admin?', user.role === 'super_admin');
```

## Common Issues and Solutions

### Issue 1: Not Logged in as Super Admin
**Symptom:** Link not visible
**Solution:** Login with a super_admin account

**How to create a super_admin user (if needed):**
```bash
# In backend directory
npm run seed:admin
# Or manually update user in database
```

### Issue 2: Browser Cache
**Symptom:** Old version of sidebar showing
**Solution:** Hard refresh (Ctrl + Shift + R) or clear cache

### Issue 3: Development Server Not Restarted
**Symptom:** Changes not reflected
**Solution:** Restart the dev server

### Issue 4: RBAC Context Not Loaded
**Symptom:** No admin items showing at all
**Solution:** Check if AuthContext is properly wrapped around the app

### Issue 5: ConditionalRender Component Issue
**Symptom:** ADMINISTRATION section not showing
**Solution:** Check if ConditionalRender component is working

## Manual Testing Checklist

### Test with Super Admin Account
- [ ] Login as super_admin
- [ ] Check if ADMINISTRATION section appears
- [ ] Check if "Admin Panel" link is visible
- [ ] Check if "Feature Management" link is visible
- [ ] Check if "Feature Flags" link is visible
- [ ] Click "Feature Management" link
- [ ] Verify navigation to `/admin/feature-management`

### Test with Non-Admin Account
- [ ] Login as pharmacist or other non-admin role
- [ ] Verify ADMINISTRATION section does NOT appear
- [ ] Verify "Feature Management" link does NOT appear

## Debug Commands

### Check if file was updated
```bash
cd frontend
grep -n "Feature Management" src/components/Sidebar.tsx
```

Expected output:
```
175:      name: 'Feature Management',
```

### Check if FlagIcon is imported
```bash
grep -n "FlagIcon" src/components/Sidebar.tsx
```

Expected output:
```
26:  Flag as FlagIcon,
177:      icon: FlagIcon,
```

### Run tests to verify implementation
```bash
npm run test -- src/components/__tests__/Sidebar.featureManagement.test.tsx --run
```

Expected: All 4 tests should pass

## Visual Inspection Guide

### What You Should See (Super Admin)

**Expanded Sidebar:**
```
╔═══════════════════════════════╗
║ ADMINISTRATION                ║
║ ┌───────────────────────────┐ ║
║ │ 🛡️  Admin Panel           │ ║
║ │ 🚩 Feature Management     │ ← Should be here!
║ │ ⚙️  Feature Flags         │ ║
║ └───────────────────────────┘ ║
╚═══════════════════════════════╝
```

**Collapsed Sidebar:**
```
╔═══╗
║ 🛡️ ║
║ 🚩 ║ ← Should be here!
║ ⚙️ ║
╚═══╝
```

### What You Should See (Non-Admin)

The ADMINISTRATION section should NOT appear at all.

## Still Not Working?

### Step-by-Step Debug Process

1. **Verify you're logged in:**
   ```javascript
   // Browser console
   console.log(localStorage.getItem('token'));
   ```

2. **Check your user role:**
   ```javascript
   // Browser console
   const user = JSON.parse(localStorage.getItem('user') || '{}');
   console.log('Role:', user.role);
   ```

3. **Check if sidebar is rendering:**
   ```javascript
   // Browser console
   document.querySelector('[class*="MuiDrawer"]');
   ```

4. **Check if adminItems are being filtered:**
   - Add a console.log in Sidebar.tsx:
   ```typescript
   console.log('Admin items:', adminItems.filter(item => item.show));
   ```

5. **Check React DevTools:**
   - Install React DevTools extension
   - Find Sidebar component
   - Check props and state
   - Verify hasRole('super_admin') returns true

## Quick Fix Checklist

Try these in order:

1. [ ] Hard refresh browser (Ctrl + Shift + R)
2. [ ] Clear browser cache completely
3. [ ] Logout and login again
4. [ ] Verify you're using super_admin account
5. [ ] Restart development server
6. [ ] Check browser console for errors
7. [ ] Run the test suite
8. [ ] Check if other admin links are visible
9. [ ] Try a different browser
10. [ ] Rebuild the project (`npm run build`)

## Contact Information

If none of these solutions work, please provide:
1. Your user role (from localStorage)
2. Browser console errors (screenshot)
3. Screenshot of the sidebar
4. Output of: `grep -n "Feature Management" frontend/src/components/Sidebar.tsx`

## Expected Behavior Summary

**For super_admin users:**
- ✅ ADMINISTRATION section visible
- ✅ "Admin Panel" link visible
- ✅ "Feature Management" link visible (with Flag icon 🚩)
- ✅ "Feature Flags" link visible
- ✅ Clicking "Feature Management" navigates to `/admin/feature-management`

**For non-admin users:**
- ❌ ADMINISTRATION section NOT visible
- ❌ "Feature Management" link NOT visible
- ❌ Direct navigation to `/admin/feature-management` redirects to dashboard

---

**Last Updated:** 2025-10-09
**Task:** 16 - Frontend Navigation
