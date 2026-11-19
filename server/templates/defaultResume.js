export const DEFAULT_RESUME_LATEX = `\\documentclass[letterpaper,10pt]{article}

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

% Page Margins
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

% Standard Overleaf / Jake's Resume Custom Commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.98\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.98\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

%----------HEADING-----------------
\\begin{center}
    \\textbf{\\Large \\scshape Alex Morgan} \\\\ \\vspace{2pt}
    San Francisco, CA $|$ +1 (555) 019-2834 $|$ \\href{mailto:alex.morgan@email.com}{\\underline{alex.morgan@email.com}} \\\\ \\vspace{2pt}
    \\href{https://linkedin.com/in/alexmorgan}{\\underline{linkedin.com/in/alexmorgan}} $|$
    \\href{https://github.com/alexmorgan}{\\underline{github.com/alexmorgan}} $|$
    \\href{https://alexmorgan.dev}{\\underline{alexmorgan.dev}}
\\end{center}

\\vspace{-8pt}

%-----------PROFESSIONAL SUMMARY-----------------
\\section{Professional Summary}
\\vspace{1pt}
Results-driven Software Engineer with 2+ years of experience designing and deploying scalable full-stack applications, microservices, and distributed cloud systems. Specialized in Python, Node.js, React, and cloud architectures. Demonstrated track record of optimizing database performance, reducing latency by 35\\%, and delivering reliable, automated CI/CD pipelines in fast-paced engineering teams.

\\vspace{-4pt}

%-----------EDUCATION-----------------
\\section{Education}
  \\resumeSubHeadingListStart
    \\resumeSubheading
      {University of California, Berkeley}{Berkeley, CA}
      {Bachelor of Science in Computer Science; GPA: 3.82/4.00}{Aug 2022 -- May 2026}
  \\resumeSubHeadingListEnd

\\vspace{-4pt}

%-----------TECHNICAL SKILLS-----------------
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}, itemsep=-1pt]
    \\small{\\item{
     \\textbf{Languages}{: Python, JavaScript, TypeScript, Java, C++, SQL, Go} \\\\
     \\textbf{Frameworks}{: React, Node.js, Express.js, Next.js, FastAPI, Django, Spring Boot} \\\\
     \\textbf{Cloud \\& DevOps}{: Amazon Web Services (AWS), Docker, Kubernetes, CI/CD Actions, Linux} \\\\
     \\textbf{Databases \\& Tools}{: PostgreSQL, MongoDB, Redis, GraphQL, Git, RESTful APIs, Postman}
    }}
 \\end{itemize}

\\vspace{-6pt}

%-----------EXPERIENCE-----------------
\\section{Experience}
  \\resumeSubHeadingListStart

    \\resumeSubheading
      {Full-Stack Software Engineer}{San Francisco, CA}
      {Nexus Cloud Solutions}{Jun 2025 -- Present}
      \\resumeItemListStart
        \\resumeItem{Architected and deployed high-throughput REST APIs using Node.js, Express, and PostgreSQL, serving 45,000+ daily active users with 99.95\\% uptime.}
        \\resumeItem{Engineered distributed caching layer with Redis, reducing average response latency by 38\\% and cutting database CPU load by 24\\%.}
        \\resumeItem{Collaborated with product designers to implement responsive React components with zero layout shift, accelerating customer onboarding by 18\\%.}
      \\resumeItemListEnd

    \\resumeSubheading
      {Software Engineering Intern}{Remote}
      {DataVantage Labs}{Jan 2025 -- May 2025}
      \\resumeItemListStart
        \\resumeItem{Developed automated data validation pipelines in Python, processing 1.2M+ records daily with comprehensive error tracing.}
        \\resumeItem{Containerized microservices using Docker and automated CI/CD test workflows with GitHub Actions, reducing deployment time from 40 mins to 6 mins.}
        \\resumeItem{Identified and resolved 25+ critical backend bugs during sprint QA cycles, writing 80+ unit tests with 92\\% branch coverage.}
      \\resumeItemListEnd

  \\resumeSubHeadingListEnd

\\vspace{-6pt}

%-----------PROJECTS-----------------
\\section{Key Projects}
    \\resumeSubHeadingListStart
      \\resumeProjectHeading
          {\\textbf{CloudScale Event Orchestrator} $|$ \\emph{React, Node.js, AWS Lambda, MongoDB}}{Jun 2025}
          \\resumeItemListStart
            \\resumeItem{Engineered serverless event dispatching application handling 10,000+ concurrent webhook subscriptions with automatic exponential backoff retry.}
            \\resumeItem{Implemented role-based access control (RBAC) and OAuth2 security protocols to protect tenant endpoints and audit logs.}
          \\resumeItemListEnd
      \\resumeProjectHeading
          {\\textbf{Algorithmic Portfolio Analyzer} $|$ \\emph{Python, FastAPI, Redis, Docker}}{Feb 2025}
          \\resumeItemListStart
            \\resumeItem{Built quantitative analysis web dashboard calculating risk metrics (Sharpe ratio, beta) across 500+ assets in under 350ms.}
            \\resumeItem{Packaged application into lightweight multi-stage Docker containers deployed seamlessly on AWS ECS.}
          \\resumeItemListEnd
    \\resumeSubHeadingListEnd

\\end{document}`;
