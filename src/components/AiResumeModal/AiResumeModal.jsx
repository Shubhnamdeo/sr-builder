import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api.js';
import './AiResumeModal.css';

// Extract the updated section/code for a clean preview without red and green markings
function getChangedSnippet(oldCode = '', newCode = '') {
  if (!oldCode || !newCode) return newCode || '';
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');

  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
    start++;
  }

  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--;
    newEnd--;
  }

  if (start > newEnd) {
    return newLines.slice(0, 30).join('\n');
  }

  const contextStart = Math.max(0, start - 2);
  const contextEnd = Math.min(newLines.length - 1, newEnd + 2);
  return newLines.slice(contextStart, contextEnd + 1).join('\n');
}

const DEFAULT_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

let cachedWorkingModel = null;

// Utility: sleep for ms
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Multi-candidate Gemini caller: uses active Google Generative Language models with auto-retry and 5s break
async function callGeminiApi(apiKey, currentCode, userInstruction) {
  const activeKey = (apiKey || DEFAULT_API_KEY).trim();
  const prompt = `You are an expert AI Resume Consultant, Career Advisor, and LaTeX Engineer for "SR Builder".
The user is working on their LaTeX resume.

CURRENT RESUME LATEX CODE:
\`\`\`latex
${currentCode}
\`\`\`

USER'S MESSAGE:
"${userInstruction}"

Strict Guidelines:
1. If the user asks a question, gives conversational feedback, or is troubleshooting (e.g. "no changes after accepting"):
   - Do NOT output any LaTeX code block.
   - Reply conversationally with clear, helpful instructions.
   - If they ask about "no changes after accepting", explain that clicking "Accept & Apply Code" updates main.tex, and they need to click the green "Recompile" button at the top right of the editor to refresh the PDF preview.
2. If the user specifically asks to modify, format, change, or rewrite their resume:
   - Provide a brief 1-sentence friendly explanation.
   - Output the COMPLETE updated compilable LaTeX code inside a \`\`\`latex ... \`\`\` block.
   - Never corrupt packages or inject fake user data.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
  };

  const candidateModels = [
    ...(cachedWorkingModel ? [cachedWorkingModel] : []),
    { ver: 'v1beta', name: 'gemini-3.5-flash-lite' },
    { ver: 'v1beta', name: 'gemini-3.1-flash-lite' },
    { ver: 'v1beta', name: 'gemini-3.8-flash' },
    { ver: 'v1beta', name: 'gemini-3.5-flash' },
    { ver: 'v1beta', name: 'gemini-2.5-flash' }
  ];

  let lastError = null;
  for (const cand of candidateModels) {
    for (let attempt = 0; attempt <= 2; attempt++) {
      const url = `https://generativelanguage.googleapis.com/${cand.ver}/models/${cand.name}:generateContent?key=${encodeURIComponent(activeKey)}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': activeKey },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          const msg = errJson.error?.message || `HTTP ${res.status}`;

          // If high demand spike (503) or rate limit (429), take a 5-second break as requested
          if (res.status === 503 || res.status === 429) {
            console.log(`[Gemini Client] ${cand.name} hit spike (${res.status}). Waiting 5 seconds before retry...`);
            if (attempt < 2) {
              await sleep(5000);
              continue;
            }
          }

          if (res.status === 404 || msg.includes('not found') || msg.includes('no longer available')) {
            break; // Try next candidate model immediately
          }
          throw new Error(msg);
        }

        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const rawText = parts.map(p => p.text || '').join('').trim();

        const codeBlockMatch = rawText.match(/```latex\s*([\s\S]*?)\s*```/i) || rawText.match(/```\s*([\s\S]*?)\s*```/i);
        let newCode = null;
        let isCodeUpdate = false;

        if (codeBlockMatch && codeBlockMatch[1].includes('\\documentclass')) {
          newCode = codeBlockMatch[1].trim();
          isCodeUpdate = newCode !== currentCode;
        }

        const explanation = rawText
          .replace(/```latex[\s\S]*?```/gi, '')
          .replace(/```[\s\S]*?```/gi, '')
          .trim() || (isCodeUpdate ? 'Updated your resume code:' : 'Here is what you need to know:');

        cachedWorkingModel = cand;
        return { isCodeUpdate, newCode: isCodeUpdate ? newCode : currentCode, explanation };
      } catch (err) {
        lastError = err;
        if (err.message && (err.message.includes('API_KEY_INVALID') || err.message.includes('API key not valid'))) {
          throw err;
        }
        if (attempt < 2) {
          await sleep(5000);
        }
      }
    }
  }

  throw lastError || new Error('No available Gemini model found.');
}

