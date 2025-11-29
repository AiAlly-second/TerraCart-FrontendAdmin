import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../assets/images/logo_new.jpeg';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (error) {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
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
          <div>
            <label htmlFor="email" className="text-sm font-semibold text-[#4a2e1f]">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 mt-2 text-[#4a2e1f] bg-[#fef4ec] border border-[#e2c1ac] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a] transition-colors"
              placeholder="admin@terra.cart"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-semibold text-[#4a2e1f]">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 mt-2 text-[#4a2e1f] bg-[#fef4ec] border border-[#e2c1ac] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a] transition-colors"
              placeholder="********"
              required
            />
          </div>
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className={`w-full px-4 py-2 font-bold text-white ${
              loading ? 'bg-[#c75b1a] cursor-not-allowed opacity-70' : 'bg-[#d86d2a] hover:bg-[#c75b1a]'
            } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:ring-opacity-50 transition-colors shadow-md`}
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;








