import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../contexts/ProjectContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Sidebar from '../../components/Sidebar/Sidebar.jsx';
import NewProjectModal from '../../components/Modals/NewProjectModal.jsx';
import './ProjectDashboard.css';

function ProjectDashboard() {
  const {
    projects,
    removeProject,
    trashProject,
    archiveProject,
    restoreProject,
    maxResumes,
    usedResumes,
    remainingResumes
  } = useProjects();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('lastModified');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedProjects, setSelectedProjects] = useState(new Set());
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectAll, setSelectAll] = useState(false);
  const [showCookies, setShowCookies] = useState(true);

  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(p => {
      if (activeFilter === 'all') return !p.trashed;
      if (activeFilter === 'yours') return !p.trashed && !p.archived;
      if (activeFilter === 'archived') return p.archived && !p.trashed;
      if (activeFilter === 'trashed') return p.trashed;
      return true;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(q));
    }

    filtered.sort((a, b) => {
      let valA, valB;
      if (sortField === 'title') {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else if (sortField === 'owner') {
        valA = a.owner.toLowerCase();
        valB = b.owner.toLowerCase();
      } else {
        valA = new Date(a.lastModified).getTime();
        valB = new Date(b.lastModified).getTime();
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [projects, searchQuery, sortField, sortDirection, activeFilter]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectProject = (id) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenProject = (id) => {
    navigate(`/project/${id}`);
  };

  const handleDeleteSelected = () => {
    if (selectedProjects.size === 0) return;
    if (activeFilter === 'trashed') {
      selectedProjects.forEach(id => removeProject(id));
    } else {
      selectedProjects.forEach(id => trashProject(id));
    }
    setSelectedProjects(new Set());
    setSelectAll(false);
  };

  const handleArchiveSelected = () => {
    selectedProjects.forEach(id => archiveProject(id));
    setSelectedProjects(new Set());
    setSelectAll(false);
  };

  const handleRestoreSelected = () => {
    selectedProjects.forEach(id => restoreProject(id));
    setSelectedProjects(new Set());
    setSelectAll(false);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'a day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getFilterTitle = () => {
    switch (activeFilter) {
      case 'all': return 'All projects';
      case 'yours': return 'Your projects';
      case 'archived': return 'Archived projects';
      case 'trashed': return 'Trashed projects';
      default: return 'All projects';
    }
  };

  return (
    <div className="overleaf-app-container">
      {/* Top Navigation */}
      <header className="dashboard-top-navbar">
        <div className="top-nav-left">
          {/* Overleaf logo shown in sidebar */}
        </div>
        <div className="top-nav-right">
          <div className="storage-quota-badge" title={`${usedResumes} of ${maxResumes} resumes stored in cloud`}>
            <span className="storage-quota-pill">{usedResumes} / {maxResumes} Resumes</span>
          </div>
          <div className="user-profile-badge" title={user?.email || 'shubhnamdeo@gmail.com'}>
            <span className="user-avatar">{user?.name ? user.name[0].toUpperCase() : 'S'}</span>
            <span className="user-display-email">{user?.email || 'shubhnamdeo@gmail.com'}</span>
          </div>
          <button
            className="dashboard-logout-btn"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Log out of your account"
          >
            Log Out
          </button>
        </div>
      </header>

      <div className="dashboard-body">
        <Sidebar activeFilter={activeFilter} onFilterChange={setActiveFilter} />

        <main className="dashboard-main-area">
          <div className="dashboard-content-box">
            {/* Header row */}
            <div className="content-title-row">
              <h1 className="projects-heading">{getFilterTitle()}</h1>
              <div className="quota-status-chip">
                <span>Cloud Storage:</span> <strong>{usedResumes} / {maxResumes}</strong> resumes ({remainingResumes} available)
              </div>
            </div>

            {/* Actions row: Search & New Project */}
            <div className="dashboard-search-row">
              <div className="overleaf-search-box">
                <svg className="search-glass-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search in all projects..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="overleaf-search-input"
                />
              </div>

              <button className="overleaf-new-project-btn" onClick={() => setShowNewProjectModal(true)}>
                New project
              </button>
            </div>

            {/* Bulk actions */}
            {selectedProjects.size > 0 && (
              <div className="bulk-toolbar">
                <span className="bulk-count">{selectedProjects.size} selected</span>
                {activeFilter === 'trashed' ? (
                  <>
                    <button className="bulk-action-btn restore" onClick={handleRestoreSelected}>Restore</button>
                    <button className="bulk-action-btn danger" onClick={handleDeleteSelected}>Delete forever</button>
                  </>
                ) : (
                  <>
                    <button className="bulk-action-btn" onClick={handleArchiveSelected}>Archive</button>
                    <button className="bulk-action-btn danger" onClick={handleDeleteSelected}>Trash</button>
                  </>
                )}
              </div>
            )}

            {/* Projects Table */}
            <div className="overleaf-table-wrapper">
              <div className="overleaf-table-head">
                <div className="th-cell th-checkbox">
                  <input type="checkbox" checked={selectAll} onChange={handleSelectAll} />
                </div>
                <div className="th-cell th-title" onClick={() => handleSort('title')}>
                  Title {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                </div>
                <div className="th-cell th-owner" onClick={() => handleSort('owner')}>
                  Owner {sortField === 'owner' && (sortDirection === 'asc' ? '↑' : '↓')}
                </div>
                <div className="th-cell th-modified" onClick={() => handleSort('lastModified')}>
                  Last modified {sortField === 'lastModified' ? (sortDirection === 'asc' ? '↑' : '↓') : '↓'}
                </div>
                <div className="th-cell th-dots"></div>
              </div>

              <div className="overleaf-table-body">
                {filteredProjects.length === 0 ? (
                  <div className="table-empty-row">
                    <p>{activeFilter === 'trashed' ? 'Trash is empty' : 'No projects found'}</p>
                    {activeFilter !== 'trashed' && (
                      <button className="overleaf-new-project-btn small" onClick={() => setShowNewProjectModal(true)}>
                        Create new project
                      </button>
                    )}
                  </div>
                ) : (
                  filteredProjects.map(project => (
                    <div
                      key={project.id}
                      className={`overleaf-row ${selectedProjects.has(project.id) ? 'row-selected' : ''}`}
                    >
                      <div className="td-cell td-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedProjects.has(project.id)}
                          onChange={() => handleSelectProject(project.id)}
                        />
                      </div>
                      <div className="td-cell td-title" onClick={() => handleOpenProject(project.id)}>
                        <span className="project-link-text">{project.title}</span>
                      </div>
                      <div className="td-cell td-owner">{project.owner}</div>
                      <div className="td-cell td-modified">
                        {formatDate(project.lastModified)} by {project.owner}
                      </div>
                      <div className="td-cell td-dots">
                        <button
                          className="dots-menu-btn"
                          title="Actions"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProject(project.id);
                          }}
                        >
                          ⋮
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Cookies banner matching Image 1 */}
      {showCookies && (
        <div className="overleaf-cookies-banner">
          <div className="cookies-text">
            We use cookies to improve your experience on our site, for analytics, and to support marketing, which may involve the sharing of data. You can find out more in our <a href="#privacy">cookie policy</a>.
          </div>
          <div className="cookies-actions">
            <button className="cookies-btn-secondary" onClick={() => setShowCookies(false)}>
              Essential cookies only
            </button>
            <button className="cookies-btn-primary" onClick={() => setShowCookies(false)}>
              Accept all cookies
            </button>
          </div>
        </div>
      )}

      {showNewProjectModal && (
        <NewProjectModal onClose={() => setShowNewProjectModal(false)} />
      )}
    </div>
  );
}

export default ProjectDashboard;
