import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../utils/api";
import Logo from "../assets/images/logo_new.jpeg";

const EditCart = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    cartName: "",
    location: "",
    phone: "",
    address: "",
    shopActLicenseExpiry: "",
    fssaiLicenseExpiry: "",
  });
  const [existingDocs, setExistingDocs] = useState({
    aadharCard: "",
    panCard: "",
    shopActLicense: "",
    fssaiLicense: "",
  });
  const [files, setFiles] = useState({
    aadharCard: null,
    panCard: null,
    shopActLicense: null,
    fssaiLicense: null,
  });

  useEffect(() => {
    if (id) {
      fetchCartDetails();
    } else {
      // If no ID, redirect to carts page
      navigate("/carts");
    }
  }, [id]);

  const fetchCartDetails = async () => {
    if (!id) {
      console.error("Cart ID is missing from URL");
      alert("Invalid cart ID. Redirecting to carts page.");
      navigate("/carts");
      return;
    }
    try {
      setFetching(true);
      const response = await api.get(`/users/${id}`);
      const user = response.data;

      // Verify this is a cart admin (role: "admin")
      if (user.role !== "admin") {
        alert("This user is not a cart admin. Cannot edit.");
        navigate("/carts");
        return;
      }

      // Format expiry dates for date inputs (YYYY-MM-DD format)
      const formatDateForInput = (date) => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return d.toISOString().split("T")[0];
      };

      setFormData({
        name: user.name || "",
        email: user.email || "",
        password: "", // Don't pre-fill password
        cartName: user.cartName || user.cafeName || "",
        location: user.location || "",
        phone: user.phone || "",
        address: user.address || "",
        shopActLicenseExpiry: formatDateForInput(user.shopActLicenseExpiry),
        fssaiLicenseExpiry: formatDateForInput(user.fssaiLicenseExpiry),
      });

      // Set existing document paths
      setExistingDocs({
        aadharCard: user.aadharCard || "",
        panCard: user.panCard || "",
        shopActLicense: user.shopActLicense || "",
        fssaiLicense: user.fssaiLicense || "",
      });
    } catch (error) {
      console.error("Error fetching cart details:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to fetch cart details";
      alert(errorMessage);
      // Only navigate away if it's an authorization error
      if (error.response?.status === 403 || error.response?.status === 404) {
        navigate("/carts");
      }
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    if (fileList && fileList[0]) {
      setFiles({
        ...files,
        [name]: fileList[0],
      });
    }
  };

  const getDocumentUrl = (docPath) => {
    if (!docPath) return null;
    if (docPath.startsWith("http")) return docPath;
    const nodeApiBase =
      import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
    const baseUrl = nodeApiBase.replace(/\/$/, "");
    return `${baseUrl}${docPath}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!id) {
      alert("Cart ID is missing. Cannot update cart.");
      navigate("/carts");
      return;
    }

    if (
      !formData.name ||
      !formData.email ||
      !formData.cartName ||
      !formData.location
    ) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);

      // Create FormData for file uploads
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("email", formData.email);
      if (formData.password && formData.password.trim() !== "") {
        formDataToSend.append("password", formData.password);
      }
      formDataToSend.append("cartName", formData.cartName);
      formDataToSend.append("location", formData.location);
      if (formData.phone) formDataToSend.append("phone", formData.phone);
      if (formData.address) formDataToSend.append("address", formData.address);

      // Append expiry dates if provided
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

      // Append files if selected (only new files to update)
      if (files.aadharCard)
        formDataToSend.append("aadharCard", files.aadharCard);
      if (files.panCard) formDataToSend.append("panCard", files.panCard);
      if (files.shopActLicense)
        formDataToSend.append("shopActLicense", files.shopActLicense);
      if (files.fssaiLicense)
        formDataToSend.append("fssaiLicense", files.fssaiLicense);

      await api.put(`/users/${id}`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      alert("Cart updated successfully!");
      navigate("/carts");
    } catch (error) {
      console.error("Error updating cart:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update cart";
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#f5e3d5]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #f5e3d5 0%, #fef4ec 50%, #f3ddcb 100%)",
        }}
      >
        <div className="bg-white rounded-xl shadow-lg p-8 border border-[#e2c1ac]">
          <p className="text-[#6b4423]">Loading cart details...</p>
        </div>
      </div>
    );
  }

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
            Edit Cart Admin
          </h2>
          <p className="mt-2 text-center text-sm text-[#6b4423]">
            Update the cart admin details below.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-[#e2c1ac] placeholder-[#6b4423] text-[#4a2e1f] bg-[#fef4ec] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                placeholder="Leave blank to keep current"
              />
              <p className="mt-1 text-xs text-[#6b4423]">
                Leave blank to keep current password
              </p>
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
              📄 Upload new files to update existing documents. Leave blank to
              keep current documents.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="aadharCard"
                  className="block text-sm font-medium text-[#4a2e1f]"
                >
                  Aadhar Card of Owner
                </label>
                {existingDocs.aadharCard && (
                  <div className="mb-2">
                    <a
                      href={getDocumentUrl(existingDocs.aadharCard)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#d86d2a] hover:underline"
                    >
                      View Current Document →
                    </a>
                  </div>
                )}
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
                    New file: {files.aadharCard.name}
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
                {existingDocs.panCard && (
                  <div className="mb-2">
                    <a
                      href={getDocumentUrl(existingDocs.panCard)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#d86d2a] hover:underline"
                    >
                      View Current Document →
                    </a>
                  </div>
                )}
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
                    New file: {files.panCard.name}
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
                {existingDocs.shopActLicense && (
                  <div className="mb-2">
                    <a
                      href={getDocumentUrl(existingDocs.shopActLicense)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#d86d2a] hover:underline"
                    >
                      View Current Document →
                    </a>
                  </div>
                )}
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
                    New file: {files.shopActLicense.name}
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
                {existingDocs.fssaiLicense && (
                  <div className="mb-2">
                    <a
                      href={getDocumentUrl(existingDocs.fssaiLicense)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#d86d2a] hover:underline"
                    >
                      View Current Document →
                    </a>
                  </div>
                )}
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
                    New file: {files.fssaiLicense.name}
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
              (Max 10MB per file). Leave blank to keep existing documents.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Link
              to="/carts"
              className="px-4 py-2 border border-[#e2c1ac] rounded-lg text-[#4a2e1f] hover:bg-[#fef4ec] transition-colors"
            >
              Cancel
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
              {loading ? "Updating..." : "Update Cart"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCart;
