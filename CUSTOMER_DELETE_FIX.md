# Customer Delete Cascade Fix

## Problem
The customer deletion functionality was not properly handling the cascade relationships between customers, users, projects, buildings, panels, facades, and panel_status_histories. When deleting a customer, the system needed to:

1. Delete the associated user account
2. Set `customer_id` to NULL in the projects table
3. Delete any users linked to this customer (users with this customer_id)
4. Set `user_id` to NULL in all tables that reference users (panels, facades, buildings, panel_status_histories)
5. Finally delete the customer record

## Solution

### 1. Enhanced CRUD Operations (`src/utils/userTracking.ts`)

Added a specialized `deleteCustomer` function that handles the cascade deletion in the correct order:

```typescript
async deleteCustomer(customerId: string) {
  // Step 1: Get customer to find associated user_id
  // Step 2: Set customer_id to NULL in projects table
  // Step 3: Delete any users linked to this customer (users with this customer_id)
  // Step 4: Set user_id to NULL in all tables that reference users (panels, facades, buildings, panel_status_histories)
  // Step 5: Delete the associated user if it exists
  // Step 6: Finally delete the customer
}
```

### 2. Updated CustomersPage (`src/pages/CustomersPage.tsx`)

- Modified `confirmDelete` function to use `crudOperations.deleteCustomer()` instead of the generic delete
- Updated the delete confirmation dialog to provide accurate information about what will be deleted

### 3. Database Constraints (`fix_customer_cascade_delete.sql`)

Added proper foreign key constraints with `ON DELETE SET NULL` behavior:

```sql
-- Customer's user_id references users.id with SET NULL
ALTER TABLE customers 
ADD CONSTRAINT customers_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE SET NULL;

-- User's customer_id references customers.id with SET NULL  
ALTER TABLE users 
ADD CONSTRAINT users_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id) 
ON DELETE SET NULL;

-- Project's customer_id references customers.id with SET NULL
ALTER TABLE projects 
ADD CONSTRAINT projects_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id) 
ON DELETE SET NULL;

-- Building's user_id references users.id with SET NULL
ALTER TABLE buildings 
ADD CONSTRAINT buildings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE SET NULL;

### 4. Test Script (`test_customer_delete.js`)

Created a comprehensive test script to verify the cascade delete functionality works correctly.

## Database Schema Relationships

```
customers (id) ←→ users (customer_id)
     ↓                    ↓
projects (customer_id)  buildings (user_id)
                              ↓
                         panels (user_id)
                              ↓
                         facades (user_id)
                              ↓
                    panel_status_histories (user_id)
```

- **customers.user_id** → **users.id** (customer has an associated user account)
- **users.customer_id** → **customers.id** (user belongs to a customer)
- **projects.customer_id** → **customers.id** (project belongs to a customer)
- **buildings.user_id** → **users.id** (building belongs to a user)
- **panels.user_id** → **users.id** (panel belongs to a user)
- **facades.user_id** → **users.id** (facade belongs to a user)
- **panel_status_histories.user_id** → **users.id** (panel status history belongs to a user)

## Deletion Process

When a customer is deleted:

1. **Projects**: `customer_id` is set to NULL (projects remain but are unlinked)
2. **Users**: Any users linked to this customer are deleted
3. **All User-Referenced Tables**: `user_id` is set to NULL in projects, panels, facades, buildings, and panel_status_histories (records remain but are unlinked)
4. **Associated User**: The user account linked to the customer is deleted
5. **Customer**: The customer record is finally deleted

## Benefits

- ✅ Maintains data integrity
- ✅ Prevents orphaned records
- ✅ Preserves project data while unlinking from deleted customer
- ✅ Properly handles the circular reference between customers and users
- ✅ Provides clear feedback to users about what will be deleted

## Usage

The fix is automatically applied when using the customer delete functionality in the CustomersPage. No additional configuration is required.

## Testing

Run the test script to verify the functionality:

```bash
node test_customer_delete.js
```

This will create test data, perform a cascade delete, and verify that all relationships are properly handled.
