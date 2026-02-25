// Authentication and registration system
class AuthManager {
    constructor() {
        // Backend URL configuration
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        this.apiBase = isLocalhost ? 'http://localhost:3001' : 'https://aviator-casino.onrender.com';

        console.log('API Base URL:', this.apiBase);
        console.log('Frontend URL:', window.location.origin);
        this.init();
    }

    init() {
        this.loadCountryCodes();
        this.setupEventListeners();
        this.checkExistingAuth();
        this.generateUserIdPreview();
        this.checkReferralCode();
    }

    // Check for referral code in URL and auto-fill
    checkReferralCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');

        if (refCode) {
            const promoInput = document.getElementById('promoCode');
            if (promoInput) {
                promoInput.value = refCode.toUpperCase();
                // Highlight the field
                promoInput.style.border = '2px solid #30fcbe';
                promoInput.style.background = 'rgba(48, 252, 190, 0.1)';
                promoInput.style.fontWeight = '600';
            }

            // Switch to register tab if not already there
            const registerTab = document.getElementById('registerTab');
            const loginTab = document.getElementById('loginTab');
            if (registerTab && loginTab) {
                switchAuthTab('register');
            }
        }
    }

    // Load country codes into select
    loadCountryCodes() {
        const countrySelect = document.getElementById('countryCode');
        if (!countrySelect || !window.countryCodes) return;

        // Clear existing options
        countrySelect.innerHTML = '';

        const sortedCountries = [...window.countryCodes].sort((a, b) => a.name.localeCompare(b.name));
        const kenyaIndex = sortedCountries.findIndex(country => country.name === 'Kenya');
        if (kenyaIndex > 0) {
            const [kenya] = sortedCountries.splice(kenyaIndex, 1);
            sortedCountries.unshift(kenya);
        }

        // Add country codes
        sortedCountries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.code;
            option.textContent = `${country.flag} ${country.name} (${country.code})`;
            option.setAttribute('data-pattern', country.pattern);
            option.setAttribute('data-placeholder', country.placeholder);
            countrySelect.appendChild(option);
        });

        const kenyaOption = countrySelect.querySelector('option[value="+254"]');
        if (kenyaOption) {
            kenyaOption.selected = true;
        }

        // Update phone input when country changes
        countrySelect.addEventListener('change', () => {
            const selectedOption = countrySelect.selectedOptions[0];
            const phoneInput = document.getElementById('phone');
            if (selectedOption && phoneInput) {
                phoneInput.placeholder = selectedOption.getAttribute('data-placeholder');
                phoneInput.pattern = selectedOption.getAttribute('data-pattern');
            }
        });

        // Set default placeholder
        if (countrySelect.selectedOptions[0]) {
            const phoneInput = document.getElementById('phone');
            if (phoneInput) {
                const selectedOption = countrySelect.selectedOptions[0];
                phoneInput.placeholder = selectedOption.getAttribute('data-placeholder');
                phoneInput.pattern = selectedOption.getAttribute('data-pattern');
            }
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // OTP form
        const otpForm = document.getElementById('otpForm');
        if (otpForm) {
            otpForm.addEventListener('submit', (e) => this.handleVerifyOTP(e));
        }

        // Demo button
        const demoBtn = document.getElementById('demoBtn');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => this.handleDemo());
        }

        // Password confirmation matching
        const confirmPassword = document.getElementById('confirmPassword');
        const registerPassword = document.getElementById('registerPassword');
        if (confirmPassword && registerPassword) {
            confirmPassword.addEventListener('input', () => {
                if (confirmPassword.value && registerPassword.value) {
                    if (confirmPassword.value === registerPassword.value) {
                        confirmPassword.style.borderColor = 'var(--success-color)';
                    } else {
                        confirmPassword.style.borderColor = 'var(--error-color)';
                    }
                } else {
                    confirmPassword.style.borderColor = 'var(--border-color)';
                }
            });
        }
    }

    // Check for existing authentication
    async syncUserBalance() {
        const token = localStorage.getItem('user_token');
        if (!token) return;

        try {
            const response = await fetch(`${this.apiBase}/api/users/balance`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const userData = localStorage.getItem('userData');
                if (userData) {
                    const user = JSON.parse(userData);
                    user.balance = data.balance;
                    localStorage.setItem('userData', JSON.stringify(user));
                    // Update any displayed balance
                    const balanceDisplay = document.getElementById('nav-balance');
                    if (balanceDisplay && typeof window.formatCurrency === 'function') {
                        balanceDisplay.textContent = window.formatCurrency(data.balance, user.currency);
                    }
                }
            }
        } catch (error) {
            console.error('Error syncing balance:', error);
        }
    }

    checkExistingAuth() {
        const token = localStorage.getItem('user_token');
        if (token) {
            // Verify token is still valid and sync balance
            fetch(`${this.apiBase}/api/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(response => {
                    if (response.ok) {
                        // Token is valid, redirect to game
                        window.location.href = 'base.html';
                    } else {
                        // Token expired, remove it
                        localStorage.removeItem('user_token');
                    }
                })
                .catch(error => {
                    console.error('Auth check failed:', error);
                });
        }
    }

    // Generate preview User ID for registration
    generateUserIdPreview() {
        const userId = this.generateUserId();
        const userIdElement = document.getElementById('generatedUserId');
        if (userIdElement) {
            userIdElement.textContent = userId;
        }
    }

    // Generate random User ID
    generateUserId() {
        return Math.random().toString(36).substr(2, 4).toUpperCase() +
            Math.random().toString(36).substr(2, 4).toUpperCase();
    }

    // Handle login
    async handleLogin(e) {
        e.preventDefault();

        const loginBtn = document.getElementById('loginBtn');
        const errorElement = document.getElementById('loginError');
        const successElement = document.getElementById('loginSuccess');

        const formData = {
            login: document.getElementById('loginIdentifier').value.trim(),
            password: document.getElementById('loginPassword').value
        };

        try {
            this.setLoading(loginBtn, true);
            this.hideMessage(errorElement);
            this.hideMessage(successElement);

            console.log('Attempting login with:', formData.login);

            const response = await fetch(`${this.apiBase}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            console.log('Login response status:', response.status);

            let data;
            try {
                data = await response.json();
                console.log('Login response data:', data);
            } catch (parseError) {
                console.error('Failed to parse response JSON:', parseError);
                throw new Error('Invalid server response');
            }

            if (response.ok) {
                // Store token and user data immediately
                localStorage.setItem('user_token', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.removeItem('isDemo');

                if (data.requiresVerification) {
                    // Show OTP popup then redirect to dashboard
                    this.showOTPVerification(data.userId, data.email, data.otp);
                    return;
                }

                // Store token and user data
                localStorage.setItem('user_token', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                // Clear demo flag for real users
                localStorage.removeItem('isDemo');

                this.showMessage(successElement, 'Login successful! Redirecting...');

                // Redirect after short delay
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);

            } else {
                this.showMessage(errorElement, data.error || 'Login failed');
            }

        } catch (error) {
            console.error('Login error:', error);
            if (error.message.includes('fetch')) {
                this.showMessage(errorElement, 'Cannot connect to server. Please check if the backend is running.');
            } else {
                this.showMessage(errorElement, 'Login failed. Please try again.');
            }
        } finally {
            this.setLoading(loginBtn, false);
        }
    }

    // Handle registration
    async handleRegister(e) {
        e.preventDefault();

        const registerBtn = document.getElementById('registerBtn');
        const errorElement = document.getElementById('registerError');
        const successElement = document.getElementById('registerSuccess');
        const userIdInfo = document.getElementById('userIdInfo');

        // Validate passwords match
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            this.showMessage(errorElement, 'Passwords do not match');
            return;
        }

        // Validate terms agreement
        if (!document.getElementById('agreeTerms').checked) {
            this.showMessage(errorElement, 'You must agree to the terms and conditions');
            return;
        }

        // Clean up phone number first
        const phone = document.getElementById('phone').value.trim().replace(/\D/g, '');

        // Format email properly
        let email = document.getElementById('email').value.trim();
        email = email ? email.toLowerCase() : null;

        // Get promo code if provided
        const promoCodeInput = document.getElementById('promoCode');
        const promoCode = promoCodeInput ? promoCodeInput.value.trim() : '';

        const formData = {
            username: document.getElementById('username').value.trim(),
            email: email,
            password: password,
            phone: phone,
            countryCode: document.getElementById('countryCode').value
        };

        // Add promo code if provided
        if (promoCode) {
            formData.promoCode = promoCode;
        }

        console.log('Sending registration data:', {
            ...formData,
            password: '[REDACTED]',
            phone: formData.phone ? formData.phone.replace(/\d(?=\d{4})/g, '*') : null
        });

        try {
            this.setLoading(registerBtn, true);
            this.hideMessage(errorElement);
            this.hideMessage(successElement);

            const response = await fetch(`${this.apiBase}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            console.log('Registration response:', data);

            if (response.ok) {
                // Store token and user data immediately
                localStorage.setItem('user_token', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.removeItem('isDemo');

                if (data.requiresVerification) {
                    // Show OTP popup then redirect to dashboard
                    this.showOTPVerification(data.userId, data.email, data.otp);
                    return;
                }

                // Show User ID
                document.getElementById('generatedUserId').textContent = data.user.userId;
                userIdInfo.style.display = 'block';

                this.showMessage(successElement, 'Registration successful! Redirecting...');

                // Redirect after delay to show User ID
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 3000);

            } else {
                let errorMessage = 'Registration failed. Please try again.';

                // Handle validation errors
                if (data.details && Array.isArray(data.details)) {
                    errorMessage = data.details.map(detail => detail.msg).join('\n');
                    console.error('Validation errors:', data.details);
                } else if (data.errors && typeof data.errors === 'object') {
                    // Handle Express-validator errors
                    errorMessage = Object.values(data.errors).join('\n');
                    console.error('Validation errors:', data.errors);
                } else if (data.error && typeof data.error === 'string') {
                    // Handle single error message
                    errorMessage = data.error;
                    console.error('Registration error:', data.error);
                } else if (data.message) {
                    // Handle message format
                    errorMessage = data.message;
                    console.error('Registration error:', data.message);
                }

                this.showMessage(errorElement, errorMessage);
            }

        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage(errorElement, 'Network error. Please try again.');
        } finally {
            this.setLoading(registerBtn, false);
        }
    }

    // Handle demo login
    async handleDemo() {
        const demoBtn = document.getElementById('demoBtn');

        try {
            this.setLoading(demoBtn, true);

            const response = await fetch(`${this.apiBase}/api/auth/demo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                // Store demo session data from backend
                localStorage.setItem('user_token', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('isDemo', 'true');

                console.log('Demo session created via backend');

                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                throw new Error(data.error || 'Failed to create demo session');
            }

        } catch (error) {
            console.error('Demo error:', error);
            alert('Failed to start demo. Please try again.');
        } finally {
            this.setLoading(demoBtn, false);
        }
    }

    // --- OTP Handlers ---

    showOTPVerification(userId, email, otp) {
        // UI Switching
        if (typeof window.switchAuthTab === 'function') {
            window.switchAuthTab('otp');
        } else {
            document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            const otpTab = document.getElementById('otpTab');
            if (otpTab) otpTab.classList.add('active');
        }

        // Set data
        const userIdInput = document.getElementById('otpUserId');
        const emailDisplay = document.getElementById('otpEmailDisplay');
        if (userIdInput) userIdInput.value = userId;
        if (emailDisplay) emailDisplay.textContent = email || 'your account';

        // Start resend countdown
        this.startResendCountdown(120);

        // Focus OTP input
        const otpCodeInput = document.getElementById('otpCode');
        if (otpCodeInput) otpCodeInput.focus();

        // Simulate loading, then show the OTP popup
        if (otp) {
            setTimeout(() => this.showOTPPopup(otp), 1500);
        }
    }

    showOTPPopup(otp) {
        const existing = document.getElementById('otp-reveal-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'otp-reveal-modal';
        modal.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.78);z-index:99999;
            display:flex;align-items:center;justify-content:center;
        `;
        modal.innerHTML = `
            <div style="background:#1a1a2e;border:1px solid rgba(48,252,190,0.4);border-radius:16px;
                        padding:2.5rem 2rem;text-align:center;max-width:360px;width:90%;
                        box-shadow:0 0 40px rgba(48,252,190,0.15);">
                <div style="font-size:2.5rem;margin-bottom:1rem;">🔐</div>
                <h3 style="color:#30fcbe;margin:0 0 0.5rem;font-size:1.2rem;">Your Verification Code</h3>
                <p style="color:#aaa;font-size:0.85rem;margin:0 0 1.5rem;">Enter this code to complete verification</p>
                <div id="otp-code-display"
                     style="font-size:2.4rem;font-weight:900;letter-spacing:10px;color:#fff;
                            background:rgba(48,252,190,0.1);border:2px solid rgba(48,252,190,0.4);
                            border-radius:12px;padding:0.75rem 1rem;cursor:pointer;
                            user-select:all;margin-bottom:0.75rem;"
                     title="Click to copy">${otp}</div>
                <p style="color:#666;font-size:0.75rem;margin:0 0 1.5rem;">↑ Click the code to copy it</p>
                <button id="otp-popup-got-it"
                        style="background:linear-gradient(135deg,#30fcbe,#00d4a0);color:#000;
                               font-weight:700;border:none;border-radius:8px;padding:0.75rem 2rem;
                               font-size:1rem;cursor:pointer;width:100%;">
                    Got it! ✓
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // Click code = copy
        modal.querySelector('#otp-code-display').addEventListener('click', function () {
            navigator.clipboard && navigator.clipboard.writeText(otp);
            this.style.background = 'rgba(48,252,190,0.3)';
            setTimeout(() => this.style.background = 'rgba(48,252,190,0.1)', 600);
        });

        // Got it button: close popup and redirect to dashboard
        modal.querySelector('#otp-popup-got-it').addEventListener('click', () => {
            modal.remove();
            window.location.href = 'dashboard.html';
        });

        // Auto-fill OTP input immediately
        const otpInput = document.getElementById('otpCode');
        if (otpInput) otpInput.value = otp;
    }

    startResendCountdown(seconds) {
        const resendBtn = document.getElementById('resendBtn');
        const countdownEl = document.getElementById('resendCountdown');
        if (!resendBtn) return;

        this.resendWait = seconds;
        resendBtn.disabled = true;
        resendBtn.style.opacity = '0.5';
        resendBtn.style.cursor = 'not-allowed';

        if (this.resendInterval) clearInterval(this.resendInterval);

        this.resendInterval = setInterval(() => {
            this.resendWait--;
            const mins = Math.floor(this.resendWait / 60);
            const secs = this.resendWait % 60;
            if (countdownEl) {
                countdownEl.textContent = `You can resend in ${mins}:${secs < 10 ? '0' : ''}${secs}`;
            }

            if (this.resendWait <= 0) {
                clearInterval(this.resendInterval);
                resendBtn.disabled = false;
                resendBtn.style.opacity = '1';
                resendBtn.style.cursor = 'pointer';
                if (countdownEl) countdownEl.textContent = '';
            }
        }, 1000);
    }

    async handleVerifyOTP(e) {
        if (e) e.preventDefault();

        const verifyBtn = document.getElementById('verifyOtpBtn');
        const errorElement = document.getElementById('otpError');
        const successElement = document.getElementById('otpSuccess');

        const userId = document.getElementById('otpUserId').value;
        const otp = document.getElementById('otpCode').value.trim();

        if (otp.length !== 6) {
            this.showMessage(errorElement, 'Please enter a 6-digit code');
            return;
        }

        try {
            this.setLoading(verifyBtn, true);
            this.hideMessage(errorElement);
            this.hideMessage(successElement);

            const response = await fetch(`${this.apiBase}/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, otp })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage(successElement, 'Email verified! Logging you in...');

                // Store session
                localStorage.setItem('user_token', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.removeItem('isDemo');

                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            } else {
                this.showMessage(errorElement, data.error || 'Verification failed');
            }
        } catch (error) {
            console.error('OTP Verification error:', error);
            this.showMessage(errorElement, 'Error connecting to server');
        } finally {
            this.setLoading(verifyBtn, false);
        }
    }

    async handleResendOTP() {
        if (this.resendWait > 0) return;

        const userId = document.getElementById('otpUserId').value;
        const email = document.getElementById('otpEmailDisplay').textContent;
        const successElement = document.getElementById('otpSuccess');
        const errorElement = document.getElementById('otpError');

        try {
            const response = await fetch(`${this.apiBase}/api/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, email })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage(successElement, 'A new code has been generated.');
                this.startResendCountdown(120);
                // Show the new code in popup
                if (data.otp) this.showOTPPopup(data.otp);
            } else {
                this.showMessage(errorElement, data.error || 'Failed to resend code');
            }
        } catch (error) {
            this.showMessage(errorElement, 'Failed to get new code. Check connection.');
        }
    }

    // Utility methods
    setLoading(button, isLoading) {
        if (isLoading) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            button.disabled = true;
        } else {
            // Restore original text based on button ID
            if (button.id === 'loginBtn') {
                button.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            } else if (button.id === 'registerBtn') {
                button.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
            } else if (button.id === 'demoBtn') {
                button.innerHTML = '<i class="fas fa-play"></i> Try Demo Version';
            } else if (button.id === 'verifyOtpBtn') {
                button.innerHTML = '<i class="fas fa-check-circle"></i> Verify Email';
            }
            button.disabled = false;
        }
    }

    showMessage(element, message) {
        // Replace newlines with HTML line breaks
        element.innerHTML = message.replace(/\n/g, '<br>');
        element.style.display = 'block';

        // Auto-hide after 8 seconds for validation errors
        setTimeout(() => {
            this.hideMessage(element);
        }, 8000);
    }

    hideMessage(element) {
        element.style.display = 'none';
    }
}

// Tab switching functionality
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');

    // Add active class to clicked button
    event.target.classList.add('active');
}

// Password visibility toggle
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Modal functionality
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal(e.target.id);
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.style.display === 'flex') {
                closeModal(modal.id);
            }
        });
    }
});

// Initialize authentication manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

// Global tab switching function for authentication tabs
window.switchAuthTab = function (tabType) {
    console.log('Switching to tab:', tabType);

    // Remove active class from all tabs and contents
    document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to clicked tab and corresponding content
    const clickedButton = document.querySelector(`[onclick="switchAuthTab('${tabType}')"]`);
    if (clickedButton) {
        clickedButton.classList.add('active');
        console.log('Button activated:', clickedButton);
    }

    // Fix the ID format - HTML uses 'loginTab' and 'registerTab', not 'login-tab'
    const tabContent = document.getElementById(`${tabType}Tab`);
    if (tabContent) {
        tabContent.classList.add('active');
        console.log('Tab content activated:', tabContent.id);
    } else {
        console.error('Tab content not found for ID:', `${tabType}Tab`);
    }
};

// Export for global access
window.AuthManager = AuthManager;