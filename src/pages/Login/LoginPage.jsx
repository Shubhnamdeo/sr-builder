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

  // Active showcase slide indicator
  const [activeSlide, setActiveSlide] = useState(0);

  const showcaseSlides = [
    {
      title: 'Precision Resumes, Powered by LaTeX',
      subtitle: 'Engineered for ATS compliance and clean typography.'
    },
    {
      title: 'AI Code Assistant, Zero Syntax Hassle',
      subtitle: 'Prompt in plain English to tailor projects and experience.'
    },
    {
      title: 'Single-Page Guaranteed Layouts',
      subtitle: 'Strict mathematical margin budgeting fits every profile.'
    }
  ];

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

          <div className="auth-visual-body">
            <h2 className="visual-headline">
              {showcaseSlides[activeSlide].title}
            </h2>
            <p className="visual-caption">
              {showcaseSlides[activeSlide].subtitle}
            </p>

            <div className="carousel-indicators">
              {showcaseSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`indicator-pill ${idx === activeSlide ? 'active' : ''}`}
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`Slide ${idx + 1}`}
                />
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
