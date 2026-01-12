# Franchises Management - Full Redesign Implementation Guide

## Step 1: Add Required Imports
Add these to the existing imports (line ~2):
```javascript
import { FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
```

## Step 2: State Variables Added ✅
Already completed - added after line 86:
- sortField / sortDirection for column sorting
- selectedFranchises / selectAll for bulk selection

## Step 3: Add Handler Functions 
**Location:** After `handleDelete` function (around line 893)

Copy the entire content from `admin/docs/FRANCHISES_NEW_FUNCTIONS.txt` and paste it there.

## Step 4: Update filteredFranchises with Sorting
**Location:** Replace the current filtered logic (around line 895-908)

```javascript
  const filteredFranchises = franchises
    .filter((franchise) => {
      // Search filter
      const matchesSearch =
        franchise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        franchise.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (franchise.franchiseCode || "").toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && franchise.isActive !== false) ||
        (filterStatus === "inactive" && franchise.isActive === false);

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let compareValue = 0;
      
      switch (sortField) {
        case "name":
          compareValue = a.name.localeCompare(b.name);
          break;
        case "email":
          compareValue = a.email.localeCompare(b.email);
          break;
        case "status":
          const aActive = a.isActive !== false ? 1 : 0;
          const bActive = b.isActive !== false ? 1 : 0;
          compareValue = bActive - aActive; // Active first
          break;
        case "carts":
          const aCarts = franchiseCarts[a._id]?.totalCarts || 0;
          const bCarts = franchiseCarts[b._id]?.totalCarts || 0;
          compareValue = aCarts - bCarts;
          break;
        case "createdAt":
          compareValue = new Date(a.createdAt) - new Date(b.createdAt);
          break;
        default:
          compareValue = 0;
      }
      
      return sortDirection === "asc" ? compareValue : -compareValue;
    });
```

## Step 5: Add Bulk Actions Bar
**Location:** After the filter section, before the franchises list (around line 1080)

```jsx
{/* Bulk Actions Bar */}
{selectedFranchises.size > 0 && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-blue-900">
          {selectedFranchises.size} franchise(s) selected
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleBulkActivate}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
        >
          Activate Selected
        </button>
        <button
          onClick={handleBulkDeactivate}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-medium"
        >
          Deactivate Selected
        </button>
        <button
          onClick={() => {
            setSelectedFranchises(new Set());
            setSelectAll(false);
          }}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
        >
          Clear Selection
        </button>
      </div>
    </div>
  </div>
)}
```

## Step 6: Add Table Header with Sort Controls
**Location:** In the list view, before the franchise rows (around line 1240)

Replace the entire list view div with:

```jsx
{/* Modern Table View */}
<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left">
          <input
            type="checkbox"
            checked={selectAll}
            onChange={handleSelectAll}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
        </th>
        <th
          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          onClick={() => handleSort("name")}
        >
          <div className="flex items-center gap-2">
            Franchise Name
            {sortField === "name" && (
              sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />
            )}
            {sortField !== "name" && <FaSort className="opacity-30" />}
          </div>
        </th>
        <th
          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          onClick={() => handleSort("email")}
        >
          <div className="flex items-center gap-2">
            Contact
            {sortField === "email" && (
              sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />
            )}
            {sortField !== "email" && <FaSort className="opacity-30" />}
          </div>
        </th>
        <th
          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          onClick={() => handleSort("status")}
        >
          <div className="flex items-center gap-2">
            Status
            {sortField === "status" && (
              sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />
            )}
            {sortField !== "status" && <FaSort className="opacity-30" />}
          </div>
        </th>
        <th
          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          onClick={() => handleSort("carts")}
        >
          <div className="flex items-center gap-2">
            Carts
            {sortField === "carts" && (
              sortDirection === "asc" ? <FaSortUp /> : <FaSortDown />
            )}
            {sortField !== "carts" && <FaSort className="opacity-30" />}
          </div>
        </th>
        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {filteredFranchises.map((franchise) => {
        const isActive = franchise.isActive !== false;
        const cartStats = franchiseCarts[franchise._id] || {};
        const isSelected = selectedFranchises.has(franchise._id);

        return (
          <tr 
            key={franchise._id}
            className={`${isSelected ? "bg-blue-50" : ""} ${!isActive ? "opacity-60" : ""} hover:bg-gray-50`}
          >
            <td className="px-6 py-4">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleSelectFranchise(franchise._id)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                    isActive
                      ? "bg-gradient-to-br from-blue-500 to-blue-600"
                      : "bg-gray-400"
                  }`}
                >
                  {franchise.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  {franchise.franchiseCode && (
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded mb-1 inline-block">
                      {franchise.franchiseCode}
                    </span>
                  )}
                  <div className="font-semibold text-gray-900">{franchise.name}</div>
                </div>
              </div>
            </td>
            <td className="px-6 py-4">
              <div className="text-sm text-gray-900">{franchise.email}</div>
              {franchise.mobile && (
                <div className="text-sm text-gray-500">{franchise.mobile}</div>
              )}
            </td>
            <td className="px-6 py-4">
              <span
                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  isActive
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {isActive ? "Active" : "Inactive"}
              </span>
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {cartStats.totalCarts || 0} Total
                </span>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                  {cartStats.activeCarts || 0} Active
                </span>
              </div>
            </td>
            <td className="px-6 py-4 text-right">
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setViewDetails(franchise)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View Details"
                >
                  <FaEye size={18} />
                </button>
                <button
                  onClick={() => handleToggleStatus(franchise._id)}
                  className={`p-2 rounded-lg transition-colors ${
                    isActive
                      ? "text-emerald-600 hover:bg-emerald-50"
                      : "text-gray-400 hover:bg-gray-100"
                  }`}
                  title={isActive ? "Deactivate" : "Activate"}
                >
                  {isActive ? <FaToggleOn size={20} /> : <FaToggleOff size={20} />}
                </button>
                <button
                  onClick={() => handleEdit(franchise)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <FaEdit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(franchise._id)}
                  className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <FaTrash size={18} />
                </button>
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
```

## Testing Checklist

After implementing all steps:
- [ ] Table headers appear with sort icons
- [ ] Clicking headers sorts the table
- [ ] Sort direction toggles correctly
- [ ] Select all checkbox works
- [ ] Individual row selection works
- [ ] Bulk actions bar appears when items selected
- [ ] Bulk activate works
- [ ] Bulk deactivate works
- [ ] Clear selection works
- [ ] Mobile responsive (test on small screens)

## Notes

Due to the file size (3000+ lines), these changes need to be made carefully. I recommend:
1. Make a backup of Franchises.jsx first
2. Implement changes in order (imports → state → functions → UI)
3. Test after each major section
4. Use the dev server's hot reload to verify changes

The complete table redesign provides:
- Professional table layout
- Sortable columns
- Bulk selection
- Bulk operations
- Better mobile responsiveness
- Clearer visual hierarchy
