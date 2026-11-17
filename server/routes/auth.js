import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Project from '../models/Project.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const getJwtSecret = () => process.env.JWT_SECRET || 'sr_builder_super_secret_jwt_key_2026';

function signToken(userId) {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '30d' });
}

// 1. Register with Email & Password
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: cleanEmail === 'shubhnamdeo@gmail.com' ? 'admin' : 'user',
    });

    await user.save();

    // Create 1 starter LaTeX resume
    const starterLatex = `\\documentclass[letterpaper,10pt]{article}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage[hidelinks]{hyperref}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\titleformat{\\section}{\\scshape\\raggedright\\large}{}{0em}{}[\\titlerule]

\\begin{document}

\\begin{center}
    {\\Huge \\scshape ${user.name}} \\\\ \\vspace{2pt}
    \\href{mailto:${user.email}}{\\underline{${user.email}}} $|$ \\href{https://linkedin.com}{\\underline{LinkedIn}} $|$ \\href{https://github.com}{\\underline{GitHub}}
\\end{center}

\\section{Professional Summary}
Results-driven software engineer experienced in building scalable web applications and cloud architectures.

\\section{Technical Skills}
\\textbf{Languages:} JavaScript, TypeScript, Python, SQL, LaTeX \\\\
\\textbf{Frameworks \\& Tools:} React, Node.js, Express, MongoDB, Git

\\section{Experience}
\\textbf{Software Developer} \\hfill 2024 -- Present \\\\
\\textit{Tech Innovations Inc.}
\\begin{itemize}
    \\item Designed and deployed high-performance full-stack web applications with microservices.
    \\item Collaborated with cross-functional teams to streamline CI/CD delivery pipelines.
\\end{itemize}

\\section{Education}
\\textbf{Bachelor of Technology in Computer Science} \\hfill 2022 -- 2026

\\end{document}`;

    await Project.create({
      userId: user._id,
      title: `${user.name.split(' ')[0]}'s Resume`,
      owner: 'You',
      content: starterLatex,
    });

    const token = signToken(user._id.toString());
    res.status(201).json({
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Internal server error during registration' });
  }
});

// 2. Log In with Email & Password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Special test account support requested: "test 1" / "test 1"
    if ((cleanEmail === 'test 1' || cleanEmail === 'test1') && (password === 'test 1' || password === 'test1')) {
      let testUser = await User.findOne({ email: 'test 1' });
      if (!testUser) {
        testUser = await User.create({
          name: 'Test 1',
          email: 'test 1',
          role: 'user',
          plan: 'free',
        });
        await Project.create({
          userId: testUser._id,
          title: "Test 1's Resume",
          owner: 'You',
          content: '\\documentclass[letterpaper,10pt]{article}\n\\begin{document}\n\\section{Test 1 Resume}\nWelcome to your resume!\n\\end{document}',
        });
      }
      const token = signToken(testUser._id.toString());
      return res.json({ token, user: testUser.toSafeObject() });
    }

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({ message: 'No account found with this email' });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Account registered via Google. Please log in with Google.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password credentials' });
    }

    const token = signToken(user._id.toString());
    res.json({
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error during login' });
  }
});

// 3. Continue with Google
router.post('/google', async (req, res) => {
  try {
    const { email, name, avatar } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Google email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      const displayName = name || cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      user = new User({
        name: displayName,
        email: cleanEmail,
        avatar: avatar || displayName.charAt(0).toUpperCase(),
        isGoogle: true,
        role: cleanEmail === 'shubhnamdeo@gmail.com' ? 'admin' : 'user',
      });
      await user.save();

      // Seed starter resume for Google user
      await Project.create({
        userId: user._id,
        title: `${displayName.split(' ')[0]}'s Resume`,
        owner: 'You',
        content: `\\documentclass[letterpaper,10pt]{article}\n\\usepackage[empty]{fullpage}\n\\begin{document}\n\\begin{center}{\\Huge ${displayName}}\\end{center}\n\\end{document}`,
      });
    }

    const token = signToken(user._id.toString());
    res.json({
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ message: 'Google authentication failed' });
  }
});

// 4. Get Current User Profile & Cloud Storage Quota
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const activeProjectsCount = await Project.countDocuments({
      userId: req.user._id,
      trashed: false,
    });

    res.json({
      user: req.user.toSafeObject(),
      quota: {
        max: 10,
        used: activeProjectsCount,
        remaining: Math.max(0, 10 - activeProjectsCount),
      },
    });
  } catch (err) {
    console.error('Me endpoint error:', err);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

export default router;
