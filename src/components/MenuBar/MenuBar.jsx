import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MenuBar.css';

const INSERT_ITEMS = [
  { id: 'math', label: 'Math', hasSubmenu: true, snippet: '$$\n\\[ \\sum_{i=1}^n x_i = X \\]\n$$' },
  { id: 'symbol', label: 'Symbol', snippet: '\\alpha' },
  { id: 'figure', label: 'Figure', hasSubmenu: true, snippet: '\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{image.png}\n  \\caption{Caption}\n  \\label{fig:my_label}\n\\end{figure}' },
  { id: 'table', label: 'Table', snippet: '\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{|c|c|}\n    \\hline\n    Header 1 & Header 2 \\\\\n    \\hline\n    Item 1 & Item 2 \\\\\n    \\hline\n  \\end{tabular}\n  \\caption{Sample Table}\n  \\label{tab:my_label}\n\\end{table}' },
  { id: 'citation', label: 'Citation', snippet: '\\cite{reference_key}' },
  { id: 'link', label: 'Link', snippet: '\\href{https://example.com}{Link text}' },
  { id: 'crossref', label: 'Cross reference', snippet: '\\ref{fig:my_label}' },
  { id: 'comment', label: 'Comment', snippet: '% This is a comment\n' },
  { type: 'divider' },
  { id: 'abstract', label: 'Abstract', hasSparkle: true, snippet: '\\begin{abstract}\n  Summary of project and key outcomes.\n\\end{abstract}' },
  { id: 'keywords', label: 'Keywords', hasSparkle: true, snippet: '\\textbf{Keywords:} React, Vite, LaTeX, Web Development, Full Stack' },
  { id: 'title', label: 'Title', hasSparkle: true, snippet: '\\maketitle\n' },
];

