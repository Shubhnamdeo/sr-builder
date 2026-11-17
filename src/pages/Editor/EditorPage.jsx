import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../../contexts/ProjectContext.jsx';
import MenuBar from '../../components/MenuBar/MenuBar.jsx';
import EditorToolbar from '../../components/EditorToolbar/EditorToolbar.jsx';
import CodeEditor from '../../components/CodeEditor/CodeEditor.jsx';
import PdfPreview from '../../components/PdfPreview/PdfPreview.jsx';
import AiResumeModal from '../../components/AiResumeModal/AiResumeModal.jsx';
import './EditorPage.css';

function EditorPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { fetchProject, editProject } = useProjects();
  const [project, setProject] = useState(null);
  const [content, setContent] = useState('');
  const [pages, setPages] = useState([]);
  const [layout, setLayout] = useState('split'); // 'split', 'editor', 'pdf'
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState(null);
  const [editorMode, setEditorMode] = useState('code'); // 'code' or 'visual'
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(true);
  const [showEditorTabs, setShowEditorTabs] = useState(true);
  const [showEquationPreview, setShowEquationPreview] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Compile LaTeX code into paginated A4 PDF sheets
  const compileToPdf = useCallback((codeContent) => {
    setIsCompiling(true);
    setCompileError(null);

    try {
      const generatedPages = compileLatexToPaginatedPdf(codeContent);
      setPages(generatedPages);
    } catch (err) {
      setCompileError(err.message || 'Compilation error');
    } finally {
      setTimeout(() => {
        setIsCompiling(false);
      }, 200);
    }
  }, []);

  useEffect(() => {
    const proj = fetchProject(projectId);
    if (!proj) {
      navigate('/projects');
      return;
    }
    setProject(proj);
    const initialCode = proj.content || '';
    setContent(initialCode);
    compileToPdf(initialCode);
  }, [projectId]);

  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      editProject(projectId, { content: newContent });
    }, 800);
  }, [projectId, editProject]);

  // When user presses "Recompile" button or Ctrl+Enter
  const handleRecompile = useCallback(() => {
    compileToPdf(content);
    editProject(projectId, { content });
  }, [content, projectId, editProject, compileToPdf]);

  const handleInsert = useCallback((snippet) => {
    if (editorRef.current) {
      editorRef.current.insertSnippet(snippet);
    }
  }, []);

  // SyncTeX: Click in PDF navigates cursor directly to matching LaTeX code
  const handlePdfTextClick = useCallback((clickedText) => {
    if (editorRef.current) {
      if (layout === 'pdf') {
        setLayout('split');
      }
      editorRef.current.scrollToText(clickedText);
    }
  }, [layout]);

  // Split view drag
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percentage = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPosition(Math.max(20, Math.min(80, percentage)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Keyboard shortcuts (Ctrl+Enter to Recompile, Ctrl+S to save)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        editProject(projectId, { content });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRecompile();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, projectId, editProject, handleRecompile]);

  if (!project) {
    return <div className="editor-loading">Loading project...</div>;
  }

  return (
    <div className={`editor-page ${focusMode ? 'focus-mode' : ''}`}>
      <MenuBar
        projectName={project.title}
        layout={layout}
        onLayoutChange={setLayout}
        onInsert={handleInsert}
        focusMode={focusMode}
        onFocusModeToggle={() => setFocusMode(!focusMode)}
        showBreadcrumbs={showBreadcrumbs}
        onShowBreadcrumbsToggle={() => setShowBreadcrumbs(!showBreadcrumbs)}
        showEditorTabs={showEditorTabs}
        onShowEditorTabsToggle={() => setShowEditorTabs(!showEditorTabs)}
        showEquationPreview={showEquationPreview}
        onShowEquationPreviewToggle={() => setShowEquationPreview(!showEquationPreview)}
        onNavigateHome={() => navigate('/projects')}
        onOpenAiAssistant={() => setShowAiAssistant(true)}
      />

      <AiResumeModal
        isOpen={showAiAssistant}
        onClose={() => setShowAiAssistant(false)}
        currentCode={content}
        onApplyCode={(newCode) => {
          handleContentChange(newCode);
          compileToPdf(newCode);
        }}
      />

      <div className="editor-body" ref={containerRef}>
        {/* Left vertical icons matching Overleaf Image 2 */}
        <div className="editor-sidebar-icons">
          <button className="sidebar-icon-btn active" title="File tree">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button className="sidebar-icon-btn" title="Search in files">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <button className="sidebar-icon-btn" title="References & Citations">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          <button className="sidebar-icon-btn" title="Figures & Assets">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
        </div>

        {/* Content area */}
        <div className="editor-content-area">
          {(layout === 'split' || layout === 'editor') && (
            <div
              className="editor-panel"
              style={layout === 'split' ? { width: `${splitPosition}%` } : { width: '100%' }}
            >
              {showEditorTabs && (
                <div className="editor-tabs">
                  <div className="editor-tab active">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span>main.tex</span>
                    <button className="tab-close" title="Close tab">×</button>
                  </div>
                </div>
              )}

              <EditorToolbar
                editorMode={editorMode}
                onEditorModeChange={setEditorMode}
                onInsert={handleInsert}
              />

              <CodeEditor
                ref={editorRef}
                value={content}
                onChange={handleContentChange}
              />
            </div>
          )}

          {layout === 'split' && (
            <div
              className={`split-divider ${isDragging ? 'dragging' : ''}`}
              onMouseDown={handleMouseDown}
            >
              <div className="divider-handle">
                <button
                  className="divider-btn"
                  onClick={() => setLayout(splitPosition > 50 ? 'split' : 'pdf')}
                  title="Collapse editor"
                >
                  ←
                </button>
                <div className="divider-sep" />
                <button
                  className="divider-btn"
                  onClick={() => setLayout(splitPosition < 50 ? 'split' : 'editor')}
                  title="Collapse preview"
                >
                  →
                </button>
              </div>
            </div>
          )}

          {(layout === 'split' || layout === 'pdf') && (
            <div
              className="preview-panel"
              style={layout === 'split' ? { width: `${100 - splitPosition}%` } : { width: '100%' }}
            >
              <PdfPreview
                pages={pages}
                isEmpty={!content || !content.trim()}
                isCompiling={isCompiling}
                error={compileError}
                onRecompile={handleRecompile}
                onTextClick={handlePdfTextClick}
                content={content}
                layout={layout}
                onLayoutChange={setLayout}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom icons */}
      <div className="editor-bottom-icons">
        <button className="sidebar-icon-btn" title="Editor settings">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// True-to-LaTeX Compiler matching Overleaf Output Standards & Jake's Resume
function compileLatexToPaginatedPdf(code) {
  if (!code || !code.trim()) {
    return [];
  }

  let text = code;

  // 1. STRIP COMMENTS: Anything following % that is not escaped as \%
  text = text.replace(/(^|[^\\])%.*$/gm, '$1');

  // 2. Clean HTML tags if user pasted HTML
  if (text.toLowerCase().includes('<html') || text.toLowerCase().includes('<!doctype')) {
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<\/?[a-zA-Z0-9]+[^>]*>/gi, ' ');
  }

  // 3. Pre-process Jake's Resume & LaTeX custom macros
  text = text.replace(/\\resumeSubheading\{([^{}]*)\}\{([^{}]*)\}\{([^{}]*)\}\{([^{}]*)\}/g,
    '<div class="latex-line-split"><span class="split-left"><strong>$1</strong> &emsp; <em>$3</em></span><span class="split-right">$2 &emsp; <em>$4</em></span></div>');

  text = text.replace(/\\resumeProjectHeading\{([^{}]*)\}\{([^{}]*)\}/g,
    '<div class="latex-line-split"><span class="split-left"><strong>$1</strong></span><span class="split-right"><em>$2</em></span></div>');

  text = text.replace(/\\resumeItem\{([^{}]*)\}/g,
    '<li><span class="bullet-dash">–</span><span class="item-text">$1</span></li>');

  text = text.replace(/\\resumeSubHeadingListStart/g, '<div class="latex-subheading-list">');
  text = text.replace(/\\resumeSubHeadingListEnd/g, '</div>');
  text = text.replace(/\\resumeItemListStart/g, '<ul class="latex-list">');
  text = text.replace(/\\resumeItemListEnd/g, '</ul>');

  // 4. Extract preamble metadata if present
  let title = '', author = '', date = '';
  let sectionCounter = 0;
  let subsectionCounter = 0;

  const isResumeStyle = text.includes('titlesec') || text.includes('titlerule') || text.includes('resume') || text.includes('tabular') || text.includes('scshape');

  const titleMatch = text.match(/\\title\{([^}]*)\}/);
  const authorMatch = text.match(/\\author\{([^}]*)\}/);
  const dateMatch = text.match(/\\date\{([^}]*)\}/);

  if (titleMatch) title = titleMatch[1];
  if (authorMatch) author = authorMatch[1];
  if (dateMatch) date = dateMatch[1];

  // 5. Extract body
  let body = '';
  const bodyMatch = text.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  if (bodyMatch) {
    body = bodyMatch[1];
  } else {
    body = text
      .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g, '')
      .replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}/g, '')
      .replace(/\\title\{[^}]*\}/g, '')
      .replace(/\\author\{[^}]*\}/g, '')
      .replace(/\\date\{[^}]*\}/g, '');
  }

  // 6. Standard article \maketitle
  if (body.includes('\\maketitle') || (title && !body.includes('\\maketitle') && !bodyMatch)) {
    const titleHtml = `
      <div class="latex-title-block">
        ${title ? `<div class="latex-title">${processInlineLatex(title)}</div>` : ''}
        ${author ? `<div class="latex-author">${processInlineLatex(author)}</div>` : ''}
        ${date ? `<div class="latex-date">${processInlineLatex(date)}</div>` : ''}
      </div>
    `;
    if (body.includes('\\maketitle')) {
      body = body.replace('\\maketitle', titleHtml);
    } else {
      body = titleHtml + body;
    }
  }

  // 7. Clean all spacing commands (preserving \\)
  body = body.replace(/\\vspace\*?(?:\{[^}]*\}|\s*-?\d+(?:\.\d+)?(?:pt|em|ex|cm|mm|in)?)/g, '');
  body = body.replace(/\\hspace\*?(?:\{[^}]*\}|\s*-?\d+(?:\.\d+)?(?:pt|em|ex|cm|mm|in)?)/g, '&emsp;');
  body = body.replace(/\\quad/g, '&emsp;');
  body = body.replace(/\\qquad/g, '&emsp;&emsp;');

  // 8. Robust Tabular* and Tabular Parser
  // Handles Jake's Resume syntax: \begin{tabular*}{0.98\textwidth}[t]{l@{\extracolsep{\fill}}r}
  // Even across newlines and with deeply nested braces/brackets
  body = body.replace(/\\begin\{tabular\*?\}(?:\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}|\s*\[[^\[\]]*\])*\s*([\s\S]*?)\\end\{tabular\*?\}/g, (_, tableContent) => {
    const rows = tableContent.split(/\\\\/).filter(r => r.trim());
    const rowsHtml = rows.map(row => {
      // Split on column separator & ONLY when not escaped as \&
      const cols = row.split(/(?<!\\)&/).map(col => processInlineLatex(col.trim()));
      if (cols.length === 2) {
        return `<div class="latex-line-split"><span class="split-left">${cols[0]}</span><span class="split-right">${cols[1]}</span></div>`;
      } else if (cols.length > 2) {
        return `<div class="latex-line-split">${cols.map(c => `<span>${c}</span>`).join('')}</div>`;
      }
      return cols[0] ? `<div class="table-single-line">${cols[0]}</div>` : '';
    }).filter(Boolean);
    return `<div class="latex-tabular-block">${rowsHtml.join('')}</div>`;
  });

  // 9. Parse \begin{center} ... \end{center} (Resume Header block)
  body = body.replace(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g, (_, content) => {
    const centered = processInlineLatex(content);
    return `<div class="latex-resume-header">${centered}</div>`;
  });

  // 10. Parse Sections (Authentic LaTeX Section with hairline titlerule)
  body = body.replace(/\\section\*?\{([^}]*)\}/g, (match, name) => {
    sectionCounter++;
    subsectionCounter = 0;
    const isUnnumbered = match.includes('*') || isResumeStyle;
    const numPrefix = isUnnumbered ? '' : `<span class="section-number">${sectionCounter}</span>`;
    const headingText = processInlineLatex(name);
    return `<h2 class="latex-section">${numPrefix}${headingText}</h2>`;
  });

  body = body.replace(/\\subsection\*?\{([^}]*)\}/g, (match, name) => {
    subsectionCounter++;
    const isUnnumbered = match.includes('*') || isResumeStyle;
    const numPrefix = isUnnumbered ? '' : `<span class="section-number">${sectionCounter}.${subsectionCounter}</span>`;
    return `<h3 class="latex-subsection">${numPrefix}${processInlineLatex(name)}</h3>`;
  });

  // 11. Innermost-first Itemize loop (Handles nested itemize blocks cleanly without leaking braces)
  let loopCount = 0;
  while (body.includes('\\begin{itemize}') && loopCount++ < 15) {
    const before = body;
    body = body.replace(/\\begin\{itemize\}(?:\[([^\]]*)\])?((?:(?!\\begin\{itemize\})[\s\S])*?)\\end\{itemize\}/g, (match, opts, inner) => {
      const isNoBullet = opts && (opts.includes('label={}') || opts.includes('label = {}'));

      let cleanedInner = inner;
      // Normalize \small{\item{...}} and \small\item
      cleanedInner = cleanedInner.replace(/\\(?:small|footnotesize|large|Large|LARGE|Huge|huge)\s*\{\s*\\item\s*\{?/g, '\\item{');
      cleanedInner = cleanedInner.replace(/\\(?:small|footnotesize|large|Large|LARGE|Huge|huge)\s*\\item\b/g, '\\item');

      const rawItems = cleanedInner.split(/\\item\b/);
      const renderedItems = [];

      // Meaningful content before first \item (like a tabular block)
      if (rawItems[0] && rawItems[0].trim()) {
        const trimmed = rawItems[0].replace(/^[\s{}]+|[\s{}]+$/g, '').trim();
        if (trimmed && (trimmed.includes('<') || trimmed.includes('\\begin'))) {
          renderedItems.push(processInlineLatex(trimmed));
        }
      }

      for (let i = 1; i < rawItems.length; i++) {
        let raw = rawItems[i].trim();
        raw = raw.replace(/\\(?:small|footnotesize|large|Large|LARGE|Huge|huge)\b\s*$/, '').trim();

        // Strip enclosing outer braces
        while (raw.startsWith('{') && raw.endsWith('}')) {
          raw = raw.slice(1, -1).trim();
        }
        // Clean any dangling leading or trailing braces
        raw = raw.replace(/^\{+/, '').replace(/\}+$/, '').trim();
        if (!raw) continue;

        let itemContent = processInlineLatex(raw);

        if (isNoBullet) {
          renderedItems.push(`<div class="latex-nobullet-item">${itemContent}</div>`);
        } else {
          // If item already contains structured tabular or line split, don't wrap bullet around whole table
          if (itemContent.includes('latex-line-split') || itemContent.includes('latex-tabular-block')) {
            renderedItems.push(itemContent);
          } else {
            renderedItems.push(`<li><span class="bullet-dash">–</span><span class="item-text">${itemContent}</span></li>`);
          }
        }
      }

      if (isNoBullet) {
        return `<div class="latex-nobullet-wrapper">${renderedItems.join('')}</div>`;
      }
      return `<ul class="latex-list">${renderedItems.join('')}</ul>`;
    });
    if (body === before) break;
  }

  // 12. Process standalone \hfill lines
  body = body.replace(/([^\n<]+)\\hfill([^\n\\<]+)(?:\\\\)?/g, (match, left, right) => {
    return `<div class="latex-line-split"><span class="split-left">${processInlineLatex(left.trim())}</span><span class="split-right">${processInlineLatex(right.trim())}</span></div>`;
  });

  // 13. Inline LaTeX transforms on remaining body
  body = processInlineLatex(body);

  // 14. Clean dangling macros & formatting commands
  body = body.replace(/\\(?:pagestyle|thispagestyle|pagenumbering)\{[^}]*\}/g, '');
  body = body.replace(/\\(?:setlength|addtolength)\{[^}]*\}\{[^}]*\}/g, '');
  body = body.replace(/\\(?:titleformat|titlespacing)\*?(?:\{[^}]*\})+/g, '');
  body = body.replace(/\\(?:usepackage|RequirePackage)(?:\[[^\]]*\])?\{[^}]*\}/g, '');
  body = body.replace(/\\begin\{itemize\}(?:\[[^\]]*\])?/g, '');
  body = body.replace(/\\end\{itemize\}/g, '');
  body = body.replace(/\\begin\{enumerate\}(?:\[[^\]]*\])?/g, '');
  body = body.replace(/\\end\{enumerate\}/g, '');
  body = body.replace(/\\today/g, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
  body = body.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^}]*)\}/g, '$1');

  // Handle explicit page breaks: \newpage, \pagebreak, \clearpage
  body = body.replace(/\\(?:newpage|pagebreak|clearpage)\b/g, '<div class="latex-page-break"></div>');

  // Split into structural section blocks
  const sectionBlocks = body.split(/(?=<h2\b)/g).filter(b => b.trim());

  if (sectionBlocks.length <= 1) {
    const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim());
    const doc = paragraphs.map(p => {
      const trimmedP = p.trim();
      if (trimmedP.startsWith('<h') || trimmedP.startsWith('<div') || trimmedP.startsWith('<ul') || trimmedP.startsWith('<ol') || trimmedP.startsWith('<table')) {
        return trimmedP;
      }
      return `<p>${trimmedP}</p>`;
    }).join('\n');
    return paginateBlocks([doc], isResumeStyle);
  }

  return paginateBlocks(sectionBlocks, isResumeStyle);
}

