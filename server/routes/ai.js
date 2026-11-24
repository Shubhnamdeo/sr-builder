import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import express from 'express';
import { DEFAULT_RESUME_LATEX } from '../templates/defaultResume.js';

const router = express.Router();

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

// Utility: sleep for ms
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Reusable Gemini Model Cascade with 5-second backoff on high demand
async function callGeminiModels(systemPrompt, apiKey, maxTokens = 8192, temperature = 0.3) {
  const payload = {
    contents: [{ parts: [{ text: systemPrompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  const candidateModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemma-4-26b-a4b-it',
  ];

  let rawText = '';
  let usedModel = '';
  const maxRetriesPerModel = 2;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = await response.json();
          const parts = data.candidates?.[0]?.content?.parts || [];
          rawText = parts.map(p => p.text || '').join('');
          if (rawText) {
            usedModel = model;
            break;
          }
        }

        if (response.status === 503 || response.status === 429) {
          console.log(`[AI] ${model} returned ${response.status} (high demand/spike). Waiting 5 seconds before retry...`);
          if (attempt < maxRetriesPerModel) {
            await sleep(5000);
            continue;
          }
        }

        if (response.status === 404) {
          break;
        }
      } catch (err) {
        console.warn(`[AI] Model ${model} attempt ${attempt} error:`, err.message);
        if (attempt < maxRetriesPerModel) {
          await sleep(5000);
        }
      }
    }

    if (rawText) break;
  }

  return { rawText, usedModel };
}

// Conversational AI Resume Assistant Endpoint
router.post('/chat', async (req, res) => {
  try {
    const { messages = [], currentCode = '', userInstruction = '' } = req.body;
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API key is not configured on the server.',
      });
    }

    // Format chat history for context
    const conversationHistory = messages
      .slice(-6)
      .map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text || ''}`)
      .join('\n');

    const latestPrompt = userInstruction || (messages.length ? messages[messages.length - 1].text : '');
    const activeBaseCode = (currentCode && currentCode.includes('\\documentclass')) 
      ? currentCode 
      : DEFAULT_RESUME_LATEX;

    const systemPrompt = `You are an expert AI Resume Consultant, Career Advisor, and LaTeX Engineer for "SR Builder".
You are collaborating with a user on their LaTeX resume.

CURRENT RESUME LATEX CODE:
\`\`\`latex
${activeBaseCode}
\`\`\`

RECENT CONVERSATION HISTORY:
${conversationHistory}

LATEST USER MESSAGE:
"${latestPrompt}"

YOUR BEHAVIOR GUIDELINES:
1. Act like a thoughtful, supportive, human career consultant—NOT a rigid bot. Converse warmly, clearly, and intelligently.
2. DISCUSSIONS, QUESTIONS & TROUBLESHOOTING:
   - If the user asks a question, gives feedback, or wants advice:
     ANSWER DIRECTLY IN NATURAL, HELPFUL ENGLISH.
     DO NOT output any LaTeX code block if the user is just asking a question, discussing ideas, or troubleshooting!
   - If the user says "no changes after accepting", "didn't change", or similar troubleshooting feedback:
     Explain warmly: "When you click 'Accept & Apply Code', the editor updates main.tex. To update the visual PDF preview on the right, please click the green 'Recompile' button at the top right of the editor. What specific changes would you like to make to your resume?"
3. CONCRETE RESUME CODE MODIFICATIONS & JOB DESCRIPTION TAILORING:
   - When the user asks to modify, format, add, or rewrite something in their resume, or tailor from a Job Description:
     1. Briefly explain what you updated in 1 friendly conversational sentence.
     2. MUST PRESERVE the exact Overleaf / Jake's Resume LaTeX structure and custom macros: \\resumeSubheading, \\resumeProjectHeading, \\resumeItem, \\resumeSubHeadingListStart, \\resumeSubHeadingListEnd. Never delete or alter these core macro definitions.
     3. Output the COMPLETE updated LaTeX document inside a single \`\`\`latex ... \`\`\` code block.
     4. For any new job or experience, create a clean entry with company name, job title, duration, and 2-3 strong, quantifiable bullet points formatted with standard LaTeX list tags.
     5. Support multi-page resumes (1 page, 2 pages, and up to 5 pages) based on content depth. When the user adds extensive experience, projects, certifications, or detailed bullets, let the resume expand naturally into 2, 3, 4, or up to 5 pages. Do not arbitrarily compress or drop details to force a single page unless the user explicitly requests a 1-page compact layout. You may insert \\newpage between major sections when appropriate for clean page transitions.
     6. Make sure the LaTeX code compiles cleanly with valid syntax and no missing brackets or broken packages.
     7. Never invent fake personal contact details.`;

    const { rawText, usedModel } = await callGeminiModels(systemPrompt, apiKey, 8192, 0.3);

    if (!rawText) {
      return res.status(502).json({ error: 'Failed to generate response from AI models.' });
    }

    // Check if response contains a LaTeX code update
    const codeBlockMatch = rawText.match(/```latex\s*([\s\S]*?)\s*```/i) || rawText.match(/```\s*([\s\S]*?)\s*```/i);
    let newCode = null;
    let isCodeUpdate = false;

    if (codeBlockMatch && codeBlockMatch[1].includes('\\documentclass')) {
      newCode = codeBlockMatch[1].trim();
      isCodeUpdate = newCode !== currentCode;
    }

    // Clean conversational explanation (strip out the raw code block so the chat looks clean and readable)
    const replyText = rawText
      .replace(/```latex[\s\S]*?```/gi, '')
      .replace(/```[\s\S]*?```/gi, '')
      .trim() || 'Updated your resume code according to your request.';

    res.json({
      text: replyText,
      isCodeUpdate,
      newCode: isCodeUpdate ? newCode : null,
      model: usedModel,
    });
  } catch (err) {
    console.error('AI chat endpoint error:', err);
    res.status(500).json({ error: 'Internal server error while processing AI request.' });
  }
});

