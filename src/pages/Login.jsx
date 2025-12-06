import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Logo from '../assets/images/logo_new.jpeg';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, user, loading } = useAuth();

  useEffect(() => {
    // Redirect to dashboard if already logged in
    if (user && !loading) {
      console.log('[Login] User authenticated, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // Don't render login form if already authenticated
  if (user && !loading) {
    return null; // Will redirect via useEffect
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        console.log('[Login] Login successful, navigating to dashboard');
        // Navigate directly after successful login
        // The user state is set in AuthContext, so we can navigate immediately
        // Use a small delay to ensure state propagation
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 100);
      } else {
        setError(result.message || 'Login failed');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('[Login] Login error:', error);
      setError('An error occurred during login');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[#f5e3d5]" style={{
      backgroundImage: 'linear-gradient(135deg, #f5e3d5 0%, #fef4ec 50%, #f3ddcb 100%)'
    }}>
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-[#e2c1ac] backdrop-blur-md">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img src={Logo} alt="TerraCart Logo" className="h-20 w-auto object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-[#4a2e1f] mb-2">Admin Portal</h1>
          <p className="text-[#6b4423]">Terra Cart Management System</p>
        </div>
        <h2 className="text-2xl font-bold text-center text-[#4a2e1f]">Login</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <Input
            label="Email"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@terra.cart"
            required
            error={error && error.includes('email') ? error : null}
          />
          <Input
            label="Password"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            required
            error={error && !error.includes('email') ? error : null}
          />
          {error && !error.includes('email') && (
            <div className="p-3 text-sm text-[#991b1b] bg-[#fef2f2] border-2 border-[#ef4444] rounded-lg flex items-center gap-2">
              <span className="text-[#ef4444]">⚠</span>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting || loading}
            className={`w-full px-4 py-2 font-bold text-white ${
              (isSubmitting || loading) ? 'bg-[#c75b1a] cursor-not-allowed opacity-70' : 'bg-[#d86d2a] hover:bg-[#c75b1a]'
            } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:ring-opacity-50 transition-colors shadow-md`}
          >
            {(isSubmitting || loading) ? 'Loading...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;








