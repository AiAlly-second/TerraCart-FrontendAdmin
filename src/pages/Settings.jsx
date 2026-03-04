import React, { useState, useEffect } from "react";
import {
  FaCog,
  FaUser,
  FaBell,
  FaLock,
  FaSave,
  FaSpinner,
  FaCheck,
  FaEye,
  FaEyeSlash,
  FaPrint,
  FaSignOutAlt
} from "react-icons/fa";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Settings = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // Profile State
  const [profile, setProfile] = useState({
    name: "",
    email: "",
  });

  // Password State
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Notification Preferences
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    newFranchiseAlert: true,
    newCartAlert: true,
    systemUpdates: true,
  });
  const [notificationBroadcast, setNotificationBroadcast] = useState({
    type: "test",
    title: "",
    body: "",
    includeCartAdmin: false,
  });
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSummary, setBroadcastSummary] = useState(null);

  // Check if user is cart admin
  const [userRole, setUserRole] = useState(null);
  const [cartSettings, setCartSettings] = useState({
    pickupEnabled: true,
    deliveryEnabled: false,
    deliveryRadius: 5,
    deliveryCharge: 0,
    pinCode: "",
    contactPhone: "",
    contactEmail: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "India",
      fullAddress: "",
    },
    coordinates: {
      latitude: "",
      longitude: "",
    },
  });
  const [fetchingLocation, setFetchingLocation] = useState(false);

  // Printer Settings
  const [printerSettings, setPrinterSettings] = useState({
    ip: "192.168.1.151",
    port: 9100,
    enabled: true,
  });

  useEffect(() => {
    fetchUserData();
    // Get user role from localStorage - check all possible keys
    let storedUser = null;
    try {
      // Check in priority: superAdminUser > franchiseAdminUser > adminUser
      const superAdminUser = localStorage.getItem("superAdminUser");
      const franchiseAdminUser = localStorage.getItem("franchiseAdminUser");
      const adminUser = localStorage.getItem("adminUser");

      if (superAdminUser) {
        storedUser = JSON.parse(superAdminUser);
      } else if (franchiseAdminUser) {
        storedUser = JSON.parse(franchiseAdminUser);
      } else if (adminUser) {
        storedUser = JSON.parse(adminUser);
      }

      if (storedUser) {
        setUserRole(storedUser.role);
        console.log("[Settings] User role detected:", storedUser.role);

        // If cart admin, fetch cart settings
        if (
          storedUser.role === "admin" ||
          storedUser.role === "cart_admin" ||
          storedUser.role === "manager"
        ) {
          console.log("[Settings] Fetching cart settings for cart admin");
          fetchCartSettings();
        }
      } else {
        console.log("[Settings] No user found in localStorage");
      }
    } catch (err) {
      console.error("Error parsing user data:", err);
    }
  }, []);

  const fetchCartSettings = async () => {
    try {
      const response = await api.get("/carts/my-settings");
      if (response.data.success && response.data.data) {
        const cart = response.data.data;
        setCartSettings({
          pickupEnabled:
            cart.pickupEnabled !== undefined ? cart.pickupEnabled : true,
          deliveryEnabled:
            cart.deliveryEnabled !== undefined ? cart.deliveryEnabled : false,
          deliveryRadius: cart.deliveryRadius || 5,
          deliveryCharge: cart.deliveryCharge || 0,
          pinCode: cart.pinCode || "",
          contactPhone: cart.contactPhone || "",
          contactEmail: cart.contactEmail || "",
          address: cart.address || {
            street: "",
            city: "",
            state: "",
            zipCode: "",
            country: "India",
            fullAddress: "",
          },
          coordinates: cart.coordinates || {
            latitude: "",
            longitude: "",
          },
        });
      }
    } catch (error) {
      console.error("Error fetching cart settings:", error);
    }
  };

  // Reverse geocode coordinates to get address
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            "User-Agent": "TerraCart-Admin-Panel",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch address");
      }

      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        // Format address in Indian style
        const parts = [];

        if (addr.building) {
          parts.push(addr.building);
        } else if (addr.house_name) {
          parts.push(addr.house_name);
        } else if (addr.house_number) {
          parts.push(addr.house_number);
        }

        if (addr.road) {
          parts.push(addr.road);
        }

        if (addr.city) {
          parts.push(addr.city);
        } else if (addr.town) {
          parts.push(addr.town);
        } else if (addr.village) {
          parts.push(addr.village);
        }

        if (addr.state) {
          if (addr.postcode) {
            parts.push(`${addr.state} - ${addr.postcode}`);
          } else {
            parts.push(addr.state);
          }
        } else if (addr.postcode) {
          parts.push(addr.postcode);
        }

        return {
          fullAddress: parts.join(", ") || data.display_name || "",
          pinCode: addr.postcode || "",
          city: addr.city || addr.town || addr.village || "",
          state: addr.state || "",
        };
      }

      return {
        fullAddress: data.display_name || "",
        pinCode: "",
        city: "",
        state: "",
      };
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return null;
    }
  };

  // Get current location using GPS
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setFetchingLocation(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        // Update coordinates
        setCartSettings((prev) => ({
          ...prev,
          coordinates: {
            latitude: latitude,
            longitude: longitude,
          },
        }));

        // Try to reverse geocode to get address
        try {
          const addressData = await reverseGeocode(latitude, longitude);
          if (addressData) {
            setCartSettings((prev) => ({
              ...prev,
              coordinates: {
                latitude: latitude,
                longitude: longitude,
              },
              pinCode: addressData.pinCode || prev.pinCode,
              address: {
                ...prev.address,
                fullAddress:
                  addressData.fullAddress || prev.address.fullAddress,
                city: addressData.city || prev.address.city,
                state: addressData.state || prev.address.state,
                zipCode: addressData.pinCode || prev.address.zipCode,
              },
            }));
            setSuccess(
              "Location captured successfully! Address has been auto-filled.",
            );
            setTimeout(() => setSuccess(""), 3000);
          } else {
            setSuccess(
              "Coordinates captured successfully! Please enter the address manually.",
            );
            setTimeout(() => setSuccess(""), 3000);
          }
        } catch (error) {
          console.error("Error reverse geocoding:", error);
          setSuccess(
            "Coordinates captured successfully! Please enter the address manually.",
          );
          setTimeout(() => setSuccess(""), 3000);
        }

        setFetchingLocation(false);
      },
      (error) => {
        setFetchingLocation(false);
        let errorMessage = "Unable to get your location. ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage +=
              "Please allow location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage += "Location request timed out.";
            break;
          default:
            errorMessage += "An unknown error occurred.";
            break;
        }
        setError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const handleCartSettingsUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setSaving(true);
      // Get user from all possible localStorage keys
      let userData = null;
      const superAdminUser = localStorage.getItem("superAdminUser");
      const franchiseAdminUser = localStorage.getItem("franchiseAdminUser");
      const adminUser = localStorage.getItem("adminUser");

      if (superAdminUser) {
        userData = JSON.parse(superAdminUser);
      } else if (franchiseAdminUser) {
        userData = JSON.parse(franchiseAdminUser);
      } else if (adminUser) {
        userData = JSON.parse(adminUser);
      }

      if (!userData || !userData._id) {
        setError("User ID is missing. Please log in again.");
        setSaving(false);
        return;
      }

      await api.put(`/carts/my-settings`, cartSettings);

      setSuccess("Cart settings updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update cart settings");
    } finally {
      setSaving(false);
    }
  };

  const fetchUserData = async () => {
    try {
      setLoading(true);
      // Get user data from localStorage - check all possible keys
      let storedUser = null;
      const superAdminUser = localStorage.getItem("superAdminUser");
      const franchiseAdminUser = localStorage.getItem("franchiseAdminUser");
      const adminUser = localStorage.getItem("adminUser");

      if (superAdminUser) {
        storedUser = JSON.parse(superAdminUser);
      } else if (franchiseAdminUser) {
        storedUser = JSON.parse(franchiseAdminUser);
      } else if (adminUser) {
        storedUser = JSON.parse(adminUser);
      }

      if (storedUser) {
        setProfile({
          name: storedUser.name || "",
          email: storedUser.email || "",
        });

        // Fetch fresh data from API to get printer settings
        if (storedUser._id) {
          try {
            const res = await api.get(`/users/${storedUser._id}`);
            if (res.data) {
              const freshUser = res.data;
              if (freshUser.printerSettings) {
                setPrinterSettings({
                  ip: freshUser.printerSettings.ip || "192.168.1.151",
                  port: freshUser.printerSettings.port || 9100,
                  enabled: freshUser.printerSettings.enabled !== false,
                });
              }
            }
          } catch (apiErr) {
            console.warn("Could not fetch fresh user data", apiErr);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrinterSettingsUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setSaving(true);

      let storedUserStr =
        localStorage.getItem("adminUser") ||
        localStorage.getItem("franchiseAdminUser") ||
        localStorage.getItem("superAdminUser");
      const userData = storedUserStr ? JSON.parse(storedUserStr) : {};

      if (!userData._id) {
        setError("User ID is missing. Please log in again.");
        return;
      }

      await api.put(`/users/${userData._id}`, {
        printerSettings: printerSettings,
      });

      setSuccess("Printer settings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to update printer settings",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    setError("");
    setSuccess("");

    try {
      setSaving(true);

      const response = await api.post("/print/test", {
        printerIP: printerSettings.ip,
        printerPort: printerSettings.port,
      });

      if (response.data.success) {
        setSuccess("✅ Test print sent successfully! Check your printer.");
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setError("❌ Test print failed. Check printer connection.");
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to send test print";
      setError(`❌ ${errorMsg}`);
      console.error("Test print error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setSaving(true);

      let storedUserStr = null;
      let storageKey = null;

      if (localStorage.getItem("superAdminUser")) {
        storedUserStr = localStorage.getItem("superAdminUser");
        storageKey = "superAdminUser";
      } else if (localStorage.getItem("franchiseAdminUser")) {
        storedUserStr = localStorage.getItem("franchiseAdminUser");
        storageKey = "franchiseAdminUser";
      } else if (localStorage.getItem("adminUser")) {
        storedUserStr = localStorage.getItem("adminUser");
        storageKey = "adminUser";
      }

      const userData = storedUserStr ? JSON.parse(storedUserStr) : {};

      if (!userData._id) {
        setError("User ID is missing. Please log in again.");
        setSaving(false);
        return;
      }

      await api.put(`/users/${userData._id}`, {
        name: profile.name,
        email: profile.email,
      });

      // Update localStorage
      const updatedUser = {
        ...userData,
        name: profile.name,
        email: profile.email,
      };
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(updatedUser));
      }

      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setSaving(true);

      let storedUserStr = null;
      // We don't need storageKey here since we don't update localStorage for password changes
      // But we still need to find the user
      if (localStorage.getItem("superAdminUser")) {
        storedUserStr = localStorage.getItem("superAdminUser");
      } else if (localStorage.getItem("franchiseAdminUser")) {
        storedUserStr = localStorage.getItem("franchiseAdminUser");
      } else if (localStorage.getItem("adminUser")) {
        storedUserStr = localStorage.getItem("adminUser");
      }

      const userData = storedUserStr ? JSON.parse(storedUserStr) : {};

      if (!userData._id) {
        setError("User ID is missing. Please log in again.");
        setSaving(false);
        return;
      }

      await api.put(`/users/${userData._id}`, {
        password: passwordData.newPassword,
      });

      setSuccess("Password changed successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationUpdate = async () => {
    setSuccess("Notification preferences saved!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const getBroadcastDefaults = (type) => {
    const normalizedType = String(type || "custom").toLowerCase();
    if (normalizedType === "test") {
      return {
        title: "Test Notification",
        body: "This is a test notification from your cart admin.",
      };
    }
    if (normalizedType === "maintenance") {
      return {
        title: "Maintenance Update",
        body: "Scheduled maintenance is in progress. Please check app updates.",
      };
    }
    return {
      title: "Cart Announcement",
      body: "",
    };
  };

  const handleSendCartBroadcast = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBroadcastSummary(null);

    if (!(userRole === "admin" || userRole === "cart_admin")) {
      setError("Only cart admin can send cart broadcast notifications.");
      return;
    }

    const defaults = getBroadcastDefaults(notificationBroadcast.type);
    const title = String(
      notificationBroadcast.title || defaults.title,
    ).trim();
    const body = String(notificationBroadcast.body || defaults.body).trim();

    if (!title || !body) {
      setError("Notification title and body are required.");
      return;
    }

    try {
      setSendingBroadcast(true);
      const response = await api.post("/notifications/cart-broadcast", {
        type: notificationBroadcast.type,
        title,
        body,
        includeCartAdmin: notificationBroadcast.includeCartAdmin,
        data: {
          source: "admin_settings",
          uiType: notificationBroadcast.type,
        },
      });

      const summary = response?.data?.summary || null;
      setBroadcastSummary(summary);
      if (response?.data?.success) {
        setSuccess(
          response?.data?.message || "Notification broadcast processed.",
        );
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(response?.data?.message || "Broadcast notification failed.");
      }

      if (notificationBroadcast.type !== "custom") {
        setNotificationBroadcast((prev) => ({
          ...prev,
          title: "",
          body: "",
        }));
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to send broadcast notification",
      );
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleLogoutFromAllDevices = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to logout from all devices? This will invalidate all your active sessions and you will need to login again on all devices.",
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoggingOutAll(true);
      setError("");

      await api.post("/admin/logout-all");

      setSuccess(
        "Successfully logged out from all devices. You will be redirected to login page.",
      );

      // Clear local storage and logout
      setTimeout(() => {
        logout();
        navigate("/login");
      }, 2000);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to logout from all devices",
      );
      setLoggingOutAll(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: FaUser },
    { id: "security", label: "Security", icon: FaLock },
    { id: "notifications", label: "Notifications", icon: FaBell },
    ...(userRole !== "franchise_admin" && userRole !== "super_admin"
      ? [{ id: "printer", label: "Printer Config", icon: FaPrint }]
      : []),
    ...(userRole === "admin" || userRole === "cart_admin"
      ? [{ id: "cart", label: "Cart Settings", icon: FaCog }]
      : []),
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
          <FaCog className="text-white text-lg sm:text-xl" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            Settings
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm">
            Manage your account and preferences
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <FaCheck /> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <div className="flex min-w-max sm:min-w-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <tab.icon className="text-sm sm:text-base" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-3 sm:p-4 md:p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <FaSpinner className="animate-spin text-purple-600 text-2xl" />
            </div>
          ) : (
            <>
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <form
                  onSubmit={handleProfileUpdate}
                  className="max-w-lg space-y-4 sm:space-y-6"
                >
                  <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
                    Profile Information
                  </h2>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) =>
                        setProfile({ ...profile, name: e.target.value })
                      }
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="Enter your name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) =>
                        setProfile({ ...profile, email: e.target.value })
                      }
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="Enter your email"
                    />
                  </div>

                  <div className="pt-3 sm:pt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
                    >
                      {saving ? (
                        <FaSpinner className="animate-spin" />
                      ) : (
                        <FaSave />
                      )}
                      Save Changes
                    </button>
                  </div>
                </form>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <div className="max-w-lg space-y-6 sm:space-y-8">
                  {/* Change Password Section */}
                  <form
                    onSubmit={handlePasswordChange}
                    className="space-y-4 sm:space-y-6"
                  >
                    <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
                      Change Password
                    </h2>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              currentPassword: e.target.value,
                            })
                          }
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-10 sm:pr-12"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords({
                              ...showPasswords,
                              current: !showPasswords.current,
                            })
                          }
                          className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.current ? (
                            <FaEyeSlash className="text-sm" />
                          ) : (
                            <FaEye className="text-sm" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              newPassword: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords({
                              ...showPasswords,
                              new: !showPasswords.new,
                            })
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.new ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordData.confirmPassword}
                          onChange={(e) =>
                            setPasswordData({
                              ...passwordData,
                              confirmPassword: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords({
                              ...showPasswords,
                              confirm: !showPasswords.confirm,
                            })
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.confirm ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <FaLock />
                        )}
                        Update Password
                      </button>
                    </div>
                  </form>

                  {/* Logout from All Devices Section */}
                  <div className="pt-6 border-t border-gray-200">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">
                      Session Management
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 mb-4">
                      Logout from all devices and invalidate all active
                      sessions. You will need to login again on all devices.
                    </p>
                    <button
                      onClick={handleLogoutFromAllDevices}
                      disabled={loggingOutAll}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loggingOutAll ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Logging out...
                        </>
                      ) : (
                        <>
                          <FaSignOutAlt />
                          Logout from All Devices
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <div className="max-w-2xl space-y-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    Notification Preferences
                  </h2>

                  <div className="space-y-4">
                    {[
                      {
                        key: "emailAlerts",
                        label: "Email Alerts",
                        desc: "Receive important alerts via email",
                      },
                      {
                        key: "newFranchiseAlert",
                        label: "New Franchise Alerts",
                        desc: "Get notified when a new franchise registers",
                      },
                      {
                        key: "newCartAlert",
                        label: "New Cart Alerts",
                        desc: "Get notified when a new cart registers",
                      },
                      {
                        key: "systemUpdates",
                        label: "System Updates",
                        desc: "Receive system update notifications",
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-800">
                            {item.label}
                          </p>
                          <p className="text-sm text-gray-500">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={notifications[item.key]}
                            onChange={(e) =>
                              setNotifications({
                                ...notifications,
                                [item.key]: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleNotificationUpdate}
                      className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <FaSave />
                      Save Preferences
                    </button>
                  </div>

                  {(userRole === "admin" || userRole === "cart_admin") && (
                    <form
                      onSubmit={handleSendCartBroadcast}
                      className="pt-6 border-t border-gray-200 space-y-4"
                    >
                      <div>
                        <h3 className="text-base font-semibold text-gray-800">
                          Send Push Notification
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Send test, maintenance, or custom notification to your
                          cart staff devices.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Notification Type
                        </label>
                        <select
                          value={notificationBroadcast.type}
                          onChange={(e) =>
                            setNotificationBroadcast({
                              ...notificationBroadcast,
                              type: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        >
                          <option value="test">Test</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Title
                        </label>
                        <input
                          type="text"
                          value={notificationBroadcast.title}
                          onChange={(e) =>
                            setNotificationBroadcast({
                              ...notificationBroadcast,
                              title: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          placeholder={
                            getBroadcastDefaults(notificationBroadcast.type)
                              .title
                          }
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Message
                        </label>
                        <textarea
                          value={notificationBroadcast.body}
                          onChange={(e) =>
                            setNotificationBroadcast({
                              ...notificationBroadcast,
                              body: e.target.value,
                            })
                          }
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          placeholder={
                            getBroadcastDefaults(notificationBroadcast.type).body
                          }
                        />
                      </div>

                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={notificationBroadcast.includeCartAdmin}
                          onChange={(e) =>
                            setNotificationBroadcast({
                              ...notificationBroadcast,
                              includeCartAdmin: e.target.checked,
                            })
                          }
                          className="h-4 w-4"
                        />
                        Include my cart admin device (if token is saved)
                      </label>

                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={sendingBroadcast}
                          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                          {sendingBroadcast ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            <FaBell />
                          )}
                          Send Notification
                        </button>
                      </div>

                      {broadcastSummary && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                          <p>
                            Recipients: {broadcastSummary.totalRecipients} | With
                            token: {broadcastSummary.recipientsWithToken} | Sent:
                            {" "}
                            {broadcastSummary.successCount}
                          </p>
                          {broadcastSummary.failureCount > 0 && (
                            <p className="text-red-600 mt-1">
                              Failed: {broadcastSummary.failureCount}
                            </p>
                          )}
                          {broadcastSummary.failureCount > 0 &&
                            (broadcastSummary.failureDetails?.[0]?.reason ||
                              broadcastSummary.failureDetails?.[0]?.code ||
                              broadcastSummary.failureDetails?.[0]?.error) && (
                              <p className="text-red-600 mt-1">
                                Reason:{" "}
                                {broadcastSummary.failureDetails?.[0]?.reason ||
                                  broadcastSummary.failureDetails?.[0]?.code ||
                                  broadcastSummary.failureDetails?.[0]?.error}
                              </p>
                            )}
                        </div>
                      )}
                    </form>
                  )}
                </div>
              )}

              {/* Printer Settings Tab */}
              {activeTab === "printer" && (
                <form
                  onSubmit={handlePrinterSettingsUpdate}
                  className="max-w-lg space-y-6"
                >
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    Local Printer Configuration
                  </h2>
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> These settings are used by the{" "}
                      <strong>Local Print Agent</strong> running on your PC. You
                      must run the Print Agent utility for this to work.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        Enable Local Printing
                      </h3>
                      <p className="text-xs text-gray-600">
                        Toggle printing to local IP
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={printerSettings.enabled}
                        onChange={(e) =>
                          setPrinterSettings({
                            ...printerSettings,
                            enabled: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {printerSettings.enabled && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Printer IP Address
                        </label>
                        <input
                          type="text"
                          value={printerSettings.ip}
                          onChange={(e) =>
                            setPrinterSettings({
                              ...printerSettings,
                              ip: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          placeholder="e.g. 192.168.1.151"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The local IP address of your thermal printer
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Printer Port
                        </label>
                        <input
                          type="number"
                          value={printerSettings.port}
                          onChange={(e) =>
                            setPrinterSettings({
                              ...printerSettings,
                              port: parseInt(e.target.value) || 9100,
                            })
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                          placeholder="Default: 9100"
                        />
                      </div>
                    </>
                  )}

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <FaSpinner className="animate-spin" />
                      ) : (
                        <FaSave />
                      )}
                      Save Printer Config
                    </button>
                  </div>
                </form>
              )}

              {/* Cart Settings Tab - Only for Cart Admins */}
              {activeTab === "cart" &&
                (userRole === "admin" || userRole === "cart_admin") && (
                  <form
                    onSubmit={handleCartSettingsUpdate}
                    className="max-w-2xl space-y-6"
                  >
                    <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
                      Pickup & Delivery Settings
                    </h2>

                    {/* Pickup Settings */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-800">
                            Pickup (Takeaway)
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Allow customers to order and collect from your store
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cartSettings.pickupEnabled}
                            onChange={(e) =>
                              setCartSettings({
                                ...cartSettings,
                                pickupEnabled: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Delivery Settings */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-800">
                            Delivery
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Allow customers to get orders delivered to their
                            location
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cartSettings.deliveryEnabled}
                            onChange={(e) =>
                              setCartSettings({
                                ...cartSettings,
                                deliveryEnabled: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>

                      {cartSettings.deliveryEnabled && (
                        <div className="mt-4 space-y-4 pt-4 border-t border-green-200">
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                              Maximum Delivery Radius (km)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="50"
                              value={cartSettings.deliveryRadius}
                              onChange={(e) =>
                                setCartSettings({
                                  ...cartSettings,
                                  deliveryRadius:
                                    parseFloat(e.target.value) || 5,
                                })
                              }
                              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              placeholder="5"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Maximum distance (in km) you can deliver orders
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                              Delivery Charge (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={cartSettings.deliveryCharge}
                              onChange={(e) =>
                                setCartSettings({
                                  ...cartSettings,
                                  deliveryCharge:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              placeholder="0.00"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Additional charge for delivery orders (0 for free
                              delivery)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Contact us */}
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <h3 className="font-semibold text-gray-800 mb-3 sm:mb-4">
                        Contact us
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                        Phone and email shown to customers on the menu page for
                        contact
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                            Contact Phone
                          </label>
                          <input
                            type="text"
                            value={cartSettings.contactPhone || ""}
                            onChange={(e) =>
                              setCartSettings({
                                ...cartSettings,
                                contactPhone: e.target.value.trim(),
                              })
                            }
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            placeholder="e.g., 9876543210"
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                            Contact Email
                          </label>
                          <input
                            type="email"
                            value={cartSettings.contactEmail || ""}
                            onChange={(e) =>
                              setCartSettings({
                                ...cartSettings,
                                contactEmail: e.target.value.trim(),
                              })
                            }
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            placeholder="e.g., cart@example.com"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Store Location */}
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="font-semibold text-gray-800 mb-3 sm:mb-4">
                        Store Location
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                        Set your store address and coordinates for distance
                        calculation
                      </p>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                            Pin Code (Postal Code)
                          </label>
                          <input
                            type="text"
                            value={cartSettings.pinCode || ""}
                            onChange={(e) =>
                              setCartSettings({
                                ...cartSettings,
                                pinCode: e.target.value,
                              })
                            }
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="e.g., 400001"
                            maxLength={6}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Enter 6-digit pin code for easier location search
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                            Full Address
                          </label>
                          <textarea
                            value={cartSettings.address.fullAddress || ""}
                            onChange={(e) =>
                              setCartSettings({
                                ...cartSettings,
                                address: {
                                  ...cartSettings.address,
                                  fullAddress: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            rows={3}
                            placeholder="Enter complete store address"
                          />
                        </div>

                        <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                            <div>
                              <h4 className="text-xs sm:text-sm font-semibold text-blue-900 mb-1">
                                Get Store Location
                              </h4>
                              <p className="text-xs text-blue-700">
                                Use your device's GPS to automatically get
                                coordinates
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleGetCurrentLocation}
                              disabled={fetchingLocation}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {fetchingLocation ? (
                                <>
                                  <FaSpinner className="animate-spin" />
                                  Getting Location...
                                </>
                              ) : (
                                <>📍 Use Current Location</>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-blue-600 mt-2">
                            💡 Make sure you're at your store location and allow
                            location access when prompted.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                              Latitude
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={cartSettings.coordinates.latitude || ""}
                              onChange={(e) =>
                                setCartSettings({
                                  ...cartSettings,
                                  coordinates: {
                                    ...cartSettings.coordinates,
                                    latitude: parseFloat(e.target.value) || "",
                                  },
                                })
                              }
                              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="e.g., 19.0760"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Or get from Google Maps manually
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                              Longitude
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={cartSettings.coordinates.longitude || ""}
                              onChange={(e) =>
                                setCartSettings({
                                  ...cartSettings,
                                  coordinates: {
                                    ...cartSettings.coordinates,
                                    longitude: parseFloat(e.target.value) || "",
                                  },
                                })
                              }
                              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="e.g., 72.8777"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Or get from Google Maps manually
                            </p>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-700">
                            <strong>💡 Alternative method:</strong> Open Google
                            Maps, right-click on your store location, and copy
                            the coordinates manually.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 sm:pt-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
                      >
                        {saving ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <FaSave />
                        )}
                        Save Cart Settings
                      </button>
                    </div>
                  </form>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
