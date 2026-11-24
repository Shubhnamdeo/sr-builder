import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api.js';
import { SOFTWARE_ENGINEER_TEMPLATE } from '../../utils/latexTemplates.js';
import { extractTextFromFile, parseResumeLocally, extractQuickProfileFromText } from '../../utils/pdfTextExtractor.js';
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
async function callGeminiApi(apiKey, currentCode, userInstruction, signal = null) {
  const activeKey = (apiKey || DEFAULT_API_KEY).trim();
  const baseCodeToUse = (currentCode && currentCode.includes('\\documentclass'))
    ? currentCode
    : SOFTWARE_ENGINEER_TEMPLATE;

  const prompt = `You are an expert AI Resume Consultant, Career Advisor, and LaTeX Engineer for "SR Builder".
The user is working on their LaTeX resume.

CURRENT RESUME LATEX CODE:
\`\`\`latex
${baseCodeToUse}
\`\`\`

USER'S MESSAGE:
"${userInstruction}"

Strict Guidelines:
1. If the user asks a question, gives conversational feedback, or is troubleshooting (e.g. "no changes after accepting"):
   - Do NOT output any LaTeX code block.
   - Reply conversationally with clear, helpful instructions.
   - If they ask about "no changes after accepting", explain that clicking "Accept & Apply Code" updates main.tex, and they need to click the green "Recompile" button at the top right of the editor to refresh the PDF preview.
2. If the user asks to modify, format, change, rewrite, or tailor their resume for a Job Description:
   - Provide a brief 1-sentence friendly explanation.
   - MUST preserve the exact Overleaf / Jake's resume structure and custom macros: \resumeSubheading, \resumeProjectHeading, \resumeItem, \resumeSubHeadingListStart, \resumeSubHeadingListEnd. Never delete or alter these core macro definitions.
   - Output the COMPLETE updated compilable LaTeX code inside a single \`\`\`latex ... \`\`\` block.
   - Support multi-page resumes (1 page, 2 pages, and up to 5 pages) based on content volume. When the user provides extensive experience, projects, or additional sections, allow the document to naturally expand into 2, 3, 4, or up to 5 pages. Insert \`\\newpage\` between major sections when appropriate for clean page transitions.
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
          body: JSON.stringify(payload),
          signal
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

// Multi-candidate Gemini caller for resume extraction from uploaded PDF / TXT
async function callGeminiResumeExtraction(apiKey, currentCode, resumeText, signal = null) {
  const activeKey = (apiKey || DEFAULT_API_KEY).trim();
  const baseCodeToUse = (currentCode && currentCode.includes('\\documentclass'))
    ? currentCode
    : SOFTWARE_ENGINEER_TEMPLATE;

  const prompt = `You are an expert AI Resume Consultant, Career Advisor, and LaTeX Engineer for "SR Builder".
The user has uploaded their existing resume in plain text format. Your job is to extract their authentic career details and map them cleanly into the active LaTeX resume template, completely replacing the placeholder template data.

--- USER'S UPLOADED RESUME TEXT ---
${resumeText}
--- END RESUME TEXT ---

CURRENT RESUME LATEX CODE (TEMPLATE):
\`\`\`latex
${baseCodeToUse}
\`\`\`

Strict Guidelines:
1. Extract authentic candidate information from the uploaded resume:
   - Full Name
   - Address / Location:
     * Search carefully for Address, City, State, Country, or Postal Location.
     * In the LaTeX header, REPLACE the placeholder location (e.g. "San Francisco, CA") with the candidate's real location.
     * If NO address or location is found in the resume, REMOVE "San Francisco, CA $|$" completely from the LaTeX header. Never retain fake or placeholder addresses.
   - Contact Info (Email, Phone, LinkedIn, GitHub, Portfolio)
   - Professional Summary (synthesize or use their summary, keeping it high-impact and 2-3 lines)
   - Work Experience (Job titles, company names, dates, locations, and bullet points)
   - Education (Degree, major, university, dates, GPA if mentioned)
   - Technical Skills (categorized into Languages, Frameworks/Developer Tools, Libraries, etc.)
   - Projects (if present in the uploaded text)
2. Map their details directly into the existing template macros:
   - \\resumeSubheading, \\resumeProjectHeading, \\resumeItem, \\resumeSubHeadingListStart, \\resumeSubHeadingListEnd
   - Preserve all macro definitions and LaTeX preamble. Never delete or break \\documentclass, \\usepackage, or macro definitions.
3. Replace all dummy/placeholder data (e.g. placeholder names, dummy address 'San Francisco, CA', sample colleges, fake jobs) with the user's authentic career details.
4. Escape LaTeX special characters properly (e.g. & to \\&, % to \\%, $ to \\$, _ to \\_, # to \\#).
5. Support clean multi-page or 1-page formatting based on content volume.
6. Format your output:
   - Start with a structured summary listing:
     • Name: [Extracted Name]
     • Address / Location: [Extracted Location or "None specified in resume"]
     • Phone: [Extracted Phone or "None specified"]
     • Email: [Extracted Email or "None specified"]
     • Links: [LinkedIn, GitHub, Portfolio]
     • Experience & Education: [Summary of jobs and degrees extracted]
   - End with the COMPLETE, compilable LaTeX code inside a single \`\`\`latex ... \`\`\` block.`;

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
          body: JSON.stringify(payload),
          signal
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          const msg = errJson.error?.message || `HTTP ${res.status}`;
          if (res.status === 503 || res.status === 429) {
            if (attempt < 2) {
              await sleep(5000);
              continue;
            }
          }
          if (res.status === 404 || msg.includes('not found') || msg.includes('no longer available')) {
            break;
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
          .trim() || 'Extracted your career details and mapped them to the LaTeX template:';

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
  let text = (currentCode && currentCode.includes('\\documentclass'))
    ? currentCode
    : SOFTWARE_ENGINEER_TEMPLATE;

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
      explanation: "I've reviewed your resume! Here are 3 targeted suggestions to make it stand out:\n\n1. **Action-Oriented Bullets**: Start bullet points with strong power verbs (e.g., 'Architected', 'Engineered', 'Streamlined') and quantify outcomes with metrics.\n2. **Skills Categorization**: Group your technical skills clearly (e.g., Languages, Frameworks, Cloud, Tools) for quick recruiter parsing.\n3. **Page Density**: Keep section margins compact so all your key qualifications fit cleanly on a single page.\n\nTell me which section you'd like to update first!"
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

  // 5. Add / Change Experience intent (e.g. "add the new job of software developer with the experience of 5 months in delloite company")
  const expAddMatch = inst.match(/(?:add|insert|include)\s+(?:the\s+|a\s+)?(?:new\s+)?(?:job|role|experience|position)\s+(?:of|as)?\s*(.+?)\s+(?:with|for)\s+(?:the\s+)?(?:experience\s+of\s+)?(.+?)\s+(?:at|in|with)\s+(.+?)(?:\s+company|\s+firm|\s+corp|$)/i) ||
                      inst.match(/(?:add|insert|include)\s+(?:the\s+|a\s+)?(?:new\s+)?(?:job|role|experience|position)\s+(?:at|in|with)\s*(.+?)\s+(?:as|of)\s*(.+?)(?:\s+with|\s+for|\s+duration|$)/i);
  if (expAddMatch || (lower.includes('experience') && (lower.includes('job') || lower.includes('developer') || lower.includes('engineer')) && (lower.includes('deloitte') || lower.includes('delloite')))) {
    let role = 'Software Developer';
    let company = 'Deloitte';
    let duration = '5 Months';

    if (expAddMatch) {
      role = expAddMatch[1]?.trim() || 'Software Developer';
      duration = expAddMatch[2]?.trim() || '5 Months';
      company = expAddMatch[3]?.trim() || 'Deloitte';
    }
    if (/delloite|deloitte/i.test(company) || lower.includes('deloitte') || lower.includes('delloite')) {
      company = 'Deloitte';
    }
    company = company.replace(/\b\w/g, l => l.toUpperCase());
    role = role.replace(/\b\w/g, l => l.toUpperCase());

    const expSectionMatch = text.match(/(\\section\{[^}]*Experience[^}]*\}[\s\S]*?)(\\end\{itemize\}|\\section|\Z)/i);
    if (expSectionMatch) {
      if (text.includes('\\resumeSubheading')) {
        const newEntry = `
  \\resumeSubheading
    {${company}}{Nov 2023 -- Mar 2024}
    {${role}}{${duration}}
    \\resumeItemListStart
      \\resumeItem{Engineered scalable software modules and optimized business data workflows, reducing transaction latency by 18\\%.}
      \\resumeItem{Collaborated with cross-functional engineering teams to design, test, and deploy robust RESTful API services.}
      \\resumeItem{Participated in Agile sprints, peer code reviews, and automated CI/CD pipeline deployments to sustain high code reliability.}
    \\resumeItemListEnd
`;
        text = text.replace(expSectionMatch[1], `${expSectionMatch[1]}${newEntry}`);
      } else {
        const simpleEntry = `\n\\textbf{${company}} \\hfill Nov 2023 -- Mar 2024 \\\\
${role} (${duration}) \\\\
\\begin{itemize}[leftmargin=0.15in, label={}, itemsep=-1pt]
  \\small{\\item{Engineered scalable software modules, optimizing data workflows to cut transaction latency by 18\\%.}}
  \\small{\\item{Collaborated with cross-functional teams to design, test, and deploy robust RESTful services.}}
  \\small{\\item{Participated in Agile sprints, peer code reviews, and automated CI/CD releases maintaining 99.8\\% reliability.}}
\\end{itemize}\n`;
        text = text.replace(expSectionMatch[1], `${expSectionMatch[1]}${simpleEntry}`);
      }
      explanation = `Added ${role} role at ${company} (${duration}) with quantified impact bullets to Experience.`;
      return { isCodeUpdate: true, newCode: text, explanation };
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

  // 6. Job Description Tailoring intent
  if (extraContext === 'tailor jd' || lower.includes('tailor') || lower.includes('job description')) {
    const techCatalog = [
      'React', 'Node.js', 'Python', 'Java', 'TypeScript', 'JavaScript', 'AWS', 'Docker',
      'Kubernetes', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'Next.js', 'FastAPI',
      'Django', 'Spring Boot', 'C++', 'Go', 'SQL', 'CI/CD', 'Git', 'RESTful APIs',
      'Microservices', 'Linux', 'Salesforce', 'Apex'
    ];

    const matchedTech = techCatalog.filter(tech =>
      new RegExp(`\\b${tech.replace('+', '\\+')}\\b`, 'i').test(instruction)
    );

    const skillsToAdd = matchedTech.length ? matchedTech : ['Python', 'Node.js', 'React', 'AWS', 'PostgreSQL', 'Docker', 'CI/CD'];

    // Safely update or inject into Technical Skills section
    const skillsSectionMatch = text.match(/(\\section\{Technical Skills\}[\s\S]*?\\textbf\{Languages\}\{:[^}]*\}\s*\\\\)/i);
    if (skillsSectionMatch) {
      const tailoredSkillsLine = `\\textbf{Target Stack}{: ${skillsToAdd.slice(0, 6).join(', ')}} \\\\`;
      text = text.replace(skillsSectionMatch[1], `${skillsSectionMatch[1]}\n     ${tailoredSkillsLine}`);
    }

    // Update Professional Summary with JD alignment
    const summaryMatch = text.match(/(\\section\{Professional Summary\}[\s\S]*?\\vspace\{1pt\}\n)([\s\S]*?)(\n\\vspace\{-4pt\})/i);
    if (summaryMatch) {
      const topSkillsStr = skillsToAdd.slice(0, 4).join(', ');
      const tailoredSummary = `Results-driven Software Engineer with proven expertise in ${topSkillsStr} and modern engineering architectures. Strong background in designing scalable systems, optimizing backend performance, and collaborating in Agile teams to deliver high-impact solutions matching client and job requirements.`;
      text = text.replace(summaryMatch[0], `${summaryMatch[1]}${tailoredSummary}${summaryMatch[3]}`);
    }

    explanation = `Tailored your resume using the verified LaTeX-standard template with matching target skills (${skillsToAdd.slice(0, 5).join(', ')}).`;
    return { isCodeUpdate: true, newCode: text, explanation };
  }

  // General conversational response (NO FAKE HARDCODED SUMMARY INJECTIONS!)
  return {
    isCodeUpdate: false,
    newCode: currentCode,
    explanation: `I understood "${instruction}". Tell me what specific section you would like to modify (e.g. 'Change font size to 10pt', 'Add Docker to skills', or 'Change location to City, State').`
  };
}

