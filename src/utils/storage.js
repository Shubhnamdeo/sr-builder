export const MAX_RESUMES_PER_USER = 10;
const GLOBAL_STORAGE_KEY = 'resume_builder_projects';

export function getUserStorageKey(userEmail) {
  if (!userEmail) return GLOBAL_STORAGE_KEY;
  const clean = userEmail.trim().toLowerCase();
  if (clean === 'shubhnamdeo@gmail.com') return GLOBAL_STORAGE_KEY;
  return `resume_builder_projects_${clean.replace(/[^a-z0-9]/g, '_')}`;
}

export const SALESFORCE_RESUME_SHUBH = `\\documentclass[letterpaper,9pt]{article}

\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}

% Ultra-compact page margins to guarantee strict 1-page fit
\\addtolength{\\oddsidemargin}{-0.75in}
\\addtolength{\\evensidemargin}{-0.75in}
\\addtolength{\\textwidth}{1.5in}
\\addtolength{\\topmargin}{-0.85in}
\\addtolength{\\textheight}{1.7in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Section Header Formatting
\\titleformat{\\section}{
  \\vspace{-8pt}\\scshape\\raggedright\\small\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-4pt}]

\\begin{document}

%----------HEADER-----------------
\\begin{center}
    \\textbf{\\Large \\scshape Shubh Namdeo} \\\\ \\vspace{2pt}
    Mumbai, Maharashtra 400069 $|$ +91 7000312723 $|$ \\href{mailto:shubhnamdeo15@gmail.com}{\\underline{shubhnamdeo15@gmail.com}} \\\\ \\vspace{2pt}
    \\href{https://trailblazer.me/id/shubhnamdeo}{\\textbf{\\underline{Trailhead Profile}}} $|$
    \\href{https://linkedin.com/in/shubh-namdeo-8a9902186}{\\underline{LinkedIn}} $|$
    \\href{https://github.com/Shubhnamdeo}{\\underline{GitHub}}
\\end{center}

\\vspace{-8pt}

%-----------PROFESSIONAL SUMMARY-----------------
\\section{Professional Summary}
\\vspace{1pt}
B.Tech Computer Science graduate (2026) and dedicated Salesforce Trailblazer specializing in platform administration, declarative automation, and system troubleshooting. Recognized as a 100K Agentblazer Champion with 18 Trailhead Superbadges, demonstrating deep, hands-on expertise in Flow Builder, validation rules, data security, and Agentforce integrations. Proven ability to own root-cause analysis (RCA), manage complex data pipelines, and design lightweight Support Operating Procedures (SOPs) to ensure enterprise CRM health and operational readiness.

\\vspace{-4pt}

%-----------TRAILHEAD & CERTIFICATIONS-----------------
\\section{Certifications \\& Trailhead Achievements}
 \\begin{itemize}[leftmargin=0.15in, label={}, itemsep=-1pt]
    \\small{\\item{
     \\textbf{Achieved Certifications}{: \\textbf{Salesforce AI Agent Developer} $|$ Google Cloud Prompt Design in Vertex AI} \\\\
     \\textbf{Actively Pursuing}{: Salesforce Administrator (ADM-201), Platform App Builder, and Platform Developer I} \\\\
     \\textbf{Trailblazer Rank \\& Recognition}{: \\textbf{100K Agentblazer Champion (2025 \\& 2026)} -- Actively engaged in the Salesforce ecosystem, leveraging Agentforce and AI CRM capabilities.} \\\\
     \\textbf{Superbadges (18 Total)}{: Demonstrated advanced declarative and administrative competence through rigorous, hands-on scenarios covering Security Specialist, Process Automation Specialist, and App Customization.}
    }}
 \\end{itemize}

\\vspace{-6pt}

%-----------CORE COMPETENCIES & SKILLS-----------------
\\section{Technical \\& Platform Administration Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}, itemsep=-1pt]
    \\small{\\item{
     \\textbf{Salesforce Declarative}{: Flow Builder, Validation Rules, Field-Level Security (FLS), Role Hierarchy, Access Management} \\\\
     \\textbf{Coding \\& Analytics}{: Apex, Python, SQL, SOQL, CRM Analytics, Tableau concepts, Data 360 concepts} \\\\
     \\textbf{Incident \\& Support}{: Root-Cause Analysis (RCA), Agentforce, Escalation Management, SLA Tracking (FRT/ART)} \\\\
     \\textbf{Process Engineering}{: Standard Operating Procedures (SOPs), Incident Handoffs, Agile/SDLC, System Documentation}
    }}
 \\end{itemize}

\\vspace{-6pt}

%-----------PROFESSIONAL EXPERIENCE-----------------
\\section{Professional Experience}
  \\begin{itemize}[leftmargin=0.15in, label={}, itemsep=-1pt]
    \\item
      \\begin{tabular*}{0.98\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
        \\textbf{Salesforce AI Agent Developer Intern} --- \\textit{SmartBridge} & \\textit{Jun 2025 -- Jan 2026} \\\\
      \\end{tabular*}
      \\vspace{-4pt}
      \\begin{itemize}[itemsep=0pt, parsep=0pt]
        \\small\\item{Supported enterprise AI CRM platforms, configuring Agentforce and declarative automations (Flows) to resolve complex intake bottlenecks and reduce manual Tier-1 support efforts.}
        \\small\\item{Acted as a frontline responder for declarative and low-code integration issues, investigating recurring failures and documenting thorough root-cause analysis (RCA) for engineering teams.}
        \\small\\item{Contributed to operational readiness by designing proactive monitors and tracking escalation trends to ensure team lifecycle SLAs (First Response Time) were consistently met.}
      \\end{itemize}
    \\vspace{2pt}
    \\item
      \\begin{tabular*}{0.98\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
        \\textbf{Operations \\& Data Delivery Associate} $|$ \\textit{Learning Routes} & \\textit{Feb 2026 -- Sep 2026} \\\\
      \\end{tabular*}
      \\vspace{-4pt}
      \\begin{itemize}[itemsep=0pt, parsep=0pt]
        \\small\\item{Maintained enterprise CRM data pipelines, managing bulk data loads and executing data quality reconciliations to ensure reporting accuracy across geographically distributed teams.}
        \\small\\item{Documented system errors, access bottlenecks, and platform bugs, writing lightweight Support Reference Manuals (SRMs) to help non-technical users resolve issues without escalation.}
      \\end{itemize}
  \\end{itemize}

\\vspace{-6pt}

%-----------SYSTEMS & PLATFORM PROJECTS-----------------
\\section{Salesforce Administration Projects}
  \\begin{itemize}[leftmargin=0.15in, label={}, itemsep=-1pt]
    \\item
      \\begin{tabular*}{0.98\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
        \\textbf{Events Hub (Salesforce Enterprise Platform)} $|$ \\href{https://github.com/Shubhnamdeo}{\\underline{GitHub}} & \\textit{Flow Builder, FLS, Role Hierarchy} \\\\
      \\end{tabular*}
      \\vspace{-4pt}
      \\begin{itemize}[itemsep=0pt, parsep=0pt]
        \\small\\item{Administered a multi-tenant Salesforce environment for 500+ users, independently owning complex role hierarchies, permission sets, and Field-Level Security (FLS) to maintain strict access compliance.}
        \\small\\item{Delivered declarative solutions utilizing Flow Builder and validation rules to automate record creation, significantly reducing manual data entry errors during high-volume events.}
        \\small\\item{Maintained system security policies by configuring Single Sign-On (SSO) and performing regular sandbox environment management and data seeding.}
      \\end{itemize}
  \\end{itemize}

\\vspace{-6pt}

%-----------EDUCATION-----------------
\\section{Education}
  \\begin{itemize}[leftmargin=0.15in, label={}, itemsep=-2pt]
    \\item
      \\begin{tabular*}{0.98\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
        \\textbf{Gyan Ganga Institute of Technology \\& Sciences} & Jabalpur, India \\\\
        \\textit{B.Tech in Computer Science and Engineering} (CGPA: 7.39/10.0 -- No Backlogs) & \\textit{Graduation: May 2026} \\\\
      \\end{tabular*}
  \\end{itemize}

\\end{document}`;

