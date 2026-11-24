import * as pdfjsLib from 'pdfjs-dist';

// Set up worker source for Vite / modern browser environments
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  // Fallback to CDN if worker resolution fails
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs';
}

/**
 * Extracts plain text content from an uploaded File (PDF or TXT/LaTeX)
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromFile(file) {
  if (!file) throw new Error('No file provided');

  const fileType = file.type || '';
  const fileName = file.name ? file.name.toLowerCase() : '';

  // Text, LaTeX, or Markdown file
  if (
    fileType.startsWith('text/') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.tex') ||
    fileName.endsWith('.md')
  ) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result || '');
      reader.onerror = () => reject(new Error('Failed to read text file.'));
      reader.readAsText(file);
    });
  }

  // PDF file
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      let lastY = null;
      let pageText = '';
      
      for (const item of textContent.items) {
        if (!item.str) continue;
        
        // Add newline if vertical position jumps significantly
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 6) {
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          pageText += ' ';
        }
        
        pageText += item.str;
        lastY = item.transform[5];
      }

      fullText += pageText + '\n\n';
    }

    const trimmed = fullText.trim();
    if (!trimmed || trimmed.length < 30) {
      throw new Error(
        'Could not extract text from this PDF. It may be a scanned document or image. Please upload a PDF with selectable text or a .txt file.'
      );
    }

    return trimmed;
  }

  throw new Error('Unsupported file type. Please upload a .pdf, .txt, or .tex file.');
}

/**
 * Quick heuristic parser to extract basic contact details from resume text
 * @param {string} text
 * @returns {object}
 */
export function extractQuickProfileFromText(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // Name is typically on line 0, 1, or 2
  let name = '';
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const line = lines[i];
    if (
      !line.includes('@') &&
      !line.toLowerCase().includes('http') &&
      !line.toLowerCase().includes('linkedin') &&
      !line.toLowerCase().includes('github') &&
      !line.match(/\d{3}[-.\s]?\d{3}/) &&
      line.length >= 2 &&
      line.length <= 40 &&
      /^[A-Za-z\s.-]+$/.test(line)
    ) {
      name = line;
      break;
    }
  }

  // Address / Location
  let address = '';
  const searchLines = lines.slice(0, 10);
  for (const line of searchLines) {
    const labelMatch = line.match(/(?:location|address|residence|residing in|city)\s*[:|-]\s*([^\n|•,]+(?:,[^\n|•]+)?)/i);
    if (labelMatch) {
      address = labelMatch[1].trim();
      break;
    }
  }

  if (!address) {
    for (const line of searchLines) {
      if (line.includes('@') || line.toLowerCase().includes('http') || line.toLowerCase().includes('linkedin') || line.toLowerCase().includes('github')) {
        const parts = line.split(/[|•·\/\t]/).map(p => p.trim());
        for (const part of parts) {
          if (!part.includes('@') && !part.toLowerCase().includes('http') && !part.match(/^\+?\d[\d\s().-]{7,}\d$/)) {
            if (/^[A-Za-z\s.-]+,\s*[A-Za-z\s.-]+(?:\s*\d{5,6})?$/.test(part) && part.length < 50 && part.length > 3) {
              address = part;
              break;
            }
          }
        }
        if (address) break;
        continue;
      }

      if (/^[A-Za-z\s.-]+,\s*[A-Za-z\s.-]+(?:\s*\d{5,6})?$/.test(line) && line.length < 50 && line.length > 4) {
        address = line;
        break;
      }
    }
  }

  // Email
  const emailMatch = text.match(/[\w.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/);
  const email = emailMatch ? emailMatch[0] : '';

  // Phone
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0] : '';

  // LinkedIn
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  const linkedin = linkedinMatch ? linkedinMatch[1] : '';

  // GitHub
  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
  const github = githubMatch ? githubMatch[1] : '';

  return { name, address, email, phone, linkedin, github, rawText: text };
}

/**
 * Local offline fallback to populate template with extracted resume details
 * @param {string} currentCode
 * @param {string} resumeText
 * @returns {{ isCodeUpdate: boolean, newCode: string, explanation: string, profile: object }}
 */