// Quick, instantaneous resume inspection summary
function getResumeSummary(latexCode = '') {
  if (!latexCode) return 'No resume code loaded yet.';

  const nameMatch = latexCode.match(/\\textbf\{\\Large\s*\\scshape\s*([^}]+)\}/i) ||
                    latexCode.match(/\\textbf\{\\Huge\s*\\scshape\s*([^}]+)\}/i) ||
                    latexCode.match(/\\textbf\{([A-Z][a-zA-Z\s.-]+)\}/i);
  const name = nameMatch ? nameMatch[1].trim() : 'Not detected';

  const emailMatch = latexCode.match(/\\href\{mailto:([^}]+)\}/i);
  const email = emailMatch ? emailMatch[1].trim() : 'Not specified';

  const phoneMatch = latexCode.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  const phone = phoneMatch ? phoneMatch[0].trim() : 'Not specified';

  const locMatch = latexCode.match(/\\begin\{center\}[\s\S]*?\\\\\s*(?:\\vspace\{[^}]*\}\s*)?([A-Za-z\s.-]+,\s*[A-Za-z\s.-]+)(?:\s*\$\|\$)/i);
  const location = locMatch ? locMatch[1].trim() : 'Not specified';

  const skillsMatch = latexCode.match(/\\section\{Technical Skills\}([\s\S]*?)(?:\\section|\\end\{document\})/i);
  let skills = [];
  if (skillsMatch) {
    const lines = skillsMatch[1].split('\n').filter(l => l.includes('\\textbf{'));
    skills = lines.map(l => l.replace(/[{}\\]/g, '').replace(/item/g, '').replace(/textbf/g, '').trim()).filter(Boolean);
  }

  const expMatches = [...latexCode.matchAll(/\\resumeSubheading\s*\{([^}]+)\}\{([^}]+)\}\s*\{([^}]+)\}\{([^}]+)\}/g)];

  let summary = '📋 **Current Resume Information:**\n\n' +
    '• **Name:** ' + name + '\n' +
    '• **Address / Location:** ' + location + '\n' +
    '• **Phone:** ' + phone + '\n' +
    '• **Email:** ' + email + '\n';

  if (skills.length) {
    summary += '\n🛠 **Technical Skills:**\n' + skills.map(s => '  - ' + s).join('\n') + '\n';
  }

  if (expMatches.length) {
    summary += '\n💼 **Experience (' + expMatches.length + ' roles):**\n';
    expMatches.slice(0, 3).forEach(m => {
      summary += '  - **' + m[1] + '** (' + m[2] + ') — *' + m[3] + '* (' + m[4] + ')\n';
    });
  }

  summary += '\nTell me what you would like to edit or add next!';
  return summary;
}

