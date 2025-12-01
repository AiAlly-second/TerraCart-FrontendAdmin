import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Login from './pages/Login';

// Import all pages
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

// TerraCart Admin pages
import Orders from './pages/Orders';
import TakeawayOrders from './pages/TakeawayOrders';
import Invoices from './pages/Invoices';
import Tables from './pages/Tables';
import MenuManager from './pages/MenuManager';
import Payments from './pages/Payments';
import Staff from './pages/Staff';
import EmployeeManagement from './pages/EmployeeManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import TableDashboard from './pages/TableDashboard';
import FeedbackManagement from './pages/FeedbackManagement';
import CustomerManagement from './pages/CustomerManagement';
import InventoryManagement from './pages/InventoryManagement';

// Franchise Admin pages
import Carts from './pages/Carts';
import CartDetails from './pages/CartDetails';
import RegisterCart from './pages/RegisterCart';
import EditCart from './pages/EditCart';
import Reports from './pages/Reports';
import DefaultMenu from './pages/DefaultMenu';

// Super Admin pages
import Franchises from './pages/Franchises';
import Users from './pages/Users';
import RevenueHistory from './pages/RevenueHistory';

// Costing pages
import CostingLayout from './pages/costing/CostingLayout';
import CostingDashboard from './pages/costing/Dashboard';
import Investments from './pages/costing/Investments';
import DailyExpenses from './pages/costing/DailyExpenses';
import InventoryCosting from './pages/costing/InventoryCosting';
import RecipeCosting from './pages/costing/RecipeCosting';
import CostingReports from './pages/costing/Reports';

function App() {
  const location = useLocation();
  const { user } = useAuth();
  const showLayout = user && !['/login', '/'].includes(location.pathname);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="bg-[#f5e3d5] min-h-screen font-sans">
      {showLayout && <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />}

      <div
        className={
          showLayout
            ? 'lg:ml-64 flex flex-col min-h-screen'
            : 'flex flex-col min-h-screen'
        }
      >
        {showLayout && <Navbar onMenuToggle={toggleSidebar} />}
        <main className="flex-1 p-4 md:p-6 bg-[#fef4ec]">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />

            {/* Common routes - accessible by all admin roles */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* TerraCart Admin routes (role: 'admin') */}
            <Route
              path="/takeaway-orders"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <TakeawayOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/menu"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <MenuManager />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Payments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tables"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Tables />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Staff />
                </ProtectedRoute>
              }
            />
            <Route
              path="/table-dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <TableDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feedback"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <FeedbackManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CustomerManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <InventoryManagement />
                </ProtectedRoute>
              }
            />

            {/* Shared routes - accessible by admin and franchise_admin */}
            <Route
              path="/employees"
              element={
                <ProtectedRoute allowedRoles={['admin', 'franchise_admin', 'super_admin']}>
                  <EmployeeManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance"
              element={
                <ProtectedRoute allowedRoles={['admin', 'franchise_admin']}>
                  <AttendanceManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute allowedRoles={['admin', 'franchise_admin']}>
                  <Orders />
                </ProtectedRoute>
              }
            />

            {/* Franchise Admin routes (role: 'franchise_admin') */}
            <Route
              path="/carts"
              element={
                <ProtectedRoute allowedRoles={['franchise_admin']}>
                  <Carts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/carts/new"
              element={
                <ProtectedRoute allowedRoles={['franchise_admin']}>
                  <RegisterCart />
                </ProtectedRoute>
              }
            />
            <Route
              path="/carts/:id"
              element={
                <ProtectedRoute allowedRoles={['franchise_admin']}>
                  <CartDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/carts/:id/edit"
              element={
                <ProtectedRoute allowedRoles={['franchise_admin']}>
                  <EditCart />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['franchise_admin', 'super_admin']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/default-menu"
              element={
                <ProtectedRoute allowedRoles={['franchise_admin', 'super_admin']}>
                  <DefaultMenu />
                </ProtectedRoute>
              }
            />

            {/* Super Admin routes (role: 'super_admin') */}
            <Route
              path="/franchises"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <Franchises />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/revenue-history"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <RevenueHistory />
                </ProtectedRoute>
              }
            />

            {/* Costing routes (Super Admin only, feature flag protected) */}
            <Route
              path="/costing/*"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <Routes>
                    <Route element={<CostingLayout />}>
                      <Route path="dashboard" element={<CostingDashboard />} />
                      <Route path="investments" element={<Investments />} />
                      <Route path="expenses" element={<DailyExpenses />} />
                      <Route path="inventory" element={<InventoryCosting />} />
                      <Route path="recipes" element={<RecipeCosting />} />
                      <Route path="reports" element={<CostingReports />} />
                      <Route index element={<Navigate to="/costing/dashboard" replace />} />
                    </Route>
                  </Routes>
                </ProtectedRoute>
              }
            />

            {/* Redirect unknown routes to login */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;

