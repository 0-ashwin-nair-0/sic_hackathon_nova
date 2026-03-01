const API_BASE = 'http://127.0.0.1:5000/api';

let authMode = 'login';
let targetRole = 'citizen';

function setAuthMessage(message, type = '') {
    const messageNode = document.getElementById('authMessage');
    if (!messageNode) return;
    messageNode.textContent = message || '';
    messageNode.className = 'auth-message';
    if (type) messageNode.classList.add(type);
}

function updateAuthUi() {
    const titleNode = document.getElementById('authTitle');
    const subtitleNode = document.getElementById('authSubtitle');
    const nameWrapper = document.getElementById('nameFieldWrapper');
    const submitBtn = document.getElementById('authSubmitBtn');
    const loginTab = document.getElementById('loginTabBtn');
    const signupTab = document.getElementById('signupTabBtn');

    if (!titleNode || !subtitleNode || !nameWrapper || !submitBtn || !loginTab || !signupTab) return;

    const roleText = targetRole === 'admin' ? 'Admin' : 'Citizen';
    titleNode.textContent = `${roleText} ${authMode === 'login' ? 'Login' : 'Signup'}`;
    subtitleNode.textContent = authMode === 'login'
        ? `Login to continue to ${roleText} dashboard.`
        : `Create a new ${roleText} account to continue.`;

    nameWrapper.style.display = authMode === 'signup' ? 'flex' : 'none';
    submitBtn.textContent = authMode === 'login' ? 'Login' : 'Create Account';

    loginTab.classList.toggle('active', authMode === 'login');
    signupTab.classList.toggle('active', authMode === 'signup');
}

function openAuthModal(role) {
    targetRole = role === 'admin' ? 'admin' : 'citizen';
    const modal = document.getElementById('authModal');
    if (!modal) return;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    setAuthMessage('');
    updateAuthUi();
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

function saveAuthSession(payload) {
    const authData = {
        token: payload.token,
        user: payload.user,
        loggedInAt: new Date().toISOString()
    };
    localStorage.setItem('smartcityAuth', JSON.stringify(authData));
}

function redirectToDashboard(role) {
    window.location.href = role === 'admin' ? 'admin.html' : 'citizen.html';
}

async function submitAuthForm(event) {
    event.preventDefault();

    const name = document.getElementById('authName')?.value?.trim() || '';
    const email = document.getElementById('authEmail')?.value?.trim() || '';
    const password = document.getElementById('authPassword')?.value || '';

    if (!email || !password || (authMode === 'signup' && !name)) {
        setAuthMessage('Please fill all required fields.', 'error');
        return;
    }

    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/signup';
    const payload = {
        email,
        password,
        role: targetRole
    };

    if (authMode === 'signup') payload.name = name;

    setAuthMessage('Please wait...', '');

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Authentication failed');
        }

        saveAuthSession(result);
        setAuthMessage(result.message || 'Success! Redirecting...', 'success');

        setTimeout(() => {
            redirectToDashboard(result.user?.role || targetRole);
        }, 350);
    } catch (error) {
        setAuthMessage(error.message || 'Something went wrong', 'error');
    }
}

function initializeAuth() {
    document.querySelectorAll('.auth-trigger').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            const role = button.getAttribute('data-role') || 'citizen';
            openAuthModal(role);
        });
    });

    const closeBtn = document.getElementById('authCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);

    const modal = document.getElementById('authModal');
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeAuthModal();
        });
    }

    const loginTab = document.getElementById('loginTabBtn');
    const signupTab = document.getElementById('signupTabBtn');
    if (loginTab) {
        loginTab.addEventListener('click', () => {
            authMode = 'login';
            setAuthMessage('');
            updateAuthUi();
        });
    }

    if (signupTab) {
        signupTab.addEventListener('click', () => {
            authMode = 'signup';
            setAuthMessage('');
            updateAuthUi();
        });
    }

    const form = document.getElementById('authForm');
    if (form) form.addEventListener('submit', submitAuthForm);

    // If already logged in, direct to dashboard by role
    const existingSession = localStorage.getItem('smartcityAuth');
    if (existingSession) {
        try {
            const parsed = JSON.parse(existingSession);
            if (parsed?.user?.role === 'admin' || parsed?.user?.role === 'citizen') {
                // Keep user on landing page unless they click a panel button
            }
        } catch (_) {
            localStorage.removeItem('smartcityAuth');
        }
    }

    updateAuthUi();
}

document.addEventListener('DOMContentLoaded', initializeAuth);
