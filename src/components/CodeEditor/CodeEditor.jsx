import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, bracketMatching, foldGutter, indentOnInput, StreamLanguage } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { oneDark } from '@codemirror/theme-one-dark';
import './CodeEditor.css';

// Hybrid LaTeX and HTML language mode via StreamLanguage
const hybridCodeMode = {
  startState() {
    return { inMath: false, inComment: false };
  },
  token(stream, state) {
    // LaTeX comments: % comment
    if (stream.peek() === '%') {
      stream.skipToEnd();
      return 'comment';
    }

    // HTML comments: <!-- comment -->
    if (stream.match('<!--')) {
      while (!stream.match('-->', false)) {
        if (!stream.next()) break;
      }
      stream.match('-->');
      return 'comment';
    }

    // HTML Doctype
    if (stream.match(/<!DOCTYPE\s+html>/i)) {
      return 'keyword';
    }

    // HTML Tags <tag ...> or </tag>
    if (stream.match(/<\/?[a-zA-Z0-9\-]+(\s+[^>]*)?>/)) {
      return 'tag';
    }

    // LaTeX backslash commands
    if (stream.match(/\\[a-zA-Z@]+\*?/)) {
      const cmd = stream.current();
      if (cmd.match(/\\(begin|end|documentclass|usepackage|input|include|bibliography)/)) {
        return 'keyword';
      }
      if (cmd.match(/\\(section|subsection|subsubsection|chapter|part|paragraph|title|author|date|maketitle)/)) {
        return 'heading';
      }
      if (cmd.match(/\\(textbf|textit|emph|underline|texttt|textsc|textsf|textrm|bfseries|itshape)/)) {
        return 'strong';
      }
      if (cmd.match(/\\(label|ref|cite|eqref|pageref|href|url)/)) {
        return 'link';
      }
      return 'atom';
    }

    // Escaped punctuation characters like \%, \$, \&, \\
    if (stream.match(/\\[^a-zA-Z]/)) {
      return 'string';
    }

    // Curly braces
    if (stream.match(/[{}]/)) {
      return 'bracket';
    }

    // Square brackets [ ]
    if (stream.match(/[\[\]]/)) {
      return 'squareBracket';
    }

    // Display math $$
    if (stream.match('$$')) {
      return 'processingInstruction';
    }
    // Inline math $
    if (stream.peek() === '$') {
      stream.next();
      return 'processingInstruction';
    }

    // Alignment ampersand &
    if (stream.peek() === '&') {
      stream.next();
      return 'operator';
    }

    stream.next();
    return null;
  },
};

const hybridLanguage = StreamLanguage.define(hybridCodeMode);

const syntaxHighlighter = HighlightStyle.define([
  { tag: tags.keyword, color: '#D4BCC8', fontWeight: 'bold' },
  { tag: tags.tagName, color: '#E2D1DA', fontWeight: 'bold' },
  { tag: tags.heading, color: '#D4BCC8', fontWeight: 'bold' },
  { tag: tags.strong, color: '#FFFFFF' },
  { tag: tags.link, color: '#D4BCC8' },
  { tag: tags.atom, color: '#C4A9B7' },
  { tag: tags.string, color: '#E2D1DA' },
  { tag: tags.comment, color: '#7C7479', fontStyle: 'italic' },
  { tag: tags.bracket, color: '#D4BCC8' },
  { tag: tags.squareBracket, color: '#C4A9B7' },
  { tag: tags.processingInstruction, color: '#D4BCC8' },
  { tag: tags.operator, color: '#9E939A' },
]);

