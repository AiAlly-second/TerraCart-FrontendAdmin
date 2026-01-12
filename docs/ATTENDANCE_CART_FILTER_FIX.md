# Attendance Management - Cart/Cafe Filtering Fix

## Problem

In the **Franchise Admin** panel, the Attendance Management page shows all employees but **doesn't allow filtering by cart/cafe**. This makes it hard for franchise admins with multiple carts to:
- See which employees belong to which cart
- Track attendance per cart
- Manage attendance efficiently

## Current State

- ❌ No cart/cafe filter dropdown
- ❌ No way to see which cart an employee belongs to in the table
- ❌ All employees shown together without grouping

## Required Changes

### 1. Add Cart Filter Dropdown

**Location:** Around line 635, after the title and before the table

```jsx
{/* Cart/Cafe Filter for Franchise Admins */}
<div className="flex flex-col sm:flex-row gap-3 mb-4">
  <div className="flex-1">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Filter by Cart/Cafe
    </label>
    <select
      value={selectedCart}
      onChange={(e) => setSelectedCart(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      <option value="">All Carts</option>
      {carts.map((cart) => (
        <option key={cart._id} value={cart._id}>
          {cart.cartName || cart.name}
        </option>
      ))}
    </select>
  </div>
  <div className="flex items-end">
    <button
      onClick={fetchTodayAttendance}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      Refresh
    </button>
  </div>
</div>
```

### 2. Add State for Carts and Selected Cart

**Location:** After line 35 (in state declarations)

```javascript
const [carts, setCarts] = useState([]);
const [selectedCart, setSelectedCart] = useState("");
```

### 3. Fetch Carts for Franchise Admin

**Location:** Add new function after `fetchEmployees` (around line 99)

```javascript
const fetchCarts = async () => {
  if (!apiRef.current) return;
  try {
    const response = await apiRef.current.get("/users");
    const allUsers = response.data || [];
    
    // Filter for cart admins (role: "admin")
    const cartAdmins = allUsers.filter((u) => u.role === "admin");
    
    setCarts(cartAdmins);
  } catch (error) {
    console.error("Error fetching carts:", error);
    setCarts([]);
  }
};
```

### 4. Call fetchCarts in useEffect

**Location:** Update the useEffect around line 50

```javascript
useEffect(() => {
  if (!dependenciesLoaded || !apiRef.current) return;

  fetchEmployees();
  fetchCarts(); // Add this line
  fetchTodayAttendance();
  
  // ... rest of the code
}, [activeTab, dependenciesLoaded]);
```

### 5. Filter Employees by Selected Cart

**Location:** Update the employees mapping around line 672

```javascript
{Array.isArray(employees) &&
  employees
    .filter((employee) => {
      // If a cart is selected, only show employees from that cart
      if (selectedCart) {
        return employee.cafeId?.toString() === selectedCart ||
               employee.cafeId?._id?.toString() === selectedCart;
      }
      return true; // Show all if no cart selected
    })
    .map((employee) => {
      // ... rest of the mapping code
```

### 6. Add Cart Column to Table (Optional but Recommended)

**Location:** In the table header (around line 651)

```jsx
<th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
  Cart/Cafe
</th>
```

And in the table body:

```jsx
<td className="px-3 sm:px-6 py-2 sm:py-4 hidden lg:table-cell">
  <span className="text-xs sm:text-sm text-gray-600">
    {employee.cafeName || employee.cafeId?.cartName || "-"}
  </span>
</td>
```

## Benefits After Fix

✅ **Franchise admins can filter attendance by cart**
✅ **Clear visibility of which employee works at which cart**
✅ **Better organization for multi-cart franchises**
✅ **Easier attendance tracking and management**

## Testing Steps

1. Login as franchise admin with multiple carts
2. Go to Attendance Management
3. See dropdown showing all your carts
4. Select a cart from dropdown
5. Table should show only employees from that cart
6. Select "All Carts" to see everyone again

## Alternative: Group by Cart

Instead of a filter, you could also group employees by cart:

```jsx
{Object.entries(groupedEmployees).map(([cartName, cartEmployees]) => (
  <div key={cartName} className="mb-6">
    <h3 className="text-lg font-semibold mb-2 text-gray-700">
      {cartName}
    </h3>
    <table>
      {/* Table for this cart's employees */}
    </table>
  </div>
))}
```

This would show separate tables for each cart, making it even clearer!