export function createInitialUserResume(userEmail = 'user@example.com', userName = 'Candidate') {
  const cleanName = userName || userEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return {
    id: 'my-resume-' + Date.now().toString(36),
    title: `${cleanName}'s Resume`,
    owner: 'You',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    archived: false,
    trashed: false,
    content: SALESFORCE_RESUME_SHUBH.replace('Shubh Namdeo', cleanName).replace('shubhnamdeo15@gmail.com', userEmail),
  };
}

const INITIAL_PROJECTS = [
  {
    id: 's-resume',
    title: 'S- resume',
    owner: 'You',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    lastModified: new Date().toISOString(),
    archived: false,
    trashed: false,
    content: SALESFORCE_RESUME_SHUBH,
  },
  {
    id: 'jp-shubh',
    title: 'JP-SHUBH',
    owner: 'You',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    lastModified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    archived: false,
    trashed: false,
    content: `\\documentclass{article}
\\usepackage{graphicx}

\\title{JP-SHUBH}
\\author{Shubh Namdeo}
\\date{November 2026}

\\begin{document}

\\maketitle

\\section{Introduction}

\\end{document}`,
  },
  {
    id: 'namdeo-shubh-resume-nov-micro',
    title: 'Namdeo-shubh-resume-nov-micro',
    owner: 'You',
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    lastModified: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    archived: false,
    trashed: false,
    content: SALESFORCE_RESUME_SHUBH,
  },
  {
    id: 'namdeo-shubh-resume-22-10-26',
    title: 'Namdeo-shubh-resume-22-10-26',
    owner: 'You',
    createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    lastModified: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    archived: false,
    trashed: false,
    content: SALESFORCE_RESUME_SHUBH,
  },
];

