import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { useAuthStore } from './stores/useAuthStore';
import { PresenceManager } from './components/PresenceManager';

// Lazy loading components for better performance
const LoginPage = lazy(() => import('./pages/Login').then(m => ({ default: m.LoginPage })));
const TrackerPage = lazy(() => import('./pages/Tracker').then(m => ({ default: m.TrackerPage })));
const AdminPage = lazy(() => import('./pages/Admin').then(m => ({ default: m.AdminPage })));
const AdminMapPage = lazy(() => import('./pages/AdminMap').then(m => ({ default: m.AdminMapPage })));
const AdminRegisterPage = lazy(() => import('./pages/AdminRegister').then(m => ({ default: m.AdminRegisterPage })));

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { isAuthenticated, employee } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles.length > 0 && employee && !allowedRoles.includes(employee.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Role-based Home Redirect
const HomeRoute = () => {
  const { employee } = useAuthStore();
  if (employee?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  return <TrackerPage />;
};

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <PresenceManager />
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin-register" element={<AdminRegisterPage />} />

            {/* Employee Routes (Redirects Admins to Dashboard) */}
            <Route path="/" element={
              <ProtectedRoute>
                <HomeRoute />
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            } />

            <Route path="/admin/map/:id" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminMapPage />
              </ProtectedRoute>
            } />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
