/**
 * JetX Crash Game Logic
 * Implements multiplier-based crash game mechanics
 */

class JetXGame extends CasinoGame {
    constructor() {
        super('jetx', 'JetX');
        this.gameState = 'waiting'; // waiting, flying, crashed
        this.currentMultiplier = 1.00;
        this.betPlaced = false;
        this.betAmount = 0;
        this.crashPoint = 0;
        this.multiplierInterval = null;
        this.history = [];
        this.setupJetXListeners();
        this.generateLiveBets();
    }

    setupJetXListeners() {
        // Quick amount buttons
        document.querySelectorAll('.quick-amount-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('betAmount').value = btn.dataset.amount;
            });
        });

        // Action button (Bet/Cashout)
        document.getElementById('actionBtn').addEventListener('click', () => {
            if (this.gameState === 'waiting') {
                this.placeBet();
            } else if (this.gameState === 'flying' && this.betPlaced) {
                this.cashOut();
            }
        });

        // Start first round automatically
        setTimeout(() => this.startRound(), 2000);
    }

    placeBet() {
        const amount = parseFloat(document.getElementById('betAmount').value);
        
        if (amount < 10) {
            alert('Minimum bet is KES 10');
            return;
        }

        this.betAmount = amount;
        this.betPlaced = true;

        // Update UI
        const actionBtn = document.getElementById('actionBtn');
        actionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Waiting...';
        actionBtn.disabled = true;

        document.getElementById('gameStatus').textContent = 'Bet placed! Waiting for takeoff...';
    }

    async startRound() {
        if (this.gameState !== 'waiting') return;

        this.gameState = 'flying';
        this.currentMultiplier = 1.00;
        this.crashPoint = this.generateCrashPoint();

        // Update UI
        document.getElementById('gameStatus').textContent = 'JET IS FLYING!';
        document.getElementById('jetIcon').classList.add('flying');
        
        const actionBtn = document.getElementById('actionBtn');
        if (this.betPlaced) {
            actionBtn.innerHTML = '<i class="fas fa-hand-paper"></i> Cash Out';
            actionBtn.disabled = false;
            actionBtn.classList.add('cashout');
        }

        // Start multiplier increment
        this.multiplierInterval = setInterval(() => {
            this.incrementMultiplier();
        }, 100);
    }

    incrementMultiplier() {
        // Increase multiplier
        this.currentMultiplier += 0.01;

        // Update display
        document.getElementById('multiplierDisplay').textContent = this.currentMultiplier.toFixed(2) + 'x';

        // Check auto cashout
        const autoCashout = document.getElementById('autoCashout').checked;
        const autoCashoutValue = parseFloat(document.getElementById('autoCashoutValue').value);
        
        if (autoCashout && this.betPlaced && this.currentMultiplier >= autoCashoutValue) {
            this.cashOut();
            return;
        }

        // Check if crash point reached
        if (this.currentMultiplier >= this.crashPoint) {
            this.crash();
        }
    }

    generateCrashPoint() {
        // Generate crash point with house edge
        // Most crashes happen between 1.00x and 3.00x
        const random = Math.random();
        
        if (random < 0.5) {
            // 50% chance: crash between 1.00x and 2.00x
            return 1.00 + Math.random() * 1.00;
        } else if (random < 0.8) {
            // 30% chance: crash between 2.00x and 5.00x
            return 2.00 + Math.random() * 3.00;
        } else if (random < 0.95) {
            // 15% chance: crash between 5.00x and 10.00x
            return 5.00 + Math.random() * 5.00;
        } else {
            // 5% chance: crash between 10.00x and 50.00x
            return 10.00 + Math.random() * 40.00;
        }
    }

    cashOut() {
        if (!this.betPlaced || this.gameState !== 'flying') return;

        clearInterval(this.multiplierInterval);

        const winAmount = this.betAmount * this.currentMultiplier;
        
        // Show win message
        this.showWinMessage(winAmount, this.currentMultiplier);

        // Reset bet state
        this.betPlaced = false;

        // Update UI
        const actionBtn = document.getElementById('actionBtn');
        actionBtn.innerHTML = '<i class="fas fa-check-circle"></i> Cashed Out!';
        actionBtn.disabled = true;
        actionBtn.classList.remove('cashout');

        // Add to live bets
        this.addLiveBet('You', this.betAmount, this.currentMultiplier, winAmount, true);

        // Continue game for others
        this.multiplierInterval = setInterval(() => {
            this.incrementMultiplier();
        }, 100);
    }

    crash() {
        clearInterval(this.multiplierInterval);
        this.gameState = 'crashed';

        // Update UI
        document.getElementById('multiplierDisplay').classList.add('crashed');
        document.getElementById('jetIcon').classList.remove('flying');
        document.getElementById('gameStatus').textContent = `CRASHED AT ${this.currentMultiplier.toFixed(2)}x`;

        // Show crash animation
        const crashMsg = document.createElement('div');
        crashMsg.className = 'crash-message';
        crashMsg.textContent = 'CRASHED!';
        document.getElementById('gameCanvas').appendChild(crashMsg);
        setTimeout(() => crashMsg.remove(), 1000);

        // Check if player lost
        if (this.betPlaced) {
            this.showLossMessage();
            this.addLiveBet('You', this.betAmount, 0, 0, false);
            this.betPlaced = false;
        }

        // Add to history
        this.addToHistory(this.currentMultiplier);

        // Reset for next round
        setTimeout(() => {
            this.resetRound();
        }, 3000);
    }

    resetRound() {
        this.gameState = 'waiting';
        this.currentMultiplier = 1.00;
        this.betPlaced = false;

        // Reset UI
        document.getElementById('multiplierDisplay').textContent = '1.00x';
        document.getElementById('multiplierDisplay').classList.remove('crashed');
        document.getElementById('gameStatus').textContent = 'Place your bet';
        document.getElementById('jetIcon').classList.remove('flying');

        const actionBtn = document.getElementById('actionBtn');
        actionBtn.innerHTML = '<i class="fas fa-rocket"></i> Place Bet';
        actionBtn.disabled = false;
        actionBtn.classList.remove('cashout');

        // Start next round
        setTimeout(() => this.startRound(), 5000);
    }

    addToHistory(multiplier) {
        this.history.unshift(multiplier);
        if (this.history.length > 10) {
            this.history.pop();
        }

        const historyEl = document.getElementById('multiplierHistory');
        historyEl.innerHTML = '';

        this.history.forEach(mult => {
            const badge = document.createElement('div');
            badge.className = 'multiplier-badge';
            
            if (mult >= 2.00) {
                badge.classList.add('high');
            } else {
                badge.classList.add('low');
            }

            badge.textContent = mult.toFixed(2) + 'x';
            historyEl.appendChild(badge);
        });
    }

    generateLiveBets() {
        const names = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery'];
        const liveBetsList = document.getElementById('liveBetsList');

        // Generate 5 random live bets
        for (let i = 0; i < 5; i++) {
            const name = names[Math.floor(Math.random() * names.length)];
            const amount = Math.floor(Math.random() * 1000) + 50;
            const multiplier = (1 + Math.random() * 4).toFixed(2);
            const winAmount = (amount * multiplier).toFixed(2);
            
            this.addLiveBet(name, amount, multiplier, winAmount, true);
        }
    }

    addLiveBet(playerName, betAmount, multiplier, winAmount, cashed) {
        const liveBetsList = document.getElementById('liveBetsList');
        
        const betItem = document.createElement('div');
        betItem.className = 'bet-item';
        if (cashed) betItem.classList.add('cashed');

        betItem.innerHTML = `
            <div class="player-info">
                <div class="player-name">${playerName}</div>
                <div class="bet-amount">KES ${betAmount.toFixed(2)}</div>
            </div>
            <div class="bet-result">
                ${cashed ? `
                    <div class="multiplier">${multiplier}x</div>
                    <div class="win-amount">+KES ${winAmount.toFixed(2)}</div>
                ` : `
                    <div style="color: #d32f2f;">Lost</div>
                `}
            </div>
        `;

        liveBetsList.insertBefore(betItem, liveBetsList.firstChild);

        // Keep only last 10 bets
        while (liveBetsList.children.length > 10) {
            liveBetsList.removeChild(liveBetsList.lastChild);
        }
    }

    showWinMessage(amount, multiplier) {
        const message = `
            <h2 style="color: #36cb12; font-size: 48px;">CASHED OUT!</h2>
            <div style="font-size: 36px; color: #36cb12; margin: 20px 0;">
                +KES ${amount.toFixed(2)}
            </div>
            <p style="font-size: 24px;">at ${multiplier.toFixed(2)}x</p>
        `;
        
        // Create temporary overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            padding: 40px;
            border-radius: 16px;
            z-index: 1000;
            text-align: center;
            border: 3px solid #36cb12;
            animation: resultPop 0.5s ease-out;
        `;
        overlay.innerHTML = message;
        document.body.appendChild(overlay);

        setTimeout(() => overlay.remove(), 2000);
    }

    showLossMessage() {
        const message = `
            <h2 style="color: #d32f2f; font-size: 48px;">CRASHED!</h2>
            <p style="font-size: 24px; opacity: 0.8;">Better luck next time</p>
        `;
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            padding: 40px;
            border-radius: 16px;
            z-index: 1000;
            text-align: center;
            border: 3px solid #d32f2f;
            animation: resultPop 0.5s ease-out;
        `;
        overlay.innerHTML = message;
        document.body.appendChild(overlay);

        setTimeout(() => overlay.remove(), 2000);
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new JetXGame();
});
