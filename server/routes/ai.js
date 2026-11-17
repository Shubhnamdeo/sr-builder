import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import express from 'express';

const router = express.Router();

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

// Utility: sleep for ms
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    const systemPrompt = `You are an expert AI Resume Consultant, Career Advisor, and LaTeX Engineer for "SR Builder".
You are collaborating with a user on their LaTeX resume.

CURRENT RESUME LATEX CODE:
\`\`\`latex
${currentCode}
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
3. CONCRETE RESUME CODE MODIFICATIONS:
   - When the user asks to modify, format, add, or rewrite something in their resume (such as:
     * Adding or changing work experience, jobs, or internships (e.g. 'add software developer at Deloitte with 5 months experience')
     * Adding skills, projects, certifications, or education
     * Changing font size, margins, spacing, or contact details):
     1. Briefly explain what you updated in 1 friendly conversational sentence.
     2. Output the COMPLETE updated LaTeX document inside a single \`\`\`latex ... \`\`\` code block.
     3. For any new job or experience, create a clean entry with company name, job title, duration, and 2-3 strong, quantifiable bullet points formatted with standard LaTeX list tags.
     4. Make sure the LaTeX code compiles cleanly with valid syntax and no missing brackets or broken packages.
     5. Never invent fake personal contact details.`;

    const payload = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    };

    // Candidates in order of speed, reliability, and capability
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

          // If high demand (503) or rate limit (429), wait 5 seconds before retrying as requested
          if (response.status === 503 || response.status === 429) {
            console.log(`[AI Chat] ${model} returned ${response.status} (high demand/spike). Waiting 5 seconds before retry...`);
            if (attempt < maxRetriesPerModel) {
              await sleep(5000);
              continue;
            }
          }

          // If 404 or unsupported, break inner loop to try next model immediately
          if (response.status === 404) {
            break;
          }
        } catch (err) {
          console.warn(`[AI Chat] Model ${model} attempt ${attempt} error:`, err.message);
          if (attempt < maxRetriesPerModel) {
            await sleep(5000);
          }
        }
      }

      if (rawText) break;
    }

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

export default router;
