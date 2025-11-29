import axios from 'axios';

const nodeApiBase = import.meta.env.VITE_NODE_API_URL || 'http://localhost:5001';

const api = axios.create({
  baseURL: `${nodeApiBase.replace(/\/$/, '')}/api`
});

// Get the appropriate token based on user role
const getToken = () => {
  const superAdminToken = localStorage.getItem('superAdminToken');
  const franchiseAdminToken = localStorage.getItem('franchiseAdminToken');
  const adminToken = localStorage.getItem('adminToken');
  
  // Priority: super_admin > franchise_admin > admin
  return superAdminToken || franchiseAdminToken || adminToken;
};

// Get the appropriate storage keys based on user role
const getStorageKeys = (role) => {
  switch(role) {
    case 'super_admin':
      return { token: 'superAdminToken', user: 'superAdminUser' };
    case 'franchise_admin':
      return { token: 'franchiseAdminToken', user: 'franchiseAdminUser' };
    case 'admin':
    default:
      return { token: 'adminToken', user: 'adminUser' };
  }
};

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request for debugging (can be removed in production)
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        baseURL: config.baseURL,
        hasToken: !!token,
        data: config.data
      });
    }
    
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error logging for debugging
    const errorDetails = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      message: error.response?.data?.message,
      data: error.response?.data,
    };
    
    // Enhanced error logging
    if (error.response) {
      console.error('[API Error]', errorDetails);
      
      // Log full response for debugging
      try {
        const fullResponse = JSON.stringify(error.response.data, null, 2);
        console.error('[API Error - Full Response]:', fullResponse);
      } catch (e) {
        console.error('[API Error - Response Data]:', error.response.data);
      }
    } else {
      console.error('[API Error - No Response]:', error.message);
    }
    
    if (error.response?.status === 400) {
      // Bad Request - log detailed error
      const responseData = error.response?.data || {};
      let requestData = error.config?.data;
      
      // Try to parse request data if it's a string
      if (typeof requestData === 'string') {
        try {
          requestData = JSON.parse(requestData);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      
      console.error('═══════════════════════════════════════════');
      console.error('[400 Bad Request - FULL DETAILS]');
      console.error('═══════════════════════════════════════════');
      console.error('Endpoint:', `${error.config?.method?.toUpperCase()} ${error.config?.url}`);
      console.error('Request Data:', requestData);
      console.error('Response Status:', error.response?.status);
      console.error('Response Data:', responseData);
      console.error('Error Message:', responseData.message || responseData.error || 'Bad Request');
      console.error('Full Response:', JSON.stringify(responseData, null, 2));
      console.error('═══════════════════════════════════════════');
      
      // Show user-friendly error message
      const errorMessage = responseData.message || responseData.error || 'Invalid request. Please check your input and try again.';
      
      if (!error.config?.skipErrorAlert) {
        alert(`Error: ${errorMessage}\n\nCheck console for full details.`);
      }
    } else if (error.response?.status === 401) {
      // Unauthorized - token invalid or expired
      console.warn('[401 Unauthorized] Token invalid or expired, redirecting to login');
      // Clear all tokens
      localStorage.removeItem('superAdminToken');
      localStorage.removeItem('superAdminUser');
      localStorage.removeItem('franchiseAdminToken');
      localStorage.removeItem('franchiseAdminUser');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      // Forbidden - check if it's account deactivation
      const errorData = error.response?.data || {};
      const errorCode = errorData.code;
      
      if (errorCode === 'ACCOUNT_DEACTIVATED' || 
          errorCode === 'CAFE_DEACTIVATED' || 
          errorCode === 'FRANCHISE_DEACTIVATED' ||
          errorCode === 'ACCOUNT_PENDING_APPROVAL' ||
          errorData.deactivated) {
        // Clear all tokens
        localStorage.removeItem('superAdminToken');
        localStorage.removeItem('superAdminUser');
        localStorage.removeItem('franchiseAdminToken');
        localStorage.removeItem('franchiseAdminUser');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        
        alert(errorData.message || 'Your account has been deactivated. Please contact admin.');
        window.location.href = '/login';
      }
    } else if (error.response?.status === 500) {
      console.error('[500 Server Error]', errorDetails);
      alert('Server error. Please try again later.');
    } else if (!error.response) {
      // Network error
      console.error('[Network Error]', {
        message: error.message,
        url: error.config?.url,
        baseURL: error.config?.baseURL
      });
      alert('Network error. Please check if the backend server is running.');
    }
    
    return Promise.reject(error);
  }
);

export default api;
export { getStorageKeys };
