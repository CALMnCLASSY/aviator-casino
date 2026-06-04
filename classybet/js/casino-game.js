/**
 * ClassyBet Casino Game Logic
 * Handles generic bet placement and results for non-Aviator games.
 */

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
        this.balance = 0;

        if (!this.token) {
            window.location.href = 'index.html';
        }

        this.init();
    }

    getApiBase() {
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        return isLocalhost ? 'http://localhost:4000' : 'https://back.classybetaviator.com';
    }

    init() {
        this.updateAuthUI();
        this.fetchBalance();
        this.setupEventListeners();
        this.checkFirstTimeUser();
        this.replaceKESInDOM();
        
        // Periodic replacement in case content is loaded dynamically
        setTimeout(() => this.replaceKESInDOM(), 500);
        setTimeout(() => this.replaceKESInDOM(), 1500);
        setTimeout(() => this.replaceKESInDOM(), 3000);
    }

    checkFirstTimeUser() {
        const storageKey = `${this.gameId}_howToPlayShown`;
        const hasSeenModal = localStorage.getItem(storageKey);

        if (!hasSeenModal) {
            // Wait a moment for the page to load, then show modal
            setTimeout(() => {
                this.showHowToPlayModal();
            }, 500);
        }
    }

    showHowToPlayModal() {
        const modal = document.getElementById('howToPlayModal');
        if (modal) {
            modal.classList.add('active');

            // Setup close button
            const closeBtn = modal.querySelector('.close-modal');
            const startBtn = modal.querySelector('.btn-start-playing');
            const dontShowCheckbox = modal.querySelector('#dontShowAgain');

            const closeModal = () => {
                modal.classList.remove('active');

                // Save preference if checkbox is checked
                if (dontShowCheckbox && dontShowCheckbox.checked) {
                    localStorage.setItem(`${this.gameId}_howToPlayShown`, 'true');
                }
            };

            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (startBtn) startBtn.addEventListener('click', closeModal);
        }
    }

    async fetchBalance() {
        try {
            const response = await fetch(`${this.apiBase}/api/auth/profile`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await response.json();
            if (data.balance !== undefined) {
                this.balance = data.balance;
                this.updateBalanceUI(data.balance);
                this.updateUserDataBalance(data.balance);
            }
        } catch (error) {
            console.error('Failed to fetch balance:', error);
            // Fallback to local stored balance if server is offline
            const userDataStr = localStorage.getItem('userData');
            if (userDataStr) {
                const userData = JSON.parse(userDataStr);
                if (userData.balance !== undefined) {
                    this.balance = userData.balance;
                    this.updateBalanceUI(this.balance);
                }
            }
        }
    }

    updateBalanceUI(amount) {
        this.balance = parseFloat(amount) || 0;
        const balanceEl = document.getElementById('headerBalance');
        if (balanceEl) {
            balanceEl.textContent = this.formatCurrency(amount);
        }
        const otherBalances = document.querySelectorAll('.balance-amount, #balance, #user-balance');
        otherBalances.forEach(el => {
            el.textContent = this.formatCurrency(amount);
        });
    }

    updateUserDataBalance(newBalance) {
        try {
            const userDataStr = localStorage.getItem('userData');
            if (userDataStr) {
                const userData = JSON.parse(userDataStr);
                userData.balance = newBalance;
                localStorage.setItem('userData', JSON.stringify(userData));
            }
        } catch (e) {
            console.error('Failed to update userData balance in localStorage:', e);
        }
    }

    updateAuthUI() {
        const username = localStorage.getItem('username');
        if (username) {
            const usernameEl = document.getElementById('userName');
            if (usernameEl) usernameEl.textContent = username;
        }
    }

    getUserCurrency() {
        try {
            const userData = localStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                return user.currency || 'KES';
            }
        } catch (error) {
            console.warn('Error getting user currency:', error);
        }
        return 'KES';
    }

    getCurrencySymbol(currencyCode) {
        const symbols = {
            KES: 'KSh',
            NGN: '₦',
            GHS: 'GH₵',
            ZAR: 'R',
            USD: '$',
            GBP: '£',
            EUR: '€',
            XAF: 'FCFA',
            XOF: 'CFA',
            UGX: 'USh',
            TZS: 'TSh',
            RWF: 'FRw'
        };
        return symbols[currencyCode] || currencyCode;
    }

    formatCurrency(amount) {
        const currency = this.getUserCurrency();
        const symbol = this.getCurrencySymbol(currency);
        const numAmount = parseFloat(amount) || 0;
        const formattedAmount = numAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return `${symbol} ${formattedAmount}`;
    }

    replaceKESInDOM() {
        try {
            const currency = this.getUserCurrency();
            const symbol = this.getCurrencySymbol(currency);
            
            // 1. Walk through the document text nodes and replace "KES" or "KSh"
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            let node;
            while (node = walker.nextNode()) {
                if (node.nodeValue.includes('KES')) {
                    node.nodeValue = node.nodeValue.replace(/KES/g, symbol);
                }
                if (node.nodeValue.includes('KSh')) {
                    node.nodeValue = node.nodeValue.replace(/KSh/g, symbol);
                }
            }

            // 2. Replace placeholders in input fields
            const inputs = document.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                if (input.placeholder && input.placeholder.includes('KES')) {
                    input.placeholder = input.placeholder.replace(/KES/g, symbol);
                }
                if (input.placeholder && input.placeholder.includes('KSh')) {
                    input.placeholder = input.placeholder.replace(/KSh/g, symbol);
                }
            });
        } catch (e) {
            console.error('Error replacing KES in DOM:', e);
        }
    }

    // Client-authoritative updates for interactive games
    async placeBetOnGame(amount, description = '') {
        const floatAmount = parseFloat(amount);
        if (isNaN(floatAmount) || floatAmount <= 0) return false;

        // Fetch latest balance first to avoid discrepancies
        await this.fetchBalance();

        if (this.balance < floatAmount) {
            this.showNotification('Insufficient balance', 'error');
            return false;
        }

        // Deduct balance locally
        const newBalance = this.balance - floatAmount;
        this.updateBalanceUI(newBalance);
        this.updateUserDataBalance(newBalance);

        // Send balance update to backend
        try {
            const updateResponse = await fetch(`${this.apiBase}/api/user/balance/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    balance: newBalance,
                    reason: 'game_bet'
                })
            });

            if (!updateResponse.ok) {
                console.error('Failed to update balance on backend');
            }
        } catch (error) {
            console.error('Error updating balance on backend:', error);
        }

        // Record transaction on backend
        try {
            const desc = description || `Bet placed in ${this.gameName}`;
            await fetch(`${this.apiBase}/api/game/record-transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    type: 'bet',
                    amount: -floatAmount,
                    description: desc,
                    game: this.gameId
                })
            });
        } catch (error) {
            console.error('Error recording transaction:', error);
        }

        return true;
    }

    async winBetOnGame(winAmount, description = '') {
        const floatWinAmount = parseFloat(winAmount);
        if (isNaN(floatWinAmount) || floatWinAmount <= 0) return false;

        // Fetch latest balance first to get up-to-date baseline
        await this.fetchBalance();

        // Add to local balance
        const newBalance = this.balance + floatWinAmount;
        this.updateBalanceUI(newBalance);
        this.updateUserDataBalance(newBalance);

        // Send balance update to backend
        try {
            const updateResponse = await fetch(`${this.apiBase}/api/user/balance/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    balance: newBalance,
                    reason: 'game_win'
                })
            });

            if (!updateResponse.ok) {
                console.error('Failed to update balance on backend');
            }
        } catch (error) {
            console.error('Error updating balance on backend:', error);
        }

        // Record transaction on backend
        try {
            const desc = description || `Won in ${this.gameName}`;
            await fetch(`${this.apiBase}/api/game/record-transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    type: 'win',
                    amount: floatWinAmount,
                    description: desc,
                    game: this.gameId
                })
            });
        } catch (error) {
            console.error('Error recording transaction:', error);
        }

        return true;
    }

    async placeBet(amount) {
        if (amount < 10) {
            alert('Minimum bet is ' + this.formatCurrency(10));
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
            this.updateUserDataBalance(data.balance);
            this.handleResult(data);

            // Refresh balance after a short delay to ensure backend has processed
            setTimeout(() => {
                this.fetchBalance();
            }, 1000);

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
        const message = `YOU WON! <br> <span style="font-size: 1.5em; color: #36cb12;">${this.formatCurrency(amount)}</span> <br> (${multiplier}x)`;
        this.showOverlay(message, 'win');
    }

    showLossAnimation() {
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

    showNotification(message, type = 'info') {
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

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

