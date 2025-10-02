// Authentication and registration system
class AuthManager {
    constructor() {
        // Always use same domain - no localhost detection needed
        // Backend will be hosted on same Vercel domain as serverless functions
        // Set API base URL depending on environment
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.apiBase = 'http://localhost:3001';
        } else {
            this.apiBase = window.location.origin;
        }
        
        console.log('API Base URL:', this.apiBase);
        this.init();
    }

    init() {
        this.loadCountryCodes();
        this.setupEventListeners();
        this.checkExistingAuth();
        this.generateUserIdPreview();
    }

    // Load country codes into select
    loadCountryCodes() {
        const countrySelect = document.getElementById('countryCode');
        if (!countrySelect || !window.countryCodes) return;

        // Clear existing options
        countrySelect.innerHTML = '';

        // Add country codes
        window.countryCodes.forEach(country => {
            const option = document.createElement('option');
            option.value = country.code;
            option.textContent = `${country.flag} ${country.code}`;
            option.setAttribute('data-pattern', country.pattern);
            option.setAttribute('data-placeholder', country.placeholder);
            countrySelect.appendChild(option);
        });

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
                phoneInput.placeholder = countrySelect.selectedOptions[0].getAttribute('data-placeholder');
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
    checkExistingAuth() {
        const token = localStorage.getItem('authToken');
        if (token) {
            // Verify token is still valid
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
                    localStorage.removeItem('authToken');
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
                // Store token and user data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                this.showMessage(successElement, 'Login successful! Redirecting...');
                
                // Redirect after short delay
                setTimeout(() => {
                    window.location.href = 'base.html';
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

        const formData = {
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim() || null,
            password: password,
            phone: document.getElementById('phone').value.trim(),
            countryCode: document.getElementById('countryCode').value
        };

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

            if (response.ok) {
                // Store token and user data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                // Show User ID
                document.getElementById('generatedUserId').textContent = data.user.userId;
                userIdInfo.style.display = 'block';
                
                this.showMessage(successElement, 'Registration successful! Redirecting...');
                
                // Redirect after delay to show User ID
                setTimeout(() => {
                    window.location.href = 'base.html';
                }, 3000);
                
            } else {
                if (data.details && Array.isArray(data.details)) {
                    // Show validation errors
                    const errorMessages = data.details.map(detail => detail.msg).join(', ');
                    this.showMessage(errorElement, errorMessages);
                } else {
                    this.showMessage(errorElement, data.error || 'Registration failed');
                }
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

            // Try backend first, fall back to local demo if it fails
            try {
                const response = await fetch(`${this.apiBase}/api/auth/demo`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (response.ok) {
                    // Store demo session data from backend
                    const demoUser = data.user;
                    demoUser.isDemo = true;
                    demoUser.balance = 3000;
                    
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('userData', JSON.stringify(demoUser));
                    localStorage.setItem('isDemo', 'true');
                    
                    console.log('Demo session created via backend:', demoUser.balance);
                    
                    // Redirect to game
                    window.location.href = 'base.html';
                    return;
                }
            } catch (backendError) {
                console.log('Backend not available, creating local demo session');
            }
            
            // Fallback: Create local demo session
            const demoUser = {
                _id: 'demo_' + Date.now(),
                userId: 'DEMO' + Math.random().toString(36).substr(2, 4).toUpperCase(),
                username: 'Demo Player',
                email: null,
                phone: null,
                isDemo: true,
                balance: 3000,
                createdAt: new Date().toISOString()
            };
            
            // Create a simple demo token
            const demoToken = 'demo_' + btoa(JSON.stringify({userId: demoUser._id, isDemo: true}));
            
            localStorage.setItem('authToken', demoToken);
            localStorage.setItem('userData', JSON.stringify(demoUser));
            localStorage.setItem('isDemo', 'true');
            
            console.log('Local demo session created:', demoUser.balance);
            
            // Redirect to game
            window.location.href = 'base.html';

        } catch (error) {
            console.error('Demo error:', error);
            alert('Failed to start demo. Please try again.');
        } finally {
            this.setLoading(demoBtn, false);
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
            }
            button.disabled = false;
        }
    }

    showMessage(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideMessage(element);
        }, 5000);
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
    new AuthManager();
});

// Global tab switching function for authentication tabs
window.switchAuthTab = function(tabType) {
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