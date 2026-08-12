import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const { apiFetch } = useAuth();
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [view, setView] = useState('board');
  const [breadcrumb, setBreadcrumb] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await apiFetch('/projects');
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setProjectsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  const openNewProjectModal = useCallback(() => {
    setEditingProject(null);
    setShowProjectModal(true);
  }, []);

  const openEditProjectModal = useCallback((project) => {
    setEditingProject(project);
    setShowProjectModal(true);
  }, []);

  const closeProjectModal = useCallback(() => {
    setShowProjectModal(false);
    setEditingProject(null);
  }, []);

  return (
    <UIContext.Provider value={{
      showProjectModal, setShowProjectModal,
      editingProject, setEditingProject,
      view, setView,
      breadcrumb, setBreadcrumb,
      projects, projectsLoading, refreshProjects,
      openNewProjectModal, openEditProjectModal, closeProjectModal
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
