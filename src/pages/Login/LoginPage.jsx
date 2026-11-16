import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import './LoginPage.css';

export default function LoginPage({ defaultMode = 'login' }) {
  const { loginWithEmail, signupWithEmail, loginWithGoogle } = useAuth();
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
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

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (!firstName.trim()) {
        setError('Please enter your first name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (!agreeTerms) {
        setError('Please agree to the Terms & Conditions.');
        return;
      }

      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      setLoading(true);
      try {
        await signupWithEmail(fullName, email, password);
        navigate(from, { replace: true });
      } catch (err) {
        setError(err.message || 'Signup failed.');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        await loginWithEmail(email, password);
        navigate(from, { replace: true });
      } catch (err) {
        setError(err.message || 'Login failed.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      let googleProfile = null;
      if (email.trim() && email.includes('@')) {
        const clean = email.trim().toLowerCase();
        googleProfile = {
          name: clean.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          email: clean,
          avatar: clean.slice(0, 2).toUpperCase(),
          plan: 'free',
          role: clean === 'shubhnamdeo@gmail.com' ? 'admin' : 'user',
          isGoogle: true,
        };
      }
      await loginWithGoogle(googleProfile);
      navigate(from, { replace: true });
    } catch {
      setError('Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-fullscreen-container">
      <div className="auth-dual-card">
        {/* Left Side: Moody Visual Showcase Panel */}
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

        {/* Right Side: Clean Minimal Form */}
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
                <div className="dual-input-row">
                  <input
                    type="text"
                    className="auth-text-input"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="auth-text-input"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              )}

              <input
                type="email"
                className="auth-text-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-text-input password-field"
                  placeholder="Enter your password"
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

              {mode === 'signup' ? (
                <label className="terms-checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                  />
                  <span>
                    I agree to the <a href="#terms" onClick={(e) => e.preventDefault()}>Terms & Conditions</a>
                  </span>
                </label>
              ) : (
                <div className="login-row-options">
                  <label className="terms-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <a href="#forgot" className="forgot-pwd-link" onClick={(e) => { e.preventDefault(); alert('Please log in with your email or use Google Sign-In.'); }}>
                    Forgot password?
                  </a>
                </div>
              )}

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading
                  ? 'Please wait...'
                  : (mode === 'signup' ? 'Create free account' : 'Log in')}
              </button>
            </form>

            <div className="auth-social-divider">
              <span>{mode === 'signup' ? 'Or register with' : 'Or continue with'}</span>
            </div>

            {/* Single clean Google Sign-in button (Demo removed) */}
            <button
              type="button"
              className="google-single-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
