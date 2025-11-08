# Tenant Switcher & Permissions System

This document explains how to use the tenant switcher, permission gates, and route guards in the application.

## Components Overview

### 1. TenantSwitcher
A dropdown component in the top navigation that allows users to switch between their workspace memberships.

**Features:**
- Lists all tenants the user has access to
- Shows current role for each tenant
- Stores active tenant in localStorage
- Auto-selects first tenant on initial load
- Automatically attaches X-Tenant header to edge function calls

**Usage:**
```tsx
import { TenantSwitcher } from "@/components/TenantSwitcher";

// Already included in DashboardLayout header
<TenantSwitcher />
```

### 2. RequireTenant
A route guard component that blocks access to pages when no tenant is selected.

**Usage:**
```tsx
import { RequireTenant } from "@/components/RequireTenant";

const MyProtectedPage = () => {
  return (
    <DashboardLayout>
      <RequireTenant fallbackPath="/settings">
        {/* Your page content here */}
      </RequireTenant>
    </DashboardLayout>
  );
};
```

### 3. PermissionGate
Conditionally renders UI elements based on user permissions.

**Single Permission:**
```tsx
import { PermissionGate } from "@/components/PermissionGate";

<PermissionGate 
  permission="payments:create"
  fallback={<p>No access</p>}
>
  <CreatePaymentButton />
</PermissionGate>
```

**Multiple Permissions (any):**
```tsx
<PermissionGate 
  permissions={["payments:create", "payments:capture"]}
  requireAll={false}
>
  <PaymentActions />
</PermissionGate>
```

**Multiple Permissions (all required):**
```tsx
<PermissionGate 
  permissions={["settings:edit", "api_keys:manage"]}
  requireAll={true}
>
  <AdvancedSettings />
</PermissionGate>
```

## Hooks

### useTenantSwitcher
Access tenant switching functionality.

```tsx
import { useTenantSwitcher } from "@/hooks/useTenantSwitcher";

const MyComponent = () => {
  const { 
    memberships,        // Array of user's memberships
    activeTenantId,     // Currently active tenant ID
    activeTenant,       // Current tenant details
    switchTenant,       // Function to switch tenant
    isLoading,          // Loading state
    hasMultipleTenants  // Boolean for UI logic
  } = useTenantSwitcher();

  return (
    <div>
      <p>Active: {activeTenant?.tenants.name}</p>
      <button onClick={() => switchTenant(someOtherId)}>
        Switch
      </button>
    </div>
  );
};
```

### usePermissions
Check user permissions programmatically.

```tsx
import { usePermissions } from "@/hooks/usePermissions";

const MyComponent = () => {
  const { 
    permissions,        // Array of permission strings
    hasPermission,      // Check single permission
    hasAnyPermission,   // Check if user has any of the provided permissions
    hasAllPermissions,  // Check if user has all provided permissions
    isLoading 
  } = usePermissions();

  const canCreatePayment = hasPermission("payments:create");
  const canManageSettings = hasAllPermissions([
    "settings:edit", 
    "branding:edit"
  ]);

  return (
    <div>
      {canCreatePayment && <CreateButton />}
      {canManageSettings && <SettingsPanel />}
    </div>
  );
};
```

## Edge Function Calls with X-Tenant Header

Use the wrapper function to automatically include the active tenant ID in edge function calls:

```tsx
import { invokeFunctionWithTenant } from "@/lib/supabaseFunctions";

// Instead of supabase.functions.invoke
const { data, error } = await invokeFunctionWithTenant('my-function', {
  body: { someData: 'value' }
});

// The X-Tenant header is automatically added based on localStorage
```

## Available Permissions

Current system permissions:

- `payments:read` - View payment transactions
- `payments:create` - Create new payments
- `payments:capture` - Capture authorized payments
- `refunds:create` - Process refunds
- `payouts:view` - View payout information
- `payouts:approve` - Approve payouts
- `customers:read` - View customer information
- `customers:create` - Create new customers
- `users:invite` - Invite users to workspace
- `roles:assign` - Assign roles to users
- `settings:edit` - Edit workspace settings
- `branding:edit` - Edit branding and appearance
- `webhooks:manage` - Manage webhook configurations
- `api_keys:manage` - Manage API keys
- `reports:export` - Export reports and data
- `disputes:respond` - Respond to payment disputes

## System Roles

Pre-configured roles:

1. **super_admin** - Platform administrator (platform-level, all permissions)
2. **owner** - Tenant owner (tenant-scoped, all permissions)
3. **merchant_admin** - Merchant administrator (most operational permissions)
4. **finance** - Financial operations and reporting
5. **support** - Customer support access
6. **developer** - API and technical integration
7. **viewer** - Read-only access

## Best Practices

1. **Always use RequireTenant** for pages that need workspace context
2. **Use PermissionGate** for conditional UI rendering based on permissions
3. **Use usePermissions hook** for complex permission logic
4. **Use invokeFunctionWithTenant** for all edge function calls
5. **Store active tenant in localStorage** for persistence across sessions
6. **Invalidate queries** when switching tenants to refresh data

## Example: Protected Page with Permissions

```tsx
import DashboardLayout from "@/components/DashboardLayout";
import { RequireTenant } from "@/components/RequireTenant";
import { PermissionGate } from "@/components/PermissionGate";
import { usePermissions } from "@/hooks/usePermissions";

const PaymentsPage = () => {
  const { hasPermission } = usePermissions();

  return (
    <DashboardLayout>
      <RequireTenant>
        <div className="p-6">
          <h1>Payments</h1>
          
          <PermissionGate 
            permission="payments:read"
            fallback={<NoAccessMessage />}
          >
            <PaymentsList />
          </PermissionGate>

          <PermissionGate permission="payments:create">
            <CreatePaymentButton />
          </PermissionGate>

          {hasPermission("reports:export") && (
            <ExportButton />
          )}
        </div>
      </RequireTenant>
    </DashboardLayout>
  );
};
```
