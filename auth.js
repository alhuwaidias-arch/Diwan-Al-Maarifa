/**
 * Diwan Al-Maarifa Authentication Module
 * Handles login, registration, and authentication UI
 */

// Initialize authentication state on page load
document.addEventListener('DOMContentLoaded', function() {
    updateAuthUI();
    initializeAuthForms();
});

/**
 * Update UI based on authentication state
 */
function updateAuthUI() {
    const isAuthenticated = apiClient.isAuthenticated();
    const user = apiClient.getCurrentUser();

    // Get UI elements
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');
    const userNameSpan = document.getElementById('userName');
    const shareKnowledgeBtn = document.getElementById('shareKnowledgeBtn');

    if (isAuthenticated && user) {
        // User is logged in
        if (loginBtn) loginBtn.classList.add('d-none');
        if (userMenu) userMenu.classList.remove('d-none');
        if (userNameSpan) userNameSpan.textContent = user.email.split('@')[0];
        if (shareKnowledgeBtn) shareKnowledgeBtn.classList.remove('d-none');
    } else {
        // User is not logged in
        if (loginBtn) loginBtn.classList.remove('d-none');
        if (userMenu) userMenu.classList.add('d-none');
        if (shareKnowledgeBtn) shareKnowledgeBtn.classList.add('d-none');
    }
}

/**
 * Initialize authentication forms
 */
function initializeAuthForms() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Registration form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Forgot password form
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    }
}

/**
 * Handle user login
 */
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitBtn = document.getElementById('loginSubmitBtn');
    const messageDiv = document.getElementById('loginMessage');

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>جاري تسجيل الدخول...';
    messageDiv.classList.add('d-none');

    try {
        const response = await apiClient.login(email, password);

        showMessage(messageDiv, 'success', 'تم تسجيل الدخول بنجاح!');

        // Close modal and update UI
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
            if (modal) modal.hide();
            updateAuthUI();
            window.location.reload();
        }, 1000);

    } catch (error) {
        console.error('Login error:', error);
        showMessage(messageDiv, 'danger', error.message || 'فشل تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>تسجيل الدخول';
    }
}

/**
 * Handle user registration
 */
async function handleRegister(e) {
    e.preventDefault();

    const fullName = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const submitBtn = document.getElementById('registerSubmitBtn');
    const messageDiv = document.getElementById('registerMessage');

    // Validate passwords match
    if (password !== confirmPassword) {
        showMessage(messageDiv, 'danger', 'كلمات المرور غير متطابقة');
        return;
    }

    // Validate password strength
    if (password.length < 8) {
        showMessage(messageDiv, 'danger', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل');
        return;
    }

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>جاري إنشاء الحساب...';
    messageDiv.classList.add('d-none');

    try {
        const response = await apiClient.register({
            full_name: fullName,
            email: email,
            password: password,
            role: 'contributor'
        });

        showMessage(messageDiv, 'success', 'تم إنشاء الحساب بنجاح!');

        // Close modal and update UI
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
            if (modal) modal.hide();
            updateAuthUI();
            window.location.reload();
        }, 1000);

    } catch (error) {
        console.error('Registration error:', error);
        showMessage(messageDiv, 'danger', error.message || 'فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus me-2"></i>إنشاء حساب';
    }
}

/**
 * Handle user logout
 */
function handleLogout(e) {
    e.preventDefault();
    
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        apiClient.logout();
    }
}

/**
 * Handle forgot password
 */
async function handleForgotPassword(e) {
    e.preventDefault();

    const email = document.getElementById('forgotEmail').value.trim();
    const submitBtn = document.getElementById('forgotSubmitBtn');
    const messageDiv = document.getElementById('forgotMessage');

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>جاري الإرسال...';
    messageDiv.classList.add('d-none');

    try {
        await apiClient.forgotPassword(email);

        showMessage(messageDiv, 'success', 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');

        // Close modal after 3 seconds
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal'));
            if (modal) modal.hide();
        }, 3000);

    } catch (error) {
        console.error('Forgot password error:', error);
        showMessage(messageDiv, 'danger', error.message || 'حدث خطأ. يرجى المحاولة مرة أخرى.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>إرسال';
    }
}

/**
 * Helper function to show messages
 */
function showMessage(element, type, message) {
    element.className = `alert alert-${type}`;
    element.textContent = message;
    element.classList.remove('d-none');
}

/**
 * Require authentication for protected pages
 */
function requireAuth() {
    if (!apiClient.isAuthenticated()) {
        alert('يجب تسجيل الدخول للوصول إلى هذه الصفحة');
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

/**
 * Check if user has specific role
 */
function hasRole(requiredRole) {
    const user = apiClient.getCurrentUser();
    if (!user) return false;

    const roleHierarchy = {
        'admin': 5,
        'content_auditor': 4,
        'technical_auditor': 4,
        'contributor': 3,
        'reader': 1
    };

    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}
