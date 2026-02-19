import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import Logo from "../assets/images/logo_new.jpeg";
import { useAuth } from "../context/AuthContext";

const RegisterCart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    cartName: "",
    location: "",
    phone: "",
    address: "",
    fssaiNumber: "",
    shopActLicenseExpiry: "",
    fssaiLicenseExpiry: "",
  });
  const [franchises, setFranchises] = useState([]);
  const [franchiseLoading, setFranchiseLoading] = useState(false);
  const [franchiseId, setFranchiseId] = useState("");
  const [files, setFiles] = useState({
    aadharCard: null,
    panCard: null,
    shopActLicense: null,
    fssaiLicense: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Load franchises for super admin so they can assign cart to a franchise
  // Also, for franchise admins, pre-fill FSSAI number from their own profile (editable)
  useEffect(() => {
    const initData = async () => {
      try {
        if (isSuperAdmin) {
          setFranchiseLoading(true);
          const res = await api.get("/users");
          const allUsers = res.data || [];
          const franchiseAdmins = allUsers.filter(
            (u) => u.role === "franchise_admin"
          );
          setFranchises(franchiseAdmins);
        } else {
          // Franchise admin: get own FSSAI number so we can show it by default
          const meRes = await api.get("/users/me");
          const meUser = meRes.data?.user;
          // Prefer fssaiNumber, fallback to gstNumber if old data exists
          const prefillNumber = meUser?.fssaiNumber || meUser?.gstNumber || "";
          
          if (prefillNumber) {
            setFormData((prev) => ({
              ...prev,
              fssaiNumber: prefillNumber,
            }));
          }
        }
      } catch (err) {
        console.error("Error initializing cart registration data:", err);
      } finally {
        if (isSuperAdmin) {
          setFranchiseLoading(false);
        }
      }
    };

    initData();
  }, [isSuperAdmin]);

  // Effect to pre-fill FSSAI number when a franchise is selected (Super Admin)
  useEffect(() => {
    if (isSuperAdmin && franchiseId && franchises.length > 0) {
      const selected = franchises.find(f => f._id === franchiseId);
      if (selected) {
        const prefill = selected.fssaiNumber || selected.gstNumber || "";
        if (prefill) {
           setFormData(prev => ({
             ...prev,
             fssaiNumber: prefill
           }));
        }
      }
    }
  }, [franchiseId, franchises, isSuperAdmin]);

  // Validation functions
  const validateEmail = (email) => {
    if (!email || !email.trim()) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || !phone.trim()) return ""; // Phone is optional
    // Remove spaces, dashes, and country code for validation
    const cleaned = phone.replace(/[\s\-+]/g, "").replace(/^91/, "");
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(cleaned)) {
      return "Please enter a valid 10-digit Indian mobile number";
    }
    return "";
  };

  const validateName = (name) => {
    if (!name || !name.trim()) return "Name is required";
    if (name.trim().length < 2) return "Name must be at least 2 characters";
    if (name.trim().length > 50) return "Name must be less than 50 characters";
    return "";
  };

  const validatePassword = (password) => {
    if (!password || !password.trim()) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return "";
  };
  
  // Revised validation for FSSAI number (14 digits)
  const validateFSSAINumber = (num) => {
    if (!num) return true; // Optional field
    return /^\d{14}$/.test(num);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: "" });
    }
    setError("");
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    if (fileList && fileList[0]) {
      // Check file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (fileList[0].size > maxSize) {
        setFormErrors({
          ...formErrors,
          [name]: "File size must be less than 5MB",
        });
        // Clear the file input
        e.target.value = "";
        return;
      }

      setFiles({
        ...files,
        [name]: fileList[0],
      });
      // Clear error for this field
      if (formErrors[name]) {
        setFormErrors({ ...formErrors, [name]: "" });
      }
    } else {
      // File was removed, clear it from state
      setFiles({
        ...files,
        [name]: null,
      });
      // Set error if this is a required field
      const requiredFields = ["fssaiLicense"];
      if (requiredFields.includes(name)) {
        setFormErrors({
          ...formErrors,
          [name]: "FSSAI License is required",
        });
      }
    }
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setFormErrors({});

    // Trim all form data
    const trimmedData = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password.trim(),
      confirmPassword: formData.confirmPassword.trim(),
      cartName: formData.cartName.trim(),
      location: formData.location.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      fssaiNumber: formData.fssaiNumber.trim(),
      shopActLicenseExpiry: formData.shopActLicenseExpiry,
      fssaiLicenseExpiry: formData.fssaiLicenseExpiry,
    };

    const errors = {};

    // Super admin must select a franchise for the new cart
    if (isSuperAdmin && !franchiseId) {
      errors.franchiseId = "Franchise is required";
    }

    // Validate name
    const nameError = validateName(trimmedData.name);
    if (nameError) errors.name = nameError;

    // Validate email
    const emailError = validateEmail(trimmedData.email);
    if (emailError) errors.email = emailError;

    // Validate password
    const passwordError = validatePassword(trimmedData.password);
    if (passwordError) errors.password = passwordError;

    // Validate confirm password
    if (!trimmedData.confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (trimmedData.password !== trimmedData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    // Validate cart name
    if (!trimmedData.cartName) {
      errors.cartName = "Cart name is required";
    } else if (trimmedData.cartName.length < 2) {
      errors.cartName = "Cart name must be at least 2 characters";
    }

    // Validate location
    if (!trimmedData.location) {
      errors.location = "Location is required";
    } else if (trimmedData.location.length < 2) {
      errors.location = "Location must be at least 2 characters";
    }

    // Validate phone (optional but if provided, must be valid)
    if (trimmedData.phone) {
      const phoneError = validatePhoneNumber(trimmedData.phone);
      if (phoneError) errors.phone = phoneError;
    }

    // FSSAI number validation (Mandatory, 14 digits)
    if (!trimmedData.fssaiNumber) {
       errors.fssaiNumber = "FSSAI Number is required";
    } else if (!validateFSSAINumber(trimmedData.fssaiNumber)) {
       errors.fssaiNumber = "FSSAI Number must be 14 digits";
    }

    // Validate required documents (Shop Act, Aadhar and PAN are optional)
    if (!files.fssaiLicense) {
      errors.fssaiLicense = "FSSAI License is required";
    }

    // If there are errors, display them and stop submission
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      const errorElement = document.querySelector(
        `[name="${firstErrorField}"]`
      );
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
        errorElement.focus();
      }
      return;
    }

    setLoading(true);

    try {
      // Create FormData for file uploads
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name.trim());
      // Normalize email: trim and lowercase
      formDataToSend.append("email", formData.email.trim().toLowerCase());
      formDataToSend.append("password", formData.password);
      formDataToSend.append("cartName", formData.cartName.trim());
      formDataToSend.append("location", formData.location.trim());
      // For super admin, explicitly attach franchiseId so backend can link cart
      if (isSuperAdmin && franchiseId) {
        formDataToSend.append("franchiseId", franchiseId);
      }
      if (formData.phone) formDataToSend.append("phone", formData.phone.trim());
      if (formData.address)
        formDataToSend.append("address", formData.address.trim());
      if (trimmedData.fssaiNumber)
        formDataToSend.append("fssaiNumber", trimmedData.fssaiNumber);

      // Append expiry dates if provided (only for documents that can expire)
      if (formData.shopActLicenseExpiry)
        formDataToSend.append(
          "shopActLicenseExpiry",
          formData.shopActLicenseExpiry
        );
      if (formData.fssaiLicenseExpiry)
        formDataToSend.append(
          "fssaiLicenseExpiry",
          formData.fssaiLicenseExpiry
        );

      // Append files if selected
      if (files.aadharCard)
        formDataToSend.append("aadharCard", files.aadharCard);
      if (files.panCard) formDataToSend.append("panCard", files.panCard);
      if (files.shopActLicense)
        formDataToSend.append("shopActLicense", files.shopActLicense);
      if (files.fssaiLicense)
        formDataToSend.append("fssaiLicense", files.fssaiLicense);

      const response = await api.post(
        "/users/register-cafe-admin",
        formDataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          skipErrorAlert: true, // Skip API interceptor alert, we'll handle it in component
        }
      );

      setSuccess(true);
      setFormData({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        cartName: "",
        location: "",
        phone: "",
        address: "",
        fssaiNumber: "",
        shopActLicenseExpiry: "",
        fssaiLicenseExpiry: "",
      });
      setFiles({
        aadharCard: null,
        panCard: null,
        shopActLicense: null,
        fssaiLicense: null,
      });

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate("/carts");
      }, 3000);
    } catch (err) {
      console.error("Registration error:", err);
      console.error("Error response:", err.response);
      console.error("Error data:", err.response?.data);

      // Extract error message from various possible locations
      let errorMessage = "Registration failed. Please try again.";

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      console.log("Extracted error message:", errorMessage);

      // Map backend errors to form fields
      const lowerErrorMessage = errorMessage.toLowerCase();
      const backendErrors = {};

      if (
        lowerErrorMessage.includes("email already registered") ||
        lowerErrorMessage.includes("already registered")
      ) {
        backendErrors.email = `This email address is already registered. Please use a different email address.`;
      } else if (lowerErrorMessage.includes("email")) {
        backendErrors.email = errorMessage;
      } else if (lowerErrorMessage.includes("password")) {
        backendErrors.password = errorMessage;
      } else if (
        lowerErrorMessage.includes("cart name") ||
        lowerErrorMessage.includes("cartname")
      ) {
        backendErrors.cartName = errorMessage;
      } else if (lowerErrorMessage.includes("location")) {
        backendErrors.location = errorMessage;
      } else {
        setError(errorMessage);
      }

      if (Object.keys(backendErrors).length > 0) {
        setFormErrors((prev) => ({ ...prev, ...backendErrors }));
      }

      // Force re-render and scroll to error message
      setTimeout(() => {
        const errorElement = document.querySelector(".bg-red-50");
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
          // Add a visual highlight
          errorElement.style.animation = "none";
          setTimeout(() => {
            errorElement.style.animation = "pulse 2s ease-in-out";
          }, 10);
        } else {
          console.warn("Error element not found in DOM");
        }
      }, 100);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#f5e3d5]"
      style={{
        backgroundImage:
          "linear-gradient(135deg, #f5e3d5 0%, #fef4ec 50%, #f3ddcb 100%)",
      }}
    >
      <div className="w-full max-w-4xl space-y-8 bg-white p-8 rounded-xl shadow-lg border border-[#e2c1ac]">
        <div className="flex justify-center">
          <img
            src={Logo}
            alt="Terra Cart Logo"
            className="h-20"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-center text-[#4a2e1f]">
            Register Cart
          </h2>
          <p className="mt-2 text-center text-sm text-[#6b4423]">
            {isSuperAdmin
              ? "Fill in the details below to register a new cart under a selected franchise."
              : "Fill in the details below to register a new cart under your franchise."}
          </p>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">Registration Successful!</p>
            <p className="text-sm mt-1">
              Cart admin account has been created successfully. You will be
              redirected to carts page...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg shadow-md">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p className="font-bold text-base">Registration Error</p>
                <p className="text-sm mt-1 font-medium">{error}</p>
              </div>
              <button
                onClick={() => setError("")}
                className="text-red-600 hover:text-red-800 flex-shrink-0 p-1 hover:bg-red-100 rounded"
                aria-label="Dismiss error"
                type="button"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isSuperAdmin && (
              <div className="md:col-span-2">
                <label
                  htmlFor="franchiseId"
                  className="block text-sm font-medium text-[#4a2e1f]"
                >
                  Franchise <span className="text-red-500">*</span>
                </label>
                <select
                  id="franchiseId"
                  name="franchiseId"
                  value={franchiseId}
                  onChange={(e) => {
                    setFranchiseId(e.target.value);
                    if (formErrors.franchiseId) {
                      setFormErrors((prev) => ({
                        ...prev,
                        franchiseId: "",
                      }));
                    }
                  }}
                  disabled={franchiseLoading}
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg bg-[#fef4ec] text-[#4a2e1f] focus:outline-none focus:ring-2 ${
                    formErrors.franchiseId
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-[#e2c1ac] focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                  }`}
                >
                  <option value="">
                    {franchiseLoading
                      ? "Loading franchises..."
                      : "Select a franchise"}
                  </option>
                  {franchises.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name}
                      {f.franchiseCode ? ` (${f.franchiseCode})` : ""}
                    </option>
                  ))}
                </select>
                {formErrors.franchiseId && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.franchiseId}
                  </p>
                )}
              </div>
            )}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border rounded-lg placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 ${
                  formErrors.name
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-[#e2c1ac] focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                }`}
                placeholder="John Doe"
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border rounded-lg placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 ${
                  formErrors.email
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-[#e2c1ac] focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                }`}
                placeholder="manager@cart.com"
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border rounded-lg placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 ${
                  formErrors.password
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-[#e2c1ac] focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                }`}
                placeholder="Minimum 6 characters"
              />
              {formErrors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.password}
                </p>
              )}
              {!formErrors.password && (
                <p className="mt-1 text-xs text-[#6b4423]">
                  Password must be at least 6 characters
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border rounded-lg placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 ${
                  formErrors.confirmPassword
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-[#e2c1ac] focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                }`}
                placeholder="Confirm password"
              />
              {formErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.confirmPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="cartName"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                Cart Name <span className="text-red-500">*</span>
              </label>
              <input
                id="cartName"
                name="cartName"
                type="text"
                required
                value={formData.cartName}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border rounded-lg placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 ${
                  formErrors.cartName
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-[#e2c1ac] focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                }`}
                placeholder="Terra Cart Downtown"
              />
              {formErrors.cartName && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.cartName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="location"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                Location <span className="text-red-500">*</span>
              </label>
              <input
                id="location"
                name="location"
                type="text"
                required
                value={formData.location}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border rounded-lg placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 ${
                  formErrors.location
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-[#e2c1ac] focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                }`}
                placeholder="Downtown, City"
              />
              {formErrors.location && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.location}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border rounded-lg placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 ${
                  formErrors.phone
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-[#e2c1ac] focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                }`}
                placeholder="+91 1234567890"
              />
              {formErrors.phone && (
                <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
              )}
              {!formErrors.phone && (
                <p className="mt-1 text-xs text-[#6b4423]">
                  Optional: 10-digit Indian mobile number
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="fssaiNumber"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                FSSAI Number <span className="text-red-500">*</span>
              </label>
              <input
                id="fssaiNumber"
                name="fssaiNumber"
                type="text"
                value={formData.fssaiNumber}
                onChange={handleChange}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border rounded-lg placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 ${
                  formErrors.fssaiNumber
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-[#e2c1ac] focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                }`}
                placeholder="e.g., 12345678901234"
                maxLength={14}
              />
              {formErrors.fssaiNumber && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.fssaiNumber}
                </p>
              )}
              {!formErrors.fssaiNumber && (
                <p className="mt-1 text-xs text-[#6b4423]">
                  14-digit FSSAI number (Inherited from Franchise)
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="address"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                Address
              </label>
              <textarea
                id="address"
                name="address"
                rows="3"
                value={formData.address}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Full address of the cart"
              />
            </div>
          </div>

          {/* Document Upload Section */}
          <div className="mt-8 border-t border-[#e2c1ac] pt-6">
            <h3 className="text-lg font-semibold text-[#4a2e1f] mb-2">
              Owner Documents
            </h3>
            <p className="text-sm text-[#6b4423] mb-4">
              📄 FSSAI License is required. Shop Act License, Aadhar and PAN are optional.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="aadharCard"
                  className="block text-sm font-medium text-[#4a2e1f]"
                >
                  Aadhar Card of Owner <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                  id="aadharCard"
                  name="aadharCard"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className={`mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5] ${
                    formErrors.aadharCard
                      ? "border border-red-500 rounded-lg"
                      : ""
                  }`}
                />
                {files.aadharCard && (
                  <p className="mt-1 text-xs text-green-600">
                    ✓ Selected: {files.aadharCard.name}
                  </p>
                )}
                {formErrors.aadharCard && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.aadharCard}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="panCard"
                  className="block text-sm font-medium text-[#4a2e1f]"
                >
                  PAN Card <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                  id="panCard"
                  name="panCard"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className={`mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5] ${
                    formErrors.panCard ? "border border-red-500 rounded-lg" : ""
                  }`}
                />
                {files.panCard && (
                  <p className="mt-1 text-xs text-green-600">
                    ✓ Selected: {files.panCard.name}
                  </p>
                )}
                {formErrors.panCard && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.panCard}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="shopActLicense"
                  className="block text-sm font-medium text-[#4a2e1f]"
                >
                  Shop Act License{" "}
                  <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                  id="shopActLicense"
                  name="shopActLicense"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className={`mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5] ${
                    formErrors.shopActLicense
                      ? "border border-red-500 rounded-lg"
                      : ""
                  }`}
                />
                {files.shopActLicense && (
                  <p className="mt-1 text-xs text-green-600">
                    ✓ Selected: {files.shopActLicense.name}
                  </p>
                )}
                {formErrors.shopActLicense && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.shopActLicense}
                  </p>
                )}
                <input
                  type="date"
                  id="shopActLicenseExpiry"
                  name="shopActLicenseExpiry"
                  value={formData.shopActLicenseExpiry}
                  onChange={handleChange}
                  className="mt-2 block w-full border border-[#e2c1ac] rounded-lg px-3 py-2 text-sm text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                />
                <p className="mt-1 text-xs text-[#6b4423]">
                  Expiry Date (Optional)
                </p>
              </div>

              <div>
                <label
                  htmlFor="fssaiLicense"
                  className="block text-sm font-medium text-[#4a2e1f]"
                >
                  FSSAI License <span className="text-red-500">*</span>
                </label>
                <input
                  id="fssaiLicense"
                  name="fssaiLicense"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className={`mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5] ${
                    formErrors.fssaiLicense
                      ? "border border-red-500 rounded-lg"
                      : ""
                  }`}
                />
                {files.fssaiLicense && (
                  <p className="mt-1 text-xs text-green-600">
                    ✓ Selected: {files.fssaiLicense.name}
                  </p>
                )}
                {formErrors.fssaiLicense && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.fssaiLicense}
                  </p>
                )}
                <input
                  type="date"
                  id="fssaiLicenseExpiry"
                  name="fssaiLicenseExpiry"
                  value={formData.fssaiLicenseExpiry}
                  onChange={handleChange}
                  className="mt-2 block w-full border border-[#e2c1ac] rounded-lg px-3 py-2 text-sm text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                />
                <p className="mt-1 text-xs text-[#6b4423]">
                  Expiry Date (Optional)
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-[#6b4423]">
              FSSAI License is required. Shop Act License, Aadhar and PAN are optional. Accepted formats: PDF, JPG, PNG, WEBP (Max 5MB per file)
            </p>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Link
              to="/carts"
              className="px-4 py-2 border border-[#e2c1ac] rounded-lg text-[#4a2e1f] hover:bg-[#fef4ec] transition-colors"
            >
              Back to Carts
            </Link>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 font-bold text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:ring-opacity-50 transition-colors shadow-md ${
                loading
                  ? "bg-[#c75b1a] cursor-not-allowed opacity-70"
                  : "bg-[#d86d2a] hover:bg-[#c75b1a]"
              }`}
            >
              {loading ? "Registering..." : "Register Cart"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterCart;
