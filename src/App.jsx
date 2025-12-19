import React from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { AlertProvider } from "./context/AlertContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import AlertInitializer from "./components/AlertInitializer";
import ConfirmInitializer from "./components/ConfirmInitializer";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";

// Import all pages
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";

// TerraCart Admin pages
import Orders from "./pages/Orders";
import TakeawayOrders from "./pages/TakeawayOrders";
import Invoices from "./pages/Invoices";
import Tables from "./pages/Tables";
import MenuManager from "./pages/MenuManager";
import Payments from "./pages/Payments";
import Staff from "./pages/Staff";
import EmployeeManagement from "./pages/EmployeeManagement";
import AttendanceManagement from "./pages/AttendanceManagement";
import TableDashboard from "./pages/TableDashboard";
import FeedbackManagement from "./pages/FeedbackManagement";
import CustomerManagement from "./pages/CustomerManagement";
import InventoryManagement from "./pages/InventoryManagement";

// Franchise Admin pages
import Carts from "./pages/Carts";
import CartDetails from "./pages/CartDetails";
import RegisterCart from "./pages/RegisterCart";
import EditCart from "./pages/EditCart";
import Revenue from "./pages/Revenue";
import DefaultMenu from "./pages/DefaultMenu";

// Super Admin pages
import Franchises from "./pages/Franchises";
import Users from "./pages/Users";
import RevenueHistory from "./pages/RevenueHistory";
import Reports from "./pages/Reports";

// Costing v2 pages
import CostingV2Layout from "./pages/costing-v2/CostingV2Layout";
import CostingV2Dashboard from "./pages/costing-v2/Dashboard";
import Ingredients from "./pages/costing-v2/Ingredients";
import Suppliers from "./pages/costing-v2/Suppliers";
import Purchases from "./pages/costing-v2/Purchases";
import Recipes from "./pages/costing-v2/Recipes";
import MenuItems from "./pages/costing-v2/MenuItems";
import Inventory from "./pages/costing-v2/Inventory";
import Waste from "./pages/costing-v2/Waste";
import LabourOverhead from "./pages/costing-v2/LabourOverhead";
import Expenses from "./pages/costing-v2/Expenses";
import CostingV2Reports from "./pages/costing-v2/Reports";

function App() {
  const location = useLocation();
  const { user } = useAuth();
  const showLayout = user && !["/login", "/"].includes(location.pathname);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <AlertProvider>
      <ConfirmProvider>
        <AlertInitializer />
        <ConfirmInitializer />
        <div className="bg-[#f5e3d5] min-h-screen font-sans">
          {showLayout && (
            <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
          )}

          <div
            className={
              showLayout
                ? "flex flex-col min-h-screen transition-all duration-300 lg:ml-64 xl:ml-72"
                : "flex flex-col min-h-screen"
            }
          >
            {showLayout && <Navbar onMenuToggle={toggleSidebar} />}
            <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-6 xl:p-8 bg-[#fef4ec] overflow-x-hidden min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)]">
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
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <TakeawayOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <Invoices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/menu"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <MenuManager />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/payments"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <Payments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tables"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <Tables />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/staff"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <Staff />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/table-dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <TableDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/feedback"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "cart_admin"]}>
                      <FeedbackManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customers"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "cart_admin"]}>
                      <CustomerManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inventory"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "cart_admin"]}>
                      <InventoryManagement />
                    </ProtectedRoute>
                  }
                />

                {/* Shared routes - accessible by admin and franchise_admin */}
                <Route
                  path="/employees"
                  element={
                    <ProtectedRoute
                      allowedRoles={["admin", "franchise_admin", "super_admin"]}
                    >
                      <EmployeeManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/attendance"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "franchise_admin"]}>
                      <AttendanceManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "franchise_admin"]}>
                      <Orders />
                    </ProtectedRoute>
                  }
                />

                {/* Franchise Admin routes (role: 'franchise_admin') */}
                <Route
                  path="/carts"
                  element={
                    <ProtectedRoute
                      allowedRoles={["franchise_admin", "super_admin"]}
                    >
                      <Carts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/carts/new"
                  element={
                    <ProtectedRoute
                      allowedRoles={["franchise_admin", "super_admin"]}
                    >
                      <RegisterCart />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/carts/:id"
                  element={
                    <ProtectedRoute
                      allowedRoles={["franchise_admin", "super_admin"]}
                    >
                      <CartDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/carts/:id/edit"
                  element={
                    <ProtectedRoute
                      allowedRoles={["franchise_admin", "super_admin"]}
                    >
                      <EditCart />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/revenue"
                  element={
                    <ProtectedRoute allowedRoles={["franchise_admin"]}>
                      <Revenue />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <Reports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/default-menu"
                  element={
                    <ProtectedRoute
                      allowedRoles={["franchise_admin", "super_admin"]}
                    >
                      <DefaultMenu />
                    </ProtectedRoute>
                  }
                />

                {/* Super Admin routes (role: 'super_admin') */}
                <Route
                  path="/franchises"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <Franchises />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <Users />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/revenue-history"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <RevenueHistory />
                    </ProtectedRoute>
                  }
                />

                {/* Finances / Costing v2 routes (Super Admin, Franchise Admin, Cart Admin) */}
                <Route
                  path="/costing-v2/*"
                  element={
                    <ProtectedRoute
                      allowedRoles={["super_admin", "franchise_admin", "admin"]}
                    >
                      <Routes>
                        <Route element={<CostingV2Layout />}>
                          <Route
                            path="dashboard"
                            element={<CostingV2Dashboard />}
                          />
                          <Route path="ingredients" element={<Ingredients />} />
                          <Route path="suppliers" element={<Suppliers />} />
                          <Route path="purchases" element={<Purchases />} />
                          <Route path="recipes" element={<Recipes />} />
                          <Route path="menu-items" element={<MenuItems />} />
                          <Route path="inventory" element={<Inventory />} />
                          <Route path="waste" element={<Waste />} />
                          <Route
                            path="labour-overhead"
                            element={<LabourOverhead />}
                          />
                          <Route path="expenses" element={<Expenses />} />
                          <Route
                            path="reports"
                            element={<CostingV2Reports />}
                          />
                          <Route
                            index
                            element={
                              <Navigate to="/costing-v2/dashboard" replace />
                            }
                          />
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
      </ConfirmProvider>
    </AlertProvider>
  );
}

export default App;