// A4 multi-page pagination supporting 1 to 5+ pages dynamically
function paginateBlocks(rawBlocks, isResumeStyle = false) {
  // 1. Decompose blocks that contain explicit page breaks (\newpage)
  const blocks = [];
  for (const b of rawBlocks) {
    if (b.includes('latex-page-break')) {
      const parts = b.split(/<div class="latex-page-break"><\/div>/);
      parts.forEach((p, idx) => {
        if (p.trim()) blocks.push(p.trim());
        if (idx < parts.length - 1) {
          blocks.push('__FORCED_PAGE_BREAK__');
        }
      });
    } else {
      blocks.push(b);
    }
  }

  // 2. Decompose oversized section blocks into atomic items so multi-page flow across 2-5 pages is seamless
  const atomicBlocks = [];
  for (const b of blocks) {
    if (b === '__FORCED_PAGE_BREAK__') {
      atomicBlocks.push(b);
      continue;
    }
    const estimated = estimateCompactBlockHeight(b);
    // If a section is large (> 480px) and contains multiple items or lists, break into atomic pieces
    if (estimated > 480 && (b.includes('latex-line-split') || b.includes('latex-list') || b.includes('latex-nobullet-item'))) {
      const h2Match = b.match(/^(<h2[\s\S]*?<\/h2>)([\s\S]*)$/);
      if (h2Match) {
        atomicBlocks.push(h2Match[1]);
        const subItems = h2Match[2].split(/(?=<div class="latex-line-split"|<ul class="latex-list"|<div class="latex-nobullet-item")/g).filter(s => s.trim());
        if (subItems.length > 1) {
          subItems.forEach(sub => atomicBlocks.push(sub));
          continue;
        }
      }
    }
    atomicBlocks.push(b);
  }

  // 3. If there is NO forced page break and total content fits on 1 page (~1010px capacity), keep it strictly single-page!
  const hasForcedBreak = atomicBlocks.includes('__FORCED_PAGE_BREAK__');
  const totalEstimated = atomicBlocks.reduce((acc, b) => b === '__FORCED_PAGE_BREAK__' ? acc + 1000 : acc + estimateCompactBlockHeight(b), 0);
  
  if (!hasForcedBreak && totalEstimated <= 1010) {
    return [atomicBlocks.join('\n')];
  }

  // 4. Multi-page pagination (dynamically renders 2 pages, 3 pages, up to 5+ pages)
  const pages = [];
  let currentPageBlocks = [];
  let currentEstimatedHeight = 0;
  const A4_PAGE_CAPACITY = 1015;

  for (let i = 0; i < atomicBlocks.length; i++) {
    const block = atomicBlocks[i].trim();
    if (!block) continue;

    if (block === '__FORCED_PAGE_BREAK__') {
      if (currentPageBlocks.length > 0) {
        pages.push(currentPageBlocks.join('\n'));
        currentPageBlocks = [];
        currentEstimatedHeight = 0;
      }
      continue;
    }

    const blockHeight = estimateCompactBlockHeight(block);

    if (currentEstimatedHeight + blockHeight > A4_PAGE_CAPACITY && currentPageBlocks.length > 0) {
      pages.push(currentPageBlocks.join('\n'));
      currentPageBlocks = [block];
      currentEstimatedHeight = blockHeight;
    } else {
      currentPageBlocks.push(block);
      currentEstimatedHeight += blockHeight;
    }
  }

  if (currentPageBlocks.length > 0) {
    pages.push(currentPageBlocks.join('\n'));
  }

  return pages.length > 0 ? pages : [''];
}