const CodeEditor = forwardRef(({ value, onChange }, ref) => {
  const editorContainerRef = useRef(null);
  const editorViewRef = useRef(null);
  const isExternalUpdate = useRef(false);

  useImperativeHandle(ref, () => ({
    insertSnippet(snippet) {
      const view = editorViewRef.current;
      if (!view) return;

      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: snippet },
        selection: { anchor: from + snippet.length },
      });
      view.focus();
    },
    getContent() {
      return editorViewRef.current?.state.doc.toString() || '';
    },
    focus() {
      editorViewRef.current?.focus();
    },
    scrollToText(queryText) {
      const view = editorViewRef.current;
      if (!view || !queryText) return false;

      const doc = view.state.doc;
      const fullContent = doc.toString();

      // Clean query text: remove extra whitespaces & line breaks
      const clean = queryText.trim().replace(/\s+/g, ' ');
      if (!clean) return false;

      let matchFrom = -1;
      let matchTo = -1;

      const lowerDoc = fullContent.toLowerCase();
      const lowerClean = clean.toLowerCase();

      // 1. Exact substring match
      let idx = lowerDoc.indexOf(lowerClean);
      if (idx !== -1) {
        matchFrom = idx;
        matchTo = idx + clean.length;
      } else {
        // 2. Try phrases (first 30 chars, before pipes, dashes, commas)
        const candidates = [
          clean.slice(0, 35).trim(),
          clean.slice(0, 20).trim(),
          clean.split('|')[0].trim(),
          clean.split('---')[0].trim(),
          clean.split('—')[0].trim(),
          clean.split('•')[0].trim(),
          clean.split(',')[0].trim(),
        ].filter(p => p.length >= 4);

        for (const candidate of candidates) {
          const cIdx = lowerDoc.indexOf(candidate.toLowerCase());
          if (cIdx !== -1) {
            matchFrom = cIdx;
            matchTo = cIdx + candidate.length;
            break;
          }
        }

        // 3. Try unique keywords (length >= 5)
        if (matchFrom === -1) {
          const words = clean.split(/[\s,.:;|\-—–()\\/{}\[\]]+/).filter(w => w.length >= 5);
          for (const word of words) {
            const wIdx = lowerDoc.indexOf(word.toLowerCase());
            if (wIdx !== -1) {
              matchFrom = wIdx;
              matchTo = wIdx + word.length;
              break;
            }
          }
        }
      }

      if (matchFrom !== -1) {
        // Select the text and smoothly scroll the editor to it
        view.dispatch({
          selection: { anchor: matchFrom, head: matchTo },
          scrollIntoView: true,
        });
        view.focus();

        // Trigger flash highlight on the container for visual feedback
        if (editorContainerRef.current) {
          editorContainerRef.current.classList.remove('synctex-jump-flash');
          void editorContainerRef.current.offsetWidth; // trigger reflow
          editorContainerRef.current.classList.add('synctex-jump-flash');
          setTimeout(() => {
            editorContainerRef.current?.classList.remove('synctex-jump-flash');
          }, 1200);
        }
        return true;
      }
      return false;
    },
  }));

  useEffect(() => {
    if (!editorContainerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isExternalUpdate.current) {
        const newContent = update.state.doc.toString();
        onChange(newContent);
      }
    });

    const customTheme = EditorView.theme({
      '&': {
        height: '100%',
        fontSize: '14px',
        backgroundColor: '#17191D',
        color: '#f8fafc',
      },
      '.cm-content': {
        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', 'Courier New', monospace",
        padding: '12px 0',
      },
      '.cm-gutters': {
        backgroundColor: '#131417',
        color: '#9E939A',
        border: 'none',
        borderRight: '1px solid #282C35',
        minWidth: '46px',
        paddingRight: '6px',
      },
      '.cm-activeLineGutter': {
        backgroundColor: '#242730',
        color: '#D4BCC8',
        fontWeight: 'bold',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(212, 188, 200, 0.08)',
      },
      '.cm-cursor': {
        borderLeftColor: '#D4BCC8',
        borderLeftWidth: '2px',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'rgba(212, 188, 200, 0.25) !important',
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'rgba(212, 188, 200, 0.3) !important',
      },
      '.cm-foldGutter': {
        width: '14px',
      },
    });

    const startState = EditorState.create({
      doc: value || '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        bracketMatching(),
        foldGutter(),
        indentOnInput(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        hybridLanguage,
        syntaxHighlighting(syntaxHighlighter),
        customTheme,
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorContainerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []);

  // Update content when value changes externally
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: value || '' },
      });
      isExternalUpdate.current = false;
    }
  }, [value]);

  return <div className="code-editor-container" ref={editorContainerRef} />;
});

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