export function parseResumeLocally(currentCode, resumeText) {
  if (!currentCode || !resumeText) {
    return { isCodeUpdate: false, newCode: currentCode, explanation: 'Unable to parse resume details.', profile: null };
  }

  const profile = extractQuickProfileFromText(resumeText);
  let updatedCode = currentCode;
  const updates = [];

  // Update Name
  if (profile.name) {
    const headerNameMatch = updatedCode.match(/(\\begin\{center\}[\s\S]*?\\textbf\s*\{\s*(?:\\(?:Large|Huge|huge|LARGE)\s*)?(?:\\scshape\s*)?\{?)([A-Z][a-zA-Z\s.-]+?)(\}?\}\s*\\\\)/i) ||
                            updatedCode.match(/(\\textbf\s*\{\s*\\(?:Large|Huge|huge|LARGE)\s*\\scshape\s*\{?)([A-Z][a-zA-Z\s.-]+?)(\}?\}\s*\\\\)/i) ||
                            updatedCode.match(/(\\textbf\s*\{\s*\\scshape\s*\\(?:Large|Huge|huge|LARGE)\s*\{?)([A-Z][a-zA-Z\s.-]+?)(\}?\}\s*\\\\)/i);
    if (headerNameMatch) {
      updatedCode = updatedCode.replace(headerNameMatch[0], `${headerNameMatch[1]}${profile.name}${headerNameMatch[3]}`);
      updates.push(`Name: ${profile.name}`);
    }
  }

  // Update Address / Location (Sanitize placeholder address)
  if (profile.address) {
    if (updatedCode.includes('San Francisco, CA')) {
      updatedCode = updatedCode.replace('San Francisco, CA', profile.address);
      updates.push(`Address: ${profile.address}`);
    } else {
      const addrMatch = updatedCode.match(/(\\begin\{center\}[\s\S]*?\\textbf\{[^\}]+\}\s*\\\\\s*(?:\\vspace\{[^}]*\}\s*)?)([A-Za-z\s.-]+,\s*[A-Za-z\s.-]+)(\s*\$\|\$)/i);
      if (addrMatch) {
        updatedCode = updatedCode.replace(addrMatch[0], `${addrMatch[1]}${profile.address}${addrMatch[3]}`);
        updates.push(`Address: ${profile.address}`);
      }
    }
  } else {
    // If user's resume does not have an address, remove the template placeholder 'San Francisco, CA'
    updatedCode = updatedCode.replace(/San Francisco, CA\s*\$\|\$\s*/i, '');
  }

  // Update Email
  if (profile.email) {
    updatedCode = updatedCode.replace(
      /\\href\{mailto:[^}]+\}\{\\underline\{[^}]+\}\}/g,
      `\\href{mailto:${profile.email}}{\\underline{${profile.email}}}`
    );
    updates.push(`Email: ${profile.email}`);
  }

  // Update Phone
  if (profile.phone) {
    updatedCode = updatedCode.replace(
      /\\small\s*(\+?\d[\d\s().-]{7,}\d)/g,
      `\\small ${profile.phone}`
    );
    updatedCode = updatedCode.replace(
      /\+1\s*\(555\)\s*019-2834/g,
      profile.phone
    );
    updates.push(`Phone: ${profile.phone}`);
  }

  // Update LinkedIn
  if (profile.linkedin) {
    updatedCode = updatedCode.replace(
      /\\href\{https:\/\/linkedin\.com\/in\/[^}]+\}\{\\underline\{linkedin\.com\/in\/[^}]+\}\}/g,
      `\\href{https://linkedin.com/in/${profile.linkedin}}{\\underline{linkedin.com/in/${profile.linkedin}}}`
    );
    updates.push(`LinkedIn: ${profile.linkedin}`);
  }

  // Update GitHub
  if (profile.github) {
    updatedCode = updatedCode.replace(
      /\\href\{https:\/\/github\.com\/[^}]+\}\{\\underline\{github\.com\/[^}]+\}\}/g,
      `\\href{https://github.com/${profile.github}}{\\underline{github.com/${profile.github}}}`
    );
    updates.push(`GitHub: ${profile.github}`);
  }

  const isCodeUpdate = updatedCode !== currentCode;
  const explanation = isCodeUpdate
    ? `Extracted candidate details from your resume:\n• Name: ${profile.name || 'Not detected'}\n• Address / Location: ${profile.address || 'None specified'}\n• Phone: ${profile.phone || 'None specified'}\n• Email: ${profile.email || 'None specified'}\n• LinkedIn: ${profile.linkedin || 'None'}\n• GitHub: ${profile.github || 'None'}`
    : 'Extracted resume text. To automatically rewrite experience and projects into LaTeX, please configure your Gemini API Key in the top right.';

  return { isCodeUpdate, newCode: updatedCode, explanation, profile };
}

