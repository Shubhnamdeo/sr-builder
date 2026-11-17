import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../contexts/ProjectContext.jsx';
import './NewProjectModal.css';

function NewProjectModal({ onClose }) {
  const { addProject } = useProjects();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [startType, setStartType] = useState('empty'); // 'empty' by default!
  const [error, setError] = useState('');

  const handleCreate = () => {
    const name = projectName.trim();
    if (!name) {
      setError('Please enter a project name');
      return;
    }

    // Starts completely empty as requested!
    let initialContent = '';
    if (startType === 'blank_article') {
      initialContent = `\\documentclass{article}\n\\usepackage{graphicx}\n\n\\title{${name}}\n\\author{Your Name}\n\\date{\\today}\n\n\\begin{document}\n\n\\maketitle\n\n\\section{Introduction}\n\n\\end{document}`;
    }

    try {
      const project = addProject(name, initialContent);
      onClose();
      navigate(`/project/${project.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create project');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Project</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="project-name">Project Name</label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={e => { setProjectName(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. My Resume, Project 1..."
              autoFocus
              className={error ? 'has-error' : ''}
            />
            {error && <span className="form-error">{error}</span>}
          </div>

          <div className="form-group">
            <label>Starting Content</label>
            <div className="template-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                type="button"
                className={`template-card ${startType === 'empty' ? 'selected' : ''}`}
                onClick={() => setStartType('empty')}
              >
                <div className="template-icon">📄</div>
                <span className="template-name">Empty Project (Clean Slate)</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Starts with empty code</span>
              </button>

              <button
                type="button"
                className={`template-card ${startType === 'blank_article' ? 'selected' : ''}`}
                onClick={() => setStartType('blank_article')}
              >
                <div className="template-icon">📑</div>
                <span className="template-name">Article Starter</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>With \\documentclass structure</span>
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-create" onClick={handleCreate}>Create</button>
        </div>
      </div>
    </div>
  );
}

export default NewProjectModal;
