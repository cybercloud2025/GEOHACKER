import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/Login';
import { TrackerPage } from './pages/Tracker';
import { AdminPage } from './pages/Admin';
import { AdminMapPage } from './pages/AdminMap';

import { useAuthStore } from './stores/useAuthStore';

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

import { PresenceManager } from './components/PresenceManager';

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <PresenceManager />
        <Routes>
          <Route path="/login" element={<LoginPage />} />

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
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
