// ClassyBet API Service
class ClassyBetAPI {
    constructor() {
        this.baseURL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
        this.apiPath = '/api';
        this.token = localStorage.getItem('user_token');
        this.user = null;
        this.gameRound = null;
        this.currentBet = null;
        this.callbacks = {
            onAuthChange: [],
            onBalanceUpdate: [],
            onBetUpdate: []
        };
    }

    // Event system
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }

    // Authentication methods
    async login(login, password) {
        try {
            const response = await fetch(`${this.baseURL}${this.apiPath}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('user_token', this.token);
                this.emit('onAuthChange', { authenticated: true, user: this.user });
                return { success: true, user: this.user };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.baseURL}${this.apiPath}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('user_token', this.token);
                this.emit('onAuthChange', { authenticated: true, user: this.user });
                return { success: true, user: this.user };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    }

    async loadProfile() {
        if (!this.token) return { success: false, error: 'Not authenticated' };

        try {
            const response = await fetch(`${this.baseURL}${this.apiPath}/auth/profile`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.user = await response.json();
                this.emit('onAuthChange', { authenticated: true, user: this.user });
                return { success: true, user: this.user };
            } else {
                this.logout();
                return { success: false, error: 'Authentication failed' };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        this.currentBet = null;
        localStorage.removeItem('user_token');
        this.emit('onAuthChange', { authenticated: false, user: null });
    }

    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    // Game methods
    setGameRound(roundId) {
        this.gameRound = roundId;
    }

    async placeBet(amount, cashoutMultiplier = null) {
        if (!this.isAuthenticated() || !this.gameRound) {
            return { success: false, error: 'Not authenticated or no active round' };
        }

        try {
            const response = await fetch(`${this.baseURL}${this.apiPath}/game/bet`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount,
                    cashoutMultiplier,
                    gameRound: this.gameRound
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentBet = data.bet;
                this.user.balance = data.newBalance;
                this.emit('onBetUpdate', { bet: this.currentBet, balance: this.user.balance });
                this.emit('onBalanceUpdate', this.user.balance);
                return { success: true, bet: this.currentBet, newBalance: data.newBalance };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    }

    async cashout(multiplier) {
        if (!this.currentBet || !this.isAuthenticated()) {
            return { success: false, error: 'No active bet or not authenticated' };
        }

        try {
            const response = await fetch(`${this.baseURL}${this.apiPath}/game/cashout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    betId: this.currentBet._id,
                    multiplier
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentBet = data.bet;
                this.user.balance = data.newBalance;
                this.emit('onBetUpdate', { bet: this.currentBet, balance: this.user.balance, winAmount: data.winAmount });
                this.emit('onBalanceUpdate', this.user.balance);
                return { success: true, bet: this.currentBet, newBalance: data.newBalance, winAmount: data.winAmount };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    }

    async getMyCurrentBet() {
        if (!this.isAuthenticated() || !this.gameRound) {
            return { success: false, error: 'Not authenticated or no active round' };
        }

        try {
            const response = await fetch(`${this.baseURL}${this.apiPath}/game/my-bet/${this.gameRound}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const bet = await response.json();
                this.currentBet = bet;
                return { success: true, bet };
            } else {
                return { success: false, error: 'Failed to fetch bet' };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    }

    async getActiveBets() {
        if (!this.gameRound) return { success: false, error: 'No active round' };

        try {
            const response = await fetch(`${this.baseURL}${this.apiPath}/game/active-bets/${this.gameRound}`);
            
            if (response.ok) {
                const bets = await response.json();
                return { success: true, bets };
            } else {
                return { success: false, error: 'Failed to fetch bets' };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    }

    async endRound(crashMultiplier) {
        if (!this.isAuthenticated() || !this.gameRound) {
            return { success: false, error: 'Not authenticated or no active round' };
        }

        try {
            const response = await fetch(`${this.baseURL}${this.apiPath}/game/end-round`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gameRound: this.gameRound,
                    crashMultiplier
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentBet = null; // Clear current bet after round ends
                return { success: true, data };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    }

    // Payment methods
    async depositSTK(amount, phoneNumber) {
        if (!this.isAuthenticated()) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const response = await fetch(`${this.baseURL}${this.apiPath}/payments/stk-push`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount, phoneNumber })
            });

            const data = await response.json();

            if (response.ok) {
                return { success: true, transactionId: data.transactionId };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: 'Connection failed' };
        }
    }

    // Utility methods
    formatBalance(balance) {
        return `KES ${balance.toFixed(2)}`;
    }

    generateGameRound() {
        return `round_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Global API instance
window.classyBetAPI = new ClassyBetAPI();