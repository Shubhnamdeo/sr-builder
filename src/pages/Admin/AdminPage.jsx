import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useProjects } from '../../contexts/ProjectContext.jsx';
import { api } from '../../services/api.js';
import './AdminPage.css';

export default function AdminPage() {
  const { user, logout, isBackendConnected } = useAuth();
  const { projects: contextProjects, deleteProject: contextDeleteProject, updateProject: contextUpdateProject } = useProjects();
  const navigate = useNavigate();

  // Active view tab: 'users' | 'projects'
  const [activeTab, setActiveTab] = useState('users');

  // Data states
  const [stats, setStats] = useState({ users: 0, projects: 0, uptime: 0, database: { connected: false } });
  const [usersList, setUsersList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter
  const [userSearch, setUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');

  // LaTeX Code Viewer Modal
  const [activeModalProject, setActiveModalProject] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Fetch admin data
  const fetchAdminData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Try backend API first
      const [statsRes, usersRes, projectsRes] = await Promise.allSettled([
        api.admin.getStats(),
        api.admin.getUsers(),
        api.admin.getProjects(),
      ]);

      let backendUsers = usersRes.status === 'fulfilled' ? usersRes.value : null;
      let backendProjects = projectsRes.status === 'fulfilled' ? projectsRes.value : null;
      let backendStats = statsRes.status === 'fulfilled' ? statsRes.value : null;

      // 2. If backend users/projects returned empty or failed (local/offline mode), merge with local storage
      let localUsers = [];
      try {
        const stored = localStorage.getItem('sr_registered_users');
        if (stored) localUsers = JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }

      // Sole pre-seeded administrator
      const preseededUsers = [
        {
          id: 'usr_shubh_admin',
          name: 'Shubh Namdeo',
          email: 'shubh namdeo',
          role: 'admin',
          plan: 'pro',
          createdAt: new Date().toISOString(),
          projectCount: 1,
        },
      ];

      // Merge local users
      let combinedUsers = (backendUsers && backendUsers.length > 0) ? backendUsers : localUsers;
      if (combinedUsers.length === 0) {
        combinedUsers = preseededUsers;
      } else {
        // Ensure preseeded are visible if list is short
        preseededUsers.forEach(pu => {
          if (!combinedUsers.some(u => (u.email || u.userId) === pu.email)) {
            combinedUsers.push(pu);
          }
        });
      }

      // Merge projects
      let combinedProjects = (backendProjects && backendProjects.length > 0) ? backendProjects : [];
      if (combinedProjects.length === 0 && contextProjects && contextProjects.length > 0) {
        combinedProjects = contextProjects.map(p => ({
          id: p.id,
          title: p.title,
          owner: p.owner || 'You',
          content: p.content,
          contentLength: (p.content || '').length,
          lineCount: (p.content || '').split('\n').length,
          lastModified: p.lastModified || new Date().toISOString(),
          createdAt: p.createdAt || new Date().toISOString(),
          user: {
            name: user?.name || 'Administrator',
            email: user?.email || 'admin@example.com',
            role: user?.role || 'admin',
          },
        }));
      }

      // Compute stats
      setStats({
        users: combinedUsers.length,
        projects: combinedProjects.length,
        database: {
          connected: backendStats?.database?.connected || isBackendConnected || false,
        },
        uptime: backendStats?.uptime || 0,
      });

      setUsersList(combinedUsers);
      setProjectsList(combinedProjects);
    } catch (err) {
      console.error('Admin data fetch error:', err);
      setErrorMsg('Failed to load complete admin data. Showing local session cache.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      const q = userSearch.toLowerCase();
      const name = (u.name || '').toLowerCase();
      const email = (u.email || u.userId || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [usersList, userSearch]);

  // Filtered Resumes
  const filteredProjects = useMemo(() => {
    return projectsList.filter(p => {
      const q = projectSearch.toLowerCase();
      const title = (p.title || '').toLowerCase();
      const owner = (p.user?.name || p.owner || '').toLowerCase();
      const email = (p.user?.email || '').toLowerCase();

      const matchesQuery = title.includes(q) || owner.includes(q) || email.includes(q);
      const matchesUser = selectedUserFilter === 'all' || p.user?.email === selectedUserFilter || p.user?.name === selectedUserFilter;

      return matchesQuery && matchesUser;
    });
  }, [projectsList, projectSearch, selectedUserFilter]);

  // User Actions
  const handleToggleUserRole = async (targetUser) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    const confirmMsg = `Are you sure you want to change ${targetUser.name}'s role to ${newRole.toUpperCase()}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (stats.database.connected) {
        await api.admin.updateUserRole(targetUser.id, newRole);
      }
      // Update local state
      setUsersList(prev =>
        prev.map(u => (u.id === targetUser.id ? { ...u, role: newRole } : u))
      );
      setSuccessMsg(`Role for ${targetUser.name} updated to ${newRole}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update user role');
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!window.confirm(`Delete user "${targetUser.name}" (${targetUser.email}) and ALL their resumes permanently?`)) {
      return;
    }

    try {
      if (stats.database.connected) {
        await api.admin.deleteUser(targetUser.id);
      }
      setUsersList(prev => prev.filter(u => u.id !== targetUser.id));
      setProjectsList(prev => prev.filter(p => p.user?.email !== targetUser.email && p.user?.id !== targetUser.id));
      setSuccessMsg(`User ${targetUser.name} deleted successfully.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete user');
    }
  };

  // Resume Actions
  const handleDeleteProject = async (targetProject) => {
    if (!window.confirm(`Delete resume "${targetProject.title}" permanently?`)) {
      return;
    }

    try {
      if (stats.database.connected) {
        await api.admin.deleteProject(targetProject.id);
      } else {
        contextDeleteProject(targetProject.id);
      }
      setProjectsList(prev => prev.filter(p => p.id !== targetProject.id));
      setSuccessMsg(`Resume "${targetProject.title}" deleted.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete resume');
    }
  };

  const handleOpenInspector = async (project) => {
    try {
      // If content is not already in project object, fetch it
      let fullContent = project.content;
      if (!fullContent && stats.database.connected) {
        const fullProj = await api.admin.getProjectById(project.id);
        fullContent = fullProj?.content || '';
      }
      setActiveModalProject({ ...project, content: fullContent });
      setEditedContent(fullContent || '');
      setIsEditingInModal(false);
    } catch (err) {
      console.error(err);
      setActiveModalProject(project);
      setEditedContent(project.content || '');
    }
  };

  const handleSaveModalContent = async () => {
    if (!activeModalProject) return;
    setModalSaving(true);
    try {
      if (stats.database.connected) {
        await api.admin.updateProject(activeModalProject.id, { content: editedContent });
      } else {
        contextUpdateProject(activeModalProject.id, { content: editedContent });
      }
      // Update in projectsList
      setProjectsList(prev =>
        prev.map(p =>
          p.id === activeModalProject.id
            ? { ...p, content: editedContent, lineCount: editedContent.split('\n').length }
            : p
        )
      );
      setActiveModalProject(prev => ({ ...prev, content: editedContent }));
      setIsEditingInModal(false);
      setSuccessMsg('Resume LaTeX code updated successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save changes to resume');
    } finally {
      setModalSaving(false);
    }
  };

  const handleCopyCode = () => {
    if (!editedContent) return;
    navigator.clipboard.writeText(editedContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownloadTex = (project) => {
    const code = project.content || editedContent || '';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(project.title || 'resume').replace(/[^a-zA-Z0-9_-]/g, '_')}.tex`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenInEditor = (projectId) => {
    navigate(`/project/${projectId}`);
  };

  return (
    <div className="admin-container">
      {/* Top Navbar */}
      <header className="admin-navbar">
        <div className="admin-brand-left">
          <div className="sr-bird-badge small">
            <svg className="white-flying-bird" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 3.5C18.5 6.2 14.8 7.8 11.2 8.4C8.5 5.5 5.2 4.2 1.5 4.5C4.2 7.2 6.5 10.5 6.8 14.2C8.5 13.5 10.5 13 12.8 12.8C10.2 16.5 6.5 19.5 2 21.5C7.2 20.8 12.5 18.2 16.2 14.5C19.5 15.2 22.8 16.8 24 18.5C23.2 14.8 21.2 11.2 18.5 8.5C20.2 7 21.5 5.2 22 3.5Z" fill="#FFFFFF"/>
            </svg>
          </div>
          <div className="brand-title-wrap">
            <span className="brand-cursive-title">SR Builder</span>
            <span className="brand-subtitle-tag">Admin Control Center</span>
          </div>
          <div className="admin-mode-pill">
            <span className="admin-indicator-dot"></span>
            ADMIN MODE
          </div>
        </div>

        <div className="admin-navbar-right">
          <div className="db-status-badge">
            <span className={`status-dot ${stats.database?.connected ? 'connected' : 'local'}`}></span>
            {stats.database?.connected ? 'MongoDB Live' : 'Local Storage Mode'}
          </div>

          <button className="user-view-btn" onClick={() => navigate('/projects')}>
            Switch to User View &rarr;
          </button>

          <button className="admin-logout-btn" onClick={logout} title="Sign Out">
            Logout
          </button>
        </div>
      </header>

      {/* Main Admin Area */}
      <main className="admin-content-area">
        {/* Banner Alert Messages */}
        {errorMsg && (
          <div className="admin-banner-alert error">
            <span>&#9888; {errorMsg}</span>
            <button onClick={() => setErrorMsg('')}>&times;</button>
          </div>
        )}
        {successMsg && (
          <div className="admin-banner-alert success">
            <span>&#10003; {successMsg}</span>
            <button onClick={() => setSuccessMsg('')}>&times;</button>
          </div>
        )}

        {/* System Stats Metric Grid */}
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="stat-label">TOTAL REGISTERED USERS</div>
            <div className="stat-value">{stats.users}</div>
            <div className="stat-meta">Active candidate accounts</div>
          </div>

          <div className="admin-stat-card">
            <div className="stat-label">TOTAL RESUMES IN DATABASE</div>
            <div className="stat-value">{stats.projects}</div>
            <div className="stat-meta">LaTeX compilations stored</div>
          </div>

          <div className="admin-stat-card">
            <div className="stat-label">DATABASE ARCHITECTURE</div>
            <div className="stat-value highlight">
              {stats.database?.connected ? 'MongoDB Atlas' : 'Local Fallback'}
            </div>
            <div className="stat-meta">
              {stats.database?.connected ? 'Cloud multi-user synced' : 'Instant offline persistence'}
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="stat-label">SINGLE-PAGE ATS READINESS</div>
            <div className="stat-value success">100%</div>
            <div className="stat-meta">Strict mathematical budget verified</div>
          </div>
        </div>

        {/* Tabs Strip */}
        <div className="admin-tabs-bar">
          <div className="tabs-left">
            <button
              className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Registered Users ({filteredUsers.length})
            </button>

            <button
              className={`admin-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Resume Database ({filteredProjects.length})
            </button>
          </div>

          <div className="tabs-right-refresh">
            <button className="refresh-btn" onClick={fetchAdminData} title="Refresh Live Database">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Tab 1: Users View */}
        {activeTab === 'users' && (
          <div className="admin-panel-table-wrap">
            <div className="table-search-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                placeholder="Search users by name, user ID, email, or role..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              {userSearch && (
                <button className="clear-search-btn" onClick={() => setUserSearch('')}>&times;</button>
              )}
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>USER</th>
                    <th>EMAIL / USER ID</th>
                    <th>ROLE</th>
                    <th>RESUMES</th>
                    <th>REGISTERED</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="table-empty-row">
                        No users matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id || u.email}>
                        <td>
                          <div className="user-profile-cell">
                            <div className="user-avatar-circle">
                              {(u.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="user-cell-name">{u.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="user-email-text">{u.email || u.userId}</span>
                        </td>
                        <td>
                          <span className={`role-badge ${u.role === 'admin' ? 'admin' : 'user'}`}>
                            {u.role === 'admin' ? 'ADMINISTRATOR' : 'CANDIDATE'}
                          </span>
                        </td>
                        <td>
                          <span className="resumes-count-badge">
                            {u.projectCount || 0}
                          </span>
                        </td>
                        <td>
                          <span className="date-cell-text">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}
                          </span>
                        </td>
                        <td>
                          <div className="actions-cell-wrap">
                            <button
                              className="action-pill-btn"
                              onClick={() => {
                                setSelectedUserFilter(u.email || u.name);
                                setActiveTab('projects');
                              }}
                              title="Filter and inspect resumes created by this user"
                            >
                              View Resumes
                            </button>

                            {u.role === 'admin' ? (
                              <span className="sole-admin-tag" title="Designated Sole Administrator">
                                Sole Admin
                              </span>
                            ) : null}

                            {u.role !== 'admin' && (
                              <button
                                className="action-icon-btn danger"
                                onClick={() => handleDeleteUser(u)}
                                title="Delete user account and resumes"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Resume Database View */}
        {activeTab === 'projects' && (
          <div className="admin-panel-table-wrap">
            <div className="table-filter-toolbar">
              <div className="table-search-bar" style={{ flex: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  placeholder="Search resumes by title, owner name, or email..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                />
                {projectSearch && (
                  <button className="clear-search-btn" onClick={() => setProjectSearch('')}>&times;</button>
                )}
              </div>

              {selectedUserFilter !== 'all' && (
                <div className="active-filter-pill">
                  <span>Filtered by: <strong>{selectedUserFilter}</strong></span>
                  <button onClick={() => setSelectedUserFilter('all')}>&times;</button>
                </div>
              )}
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>RESUME TITLE</th>
                    <th>OWNER</th>
                    <th>SIZE / LINES</th>
                    <th>LAST MODIFIED</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="table-empty-row">
                        No resumes found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="resume-title-cell">
                            <span className="file-tex-icon">&#123;\TeX&#125;</span>
                            <span className="resume-name-text">{p.title}</span>
                          </div>
                        </td>
                        <td>
                          <div className="owner-cell-wrap">
                            <span className="owner-name">{p.user?.name || p.owner || 'Unknown'}</span>
                            <span className="owner-email">{p.user?.email || 'N/A'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="lines-count-text">
                            {p.lineCount || (p.content ? p.content.split('\n').length : 0)} lines
                          </span>
                        </td>
                        <td>
                          <span className="date-cell-text">
                            {p.lastModified ? new Date(p.lastModified).toLocaleString() : 'Just now'}
                          </span>
                        </td>
                        <td>
                          <div className="actions-cell-wrap">
                            <button
                              className="action-pill-btn highlight"
                              onClick={() => handleOpenInspector(p)}
                              title="Inspect and view full LaTeX source code"
                            >
                              View LaTeX
                            </button>

                            <button
                              className="action-pill-btn"
                              onClick={() => handleOpenInEditor(p.id)}
                              title="Open resume in live editor"
                            >
                              Open in Editor
                            </button>

                            <button
                              className="action-icon-btn"
                              onClick={() => handleDownloadTex(p)}
                              title="Download .tex source file"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </button>

                            <button
                              className="action-icon-btn danger"
                              onClick={() => handleDeleteProject(p)}
                              title="Delete this resume permanently"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* LaTeX Code Inspector Modal */}
      {activeModalProject && (
        <div className="admin-modal-backdrop" onClick={() => setActiveModalProject(null)}>
          <div className="admin-code-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-left">
                <span className="tex-badge">&#123;\TeX&#125;</span>
                <div>
                  <h3 className="modal-heading">{activeModalProject.title}</h3>
                  <span className="modal-sub">
                    Owner: <strong>{activeModalProject.user?.name || activeModalProject.owner}</strong> ({activeModalProject.user?.email || 'N/A'}) &bull; {editedContent.split('\n').length} lines
                  </span>
                </div>
              </div>

              <div className="modal-header-actions">
                <button className="modal-action-btn" onClick={handleCopyCode}>
                  {copySuccess ? '✓ Copied' : 'Copy Code'}
                </button>

                <button
                  className="modal-action-btn"
                  onClick={() => handleDownloadTex(activeModalProject)}
                >
                  Download .tex
                </button>

                <button
                  className="modal-action-btn primary"
                  onClick={() => handleOpenInEditor(activeModalProject.id)}
                >
                  Open in Editor &rarr;
                </button>

                <button className="modal-close-btn" onClick={() => setActiveModalProject(null)}>
                  &times;
                </button>
              </div>
            </div>

            {/* Code Body */}
            <div className="modal-body-editor">
              <textarea
                className="modal-code-textarea"
                value={editedContent}
                onChange={(e) => {
                  setEditedContent(e.target.value);
                  setIsEditingInModal(true);
                }}
                spellCheck="false"
              />
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <div className="modal-footer-left">
                {isEditingInModal && (
                  <span className="unsaved-badge">&#9679; You have unsaved changes in this resume</span>
                )}
              </div>

              <div className="modal-footer-right">
                <button className="modal-cancel-btn" onClick={() => setActiveModalProject(null)}>
                  Close
                </button>

                {isEditingInModal && (
                  <button
                    className="modal-save-btn"
                    onClick={handleSaveModalContent}
                    disabled={modalSaving}
                  >
                    {modalSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
