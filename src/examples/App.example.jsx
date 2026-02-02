// Example: How to integrate multi-language system into your App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import Language Provider and Accessibility Button
import { LanguageProvider } from './i18n/LanguageContext';
import AccessibilityButton from './components/AccessibilityButton';

// Your existing components
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Menu from './pages/Menu';
// ... other imports

function App() {
  return (
    // 1. Wrap everything with LanguageProvider
    <LanguageProvider>
      <Router>
        <div className="app">
          {/* Your existing layout */}
          <Sidebar />
          
          <main className="main-content">
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/menu" element={<Menu />} />
              {/* ... other routes */}
            </Routes>
          </main>
        </div>
        
        {/* 2. Add Accessibility Button - Shows on ALL pages */}
        <AccessibilityButton />
      </Router>
    </LanguageProvider>
  );
}

export default App;