// Inline "✨ AI Polish" Snippet Endpoint (Instant inline improvements from PDF SyncTeX)
router.post('/polish', async (req, res) => {
  try {
    const { snippet = '', instruction = 'Add strong metrics and make punchier', currentCode = '' } = req.body;
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }

    if (!snippet.trim()) {
      return res.status(400).json({ error: 'Snippet text is required.' });
    }

    const systemPrompt = `You are an elite Executive Resume Editor and FAANG Career Coach.
You are rewriting a single line or bullet point from a resume.

ORIGINAL SNIPPET:
"""
${snippet}
"""

REWRITE INSTRUCTION:
"${instruction}"

RULES:
1. Return ONLY the polished, impactful replacement sentence or bullet text.
2. Do NOT prefix with bullet characters (like -, *, •, or \\item). Just the clean sentence.
3. If the instruction asks for metrics, weave in realistic, impressive quantifiable impact (e.g. 'reduced latency by 35%', 'automated 15+ weekly reporting pipelines', 'serving 1,200+ active users').
4. If the instruction asks for punchier action verbs, start with strong verbs like 'Architected', 'Spearheaded', 'Engineered', 'Optimized', 'Streamlined'.
5. If the original text had LaTeX commands like \\textbf{...} or \\href{...}{...}, preserve appropriate LaTeX inline styling.
6. ABSOLUTELY NO MARKDOWN CODE BLOCKS (\`\`\`), NO CONVERSATIONAL FILLER, NO QUOTATION MARKS. Output ONLY the polished text string.`;

    const { rawText, usedModel } = await callGeminiModels(systemPrompt, apiKey, 512, 0.2);

    const cleanedText = rawText
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/\s*```$/, '')
      .replace(/^["']|["']$/g, '')
      .trim();

    res.json({
      originalSnippet: snippet,
      improvedSnippet: cleanedText || snippet,
      model: usedModel,
    });
  } catch (err) {
    console.error('AI polish snippet endpoint error:', err);
    res.status(500).json({ error: 'Failed to polish snippet.' });
  }
});

// Resume Upload & Extraction Endpoint
router.post('/parse-resume', async (req, res) => {
  try {
    const { resumeText = '', currentCode = '' } = req.body;
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API key is not configured on the server.',
      });
    }

    if (!resumeText.trim()) {
      return res.status(400).json({ error: 'Resume text is required.' });
    }

    const activeBaseCode = (currentCode && currentCode.includes('\\documentclass')) 
      ? currentCode 
      : DEFAULT_RESUME_LATEX;

    const systemPrompt = `You are an expert AI Resume Consultant, Career Advisor, and LaTeX Engineer for "SR Builder".
The user has uploaded their existing resume in plain text. Your job is to extract their authentic career details and transfer them into the active LaTeX resume template, completely replacing the placeholder template data.

--- USER'S UPLOADED RESUME TEXT ---
${resumeText}
--- END RESUME TEXT ---

CURRENT RESUME TEMPLATE (main.tex):
\`\`\`latex
${activeBaseCode}
\`\`\`

Strict Guidelines:
1. Extract authentic candidate information from the uploaded resume:
   - Full Name
   - Address / Location:
     * Search carefully for Address, City, State, Country, or Postal Location in the uploaded resume.
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

    const { rawText, usedModel } = await callGeminiModels(systemPrompt, apiKey, 8192, 0.2);

    if (!rawText) {
      return res.status(500).json({ error: 'Failed to extract resume with AI model.' });
    }

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

    res.json({
      isCodeUpdate,
      newCode: newCode || currentCode,
      text: explanation,
      model: usedModel,
    });
  } catch (err) {
    console.error('AI parse resume endpoint error:', err);
    res.status(500).json({ error: 'Failed to process resume upload.' });
  }
});

export default router;
