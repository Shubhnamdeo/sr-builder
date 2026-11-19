import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../contexts/ProjectContext.jsx';
import { SOFTWARE_ENGINEER_TEMPLATE, RESUME_TEMPLATE } from '../../utils/latexTemplates.js';
import './NewProjectModal.css';

function NewProjectModal({ onClose }) {
  const { addProject } = useProjects();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [startType, setStartType] = useState('software_engineer');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const name = projectName.trim() || 'My Resume';

    let initialContent = SOFTWARE_ENGINEER_TEMPLATE;
    if (startType === 'modern_resume') {
      initialContent = RESUME_TEMPLATE;
    } else if (startType === 'empty') {
      initialContent = '';
    }

    try {
      const project = await addProject(name, initialContent);
      onClose();
      if (project?.id) {
        navigate(`/project/${project.id}`);
      }
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
          <h2>New Resume Project</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="project-name">Project / Resume Name</label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={e => { setProjectName(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Software Engineer Resume, Google Application..."
              autoFocus
              className={error ? 'has-error' : ''}
            />
            {error && <span className="form-error">{error}</span>}
          </div>

          <div className="form-group">
            <label>Choose Starter Template</label>
            <div className="template-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <button
                type="button"
                className={`template-card ${startType === 'software_engineer' ? 'selected' : ''}`}
                onClick={() => setStartType('software_engineer')}
              >
                <div className="template-icon">🚀</div>
                <span className="template-name">Software Engineer</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>FAANG standard · 1-page compact</span>
              </button>

              <button
                type="button"
                className={`template-card ${startType === 'modern_resume' ? 'selected' : ''}`}
                onClick={() => setStartType('modern_resume')}
              >
                <div className="template-icon">💼</div>
                <span className="template-name">Modern Professional</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Clean format · All professions</span>
              </button>

              <button
                type="button"
                className={`template-card ${startType === 'empty' ? 'selected' : ''}`}
                onClick={() => setStartType('empty')}
              >
                <div className="template-icon">📄</div>
                <span className="template-name">Blank Slate</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Empty editor for custom code</span>
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-create" onClick={handleCreate}>Create Project</button>
        </div>
      </div>
    </div>
  );
}

export default NewProjectModal;