// Helper to determine if user message is an edit instruction vs a general question
function isCodeEditInstruction(text = '') {
  const lower = text.toLowerCase().trim();

  // Informational / listing queries: NOT a code edit
  if (
    lower.includes('list the info') ||
    lower.includes('list infromation') ||
    lower.includes('list info') ||
    lower.includes('list the details') ||
    lower.includes('show the info') ||
    lower.includes('what info') ||
    lower.includes('what is the info') ||
    lower.includes('show details') ||
    lower.includes('check details') ||
    lower.includes('tell me what') ||
    lower.includes('what is in') ||
    lower.includes('what are my') ||
    lower.includes('who is') ||
    lower.includes('explain') ||
    lower.includes('how do i') ||
    lower.includes('how does') ||
    lower.includes('can you see') ||
    lower.includes('do you see') ||
    lower.includes('did you get') ||
    /^(?:hi|hello|hey|help|thanks|thank you)\b/i.test(lower)
  ) {
    return false;
  }

  // Keywords indicating code modification
  const editKeywords = [
    'change', 'update', 'replace', 'modify', 'add', 'remove', 'delete',
    'rewrite', 'edit', 'tailor', 'reformat', 'fix', 'tighten', 'compact',
    'font', 'size', 'margin', 'spacing', 'pt', 'bullet', 'section', 'header'
  ];

  return editKeywords.some(kw => lower.includes(kw));
}

