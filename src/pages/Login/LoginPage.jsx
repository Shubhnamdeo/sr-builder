import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import './LoginPage.css';

export default function LoginPage({ defaultMode = 'login' }) {
  const { loginWithCredentials, signupWithCredentials } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'signup' || defaultMode === 'signup') return 'signup';
    return 'login';
  });

  useEffect(() => {
    if (defaultMode) setMode(defaultMode);
  }, [defaultMode]);

  // Form states
  const [fullName, setFullName] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Active showcase slide indicator with auto-rotation (2.6s smooth cycle)
  const [activeSlide, setActiveSlide] = useState(0);

  const showcaseSlides = [
    {
      step: '01',
      badge: 'Input & Profile',
      title: 'Precision Resumes, Powered by LaTeX',
      subtitle: 'Enter plain English prompts, job requirements, or raw experience.'
    },
    {
      step: '02',
      badge: 'AI & LaTeX Engine',
      title: 'AI Code Assistant, Zero Syntax Hassle',
      subtitle: 'Prompt in plain English to tailor projects and experience.'
    },
    {
      step: '03',
      badge: 'Single-Page ATS Fit',
      title: 'Single-Page Guaranteed Layouts',
      subtitle: 'Strict mathematical margin budgeting fits every profile.'
    }
  ];

  // Auto-change diagram and slide content smoothly every 2.6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % showcaseSlides.length);
    }, 2600);
    return () => clearInterval(timer);
  }, [showcaseSlides.length]);

  const from = location.state?.from?.pathname || '/projects';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanId = userId.trim();
    if (!cleanId) {
      setError('Please enter your User ID or Email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password.length < 3) {
        setError('Password must be at least 3 characters long.');
        return;
      }

      setLoading(true);
      try {
        await signupWithCredentials(fullName.trim(), cleanId, password);
        navigate(from, { replace: true });
      } catch (err) {
        setError(err.message || 'Signup failed.');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        await loginWithCredentials(cleanId, password);
        navigate(from, { replace: true });
      } catch (err) {
        setError(err.message || 'Login failed.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="auth-fullscreen-container">
      <div className="auth-dual-card">
        {/* Left Side: Visual Showcase Panel */}
        <div className="auth-visual-panel">
          <div className="auth-visual-header">
            <div className="auth-brand-logo">
              <div className="sr-bird-badge small">
                <svg className="white-flying-bird" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 3.5C18.5 6.2 14.8 7.8 11.2 8.4C8.5 5.5 5.2 4.2 1.5 4.5C4.2 7.2 6.5 10.5 6.8 14.2C8.5 13.5 10.5 13 12.8 12.8C10.2 16.5 6.5 19.5 2 21.5C7.2 20.8 12.5 18.2 16.2 14.5C19.5 15.2 22.8 16.8 24 18.5C23.2 14.8 21.2 11.2 18.5 8.5C20.2 7 21.5 5.2 22 3.5Z" fill="#FFFFFF"/>
                </svg>
              </div>
              <div className="brand-title-wrap">
                <span className="brand-cursive-title">SR Builder</span>
                <span className="brand-subtitle-tag">Shubh's Resume Builder</span>
              </div>
            </div>

            <button
              type="button"
              className="back-to-website-btn"
              onClick={() => navigate('/')}
            >
              Back to website
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Middle: Live Step-by-Step Architecture Diagram */}
          <div className="auth-diagram-stage">
            {/* 3-Step Pipeline Flow Bar */}
            <div className="diagram-pipeline-bar">
              <div 
                className={`pipeline-step ${activeSlide === 0 ? 'active' : activeSlide > 0 ? 'completed' : ''}`}
                onClick={() => setActiveSlide(0)}
              >
                <span className="step-num">01</span>
                <span className="step-name">Input</span>
              </div>
              <div className={`pipeline-track ${activeSlide >= 1 ? 'active' : ''}`}>
                <div className="track-pulse"></div>
              </div>
              <div 
                className={`pipeline-step ${activeSlide === 1 ? 'active' : activeSlide > 1 ? 'completed' : ''}`}
                onClick={() => setActiveSlide(1)}
              >
                <span className="step-num">02</span>
                <span className="step-name">AI + LaTeX</span>
              </div>
              <div className={`pipeline-track ${activeSlide >= 2 ? 'active' : ''}`}>
                <div className="track-pulse"></div>
              </div>
              <div 
                className={`pipeline-step ${activeSlide === 2 ? 'active' : ''}`}
                onClick={() => setActiveSlide(2)}
              >
                <span className="step-num">03</span>
                <span className="step-name">ATS PDF</span>
              </div>
            </div>

            {/* Dynamic Step Visual Canvas */}
            <div className="diagram-card-container">
              {/* Step 01: Natural Language Input */}
              <div className={`diagram-slide-pane ${activeSlide === 0 ? 'active' : ''}`}>
                <div className="diagram-card-header">
                  <div className="diagram-tag-badge">
                    <span className="dot pulse-dot"></span>
                    Step 01 &bull; Candidate Data
                  </div>
                  <span className="diagram-card-file">prompt.txt</span>
                </div>
                
                <div className="diagram-prompt-box">
                  <span className="terminal-prompt">&gt;</span>
                  <span className="prompt-text">
                    "Tailor resume for Senior Full Stack Engineer with clean metrics"
                  </span>
                </div>

                <div className="diagram-chips-row">
                  <span className="diagram-chip">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Work Experience
                  </span>
                  <span className="diagram-chip">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Core Skills
                  </span>
                  <span className="diagram-chip">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    ATS Keywords
                  </span>
                </div>

                <div className="diagram-status-footer">
                  <span className="status-indicator active-dot"></span>
                  <span className="status-text">Parsing data &bull; Aligning job targets</span>
                </div>
              </div>

              {/* Step 02: Gemini AI + LaTeX Engine */}
              <div className={`diagram-slide-pane ${activeSlide === 1 ? 'active' : ''}`}>
                <div className="diagram-card-header">
                  <div className="diagram-tag-badge highlight">
                    <span className="dot pulse-lilac"></span>
                    Step 02 &bull; LaTeX + Gemini AI
                  </div>
                  <span className="diagram-card-file">engine.tex</span>
                </div>

                <div className="diagram-code-box">
                  <div className="code-line">
                    <span className="code-kw">\resumeSubheading</span>&#123;Lead Developer&#125;&#123;2024&#125;
                  </div>
                  <div className="code-line highlight">
                    <span className="code-kw">\item</span> Optimized action verbs <span className="code-accent">+38% impact</span>
                  </div>
                  <div className="code-line">
                    <span className="code-kw">\item</span> Matched 18 / 18 ATS keyword criteria
                  </div>
                </div>

                <div className="diagram-chips-row">
                  <span className="diagram-chip highlight">&#10022; Gemini 2.0 AI</span>
                  <span className="diagram-chip highlight">&#123; \TeX &#125; Real-Time</span>
                  <span className="diagram-chip">Auto-Budget</span>
                </div>

                <div className="diagram-status-footer">
                  <span className="status-indicator compiling-dot"></span>
                  <span className="status-text">Mathematical spacing &bull; LaTeX typesetting</span>
                </div>
              </div>

              {/* Step 03: ATS Single-Page PDF */}
              <div className={`diagram-slide-pane ${activeSlide === 2 ? 'active' : ''}`}>
                <div className="diagram-card-header">
                  <div className="diagram-tag-badge success">
                    <span className="dot success-dot"></span>
                    Step 03 &bull; Production Output
                  </div>
                  <span className="diagram-card-file">resume.pdf</span>
                </div>

                <div className="diagram-mini-resume-preview">
                  <div className="mini-sheet">
                    <div className="sheet-top-line"></div>
                    <div className="sheet-sub-line"></div>
                    <div className="sheet-rule"></div>
                    <div className="sheet-section-tag"></div>
                    <div className="sheet-bullet"></div>
                    <div className="sheet-bullet short"></div>
                    <div className="sheet-section-tag"></div>
                    <div className="sheet-bullet"></div>
                  </div>
                  
                  <div className="mini-verified-badge">
                    <div className="score-badge-circle">
                      <span className="score-val">98</span>
                      <span className="score-lbl">ATS</span>
                    </div>
                    <div className="verified-details">
                      <span className="verified-title">&#10003; ATS Screening Passed</span>
                      <span className="verified-sub">1-Page Strictly Fitted</span>
                    </div>
                  </div>
                </div>

                <div className="diagram-status-footer">
                  <span className="status-indicator ready-dot"></span>
                  <span className="status-text">Single-page guaranteed &bull; High-res vector PDF</span>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-visual-body">
            <div className="visual-text-wrapper" key={activeSlide}>
              <h2 className="visual-headline">
                {showcaseSlides[activeSlide].title}
              </h2>
              <p className="visual-caption">
                {showcaseSlides[activeSlide].subtitle}
              </p>
            </div>

            <div className="carousel-indicators">
              {showcaseSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`indicator-pill ${idx === activeSlide ? 'active' : ''}`}
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`Slide ${idx + 1}`}
                >
                  {idx === activeSlide && (
                    <span className="indicator-progress-bar" key={`bar-${activeSlide}`} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Clean ID & Password Form */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            <h1 className="auth-main-title">
              {mode === 'signup' ? 'Create an account' : 'Welcome back'}
            </h1>

            <p className="auth-switch-text">
              {mode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="auth-inline-link"
                    onClick={() => { setMode('login'); setError(''); }}
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    className="auth-inline-link"
                    onClick={() => { setMode('signup'); setError(''); }}
                  >
                    Sign up
                  </button>
                </>
              )}
            </p>

            {error && <div className="auth-error-banner">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form-fields">
              {mode === 'signup' && (
                <div className="form-input-group">
                  <input
                    type="text"
                    className="auth-text-input"
                    placeholder="Full Name (e.g. Shubh Namdeo)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              )}

              <div className="form-input-group">
                <input
                  type="text"
                  className="auth-text-input"
                  placeholder="User ID or Email (e.g. test 1)"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                  autoFocus={mode === 'login'}
                  autoComplete="username"
                />
              </div>

              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-text-input password-field"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {mode === 'login' && (
                <div className="login-row-options">
                  <label className="terms-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Default login: <strong>test 1</strong> / <strong>test 1</strong>
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading
                  ? 'Please wait...'
                  : (mode === 'signup' ? 'Sign Up & Start Building' : 'Log In')}
              </button>
            </form>

            <div className="auth-help-note" style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
              No admin approval required. Instant access upon sign up.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