function MenuBar({
  projectName,
  layout,
  onLayoutChange,
  onInsert,
  focusMode,
  onFocusModeToggle,
  showBreadcrumbs,
  onShowBreadcrumbsToggle,
  showEditorTabs,
  onShowEditorTabsToggle,
  showEquationPreview,
  onShowEquationPreviewToggle,
  onNavigateHome,
  onOpenAiAssistant,
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const menuBarRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleMenu = (menuName) => {
    setActiveMenu(prev => prev === menuName ? null : menuName);
  };

  const handleInsertClick = (snippet) => {
    if (snippet) {
      onInsert(snippet);
    }
    setActiveMenu(null);
  };

  return (
    <div className="overleaf-menubar" ref={menuBarRef}>
      {/* Left Section */}
      <div className="menubar-left-cluster">
        {/* SR Builder Logo */}
        <button className="menubar-logo-btn" onClick={onNavigateHome} title="SR Builder Home">
          <div className="sr-bird-badge small">
            <svg className="white-flying-bird" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 3.5C18.5 6.2 14.8 7.8 11.2 8.4C8.5 5.5 5.2 4.2 1.5 4.5C4.2 7.2 6.5 10.5 6.8 14.2C8.5 13.5 10.5 13 12.8 12.8C10.2 16.5 6.5 19.5 2 21.5C7.2 20.8 12.5 18.2 16.2 14.5C19.5 15.2 22.8 16.8 24 18.5C23.2 14.8 21.2 11.2 18.5 8.5C20.2 7 21.5 5.2 22 3.5Z" fill="#FFFFFF"/>
            </svg>
          </div>
        </button>

        {/* File Menu */}
        <div className="menu-dropdown-wrapper">
          <button
            className={`menu-tab-btn ${activeMenu === 'file' ? 'active-menu' : ''}`}
            onClick={() => toggleMenu('file')}
            onMouseEnter={() => activeMenu && setActiveMenu('file')}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="overleaf-menu-panel">
              <button className="menu-action-row" onClick={() => { onNavigateHome(); setActiveMenu(null); }}>
                <span>Back to projects</span>
              </button>
              <div className="menu-item-separator" />
              <button className="menu-action-row" onClick={() => { onInsert('% New Section\n\\section{New Section}\n'); setActiveMenu(null); }}>
                <span>New section</span>
              </button>
              <button className="menu-action-row" onClick={() => { window.print(); setActiveMenu(null); }}>
                <span>Print / Save as PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="menu-dropdown-wrapper">
          <button
            className={`menu-tab-btn ${activeMenu === 'edit' ? 'active-menu' : ''}`}
            onClick={() => toggleMenu('edit')}
            onMouseEnter={() => activeMenu && setActiveMenu('edit')}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <div className="overleaf-menu-panel">
              <button className="menu-action-row" onClick={() => { document.execCommand('undo'); setActiveMenu(null); }}>
                <span>Undo</span>
                <span className="menu-shortcut">Ctrl+Z</span>
              </button>
              <button className="menu-action-row" onClick={() => { document.execCommand('redo'); setActiveMenu(null); }}>
                <span>Redo</span>
                <span className="menu-shortcut">Ctrl+Y</span>
              </button>
              <div className="menu-item-separator" />
              <button className="menu-action-row" onClick={() => { onInsert('\\textbf{bold text}'); setActiveMenu(null); }}>
                <span>Bold</span>
                <span className="menu-shortcut">Ctrl+B</span>
              </button>
              <button className="menu-action-row" onClick={() => { onInsert('\\textit{italic text}'); setActiveMenu(null); }}>
                <span>Italic</span>
                <span className="menu-shortcut">Ctrl+I</span>
              </button>
            </div>
          )}
        </div>

        {/* Insert Menu - Image 4 Reference */}
        <div className="menu-dropdown-wrapper">
          <button
            className={`menu-tab-btn ${activeMenu === 'insert' ? 'active-menu' : ''}`}
            onClick={() => toggleMenu('insert')}
            onMouseEnter={() => activeMenu && setActiveMenu('insert')}
          >
            Insert
          </button>
          {activeMenu === 'insert' && (
            <div className="overleaf-menu-panel insert-menu-panel">
              {INSERT_ITEMS.map((item, idx) => {
                if (item.type === 'divider') {
                  return <div key={`div-${idx}`} className="menu-item-separator" />;
                }
                return (
                  <button
                    key={item.id}
                    className="menu-action-row"
                    onClick={() => handleInsertClick(item.snippet)}
                  >
                    <div className="action-row-left">
                      {item.hasSparkle && <span className="sparkle-star">✦</span>}
                      <span>{item.label}</span>
                    </div>
                    {item.hasSubmenu && <span className="submenu-chevron">›</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* View Menu - Image 3 Reference */}
        <div className="menu-dropdown-wrapper">
          <button
            className={`menu-tab-btn ${activeMenu === 'view' ? 'active-menu' : ''}`}
            onClick={() => toggleMenu('view')}
            onMouseEnter={() => activeMenu && setActiveMenu('view')}
          >
            View
          </button>
          {activeMenu === 'view' && (
            <div className="overleaf-menu-panel view-menu-panel">
              <div className="menu-group-header">Layout options</div>

              {/* Split View */}
              <button
                className={`menu-action-row ${layout === 'split' ? 'active-option-sky' : ''}`}
                onClick={() => { onLayoutChange('split'); setActiveMenu(null); }}
              >
                <div className="action-row-left">
                  <span className="check-indicator">{layout === 'split' ? '✓' : ''}</span>
                  <span>Split view</span>
                </div>
              </button>

              {/* Editor Only */}
              <button
                className={`menu-action-row ${layout === 'editor' ? 'active-option-sky' : ''}`}
                onClick={() => { onLayoutChange('editor'); setActiveMenu(null); }}
              >
                <div className="action-row-left">
                  <span className="check-indicator">{layout === 'editor' ? '✓' : ''}</span>
                  <span>Editor only</span>
                </div>
              </button>

              {/* PDF Only */}
              <button
                className={`menu-action-row ${layout === 'pdf' ? 'active-option-sky' : ''}`}
                onClick={() => { onLayoutChange('pdf'); setActiveMenu(null); }}
              >
                <div className="action-row-left">
                  <span className="check-indicator">{layout === 'pdf' ? '✓' : ''}</span>
                  <span>PDF only</span>
                </div>
              </button>

              {/* Open in separate tab */}
              <button
                className="menu-action-row"
                onClick={() => { window.open(window.location.href, '_blank'); setActiveMenu(null); }}
              >
                <div className="action-row-left">
                  <span className="check-indicator"></span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  <span>Open PDF in separate tab</span>
                </div>
              </button>

              {/* Focus mode */}
              <button
                className="menu-action-row"
                onClick={() => { onFocusModeToggle(); setActiveMenu(null); }}
              >
                <div className="action-row-left">
                  <span className="check-indicator">{focusMode ? '✓' : ''}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  </svg>
                  <span>Focus mode</span>
                </div>
                <span className="menu-shortcut">Ctrl Shift M</span>
              </button>

              <div className="menu-item-separator" />

              {/* Editing mode */}
              <div className="menu-action-row non-clickable-row">
                <span>Editing mode</span>
                <span className="submenu-chevron">›</span>
              </div>

              <div className="menu-item-separator" />

              <div className="menu-group-header">Editor settings</div>

              {/* Show breadcrumbs */}
              <button
                className="menu-action-row"
                onClick={() => { onShowBreadcrumbsToggle(); setActiveMenu(null); }}
              >
                <div className="action-row-left">
                  <span className="check-indicator">{showBreadcrumbs ? '✓' : ''}</span>
                  <span>Show breadcrumbs</span>
                </div>
              </button>

              {/* Show editor tabs */}
              <button
                className="menu-action-row"
                onClick={() => { onShowEditorTabsToggle(); setActiveMenu(null); }}
              >
                <div className="action-row-left">
                  <span className="check-indicator">{showEditorTabs ? '✓' : ''}</span>
                  <span>Show editor tabs</span>
                </div>
              </button>

              {/* Show equation preview */}
              <button
                className="menu-action-row"
                onClick={() => { onShowEquationPreviewToggle(); setActiveMenu(null); }}
              >
                <div className="action-row-left">
                  <span className="check-indicator">{showEquationPreview ? '✓' : ''}</span>
                  <span>Show equation preview</span>
                </div>
              </button>

              <div className="menu-item-separator" />

              <div className="menu-group-header">PDF preview</div>

              <button
                className="menu-action-row"
                onClick={() => { onLayoutChange('pdf'); setActiveMenu(null); }}
              >
                <div className="action-row-left">
                  <span className="check-indicator"></span>
                  <span>Presentation mode</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Format Menu */}
        <div className="menu-dropdown-wrapper">
          <button
            className={`menu-tab-btn ${activeMenu === 'format' ? 'active-menu' : ''}`}
            onClick={() => toggleMenu('format')}
            onMouseEnter={() => activeMenu && setActiveMenu('format')}
          >
            Format
          </button>
          {activeMenu === 'format' && (
            <div className="overleaf-menu-panel">
              <button className="menu-action-row" onClick={() => { onInsert('\\section{Section Name}\n'); setActiveMenu(null); }}>
                <span>Section</span>
              </button>
              <button className="menu-action-row" onClick={() => { onInsert('\\subsection{Subsection Name}\n'); setActiveMenu(null); }}>
                <span>Subsection</span>
              </button>
              <div className="menu-item-separator" />
              <button className="menu-action-row" onClick={() => { onInsert('\\begin{itemize}\n  \\item \n\\end{itemize}'); setActiveMenu(null); }}>
                <span>Bullet list</span>
              </button>
              <button className="menu-action-row" onClick={() => { onInsert('\\begin{enumerate}\n  \\item \n\\end{enumerate}'); setActiveMenu(null); }}>
                <span>Numbered list</span>
              </button>
            </div>
          )}
        </div>

        {/* Shiny Glowing AI Resume Button replacing Help & Upgrade */}
        <button
          className="ai-resume-glow-btn"
          onClick={onOpenAiAssistant}
          title="Gemini AI Resume Copilot & Code Editor"
        >
          <span className="ai-sparkle-icon">✨</span>
          <span className="ai-resume-label">AI resume</span>
        </button>
      </div>

      {/* Center Project Name */}
      <div className="menubar-center-title" onClick={() => onNavigateHome()} title="Click to view all projects">
        <span className="project-heading-text">{projectName}</span>
        <svg className="chevron-down-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Right Section */}
      <div className="menubar-right-cluster">
        <button className="menubar-tool-action" title="Version History">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>History</span>
        </button>

        <button
          className="menubar-tool-action"
          title="Toggle Layout"
          onClick={() => onLayoutChange(layout === 'split' ? 'editor' : layout === 'editor' ? 'pdf' : 'split')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="12" y1="3" x2="12" y2="21"/>
          </svg>
          <span>Layout</span>
        </button>
      </div>
    </div>
  );
}

export default MenuBar;
