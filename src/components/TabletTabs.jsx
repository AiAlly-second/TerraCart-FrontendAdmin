import React, { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getSidebarMenuItems } from "./Sidebar";

const TabletTabs = ({ userRole }) => {
  const location = useLocation();
  const isCostingEnabled =
    import.meta.env.VITE_FEATURE_COSTING_ENABLED === "true";

  const items = useMemo(
    () => getSidebarMenuItems({ userRole, isCostingEnabled }),
    [userRole, isCostingEnabled],
  );

  if (!userRole || !items.length) return null;

  return (
    <div className="tc-tablet-tabs hidden md:block lg:hidden sticky top-16 z-20 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 py-2 overflow-x-auto">
        <div className="inline-flex min-w-max items-center gap-2">
          {items.map((item) => {
            if (Array.isArray(item.children) && item.children.length > 0) {
              return (
                <div
                  key={item.key || item.label}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1"
                >
                  <span className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {item.label}
                  </span>
                  {item.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className={({ isActive }) =>
                        `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                          isActive
                            ? "bg-[#3d3028] text-white"
                            : "bg-white text-gray-700 hover:bg-gray-200"
                        }`
                      }
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/dashboard"}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ||
                    (item.path === "/tables" &&
                      (location.pathname === "/offices" ||
                        location.pathname.startsWith("/offices/") ||
                        location.pathname === "/takeaway-qr" ||
                        location.pathname.startsWith("/takeaway-qr/") ||
                        location.pathname === "/table-dashboard" ||
                        location.pathname.startsWith("/table-dashboard/")))
                      ? "bg-[#3d3028] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TabletTabs;
