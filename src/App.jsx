import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ProjectProvider } from './contexts/ProjectContext.jsx';
import LandingPage from './pages/Landing/LandingPage.jsx';
import LoginPage from './pages/Login/LoginPage.jsx';
import ProjectDashboard from './pages/ProjectDashboard/ProjectDashboard.jsx';
import EditorPage from './pages/Editor/EditorPage.jsx';
import AdminPage from './pages/Admin/AdminPage.jsx';
import './App.css';

// Guard: strictly prevents unauthorized access to dashboard/editor
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

// Guard: strictly prevents unauthorized access to admin portal
function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/projects" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage defaultMode="login" />} />
          <Route path="/signup" element={<LoginPage defaultMode="signup" />} />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
          <Route
            path="/project/:projectId"
            element={
              <ProtectedRoute>
                <EditorPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