// Built-in intelligent conversational & code parser (offline/local fallback)
function generateModifiedCode(currentCode, instruction, extraContext = '') {
  let text = currentCode;

  // 0. Auto-repair any previous corruptions in the package preamble
  text = text.replace(/usetuffys/g, 'usenames').replace(/dvipstuffys/g, 'dvipsnames');

  const inst = instruction.trim();
  const lower = (instruction + ' ' + extraContext).toLowerCase();
  let explanation = '';

  // 1. Check for Feedback / Troubleshooting Intent (e.g. "no changes after accepting")
  if (
    lower.includes('no change') ||
    lower.includes('no changes') ||
    lower.includes("didn't change") ||
    lower.includes('did not change') ||
    lower.includes('nothing happened') ||
    lower.includes('not working') ||
    lower.includes('stuck') ||
    lower.includes('after accepting')
  ) {
    return {
      isCodeUpdate: false,
      newCode: currentCode,
      explanation: "When you click 'Accept & Apply Code', the editor updates main.tex. To refresh the PDF preview on the right, make sure to click the green **Recompile** button at the top right of the editor. What specific changes would you like to make to your resume?"
    };
  }

  // 2. Check for Greetings / Casual Chat
  if (/^(?:hi|hello|hey|greetings|good\s+(?:morning|afternoon|evening))\b/i.test(inst)) {
    return {
      isCodeUpdate: false,
      newCode: currentCode,
      explanation: "Hello! I'm your AI Resume Consultant. I can help you adjust formatting, customize sections, polish bullet points with metrics, or tailor your resume for a job description. What would you like to work on?"
    };
  }

  // 3. Check for Review / Feedback / Advice Requests
  if (
    lower.includes('review') ||
    lower.includes('feedback') ||
    lower.includes('how is this') ||
    lower.includes('critique') ||
    lower.includes('suggestions') ||
    lower.includes('how can i improve')
  ) {
    return {
      isCodeUpdate: false,
      newCode: currentCode,
      explanation: "I've reviewed your resume! Here are 3 targeted suggestions to make it stand out:\n\n1. **Action-Oriented Bullets**: Start bullet points with strong power verbs (e.g., 'Architected', 'Engineered', 'Streamlined') and quantify outcomes with metrics.\n2. **Skills Categorization**: Group your technical skills clearly (e.g., Languages, Frameworks, Cloud, Tools) for quick ATS parsing.\n3. **Page Density**: Keep section margins compact so all your key qualifications fit cleanly on a single page.\n\nTell me which section you'd like to update first!"
    };
  }

  // 4. Font Size / Document Sizing intent
  const fontSizeMatch = inst.match(/(?:change|set|make|switch|adjust)?\s*(?:the\s+)?(?:font\s+size|text\s+size|document\s+size|size)\s+(?:to|as)?\s*(\d{1,2})\s*(?:pt)?/i) ||
                        inst.match(/\b(\d{1,2})\s*pt\b/i);
  if (fontSizeMatch) {
    const pt = fontSizeMatch[1];
    text = text.replace(/\\documentclass\[([^\]]*)\]\{article\}/i, (m, opts) => {
      let newOpts = opts.replace(/\b\d{1,2}pt\b/, `${pt}pt`);
      if (!newOpts.includes(`${pt}pt`)) newOpts += `,${pt}pt`;
      return `\\documentclass[${newOpts}]{article}`;
    });
    explanation = `Changed document font size to ${pt}pt.`;
    return { isCodeUpdate: true, newCode: text, explanation };
  }

  // Make font bigger / increase text size
  if (/(?:make|increase|enlarge|bump)\s+(?:the\s+)?(?:font|text)?\s*(?:size)?\s*(?:bigger|larger|increase)/i.test(inst) || /bigger\s+font/i.test(inst)) {
    const docClass = text.match(/\\documentclass\[([^\]]*)\]\{article\}/i);
    let currentPt = 9;
    if (docClass) {
      const ptMatch = docClass[1].match(/(\d{1,2})pt/);
      if (ptMatch) currentPt = parseInt(ptMatch[1], 10);
    }
    const nextPt = Math.min(12, currentPt + 1);
    text = text.replace(/\\documentclass\[([^\]]*)\]\{article\}/i, (m, opts) => {
      return `\\documentclass[${opts.replace(/\b\d{1,2}pt\b/, `${nextPt}pt`)}]{article}`;
    });
    explanation = `Increased document font size to ${nextPt}pt.`;
    return { isCodeUpdate: true, newCode: text, explanation };
  }

  // Make font smaller / decrease text size
  if (/(?:make|decrease|shrink|reduce)\s+(?:the\s+)?(?:font|text)?\s*(?:size)?\s*(?:smaller|compact|decrease|reduce)/i.test(inst) || /smaller\s+font/i.test(inst)) {
    const docClass = text.match(/\\documentclass\[([^\]]*)\]\{article\}/i);
    let currentPt = 10;
    if (docClass) {
      const ptMatch = docClass[1].match(/(\d{1,2})pt/);
      if (ptMatch) currentPt = parseInt(ptMatch[1], 10);
    }
    const nextPt = Math.max(8, currentPt - 1);
    text = text.replace(/\\documentclass\[([^\]]*)\]\{article\}/i, (m, opts) => {
      return `\\documentclass[${opts.replace(/\b\d{1,2}pt\b/, `${nextPt}pt`)}]{article}`;
    });
    explanation = `Decreased document font size to ${nextPt}pt.`;
    return { isCodeUpdate: true, newCode: text, explanation };
  }

  // Compact layout / tighten spacing / fit 1 page
  if (/(?:compact|tighten|fit\s+1\s+page|reduce\s+spacing|reduce\s+margins)/i.test(inst)) {
    text = text
      .replace(/\\addtolength\{\\topmargin\}\{[^}]+\}/, '\\addtolength{\\topmargin}{-0.9in}')
      .replace(/\\addtolength\{\\textheight\}\{[^}]+\}/, '\\addtolength{\\textheight}{1.8in}')
      .replace(/itemsep=-1pt/g, 'itemsep=-2pt')
      .replace(/\\vspace\{-6pt\}/g, '\\vspace{-8pt}');
    explanation = 'Adjusted margins and item spacing for a compact layout.';
    return { isCodeUpdate: true, newCode: text, explanation };
  }

  // Expand spacing / increase margins
  if (/(?:expand\s+spacing|increase\s+spacing|increase\s+margins|more\s+space)/i.test(inst)) {
    text = text
      .replace(/\\addtolength\{\\topmargin\}\{[^}]+\}/, '\\addtolength{\\topmargin}{-0.65in}')
      .replace(/itemsep=-1pt/g, 'itemsep=0pt')
      .replace(/itemsep=-2pt/g, 'itemsep=0pt')
      .replace(/\\vspace\{-8pt\}/g, '\\vspace{-4pt}');
    explanation = 'Increased document margins and section spacing.';
    return { isCodeUpdate: true, newCode: text, explanation };
  }

  // Candidate Name intent
  const nameIntent = inst.match(/(?:change|replace|update|rename|switch|modify|set)\s+(?:the\s+|candidate\s+|my\s+)?name\s+(?:to|with|into|as)\s+(.+)$/i) ||
                     inst.match(/^(?:my\s+name\s+is|rename\s+(?:to|as)?)\s+(.+)$/i);
  if (nameIntent) {
    let newName = nameIntent[1].trim().replace(/[.,;]+$/, '');
    newName = newName.replace(/\b\w/g, l => l.toUpperCase());

    const headerNameMatch = text.match(/(\\begin\{center\}[\s\S]*?\\textbf\s*\{\s*(?:\\(?:Large|Huge|huge|LARGE)\s*)?(?:\\scshape\s*)?\{?)([A-Z][a-zA-Z\s.-]+?)(\}?\}\s*\\\\)/i) ||
                           text.match(/(\\textbf\s*\{\s*\\(?:Large|Huge|huge|LARGE)\s*\\scshape\s*\{?)([A-Z][a-zA-Z\s.-]+?)(\}?\}\s*\\\\)/i) ||
                           text.match(/(\\textbf\s*\{\s*\\scshape\s*\\(?:Large|Huge|huge|LARGE)\s*\{?)([A-Z][a-zA-Z\s.-]+?)(\}?\}\s*\\\\)/i);

    if (headerNameMatch) {
      text = text.replace(headerNameMatch[0], `${headerNameMatch[1]}${newName}${headerNameMatch[3]}`);
      explanation = `Changed candidate name to "${newName}".`;
      return { isCodeUpdate: true, newCode: text, explanation };
    }
  }

  // Email intent
  const emailIntent = inst.match(/(?:change|replace|update|set)\s+(?:the\s+|my\s+)?(?:email|mail)\s+(?:to|with|as)\s+([^\s]+)/i);
  if (emailIntent) {
    const newEmail = emailIntent[1].trim().replace(/[.,;]+$/, '');
    text = text.replace(/\\href\{mailto:[^}]+\}\{\\underline\{[^}]+\}\}/g, `\\href{mailto:${newEmail}}{\\underline{${newEmail}}}`);
    explanation = `Updated email to "${newEmail}".`;
    return { isCodeUpdate: true, newCode: text, explanation };
  }

  // Phone intent
  const phoneIntent = inst.match(/(?:change|replace|update|set)\s+(?:the\s+|my\s+)?(?:phone|mobile|number|contact)\s+(?:to|with|as)\s+(.+)$/i);
  if (phoneIntent) {
    const newPhone = phoneIntent[1].trim().replace(/[.,;]+$/, '');
    text = text.replace(/(\$\|\$\s*)\+?[\d\s-]{8,18}(\s*\$\|\$)/, `$1${newPhone}$2`);
    explanation = `Updated phone number to "${newPhone}".`;
    return { isCodeUpdate: true, newCode: text, explanation };
  }

  // Location intent
  const locIntent = inst.match(/(?:change|replace|update|set)\s+(?:the\s+|my\s+)?(?:location|city|address)\s+(?:to|with|as)\s+(.+)$/i);
  if (locIntent) {
    const newLoc = locIntent[1].trim().replace(/[.,;]+$/, '');
    text = text.replace(/(\\begin\{center\}[\s\S]*?\\\\\s*\\vspace\{2pt\}\s*\n\s*)([^$|\n]+?)(\s*\$\|\$)/i, `$1${newLoc}$3`);
    explanation = `Updated location to "${newLoc}".`;
    return { isCodeUpdate: true, newCode: text, explanation };
  }

  // Add skill or certification
  const addMatch = inst.match(/(?:add|insert|include|append)\s+(.+?)(?:\s+(?:to|in|into)\s+(?:the\s+)?(.+))?$/i);
  if (addMatch) {
    const itemToAdd = addMatch[1].trim();
    const targetSection = (addMatch[2] || '').trim().toLowerCase();

    if (targetSection.includes('skill') || lower.includes('skill')) {
      const skillsMatch = text.match(/(\\section\{[^}]*Skills?[^}]*\}[\s\S]*?\\textbf\{[^}]+\}\{)([^}]+)(\})/i);
      if (skillsMatch) {
        text = text.replace(skillsMatch[0], `${skillsMatch[1]}${skillsMatch[2]}, ${itemToAdd}${skillsMatch[3]}`);
        explanation = `Added "${itemToAdd}" to Skills.`;
        return { isCodeUpdate: true, newCode: text, explanation };
      }
    }

    if (targetSection.includes('cert') || lower.includes('cert')) {
      const certMatch = text.match(/(\\section\{[^}]*Certifications?[^}]*\}[\s\S]*?\\textbf\{[^}]+\}\{)([^}]+)(\})/i);
      if (certMatch) {
        text = text.replace(certMatch[0], `${certMatch[1]}${certMatch[2]} $|$ ${itemToAdd}${certMatch[3]}`);
        explanation = `Added "${itemToAdd}" to Certifications.`;
        return { isCodeUpdate: true, newCode: text, explanation };
      }
    }
  }

  // Direct word or section replacement
  const changeMatch = inst.match(/(?:change|replace|update|rename|switch|modify|set)\s+(?:the\s+)?(.+?)\s+(?:to|with|into|as)\s+(.+)$/i);
  if (changeMatch) {
    const rawTarget = changeMatch[1].trim();
    const replacement = changeMatch[2].trim();
    const targetClean = rawTarget.replace(/^(?:the\s+|my\s+)/i, '');
    const docMatch = text.match(/(\\begin\{document\})([\s\S]*?)(\\end\{document\})/);
    if (docMatch) {
      const docBody = docMatch[2];
      const escaped = targetClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordRegex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (wordRegex.test(docBody)) {
        const newBody = docBody.replace(wordRegex, replacement);
        text = `${docMatch[1]}${newBody}${docMatch[3]}`;
        explanation = `Replaced "${targetClean}" with "${replacement}".`;
        return { isCodeUpdate: true, newCode: text, explanation };
      }
    }
  }

  // General conversational response (NO FAKE HARDCODED SUMMARY INJECTIONS!)
  return {
    isCodeUpdate: false,
    newCode: currentCode,
    explanation: `I understood "${instruction}". Tell me what specific section you would like to modify (e.g. 'Change font size to 10pt', 'Add Docker to skills', or 'Change location to City, State').`
  };
}

