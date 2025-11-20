# Feature Management Route Flow Diagram

## Route Protection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Navigates to                             │
│              /admin/feature-management                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ProtectedRoute Component                        │
│              (requiredRole="super_admin")                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Is User       │
                 │ Authenticated?│
                 └───────┬───────┘
                         │
            ┌────────────┴────────────┐
            │                         │
           NO                        YES
            │                         │
            ▼                         ▼
    ┌──────────────┐         ┌──────────────┐
    │ Redirect to  │         │ Check User   │
    │   /login     │         │     Role     │
    │              │         └──────┬───────┘
    │ (with return │                │
    │    path)     │                │
    └──────────────┘    ┌───────────┴───────────┐
                        │                       │
                  super_admin              other roles
                        │                       │
                        ▼                       ▼
            ┌──────────────────┐    ┌──────────────────┐
            │ Render Feature   │    │ Show Access      │
            │ Management Page  │    │ Denied Page      │
            │                  │    │                  │
            │ ✅ Full Access   │    │ ❌ 403 Forbidden │
            └──────────────────┘    └──────────────────┘
                        │                       │
                        ▼                       ▼
            ┌──────────────────┐    ┌──────────────────┐
            │ • Features Tab   │    │ • Lock Icon      │
            │ • Tier Matrix    │    │ • Error Message  │
            │ • CRUD Ops       │    │ • Current Role   │
            │ • Bulk Actions   │    │ • Back Button    │
            └──────────────────┘    └──────────────────┘
```

## Component Hierarchy

```
App.tsx
  └── Router
      └── Routes
          └── Route (path="/admin/feature-management")
              └── ProtectedRoute (requiredRole="super_admin")
                  └── AppLayout
                      ├── Navbar
                      ├── Sidebar
                      └── LazyWrapper (fallback=PageSkeleton)
                          └── LazyFeatureManagement
                              └── FeatureManagement Component
                                  ├── Features Tab
                                  │   ├── Feature List
                                  │   └── Feature Form
                                  └── Tier Management Tab
                                      └── Feature Matrix
```

## Authentication States

```
┌─────────────────────────────────────────────────────────────────┐
│                     Authentication State                         │
└─────────────────────────────────────────────────────────────────┘

State 1: Loading
┌──────────────────┐
│ Loading Spinner  │  ← While checking auth status
└──────────────────┘

State 2: Not Authenticated
┌──────────────────┐
│ Redirect to      │  ← No user in context
│    /login        │
└──────────────────┘

State 3: Authenticated - Wrong Role
┌──────────────────┐
│ Access Denied    │  ← User role !== super_admin
│     Page         │
└──────────────────┘

State 4: Authenticated - Correct Role
┌──────────────────┐
│ Feature Mgmt     │  ← User role === super_admin
│     Page         │
└──────────────────┘
```

## Role-Based Access Matrix

```
┌────────────────┬──────────────┬─────────────┬──────────────┐
│   User Role    │ Can Access?  │   Result    │    Action    │
├────────────────┼──────────────┼─────────────┼──────────────┤
│ super_admin    │     ✅       │ 200 OK      │ Show Page    │
├────────────────┼──────────────┼─────────────┼──────────────┤
│ owner          │     ❌       │ 403 Denied  │ Access Denied│
├────────────────┼──────────────┼─────────────┼──────────────┤
│ pharmacist     │     ❌       │ 403 Denied  │ Access Denied│
├────────────────┼──────────────┼─────────────┼──────────────┤
│ pharmacy_team  │     ❌       │ 403 Denied  │ Access Denied│
├────────────────┼──────────────┼─────────────┼──────────────┤
│ pharmacy_outlet│     ❌       │ 403 Denied  │ Access Denied│
├────────────────┼──────────────┼─────────────┼──────────────┤
│ (no auth)      │     ❌       │ 401 Unauth  │ Redirect     │
└────────────────┴──────────────┴─────────────┴──────────────┘
```

## Request Flow Sequence

```
User Browser                 Frontend Router              ProtectedRoute              Backend API
     │                              │                           │                          │
     │  Navigate to route           │                           │                          │
     ├─────────────────────────────>│                           │                          │
     │                              │                           │                          │
     │                              │  Check authentication     │                          │
     │                              ├──────────────────────────>│                          │
     │                              │                           │                          │
     │                              │                           │  Verify JWT token        │
     │                              │                           ├─────────────────────────>│
     │                              │                           │                          │
     │                              │                           │  Return user data        │
     │                              │                           │<─────────────────────────┤
     │                              │                           │                          │
     │                              │  Check role               │                          │
     │                              │<──────────────────────────┤                          │
     │                              │                           │                          │
     │  Render page or deny         │                           │                          │
     │<─────────────────────────────┤                           │                          │
     │                              │                           │                          │
```

## Lazy Loading Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Initial Page Load                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Load App.tsx  │
                 │ (Main Bundle) │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ User navigates│
                 │ to /admin/    │
                 │ feature-mgmt  │
                 └───────┬───────┘
                         │
                         ▼
            ┌────────────────────────┐
            │ LazyWrapper shows      │
            │ PageSkeleton           │
            │ (Loading State)        │
            └────────┬───────────────┘
                     │
                     ▼
            ┌────────────────────────┐
            │ Dynamic import()       │
            │ FeatureManagement.tsx  │
            │ (Separate Chunk)       │
            └────────┬───────────────┘
                     │
                     ▼
            ┌────────────────────────┐
            │ Render Feature         │
            │ Management Component   │
            └────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Error Scenarios                           │
└─────────────────────────────────────────────────────────────────┘

Scenario 1: Network Error
    User → Route → Auth Check → Network Failure
                                      │
                                      ▼
                              Show Error Toast
                              Retry Option

Scenario 2: Token Expired
    User → Route → Auth Check → Token Invalid
                                      │
                                      ▼
                              Clear Auth State
                              Redirect to /login

Scenario 3: Role Mismatch
    User → Route → Auth Check → Role Check Failed
                                      │
                                      ▼
                              Show Access Denied
                              Back to Dashboard

Scenario 4: Component Load Error
    User → Route → Auth OK → Lazy Load Failed
                                      │
                                      ▼
                              Error Boundary
                              Show Error Page
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Layers                             │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Route Protection
    ├── ProtectedRoute wrapper
    └── Role-based access control

Layer 2: Authentication
    ├── JWT token validation
    ├── Session management
    └── Token expiration handling

Layer 3: Authorization
    ├── Role verification (super_admin)
    ├── Permission checks
    └── Feature flag validation

Layer 4: Backend Validation
    ├── API endpoint protection
    ├── Middleware authentication
    └── Role verification on server
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────────────────┐
│                   Performance Features                           │
└─────────────────────────────────────────────────────────────────┘

1. Code Splitting
   └── FeatureManagement loaded only when needed
       └── Reduces initial bundle size

2. Lazy Loading
   └── Dynamic import() for route component
       └── Faster initial page load

3. Loading States
   └── PageSkeleton shown during load
       └── Better user experience

4. Caching
   └── Component cached after first load
       └── Instant subsequent navigation
```

This diagram provides a comprehensive visual representation of how the route protection and loading works for the Feature Management page.
