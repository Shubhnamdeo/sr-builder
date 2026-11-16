import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  loadProjects,
  saveProjects,
  createProject as createProjectStorage,
  deleteProject as deleteProjectStorage,
  updateProject as updateProjectStorage,
  getProject as getProjectStorage,
  MAX_RESUMES_PER_USER
} from '../utils/storage.js';
import { BLANK_TEMPLATE } from '../utils/latexTemplates.js';
import { useAuth } from './AuthContext.jsx';
import { api } from '../services/api.js';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { user } = useAuth();
  const userEmail = user?.email || null;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sync projects whenever active user changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const token = localStorage.getItem('sr_auth_token');

    // If logged into cloud backend with JWT, try fetching from MongoDB
    if (token) {
      api.projects.getAll()
        .then(async (remoteProjects) => {
          if (!isMounted) return;
          if (Array.isArray(remoteProjects) && remoteProjects.length > 0) {
            setProjects(remoteProjects);
            saveProjects(remoteProjects, userEmail); // cache locally
          } else {
            // If remote is empty, check if we have local projects to migrate/sync
            const local = loadProjects(userEmail);
            if (local.length > 0) {
              try {
                const syncRes = await api.projects.syncLocal(local);
                if (syncRes?.projects) {
                  setProjects(syncRes.projects);
                  return;
                }
              } catch (e) {
                console.warn('Sync to cloud error:', e);
              }
            }
            setProjects(local);
          }
        })
        .catch((err) => {
          console.warn('Cloud projects fetch error, loading from local:', err.message);
          if (isMounted) setProjects(loadProjects(userEmail));
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setProjects(loadProjects(userEmail));
      setLoading(false);
    }

    return () => { isMounted = false; };
  }, [userEmail]);

  const refreshProjects = useCallback(async () => {
    const token = localStorage.getItem('sr_auth_token');
    if (token) {
      try {
        const remote = await api.projects.getAll();
        if (Array.isArray(remote)) {
          setProjects(remote);
          saveProjects(remote, userEmail);
          return;
        }
      } catch (e) {
        console.warn('Refresh remote failed:', e);
      }
    }
    setProjects(loadProjects(userEmail));
  }, [userEmail]);

  const addProject = useCallback(async (title, content = BLANK_TEMPLATE) => {
    const token = localStorage.getItem('sr_auth_token');
    if (token) {
      try {
        const remoteProject = await api.projects.create(title, content);
        if (remoteProject) {
          setProjects(prev => [remoteProject, ...prev]);
          // also update local cache
          const local = loadProjects(userEmail);
          saveProjects([remoteProject, ...local], userEmail);
          return remoteProject;
        }
      } catch (err) {
        if (err.status === 403 || err.status === 400) {
          throw err;
        }
        console.warn('Backend create failed, using local storage:', err.message);
      }
    }

    const project = createProjectStorage(title, content, userEmail);
    setProjects(prev => [project, ...prev]);
    return project;
  }, [userEmail]);

  const removeProject = useCallback(async (id) => {
    const token = localStorage.getItem('sr_auth_token');
    if (token) {
      api.projects.delete(id).catch(e => console.warn('Remote delete failed:', e));
    }
    deleteProjectStorage(id, userEmail);
    setProjects(prev => prev.filter(p => p.id !== id));
  }, [userEmail]);

  const editProject = useCallback(async (id, updates) => {
    const token = localStorage.getItem('sr_auth_token');
    if (token) {
      api.projects.update(id, updates).catch(e => console.warn('Remote update failed:', e));
    }
    const updated = updateProjectStorage(id, updates, userEmail);
    if (updated) {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates, lastModified: new Date().toISOString() } : p));
    }
    return updated;
  }, [userEmail]);

  const fetchProject = useCallback((id) => {
    const cached = projects.find(p => p.id === id);
    if (cached) return cached;
    return getProjectStorage(id, userEmail);
  }, [projects, userEmail]);

  const archiveProject = useCallback((id) => {
    return editProject(id, { archived: true });
  }, [editProject]);

  const trashProject = useCallback((id) => {
    return editProject(id, { trashed: true });
  }, [editProject]);

  const restoreProject = useCallback((id) => {
    return editProject(id, { trashed: false, archived: false });
  }, [editProject]);

  const activeProjectsCount = projects.filter(p => !p.trashed).length;

  const value = {
    projects,
    loading,
    refreshProjects,
    addProject,
    removeProject,
    editProject,
    fetchProject,
    archiveProject,
    trashProject,
    restoreProject,
    maxResumes: MAX_RESUMES_PER_USER,
    usedResumes: activeProjectsCount,
    remainingResumes: Math.max(0, MAX_RESUMES_PER_USER - activeProjectsCount),
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectProvider');
  return ctx;
}
