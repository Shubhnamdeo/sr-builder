import React, { useState, useRef, useEffect } from 'react';
import './EditorToolbar.css';

function EditorToolbar({ onInsert }) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="editor-sub-toolbar">
      {/* Left tool cluster matching Image 2 */}
      <div className="subtoolbar-left">
        {/* AI / Sparkle button */}
        <button
          className="subtoolbar-icon-btn sparkle-btn"
          title="AI Assistant / Write with AI"
          onClick={() => onInsert('% AI Suggestion: Professional resume summary\n\\section{Summary}\nResults-driven engineer with expertise in full-stack web architectures.\n')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L14.5 8.5L21 9L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9L9.5 8.5L12 2Z"/>
          </svg>
        </button>

        {/* Undo */}
        <button
          className="subtoolbar-icon-btn"
          title="Undo (Ctrl+Z)"
          onClick={() => document.execCommand('undo')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 14 4 9 9 4"/>
            <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
        </button>

        {/* Redo */}
        <button
          className="subtoolbar-icon-btn"
          title="Redo (Ctrl+Y)"
          onClick={() => document.execCommand('redo')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 14 20 9 15 4"/>
            <path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
          </svg>
        </button>

        <div className="subtoolbar-separator" />

        {/* TT Font Size */}
        <button
          className="subtoolbar-icon-btn font-tt-btn"
          title="Text size"
          onClick={() => onInsert('\\large ')}
        >
          <span>TT</span>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {/* Bold */}
        <button
          className="subtoolbar-icon-btn bold-btn"
          title="Bold (Ctrl+B)"
          onClick={() => onInsert('\\textbf{')}
        >
          <strong>B</strong>
        </button>

        {/* Italic */}
        <button
          className="subtoolbar-icon-btn italic-btn"
          title="Italic (Ctrl+I)"
          onClick={() => onInsert('\\textit{')}
        >
          <em>I</em>
        </button>

        {/* More formatting dots */}
        <button
          className="subtoolbar-icon-btn"
          title="More options"
          onClick={() => onInsert('\\underline{')}
        >
          <span>···</span>
        </button>
      </div>

      {/* Right tool cluster */}
      <div className="subtoolbar-right">
        {/* Search glass */}
        <button
          className="subtoolbar-icon-btn"
          title="Find & Replace"
          onClick={() => setShowSearch(!showSearch)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default EditorToolbar;
