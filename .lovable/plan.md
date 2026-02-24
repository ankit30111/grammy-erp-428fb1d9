# DASH Independent Workspace Architecture

## What Changes

Currently, all DASH pages use `DashboardLayout` which renders the Grammy ERP sidebar. This plan replaces that with a dedicated `DashLayout` component that has its own sidebar, header, and visual identity -- making DASH feel like a separate application within the ERP.

## Architecture

```text
Current:
  All routes → DashboardLayout (Grammy sidebar + header)

New:
  /dashboard/* routes → DashboardLayout (Grammy sidebar)
  /dash/* routes     → DashLayout (DASH sidebar + DASH header)
```

## Files to Create

### 1. `src/components/Layout/DashLayout.tsx`

A new full-page layout component for DASH brand workspace:

- Own sidebar with DASH-specific navigation (Dashboard, Product Master, Factory Orders, Inventory, Sales Orders, Customers, Dispatch Tracking, Service & Warranty, Spare Parts, Reports, Settings)
- "Back to Grammy ERP" button at top of sidebar linking to `/dashboard`
- DASH-branded header with logo text, search bar (SKU/Serial/Customer placeholder), notifications dropdown, user profile dropdown
- Breadcrumb: Grammy ERP > DASH > Current Page
- Slight brand accent color via a CSS class on the root container (e.g., purple/blue tint on sidebar)
- Collapsible sidebar (matching the existing pattern)

### 2. `src/components/Navigation/DashSidebar.tsx`

DASH-specific sidebar with these nav items:

- ·       DASH Dashboard (`/dash`)
  ·       Sales Orders (`/dash/sales`)
  ·       Factory Orders (`/dash/factory-orders`)
  ·       Inventory (`/dash/inventory`)
  ·       Customers (`/dash/customers`)
  ·       Dispatch Tracking (`/dash/tracking`)
  ·       Product Master (`/dash/products`)
  ·       Spare Parts (`/dash/spares`)
  ·       Service & Warranty (`/dash/service`)
  ·       Customer Registration
  ·       Settings (placeholder)
  ·       Divider + "Back to Grammy ERP" link at bottom

### 3. `src/components/Navigation/DashNavItem.tsx`

Simple nav item component for the DASH sidebar (reusable, simpler than the ERP NavItem since no sub-items needed at this level).

## Files to Modify

### 4. All 9 DASH pages (`src/pages/dash/*.tsx`)

Replace `<DashboardLayout>` wrapper with `<DashLayout>` in:

- DashDashboard.tsx
- DashProducts.tsx
- DashFactoryOrders.tsx
- DashInventory.tsx
- DashSales.tsx
- DashCustomers.tsx
- DashService.tsx
- DashSpares.tsx
- DashOrderTracking.tsx

### 5. `src/components/Navigation/navigationConfig.tsx`

Change the DASH entry from having sub-items to being a simple link (`/dash`) -- clicking it navigates to the DASH workspace rather than expanding a sub-menu.

### 6. `src/index.css`

Add a small set of DASH brand CSS variables (accent color for sidebar) under a `.dash-workspace` class.

## Scalability for Future Brands

The `DashLayout` pattern is generic enough to be duplicated for future brands (GOVO, etc.) by creating a `BrandLayout` wrapper that accepts brand config (name, logo, accent color, nav items). For now, we build it specifically for DASH and refactor to a generic `BrandWorkspaceLayout` when a second brand is added.

## Performance

No full-page reload when switching between ERP and DASH. React Router handles the transition client-side. Each workspace simply renders a different layout component based on the route prefix -- the QueryClient and auth state persist across both workspaces.

## Technical Details

- The DASH sidebar uses the same collapse/expand pattern as the Grammy sidebar (local state, CSS transition)
- Header reuses `UserProfileDropdown` component from the existing ERP
- Breadcrumb is computed from `useLocation()` with a mapping of route segments to labels
- The "Back to Grammy ERP" button uses `useNavigate()` to go to `/dashboard`
- Brand accent is applied via Tailwind classes (e.g., `bg-slate-900` for DASH sidebar vs `bg-sidebar` for ERP)