export const BLANK_TEMPLATE = `\\documentclass{article}
\\usepackage{graphicx} % Required for inserting images

\\title{Untitled Project}
\\author{Your Name}
\\date{${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}}

\\begin{document}

\\maketitle

\\section{Introduction}

\\end{document}`;

export const RESUME_TEMPLATE = `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{parskip}

% Formatting
\\titleformat{\\section}{\\large\\bfseries\\uppercase}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{8pt}{4pt}
\\pagestyle{empty}

\\begin{document}

% Header
\\begin{center}
  {\\LARGE\\bfseries Your Name}\\\\[4pt]
  \\href{mailto:email@example.com}{email@example.com} \\quad | \\quad +1-234-567-8900 \\quad | \\quad
  \\href{https://linkedin.com/in/yourprofile}{LinkedIn} \\quad | \\quad
  \\href{https://github.com/yourgithub}{GitHub}
\\end{center}

\\section{Education}
\\textbf{University Name} \\hfill City, State\\\\
\\textit{Bachelor of Science in Computer Science} \\hfill Expected May 2027\\\\
GPA: 3.8/4.0

\\section{Experience}
\\textbf{Software Engineer Intern} \\hfill June 2026 -- August 2026\\\\
\\textit{Company Name} \\hfill City, State
\\begin{itemize}[leftmargin=*, nosep]
  \\item Developed and maintained RESTful APIs serving 10,000+ daily users
  \\item Implemented automated testing pipeline reducing bug reports by 30\\%
  \\item Collaborated with cross-functional team of 5 engineers on product features
\\end{itemize}

\\section{Projects}
\\textbf{Project Name} \\hfill \\textit{React, Node.js, MongoDB}
\\begin{itemize}[leftmargin=*, nosep]
  \\item Built a full-stack web application with real-time collaboration features
  \\item Implemented user authentication and role-based access control
  \\item Deployed on AWS with CI/CD pipeline using GitHub Actions
\\end{itemize}

\\section{Skills}
\\textbf{Languages:} Python, JavaScript, TypeScript, Java, C++, SQL\\\\
\\textbf{Frameworks:} React, Node.js, Express, Django, Spring Boot\\\\
\\textbf{Tools:} Git, Docker, AWS, Linux, PostgreSQL, MongoDB

\\section{Certifications}
\\textbf{AWS Certified Cloud Practitioner} \\hfill 2026\\\\
\\textbf{Google Professional Data Engineer} \\hfill 2025

\\end{document}`;

export const COVER_LETTER_TEMPLATE = `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{parskip}

\\pagestyle{empty}

\\begin{document}

\\begin{flushright}
  Your Name\\\\
  Your Address\\\\
  City, State ZIP\\\\
  email@example.com\\\\
  +1-234-567-8900\\\\[12pt]
  \\today
\\end{flushright}

\\vspace{12pt}

Hiring Manager\\\\
Company Name\\\\
Company Address\\\\
City, State ZIP

\\vspace{12pt}

Dear Hiring Manager,

I am writing to express my interest in the [Position Title] role at [Company Name], as advertised on [Platform]. With my background in [Your Field] and experience in [Relevant Skills], I am confident in my ability to contribute effectively to your team.

[Body paragraph 1: Highlight relevant experience and achievements]

[Body paragraph 2: Connect your skills to the job requirements]

[Body paragraph 3: Express enthusiasm and cultural fit]

Thank you for considering my application. I look forward to the opportunity to discuss how my skills and experiences align with the needs of your team.

\\vspace{12pt}

Sincerely,\\\\
Your Name

\\end{document}`;

export const TEMPLATES = [
  { id: 'blank', name: 'Blank Project', content: BLANK_TEMPLATE },
  { id: 'resume', name: 'Resume / CV', content: RESUME_TEMPLATE },
  { id: 'cover-letter', name: 'Cover Letter', content: COVER_LETTER_TEMPLATE },
];