export function loadProjects(userEmail = null) {
  const key = getUserStorageKey(userEmail);
  try {
    if (typeof localStorage === 'undefined') {
      return INITIAL_PROJECTS;
    }
    const data = localStorage.getItem(key);
    if (!data) {
      if (!userEmail || userEmail.toLowerCase() === 'shubhnamdeo@gmail.com') {
        localStorage.setItem(key, JSON.stringify(INITIAL_PROJECTS));
        return INITIAL_PROJECTS;
      }
      // New user registration gets 1 personalized starter resume
      const initial = [createInitialUserResume(userEmail)];
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load projects:', e);
    return [];
  }
}

export function saveProjects(projects, userEmail = null) {
  const key = getUserStorageKey(userEmail);
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects:', e);
  }
}

export function getProject(id, userEmail = null) {
  const projects = loadProjects(userEmail);
  const found = projects.find(p => p.id === id);
  if (found) return found;

  // Fallback to global projects if not found in current user's partitioned storage
  if (userEmail && userEmail !== 'shubhnamdeo@gmail.com') {
    const globalProjects = loadProjects('shubhnamdeo@gmail.com');
    return globalProjects.find(p => p.id === id) || null;
  }
  return null;
}

export function updateProject(id, updates, userEmail = null) {
  const projects = loadProjects(userEmail);
  const idx = projects.findIndex(p => p.id === id);
  if (idx !== -1) {
    projects[idx] = { ...projects[idx], ...updates, lastModified: new Date().toISOString() };
    saveProjects(projects, userEmail);
    return projects[idx];
  }
  return null;
}

export function deleteProject(id, userEmail = null) {
  const projects = loadProjects(userEmail).filter(p => p.id !== id);
  saveProjects(projects, userEmail);
}

export function createProject(title, content, userEmail = null) {
  const projects = loadProjects(userEmail);
  const activeCount = projects.filter(p => !p.trashed).length;

  if (activeCount >= MAX_RESUMES_PER_USER) {
    throw new Error(`Cloud storage limit reached (${activeCount}/${MAX_RESUMES_PER_USER} resumes). Please delete or trash an older resume to create a new one.`);
  }

  const project = {
    id: generateId(),
    title,
    owner: 'You',
    content,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    archived: false,
    trashed: false,
  };
  projects.unshift(project);
  saveProjects(projects, userEmail);
  return project;
}

function generateId() {
  return 'proj-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}
