/**
 * Base Casino Game Class
 * Provides common functionality for all casino games
 */

class CasinoGame {
    constructor(gameId, gameName) {
        this.gameId = gameId;
        this.gameName = gameName;
        this.apiBase = window.location.origin;
        this.token = this.getAuthToken();
        this.balance = 0;
        
        this.initializeGame();
    }

    initializeGame() {
        // Load user balance
        this.loadBalance();
        
        // Setup common event listeners
        this.setupCommonListeners();
    }

    getAuthToken() {
        // Try to get token from localStorage
        const token = localStorage.getItem('authToken');
        return token || null;
    }

    async loadBalance() {
        try {
            // Try to fetch balance from API
            const response = await fetch(`${this.apiBase}/api/user/balance`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.balance = data.balance;
                this.updateBalanceUI(this.balance);
            } else {
                // Fallback to demo balance
                this.balance = 10000;
                this.updateBalanceUI(this.balance);
            }
        } catch (error) {
            // Demo mode
            this.balance = 10000;
            this.updateBalanceUI(this.balance);
        }
    }

    updateBalanceUI(balance) {
        const balanceElements = document.querySelectorAll('#headerBalance, .balance-amount');
        balanceElements.forEach(el => {
            el.textContent = `KES ${parseFloat(balance).toFixed(2)}`;
        });
    }

    setupCommonListeners() {
        // Logout functionality
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Back to lobby
        const lobbyBtns = document.querySelectorAll('[data-action="lobby"]');
        lobbyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.href = 'dashboard.html';
            });
        });
    }

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = 'index.html';
    }

    // Common utility methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showOverlay(message, type = 'info') {
        // Create overlay element
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            padding: 40px 60px;
            border-radius: 16px;
            z-index: 10000;
            text-align: center;
            border: 3px solid ${type === 'win' ? '#36cb12' : type === 'loss' ? '#d32f2f' : '#ffa726'};
            animation: overlayPop 0.5s ease-out;
            max-width: 90%;
        `;

        overlay.innerHTML = message;
        document.body.appendChild(overlay);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
        }, 3000);
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#36cb12' : type === 'error' ? '#d32f2f' : '#ffa726'};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 10000;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
        `;

        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Format currency
    formatCurrency(amount) {
        return `KES ${parseFloat(amount).toFixed(2)}`;
    }

    // Random number generator
    random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Shuffle array
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Play sound effect (if audio files are available)
    playSound(soundName) {
        try {
            const audio = new Audio(`sounds/${soundName}.mp3`);
            audio.volume = 0.3;
            audio.play().catch(() => {
                // Ignore audio play errors
            });
        } catch (error) {
            // Audio not available
        }
    }

    // Vibrate device (mobile)
    vibrate(duration = 100) {
        if ('vibrate' in navigator) {
            navigator.vibrate(duration);
        }
    }

    // Log game action for analytics
    logGameAction(action, data = {}) {
        console.log(`[${this.gameName}] ${action}`, data);
        
        // Send to analytics API if available
        try {
            fetch(`${this.apiBase}/api/analytics/game-action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    gameId: this.gameId,
                    action: action,
                    data: data,
                    timestamp: new Date().toISOString()
                })
            }).catch(() => {
                // Ignore analytics errors
            });
        } catch (error) {
            // Analytics not available
        }
    }

    // Save game state to localStorage
    saveGameState(state) {
        try {
            localStorage.setItem(`${this.gameId}_state`, JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save game state');
        }
    }

    // Load game state from localStorage
    loadGameState() {
        try {
            const state = localStorage.getItem(`${this.gameId}_state`);
            return state ? JSON.parse(state) : null;
        } catch (error) {
            return null;
        }
    }

    // Clear game state
    clearGameState() {
        try {
            localStorage.removeItem(`${this.gameId}_state`);
        } catch (error) {
            console.warn('Failed to clear game state');
        }
    }
}

// Add CSS animations for overlays
const style = document.createElement('style');
style.textContent = `
    @keyframes overlayPop {
        0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0;
        }
        50% {
            transform: translate(-50%, -50%) scale(1.05);
        }
        100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
        }
    }

    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes resultPop {
        0% {
            transform: scale(0.5);
            opacity: 0;
        }
        50% {
            transform: scale(1.1);
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CasinoGame;
}
