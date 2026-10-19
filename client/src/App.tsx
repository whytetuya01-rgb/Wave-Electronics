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
import { AppLoader } from './components/ui/Loading';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <AppLoader message="Authenticating session..." />;
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
                <ErrorBoundary label="the application">
                  <AppLayout />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          >
            <Route index element={<ErrorBoundary label="Dashboard"><Dashboard /></ErrorBoundary>} />
            <Route path="components" element={<ErrorBoundary label="Components"><ComponentsList /></ErrorBoundary>} />
            <Route path="stock-inward" element={<ErrorBoundary label="Stock Inward"><StockInward /></ErrorBoundary>} />
            <Route path="vendors" element={<ErrorBoundary label="Vendors"><Vendors /></ErrorBoundary>} />
            <Route path="circuits" element={<ErrorBoundary label="Circuits"><Circuits /></ErrorBoundary>} />
            <Route path="jobs" element={<ErrorBoundary label="Jobs"><Jobs /></ErrorBoundary>} />
            <Route path="masters" element={<ErrorBoundary label="Masters"><Masters /></ErrorBoundary>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
