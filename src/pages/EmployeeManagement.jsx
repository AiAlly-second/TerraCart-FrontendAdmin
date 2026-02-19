import React, { useState, useEffect } from "react";
import {
  FaUsers,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSpinner,
  FaSearch,
  FaBuilding,
  FaStore,
  FaChevronDown,
  FaChevronRight,
} from "react-icons/fa";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

// Minimum age as per Indian Labor Laws (18 years for general employment)
const MINIMUM_WORKING_AGE = 18;

const pad2 = (value) => String(value).padStart(2, "0");

const normalizeTwoDigitYear = (year) => {
  if (year >= 100) return year;
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const currentYearTwoDigits = currentYear % 100;
  return year <= currentYearTwoDigits
    ? currentCentury + year
    : currentCentury - 100 + year;
};

const parseDOBToLocalDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const normalized = String(value).trim();
  if (!normalized) return null;

  // Primary input format from <input type="date">
  const yyyyMmDdMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDdMatch) {
    const year = Number(yyyyMmDdMatch[1]);
    const month = Number(yyyyMmDdMatch[2]);
    const day = Number(yyyyMmDdMatch[3]);
    return new Date(year, month - 1, day);
  }

  // Support legacy dd/mm/yy, dd/mm/yyyy, dd-mm-yy and dd-mm-yyyy
  const ddMmYyyyMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (ddMmYyyyMatch) {
    const day = Number(ddMmYyyyMatch[1]);
    const month = Number(ddMmYyyyMatch[2]);
    const rawYear = Number(ddMmYyyyMatch[3]);
    const year = normalizeTwoDigitYear(rawYear);
    return new Date(year, month - 1, day);
  }

  // Fallback for ISO date-time values from backend
  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return normalized.includes("T")
    ? new Date(
        parsedDate.getUTCFullYear(),
        parsedDate.getUTCMonth(),
        parsedDate.getUTCDate()
      )
    : new Date(
        parsedDate.getFullYear(),
        parsedDate.getMonth(),
        parsedDate.getDate()
      );
};

const formatDateForDateInput = (value) => {
  if (!value) return "";

  const normalized = String(value).trim();
  const yyyyMmDdMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDdMatch) {
    return `${yyyyMmDdMatch[1]}-${yyyyMmDdMatch[2]}-${yyyyMmDdMatch[3]}`;
  }

  const ddMmYyyyMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (ddMmYyyyMatch) {
    const day = pad2(ddMmYyyyMatch[1]);
    const month = pad2(ddMmYyyyMatch[2]);
    const year = String(normalizeTwoDigitYear(Number(ddMmYyyyMatch[3])));
    return `${year}-${month}-${day}`;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "";
  // Use UTC components to avoid timezone-shifted day values from backend ISO strings.
  return `${parsedDate.getUTCFullYear()}-${pad2(
    parsedDate.getUTCMonth() + 1
  )}-${pad2(parsedDate.getUTCDate())}`;
};

