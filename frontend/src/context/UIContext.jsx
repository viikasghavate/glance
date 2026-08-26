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
  const [users, setUsers] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [programs, setPrograms] = useState([]);

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

  const refreshPortfolios = useCallback(async () => {
    try {
      const [portfoliosData, programsData] = await Promise.all([
        apiFetch('/portfolios'),
        apiFetch('/programs')
      ]);
      setPortfolios(portfoliosData);
      setPrograms(programsData);
    } catch (err) {
      console.error(err);
    }
  }, [apiFetch]);

  const refreshUsers = useCallback(async () => {
    try {
      const data = await apiFetch('/users');
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  }, [apiFetch]);

  useEffect(() => { refreshProjects(); }, [refreshProjects]);
  useEffect(() => { refreshPortfolios(); }, [refreshPortfolios]);
  useEffect(() => { refreshUsers(); }, [refreshUsers]);

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
      users, refreshUsers,
      portfolios, programs, refreshPortfolios,
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