function estimateCompactBlockHeight(html) {
  if (!html || !html.trim()) return 0;
  
  let height = 4;
  if (html.includes('<h2')) height += 20;
  if (html.includes('latex-resume-header')) height += 44;
  
  // Tabular or line split rows
  const splitCount = (html.match(/latex-line-split/g) || []).length;
  height += splitCount * 14.5;

  // List items: calculate height based on actual line wrap of item text
  const liMatches = html.match(/<li[\s\S]*?<\/li>/g);
  if (liMatches) {
    for (const li of liMatches) {
      const text = li.replace(/<[^>]*>/g, '').trim();
      // ~115 characters fit per line in standard A4 margins
      const lines = Math.max(1, Math.ceil(text.length / 115));
      height += lines * 14.2;
    }
  } else {
    // Other paragraphs or plain text
    const plainText = html.replace(/<[^>]*>/g, '').trim();
    if (plainText) {
      const lines = Math.max(1, Math.ceil(plainText.length / 115));
      height += lines * 14.2;
    }
  }

  return Math.round(height);
}

function processInlineLatex(text) {
  if (!text) return '';

  // Preserve double backslash linebreaks FIRST before any macro removal
  text = text.replace(/\\\\(?:\[[^\]]*\])?/g, '<br/>');
  text = text.replace(/\\newline\b/g, '<br/>');

  // Pipe symbol $|$ or \textbar -> clean vertical bar divider
  text = text.replace(/\$\|\$/g, ' | ');
  text = text.replace(/\\textbar\b/g, ' | ');

  // Underline \underline{...} (supports nested braces)
  text = text.replace(/\\underline\s*\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '<u>$1</u>');

  // Hyperlinks: \href{url}{text} (supports nested braces in label)
  text = text.replace(/\\href\{([^}]*)\}\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="latex-link">$2</a>');
  text = text.replace(/\\url\{([^}]*)\}/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="latex-link">$1</a>');

  // Compound name patterns in header:
  // e.g. \textbf{\Huge \scshape Name}, \textbf{\Large \scshape Name}, {\Large \scshape Name}, \Huge \scshape Name
  text = text.replace(/\\textbf\s*\{\s*\\(?:Huge|huge|LARGE|Large|large)\s*\\scshape\s*\{?([^}\n]+?)\}?\s*\}/g, '<span class="latex-header-name">$1</span>');
  text = text.replace(/\\textbf\s*\{\s*\\scshape\s*\\(?:Huge|huge|LARGE|Large|large)\s*\{?([^}\n]+?)\}?\s*\}/g, '<span class="latex-header-name">$1</span>');
  text = text.replace(/\{\s*\\(?:Huge|huge|LARGE|Large|large)\s*\\scshape\s*\{?([^}\n]+?)\}?\s*\}/g, '<span class="latex-header-name">$1</span>');
  text = text.replace(/\{\s*\\scshape\s*\\(?:Huge|huge|LARGE|Large|large)\s*\{?([^}\n]+?)\}?\s*\}/g, '<span class="latex-header-name">$1</span>');
  text = text.replace(/\\(?:Huge|huge|LARGE|Large|large)\s*\\scshape\s*\{?([^}\n<]+?)\}?(?=\s*(?:<br|\n|$))/g, '<span class="latex-header-name">$1</span>');

  // Handle \textbf with nested font sizes or small caps
  text = text.replace(/\\textbf\s*\{\s*\\(?:Huge|huge|LARGE|Large|large)\s*\{?([^}\n]+?)\}?\s*\}/g, '<span class="latex-font-large"><strong>$1</strong></span>');
  text = text.replace(/\\textbf\s*\{\s*\\scshape\s*\{?([^}\n]+?)\}?\s*\}/g, '<span class="latex-scshape"><strong>$1</strong></span>');

  // General \textbf{...} (supports up to 2 levels of nested braces and optional space between \textbf and {)
  text = text.replace(/\\textbf\s*\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '<strong>$1</strong>');
  text = text.replace(/\{\\bfseries\s+([^}]*)\}/g, '<strong>$1</strong>');
  text = text.replace(/\{\\bf\s+([^}]*)\}/g, '<strong>$1</strong>');

  // General Small Caps: \scshape or {\scshape ...}
  text = text.replace(/\\scshape\s+([^\n\\{}<]+)/g, '<span class="latex-scshape">$1</span>');
  text = text.replace(/\{\\scshape\s+([^\n\\{}<]+)\}/g, '<span class="latex-scshape">$1</span>');

  // Font Sizes
  text = text.replace(/\\(?:Huge|huge)\s+([^\n\\{}<]+)/g, '<span class="latex-font-large">$1</span>');
  text = text.replace(/\{\s*\\(?:Huge|huge)\s+([^}]*)\}/g, '<span class="latex-font-large">$1</span>');
  text = text.replace(/\\LARGE\s+([^\n\\{}<]+)/g, '<span class="latex-font-large">$1</span>');
  text = text.replace(/\{\s*\\LARGE\\bfseries\s+([^}]*)\}/g, '<span class="latex-font-large"><strong>$1</strong></span>');
  text = text.replace(/\{\s*\\LARGE\s+([^}]*)\}/g, '<span class="latex-font-large">$1</span>');
  text = text.replace(/\\Large\s+([^\n\\{}<]+)/g, '<span class="latex-font-large">$1</span>');
  text = text.replace(/\{\s*\\Large\s+([^}]*)\}/g, '<span class="latex-font-large">$1</span>');
  text = text.replace(/\\large\s+([^\n\\{}<]+)/g, '<span class="latex-font-med">$1</span>');
  text = text.replace(/\{\s*\\large\s+([^}]*)\}/g, '<span class="latex-font-med">$1</span>');
  text = text.replace(/\\small\s+([^\n\\{}<]+)/g, '<span class="latex-font-small">$1</span>');
  text = text.replace(/\{\s*\\small\s+([^}]*)\}/g, '<span class="latex-font-small">$1</span>');
  text = text.replace(/\\footnotesize\s+([^\n\\{}<]+)/g, '<span class="latex-font-foot">$1</span>');

  // Italic
  text = text.replace(/\\textit\s*\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '<em>$1</em>');
  text = text.replace(/\\emph\s*\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g, '<em>$1</em>');
  text = text.replace(/\{\\itshape\s+([^}]*)\}/g, '<em>$1</em>');
  text = text.replace(/\{\\it\s+([^}]*)\}/g, '<em>$1</em>');

  // Code
  text = text.replace(/\\texttt\s*\{([^}]*)\}/g, '<code>$1</code>');

  // Math equations
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="latex-math-block"><em>$1</em></div>');
  text = text.replace(/\$([^\$]+)\$/g, '<span class="latex-inline-math"><em>$1</em></span>');

  // Dashes (convert BEFORE escape cleanup)
  text = text.replace(/---/g, '—');
  text = text.replace(/--/g, '–');

  // LaTeX Escapes & Entities
  text = text.replace(/\\%/g, '%');
  text = text.replace(/\\&/g, '&amp;');
  text = text.replace(/\\\$/g, '$');
  text = text.replace(/\\#/g, '#');
  text = text.replace(/\\_/g, '_');
  text = text.replace(/\\{/g, '{');
  text = text.replace(/\\}/g, '}');
  text = text.replace(/\\~/g, '~');
  text = text.replace(/\\,/g, ' ');
  text = text.replace(/(?<!\\)\\\s+/g, ' ');
  text = text.replace(/``/g, '“');
  text = text.replace(/''/g, '”');
  text = text.replace(/~/g, '&nbsp;');

  // Unwrap leftover grouping braces: {: ...} -> : ...
  let prev;
  let counter = 0;
  do {
    prev = text;
    text = text.replace(/\{([^{}]*)\}/g, '$1');
    counter++;
  } while (text !== prev && counter < 5);

  // Clean any stray \textbf or other font macros that lost their braces
  text = text.replace(/\\(?:textbf|Huge|huge|LARGE|Large|large|small|footnotesize|scshape|bfseries|itshape)\b/g, '');

  return text;
}

export default EditorPage;
