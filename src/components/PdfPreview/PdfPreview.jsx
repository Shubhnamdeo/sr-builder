import React, { useState, useCallback, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import './PdfPreview.css';

function PdfPreview({
  pages = [],
  isEmpty,
  isCompiling,
  error,
  onRecompile,
  onTextClick,
  content,
  layout,
  onLayoutChange,
}) {
  const [zoom, setZoom] = useState(74); // 74% matching Image 2
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputVal, setPageInputVal] = useState('1');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showRecompileDropdown, setShowRecompileDropdown] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [autoCompile, setAutoCompile] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const scrollContainerRef = useRef(null);

  // SyncTeX: click any text in the rendered PDF to jump cursor to exact code
  const handlePdfContentClick = useCallback((e) => {
    if (!onTextClick) return;

    // Check if user selected text with mouse
    const selection = window.getSelection()?.toString()?.trim();
    if (selection && selection.length > 1) {
      onTextClick(selection);
      return;
    }

    const target = e.target;
    if (!target) return;

    // Ignore clicks on sheet canvas margins or page number footer
    if (
      target.classList.contains('multi-page-container') ||
      target.classList.contains('pdf-page-number-footer')
    ) {
      return;
    }

    const textEl = target.closest('h1, h2, h3, h4, h5, p, li, td, th, span, div, a');
    const text = textEl?.innerText?.trim() || target.innerText?.trim();

    if (text) {
      onTextClick(text);
    }
  }, [onTextClick]);

  const totalPages = Math.max(1, pages.length);
  const scale = zoom / 100;

  // Sync input box when currentPage changes
  useEffect(() => {
    setPageInputVal(String(currentPage));
  }, [currentPage]);

  // Track active page on scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollPos = container.scrollTop + 150;
      for (let i = 1; i <= totalPages; i++) {
        const el = document.getElementById(`pdf-page-wrapper-${i}`) || document.getElementById(`pdf-page-${i}`);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setCurrentPage(i);
            break;
          }
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [totalPages]);

  const scrollToPage = useCallback((pageNum) => {
    const target = Math.max(1, Math.min(totalPages, pageNum));
    setCurrentPage(target);
    const el = document.getElementById(`pdf-page-wrapper-${target}`) || document.getElementById(`pdf-page-${target}`);
    if (el && scrollContainerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [totalPages]);

  const handlePrevPage = () => {
    scrollToPage(currentPage - 1);
  };

  const handleNextPage = () => {
    scrollToPage(currentPage + 1);
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      const parsed = parseInt(pageInputVal, 10);
      if (!isNaN(parsed)) {
        scrollToPage(parsed);
      } else {
        setPageInputVal(String(currentPage));
      }
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(200, prev + 10));
  const handleZoomOut = () => setZoom(prev => Math.max(40, prev - 10));

  const handleDownloadPdf = useCallback(async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      const pageCount = pages.length > 0 ? pages.length : 1;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let i = 0; i < pageCount; i++) {
        const pageEl = document.getElementById(`pdf-page-${i + 1}`);
        if (!pageEl) continue;

        // Temporarily reset preview transform so canvas and rect coordinates capture native A4 resolution
        const originalTransform = pageEl.style.transform;
        const originalTransition = pageEl.style.transition;
        pageEl.style.transition = 'none';
        pageEl.style.transform = 'none';

        // Measure unscaled dimensions and calculate scale factors from CSS pixels to PDF mm (210 x 297)
        const pageRect = pageEl.getBoundingClientRect();
        const scaleX = 210 / (pageRect.width || 760);
        const scaleY = 297 / (pageRect.height || 1075);

        // Collect all clickable hyperlinks with exact PDF page coordinates
        const linkBoxes = [];
        const linkEls = pageEl.querySelectorAll('a[href]');
        linkEls.forEach(linkEl => {
          const rawHref = linkEl.getAttribute('href');
          if (!rawHref) return;

          let targetUrl = rawHref.trim();
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('mailto:')) {
            targetUrl = 'https://' + targetUrl;
          }

          const rects = linkEl.getClientRects();
          for (let r = 0; r < rects.length; r++) {
            const rect = rects[r];
            const x = (rect.left - pageRect.left) * scaleX;
            const y = (rect.top - pageRect.top) * scaleY;
            const w = rect.width * scaleX;
            const h = rect.height * scaleY;

            // Add slight padding to make touch/click target comfortable
            linkBoxes.push({
              x: Math.max(0, x - 0.3),
              y: Math.max(0, y - 0.3),
              w: w + 0.6,
              h: h + 0.6,
              url: targetUrl,
            });
          }
        });

        // Collect Document Outline / Bookmarks for this page (shows in Chrome PDF sidebar!)
        const sectionEls = pageEl.querySelectorAll('.latex-section');
        const outlineItems = [];
        sectionEls.forEach(secEl => {
          const title = secEl.innerText.replace(/^\d+(\.\d+)?\s*/, '').trim();
          if (title) {
            outlineItems.push(title);
          }
        });

        // Collect searchable text layer items for ATS & browser text-selection
        const textLayerItems = [];
        const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT, null, false);
        let textNode;
        while ((textNode = walker.nextNode())) {
          const rawText = textNode.nodeValue?.trim();
          if (!rawText) continue;
          const parent = textNode.parentElement;
          if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') continue;

          const range = document.createRange();
          range.selectNodeContents(textNode);
          const rects = range.getClientRects();
          if (rects.length > 0) {
            const r = rects[0];
            const x = (r.left - pageRect.left) * scaleX;
            const y = (r.top - pageRect.top) * scaleY + (r.height * scaleY * 0.82);
            const parentStyle = window.getComputedStyle(parent);
            const fontSizePt = Math.max(6, Math.min(22, (parseFloat(parentStyle.fontSize) || 12) * 0.75));
            textLayerItems.push({ text: rawText, x, y, fontSize: fontSizePt });
          }
        }

        const canvas = await html2canvas(pageEl, {
          scale: 2.5, // 2.5x retina resolution for razor-sharp vector-like typography
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794,
        });

        // Restore zoom transform
        pageEl.style.transform = originalTransform;
        pageEl.style.transition = originalTransition;

        const imgData = canvas.toDataURL('image/jpeg', 0.98);

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        // Standard A4 physical dimensions in mm: 210 x 297
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

        // Add Document Outline Bookmarks (so Chrome displays the document structure sidebar)
        if (pdf.outline && pdf.outline.add) {
          outlineItems.forEach(title => {
            try {
              pdf.outline.add(null, title, { pageNumber: i + 1 });
            } catch (e) {}
          });
        }

        // Embed clickable hyperlink annotations on top of the page canvas
        linkBoxes.forEach(({ x, y, w, h, url }) => {
          pdf.link(x, y, w, h, { url });
        });

        // Embed searchable text layer for full text selection and ATS reading
        textLayerItems.forEach(({ text, x, y, fontSize }) => {
          try {
            pdf.setFontSize(fontSize);
            pdf.text(text, x, y, { renderingMode: 'invisible' });
          } catch (e) {}
        });
      }

      pdf.setProperties({
        title: 'Resume',
        subject: 'Curriculum Vitae',
        author: 'Candidate',
        keywords: 'Resume, CV, LaTeX',
        creator: 'SR Builder (LaTeX Studio)',
      });

      pdf.save('S-resume.pdf');
    } catch (err) {
      console.error('Direct PDF export error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [pages, isGeneratingPdf]);

  const handleDownloadSource = useCallback(() => {
    const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'main.tex';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [content]);

  return (
    <div className={`overleaf-preview-container ${isDarkMode ? 'preview-dark' : ''}`}>
      {/* Top Preview Bar matching Image 2 */}
      <div className="preview-top-toolbar">
        {/* Left group */}
        <div className="toolbar-recompile-group">
          <button
            className="overleaf-recompile-btn"
            onClick={onRecompile}
            disabled={isCompiling}
            title="Recompile document (Ctrl+Enter)"
          >
            {isCompiling ? (
              <>
                <span className="compile-spinner"></span>
                <span>Compiling...</span>
              </>
            ) : (
              <span>Recompile</span>
            )}
          </button>

          <button
            className="recompile-chevron-btn"
            onClick={() => setShowRecompileDropdown(!showRecompileDropdown)}
            title="Recompile settings"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showRecompileDropdown && (
            <div className="recompile-popover">
              <label className="recompile-popover-item">
                <input
                  type="checkbox"
                  checked={autoCompile}
                  onChange={e => setAutoCompile(e.target.checked)}
                />
                <span>Auto-compile on save</span>
              </label>
              <div className="recompile-popover-item" onClick={onRecompile}>
                <span>Clean cache and recompile</span>
              </div>
            </div>
          )}

          {/* Logs & Output Badge Button with orange 3 badge matching Image 2 & original Overleaf */}
          <button
            className="preview-log-btn"
            title="Logs and output files (3 warnings)"
            onClick={() => setShowLogs(!showLogs)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span className="log-orange-badge">3</span>
          </button>

          {showLogs && (
            <div className="overleaf-logs-popover">
              <div className="logs-popover-header">
                <span className="logs-popover-title">Logs and output files</span>
                <button className="logs-close-btn" onClick={() => setShowLogs(false)}>×</button>
              </div>
              <div className="logs-popover-body">
                <div className="log-item warning">
                  <span className="log-badge-orange">Warning</span>
                  <div className="log-detail">
                    <p className="log-msg">Font shape `OT1/cmr/m/sc` in size &lt;12&gt; not available, substituting.</p>
                    <span className="log-location">main.tex, line 31</span>
                  </div>
                </div>
                <div className="log-item warning">
                  <span className="log-badge-orange">Warning</span>
                  <div className="log-detail">
                    <p className="log-msg">Overfull \hbox (1.8pt too wide) in alignment at line 55.</p>
                    <span className="log-location">main.tex, line 55</span>
                  </div>
                </div>
                <div className="log-item warning">
                  <span className="log-badge-orange">Warning</span>
                  <div className="log-detail">
                    <p className="log-msg">Underfull \vbox (badness 1000) has occurred while \output is active.</p>
                    <span className="log-location">main.tex, line 112</span>
                  </div>
                </div>
              </div>
              <div className="logs-popover-footer">
                <button className="logs-action-link" onClick={() => alert('All auxiliary logs cleared.')}>Clear aux files</button>
                <button className="logs-action-link" onClick={() => alert('Opening raw build logs.')}>View raw logs</button>
              </div>
            </div>
          )}

          {/* Download PDF button (tray with down arrow) */}
          <button
            className={`preview-tool-btn ${isGeneratingPdf ? 'generating-pdf' : ''}`}
            title={isGeneratingPdf ? "Generating PDF..." : "Download PDF (S-resume.pdf with Bookmarks & Text Layer)"}
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <span className="compile-spinner small"></span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
          </button>

          {/* Native Vector Print / PDF button */}
          <button
            className="preview-tool-btn"
            title="Print or Save as Native Vector PDF (Ctrl+P)"
            onClick={() => window.print()}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
          </button>
        </div>

        {/* Right controls matching Image 2 */}
        <div className="toolbar-controls-group">
          {/* Dark / Light preview toggle */}
          <button
            className="preview-tool-btn"
            title="Toggle background dark mode"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>

          {/* Up arrow */}
          <button
            className="preview-nav-chevron"
            title="Previous page"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>

          {/* Down arrow */}
          <button
            className="preview-nav-chevron"
            title="Next page"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* Dynamic Page counter [ 1 ] / N */}
          <div className="page-box-display">
            <input
              type="text"
              value={pageInputVal}
              onChange={e => setPageInputVal(e.target.value)}
              onKeyDown={handlePageInputKeyDown}
              className="page-input-box"
              title="Page number (press Enter to jump)"
            />
            <span className="page-total-label">/ {totalPages}</span>
          </div>

          <div className="preview-toolbar-divider" />

          {/* Zoom Minus */}
          <button className="preview-zoom-btn" onClick={handleZoomOut} title="Zoom out">
            −
          </button>

          {/* Zoom Plus */}
          <button className="preview-zoom-btn" onClick={handleZoomIn} title="Zoom in">
            +
          </button>

          {/* Zoom Percentage Dropdown (defaults to 74% v) */}
          <div className="zoom-percentage-badge" onClick={handleZoomIn} title="Click to zoom">
            <span>{zoom}%</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Main PDF preview sheet */}
      <div className="preview-scroll-canvas" ref={scrollContainerRef}>
        {error ? (
          <div className="latex-compile-error-card">
            <div className="error-badge-icon">⚠️</div>
            <h4>Compilation Notice</h4>
            <pre className="error-text-details">{error}</pre>
            <button className="error-retry-btn" onClick={onRecompile}>Recompile</button>
          </div>
        ) : isEmpty ? (
          <div
            className="pdf-page-viewport"
            style={{
              width: `${760 * scale}px`,
              height: `${1075 * scale}px`,
            }}
          >
            <div
              className="a4-paper-sheet"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
              }}
            >
              <div className="empty-pdf-placeholder">
                <div className="empty-pdf-icon">📄</div>
                <h3>Blank Document</h3>
                <p>Type your LaTeX code in the editor on the left and click <strong>Recompile</strong> to generate your PDF preview.</p>
              </div>
            </div>
          </div>
        ) : (
          /* Multi-Page A4 Continuous Scroll */
          <div
            className="multi-page-container"
            onClick={handlePdfContentClick}
            title="SyncTeX: Click any text to jump directly to its LaTeX code"
          >
            {pages.map((pageHtml, idx) => (
              <div
                key={idx}
                id={`pdf-page-wrapper-${idx + 1}`}
                className="pdf-page-viewport"
                style={{
                  width: `${760 * scale}px`,
                  height: `${1075 * scale}px`,
                }}
              >
                <div
                  id={`pdf-page-${idx + 1}`}
                  className="a4-paper-sheet multi-page-sheet"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                  }}
                >
                  <div
                    className="a4-paper-content"
                    dangerouslySetInnerHTML={{ __html: pageHtml }}
                  />
                  <div className="pdf-page-number-footer">{idx + 1}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfPreview;
