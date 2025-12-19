import React from "react";
import { Outlet, NavLink } from "react-router-dom";

const CostingLayout = () => {
  const activeLinkStyle = {
    backgroundColor: "#d86d2a",
    color: "white",
  };

  const submenuItems = [
    { path: "/costing/dashboard", label: "Dashboard" },
    { path: "/costing/investments", label: "Investments" },
    { path: "/costing/expenses", label: "Daily Expenses" },
    { path: "/costing/inventory", label: "Inventory Costing" },
    { path: "/costing/recipes", label: "Recipe Costing" },
  ];

  return (
    <div className="min-h-screen bg-[#fef4ec]">
      <div className="bg-white shadow-md mb-6">
        <div className="px-6 py-4">
          <h1 className="text-3xl font-bold text-[#4a2e1f] mb-4">
            Costing Management
          </h1>
          <nav className="flex space-x-2 overflow-x-auto">
            {submenuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) =>
                  isActive ? activeLinkStyle : undefined
                }
                className="px-4 py-2 rounded-lg hover:bg-[#6b4423] hover:text-white transition-colors text-[#4a2e1f] font-medium whitespace-nowrap"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      <div className="px-6">
        <Outlet />
      </div>
    </div>
  );
};

export default CostingLayout;
