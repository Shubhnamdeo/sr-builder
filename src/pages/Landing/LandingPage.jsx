import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();

  const handleScrollDown = () => {
    const target = document.getElementById('architecture');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-container">
      {/* Top Navbar */}
      <header className="landing-navbar">
        <div className="landing-brand" onClick={() => navigate('/')}>
          <div className="sr-bird-badge">
            {/* White Flying Bird Icon */}
            <svg className="white-flying-bird" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 3.5C18.5 6.2 14.8 7.8 11.2 8.4C8.5 5.5 5.2 4.2 1.5 4.5C4.2 7.2 6.5 10.5 6.8 14.2C8.5 13.5 10.5 13 12.8 12.8C10.2 16.5 6.5 19.5 2 21.5C7.2 20.8 12.5 18.2 16.2 14.5C19.5 15.2 22.8 16.8 24 18.5C23.2 14.8 21.2 11.2 18.5 8.5C20.2 7 21.5 5.2 22 3.5Z" fill="#FFFFFF"/>
            </svg>
          </div>
          <div className="brand-title-wrap">
            <span className="brand-cursive-title">SR Builder</span>
            <span className="brand-subtitle-tag">Shubh's Resume Builder</span>
          </div>
        </div>

        <nav className="landing-nav-links">
          <a href="#architecture">Architecture</a>
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
        </nav>

        <div className="landing-nav-actions">
          <button className="nav-login-btn" onClick={() => navigate('/login')}>
            Log in
          </button>
          <button className="nav-signup-btn" onClick={() => navigate('/signup')}>
            Get started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <h1 className="hero-headline">
          Precision Resumes. <br />
          <span className="highlight-sky">Single-Page Perfection.</span>
        </h1>

        <p className="hero-subtitle">
          Professional LaTeX-grade typography designed to pass ATS screening. 
          Tailor sections in natural language and export high-resolution PDFs.
        </p>

        <div className="hero-cta-group">
          <button className="hero-primary-btn" onClick={() => navigate('/signup')}>
            Create your resume
          </button>
        </div>

        {/* Minimal Scroll Down Button */}
        <div className="scroll-btn-wrapper">
          <button className="hero-scroll-btn" onClick={handleScrollDown} aria-label="Scroll to architecture diagram">
            <span className="scroll-btn-label">Scroll to explore</span>
            <svg className="scroll-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* Architecture Block Diagram */}
        <div className="system-diagram-wrapper" id="architecture">
          <div className="diagram-header">
            <span className="diagram-tag">System Architecture</span>
            <span className="diagram-title">How SR Builder Compiles & Optimizes Resumes</span>
          </div>

          <div className="block-diagram-flow">
            {/* Block 1: Inputs */}
            <div className="diagram-node node-input">
              <div className="node-badge">Input Layer</div>
              <h4 className="node-title">Candidate Data</h4>
              <ul className="node-list">
                <li>Plain English Prompts</li>
                <li>Target Job Descriptions</li>
                <li>Work Experience & Skills</li>
              </ul>
              <div className="node-footer">Raw Text / JSON</div>
            </div>

            {/* Connecting Line 1 */}
            <div className="diagram-connector">
              <div className="connector-line"></div>
              <div className="connector-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Block 2: Core Processing Engine */}
            <div className="diagram-node node-core">
              <div className="node-badge badge-accent">Processing Core</div>
              <h4 className="node-title">SR Engine + Gemini AI</h4>
              <div className="core-modules-grid">
                <div className="sub-module">
                  <span className="sub-module-label">Gemini 2.0 AI</span>
                  <span className="sub-module-desc">Natural Language to LaTeX Parser</span>
                </div>
                <div className="sub-module">
                  <span className="sub-module-label">Margin Solver</span>
                  <span className="sub-module-desc">Strict 1-Page Layout Budgeting</span>
                </div>
                <div className="sub-module">
                  <span className="sub-module-label">ATS Auditor</span>
                  <span className="sub-module-desc">100-Point Rubric Verification</span>
                </div>
              </div>
              <div className="node-footer footer-accent">In-Memory Engine &middot; &lt;500ms</div>
            </div>

            {/* Connecting Line 2 */}
            <div className="diagram-connector">
              <div className="connector-line"></div>
              <div className="connector-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Block 3: Production Output */}
            <div className="diagram-node node-output">
              <div className="node-badge">Output Layer</div>
              <h4 className="node-title">ATS-Ready Delivery</h4>
              <ul className="node-list">
                <li>Strict Single-Page PDF</li>
                <li>Verified 94+ ATS Score</li>
                <li>Clean Vector Typography</li>
              </ul>
              <div className="node-footer">Vector PDF / Download</div>
            </div>
          </div>

          {/* Diagram Metrics Bar */}
          <div className="diagram-metrics-strip">
            <div className="metric-cell">
              <span className="metric-val">1 Page</span>
              <span className="metric-lbl">Strict Layout Fit</span>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-cell">
              <span className="metric-val">98%</span>
              <span className="metric-lbl">ATS Parser Pass Rate</span>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-cell">
              <span className="metric-val">10 Resumes</span>
              <span className="metric-lbl">Cloud Storage Quota</span>
            </div>
            <div className="metric-divider"></div>
            <div className="metric-cell">
              <span className="metric-val">Instant</span>
              <span className="metric-lbl">Client Vector PDF Compile</span>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Features Section */}
      <section className="landing-features" id="features">
        <div className="section-header">
          <span className="section-pill">Core Capabilities</span>
          <h2>Built for Engineering Resumes</h2>
          <p>Everything needed to pass automated filters and impress hiring managers.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-indicator">01</div>
            <h3>Single-Page Mathematical Fit</h3>
            <p>Precise vertical budgeting ensures your resume fits strictly onto one page with zero margin bleed.</p>
          </div>

          <div className="feature-card">
            <div className="feature-indicator">02</div>
            <h3>Gemini AI Copilot</h3>
            <p>Draft and refine experience bullets in plain English without writing complex LaTeX markup.</p>
          </div>

          <div className="feature-card">
            <div className="feature-indicator">03</div>
            <h3>Real-Time ATS Verification</h3>
            <p>100-point audit checks section taxonomy, action verbs, and quantifiable impact metrics.</p>
          </div>
        </div>
      </section>

      {/* Minimal Workflow */}
      <section className="landing-workflow" id="workflow">
        <div className="section-header">
          <span className="section-pill">Process</span>
          <h2>Three Steps to Your Next Role</h2>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <span className="step-number">1</span>
            <h4>Sign Up</h4>
            <p>Create a free account with Google or email.</p>
          </div>
          <div className="step-separator"></div>
          <div className="step-card">
            <span className="step-number">2</span>
            <h4>Customize</h4>
            <p>Edit directly or prompt the AI to adapt for target roles.</p>
          </div>
          <div className="step-separator"></div>
          <div className="step-card">
            <span className="step-number">3</span>
            <h4>Download</h4>
            <p>Export a clean, vector PDF ready for job applications.</p>
          </div>
        </div>
      </section>

      {/* Minimal CTA */}
      <section className="landing-cta-banner">
        <h2>Start Building Your Resume</h2>
        <p>Free to use. Save up to 10 versions in your account.</p>
        <div className="cta-btn-wrap">
          <button className="cta-banner-btn" onClick={() => navigate('/signup')}>
            Get started free
          </button>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-left">
            <div className="sr-bird-badge" style={{ width: 28, height: 28 }}>
              <svg className="white-flying-bird" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 3.5C18.5 6.2 14.8 7.8 11.2 8.4C8.5 5.5 5.2 4.2 1.5 4.5C4.2 7.2 6.5 10.5 6.8 14.2C8.5 13.5 10.5 13 12.8 12.8C10.2 16.5 6.5 19.5 2 21.5C7.2 20.8 12.5 18.2 16.2 14.5C19.5 15.2 22.8 16.8 24 18.5C23.2 14.8 21.2 11.2 18.5 8.5C20.2 7 21.5 5.2 22 3.5Z" fill="#FFFFFF"/>
              </svg>
            </div>
            <div className="footer-brand-text">
              <span className="brand-cursive-title" style={{ fontSize: 18 }}>SR Builder</span>
              <span className="brand-subtitle-tag" style={{ fontSize: 9.5 }}>Shubh's Resume Builder</span>
            </div>
          </div>

          <div className="footer-links">
            <a href="#architecture">Architecture</a>
            <a href="#features">Features</a>
            <span onClick={() => navigate('/login')}>Log in</span>
            <span onClick={() => navigate('/signup')}>Sign up</span>
          </div>

          {/* LinkedIn Button in far right */}
          <div className="footer-right">
            <a
              href="https://linkedin.com/in/shubh-namdeo-8a9902186"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-linkedin-btn"
              title="Connect with Shubh Namdeo on LinkedIn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.81a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z"/>
              </svg>
              <span>LinkedIn</span>
            </a>
            <div className="footer-copyright">
              © 2026 SR Builder
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