// Helper function to calculate age from DOB
const calculateAge = (dateOfBirth) => {
  const birthDate = parseDOBToLocalDate(dateOfBirth);
  if (!birthDate) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

// Helper function to get maximum DOB date (18 years ago from today)
const getMaxDOBDate = () => {
  const today = new Date();
  const maxDate = new Date(
    today.getFullYear() - MINIMUM_WORKING_AGE,
    today.getMonth(),
    today.getDate()
  );
  return `${maxDate.getFullYear()}-${pad2(maxDate.getMonth() + 1)}-${pad2(
    maxDate.getDate()
  )}`;
};

// Validation functions
const validateEmail = (email) => {
  if (!email) return true; // Optional for editing
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhoneNumber = (phone) => {
  if (!phone) return false; // Required field
  // Remove spaces, dashes, and plus signs for validation
  const cleaned = phone.replace(/[\s\-+]/g, "");
  // Indian phone number: 10 digits, optionally starting with 91
  const phoneRegex = /^(91)?[6-9]\d{9}$/;
  return phoneRegex.test(cleaned);
};

const validateName = (name) => {
  if (!name || !name.trim()) return false;
  // Name should be at least 2 characters and contain only letters, spaces, and common name characters
  const nameRegex = /^[a-zA-Z\s.'-]{2,50}$/;
  return nameRegex.test(name.trim());
};

const validatePassword = (password) => {
  if (!password) return false;
  // Password must be at least 6 characters
  return password.length >= 6;
};

const validateIMEI = (imei) => {
  if (!imei) return true; // Optional field
  // IMEI should be 15 digits
  const imeiRegex = /^\d{15}$/;
  return imeiRegex.test(imei.replace(/\s/g, ""));
};

const validateDateOfBirth = (dob) => {
  if (!dob) return false;
  const dobDate = parseDOBToLocalDate(dob);
  if (!dobDate || Number.isNaN(dobDate.getTime())) return false;

  const today = new Date();
  const normalizedToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  // Date should not be in the future
  if (dobDate > normalizedToday) return false;

  // Date should be reasonable (not more than 100 years ago)
  const minDate = new Date(
    today.getFullYear() - 100,
    today.getMonth(),
    today.getDate()
  );
  return dobDate >= minDate;
};

const EmployeeManagement = () => {
  const { user } = useAuth();
  const userRole = user?.role;
  const isCartAdmin = userRole === "admin";
  const [hierarchy, setHierarchy] = useState([]);
  const [orphanEmployees, setOrphanEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedFranchises, setExpandedFranchises] = useState(new Set());
  const [expandedCafes, setExpandedCafes] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedFranchise, setSelectedFranchise] = useState("");
  const [selectedCafe, setSelectedCafe] = useState("");
  const [franchises, setFranchises] = useState([]);
  const [cafes, setCafes] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    dateOfBirth: "",
    mobile: "",
    email: "", // Add email field for user creation
    password: "", // Add password field for user creation
    role: "waiter", // Use role instead of employeeRole
    franchiseId: "",
    cafeId: "",
    kycVerified: false,
    disability: {
      hasDisability: false,
      type: "",
    },
    deviceIssued: {
      smartwatch: false,
      tracker: false,
    },
    imei: {
      device: "",
      phone: "",
    },
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch hierarchical structure
      const hierarchyResponse = await api.get("/employees/hierarchy");
      setHierarchy(hierarchyResponse.data.hierarchy || []);
      setOrphanEmployees(hierarchyResponse.data.orphanEmployees || []);

      // Fetch franchises and cafes for dropdowns (only for franchise admin and super admin)
      if (!isCartAdmin) {
        const usersResponse = await api.get("/users");
        const allUsers = usersResponse.data || [];
        const allFranchises = allUsers.filter(
          (u) => u.role === "franchise_admin"
        );

        // For franchise admin, ensure their own franchise is in the list
        if (userRole === "franchise_admin" && user?._id) {
          const currentFranchise = allFranchises.find(
            (f) =>
              f._id?.toString() === user._id?.toString() || f._id === user._id
          );
          // If current franchise not found in list, add it
          if (!currentFranchise) {
            allFranchises.push({
              _id: user._id,
              name: user.name || user.franchiseName || "My Franchise",
              email: user.email,
            });
          }
        }

        setFranchises(allFranchises);
        setCafes(allUsers.filter((u) => u.role === "admin"));
      }

      // Expand all by default
      const franchiseIds = hierarchyResponse.data.hierarchy.map((f) => f._id);
      setExpandedFranchises(new Set(franchiseIds));
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Failed to fetch employee data");
    } finally {
      setLoading(false);
    }
  };

  const toggleFranchise = (franchiseId) => {
    const newExpanded = new Set(expandedFranchises);
    if (newExpanded.has(franchiseId)) {
      newExpanded.delete(franchiseId);
    } else {
      newExpanded.add(franchiseId);
    }
    setExpandedFranchises(newExpanded);
  };

  const toggleCafe = (cafeId) => {
    const newExpanded = new Set(expandedCafes);
    if (newExpanded.has(cafeId)) {
      newExpanded.delete(cafeId);
    } else {
      newExpanded.add(cafeId);
    }
    setExpandedCafes(newExpanded);
  };

  const handleFranchiseChange = (franchiseId) => {
    const franchiseIdStr = franchiseId?.toString() || franchiseId || "";
    setSelectedFranchise(franchiseIdStr);
    setSelectedCafe(""); // Reset cafe selection
    setFormData({ ...formData, franchiseId: franchiseIdStr, cafeId: "" });
  };

  const handleCafeChange = (cafeId) => {
    const cafeIdStr = cafeId?.toString() || cafeId || "";
    setSelectedCafe(cafeIdStr);
    setFormData({ ...formData, cafeId: cafeIdStr });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    // Trim all form data
    const trimmedData = {
      name: formData.name.trim(),
      dateOfBirth: formData.dateOfBirth,
      mobile: formData.mobile.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password.trim(),
      role: formData.role,
      franchiseId: formData.franchiseId,
      cafeId: formData.cafeId,
      kycVerified: formData.kycVerified,
      disability: formData.disability,
      deviceIssued: formData.deviceIssued,
      imei: {
        device: formData.imei.device.trim(),
        phone: formData.imei.phone.trim(),
      },
      isActive: formData.isActive,
    };

    // Validation errors object
    const errors = {};

    // Name validation
    if (!trimmedData.name) {
      errors.name = "Name is required";
    } else if (!validateName(trimmedData.name)) {
      errors.name =
        "Name must be 2-50 characters and contain only letters, spaces, and common name characters";
    }

    // Date of Birth validation
    if (!trimmedData.dateOfBirth) {
      errors.dateOfBirth = "Date of birth is required";
    } else if (!validateDateOfBirth(trimmedData.dateOfBirth)) {
      errors.dateOfBirth =
        "Date of birth must be a valid date (not in the future and not more than 100 years ago)";
    } else {
      const age = calculateAge(trimmedData.dateOfBirth);
      if (age < MINIMUM_WORKING_AGE) {
        errors.dateOfBirth = `Age must be at least ${MINIMUM_WORKING_AGE} years as per Indian Labor Laws. Current age: ${age} years`;
      }
    }

    // Mobile validation
    if (!trimmedData.mobile) {
      errors.mobile = "Mobile number is required";
    } else if (!validatePhoneNumber(trimmedData.mobile)) {
      errors.mobile =
        "Please enter a valid 10-digit Indian mobile number (e.g., 9876543210 or +91 9876543210)";
    }

    // Email validation (required for new employees, optional for editing)
    if (!editingEmployee) {
      if (!trimmedData.email) {
        errors.email = "Email is required for new employees";
      } else if (!validateEmail(trimmedData.email)) {
        errors.email = "Please enter a valid email address";
      }
    } else if (trimmedData.email && !validateEmail(trimmedData.email)) {
      errors.email = "Please enter a valid email address";
    }

    // Password validation (required for new employees)
    if (!editingEmployee) {
      if (!trimmedData.password) {
        errors.password = "Password is required";
      } else if (!validatePassword(trimmedData.password)) {
        errors.password = "Password must be at least 6 characters long";
      }
    } else if (
      trimmedData.password &&
      !validatePassword(trimmedData.password)
    ) {
      errors.password = "Password must be at least 6 characters long";
    }

    // IMEI validation (if provided)
    if (trimmedData.imei.device && !validateIMEI(trimmedData.imei.device)) {
      errors.imeiDevice = "Device IMEI must be exactly 15 digits";
    }
    if (trimmedData.imei.phone && !validateIMEI(trimmedData.imei.phone)) {
      errors.imeiPhone = "Phone IMEI must be exactly 15 digits";
    }

    // Role validation
    if (!trimmedData.role) {
      errors.role = "Role is required";
    }

    // Franchise validation (for super admin and franchise admin)
    if (!isCartAdmin) {
      const franchiseIdToCheck = selectedFranchise || trimmedData.franchiseId;
      if (!franchiseIdToCheck) {
        errors.franchiseId = "Franchise selection is required";
      }
    }

    // Disability type validation (if disability is checked)
    // Disability type is optional now
    /*
    if (
      trimmedData.disability.hasDisability &&
      !trimmedData.disability.type?.trim()
    ) {
      errors.disabilityType = "Please specify the type of disability";
    }
    */

    // If there are errors, display them and stop submission
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      const errorElement =
        document.querySelector(`[name="${firstErrorField}"]`) ||
        document.querySelector(`#${firstErrorField}`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
        errorElement.focus();
      }
      return;
    }

    try {
      const submitData = {
        ...trimmedData,
        dateOfBirth: trimmedData.dateOfBirth || undefined,
        franchiseId: selectedFranchise || trimmedData.franchiseId || undefined,
        cafeId: selectedCafe || trimmedData.cafeId || undefined,
        employeeRole: trimmedData.role, // Map role to employeeRole for Employee model compatibility
        role: trimmedData.role, // Also send role for User creation
        // Clean mobile number
        mobile: trimmedData.mobile.replace(/[\s\-]/g, ""),
        // Clean IMEI numbers
        imei: {
          device: trimmedData.imei.device || undefined,
          phone: trimmedData.imei.phone || undefined,
        },
      };

      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee._id}`, submitData);
        alert("Employee updated successfully");
      } else {
        await api.post("/employees", submitData);
        alert("Employee created successfully");
      }

      setShowModal(false);
      setEditingEmployee(null);
      setFormErrors({});
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving employee:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to save employee";

      // Check if error is related to specific fields
      if (errorMessage.includes("email") || errorMessage.includes("Email")) {
        setFormErrors({ email: errorMessage });
      } else if (
        errorMessage.includes("mobile") ||
        errorMessage.includes("Mobile")
      ) {
        setFormErrors({ mobile: errorMessage });
      } else {
        setFormErrors({ general: errorMessage });
      }

      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (employee) => {
    setEditingEmployee(employee);
    // Cart admin cannot see/edit franchise info
    if (!isCartAdmin) {
      setSelectedFranchise(
        employee.franchiseId?._id || employee.franchiseId || ""
      );
      setSelectedCafe(employee.cafeId?._id || employee.cafeId || "");
    } else {
      // Cart admin: cafeId is automatically their cart
      setSelectedCafe(user?._id || "");
    }

    // Start with employee data (may already have email from hierarchy)
    let fullEmployeeData = { ...employee };

    // Check if email is already available from the employee object (from hierarchy)
    // Hierarchy endpoint should populate email from User model
    if (
      employee.email &&
      employee.email !== "employee@example.com" &&
      employee.email.trim() !== ""
    ) {
      console.log(
        "[EmployeeManagement] Email from hierarchy employee object:",
        employee.email
      );
      // Use this email as initial value
      fullEmployeeData.email = employee.email;
    } else if (employee.userId) {
      // Check if userId is populated in the employee object from hierarchy
      if (typeof employee.userId === "object" && employee.userId.email) {
        fullEmployeeData.email = employee.userId.email;
        console.log(
          "[EmployeeManagement] Email from userId in hierarchy:",
          employee.userId.email
        );
      }
    }

    try {
      // Fetch full employee details from backend (includes email if stored)
      const employeeResponse = await api.get(`/employees/${employee._id}`);

      // Backend returns { success: true, data: employee }
      // Axios response structure: response.data = { success: true, data: employee }
      if (employeeResponse?.data?.success && employeeResponse?.data?.data) {
        // Backend wrapped response: { success: true, data: employee }
        fullEmployeeData = employeeResponse.data.data;
      } else if (employeeResponse?.data && !employeeResponse.data.success) {
        // Direct employee object (no wrapper)
        fullEmployeeData = employeeResponse.data;
      } else {
        // Fallback to provided employee data
        fullEmployeeData = employee;
      }

      // ALWAYS check userId for email - User model is the source of truth for login emails
      if (fullEmployeeData.userId) {
        let userEmail = null;

        // Check if userId is populated (object) with email
        if (
          typeof fullEmployeeData.userId === "object" &&
          fullEmployeeData.userId.email
        ) {
          userEmail = fullEmployeeData.userId.email;
          console.log(
            "[EmployeeManagement] Email from populated userId object:",
            userEmail
          );
        } else {
          // userId is just an ID string, fetch User to get email
          const userId =
            typeof fullEmployeeData.userId === "object"
              ? fullEmployeeData.userId._id || fullEmployeeData.userId.id
              : fullEmployeeData.userId;

          if (userId) {
            try {
              console.log(
                "[EmployeeManagement] Fetching User email for userId:",
                userId
              );
              const userResponse = await api.get(`/users/${userId}`);

              // Handle different response structures
              let fetchedEmail = null;
              if (userResponse?.data?.email) {
                fetchedEmail = userResponse.data.email;
              } else if (userResponse?.data?.user?.email) {
                fetchedEmail = userResponse.data.user.email;
              } else if (userResponse?.data?.data?.email) {
                fetchedEmail = userResponse.data.data.email;
              }

              if (fetchedEmail) {
                userEmail = fetchedEmail;
                console.log(
                  "[EmployeeManagement] ✅ Email fetched from User API:",
                  userEmail
                );
              } else {
                console.warn(
                  "[EmployeeManagement] ⚠️ User found but no email in response:",
                  {
                    responseData: userResponse?.data,
                    userId: userId,
                  }
                );
              }
            } catch (userErr) {
              console.error(
                "[EmployeeManagement] ❌ Error fetching user email:",
                userErr
              );
              console.error("[EmployeeManagement] UserId was:", userId);
              console.error(
                "[EmployeeManagement] Error details:",
                userErr.response?.data || userErr.message
              );
            }
          }
        }

        // Use User email if found, otherwise keep employee email (if valid)
        if (userEmail) {
          fullEmployeeData.email = userEmail;
        } else if (
          !fullEmployeeData.email ||
          fullEmployeeData.email === "employee@example.com"
        ) {
          // If no valid email found, log warning
          console.warn(
            "[EmployeeManagement] No email found in User model for userId:",
            fullEmployeeData.userId
          );
        }
      }

      console.log("[EmployeeManagement] Fetched employee data:", {
        rawResponse: employeeResponse?.data,
        extractedData: fullEmployeeData,
        name: fullEmployeeData?.name,
        email: fullEmployeeData?.email,
        mobile: fullEmployeeData?.mobile,
        dateOfBirth: fullEmployeeData?.dateOfBirth,
        userId: fullEmployeeData?.userId,
        userIdType: typeof fullEmployeeData?.userId,
        hasUserIdEmail: fullEmployeeData?.userId?.email,
      });

      // CRITICAL: If employee has userId but no email yet, fetch from User model
      // This ensures we always get the actual login email
      if (
        fullEmployeeData.userId &&
        (!fullEmployeeData.email ||
          fullEmployeeData.email === "employee@example.com")
      ) {
        const userIdToFetch =
          typeof fullEmployeeData.userId === "object"
            ? fullEmployeeData.userId._id ||
              fullEmployeeData.userId.id ||
              fullEmployeeData.userId
            : fullEmployeeData.userId;

        if (userIdToFetch) {
          try {
            console.log(
              "[EmployeeManagement] Fetching User email directly for userId:",
              userIdToFetch
            );
            const directUserResponse = await api.get(`/users/${userIdToFetch}`);
            const userEmail =
              directUserResponse?.data?.email ||
              directUserResponse?.data?.user?.email;
            if (userEmail) {
              fullEmployeeData.email = userEmail;
              console.log(
                "[EmployeeManagement] ✅ Email successfully fetched from User model:",
                userEmail
              );
            } else {
              console.warn(
                "[EmployeeManagement] ⚠️ User found but no email in response:",
                directUserResponse?.data
              );
            }
          } catch (directUserErr) {
            console.error(
              "[EmployeeManagement] ❌ Failed to fetch User email:",
              directUserErr
            );
            console.error(
              "[EmployeeManagement] UserId attempted:",
              userIdToFetch
            );
          }
        }
      }

      // FALLBACK: If still no email and employee has email in Employee model, try to find User by email
      // This handles cases where userId link might be missing
      if (
        (!fullEmployeeData.email ||
          fullEmployeeData.email === "employee@example.com") &&
        employee.email &&
        employee.email !== "employee@example.com"
      ) {
        try {
          console.log(
            "[EmployeeManagement] Trying to find User by email:",
            employee.email
          );
          const usersResponse = await api.get("/users");
          const allUsers = usersResponse.data || [];
          const foundUser = allUsers.find(
            (u) =>
              u.email &&
              u.email.toLowerCase().trim() ===
                employee.email.toLowerCase().trim()
          );

          if (foundUser) {
            fullEmployeeData.email = foundUser.email;
            fullEmployeeData.userId = foundUser._id;
            console.log(
              "[EmployeeManagement] ✅ Found User by email and linked userId:",
              foundUser.email,
              foundUser._id
            );
          }
        } catch (emailLookupErr) {
          console.warn(
            "[EmployeeManagement] Could not lookup User by email:",
            emailLookupErr
          );
        }
      }
    } catch (error) {
      console.error("Error fetching full employee details:", error);
      console.warn("Using provided employee data:", employee);
      // Use the employee data we already have
      fullEmployeeData = employee;
    }

    // Format date for input and support legacy dd/mm/yy-style values.
    const dob = formatDateForDateInput(fullEmployeeData.dateOfBirth);

    // Extract franchise and cafe IDs (handle both populated and non-populated)
    const franchiseId = isCartAdmin
      ? ""
      : fullEmployeeData.franchiseId?._id || fullEmployeeData.franchiseId || "";
    const cafeId = isCartAdmin
      ? user?._id || ""
      : fullEmployeeData.cafeId?._id || fullEmployeeData.cafeId || "";

    // Get email - prefer User model email (via userId) over Employee model email
    // User model is the source of truth for login accounts
    let employeeEmail = "";

    // First, try to get email from User model (via userId) - this is the actual login email
    if (fullEmployeeData.userId) {
      if (
        typeof fullEmployeeData.userId === "object" &&
        fullEmployeeData.userId.email
      ) {
        employeeEmail = fullEmployeeData.userId.email;
        console.log(
          "[EmployeeManagement] Using email from populated userId:",
          employeeEmail
        );
      } else {
        // userId is an ID, email should already be in fullEmployeeData.email from the fetch above
        // But if not, we'll use what we have
        if (
          fullEmployeeData.email &&
          fullEmployeeData.email !== "employee@example.com"
        ) {
          employeeEmail = fullEmployeeData.email;
          console.log(
            "[EmployeeManagement] Using email from fullEmployeeData (fetched from User):",
            employeeEmail
          );
        }
      }
    }

    // Fallback: use employee.email if it's valid (not placeholder)
    if (
      !employeeEmail &&
      fullEmployeeData.email &&
      fullEmployeeData.email !== "employee@example.com"
    ) {
      employeeEmail = fullEmployeeData.email;
      console.log(
        "[EmployeeManagement] Using email from Employee model:",
        employeeEmail
      );
    }

    console.log("[EmployeeManagement] Final email extracted:", {
      employeeEmail,
      fromEmployee: fullEmployeeData.email,
      fromUserId: fullEmployeeData.userId?.email,
      userId: fullEmployeeData.userId,
      userIdType: typeof fullEmployeeData.userId,
    });

    // Final check - if still no email, log warning
    if (!employeeEmail || employeeEmail === "employee@example.com") {
      console.warn("[EmployeeManagement] ⚠️ Email not found for employee:", {
        employeeId: fullEmployeeData._id,
        employeeName: fullEmployeeData.name,
        hasUserId: !!fullEmployeeData.userId,
        userIdValue: fullEmployeeData.userId,
      });
    }

    setFormData({
      name: fullEmployeeData.name || "",
      dateOfBirth: dob,
      mobile: fullEmployeeData.mobile || "",
      email: employeeEmail, // Email from Employee model or User model (via userId)
      password: "", // Don't populate password when editing
      role: fullEmployeeData.employeeRole || fullEmployeeData.role || "waiter", // Use role, fallback to employeeRole for backward compatibility
      employeeRole:
        fullEmployeeData.employeeRole || fullEmployeeData.role || "waiter",
      franchiseId: franchiseId,
      cafeId: cafeId,
      kycVerified: fullEmployeeData.kycVerified || false,
      disability: fullEmployeeData.disability || {
        hasDisability: false,
        type: "",
      },
      deviceIssued: fullEmployeeData.deviceIssued || {
        smartwatch: false,
        tracker: false,
      },
      imei: fullEmployeeData.imei || { device: "", phone: "" },
      isActive: fullEmployeeData.isActive !== false,
    });

    console.log("[EmployeeManagement] Form data set:", {
      name: fullEmployeeData.name,
      email: employeeEmail,
      emailFromEmployee: fullEmployeeData.email,
      emailFromUserId: fullEmployeeData.userId?.email,
      mobile: fullEmployeeData.mobile,
      dateOfBirth: dob,
      role: fullEmployeeData.employeeRole || fullEmployeeData.role,
      userId: fullEmployeeData.userId,
    });

    // Verify email is set correctly
    if (!employeeEmail || employeeEmail === "employee@example.com") {
      console.warn("[EmployeeManagement] ⚠️ Email not properly extracted!", {
        employeeEmail,
        fullEmployeeDataEmail: fullEmployeeData.email,
        userId: fullEmployeeData.userId,
      });
    }

    setShowModal(true);
  };

  // Helper function to find employee by ID from hierarchy structure
  const findEmployeeById = (employeeId) => {
    // Search in orphan employees
    const orphanEmployee = orphanEmployees.find(
      (emp) => emp._id === employeeId
    );
    if (orphanEmployee) return orphanEmployee;

    // Search in hierarchy (franchise employees and cafe employees)
    for (const franchise of hierarchy) {
      // Check franchise-level employees
      if (franchise.employees) {
        const franchiseEmployee = franchise.employees.find(
          (emp) => emp._id === employeeId
        );
        if (franchiseEmployee) return franchiseEmployee;
      }

      // Check cafe employees
      if (franchise.cafes) {
        for (const cafe of franchise.cafes) {
          if (cafe.employees) {
            const cafeEmployee = cafe.employees.find(
              (emp) => emp._id === employeeId
            );
            if (cafeEmployee) return cafeEmployee;
          }
        }
      }
    }

    return null;
  };

  const handleDelete = async (e, employeeId) => {
    // Handle event if provided
    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!employeeId) {
      console.error("Employee ID is required for deletion");
      alert("Error: Employee ID is missing");
      return;
    }

    // Find employee from hierarchy structure
    const employee = findEmployeeById(employeeId);
    const employeeName = employee?.name || "this employee";

    try {
      // Import confirm utility
      const confirmModule = await import("../utils/confirm");
      const confirm = confirmModule.confirm || confirmModule.default;

      if (!confirm) {
        console.error("Confirm utility not available");
        // Fallback to native confirm (also async now)
        const proceed = await window.confirm(
          `Are you sure you want to PERMANENTLY DELETE "${employeeName}"?\n\nThis action cannot be undone.`
        );
        if (!proceed) return;
      } else {
        const confirmed = await confirm(
          `Are you sure you want to PERMANENTLY DELETE "${employeeName}"?\n\nThis action cannot be undone.`,
          {
            title: "Delete Employee",
            warningMessage: "WARNING: PERMANENTLY DELETE",
            danger: true,
            confirmText: "Delete",
            cancelText: "Cancel",
          }
        );

        if (!confirmed) {
          console.log("Delete cancelled by user");
          return;
        }
      }

      // Proceed with deletion
      console.log("Deleting employee:", employeeId);
      await api.delete(`/employees/${employeeId}`);
      alert("Employee deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting employee:", error);
      if (error.response?.status === 404) {
        alert("Employee not found. It may have already been deleted.");
        fetchData(); // Refresh to update the list
      } else if (error.response?.status === 403) {
        alert("You do not have permission to delete this employee.");
      } else {
        alert(
          error.response?.data?.message ||
            "Failed to delete employee. Please try again."
        );
      }
    }
  };

  const resetForm = () => {
    const isFranchiseAdmin = userRole === "franchise_admin";
    const franchiseId = isFranchiseAdmin
      ? user?._id?.toString() || user?._id || ""
      : "";
    const cafeId = isCartAdmin ? user?._id?.toString() || user?._id || "" : "";

    setFormData({
      name: "",
      dateOfBirth: "",
      mobile: "",
      email: "",
      password: "",
      role: "waiter",
      franchiseId: franchiseId, // Auto-set for franchise admin
      cafeId: cafeId, // Auto-set for cart admin
      kycVerified: false,
      disability: { hasDisability: false, type: "" },
      deviceIssued: { smartwatch: false, tracker: false },
      imei: { device: "", phone: "" },
      isActive: true,
    });

    // Pre-populate franchise for franchise admin (ensure it's a string for comparison)
    if (isFranchiseAdmin) {
      setSelectedFranchise(franchiseId);
    } else {
      setSelectedFranchise("");
    }

    setSelectedCafe(cafeId);
    setFormErrors({});
  };

  const openCreateModal = () => {
    setEditingEmployee(null);
    setFormErrors({});
    resetForm();
    setShowModal(true);
  };

  // Helper function to check if employee matches search term
  const employeeMatchesSearch = (employee) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      employee.name?.toLowerCase().includes(search) ||
      employee.mobile?.toLowerCase().includes(search) ||
      employee.email?.toLowerCase().includes(search) ||
      (employee.employeeRole || employee.role)?.toLowerCase().includes(search)
    );
  };

  // Helper function to check if cafe matches search term
  const cafeMatchesSearch = (cafe) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cafe.cafeName?.toLowerCase().includes(search) ||
      cafe.name?.toLowerCase().includes(search) ||
      cafe.email?.toLowerCase().includes(search) ||
      (cafe.employees || []).some((emp) => employeeMatchesSearch(emp))
    );
  };

  // Filter hierarchy with nested filtering
  const filteredHierarchy = hierarchy
    .map((franchise) => {
      if (!searchTerm) return franchise;

      const search = searchTerm.toLowerCase();
      const franchiseMatch =
        franchise.name?.toLowerCase().includes(search) ||
        franchise.email?.toLowerCase().includes(search);

      // Filter franchise-level employees
      const filteredFranchiseEmployees = (franchise.employees || []).filter(
        (emp) => employeeMatchesSearch(emp)
      );

      // Filter cafes and their employees
      const filteredCafes = (franchise.cafes || [])
        .map((cafe) => {
          const filteredCafeEmployees = (cafe.employees || []).filter((emp) =>
            employeeMatchesSearch(emp)
          );

          // Include cafe if it matches search OR has matching employees
          if (cafeMatchesSearch(cafe) || filteredCafeEmployees.length > 0) {
            return {
              ...cafe,
              employees: filteredCafeEmployees,
            };
          }
          return null;
        })
        .filter((cafe) => cafe !== null);

      // Include franchise if:
      // 1. Franchise name/email matches, OR
      // 2. Has matching franchise employees, OR
      // 3. Has matching cafes
      if (
        franchiseMatch ||
        filteredFranchiseEmployees.length > 0 ||
        filteredCafes.length > 0
      ) {
        return {
          ...franchise,
          employees: filteredFranchiseEmployees,
          cafes: filteredCafes,
        };
      }

      return null;
    })
    .filter((franchise) => franchise !== null);

  // Filter orphan employees
  const filteredOrphanEmployees = searchTerm
    ? orphanEmployees.filter((emp) => employeeMatchesSearch(emp))
    : orphanEmployees;

  // Unified roles for employee creation (matches User model roles)
  const employeeRoles = [
    { value: "manager", label: "Manager" },
    { value: "captain", label: "Captain" },
    { value: "waiter", label: "Waiter" },
    { value: "cook", label: "Cook" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Employee Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage employees hierarchically by Franchise and Cart
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FaPlus className="mr-2" />
          Add Employee
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by franchise, cart, or employee name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 md:p-6 space-y-4">
          {filteredHierarchy.length === 0 &&
          filteredOrphanEmployees.length === 0 &&
          !loading ? (
            <div className="text-center py-12 text-gray-500">
              <FaUsers className="mx-auto text-4xl mb-4" />
              <p>
                {searchTerm
                  ? "No employees found matching your search"
                  : "No employees found"}
              </p>
            </div>
          ) : (
            filteredHierarchy.map((franchise) => (
              <div
                key={franchise._id}
                className="border border-gray-200 rounded-lg"
              >
                {/* Franchise/Cart Header */}
                {isCartAdmin ? (
                  // Cart Admin View: Show only cart header (no franchise info)
                  <div className="flex items-center justify-between p-4 bg-blue-50">
                    <div className="flex items-center space-x-3">
                      <FaStore className="text-green-600" />
                      <div>
                        <h3 className="font-semibold text-lg">
                          {franchise.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {franchise.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        {franchise.cafes?.[0]?.employees?.length || 0} Employees
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          franchise.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {franchise.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                ) : (
                  // Franchise Admin / Super Admin View: Show franchise header
                  <div
                    className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer gap-3 md:gap-0"
                    onClick={() => toggleFranchise(franchise._id)}
                  >
                    <div className="flex items-center space-x-3">
                      {expandedFranchises.has(franchise._id) ? (
                        <FaChevronDown className="text-gray-500" />
                      ) : (
                        <FaChevronRight className="text-gray-500" />
                      )}
                      <FaBuilding className="text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-lg">
                          {franchise.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {franchise.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-sm text-gray-600">
                        {franchise.cafes?.length || 0} Carts,{" "}
                        {franchise.employees?.length || 0} Franchise Employees
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          franchise.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {franchise.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Franchise Content */}
                {(isCartAdmin ||
                  (!isCartAdmin && expandedFranchises.has(franchise._id))) && (
                  <div className="p-4 space-y-4">
                    {/* Franchise-Level Employees - HIDDEN for cart admin */}
                    {!isCartAdmin &&
                      franchise.employees &&
                      franchise.employees.length > 0 && (
                        <div className="ml-4">
                          <h4 className="font-semibold text-gray-700 mb-2">
                            Franchise Employees
                          </h4>
                          <div className="space-y-2">
                            {franchise.employees.map((employee) => (
                              <div
                                key={employee._id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
                              >
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {employee.name}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {employee.employeeRole ||
                                      employee.role ||
                                      "N/A"}{" "}
                                    • {employee.mobile}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleEdit(employee)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <FaEdit />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleDelete(e, employee._id)
                                    }
                                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <FaTrash />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Carts */}
                    {franchise.cafes && franchise.cafes.length > 0 && (
                      <div
                        className={isCartAdmin ? "space-y-3" : "ml-4 space-y-3"}
                      >
                        {!isCartAdmin && (
                          <h4 className="font-semibold text-gray-700 mb-2">
                            Carts
                          </h4>
                        )}
                        {franchise.cafes.map((cafe) => (
                          <div
                            key={cafe._id}
                            className="border border-gray-200 rounded-lg"
                          >
                            {/* Cart Header */}
                            {isCartAdmin ? (
                              // Cart Admin: Always show employees (no expand/collapse)
                              <div className="p-4 space-y-2">
                                {cafe.employees && cafe.employees.length > 0 ? (
                                  cafe.employees.map((employee) => (
                                    <div
                                      key={employee._id}
                                      className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                                    >
                                      <div className="flex-1">
                                        <div className="font-medium">
                                          {employee.name}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          {employee.employeeRole ||
                                            employee.role ||
                                            "N/A"}{" "}
                                          • {employee.mobile}
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={() => handleEdit(employee)}
                                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                        >
                                          <FaEdit />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) =>
                                            handleDelete(e, employee._id)
                                          }
                                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                                        >
                                          <FaTrash />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    No employees in this cart
                                  </div>
                                )}
                              </div>
                            ) : (
                              // Franchise Admin / Super Admin: Show expandable cart
                              <>
                                <div
                                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 cursor-pointer gap-3 md:gap-0"
                                  onClick={() => toggleCafe(cafe._id)}
                                >
                                  <div className="flex items-center space-x-3">
                                    {expandedCafes.has(cafe._id) ? (
                                      <FaChevronDown className="text-gray-500" />
                                    ) : (
                                      <FaChevronRight className="text-gray-500" />
                                    )}
                                    <FaStore className="text-green-600" />
                                    <div>
                                      <h4 className="font-semibold">
                                        {cafe.cafeName || cafe.name}
                                      </h4>
                                      <p className="text-sm text-gray-500">
                                        {cafe.email}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4">
                                    <span className="text-sm text-gray-600">
                                      {cafe.employees?.length || 0} Employees
                                    </span>
                                    <span
                                      className={`px-2 py-1 rounded text-xs ${
                                        cafe.isActive
                                          ? "bg-green-100 text-green-800"
                                          : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {cafe.isActive ? "Active" : "Inactive"}
                                    </span>
                                  </div>
                                </div>

                                {/* Cart Employees */}
                                {expandedCafes.has(cafe._id) && (
                                  <div className="p-4 space-y-2">
                                    {cafe.employees &&
                                    cafe.employees.length > 0 ? (
                                      cafe.employees.map((employee) => (
                                        <div
                                          key={employee._id}
                                          className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                                        >
                                          <div className="flex-1">
                                            <div className="font-medium">
                                              {employee.name}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                              {employee.employeeRole} •{" "}
                                              {employee.mobile}
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <button
                                              onClick={() =>
                                                handleEdit(employee)
                                              }
                                              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                              <FaEdit />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleDelete(e, employee._id)
                                              }
                                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                                            >
                                              <FaTrash />
                                            </button>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-center py-4 text-gray-500 text-sm">
                                        No employees in this cart
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Orphan Employees (no franchise/cart) */}
          {filteredOrphanEmployees && filteredOrphanEmployees.length > 0 && (
            <div className="border border-yellow-200 rounded-lg bg-yellow-50 p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">
                Unassigned Employees
              </h3>
              <div className="space-y-2">
                {filteredOrphanEmployees.map((employee) => (
                  <div
                    key={employee._id}
                    className="flex items-center justify-between p-3 bg-white rounded border border-yellow-200"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-sm text-gray-600">
                        {employee.employeeRole} • {employee.mobile}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(employee)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <FaEdit />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, employee._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingEmployee ? "Edit Employee" : "Create Employee"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* General Error Display */}
              {formErrors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{formErrors.general}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name)
                        setFormErrors({ ...formErrors, name: null });
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formErrors.name ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="Enter full name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth *{" "}
                    <span className="text-xs text-gray-500">
                      (Min age: 18 years as per Indian Labor Laws)
                    </span>
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    required
                    lang="en-GB"
                    max={getMaxDOBDate()}
                    value={formData.dateOfBirth}
                    onChange={(e) => {
                      setFormData({ ...formData, dateOfBirth: e.target.value });
                      if (formErrors.dateOfBirth)
                        setFormErrors({ ...formErrors, dateOfBirth: null });
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formErrors.dateOfBirth
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.dateOfBirth && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.dateOfBirth}
                    </p>
                  )}
                  {formData.dateOfBirth && !formErrors.dateOfBirth && (
                    <p
                      className={`mt-1 text-xs ${
                        calculateAge(formData.dateOfBirth) >=
                        MINIMUM_WORKING_AGE
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      Age: {calculateAge(formData.dateOfBirth)} years{" "}
                      {calculateAge(formData.dateOfBirth) >= MINIMUM_WORKING_AGE
                        ? "✓"
                        : "(Below minimum age)"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile *
                  </label>
                  <input
                    type="tel"
                    name="mobile"
                    required
                    value={formData.mobile}
                    onChange={(e) => {
                      setFormData({ ...formData, mobile: e.target.value });
                      if (formErrors.mobile)
                        setFormErrors({ ...formErrors, mobile: null });
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formErrors.mobile ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="9876543210 or +91 9876543210"
                  />
                  {formErrors.mobile && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.mobile}
                    </p>
                  )}
                  {!formErrors.mobile && (
                    <p className="mt-1 text-xs text-gray-500">
                      10-digit Indian mobile number
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    name="role"
                    required
                    value={formData.role}
                    onChange={(e) => {
                      setFormData({ ...formData, role: e.target.value });
                      if (formErrors.role)
                        setFormErrors({ ...formErrors, role: null });
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formErrors.role ? "border-red-500" : "border-gray-300"
                    }`}
                  >
                    {employeeRoles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.role && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.role}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email {!editingEmployee && "*"}
                  </label>
                  <input
                    type="email"
                    name="email"
                    required={!editingEmployee}
                    value={formData.email || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (formErrors.email)
                        setFormErrors({ ...formErrors, email: null });
                    }}
                    placeholder={
                      editingEmployee
                        ? "No email (employee has no login account)"
                        : "employee@example.com"
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formErrors.email ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.email}
                    </p>
                  )}
                  {!formErrors.email && (
                    <p className="text-xs text-gray-500 mt-1">
                      {editingEmployee
                        ? formData.email
                          ? `Current login email: ${formData.email}`
                          : "Employee has no login account. Add email to create login access."
                        : "Required for login access"}
                    </p>
                  )}
                  {editingEmployee && formData.email && !formErrors.email && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Email found - employee can login with this email
                    </p>
                  )}
                </div>
                {!editingEmployee && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (formErrors.password)
                          setFormErrors({ ...formErrors, password: null });
                      }}
                      placeholder="Min 6 characters"
                      minLength={6}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        formErrors.password
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {formErrors.password && (
                      <p className="mt-1 text-xs text-red-600">
                        {formErrors.password}
                      </p>
                    )}
                    {!formErrors.password && (
                      <p className="text-xs text-gray-500 mt-1">
                        Employee will use this to login
                      </p>
                    )}
                  </div>
                )}
                {editingEmployee && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password (leave blank to keep current)
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (formErrors.password)
                          setFormErrors({ ...formErrors, password: null });
                      }}
                      placeholder="Min 6 characters"
                      minLength={6}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        formErrors.password
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {formErrors.password && (
                      <p className="mt-1 text-xs text-red-600">
                        {formErrors.password}
                      </p>
                    )}
                  </div>
                )}
                {!isCartAdmin && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Franchise *
                      </label>
                      <select
                        name="franchiseId"
                        value={selectedFranchise?.toString() || ""}
                        onChange={(e) => {
                          handleFranchiseChange(e.target.value);
                          if (formErrors.franchiseId)
                            setFormErrors({ ...formErrors, franchiseId: null });
                        }}
                        disabled={userRole === "franchise_admin"} // Disable for franchise admin (they can only add to their own franchise)
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600 ${
                          formErrors.franchiseId
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                      >
                        <option value="">Select Franchise</option>
                        {franchises.map((franchise) => (
                          <option
                            key={franchise._id?.toString() || franchise._id}
                            value={franchise._id?.toString() || franchise._id}
                          >
                            {franchise.name ||
                              franchise.franchiseName ||
                              "Unnamed Franchise"}
                          </option>
                        ))}
                      </select>
                      {formErrors.franchiseId && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.franchiseId}
                        </p>
                      )}
                      {!formErrors.franchiseId &&
                        userRole === "franchise_admin" && (
                          <p className="text-xs text-gray-500 mt-1">
                            Your franchise is automatically selected
                          </p>
                        )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cart
                      </label>
                      <select
                        value={selectedCafe}
                        onChange={(e) => handleCafeChange(e.target.value)}
                        disabled={!selectedFranchise}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="">Select Cart (Optional)</option>
                        {cafes
                          .filter((cafe) => {
                            // For franchise admin, only show carts under their franchise
                            if (userRole === "franchise_admin") {
                              const franchiseId =
                                user?._id?.toString() || user?._id;
                              const cafeFranchiseId =
                                cafe.franchiseId?._id?.toString() ||
                                cafe.franchiseId?._id ||
                                cafe.franchiseId?.toString() ||
                                cafe.franchiseId;
                              return (
                                cafeFranchiseId &&
                                cafeFranchiseId.toString() ===
                                  franchiseId.toString()
                              );
                            }
                            // For super admin, filter by selected franchise
                            if (!selectedFranchise) return true;
                            const cafeFranchiseId =
                              cafe.franchiseId?._id?.toString() ||
                              cafe.franchiseId?._id ||
                              cafe.franchiseId?.toString() ||
                              cafe.franchiseId;
                            return (
                              cafeFranchiseId &&
                              cafeFranchiseId.toString() ===
                                selectedFranchise.toString()
                            );
                          })
                          .map((cafe) => (
                            <option
                              key={cafe._id?.toString() || cafe._id}
                              value={cafe._id?.toString() || cafe._id}
                            >
                              {cafe.cafeName || cafe.name}
                            </option>
                          ))}
                      </select>
                      {userRole === "franchise_admin" && selectedFranchise && (
                        <p className="text-xs text-gray-500 mt-1">
                          Showing carts under your franchise
                        </p>
                      )}
                    </div>
                  </>
                )}
                {isCartAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cart
                    </label>
                    <input
                      type="text"
                      value={user?.name || user?.cartName || "Your Cart"}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Employees will be assigned to your cart automatically
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.kycVerified}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        kycVerified: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">KYC Verified</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>

              {/* Disability Section */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <h3 className="text-sm font-medium text-gray-800 mb-2">Additional Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="hasDisability"
                      checked={formData.disability?.hasDisability || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          disability: {
                            ...formData.disability,
                            hasDisability: e.target.checked,
                            // Clear type if unchecked, otherwise keep existing
                            type: e.target.checked ? (formData.disability?.type || "") : "",
                          },
                        })
                      }
                      className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="hasDisability" className="text-sm text-gray-700 font-medium">
                      Person with Disability (PWD)
                    </label>
                  </div>
                  
                  {formData.disability?.hasDisability && (
                    <div className="pl-6 animate-fadeIn">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type of Disability <span className="text-gray-500 font-normal text-xs">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.disability?.type || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            disability: {
                              ...formData.disability,
                              type: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g. Visual, Hearing, Physical, etc."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      {formErrors.disabilityType && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.disabilityType}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-gray-200 mt-4 sm:mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingEmployee(null);
                    setFormData({
                      name: "",
                      mobile: "",
                      role: "",
                      dateOfBirth: "",
                      address: "",
                      emergencyContact: "",
                      emergencyContactRelation: "",
                      joiningDate: "",
                      salary: "",
                    });
                    setFormErrors({});
                    resetForm();
                  }}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <FaSpinner className="animate-spin" size={14} />
                      <span>
                        {editingEmployee ? "Updating..." : "Creating..."}
                      </span>
                    </>
                  ) : (
                    <span>{editingEmployee ? "Update" : "Create"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
