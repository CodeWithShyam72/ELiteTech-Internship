/* ================================================
   AuthFlow - auth.js
   Author: Shyam Ji
   Description: Login Authentication System Logic
   Features:
   - User Registration with validation
   - Login with simulated JWT token
   - Password strength checker
   - Remember me (localStorage)
   - Forgot password flow
   - Protected dashboard page
   - Session management
   - Social login simulation
================================================ */

/* ================================================
   SIMULATED USER DATABASE
   In real app: stored in backend DB (MongoDB/PostgreSQL)
================================================ */
let users = JSON.parse(localStorage.getItem('authflow_users') || '[]');

/* Default demo user so login works out of the box */
if (users.length === 0) {
  users.push({
    id:       'USR-001',
    fname:    'Shyam',
    lname:    'Ji',
    email:    'shyam@example.com',
    password: hashPassword('password123'), // Simulated hash
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem('authflow_users', JSON.stringify(users));
}

/* ================================================
   SESSION STATE
================================================ */
let currentUser = null;
let sessionStart = null;

/* Check if user is already logged in on page load */
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('authflow_session');
  if (saved) {
    currentUser  = JSON.parse(saved);
    sessionStart = new Date();
    showDashboard();
  } else {
    showPage('login');
  }
});

/* ================================================
   PAGE NAVIGATION
================================================ */
/**
 * Show a specific auth page (login, register, forgot, dashboard)
 */
function showPage(page) {
  document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
}

/* ================================================
   LOGIN
================================================ */
/**
 * Validates credentials, generates JWT, saves session
 */
function login() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value.trim();

  // Input validation
  if (!email || !pass) {
    showError('login-error', '⚠️ Please fill in all fields');
    return;
  }
  if (!isValidEmail(email)) {
    showError('login-error', '⚠️ Please enter a valid email address');
    return;
  }

  // Show loading spinner
  setLoading(true);

  // Simulate API call delay (in real app: POST /api/auth/login)
  setTimeout(() => {
    const user = users.find(u => u.email === email && u.password === hashPassword(pass));

    if (!user) {
      setLoading(false);
      showError('login-error', '❌ Invalid email or password');
      document.getElementById('login-pass').classList.add('error');
      return;
    }

    // Successful login
    currentUser  = user;
    sessionStart = new Date();

    // Save session (Remember Me check)
    const remember = document.getElementById('remember-me').checked;
    if (remember) {
      localStorage.setItem('authflow_session', JSON.stringify(user));
    } else {
      sessionStorage.setItem('authflow_session', JSON.stringify(user));
    }

    setLoading(false);
    showToast('✅ Login successful! Welcome back, ' + user.fname + '!');
    showDashboard();
  }, 1200);
}

/* ================================================
   REGISTER
================================================ */
/**
 * Validates registration form and creates new user account
 */
function register() {
  const fname   = document.getElementById('reg-fname').value.trim();
  const lname   = document.getElementById('reg-lname').value.trim();
  const email   = document.getElementById('reg-email').value.trim();
  const pass    = document.getElementById('reg-pass').value.trim();
  const confirm = document.getElementById('reg-confirm').value.trim();
  const terms   = document.getElementById('reg-terms').checked;

  // Validation checks
  if (!fname || !lname || !email || !pass || !confirm) {
    showError('reg-error', '⚠️ Please fill in all fields');
    return;
  }
  if (!isValidEmail(email)) {
    showError('reg-error', '⚠️ Please enter a valid email address');
    return;
  }
  if (pass.length < 8) {
    showError('reg-error', '⚠️ Password must be at least 8 characters');
    return;
  }
  if (pass !== confirm) {
    showError('reg-error', '❌ Passwords do not match');
    return;
  }
  if (!terms) {
    showError('reg-error', '⚠️ Please accept the Terms & Privacy Policy');
    return;
  }
  if (users.find(u => u.email === email)) {
    showError('reg-error', '❌ An account with this email already exists');
    return;
  }

  // Create new user object
  const newUser = {
    id:        'USR-' + String(users.length + 1).padStart(3, '0'),
    fname,
    lname,
    email,
    password:  hashPassword(pass), // In real app: bcrypt hash on backend
    createdAt: new Date().toISOString(),
  };

  // Save to "database" (localStorage)
  users.push(newUser);
  localStorage.setItem('authflow_users', JSON.stringify(users));

  // Auto login after registration
  currentUser  = newUser;
  sessionStart = new Date();
  localStorage.setItem('authflow_session', JSON.stringify(newUser));

  showToast('🎉 Account created! Welcome, ' + fname + '!');
  showDashboard();
}

/* ================================================
   FORGOT PASSWORD
================================================ */
/**
 * Simulates sending a password reset email
 */
function sendReset() {
  const email = document.getElementById('forgot-email').value.trim();

  if (!email) { showError('forgot-error', '⚠️ Please enter your email address'); return; }
  if (!isValidEmail(email)) { showError('forgot-error', '⚠️ Please enter a valid email'); return; }

  // Show success message (in real app: call /api/auth/reset-password)
  document.getElementById('forgot-form').style.display    = 'none';
  document.getElementById('forgot-success').style.display = 'block';
  showToast('📧 Reset link sent to ' + email);
}

