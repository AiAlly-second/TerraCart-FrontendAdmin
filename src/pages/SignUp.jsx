import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import Logo from "../assets/images/logo_new.jpeg";

const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    cafeName: "",
    location: "",
    phone: "",
    address: "",
    franchiseId: "",
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
    if (
      !formData.name ||
      !formData.email ||
      !formData.password ||
      !formData.cafeName ||
      !formData.location ||
      !formData.franchiseId
    ) {
      setError("Please fill in all required fields including Franchise ID");
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
      formDataToSend.append("name", formData.name);
      formDataToSend.append("email", formData.email);
      formDataToSend.append("password", formData.password);
      formDataToSend.append("cafeName", formData.cafeName);
      formDataToSend.append("location", formData.location);
      formDataToSend.append("franchiseId", formData.franchiseId);
      if (formData.phone) formDataToSend.append("phone", formData.phone);
      if (formData.address) formDataToSend.append("address", formData.address);

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
        "/users/register-cafe-admin-public",
        formDataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setSuccess(true);
      setFormData({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        cafeName: "",
        location: "",
        phone: "",
        address: "",
        franchiseId: "",
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
        navigate("/");
      }, 3000);
    } catch (err) {
      setError(
        err.response?.data?.message || "Registration failed. Please try again."
      );
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
          <img src={Logo} alt="Terra Cart Logo" className="h-20" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-center text-[#4a2e1f]">
            Register New Cart Admin
          </h2>
          <p className="mt-2 text-center text-sm text-[#6b4423]">
            Fill in the details below. Your account will be reviewed by
            franchise admin.
          </p>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">Registration Successful!</p>
            <p className="text-sm mt-1">
              Your cart admin account has been created. Waiting for franchise
              admin approval. You will be redirected to login page...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="franchiseId"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                Franchise ID <span className="text-red-500">*</span>
              </label>
              <input
                id="franchiseId"
                name="franchiseId"
                type="text"
                required
                value={formData.franchiseId}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Enter Franchise ID"
              />
              <p className="mt-1 text-xs text-[#6b4423]">
                Get this from your franchise administrator
              </p>
            </div>

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
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="John Doe"
              />
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
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="manager@cart.com"
              />
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
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Minimum 6 characters"
              />
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
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Confirm password"
              />
            </div>

            <div>
              <label
                htmlFor="cafeName"
                className="block text-sm font-medium text-[#4a2e1f]"
              >
                Cart Name <span className="text-red-500">*</span>
              </label>
              <input
                id="cafeName"
                name="cafeName"
                type="text"
                required
                value={formData.cafeName}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Terra Cart Downtown"
              />
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
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Downtown, City"
              />
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
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="+91 1234567890"
              />
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

          {/* Document Upload Section - All Optional */}
          <div className="mt-8 border-t border-[#e2c1ac] pt-6">
            <h3 className="text-lg font-semibold text-[#4a2e1f] mb-2">
              Owner Documents (Optional)
            </h3>
            <p className="text-sm text-[#6b4423] mb-4">
              📄 Documents can be uploaded later. You can register now and add
              documents anytime.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="aadharCard"
                  className="block text-sm font-medium text-[#4a2e1f]"
                >
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
                  <p className="mt-1 text-xs text-[#6b4423]">
                    Selected: {files.aadharCard.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="panCard"
                  className="block text-sm font-medium text-[#4a2e1f]"
                >
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
                  <p className="mt-1 text-xs text-[#6b4423]">
                    Selected: {files.panCard.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="shopActLicense"
                  className="block text-sm font-medium text-[#4a2e1f]"
                >
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
                  <p className="mt-1 text-xs text-[#6b4423]">
                    Selected: {files.shopActLicense.name}
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
                  <p className="mt-1 text-xs text-[#6b4423]">
                    Selected: {files.fssaiLicense.name}
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
              All documents are optional. Accepted formats: PDF, JPG, PNG, WEBP
              (Max 10MB per file)
            </p>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Link
              to="/"
              className="px-4 py-2 border border-[#e2c1ac] rounded-lg text-[#4a2e1f] hover:bg-[#fef4ec]"
            >
              Back to Login
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
              {loading ? "Registering..." : "Register Cart Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignUp;
