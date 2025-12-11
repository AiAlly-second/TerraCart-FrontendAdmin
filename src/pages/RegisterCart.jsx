import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import Logo from "../assets/images/logo_new.jpeg";

const RegisterCart = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    cartName: "",
    location: "",
    phone: "",
    address: "",
    shopActLicenseExpiry: "",
    fssaiLicenseExpiry: "",
  });
  const [files, setFiles] = useState({
    aadharCard: null,
    panCard: null,
    shopActLicense: null,
    fssaiLicense: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [existingCart, setExistingCart] = useState(null);
  const [searchingExisting, setSearchingExisting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    if (fileList && fileList[0]) {
      setFiles({
        ...files,
        [name]: fileList[0],
      });
    }
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.cartName || !formData.location) {
      setError("Please fill in all required fields");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
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
      if (formData.phone) formDataToSend.append("phone", formData.phone.trim());
      if (formData.address) formDataToSend.append("address", formData.address.trim());
      
      // Append expiry dates if provided (only for documents that can expire)
      if (formData.shopActLicenseExpiry) formDataToSend.append("shopActLicenseExpiry", formData.shopActLicenseExpiry);
      if (formData.fssaiLicenseExpiry) formDataToSend.append("fssaiLicenseExpiry", formData.fssaiLicenseExpiry);

      // Append files if selected
      if (files.aadharCard) formDataToSend.append("aadharCard", files.aadharCard);
      if (files.panCard) formDataToSend.append("panCard", files.panCard);
      if (files.shopActLicense) formDataToSend.append("shopActLicense", files.shopActLicense);
      if (files.fssaiLicense) formDataToSend.append("fssaiLicense", files.fssaiLicense);

      const response = await api.post("/users/register-cafe-admin", formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        skipErrorAlert: true, // Skip API interceptor alert, we'll handle it in component
      });

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
      
      // Provide more helpful error messages
      const lowerErrorMessage = errorMessage.toLowerCase();
      let finalErrorMessage = errorMessage;
      
      if (lowerErrorMessage.includes("email already registered") || lowerErrorMessage.includes("already registered")) {
        // Try to find the existing cart
        setSearchingExisting(true);
        try {
          const usersResponse = await api.get("/users");
          const allUsers = usersResponse.data || [];
          const existingUser = allUsers.find(
            u => u.email && u.email.toLowerCase().trim() === formData.email.toLowerCase().trim()
          );
          
          if (existingUser) {
            setExistingCart({
              id: existingUser._id,
              name: existingUser.cartName || existingUser.name || "Unnamed Cart",
              email: existingUser.email,
              location: existingUser.location || "Not specified",
              status: existingUser.isApproved ? (existingUser.isActive !== false ? "Active" : "Inactive") : "Pending Approval",
              cartCode: existingUser.cartCode,
            });
            finalErrorMessage = `This email address is already registered. The cart "${existingUser.cartName || existingUser.name || 'Unnamed Cart'}" is using this email.`;
          } else {
            finalErrorMessage = `This email address (${formData.email}) is already registered. Please use a different email address.`;
          }
        } catch (searchErr) {
          console.error("Error searching for existing cart:", searchErr);
          finalErrorMessage = `This email address (${formData.email}) is already registered. Please use a different email address.`;
        } finally {
          setSearchingExisting(false);
        }
      }
      
      console.log("Setting error message:", finalErrorMessage);
      setError(finalErrorMessage);
      
      // Force re-render and scroll to error message
      setTimeout(() => {
        const errorElement = document.querySelector('.bg-red-50');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a visual highlight
          errorElement.style.animation = 'none';
          setTimeout(() => {
            errorElement.style.animation = 'pulse 2s ease-in-out';
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
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#f5e3d5]" style={{
      backgroundImage: 'linear-gradient(135deg, #f5e3d5 0%, #fef4ec 50%, #f3ddcb 100%)'
    }}>
      <div className="w-full max-w-4xl space-y-8 bg-white p-8 rounded-xl shadow-lg border border-[#e2c1ac]">
        <div className="flex justify-center">
          <img src={Logo} alt="Terra Cart Logo" className="h-20" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-center text-[#4a2e1f]">
            Register New Cart Admin
          </h2>
          <p className="mt-2 text-center text-sm text-[#6b4423]">
            Fill in the details below to register a new cart under your franchise.
          </p>
          <div className="mt-3 text-center">
            <button
              onClick={async () => {
                const email = prompt("Enter your email address to find your existing cart:");
                if (!email) return;
                
                setSearchingExisting(true);
                setError("");
                setExistingCart(null);
                
                try {
                  const usersResponse = await api.get("/users");
                  const allUsers = usersResponse.data || [];
                  const foundCart = allUsers.find(
                    u => u.role === "admin" && u.email && u.email.toLowerCase().trim() === email.toLowerCase().trim()
                  );
                  
                  if (foundCart) {
                    setExistingCart({
                      id: foundCart._id,
                      name: foundCart.cartName || foundCart.name || "Unnamed Cart",
                      email: foundCart.email,
                      location: foundCart.location || "Not specified",
                      status: foundCart.isApproved ? (foundCart.isActive !== false ? "Active" : "Inactive") : "Pending Approval",
                      cartCode: foundCart.cartCode,
                    });
                    setError(`✅ Cart found for email: ${email}`);
                  } else {
                    setError(`❌ No cart found with email: ${email}. You can proceed with registration.`);
                    setExistingCart(null);
                  }
                } catch (err) {
                  console.error("Error searching for cart:", err);
                  setError("Failed to search for cart. Please try again.");
                } finally {
                  setSearchingExisting(false);
                }
              }}
              className="text-sm text-[#d86d2a] hover:text-[#c75b1a] underline font-medium"
              type="button"
            >
              🔍 Find My Existing Cart
            </button>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">Registration Successful!</p>
            <p className="text-sm mt-1">
              Cart admin account has been created successfully.
              You will be redirected to carts page...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg shadow-md">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="font-bold text-base">Registration Error</p>
                <p className="text-sm mt-1 font-medium">{error}</p>
                
                {/* Show existing cart information if found */}
                {existingCart && (
                  <div className="mt-3 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                    <div className="flex items-start gap-2 mb-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm font-bold text-blue-900">Your Cart Already Exists!</p>
                    </div>
                    <div className="bg-white p-3 rounded border border-blue-200 mb-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700 w-24">Cart Name:</span>
                          <span className="text-gray-900">{existingCart.name}</span>
                        </div>
                        {existingCart.cartCode && (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700 w-24">Cart Code:</span>
                            <span className="px-2 py-1 bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white text-xs font-mono font-bold rounded">
                              {existingCart.cartCode}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700 w-24">Location:</span>
                          <span className="text-gray-900">{existingCart.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700 w-24">Status:</span>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            existingCart.status === "Active" ? "bg-green-100 text-green-800" :
                            existingCart.status === "Inactive" ? "bg-red-100 text-red-800" :
                            "bg-yellow-100 text-yellow-800"
                          }`}>
                            {existingCart.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => navigate(`/carts/${existingCart.id}`)}
                        className="flex-1 px-4 py-2 bg-[#d86d2a] hover:bg-[#c75b1a] text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                        type="button"
                      >
                        📋 View Cart Details
                      </button>
                      <button
                        onClick={() => navigate("/carts")}
                        className="flex-1 px-4 py-2 border border-[#e2c1ac] text-[#4a2e1f] hover:bg-[#fef4ec] text-sm font-semibold rounded-lg transition-colors"
                        type="button"
                      >
                        📋 All Carts
                      </button>
                      <button
                        onClick={() => {
                          setError("");
                          setExistingCart(null);
                          setFormData(prev => ({ ...prev, email: "" }));
                        }}
                        className="flex-1 px-4 py-2 border border-blue-300 text-blue-700 hover:bg-blue-100 text-sm font-semibold rounded-lg transition-colors"
                        type="button"
                      >
                        Use Different Email
                      </button>
                    </div>
                  </div>
                )}
                
                {searchingExisting && (
                  <p className="text-sm mt-2 text-gray-600">Searching for existing cart...</p>
                )}
              </div>
              <button
                onClick={() => {
                  setError("");
                  setExistingCart(null);
                }}
                className="text-red-600 hover:text-red-800 flex-shrink-0 p-1 hover:bg-red-100 rounded"
                aria-label="Dismiss error"
                type="button"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#4a2e1f]">
                Manager Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#4a2e1f]">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="manager@cart.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#4a2e1f]">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Minimum 6 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#4a2e1f]">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Confirm password"
              />
            </div>

            <div>
              <label htmlFor="cartName" className="block text-sm font-medium text-[#4a2e1f]">
                Cart Name <span className="text-red-500">*</span>
              </label>
              <input
                id="cartName"
                name="cartName"
                type="text"
                required
                value={formData.cartName}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Terra Cart Downtown"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-[#4a2e1f]">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                id="location"
                name="location"
                type="text"
                required
                value={formData.location}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Downtown, City"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-[#4a2e1f]">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="+91 1234567890"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-[#4a2e1f]">
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

          {/* Document Upload Section - All Optional */}
          <div className="mt-8 border-t border-[#e2c1ac] pt-6">
            <h3 className="text-lg font-semibold text-[#4a2e1f] mb-2">Owner Documents (Optional)</h3>
            <p className="text-sm text-[#6b4423] mb-4">
              📄 Documents can be uploaded later. You can create the cart now and add documents anytime.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="aadharCard" className="block text-sm font-medium text-[#4a2e1f]">
                  Aadhar Card of Owner
                </label>
                <input
                  id="aadharCard"
                  name="aadharCard"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5]"
                />
                {files.aadharCard && (
                  <p className="mt-1 text-xs text-[#6b4423]">Selected: {files.aadharCard.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="panCard" className="block text-sm font-medium text-[#4a2e1f]">
                  PAN Card
                </label>
                <input
                  id="panCard"
                  name="panCard"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5]"
                />
                {files.panCard && (
                  <p className="mt-1 text-xs text-[#6b4423]">Selected: {files.panCard.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="shopActLicense" className="block text-sm font-medium text-[#4a2e1f]">
                  Shop Act License
                </label>
                <input
                  id="shopActLicense"
                  name="shopActLicense"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5]"
                />
                {files.shopActLicense && (
                  <p className="mt-1 text-xs text-[#6b4423]">Selected: {files.shopActLicense.name}</p>
                )}
                <input
                  type="date"
                  id="shopActLicenseExpiry"
                  name="shopActLicenseExpiry"
                  value={formData.shopActLicenseExpiry}
                  onChange={handleChange}
                  className="mt-2 block w-full border border-[#e2c1ac] rounded-lg px-3 py-2 text-sm text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                />
                <p className="mt-1 text-xs text-[#6b4423]">Expiry Date (Optional)</p>
              </div>

              <div>
                <label htmlFor="fssaiLicense" className="block text-sm font-medium text-[#4a2e1f]">
                  FSSAI License
                </label>
                <input
                  id="fssaiLicense"
                  name="fssaiLicense"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5]"
                />
                {files.fssaiLicense && (
                  <p className="mt-1 text-xs text-[#6b4423]">Selected: {files.fssaiLicense.name}</p>
                )}
                <input
                  type="date"
                  id="fssaiLicenseExpiry"
                  name="fssaiLicenseExpiry"
                  value={formData.fssaiLicenseExpiry}
                  onChange={handleChange}
                  className="mt-2 block w-full border border-[#e2c1ac] rounded-lg px-3 py-2 text-sm text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                />
                <p className="mt-1 text-xs text-[#6b4423]">Expiry Date (Optional)</p>
              </div>

            </div>
            <p className="mt-4 text-xs text-[#6b4423]">
              All documents are optional. Accepted formats: PDF, JPG, PNG, WEBP (Max 10MB per file)
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
                loading ? 'bg-[#c75b1a] cursor-not-allowed opacity-70' : 'bg-[#d86d2a] hover:bg-[#c75b1a]'
              }`}
            >
              {loading ? "Registering..." : "Register Cart Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterCart;