/* ================================================
   SOCIAL LOGIN (Simulation)
================================================ */
/**
 * Simulates OAuth login via Google or GitHub
 */
function socialLogin(provider) {
  showToast('🔄 Redirecting to ' + provider + ' login...');
  setTimeout(() => {
    // Simulate successful OAuth response
    currentUser = {
      id:    'USR-SOCIAL-001',
      fname: 'Shyam',
      lname: 'Ji',
      email: 'shyam@gmail.com',
      method: provider,
    };
    sessionStart = new Date();
    localStorage.setItem('authflow_session', JSON.stringify(currentUser));
    showToast('✅ Signed in with ' + provider + '!');
    showDashboard();
  }, 1500);
}

/* ================================================
   LOGOUT
================================================ */
function logout() {
  currentUser  = null;
  sessionStart = null;
  localStorage.removeItem('authflow_session');
  sessionStorage.removeItem('authflow_session');
  showToast('👋 Logged out successfully');
  showPage('login');
  // Clear login form
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value  = '';
}

/* ================================================
   SHOW DASHBOARD
================================================ */
/**
 * Renders the dashboard with current user's data
 */
function showDashboard() {
  if (!currentUser) { showPage('login'); return; }

  const fullName = (currentUser.fname + ' ' + (currentUser.lname || '')).trim();
  const initials = (currentUser.fname[0] + (currentUser.lname?.[0] || '')).toUpperCase();
  const time     = sessionStart ? sessionStart.toLocaleTimeString() : 'Just now';
  const method   = currentUser.method || 'Email & Password';

  // Update UI elements
  document.getElementById('nav-username').textContent   = fullName;
  document.getElementById('nav-avatar').textContent     = initials;
  document.getElementById('dash-name').textContent      = currentUser.fname;
  document.getElementById('session-time').textContent   = time;
  document.getElementById('profile-name').textContent   = fullName;
  document.getElementById('profile-email').textContent  = currentUser.email;
  document.getElementById('profile-avatar').textContent = initials;
  document.getElementById('profile-id').textContent     = '#' + currentUser.id;
  document.getElementById('profile-login').textContent  = time;
  document.getElementById('profile-method').textContent = method;

  // Generate simulated JWT token
  const token = generateJWT(currentUser);
  document.getElementById('token-display').textContent = token;

  showPage('dashboard');
}

/* ================================================
   PASSWORD STRENGTH CHECKER
================================================ */
/**
 * Checks password strength and updates the indicator bar
 */
function checkPasswordStrength(password) {
  const fill  = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');

  let score = 0;
  if (password.length >= 8)           score++;  // Length
  if (/[A-Z]/.test(password))         score++;  // Uppercase
  if (/[0-9]/.test(password))         score++;  // Number
  if (/[^A-Za-z0-9]/.test(password))  score++;  // Special char

  const levels = [
    { pct: '0%',   color: 'transparent', text: '',          textColor: '' },
    { pct: '25%',  color: '#ef4444',     text: 'Weak',      textColor: '#ef4444' },
    { pct: '50%',  color: '#f59e0b',     text: 'Fair',      textColor: '#f59e0b' },
    { pct: '75%',  color: '#3b82f6',     text: 'Good',      textColor: '#3b82f6' },
    { pct: '100%', color: '#10b981',     text: 'Strong ✓',  textColor: '#10b981' },
  ];

  const level = levels[score];
  fill.style.width      = level.pct;
  fill.style.background = level.color;
  label.textContent     = level.text;
  label.style.color     = level.textColor;
}

/* ================================================
   UTILITY FUNCTIONS
================================================ */

/** Toggle password field visibility */
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

/** Show error message in a specific error element */
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = message;
}

/** Clear error message */
function clearError(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = '';
  // Remove error class from inputs
  document.querySelectorAll('.input-wrap input.error').forEach(i => i.classList.remove('error'));
}

/** Toggle login button loading state */
function setLoading(isLoading) {
  const btn     = document.getElementById('login-btn');
  const text    = document.getElementById('login-btn-text');
  const spinner = document.getElementById('login-spinner');
  btn.disabled           = isLoading;
  text.style.display     = isLoading ? 'none'   : 'inline';
  spinner.style.display  = isLoading ? 'inline' : 'none';
}

/** Basic email format validation */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Simulated password hashing
 * In real app: use bcrypt on the backend — NEVER hash passwords client-side
 */
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'HASH_' + Math.abs(hash).toString(36).toUpperCase();
}

/**
 * Generate a simulated JWT token string
 * In real app: generated and signed on the backend using jsonwebtoken library
 */
function generateJWT(user) {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    userId: user.id,
    email:  user.email,
    name:   user.fname,
    iat:    Math.floor(Date.now() / 1000),
    exp:    Math.floor(Date.now() / 1000) + 86400, // Expires in 24h
  }));
  const signature = btoa('simulated_secret_signature_' + user.id);
  return `${header}.${payload}.${signature}`;
}

/** Copy JWT token to clipboard */
function copyToken() {
  const token = document.getElementById('token-display').textContent.trim();
  navigator.clipboard.writeText(token).then(() => {
    showToast('📋 Token copied to clipboard!');
  });
}

/* ================================================
   TOAST
================================================ */
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