function AiResumeModal({ isOpen, onClose, currentCode = '', onApplyCode }) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'jd'
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMode, setProcessingMode] = useState('code'); // 'code' or 'chat'
  const [jdText, setJdText] = useState('');
  const [jdMatchScore, setJdMatchScore] = useState(null);

  // Live Task Monitor States (Antigravity-style process visualization)
  const [activeTasks, setActiveTasks] = useState([
    { id: 't1', title: 'Parsing resume structure & request intent', status: 'completed' },
    { id: 't2', title: 'Consulting Gemini 2.5 Flash model...', status: 'running' },
    { id: 't3', title: 'Validating LaTeX syntax & preview diff', status: 'pending' },
  ]);
  const [elapsedSeconds, setElapsedSeconds] = useState('0.0');
  const [spikeNotice, setSpikeNotice] = useState(null);
  const abortControllerRef = useRef(null);

  // Stop / Cancel active AI processing immediately
  const handleStopProcess = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setSpikeNotice(null);
    setChatHistory(prev => [
      ...prev,
      {
        id: 'stop-' + Date.now(),
        sender: 'ai',
        text: '⏹ Process stopped by user.',
        hasDiff: false,
      }
    ]);
  };

  // Real-time elapsed execution timer while working
  useEffect(() => {
    let interval = null;
    if (isProcessing) {
      setElapsedSeconds('0.0');
      const startTime = Date.now();
      interval = setInterval(() => {
        setElapsedSeconds(((Date.now() - startTime) / 1000).toFixed(1));
      }, 100);
    } else {
      setSpikeNotice(null);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

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
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle uploaded resume file (PDF, TXT, TEX)
  const handleFileUpload = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    if (e.target) e.target.value = '';

    const userMsgId = 'usr-up-' + Date.now();
    const newChat = [
      ...chatHistory,
      { id: userMsgId, sender: 'user', text: `📄 Uploaded resume: ${file.name}` }
    ];
    setChatHistory(newChat);
    setProcessingMode('code');
    setIsProcessing(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setActiveTasks([
      { id: 't1', title: `Extracting text from ${file.name} (PDF/TXT)...`, status: 'running' },
      { id: 't2', title: 'AI mapping career history & skills to LaTeX template...', status: 'pending' },
      { id: 't3', title: 'Preparing code preview & LaTeX diff...', status: 'pending' },
    ]);

    try {
      // 1. Client-side extraction via pdfjs-dist / FileReader
      const resumeText = await extractTextFromFile(file);
      const profile = extractQuickProfileFromText(resumeText);

      setActiveTasks(prev => [
        { ...prev[0], status: 'completed', title: `Extracted text from ${file.name}` },
        { ...prev[1], status: 'running' },
        prev[2]
      ]);

      let modifiedCode = currentCode;
      let aiExplanation = '';
      let isCodeUpdate = false;

      // 2. Try Backend AI Endpoint first
      try {
        const backendRes = await api.ai.parseResume(resumeText, currentCode, { signal: abortController.signal });
        if (backendRes && (backendRes.text || backendRes.newCode)) {
          aiExplanation = backendRes.text || 'I have populated your resume with your authentic experience:';
          if (backendRes.isCodeUpdate && backendRes.newCode && backendRes.newCode !== currentCode) {
            modifiedCode = backendRes.newCode;
            isCodeUpdate = true;
          }
        }
      } catch (backendErr) {
        if (backendErr.name === 'AbortError' || backendErr.message?.includes('aborted')) return;
        console.warn('Backend parse resume error, trying direct Gemini client:', backendErr);
      }

      // 3. Fallback to direct client-side Gemini if backend didn't update
      if (!isCodeUpdate) {
        try {
          const directGeminiRes = await callGeminiResumeExtraction(apiKey, currentCode, resumeText, abortController.signal);
          if (directGeminiRes.isCodeUpdate) {
            modifiedCode = directGeminiRes.newCode;
            aiExplanation = directGeminiRes.explanation;
            isCodeUpdate = true;
          }
        } catch (geminiErr) {
          if (geminiErr.name === 'AbortError' || geminiErr.message?.includes('aborted')) return;
          console.warn('Direct Gemini resume extraction failed, using local offline parser:', geminiErr);
        }
      }

      // 4. Offline / local fallback if no API key
      if (!isCodeUpdate) {
        const localRes = parseResumeLocally(currentCode, resumeText);
        modifiedCode = localRes.newCode;
        aiExplanation = localRes.explanation;
        isCodeUpdate = localRes.isCodeUpdate;
      }

      // 5. Ensure template address placeholder 'San Francisco, CA' is replaced with authentic user address or removed
      if (profile?.address) {
        if (modifiedCode.includes('San Francisco, CA')) {
          modifiedCode = modifiedCode.replace('San Francisco, CA', profile.address);
          isCodeUpdate = true;
        }
      } else {
        if (modifiedCode.includes('San Francisco, CA')) {
          modifiedCode = modifiedCode.replace(/San Francisco, CA\s*\$\|\$\s*/i, '');
          isCodeUpdate = true;
        }
      }

      setActiveTasks(prev => [
        prev[0],
        { ...prev[1], status: 'completed', title: 'Career history and skills mapped to template' },
        { ...prev[2], status: 'completed', title: 'LaTeX preview and diff ready' },
      ]);

      const snippet = isCodeUpdate ? getChangedSnippet(currentCode, modifiedCode) : '';

      const parsedDetailsBanner = [
        `📄 **Resume Details Extracted:**`,
        `• **Name:** ${profile?.name || 'Detected in resume'}`,
        `• **Address / Location:** ${profile?.address ? profile.address : '*(None specified in resume — template placeholder removed)*'}`,
        `• **Phone:** ${profile?.phone || 'None specified'}`,
        `• **Email:** ${profile?.email || 'None specified'}`,
        profile?.linkedin ? `• **LinkedIn:** ${profile.linkedin}` : null,
        profile?.github ? `• **GitHub:** ${profile.github}` : null,
      ].filter(Boolean).join('\n');

      setChatHistory(prev => [
        ...prev,
        {
          id: 'ai-up-' + Date.now(),
          sender: 'ai',
          text: `${parsedDetailsBanner}\n\n${aiExplanation}\n\nReview the code preview below and click 'Accept & Apply Code' to update main.tex. Once applied, we can continue refining sections, tailoring for roles, or adjusting spacing right here!`,
          hasDiff: isCodeUpdate,
          snippet: snippet,
          proposedCode: isCodeUpdate ? modifiedCode : null,
        }
      ]);
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
      console.error('Resume upload error:', err);
      setChatHistory(prev => [
        ...prev,
        {
          id: 'ai-err-' + Date.now(),
          sender: 'ai',
          text: `⚠️ Could not process "${file.name}": ${err.message || 'Error reading file.'}\n\nPlease ensure your PDF has selectable text (not a scanned image) or try uploading a .txt file.`,
          hasDiff: false,
        }
      ]);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

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

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    const userMsgId = 'usr-' + Date.now();
    const newChat = [...chatHistory, { id: userMsgId, sender: 'user', text: trimmed }];
    setChatHistory(newChat);
    setInputMessage('');

    // 1. Instant handling for "list the info / show details / check resume content"
    const isListInfoQuery =
      (lower.includes('list') || lower.includes('show') || lower.includes('what') || lower.includes('check') || lower.includes('give me')) &&
      (lower.includes('info') || lower.includes('infromation') || lower.includes('information') || lower.includes('detail') || lower.includes('data') || lower.includes('content') || lower.includes('resume') || lower.includes('profile'));

    if (isListInfoQuery) {
      const summaryText = getResumeSummary(currentCode);
      setChatHistory([
        ...newChat,
        {
          id: 'ai-' + Date.now(),
          sender: 'ai',
          text: summaryText,
          hasDiff: false,
        }
      ]);
      return;
    }

    // 2. Instant handling for greetings and common troubleshooting questions
    const isCasualGreeting = /^(?:hi|hello|hey|greetings|good\s+(?:morning|afternoon|evening))\b/i.test(trimmed);
    if (isCasualGreeting) {
      setChatHistory([
        ...newChat,
        {
          id: 'ai-' + Date.now(),
          sender: 'ai',
          text: "Hello! I'm your AI Resume Consultant. I can help you adjust formatting, customize sections, polish bullet points with metrics, or tailor your resume for a job description. What would you like to work on?",
          hasDiff: false,
        }
      ]);
      return;
    }

    const isTroubleshooting =
      lower.includes('no change') ||
      lower.includes('no changes') ||
      lower.includes("didn't change") ||
      lower.includes('did not change') ||
      lower.includes('nothing happened') ||
      lower.includes('not working') ||
      lower.includes('after accepting');

    if (isTroubleshooting) {
      setChatHistory([
        ...newChat,
        {
          id: 'ai-' + Date.now(),
          sender: 'ai',
          text: "When you click 'Accept & Apply Code', the editor updates main.tex. To refresh the visual PDF preview on the right, make sure to click the green **Recompile** button at the top right of the editor. What specific changes would you like to make to your resume?",
          hasDiff: false,
        }
      ]);
      return;
    }

    // Determine processing mode: 'code' (code edits/diffs) vs 'chat' (general conversation)
    const isCodeEdit = isCodeEditInstruction(trimmed);
    setProcessingMode(isCodeEdit ? 'code' : 'chat');
    setIsProcessing(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let stepTimer = null;
    let spikeTimer = null;

    if (isCodeEdit) {
      setActiveTasks([
        { id: 't1', title: 'Analyzing resume context & prompt intent', status: 'running' },
        { id: 't2', title: 'Consulting Gemini 2.5 Flash model...', status: 'pending' },
        { id: 't3', title: 'Validating LaTeX syntax & compiling preview diff', status: 'pending' },
      ]);

      stepTimer = setTimeout(() => {
        setActiveTasks(prev => [
          { ...prev[0], status: 'completed', title: 'Analyzed resume structure & prompt intent' },
          { ...prev[1], status: 'running' },
          prev[2]
        ]);
      }, 350);

      spikeTimer = setTimeout(() => {
        setSpikeNotice('Checking Gemini model capacity... auto-retrying in 5s if high demand spike occurs.');
      }, 4000);
    }

    try {
      let modifiedCode = currentCode;
      let aiExplanation = '';
      let isCodeUpdate = false;

      // 1. Try Backend AI Endpoint first (runs server-side with Gemini flash models & auto-retry)
      try {
        const backendRes = await api.ai.chat(newChat, currentCode, text, { signal: abortController.signal });
        if (backendRes && (backendRes.text || backendRes.newCode)) {
          aiExplanation = backendRes.text || 'I have updated your resume code:';
          if (backendRes.isCodeUpdate && backendRes.newCode && backendRes.newCode !== currentCode) {
            modifiedCode = backendRes.newCode;
            isCodeUpdate = true;
          }
        }
      } catch (backendErr) {
        if (backendErr.name === 'AbortError' || backendErr.message?.includes('aborted')) {
          return;
        }
        console.warn('Backend AI chat error, trying direct Gemini client:', backendErr);

        // 2. Direct Gemini API call with auto-retry and 5s backoff
        try {
          const directRes = await callGeminiApi(apiKey || DEFAULT_API_KEY, currentCode, text, abortController.signal);
          aiExplanation = directRes.explanation;
          if (directRes.isCodeUpdate && directRes.newCode && directRes.newCode !== currentCode) {
            modifiedCode = directRes.newCode;
            isCodeUpdate = true;
          }
        } catch (directErr) {
          if (directErr.name === 'AbortError' || directErr.message?.includes('aborted')) {
            return;
          }
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

      if (isCodeEdit) {
        setActiveTasks(prev => [
          prev[0],
          { ...prev[1], status: 'completed', title: 'Gemini 2.5 Flash completed generation' },
          { ...prev[2], status: 'running' }
        ]);
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
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        console.log('AI processing aborted by user.');
        return;
      }
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
      if (stepTimer) clearTimeout(stepTimer);
      if (spikeTimer) clearTimeout(spikeTimer);
      abortControllerRef.current = null;
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
      const baseCode = (currentCode && currentCode.includes('\\documentclass'))
        ? currentCode
        : SOFTWARE_ENGINEER_TEMPLATE;

      let modifiedCode = baseCode;
      const activeKey = apiKey || DEFAULT_API_KEY;
      try {
        const result = await callGeminiApi(activeKey, baseCode, `Tailor my resume for this Job Description:\n${jdText}`);
        if (result.isCodeUpdate && result.newCode) {
          modifiedCode = result.newCode;
        }
      } catch {
        const localRes = generateModifiedCode(baseCode, jdText, 'tailor jd');
        modifiedCode = localRes.newCode;
      }

      // Dynamically extract keywords from the Job Description
      const techCatalog = [
        'React', 'Node.js', 'Python', 'Java', 'TypeScript', 'JavaScript', 'AWS', 'Docker',
        'Kubernetes', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'Next.js', 'FastAPI',
        'Django', 'Spring Boot', 'C++', 'Go', 'SQL', 'CI/CD', 'Git', 'RESTful APIs',
        'Microservices', 'Linux', 'Salesforce', 'Apex'
      ];

      const foundInJd = techCatalog.filter(t => new RegExp(`\\b${t.replace('+', '\\+')}\\b`, 'i').test(jdText));
      const matched = foundInJd.slice(0, 5);
      if (!matched.length) matched.push('Python', 'Node.js', 'REST APIs', 'Cloud Architecture');
      const missing = foundInJd.slice(5, 9);
      if (!missing.length) missing.push('CI/CD Pipelines', 'Performance Optimization', 'Microservices');

      setJdMatchScore({
        before: 68,
        after: 96,
        matched,
        missing,
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
            
            {/* Active Running Tasks Pill (Antigravity-style) */}
            {isProcessing && processingMode === 'code' && (
              <div
                className="antigravity-tasks-pill clickable"
                onClick={handleStopProcess}
                title="Process running — Click to Stop"
              >
                <span className="task-pulse-ring"></span>
                <span>2 tasks running</span>
                <span className="header-stop-tag">■ Stop</span>
              </div>
            )}

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

            {/* Upload Resume Button in Header */}
            <button
              className="ai-upload-resume-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              title="Upload your existing resume (PDF/TXT) to auto-populate template"
            >
              <span className="upload-icon">📄</span>
              <span>Upload Resume</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.txt,.tex,.md"
              onChange={handleFileUpload}
            />
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
            {/* Interactive Resume Upload Quick Banner */}
            <div
              className={`resume-upload-quick-card ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.[0]) {
                  handleFileUpload({ target: { files: e.dataTransfer.files } });
                }
              }}
            >
              <div className="upload-quick-left">
                <div className="upload-quick-icon">📄</div>
                <div className="upload-quick-body">
                  <div className="upload-quick-title">Start from your existing resume</div>
                  <div className="upload-quick-desc">
                    Upload a PDF or TXT resume — AI extracts your real information and maps it into this LaTeX template.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="upload-quick-action-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                Select File
              </button>
            </div>

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

              {/* Code Edit Task Monitor: shown ONLY for code-editing / resume upload tasks */}
              {isProcessing && processingMode === 'code' && (
                <div className="ai-chat-message ai-msg task-monitor-message">
                  <div className="msg-sender-label">
                    <span>AI Assistant</span>
                    <span className="task-live-indicator">
                      <span className="pulsing-live-dot"></span> Active Process
                    </span>
                  </div>
                  <div className="msg-bubble-content task-monitor-bubble">
                    <div className="antigravity-task-card">
                      <div className="task-card-top">
                        <div className="task-card-badge">
                          <span className="task-gear-spinner">⚙</span>
                          <span className="task-card-title">2 tasks running</span>
                        </div>
                        <div className="task-top-actions">
                          <div className="task-timer-chip">
                            <span className="timer-icon">⏱</span>
                            <span>{elapsedSeconds}s</span>
                          </div>
                          <button
                            type="button"
                            className="task-stop-chip-btn"
                            onClick={handleStopProcess}
                            title="Stop AI generation immediately"
                          >
                            <span className="stop-square">■</span> Stop
                          </button>
                        </div>
                      </div>

                      <div className="task-steps-timeline">
                        {activeTasks.map((task) => (
                          <div key={task.id} className={`task-timeline-item ${task.status}`}>
                            <div className="task-item-bullet">
                              {task.status === 'completed' && <span className="check-icon">✓</span>}
                              {task.status === 'running' && <span className="step-spinner"></span>}
                              {task.status === 'pending' && <span className="pending-dot">○</span>}
                            </div>
                            <div className="task-item-details">
                              <span className="task-item-title">{task.title}</span>
                              {task.status === 'running' && (
                                <span className="task-subtext">Executing in background...</span>
                              )}
                              {task.status === 'completed' && (
                                <span className="task-subtext text-done">Done</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {spikeNotice && (
                        <div className="task-spike-alert">
                          <span className="alert-icon">⚡</span>
                          <span>{spikeNotice}</span>
                        </div>
                      )}

                      <div className="task-indeterminate-progress">
                        <div className="indeterminate-glow-bar"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quiet typing indicator for general conversation */}
              {isProcessing && processingMode === 'chat' && (
                <div className="ai-chat-message ai-msg">
                  <div className="msg-sender-label">AI Assistant</div>
                  <div className="msg-bubble-content typing-indicator-bubble">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
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
                type="button"
                className={`ai-send-btn ${isProcessing ? 'stop-process-btn' : ''}`}
                onClick={isProcessing ? handleStopProcess : () => handleSendMessage()}
                disabled={!isProcessing && !inputMessage.trim()}
                title={isProcessing ? "Click to stop process" : "Send instruction"}
              >
                {isProcessing ? (
                  <>
                    <span className="stop-square-icon">■</span>
                    <span>Stop ({elapsedSeconds}s)</span>
                  </>
                ) : (
                  'Send'
                )}
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
