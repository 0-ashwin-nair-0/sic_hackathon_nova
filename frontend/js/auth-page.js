const API_BASE = 'http://127.0.0.1:5000/api';

let authMode = 'login';
let role = 'citizen';

function parseRole() {
    const params = new URLSearchParams(window.location.search);
    const roleParam = (params.get('role') || 'citizen').toLowerCase();
    role = roleParam === 'admin' ? 'admin' : 'citizen';
}

function setMessage(text, type = '') {
    const node = document.getElementById('authMessage');
    if (!node) return;
    node.textContent = text || '';
    node.className = 'auth-message';
    if (type) node.classList.add(type);
}

function updateRoleUi() {
    const roleTitle = role === 'admin' ? 'Admin' : 'Citizen';
    const roleDescription = role === 'admin'
        ? 'Sign in as city administrator to access the ICCC dashboard.'
        : 'Sign in as citizen to report issues and track city services.';

    const roleBadge = document.getElementById('roleBadge');
    const desc = document.getElementById('roleDescription');
    const title = document.getElementById('authTitle');
    const subtitle = document.getElementById('authSubtitle');
    const submitBtn = document.getElementById('submitBtn');
    const nameField = document.getElementById('nameField');
    const loginTab = document.getElementById('loginTabBtn');
    const signupTab = document.getElementById('signupTabBtn');
    const emailLabel = document.querySelector('label[for="emailInput"]');
    const emailInput = document.getElementById('emailInput');

    if (roleBadge) roleBadge.textContent = `${roleTitle} Access`;
    if (desc) desc.textContent = roleDescription;
    if (title) title.textContent = `${roleTitle} ${authMode === 'login' ? 'Login' : 'Signup'}`;
    if (subtitle) {
        if (role === 'admin') {
            subtitle.textContent = 'Use predefined admin username and password.';
        } else {
            subtitle.textContent = authMode === 'login'
                ? 'Login with your registered account'
                : 'Create your new account to continue';
        }
    }
    if (submitBtn) submitBtn.textContent = authMode === 'login' ? 'Login' : 'Create Account';
    if (nameField) nameField.style.display = authMode === 'signup' ? 'flex' : 'none';

    if (emailLabel) {
        emailLabel.textContent = role === 'admin' ? 'Username' : 'Email';
    }
    if (emailInput) {
        emailInput.type = role === 'admin' ? 'text' : 'email';
        emailInput.placeholder = role === 'admin' ? 'Enter admin username' : 'Enter your email';
    }

    if (signupTab) {
        if (role === 'admin') {
            signupTab.style.display = 'none';
            authMode = 'login';
        } else {
            signupTab.style.display = 'block';
        }
    }

    if (loginTab) loginTab.classList.toggle('active', authMode === 'login');
    if (signupTab) signupTab.classList.toggle('active', authMode === 'signup');
}

function saveSession(data) {
    const session = {
        token: data.token,
        user: data.user,
        loggedInAt: new Date().toISOString()
    };
    localStorage.setItem('smartcityAuth', JSON.stringify(session));
}

function redirectAfterSuccess(userRole) {
    window.location.href = userRole === 'admin' ? 'admin.html' : 'citizen.html';
}

async function submitAuth(event) {
    event.preventDefault();

    const name = document.getElementById('nameInput')?.value.trim() || '';
    const identifier = document.getElementById('emailInput')?.value.trim() || '';
    const password = document.getElementById('passwordInput')?.value || '';

    if (!identifier || !password || (authMode === 'signup' && !name)) {
        setMessage('Please fill all required fields.', 'error');
        return;
    }

    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/signup';
    const body = { password, role };

    if (role === 'admin') {
        body.username = identifier;
    } else {
        body.email = identifier;
    }

    if (authMode === 'signup') body.name = name;

    setMessage('Please wait...');

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Authentication failed');
        }

        saveSession(result);
        setMessage(result.message || 'Success! Redirecting...', 'success');
        setTimeout(() => redirectAfterSuccess(result.user?.role || role), 350);
    } catch (error) {
        setMessage(error.message || 'Something went wrong. Please retry.', 'error');
    }
}

function initTabs() {
    const loginBtn = document.getElementById('loginTabBtn');
    const signupBtn = document.getElementById('signupTabBtn');

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            authMode = 'login';
            setMessage('');
            updateRoleUi();
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            if (role === 'admin') {
                return;
            }
            authMode = 'signup';
            setMessage('');
            updateRoleUi();
        });
    }
}

function initAuthPage() {
    parseRole();
    initTabs();
    updateRoleUi();

    const form = document.getElementById('authForm');
    if (form) form.addEventListener('submit', submitAuth);
}

document.addEventListener('DOMContentLoaded', initAuthPage);
