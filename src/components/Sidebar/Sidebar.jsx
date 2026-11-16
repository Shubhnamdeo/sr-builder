import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import './Sidebar.css';

function Sidebar({ activeFilter, onFilterChange }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  return (
    <aside className="overleaf-sidebar">
      {/* Top Logo */}
      <div className="sidebar-brand-block" onClick={() => navigate('/projects')} title="SR Builder Home">
        <div className="brand-logo-row">
          <div className="sr-bird-badge small">
            <svg className="white-flying-bird" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 3.5C18.5 6.2 14.8 7.8 11.2 8.4C8.5 5.5 5.2 4.2 1.5 4.5C4.2 7.2 6.5 10.5 6.8 14.2C8.5 13.5 10.5 13 12.8 12.8C10.2 16.5 6.5 19.5 2 21.5C7.2 20.8 12.5 18.2 16.2 14.5C19.5 15.2 22.8 16.8 24 18.5C23.2 14.8 21.2 11.2 18.5 8.5C20.2 7 21.5 5.2 22 3.5Z" fill="#FFFFFF"/>
            </svg>
          </div>
          <div className="brand-title-wrap">
            <span className="brand-cursive-title">SR Builder</span>
            <span className="brand-subtitle-tag">Shubh's Resume Builder</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-menu-list">
        {/* Projects group */}
        <div
          className={`sidebar-pill-item ${activeFilter === 'all' ? 'active-pill' : ''}`}
          onClick={() => onFilterChange('all')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Projects</span>
        </div>

        <div className="sidebar-sub-items">
          <div
            className={`sub-item ${activeFilter === 'yours' ? 'active-sub' : ''}`}
            onClick={() => onFilterChange('yours')}
          >
            Your projects
          </div>
          <div
            className={`sub-item ${activeFilter === 'shared' ? 'active-sub' : ''}`}
            onClick={() => onFilterChange('shared')}
          >
            Shared with you
          </div>
          <div
            className={`sub-item ${activeFilter === 'archived' ? 'active-sub' : ''}`}
            onClick={() => onFilterChange('archived')}
          >
            Archived projects
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* Library */}
        <div
          className={`sidebar-nav-row ${activeFilter === 'library' ? 'active-nav' : ''}`}
          onClick={() => onFilterChange('library')}
        >
          <div className="nav-row-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span>Library</span>
          </div>
          <span className="badge-new">New</span>
        </div>

        {/* Trash */}
        <div
          className={`sidebar-nav-row ${activeFilter === 'trashed' ? 'active-nav' : ''}`}
          onClick={() => onFilterChange('trashed')}
        >
          <div className="nav-row-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>Trash</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* Account */}
        <div className="sidebar-nav-row account-row" onClick={() => setShowAccountMenu(!showAccountMenu)}>
          <div className="nav-row-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Account</span>
          </div>
          <span className="more-dots">⋮</span>
        </div>

        {showAccountMenu && (
          <div className="sidebar-account-dropdown">
            <div className="account-dropdown-user">
              <strong>{user?.name || 'Shubh Namdeo'}</strong>
              <span>{user?.email || 'shubhnamdeo@gmail.com'}</span>
            </div>
            <button
              className="account-logout-btn"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Log out
            </button>
          </div>
        )}

        {/* Help */}
        <div className="sidebar-nav-row">
          <div className="nav-row-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Help</span>
          </div>
          <span className="more-dots">⋮</span>
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-bottom-badge">
        <span>DIGITAL SCIENCE</span>
      </div>
    </aside>
  );
}

export default Sidebar;
