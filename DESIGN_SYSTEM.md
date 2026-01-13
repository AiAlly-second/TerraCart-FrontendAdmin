# New Admin Panel Design System

## Overview
This document outlines the new design system implemented for the TerraCart Admin Panel, based on the reference design provided.

## Color Palette

### Primary Colors
- **Sidebar Background**: `#3d3028` (Dark charcoal brown)
- **Primary Orange**: `#ff6b35` (Vibrant orange for active states, buttons, accents)
- **Success Green**: `#10b981` (For status badges like "Active")
- **Error Red**: `#ef4444` (For logout button, errors)

### Neutral Colors
- **Background**: `#ffffff` (White - main app background)
- **Content Background**: `#f8f9fa` (Light gray - main content area)
- **Text Primary**: `#2d3748` (Dark gray for headings)
- **Text Secondary**: `#718096` (Medium gray for body text)
- **Text Muted**: `#a0aec0` (Light gray for labels)
- **Border**: `#e2e8f0` (Light gray for borders)
- **Divider**: `rgba(255,255,255,0.1)` (White with opacity for sidebar dividers)

## Typography

### Font Family
- Primary: System font stack (default Tailwind)
- Fallback: `font-sans`

### Font Sizes
- **Heading 1**: `text-2xl` (24px)
- **Heading 2**: `text-xl` (20px)
- **Heading 3**: `text-lg` (18px)
- **Body**: `text-sm` (14px)
- **Small**: `text-xs` (12px)

### Font Weights
- **Bold**: `font-bold` (700)
- **Semibold**: `font-semibold` (600)
- **Medium**: `font-medium` (500)
- **Regular**: `font-normal` (400)

## Components

### Sidebar
- **Width**: `w-64` (256px)
- **Background**: `#3d3028`
- **Active Link**: `bg-[#ff6b35]` with white text
- **Hover State**: `bg-white/5` (5% white overlay)
- **Icons**: From `react-icons/fa` (Font Awesome)
- **User Avatar**: Orange circle (`#ff6b35`) with white initial

### Navbar
- **Height**: `h-16` (64px)
- **Background**: `bg-white`
- **Border**: `border-b border-gray-200`
- **Logout Button**: Red (`bg-red-500`)
- **User Avatar**: Orange circle matching sidebar

### Cards
- **Background**: `bg-white`
- **Border**: `border border-gray-200`
- **Border Radius**: `rounded-lg` (8px)
- **Shadow**: `shadow-sm` (subtle)
- **Hover Shadow**: `hover:shadow-md`
- **Padding**: `p-4` or `p-6` depending on content

### Buttons

#### Primary Button
```jsx
className="px-4 py-2 bg-[#ff6b35] text-white rounded-lg hover:bg-[#ff5722] transition-all shadow-sm hover:shadow-md"
```

#### Secondary Button
```jsx
className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
```

#### Danger Button
```jsx
className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
```

### Status Badges
```jsx
// Active
className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold"

// Inactive
className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold"

// Pending
className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold"
```

### Tables
- **Header Background**: `bg-gray-50`
- **Header Text**: `text-gray-500 uppercase text-xs font-medium`
- **Row Hover**: `hover:bg-gray-50`
- **Border**: `border-b border-gray-200`

### Forms

#### Input Fields
```jsx
className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent"
```

#### Labels
```jsx
className="block text-sm font-medium text-gray-700 mb-2"
```

## Spacing

### Padding
- **Small**: `p-2` (8px)
- **Medium**: `p-4` (16px)
- **Large**: `p-6` (24px)

### Margin
- **Small**: `m-2` (8px)
- **Medium**: `m-4` (16px)
- **Large**: `m-6` (24px)

### Gap (for Flexbox/Grid)
- **Small**: `gap-2` (8px)
- **Medium**: `gap-4` (16px)
- **Large**: `gap-6` (24px)

## Icons

### Icon Library
Using `react-icons` (Font Awesome icons)

### Common Icons
```jsx
import {
  FaChartBar,      // Dashboard
  FaBuilding,      // Franchises
  FaUtensils,      // Menu/Food
  FaUsers,         // Users/Employees
  FaShoppingCart,  // Carts
  FaBox,           // Orders
  FaDollarSign,    // Revenue/Costing
  FaCog,           // Settings
  FaSignOutAlt,    // Logout
} from 'react-icons/fa';
```

### Icon Sizes
- **Small**: `w-4 h-4` (16px)
- **Medium**: `w-5 h-5` (20px)
- **Large**: `w-6 h-6` (24px)

## Transitions

### Standard Transition
```jsx
className="transition-all duration-200"
```

### Hover Effects
```jsx
className="hover:scale-105 transition-transform duration-200"
```

## Shadows

### Card Shadow
```jsx
className="shadow-sm hover:shadow-md transition-shadow"
```

### Button Shadow
```jsx
className="shadow-sm hover:shadow-lg transition-shadow"
```

## Border Radius

### Standard
- **Small**: `rounded` (4px)
- **Medium**: `rounded-lg` (8px)
- **Large**: `rounded-xl` (12px)
- **Full**: `rounded-full` (9999px - for circles)

## Implementation Checklist

### ✅ Completed
- [x] Sidebar redesign with dark theme
- [x] Navbar redesign with clean white background
- [x] App.jsx layout updates
- [x] New color scheme implementation

### 🔄 Next Steps (To Match Reference Image)
- [ ] Employee Management page redesign
- [ ] Dashboard cards redesign
- [ ] All list/table views (Franchises, Users, etc.)
- [ ] Form pages redesign
- [ ] Modal/Dialog redesign
- [ ] Settings page redesign

## Usage Examples

### Page Header
```jsx
<div className="mb-6">
  <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
  <p className="text-sm text-gray-500 mt-1">
    Manage employees hierarchically by Franchise and Cart
  </p>
</div>
```

### Search Bar
```jsx
<div className="relative">
  <input
    type="text"
    placeholder="Search by franchise, cart, or employee name..."
    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent"
  />
  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
</div>
```

### Card with Hover Effect
```jsx
<div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
  {/* Card content */}
</div>
```

## Notes
- All functionality remains unchanged
- Only visual/UI changes applied
- Responsive design maintained
- Accessibility preserved