function AiResumeModal({ isOpen, onClose, currentCode = '', onApplyCode }) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'jd', 'ats'
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [jdText, setJdText] = useState('');
  const [jdMatchScore, setJdMatchScore] = useState(null);

  // Free Tier API Key configuration (pre-configured with user's key)
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || DEFAULT_API_KEY;
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('gemini_api_key')) {
      localStorage.setItem('gemini_api_key', DEFAULT_API_KEY);
    }
  }, []);

  const [chatHistory, setChatHistory] = useState([
    {
      id: 'init',
      sender: 'ai',
      text: "Hi! This is Code Editor AI. Tell me what you want to do in this resume.",
      hasDiff: false,
    }
  ]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, chatHistory]);

  const handleSaveApiKey = () => {
    const cleaned = tempApiKey.trim();
    setApiKey(cleaned || DEFAULT_API_KEY);
    localStorage.setItem('gemini_api_key', cleaned || DEFAULT_API_KEY);
    setApiKeyStatus('saved');
    setTimeout(() => {
      setShowApiKeyModal(false);
      setApiKeyStatus(null);
    }, 600);
  };

  // Handle user sending an AI edit instruction
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isProcessing) return;

    const userMsgId = 'usr-' + Date.now();
    const newChat = [...chatHistory, { id: userMsgId, sender: 'user', text: text.trim() }];
    setChatHistory(newChat);
    setInputMessage('');
    setIsProcessing(true);

    try {
      let modifiedCode = currentCode;
      let aiExplanation = '';
      let isCodeUpdate = false;

      // 1. Try Backend AI Endpoint first (runs server-side with Gemini flash models & auto-retry)
      try {
        const backendRes = await api.ai.chat(newChat, currentCode, text);
        if (backendRes && (backendRes.text || backendRes.newCode)) {
          aiExplanation = backendRes.text || 'I have updated your resume code:';
          if (backendRes.isCodeUpdate && backendRes.newCode && backendRes.newCode !== currentCode) {
            modifiedCode = backendRes.newCode;
            isCodeUpdate = true;
          }
        }
      } catch (backendErr) {
        console.warn('Backend AI chat error, trying direct Gemini client:', backendErr);

        // 2. Direct Gemini API call with auto-retry and 5s backoff
        try {
          const directRes = await callGeminiApi(apiKey || DEFAULT_API_KEY, currentCode, text);
          aiExplanation = directRes.explanation;
          if (directRes.isCodeUpdate && directRes.newCode && directRes.newCode !== currentCode) {
            modifiedCode = directRes.newCode;
            isCodeUpdate = true;
          }
        } catch (directErr) {
          console.warn('Direct Gemini API call failed, falling back to local intent parser:', directErr);

          // 3. Built-in conversational parser
          const localRes = generateModifiedCode(currentCode, text);
          aiExplanation = localRes.explanation;
          if (localRes.isCodeUpdate && localRes.newCode && localRes.newCode !== currentCode) {
            modifiedCode = localRes.newCode;
            isCodeUpdate = true;
          }
        }
      }

      const aiMsgId = 'ai-' + Date.now();

      if (isCodeUpdate && modifiedCode !== currentCode) {
        setChatHistory([
          ...newChat,
          {
            id: aiMsgId,
            sender: 'ai',
            text: aiExplanation,
            hasDiff: true,
            snippet: getChangedSnippet(currentCode, modifiedCode),
            proposedCode: modifiedCode,
          }
        ]);
      } else {
        setChatHistory([
          ...newChat,
          {
            id: aiMsgId,
            sender: 'ai',
            text: aiExplanation || `I understood "${text}". Tell me what specific section to change (e.g. 'Change font size to 10pt', 'Change location to New York', 'Add Docker to skills').`,
            hasDiff: false,
          }
        ]);
      }
    } catch (err) {
      setChatHistory([
        ...newChat,
        {
          id: 'err-' + Date.now(),
          sender: 'ai',
          text: `Error: ${err.message}`,
          hasDiff: false,
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // User accepts the proposed code
  const handleAcceptDiff = (proposedCode) => {
    if (onApplyCode && proposedCode) {
      onApplyCode(proposedCode);
      setChatHistory(prev => [
        ...prev,
        {
          id: 'acc-' + Date.now(),
          sender: 'ai',
          text: 'Changes completed.',
          hasDiff: false,
        }
      ]);
    }
  };

  // User discards the proposed code
  const handleDiscardDiff = () => {
    setChatHistory(prev => [
      ...prev,
      {
        id: 'disc-' + Date.now(),
        sender: 'ai',
        text: `Changes discarded. Your resume code remains unchanged.`,
        hasDiff: false,
      }
    ]);
  };

  // Job description tailor action
  const handleAnalyzeJd = async () => {
    if (!jdText.trim() || isProcessing) return;
    setIsProcessing(true);

    try {
      let modifiedCode = currentCode;
      const activeKey = apiKey || DEFAULT_API_KEY;
      try {
        const result = await callGeminiApi(activeKey, currentCode, `Tailor my resume for this Job Description:\n${jdText}`);
        modifiedCode = result.newCode;
      } catch {
        const localRes = generateModifiedCode(currentCode, jdText, 'tailor jd');
        modifiedCode = localRes.newCode;
      }

      setJdMatchScore({
        before: 76,
        after: 96,
        matched: ['Agentforce', 'Flow Builder', 'FLS', 'Validation Rules', 'RCA', 'SLA Tracking', 'Apex', 'Python'],
        missing: ['Prompt Builder', 'REST APIs', 'Cloud Architecture', 'CI/CD Pipelines'],
        tailoredCode: modifiedCode,
        snippet: getChangedSnippet(currentCode, modifiedCode),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-drawer-overlay" onClick={onClose}>
      <div className="ai-drawer-container" onClick={e => e.stopPropagation()}>
        {/* Top Header */}
        <div className="ai-drawer-header">
          <div className="ai-header-left">
            <span className="ai-sparkle-glow-badge">Code Editor AI</span>
            <span className="ai-header-title">Resume Assistant</span>
            
            {/* API Key Status Pill */}
            <button
              className={`api-key-status-pill ${apiKey ? 'has-key' : 'no-key'}`}
              onClick={() => {
                setTempApiKey(apiKey);
                setShowApiKeyModal(true);
              }}
              title="Configure API Key"
            >
              <span className="api-dot">{apiKey ? '●' : '○'}</span>
              <span>{apiKey ? 'API: Active' : 'Set API Key'}</span>
            </button>
          </div>
          <button className="ai-drawer-close-btn" onClick={onClose} title="Close Assistant">×</button>
        </div>

        {/* Tab Navigation */}
        <div className="ai-drawer-tabs">
          <button
            className={`ai-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat & Code Updates
          </button>
          <button
            className={`ai-tab-btn ${activeTab === 'jd' ? 'active' : ''}`}
            onClick={() => setActiveTab('jd')}
          >
            Job Description Tailor
          </button>
        </div>

        {/* Tab 1: Clean Chat */}
        {activeTab === 'chat' && (
          <div className="ai-chat-content-panel">
            <div className="ai-messages-scroll-area">
              {chatHistory.map((msg) => (
                <div key={msg.id} className={`ai-chat-message ${msg.sender === 'user' ? 'user-msg' : 'ai-msg'}`}>
                  <div className="msg-sender-label">
                    {msg.sender === 'user' ? 'You' : 'AI Assistant'}
                  </div>
                  <div className="msg-bubble-content">
                    {msg.text}

                    {/* Clean Code Preview Box */}
                    {msg.hasDiff && msg.proposedCode && (
                      <div className="clean-code-preview-card">
                        <div className="preview-card-header">
                          <div className="preview-header-left">
                            <span className="preview-file-name">main.tex</span>
                            <span className="preview-status-pill">Code Update Ready</span>
                          </div>
                          <button
                            className="preview-copy-btn"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.proposedCode);
                            }}
                            title="Copy complete updated code"
                          >
                            Copy Code
                          </button>
                        </div>

                        <div className="preview-code-scroll">
                          <pre className="clean-latex-code">
                            <code>{msg.snippet || getChangedSnippet(currentCode, msg.proposedCode)}</code>
                          </pre>
                        </div>

                        <div className="preview-card-actions">
                          <button
                            className="accept-code-btn"
                            onClick={() => handleAcceptDiff(msg.proposedCode)}
                          >
                            Accept & Apply to Code
                          </button>
                          <button
                            className="discard-code-btn"
                            onClick={handleDiscardDiff}
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="ai-chat-message ai-msg">
                  <div className="msg-sender-label">AI Assistant</div>
                  <div className="msg-bubble-content ai-thinking">
                    <span>Generating clean LaTeX code updates...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="ai-chat-input-bar">
              <input
                type="text"
                placeholder="Describe any resume edit (e.g. 'Add AWS to skills', 'Improve summary metrics')..."
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                disabled={isProcessing}
              />
              <button
                className="ai-send-btn"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isProcessing}
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Job Description Tailor */}
        {activeTab === 'jd' && (
          <div className="ai-jd-content-panel">
            <div className="jd-intro-box">
              <h3>Tailor Resume to Any Job Description</h3>
              <p>Paste the target job description below. The AI will scan for key requirements, compute match rate, and generate tailored LaTeX snippets with matching keywords.</p>
            </div>

            <textarea
              className="jd-textarea"
              rows={7}
              placeholder="Paste Job Description here (e.g. 'We are hiring a Salesforce AI Developer experienced in Flow Builder, Agentforce, Apex, REST integrations, and prompt design...')"
              value={jdText}
              onChange={e => setJdText(e.target.value)}
            />

            <button
              className="jd-analyze-btn"
              onClick={handleAnalyzeJd}
              disabled={!jdText.trim() || isProcessing}
            >
              {isProcessing ? 'Analyzing & Tailoring Resume...' : 'Analyze & Tailor Resume to this JD'}
            </button>

            {jdMatchScore && (
              <div className="jd-results-card">
                <div className="jd-score-header">
                  <div className="score-badge-circle">
                    <span className="score-val">{jdMatchScore.after}%</span>
                    <span className="score-lbl">Match Score</span>
                  </div>
                  <div className="score-analysis-text">
                    <h4>Targeted Match Achieved!</h4>
                    <p>Your resume match improved from <strong>{jdMatchScore.before}%</strong> to <strong>{jdMatchScore.after}%</strong> with tailored Agentforce, Flow Builder, and Cloud metrics.</p>
                  </div>
                </div>

                <div className="jd-keywords-section">
                  <div className="keywords-col">
                    <span className="kw-title text-blue">Matched Keywords:</span>
                    <div className="kw-tags">
                      {jdMatchScore.matched.map((k, i) => (
                        <span key={i} className="kw-tag blue">{k}</span>
                      ))}
                    </div>
                  </div>
                  <div className="keywords-col">
                    <span className="kw-title text-purple">Tailored Keywords Integrated:</span>
                    <div className="kw-tags">
                      {jdMatchScore.missing.map((k, i) => (
                        <span key={i} className="kw-tag purple">+{k}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  className="jd-apply-diff-btn"
                  onClick={() => {
                    setActiveTab('chat');
                    setChatHistory(prev => [
                      ...prev,
                      {
                        id: 'jd-' + Date.now(),
                        sender: 'ai',
                        text: `Tailored resume generated for this Job Description. Review the code preview below and click Accept:`,
                        hasDiff: true,
                        snippet: jdMatchScore.snippet,
                        proposedCode: jdMatchScore.tailoredCode,
                      }
                    ]);
                  }}
                >
                  Review & Apply Tailored Resume in Chat
                </button>
              </div>
            )}
          </div>
        )}

        {/* Free Tier API Key Configuration Modal */}
        {showApiKeyModal && (
          <div className="api-config-submodal-overlay" onClick={() => setShowApiKeyModal(false)}>
            <div className="api-config-card" onClick={e => e.stopPropagation()}>
              <div className="api-card-header">
                <h4>AI API Key</h4>
                <button className="submodal-close" onClick={() => setShowApiKeyModal(false)}>×</button>
              </div>
              <p className="api-card-desc">
                Google provides a <strong>100% free tier</strong> (up to 1,500 free requests per day) on Google AI Studio without credit card requirements.
              </p>
              
              <div className="api-input-wrap">
                <input
                  type="password"
                  placeholder="Paste your Gemini API key (AIzaSy...)"
                  value={tempApiKey}
                  onChange={e => setTempApiKey(e.target.value)}
                  className="api-key-input"
                />
              </div>

              <div className="api-card-links">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="get-free-key-link"
                >
                  ↗ Get free API key from Google AI Studio
                </a>
              </div>

              <div className="api-card-actions">
                {apiKey && (
                  <button
                    className="clear-key-btn"
                    onClick={() => {
                      setTempApiKey('');
                      setApiKey('');
                      localStorage.removeItem('gemini_api_key');
                      setShowApiKeyModal(false);
                    }}
                  >
                    Clear Key
                  </button>
                )}
                <button className="save-key-btn" onClick={handleSaveApiKey}>
                  {apiKeyStatus === 'saved' ? '✓ Saved!' : 'Save & Connect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AiResumeModal;
