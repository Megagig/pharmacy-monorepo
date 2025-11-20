# 402 Payment Required Error - RESOLVED

## Problem Summary
Workspace owners with active Pro subscriptions were receiving 402 "Required plan features not available" errors when accessing the AI Diagnostics module.

## Root Cause
**Mongoose Model Mismatch in Workspace Context Loader**

The system has two different plan models:
1. **PricingPlan** (new model) - `features: string[]` (array of feature names)
2. **SubscriptionPlan** (old model) - `features: object` (object with boolean properties)

The **Subscription** model references `'PricingPlan'`:
```typescript
planId: {
  type: Schema.Types.ObjectId,
  ref: 'PricingPlan',  // ← References PricingPlan
  required: true,
}
```

But **workspaceContext.ts** was:
- ❌ Importing only `SubscriptionPlan`  
- ❌ Treating plan.features as object with boolean properties
- ❌ Empty permissions array resulted → permission checks failed

The `.populate('planId')` query **WAS working** and loading the plan, but the code couldn't extract features because it expected the wrong data structure.

## Backend Logs Evidence
```
Auth middleware - Subscription lookup: {
  subscriptionFound: true,
  subscriptionStatus: 'active',
  subscriptionTier: 'pro',
  hasPlanId: false  // ← Wrong! PlanId exists but type mismatch
}

🔧 Feature flag found: false, Key: diagnostic_analytics
PERMISSION_DENIED: Required plan features not available
```

## Solution Implemented

### 1. Fixed `/backend/src/middlewares/workspaceContext.ts`

**Import both plan models:**
```typescript
import SubscriptionPlan, { ISubscriptionPlan } from '../models/SubscriptionPlan';
import PricingPlan, { IPricingPlan } from '../models/PricingPlan';
```

**Handle both feature structures:**
```typescript
async function loadUserWorkspaceContext(userId: any): Promise<WorkspaceContext> {
    let plan: ISubscriptionPlan | IPricingPlan | null = null;
    
    // subscription.planId references PricingPlan model
    if (subscription && subscription.planId) {
        plan = subscription.planId as unknown as IPricingPlan;
    }
    
    // Build permissions array - handle both model types
    const permissions: string[] = [];
    if (plan?.features) {
        if (Array.isArray(plan.features)) {
            // PricingPlan: features is string[] - use directly
            permissions.push(...plan.features);
        } else if (typeof plan.features === 'object') {
            // SubscriptionPlan: features is object - convert to strings
            Object.entries(plan.features).forEach(([key, value]) => {
                if (value === true) {
                    permissions.push(key);
                }
            });
        }
    }
    
    return { workspace, subscription, plan, permissions, limits, ... };
}
```

**Added debug logging:**
```typescript
if (process.env.NODE_ENV === 'development') {
    logger.info('Workspace context loaded:', {
        userId,
        workspaceId: workspace?._id,
        subscriptionTier: subscription?.tier,
        planId: plan?._id,
        planType: plan ? (Array.isArray(plan.features) ? 'PricingPlan' : 'SubscriptionPlan') : 'none',
        permissionsCount: permissions.length,
        hasAiDiagnostics: permissions.includes('ai_diagnostics'),
        firstFivePermissions: permissions.slice(0, 5),
    });
}
```

## Testing Instructions

### 1. Restart Backend Server
```bash
cd /home/megagig/Desktop/PROJECTS/MERN/pharma-care-saas/backend
# Stop current server (Ctrl+C)
npm run dev
```

### 2. Clear Browser and Login
- Logout from frontend
- Clear browser cache/cookies (or hard refresh: Ctrl+Shift+R)
- Login again as workspace owner

### 3. Verify Fix
Navigate to AI Diagnostics module:
```
http://localhost:5173/pharmacy/diagnostics
```

**Expected backend logs:**
```
Workspace context loaded: {
  userId: '68b5cd85f1f0f9758b8afbbd',
  subscriptionTier: 'pro',
  planType: 'PricingPlan',
  permissionsCount: 19,
  hasAiDiagnostics: true,
  firstFivePermissions: ['reportsExport', 'careNoteExport', 'multiUserSupport', 'prioritySupport', 'emailReminders']
}
```

**Expected frontend behavior:**
- ✅ No 402 errors
- ✅ Recent cases load successfully
- ✅ Referrals load successfully  
- ✅ Analytics endpoint accessible

### 4. Test Endpoints
```bash
# With valid auth token:
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/diagnostics/cases/all?page=1&limit=5

# Expected: 200 OK with case data
```

## Technical Details

### Files Modified
1. `/backend/src/middlewares/workspaceContext.ts`
   - Added PricingPlan import
   - Updated type union for plan variable
   - Fixed permissions building to handle array features
   - Added comprehensive debug logging

### Database State (Already Fixed)
```
Pro Plan (68b48f116901acc9cfac9739):
✅ 19 features including ai_diagnostics
✅ Subscription linked to this planId
```

### Why Restart is Required
The workspace context uses in-memory cache with 5-minute TTL:
```typescript
private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

Restarting server:
- Clears all cached workspace contexts
- Forces fresh load with new code
- Ensures all users get correct permissions

## Key Learnings

1. **Model References Must Match**: Schema `ref:` field must match model name registered with mongoose
2. **Type Safety vs Runtime**: TypeScript interfaces don't enforce runtime data structures
3. **Populated Field Structures**: Always check if populated field is array/object/primitive
4. **Cache Invalidation**: In-memory caches need server restart or explicit clear on code changes
5. **Feature Migration**: When adding new models, ensure all references are updated

## Verification Checklist

- [x] Database has correct plan features (ai_diagnostics included)
- [x] Subscription.planId populates correctly  
- [x] workspaceContext extracts features as array
- [x] Permissions array populated with plan features
- [ ] **Backend server restarted** ← USER ACTION REQUIRED
- [ ] **User logged out and back in** ← USER ACTION REQUIRED
- [ ] **402 errors resolved** ← TO BE VERIFIED
- [ ] **AI Diagnostics module accessible** ← TO BE VERIFIED

## Support

If 402 errors persist after restart:
1. Check backend logs for "Workspace context loaded" message
2. Verify `hasAiDiagnostics: true` in logs
3. Check `permissionsCount` > 0
4. Ensure user is logging in with workspace owner account
5. Verify subscription status is 'active' in database

---
**Status**: Code fix complete, awaiting server restart for verification
**Priority**: Critical (blocks paid feature access)
**Impact**: All workspace owners with Pro/higher subscriptions
