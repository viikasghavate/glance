import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import UserManagementPage from './pages/UserManagementPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><UIProvider><Layout /></UIProvider></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectListPage />} />
        <Route path="project/:id" element={<ProjectDetailPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
