# Debug: Team Members Not Showing

## 🔍 Debug Steps Added

I've added console logging to help us debug why "Team Members" is not showing for pharmacy_outlet users.

## 📝 Changes Made

### Added Debug Logging in Sidebar.tsx

```typescript
// Debug logging for Team Members visibility
React.useEffect(() => {
  const hasOwner = hasRole('owner');
  const hasPharmacyOutlet = hasRole('pharmacy_outlet');
  console.log('🔍 Team Members Debug:', {
    userRole: user?.role,
    hasOwner,
    hasPharmacyOutlet,
    shouldShow: hasOwner || hasPharmacyOutlet
  });
}, [user?.role, hasRole]);
```

## 🚀 How to Debug

1. **Open Browser DevTools** (Press F12)

2. **Go to Console tab**

3. **Hard refresh** the page (Ctrl+Shift+R or Cmd+Shift+R)

4. **Look for the debug message**:
   ```
   🔍 Team Members Debug: {
     userRole: "pharmacy_outlet",
     hasOwner: false,
     hasPharmacyOutlet: true,
     shouldShow: true
   }
   ```

5. **Check the values**:
   - `userRole`: Should be `"pharmacy_outlet"`
   - `hasPharmacyOutlet`: Should be `true`
   - `shouldShow`: Should be `true`

## 🎯 Expected Output

### For pharmacy_outlet user:
```javascript
{
  userRole: "pharmacy_outlet",
  hasOwner: false,
  hasPharmacyOutlet: true,
  shouldShow: true  // ← Should be true!
}
```

### For super_admin user:
```javascript
{
  userRole: "super_admin",
  hasOwner: false,
  hasPharmacyOutlet: false,
  shouldShow: false  // ← Should be false (they see "User Management" instead)
}
```

### For pharmacist user:
```javascript
{
  userRole: "pharmacist",
  hasOwner: false,
  hasPharmacyOutlet: false,
  shouldShow: false  // ← Should be false
}
```

## 📊 Troubleshooting

### If `userRole` is NOT "pharmacy_outlet":
**Problem**: User doesn't have the correct role in the database

**Solution**: Update the user's role in the database:
```javascript
// In MongoDB or your database
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "pharmacy_outlet" } }
);
```

### If `hasPharmacyOutlet` is `false`:
**Problem**: The `hasRole('pharmacy_outlet')` check is failing

**Possible causes**:
1. The `hasRole` function fix didn't apply
2. Browser cache issue
3. Dev server needs restart

**Solution**:
1. Clear browser cache completely
2. Restart dev server
3. Hard refresh

### If `shouldShow` is `true` but link still not visible:
**Problem**: The link is being filtered out somewhere

**Check**:
1. Look at the `renderNavItems` function
2. Check if there's a filter removing it
3. Check browser console for errors

## 🔧 Quick Fixes to Try

### 1. Clear Everything and Restart
```bash
# Stop dev server (Ctrl+C)
cd frontend
rm -rf node_modules/.vite
rm -rf .vite
npm run dev
```

### 2. Check User Role in Database
```bash
# Connect to MongoDB
mongo
use your_database_name
db.users.find({ email: "your-email@example.com" }).pretty()
```

### 3. Force Logout and Login
1. Logout from the app
2. Clear localStorage: `localStorage.clear()` in console
3. Login again

## 📋 Information to Provide

If it's still not working, please provide:

1. **Console output** (screenshot or copy the debug message)
2. **User role from localStorage**:
   ```javascript
   JSON.parse(localStorage.getItem('user'))
   ```
3. **Any console errors** (red messages in console)
4. **Screenshot** of the sidebar

## ✅ Once It Works

After we confirm it's working, we'll remove the debug logging.

---

**Debug Added By**: Kiro AI Assistant  
**Date**: 2025-10-09  
**Purpose**: Diagnose Team Members visibility issue
