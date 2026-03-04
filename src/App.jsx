import React, { Suspense, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { AlertProvider } from "./context/AlertContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import AlertInitializer from "./components/AlertInitializer";
import ConfirmInitializer from "./components/ConfirmInitializer";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import TabletTabs from "./components/TabletTabs";
import AccessibilityButton from "./components/AccessibilityButton";
import Login from "./pages/Login";
import { getSocket } from "./utils/socket";

// Import all pages
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";

// TerraCart Admin pages
import Orders from "./pages/Orders";
import Invoices from "./pages/Invoices";
import Tables from "./pages/Tables";
import MenuManager from "./pages/MenuManager";
import GlobalAddons from "./pages/GlobalAddons";
import Staff from "./pages/Staff";
import EmployeeManagement from "./pages/EmployeeManagement";
import TaskManagement from "./pages/TaskManagement";
import TableDashboard from "./pages/TableDashboard";
// Lazy load AttendanceManagement and Payments to avoid circular dependency issues
import { lazy } from "react";
const AttendanceManagement = lazy(() => import("./pages/AttendanceManagement"));
const Payments = lazy(() => import("./pages/Payments"));
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
import Inventory from "./pages/costing-v2/Inventory";
import Waste from "./pages/costing-v2/Waste";
import LabourOverhead from "./pages/costing-v2/LabourOverhead";
import Expenses from "./pages/costing-v2/Expenses";
import CostingV2Reports from "./pages/costing-v2/Reports";

function App() {
  const location = useLocation();
  const { user } = useAuth();
  const normalizedUserRole =
    user?.role === "cart_admin" ? "admin" : user?.role || "guest";
  const isCartAdmin = normalizedUserRole === "admin";
  const showLayout = user && !["/login", "/"].includes(location.pathname);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  // Initialize socket connection early on app load
  useEffect(() => {
    // Get socket instance - this will create connection if it doesn't exist
    const socket = getSocket();
    
    // Ensure socket is connected
    if (!socket.connected) {
      socket.connect();
    }

    // Log connection status
    if (import.meta.env.DEV) {
      console.log("[App] Socket initialized early:", {
        connected: socket.connected,
        id: socket.id,
      });
    }

    // Cleanup on unmount (though we want to keep connection alive)
    return () => {
      // Don't disconnect on unmount - keep connection alive for better UX
      // Socket will be managed by individual components that need it
    };
  }, []); // Run once on mount

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AlertProvider>
        <ConfirmProvider>
          <AlertInitializer />
          <ConfirmInitializer />
          <div
            className={`bg-white min-h-screen font-sans ${isCartAdmin ? "cart-admin-shell" : ""}`}
            data-user-role={normalizedUserRole}
          >
            {showLayout && (
              <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
            )}

            <div
              className={
                showLayout
                  ? "tc-app-body flex flex-col min-h-screen transition-all duration-300 lg:ml-64"
                  : "tc-app-body flex flex-col min-h-screen"
              }
            >
              {showLayout && <Navbar onMenuToggle={toggleSidebar} />}
              {showLayout && <TabletTabs userRole={normalizedUserRole} />}
              <main className="tc-main-content flex-1 p-4 md:p-6 bg-[#f8f9fa] overflow-x-hidden min-h-[calc(100vh-4rem)]">
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
                        <Navigate to="/orders" replace />
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
                    path="/addons"
                    element={
                      <ProtectedRoute allowedRoles={["super_admin", "franchise_admin"]}>
                        <GlobalAddons />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/payments"
                    element={
                      <ProtectedRoute allowedRoles={["admin"]}>
                        <Suspense
                          fallback={
                            <div className="flex items-center justify-center min-h-screen">
                              <div className="text-lg">Loading...</div>
                            </div>
                          }
                        >
                          <Payments />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tables"
                    element={
                      <ProtectedRoute allowedRoles={["admin"]}>
                        <Tables panelType="TABLE" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/offices"
                    element={
                      <ProtectedRoute allowedRoles={["admin"]}>
                        <Tables panelType="OFFICE" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/takeaway-qr"
                    element={
                      <ProtectedRoute allowedRoles={["admin"]}>
                        <Tables panelType="TAKEAWAY" />
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
                        <Navigate to="/customers" replace />
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
                        allowedRoles={[
                          "admin",
                          "franchise_admin",
                          "super_admin",
                        ]}
                      >
                        <EmployeeManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/attendance"
                    element={
                      <ProtectedRoute
                        allowedRoles={["admin", "franchise_admin"]}
                      >
                        <Suspense
                          fallback={
                            <div className="flex items-center justify-center min-h-screen">
                              <div className="text-lg">Loading...</div>
                            </div>
                          }
                        >
                          <AttendanceManagement />
                        </Suspense>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tasks-management"
                    element={
                      <ProtectedRoute
                        allowedRoles={["admin", "franchise_admin"]}
                      >
                        <TaskManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <ProtectedRoute
                        allowedRoles={["admin", "franchise_admin"]}
                      >
                        <Orders />
                      </ProtectedRoute>
                    }
                  />

                  {/* Franchise Admin routes (role: 'franchise_admin') */}
                  <Route
                    path="/carts"
                    element={
                      <ProtectedRoute allowedRoles={["franchise_admin"]}>
                        <Carts />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/carts/new"
                    element={
                      <ProtectedRoute allowedRoles={["franchise_admin"]}>
                        <RegisterCart />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/carts/:id"
                    element={
                      <ProtectedRoute allowedRoles={["franchise_admin"]}>
                        <CartDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/carts/:id/edit"
                    element={
                      <ProtectedRoute allowedRoles={["franchise_admin"]}>
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
                        allowedRoles={[
                          "super_admin",
                          "franchise_admin",
                          "admin",
                        ]}
                      >
                        <Routes>
                          <Route element={<CostingV2Layout />}>
                            <Route
                              path="dashboard"
                              element={<CostingV2Dashboard />}
                            />
                            <Route
                              path="ingredients"
                              element={<Ingredients />}
                            />
                            <Route path="suppliers" element={<Suppliers />} />
                            <Route path="purchases" element={<Purchases />} />
                            <Route path="recipes" element={<Recipes />} />
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
              {showLayout && <AccessibilityButton />}
            </div>
          </div>
        </ConfirmProvider>
      </AlertProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
