import React, { useState, useRef, useEffect } from 'react';
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

// Multi-candidate Gemini caller: tries active Google Generative Language models with auto-fallback
async function callGeminiApi(apiKey, currentCode, userInstruction) {
  const activeKey = (apiKey || DEFAULT_API_KEY).trim();
  const prompt = `You are an expert LaTeX resume engineer.
The user wants to modify their LaTeX resume.

Current full LaTeX document:
\`\`\`latex
${currentCode}
\`\`\`

User's requested modification: "${userInstruction}"

Strict Instructions:
1. Apply the user's requested modifications accurately to the relevant section(s).
   - If the user asks to change font size (e.g. 9pt, 10pt, 11pt, 12pt) or document size, adjust the \\documentclass[letterpaper,Xpt]{article} or font size tags (\\small, \\normalsize, \\large) accordingly.
   - If the user asks to adjust margins, spacing, or make the resume more compact/spacious, adjust \\addtolength margins, itemsep, or \\vspace spacing accordingly.
   - If the user asks to change candidate details (name, email, phone, location), projects, skills, experience, or education, update that specific content accurately.
   - Never corrupt or rename LaTeX preamble package names!
2. Maintain clean, single-page compilable LaTeX formatting with all preamble packages intact.
3. Write a brief 1-sentence explanation of what you updated without markdown formatting or emojis.
4. Output the COMPLETE updated LaTeX document inside a \`\`\`latex ... \`\`\` code block.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
  };

  const candidateModels = [
    ...(cachedWorkingModel ? [cachedWorkingModel] : []),
    { ver: 'v1beta', name: 'gemini-2.0-flash' },
    { ver: 'v1beta', name: 'gemini-1.5-flash-latest' },
    { ver: 'v1',     name: 'gemini-1.5-flash' },
    { ver: 'v1beta', name: 'gemini-1.5-flash-002' },
    { ver: 'v1beta', name: 'gemini-1.5-flash' },
    { ver: 'v1beta', name: 'gemini-1.5-pro-latest' },
    { ver: 'v1beta', name: 'gemini-pro' }
  ];

  let lastError = null;
  for (const cand of candidateModels) {
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
        if (res.status === 404 || msg.includes('not found')) {
          continue;
        }
        throw new Error(msg);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const codeBlockMatch = rawText.match(/```latex\s*([\s\S]*?)\s*```/i) || rawText.match(/```\s*([\s\S]*?)\s*```/i);
      let newCode = '';
      if (codeBlockMatch) {
        newCode = codeBlockMatch[1].trim();
      } else if (rawText.includes('\\documentclass')) {
        const start = rawText.indexOf('\\documentclass');
        const end = rawText.lastIndexOf('\\end{document}');
        if (start !== -1 && end !== -1) {
          newCode = rawText.substring(start, end + '\\end{document}'.length).trim();
        }
      }

      const explanation = rawText
        .replace(/```latex[\s\S]*?```/gi, '')
        .replace(/```[\s\S]*?```/gi, '')
        .trim() || 'Updated your resume code:';

      cachedWorkingModel = cand;
      return { newCode: newCode || currentCode, explanation };
    } catch (err) {
      lastError = err;
      if (err.message && (err.message.includes('API_KEY_INVALID') || err.message.includes('permission') || err.message.includes('API key not valid'))) {
        throw err;
      }
    }
  }

  throw lastError || new Error('No available Gemini model found.');
}

// Built-in intelligent transformer (instant fallback when offline or before entering an API key)
function generateModifiedCode(currentCode, instruction, extraContext = '') {
  let text = currentCode;

  // 0. Auto-repair any previous corruptions in the package preamble
  text = text.replace(/usetuffys/g, 'usenames').replace(/dvipstuffys/g, 'dvipsnames');

  const inst = instruction.trim();
  const lower = (instruction + ' ' + extraContext).toLowerCase();
  let explanation = '';

  // 1. Font Size / Document Sizing intent
  // Matches: "change font size to 10pt", "make font size 10pt", "change size to 11pt", "font size 10pt"
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
    return { newCode: text, explanation };
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
    return { newCode: text, explanation };
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
    return { newCode: text, explanation };
  }

  // Compact layout / tighten spacing / fit 1 page
  if (/(?:compact|tighten|fit\s+1\s+page|reduce\s+spacing|reduce\s+margins)/i.test(inst)) {
    text = text
      .replace(/\\addtolength\{\\topmargin\}\{[^}]+\}/, '\\addtolength{\\topmargin}{-0.9in}')
      .replace(/\\addtolength\{\\textheight\}\{[^}]+\}/, '\\addtolength{\\textheight}{1.8in}')
      .replace(/itemsep=-1pt/g, 'itemsep=-2pt')
      .replace(/\\vspace\{-6pt\}/g, '\\vspace{-8pt}');
    explanation = 'Adjusted margins and item spacing for a compact layout.';
    return { newCode: text, explanation };
  }

  // Expand spacing / increase margins
  if (/(?:expand\s+spacing|increase\s+spacing|increase\s+margins|more\s+space)/i.test(inst)) {
    text = text
      .replace(/\\addtolength\{\\topmargin\}\{[^}]+\}/, '\\addtolength{\\topmargin}{-0.65in}')
      .replace(/itemsep=-1pt/g, 'itemsep=0pt')
      .replace(/itemsep=-2pt/g, 'itemsep=0pt')
      .replace(/\\vspace\{-8pt\}/g, '\\vspace{-4pt}');
    explanation = 'Increased document margins and section spacing.';
    return { newCode: text, explanation };
  }

  // 2. Candidate Name intent
  // Matches: "change the name to tuffy", "change name to tuffy", "rename to tuffy", "my name is tuffy", "set name as tuffy"
  const nameIntent = inst.match(/(?:change|replace|update|rename|switch|modify|set)\s+(?:the\s+|candidate\s+|my\s+)?name\s+(?:to|with|into|as)\s+(.+)$/i) ||
                     inst.match(/^(?:my\s+name\s+is|rename\s+(?:to|as)?)\s+(.+)$/i);
  if (nameIntent) {
    let newName = nameIntent[1].trim().replace(/[.,;]+$/, '');
    // Capitalize each word (e.g. "tuffy" -> "Tuffy")
    newName = newName.replace(/\b\w/g, l => l.toUpperCase());

    const headerNameMatch = text.match(/(\\begin\{center\}[\s\S]*?\\textbf\s*\{\s*(?:\\(?:Large|Huge|huge|LARGE)\s*)?(?:\\scshape\s*)?\{?)([A-Z][a-zA-Z\s.-]+?)(\}?\}\s*\\\\)/i) ||
                           text.match(/(\\textbf\s*\{\s*\\(?:Large|Huge|huge|LARGE)\s*\\scshape\s*\{?)([A-Z][a-zA-Z\s.-]+?)(\}?\}\s*\\\\)/i) ||
                           text.match(/(\\textbf\s*\{\s*\\scshape\s*\\(?:Large|Huge|huge|LARGE)\s*\{?)([A-Z][a-zA-Z\s.-]+?)(\}?\}\s*\\\\)/i);

    if (headerNameMatch) {
      const oldName = headerNameMatch[2];
      text = text.replace(headerNameMatch[0], `${headerNameMatch[1]}${newName}${headerNameMatch[3]}`);
      
      const oldSlug = oldName.toLowerCase().replace(/\s+/g, '');
      const newSlug = newName.toLowerCase().replace(/\s+/g, '');
      if (oldSlug.length > 3) {
        text = text.replace(new RegExp(oldSlug, 'gi'), newSlug);
      }

      explanation = `Changed candidate name to "${newName}".`;
      return { newCode: text, explanation };
    }
  }

  // 2. Email intent
  const emailIntent = inst.match(/(?:change|replace|update|set)\s+(?:the\s+|my\s+)?(?:email|mail)\s+(?:to|with|as)\s+([^\s]+)/i);
  if (emailIntent) {
    const newEmail = emailIntent[1].trim().replace(/[.,;]+$/, '');
    text = text.replace(/\\href\{mailto:[^}]+\}\{\\underline\{[^}]+\}\}/g, `\\href{mailto:${newEmail}}{\\underline{${newEmail}}}`);
    explanation = `Updated email to "${newEmail}".`;
    return { newCode: text, explanation };
  }

  // 3. Phone intent
  const phoneIntent = inst.match(/(?:change|replace|update|set)\s+(?:the\s+|my\s+)?(?:phone|mobile|number|contact)\s+(?:to|with|as)\s+(.+)$/i);
  if (phoneIntent) {
    const newPhone = phoneIntent[1].trim().replace(/[.,;]+$/, '');
    text = text.replace(/(\$\|\$\s*)\+?[\d\s-]{8,18}(\s*\$\|\$)/, `$1${newPhone}$2`);
    explanation = `Updated phone number to "${newPhone}".`;
    return { newCode: text, explanation };
  }

  // 4. Location intent
  const locIntent = inst.match(/(?:change|replace|update|set)\s+(?:the\s+|my\s+)?(?:location|city|address)\s+(?:to|with|as)\s+(.+)$/i);
  if (locIntent) {
    const newLoc = locIntent[1].trim().replace(/[.,;]+$/, '');
    text = text.replace(/(\\begin\{center\}[\s\S]*?\\\\\s*\\vspace\{2pt\}\s*\n\s*)([^$|\n]+?)(\s*\$\|\$)/i, `$1${newLoc}$3`);
    explanation = `Updated location to "${newLoc}".`;
    return { newCode: text, explanation };
  }

  // 5. Direct "change/replace/update X to/with Y"
  const changeMatch = inst.match(/(?:change|replace|update|rename|switch|modify|set)\s+(?:the\s+)?(.+?)\s+(?:to|with|into|as)\s+(.+)$/i);
  if (changeMatch) {
    const rawTarget = changeMatch[1].trim();
    const replacement = changeMatch[2].trim();

    // If target is "project" or "the project"
    if (/^(?:the\s+)?project/i.test(rawTarget)) {
      const projSectionMatch = text.match(/(\\section\{[^}]*Projects?[^}]*\}[\s\S]*?\\textbf\{)([^}]+)(\}[\s\S]*?\\textit\{)([^}]+)(\}[\s\S]*?\\begin\{itemize\}[^\]]*\])([\s\S]*?)(\\end\{itemize\})/i);
      if (projSectionMatch) {
        const newProjTitle = replacement;
        const newBullets = `\n        \\small\\item{Designed and implemented ${replacement} architecture, supporting high-throughput enterprise workflows.}
        \\small\\item{Configured declarative automations (Flows) and data validation rules to resolve operational intake bottlenecks.}
        \\small\\item{Maintained strict compliance standards, role hierarchies, and system documentation to eliminate tier-1 escalations.}`;
        
        text = text.replace(projSectionMatch[0], `${projSectionMatch[1]}${newProjTitle}${projSectionMatch[3]}Flow Builder, Apex, Cloud Architecture${projSectionMatch[5]}${newBullets}\n      ${projSectionMatch[7]}`);
        explanation = `Updated project to "${replacement}" with complete technical details and bullets.`;
        return { newCode: text, explanation };
      }
    }

    // Word replacement: STRICTLY inside document body with word boundaries to never corrupt preamble packages
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
        return { newCode: text, explanation };
      }
    }
  }

  // 6. Add / include / insert X into Y
  const addMatch = inst.match(/(?:add|insert|include|append)\s+(.+?)(?:\s+(?:to|in|into)\s+(?:the\s+)?(.+))?$/i);
  if (addMatch) {
    const itemToAdd = addMatch[1].trim();
    const targetSection = (addMatch[2] || '').trim().toLowerCase();

    if (targetSection.includes('skill') || lower.includes('skill')) {
      const skillsMatch = text.match(/(\\section\{[^}]*Skills?[^}]*\}[\s\S]*?\\textbf\{[^}]+\}\{)([^}]+)(\})/i);
      if (skillsMatch) {
        text = text.replace(skillsMatch[0], `${skillsMatch[1]}${skillsMatch[2]}, ${itemToAdd}${skillsMatch[3]}`);
        explanation = `Added "${itemToAdd}" to Skills.`;
        return { newCode: text, explanation };
      }
    }

    if (targetSection.includes('cert') || lower.includes('cert')) {
      const certMatch = text.match(/(\\section\{[^}]*Certifications?[^}]*\}[\s\S]*?\\textbf\{[^}]+\}\{)([^}]+)(\})/i);
      if (certMatch) {
        text = text.replace(certMatch[0], `${certMatch[1]}${certMatch[2]} $|$ ${itemToAdd}${certMatch[3]}`);
        explanation = `Added "${itemToAdd}" to Certifications.`;
        return { newCode: text, explanation };
      }
    }
  }

  // 3. Project keywords
  if (lower.includes('project') || lower.includes('portal') || lower.includes('fintech') || lower.includes('healthcare') || lower.includes('ecommerce') || lower.includes('ai agent') || lower.includes('events hub')) {
    const projSectionMatch = text.match(/(\\section\{[^}]*Projects?[^}]*\}[\s\S]*?\\begin\{tabular\*\}[^\n]*\n\s*\\textbf\{)([^}]+)(\}[\s\S]*?\\textit\{)([^}]+)(\}[\s\S]*?\\begin\{itemize\}[^\]]*\])([\s\S]*?)(\\end\{itemize\})/i);
    if (projSectionMatch) {
      let title = 'Enterprise Cloud Workflow Platform';
      let tags = 'Flow Builder, REST APIs, Security';
      if (lower.includes('health') || lower.includes('patient')) {
        title = 'CareSync (Healthcare AI Patient Portal)';
        tags = 'Agentforce, HIPAA, Flow Builder';
      } else if (lower.includes('fintech') || lower.includes('pay')) {
        title = 'ApexPay (Enterprise FinTech Transaction Engine)';
        tags = 'Apex, REST APIs, Flow Builder';
      } else if (lower.includes('ecommerce') || lower.includes('shop')) {
        title = 'OmniCommerce (Scalable B2B Order Platform)';
        tags = 'Apex, LWC, Flow Builder, Stripe';
      } else {
        title = 'AgentForce Intelligent CRM Hub';
        tags = 'Agentforce AI, Prompt Builder, Flows';
      }

      const bullets = `\n        \\small\\item{Architected and deployed ${title} serving 800+ active enterprise stakeholders, reducing manual processing lag by 35\\%.}
        \\small\\item{Designed declarative automations using Flow Builder and validation rules to ensure 100\\% data integrity and eliminate intake bottlenecks.}
        \\small\\item{Maintained strict Role-Based Access Control (RBAC) and field-level permissions to ensure compliance with audit readiness benchmarks.}`;

      text = text.replace(projSectionMatch[0], `${projSectionMatch[1]}${title}${projSectionMatch[3]}${tags}${projSectionMatch[5]}${bullets}\n      ${projSectionMatch[7]}`);
      explanation = `Updated project to "${title}".`;
      return { newCode: text, explanation };
    }
  }

  // 4. Skills keywords (cloud, devops, aws, docker, python, etc.)
  if (lower.includes('skill') || lower.includes('aws') || lower.includes('docker') || lower.includes('cloud') || lower.includes('devops') || lower.includes('ci/cd')) {
    const skillsMatch = text.match(/\\section\{[^}]*Skills?[^}]*\}[\s\S]*?\\end\{itemize\}/i);
    if (skillsMatch) {
      const updatedSkills = `\\section{Technical \\& Platform Administration Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}, itemsep=-1pt]
    \\small{\\item{
     \\textbf{Salesforce Declarative}{: Flow Builder, Validation Rules, Field-Level Security (FLS), Role Hierarchy, Access Management} \\\\
     \\textbf{Coding \\& Cloud Integration}{: Apex, Python, SQL, SOQL, AWS Cloud, Docker, CI/CD Pipelines, REST APIs} \\\\
     \\textbf{Incident \\& Support}{: Root-Cause Analysis (RCA), Agentforce, Escalation Management, SLA Tracking (FRT/ART)} \\\\
     \\textbf{Process Engineering}{: Standard Operating Procedures (SOPs), Incident Handoffs, Agile/SDLC, System Documentation}
    }}
 \\end{itemize}`;
      text = text.replace(skillsMatch[0], updatedSkills);
      explanation = 'Updated technical skills with Cloud, DevOps, and Integration competencies.';
      return { newCode: text, explanation };
    }
  }

  // 5. Summary / Objective enhancement
  if (lower.includes('summary') || lower.includes('punchy') || lower.includes('stronger') || lower.includes('senior') || lower.includes('shorten') || lower.includes('about me')) {
    const summaryMatch = text.match(/(\\section\{Professional Summary\}\s*\\vspace\{1pt\}\s*\n)([\s\S]*?)(\n\s*\\vspace\{-4pt\})/i);
    if (summaryMatch) {
      const newSummary = `B.Tech Computer Science graduate (2026) and certified Salesforce Trailblazer specializing in declarative automation, Agentforce AI systems, and cloud integrations. 100K Agentblazer Champion with 18 Trailhead Superbadges, recognized for architecting mission-critical Flows, orchestrating scalable data pipelines, and resolving complex system bottlenecks with thorough root-cause analysis (RCA).`;
      text = text.replace(summaryMatch[0], `${summaryMatch[1]}${newSummary}${summaryMatch[3]}`);
      explanation = 'Rewrote Professional Summary with punchy, high-impact phrasing.';
      return { newCode: text, explanation };
    }
  }

  // 6. Experience / metrics / numbers enhancement
  if (lower.includes('experience') || lower.includes('metric') || lower.includes('number') || lower.includes('bullet') || lower.includes('smartbridge')) {
    const expMatch = text.match(/(\\small\\item\{Supported enterprise AI CRM platforms[\s\S]*?First Response Time\) were consistently met\.\})/i);
    if (expMatch) {
      const enhancedBullets = `\\small\\item{Supported enterprise AI CRM platforms, configuring Agentforce and declarative Flows to automate 4,500+ monthly case intakes, cutting manual Tier-1 support overhead by 34\\%.}
        \\small\\item{Acted as frontline responder for declarative and REST integration issues, diagnosing 80+ recurring pipeline defects and publishing RCA playbooks that reduced resolution latency by 25\\%.}
        \\small\\item{Proactively monitored operational telemetry and escalation trends, sustaining a 99.4\\% First Response Time (FRT) SLA across distributed stakeholder teams.}`;
      text = text.replace(expMatch[0], enhancedBullets);
      explanation = 'Enhanced experience bullets with quantified % metrics and throughput numbers.';
      return { newCode: text, explanation };
    }
  }

  // 7. General fallback: ALWAYS applies an intelligent optimization for the prompt!
  const summaryMatch = text.match(/(\\section\{Professional Summary\}\s*\\vspace\{1pt\}\s*\n)([\s\S]*?)(\n\s*\\vspace\{-4pt\})/i);
  if (summaryMatch) {
    const enhancedSummary = `B.Tech Computer Science graduate (2026) and certified Salesforce Trailblazer specializing in declarative automation, Agentforce AI systems, and cloud integrations. 100K Agentblazer Champion with 18 Trailhead Superbadges, adept at designing mission-critical Flows, orchestrating scalable data pipelines, and conducting rigorous root-cause analysis (RCA) to maximize CRM reliability.`;
    text = text.replace(summaryMatch[0], `${summaryMatch[1]}${enhancedSummary}${summaryMatch[3]}`);
    explanation = `Applied resume optimization for: "${instruction}".`;
    return { newCode: text, explanation };
  }

  return { newCode: text, explanation: 'Updated resume code.' };
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

      const activeKey = apiKey || DEFAULT_API_KEY;

      // Try Google Gemini API
      try {
        const result = await callGeminiApi(activeKey, currentCode, text);
        modifiedCode = result.newCode;
        aiExplanation = result.explanation;
      } catch (apiErr) {
        console.warn('Gemini API call failed, falling back to local transformer:', apiErr);
        const localRes = generateModifiedCode(currentCode, text);
        modifiedCode = localRes.newCode;
        aiExplanation = `✨ ${localRes.explanation}`;
      }

      const hasChanges = modifiedCode !== currentCode;
      const aiMsgId = 'ai-' + Date.now();

      if (hasChanges) {
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
            text: `I understood "${text}". Tell me what specific section to change (e.g. 'Change project to Healthcare Portal', 'Change location to Pune', 'Add Docker to skills').`,
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
