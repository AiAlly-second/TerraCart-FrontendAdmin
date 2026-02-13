# Unified Admin Portal

A unified admin portal that combines TerraCart Admin, Franchise Admin, and Super Admin into a single application with role-based access control.

## Features

- **Multi-Role Support**: Supports three admin roles:
  - `admin` - TerraCart Admin (cafe operations management)
  - `franchise_admin` - Franchise Admin (cart and franchise management)
  - `super_admin` - Super Admin (system-wide administration)

- **Role-Based Routing**: Different pages and features are accessible based on user role
- **Unified Authentication**: Single login page that automatically detects user role
- **Unified API**: Smart API utility that uses the correct authentication token based on role

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory (optional, defaults to `http://localhost:5001`):
```
VITE_NODE_API_URL=http://localhost:5001
VITE_FEATURE_COSTING_ENABLED=true
```

   - `VITE_FEATURE_COSTING_ENABLED`: Set to `"true"` to show the Finances panel (BOM, Inventory, Food Cost) in the sidebar. Required for cart/franchise/super admin to access costing features.

3. Run the development server:
```bash
npm run dev
```

4. Access the portal at `http://localhost:5173` (or the port shown in terminal)

## Login Credentials

### Super Admin
- **Email**: `superadmin@terra.cart`
- **Password**: `Admin@123`

### Franchise Admin
- **Email**: `franchise@terra.cart`
- **Password**: `Admin@123`

### TerraCart Admin (Cafe Admin)
- **Email**: `admin@terra.cart` (or as configured)
- **Password**: As set during admin creation

## Architecture

### Directory Structure
```
unified-admin/
├── src/
│   ├── components/     # Shared components (Sidebar, Navbar, ProtectedRoute, etc.)
│   ├── context/        # AuthContext for unified authentication
│   ├── pages/          # All pages from all three admin types
│   ├── utils/          # API utility with role-based token handling
│   ├── domain/         # Business logic utilities
│   ├── assets/         # Images and static assets
│   ├── App.jsx         # Main app with role-based routing
│   └── main.jsx        # Entry point
├── package.json
└── vite.config.js
```

### Authentication Flow

1. User logs in with email/password
2. Backend validates credentials and returns user data with role
3. Frontend stores token and user data in role-specific localStorage keys:
   - Super Admin: `superAdminToken`, `superAdminUser`
   - Franchise Admin: `franchiseAdminToken`, `franchiseAdminUser`
   - Admin: `adminToken`, `adminUser`
4. API utility automatically uses the correct token based on what's stored
5. Protected routes check user role and redirect if unauthorized

### Role-Based Access

- **Super Admin**: Access to franchises, users, revenue history, default menu, reports
- **Franchise Admin**: Access to cart management, reports, employees, attendance, default menu
- **Admin**: Access to orders, tables, menu, payments, inventory, customers, employees, attendance

## Backend Connection

The unified admin connects to the same backend API as the individual admin portals:
- **API Base URL**: Configured via `VITE_NODE_API_URL` environment variable (default: `http://localhost:5001`)
- **Authentication**: Uses JWT tokens stored in localStorage
- **CORS**: Backend CORS is configured to allow requests from the unified admin

### Backend Setup

Ensure the backend server is running and configured to accept requests from the unified admin:

1. The backend should be running on port 5001 (default)
2. CORS is configured in `backend/middleware/securityMiddleware.js`
3. In development mode, CORS allows all origins
4. In production, configure `ALLOWED_ORIGINS` in backend `.env` file

## Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## Migration from Separate Admin Portals

This unified admin replaces the need for three separate admin applications:
- `TerraCart-admin/` - Now merged into unified-admin with role='admin'
- `franchise-admin/` - Now merged into unified-admin with role='franchise_admin'
- `super-admin/` - Now merged into unified-admin with role='super_admin'

All functionality from the three separate portals is preserved and accessible based on user role.

