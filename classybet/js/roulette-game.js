/**
 * Roulette Game Logic
 * Implements European roulette with full betting options
 */

class RouletteGame extends CasinoGame {
    constructor() {
        super('roulette', 'European Roulette');
        this.bets = new Map();
        this.chipValue = 10;
        this.isSpinning = false;
        this.recentNumbers = [];
        
        this.redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        this.blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
        
        this.payouts = {
            straight: 35,
            split: 17,
            street: 11,
            corner: 8,
            line: 5,
            row: 2,
            color: 1,
            parity: 1,
            range: 1
        };

        this.setupRouletteListeners();
    }

    setupRouletteListeners() {
        // Chip value buttons
        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.chipValue = parseInt(btn.dataset.value);
                document.getElementById('chipValue').value = this.chipValue;
            });
        });

        // Chip value input
        document.getElementById('chipValue').addEventListener('change', (e) => {
            this.chipValue = parseInt(e.target.value) || 10;
        });

        // Bet spots
        document.querySelectorAll('.bet-spot, .outside-bet').forEach(spot => {
            spot.addEventListener('click', () => {
                if (!this.isSpinning) {
                    this.placeBet(spot.dataset.bet, spot.dataset.type);
                    spot.classList.add('selected');
                }
            });
        });

        // Spin button
        document.getElementById('spinBtn').addEventListener('click', () => {
            this.spin();
        });

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearBets();
        });

        // Repeat button
        document.getElementById('repeatBtn').addEventListener('click', () => {
            this.repeatBets();
        });
    }

    placeBet(betValue, betType) {
        const betKey = `${betType}:${betValue}`;
        
        if (this.bets.has(betKey)) {
            const currentAmount = this.bets.get(betKey);
            this.bets.set(betKey, currentAmount + this.chipValue);
        } else {
            this.bets.set(betKey, this.chipValue);
        }

        this.updateTotalBet();
    }

    updateTotalBet() {
        let total = 0;
        this.bets.forEach(amount => {
            total += amount;
        });

        document.getElementById('totalBetDisplay').textContent = `KES ${total}`;
    }

    clearBets() {
        this.bets.clear();
        this.updateTotalBet();
        
        document.querySelectorAll('.bet-spot, .outside-bet').forEach(spot => {
            spot.classList.remove('selected');
        });
    }

    repeatBets() {
        // Bets are already stored, just need to re-highlight
        document.querySelectorAll('.bet-spot, .outside-bet').forEach(spot => {
            const betKey = `${spot.dataset.type}:${spot.dataset.bet}`;
            if (this.bets.has(betKey)) {
                spot.classList.add('selected');
            }
        });
    }

    async spin() {
        if (this.bets.size === 0) {
            alert('Please place at least one bet');
            return;
        }

        if (this.isSpinning) return;

        this.isSpinning = true;
        document.getElementById('spinBtn').disabled = true;
        document.getElementById('spinBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Spinning...';

        // Animate wheel
        const wheel = document.getElementById('rouletteWheel');
        const wheelInner = document.getElementById('wheelInner');
        wheel.classList.add('wheel-spinning');

        // Generate winning number
        await this.delay(3000);
        const winningNumber = Math.floor(Math.random() * 37); // 0-36

        // Stop wheel animation
        wheel.classList.remove('wheel-spinning');
        
        // Calculate final rotation to land on winning number
        const degreesPerNumber = 360 / 37;
        const finalRotation = winningNumber * degreesPerNumber;
        wheelInner.style.transform = `rotate(${finalRotation}deg)`;

        // Display winning number
        document.getElementById('wheelCenter').textContent = winningNumber;

        await this.delay(1000);

        // Calculate winnings
        const result = this.calculateWinnings(winningNumber);
        
        // Highlight winning spots
        this.highlightWinningSpots(winningNumber);

        // Show result
        await this.delay(500);
        this.showResult(result, winningNumber);

        // Add to recent numbers
        this.addRecentNumber(winningNumber);

        // Reset for next round
        setTimeout(() => {
            this.clearBets();
            this.isSpinning = false;
            document.getElementById('spinBtn').disabled = false;
            document.getElementById('spinBtn').innerHTML = '<i class="fas fa-play-circle"></i> Spin';
            
            document.querySelectorAll('.bet-spot, .outside-bet').forEach(spot => {
                spot.classList.remove('winner');
            });
        }, 4000);
    }

    calculateWinnings(winningNumber) {
        let totalWin = 0;
        const winningBets = [];

        this.bets.forEach((amount, betKey) => {
            const [type, value] = betKey.split(':');
            
            if (this.isBetWinner(winningNumber, type, value)) {
                const payout = this.payouts[type];
                const winAmount = amount * payout;
                totalWin += winAmount + amount; // Include original bet
                winningBets.push({ type, value, amount, winAmount });
            }
        });

        return {
            totalWin,
            winningBets,
            isWin: totalWin > 0
        };
    }

    isBetWinner(number, type, value) {
        switch (type) {
            case 'straight':
                return parseInt(value) === number;
            
            case 'color':
                if (value === 'red') return this.redNumbers.includes(number);
                if (value === 'black') return this.blackNumbers.includes(number);
                return false;
            
            case 'parity':
                if (number === 0) return false;
                if (value === 'even') return number % 2 === 0;
                if (value === 'odd') return number % 2 === 1;
                return false;
            
            case 'range':
                if (value === 'low') return number >= 1 && number <= 18;
                if (value === 'high') return number >= 19 && number <= 36;
                return false;
            
            case 'row':
                if (value === 'row1') return number >= 1 && number <= 12;
                if (value === 'row2') return number >= 13 && number <= 24;
                if (value === 'row3') return number >= 25 && number <= 36;
                return false;
            
            default:
                return false;
        }
    }

    highlightWinningSpots(winningNumber) {
        document.querySelectorAll('.bet-spot, .outside-bet').forEach(spot => {
            const type = spot.dataset.type;
            const value = spot.dataset.bet;
            
            if (this.isBetWinner(winningNumber, type, value)) {
                spot.classList.add('winner');
            }
        });
    }

    showResult(result, winningNumber) {
        const numberColor = winningNumber === 0 ? 'green' : 
                           this.redNumbers.includes(winningNumber) ? 'red' : 'black';
        
        let message = `
            <div style="text-align: center;">
                <h2 style="font-size: 72px; margin-bottom: 20px;">
                    <span style="color: ${numberColor === 'red' ? '#d32f2f' : numberColor === 'black' ? '#000' : '#36cb12'};">
                        ${winningNumber}
                    </span>
                </h2>
                <p style="font-size: 24px; margin-bottom: 20px; text-transform: uppercase; color: ${numberColor === 'red' ? '#d32f2f' : numberColor === 'black' ? '#fff' : '#36cb12'};">
                    ${numberColor}
                </p>
        `;

        if (result.isWin) {
            message += `
                <h3 style="color: #36cb12; font-size: 48px; margin: 20px 0;">YOU WIN!</h3>
                <div style="font-size: 42px; color: #36cb12; margin: 15px 0;">
                    +KES ${result.totalWin.toFixed(2)}
                </div>
            `;
        } else {
            message += `
                <h3 style="color: #d32f2f; font-size: 36px; margin: 20px 0;">NO WIN</h3>
                <p style="font-size: 20px; opacity: 0.8;">Better luck next time!</p>
            `;
        }

        message += `</div>`;

        // Create temporary result display
        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            padding: 50px;
            border-radius: 20px;
            z-index: 1000;
            border: 3px solid ${result.isWin ? '#36cb12' : '#d32f2f'};
            animation: resultPop 0.5s ease-out;
            min-width: 400px;
        `;
        resultDiv.innerHTML = message;
        document.body.appendChild(resultDiv);

        setTimeout(() => resultDiv.remove(), 3500);
    }

    addRecentNumber(number) {
        this.recentNumbers.unshift(number);
        if (this.recentNumbers.length > 10) {
            this.recentNumbers.pop();
        }

        const recentNumbersEl = document.getElementById('recentNumbers');
        recentNumbersEl.innerHTML = '';

        this.recentNumbers.forEach(num => {
            const badge = document.createElement('div');
            badge.className = 'recent-number';
            
            if (num === 0) {
                badge.classList.add('green');
            } else if (this.redNumbers.includes(num)) {
                badge.classList.add('red');
            } else {
                badge.classList.add('black');
            }

            badge.textContent = num;
            recentNumbersEl.appendChild(badge);
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RouletteGame();
});
