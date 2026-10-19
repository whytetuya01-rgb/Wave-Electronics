import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ComponentsList } from './pages/ComponentsList';
import { Masters } from './pages/Masters';
import { Vendors } from './pages/Vendors';
import { StockInward } from './pages/StockInward';
import { Circuits } from './pages/Circuits';
import { Jobs } from './pages/Jobs';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3] text-[#171717]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#141414] border-t-transparent"></div>
          <span className="text-xs text-[#6B6863] font-medium tracking-wide">Loading Wave Electronics...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="components" element={<ComponentsList />} />
            <Route path="stock-inward" element={<StockInward />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="circuits" element={<Circuits />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="masters" element={<Masters />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
