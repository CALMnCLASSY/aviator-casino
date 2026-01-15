/**
 * ClassyBet Casino Game Logic
 * Handles generic bet placement and results for non-Aviator games.
 */

class CasinoGame {
    constructor(gameId, gameName) {
        this.gameId = gameId;
        this.gameName = gameName;
        this.apiBase = this.getApiBase();
        this.token = localStorage.getItem('user_token');
        const userData = localStorage.getItem('userData');
        this.userId = userData ? JSON.parse(userData)._id : null;

        if (!this.token) {
            window.location.href = 'index.html';
        }

        this.init();
    }

    getApiBase() {
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        return isLocalhost ? 'http://localhost:3001' : 'https://aviator-casino.onrender.com';
    }

    init() {
        this.updateAuthUI();
        this.fetchBalance();
        this.setupEventListeners();
    }

    async fetchBalance() {
        try {
            const response = await fetch(`${this.apiBase}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await response.json();
            if (data.user) {
                this.updateBalanceUI(data.user.balance);
            }
        } catch (error) {
            console.error('Failed to fetch balance:', error);
        }
    }

    updateBalanceUI(amount) {
        const balanceEl = document.getElementById('headerBalance');
        if (balanceEl) {
            balanceEl.textContent = `KES ${parseFloat(amount).toFixed(2)}`;
        }
    }

    updateAuthUI() {
        const username = localStorage.getItem('username');
        if (username) {
            const usernameEl = document.getElementById('userName');
            if (usernameEl) usernameEl.textContent = username;
        }
    }

    async placeBet(amount) {
        if (amount < 10) {
            alert('Minimum bet is KES 10');
            return;
        }

        try {
            this.setLoading(true);

            const response = await fetch(`${this.apiBase}/api/casino/play`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    gameId: this.gameId,
                    amount: parseFloat(amount)
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Bet failed');
            }

            this.updateBalanceUI(data.balance);
            this.handleResult(data);

        } catch (error) {
            alert(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        const btn = document.getElementById('playBtn');
        if (btn) {
            btn.disabled = isLoading;
            btn.innerHTML = isLoading ? '<i class="fas fa-spinner fa-spin"></i> Processing...' : 'Place Bet';
        }
    }

    handleResult(data) {
        const resultEl = document.getElementById('gameResult');
        const overlayEl = document.getElementById('resultOverlay');

        if (data.isWin) {
            this.showWinAnimation(data.winAmount, data.multiplier);
        } else {
            this.showLossAnimation();
        }
    }

    showWinAnimation(amount, multiplier) {
        // Generic win animation - can be overridden
        const message = `YOU WON! <br> <span style="font-size: 1.5em; color: #36cb12;">KES ${amount}</span> <br> (${multiplier}x)`;
        this.showOverlay(message, 'win');
    }

    showLossAnimation() {
        // Generic loss animation
        this.showOverlay('Better luck next time!', 'loss');
    }

    showOverlay(html, type) {
        const overlay = document.getElementById('resultOverlay');
        const content = overlay.querySelector('.result-content');

        if (overlay && content) {
            content.innerHTML = html;
            overlay.className = `game-result-overlay active ${type}`;

            setTimeout(() => {
                overlay.className = 'game-result-overlay';
            }, 3000);
        }
    }

    setupEventListeners() {
        const playBtn = document.getElementById('playBtn');
        const amountInput = document.getElementById('betAmount');
        const quickAmounts = document.querySelectorAll('.quick-amount');

        if (playBtn && amountInput) {
            playBtn.addEventListener('click', () => {
                this.placeBet(amountInput.value);
            });
        }

        quickAmounts.forEach(btn => {
            btn.addEventListener('click', () => {
                if (amountInput) amountInput.value = btn.dataset.amount;
            });
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.clear();
                window.location.href = 'index.html';
            });
        }
    }
}
