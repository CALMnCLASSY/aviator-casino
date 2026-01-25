/**
 * Ultimate Hot Slot Game Logic
 * Implements 5-reel slot machine with multiple paylines
 */

class UltimateHotGame extends CasinoGame {
    constructor() {
        super('ultimate-hot', 'Ultimate Hot');
        this.reelCount = 5;
        this.symbolsPerReel = 3;
        this.isSpinning = false;
        
        this.symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '⭐'];
        
        this.payouts = {
            '🍒': { 5: 500, 4: 100, 3: 20 },
            '🍋': { 5: 200, 4: 50, 3: 10 },
            '🍊': { 5: 100, 4: 30, 3: 5 },
            '🍇': { 5: 50, 4: 20, 3: 3 },
            '💎': { 5: 1000, 4: 200, 3: 50 },
            '7️⃣': { 5: 2000, 4: 500, 3: 100 },
            '⭐': { 5: 300, 4: 80, 3: 15 }
        };

        this.stats = {
            totalSpins: 0,
            totalWon: 0,
            biggestWin: 0,
            wins: 0
        };

        this.setupSlotMachine();
        this.setupSlotListeners();
    }

    setupSlotMachine() {
        const container = document.getElementById('reelsContainer');
        container.innerHTML = '';

        for (let i = 0; i < this.reelCount; i++) {
            const reel = document.createElement('div');
            reel.className = 'reel';
            reel.id = `reel${i}`;
            
            // Initialize with random symbols
            for (let j = 0; j < this.symbolsPerReel; j++) {
                const symbol = document.createElement('div');
                symbol.className = 'symbol';
                symbol.textContent = this.getRandomSymbol();
                reel.appendChild(symbol);
            }

            container.appendChild(reel);
        }
    }

    setupSlotListeners() {
        // Bet amount buttons
        document.querySelectorAll('.bet-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('betAmount').value = btn.dataset.bet;
                this.updateTotalBet();
            });
        });

        // Bet amount and lines change
        document.getElementById('betAmount').addEventListener('input', () => {
            this.updateTotalBet();
        });

        document.getElementById('linesCount').addEventListener('input', () => {
            this.updateTotalBet();
        });

        // Spin button
        document.getElementById('spinBtn').addEventListener('click', () => {
            this.spin();
        });
    }

    updateTotalBet() {
        const betPerLine = parseFloat(document.getElementById('betAmount').value) || 10;
        const lines = parseInt(document.getElementById('linesCount').value) || 5;
        const total = betPerLine * lines;
        
        document.getElementById('totalBet').value = `KES ${total}`;
    }

    getRandomSymbol() {
        return this.symbols[Math.floor(Math.random() * this.symbols.length)];
    }

    async spin() {
        if (this.isSpinning) return;

        const betPerLine = parseFloat(document.getElementById('betAmount').value);
        const lines = parseInt(document.getElementById('linesCount').value);
        const totalBet = betPerLine * lines;

        if (totalBet < 10) {
            alert('Minimum total bet is KES 10');
            return;
        }

        this.isSpinning = true;
        document.getElementById('spinBtn').disabled = true;
        document.getElementById('spinBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> SPINNING...';

        // Clear previous winning highlights
        document.querySelectorAll('.symbol').forEach(symbol => {
            symbol.classList.remove('winning');
        });

        // Animate reels spinning
        const reels = document.querySelectorAll('.reel');
        reels.forEach(reel => reel.classList.add('spinning'));

        // Generate final symbols for each reel
        const finalReels = [];
        for (let i = 0; i < this.reelCount; i++) {
            const reelSymbols = [];
            for (let j = 0; j < this.symbolsPerReel; j++) {
                reelSymbols.push(this.getRandomSymbol());
            }
            finalReels.push(reelSymbols);
        }

        // Stop reels one by one with delay
        for (let i = 0; i < this.reelCount; i++) {
            await this.delay(300 + i * 200);
            await this.stopReel(i, finalReels[i]);
        }

        await this.delay(500);

        // Check for wins
        const result = this.checkWins(finalReels, lines, betPerLine);

        // Update stats
        this.updateStats(result);

        // Show result
        if (result.totalWin > 0) {
            this.highlightWinningSymbols(result.winningLines);
            await this.delay(500);
            this.showWinDisplay(result.totalWin);
        }

        // Reset for next spin
        setTimeout(() => {
            this.isSpinning = false;
            document.getElementById('spinBtn').disabled = false;
            document.getElementById('spinBtn').innerHTML = '<i class="fas fa-sync-alt"></i> SPIN';
        }, result.totalWin > 0 ? 3000 : 1000);
    }

    async stopReel(reelIndex, symbols) {
        const reel = document.getElementById(`reel${reelIndex}`);
        reel.classList.remove('spinning');

        const symbolElements = reel.querySelectorAll('.symbol');
        symbols.forEach((symbol, index) => {
            symbolElements[index].textContent = symbol;
        });
    }

    checkWins(reels, lines, betPerLine) {
        const winningLines = [];
        let totalWin = 0;

        // Check each active payline
        for (let line = 0; line < lines; line++) {
            const lineSymbols = [];
            
            // Get symbols for this line (simplified: horizontal lines)
            for (let reel = 0; reel < this.reelCount; reel++) {
                const symbolIndex = line % this.symbolsPerReel;
                lineSymbols.push({
                    symbol: reels[reel][symbolIndex],
                    reel: reel,
                    position: symbolIndex
                });
            }

            // Check for matching symbols
            const winInfo = this.checkLineWin(lineSymbols, betPerLine);
            if (winInfo.win > 0) {
                winningLines.push({
                    line: line,
                    symbols: lineSymbols,
                    win: winInfo.win,
                    count: winInfo.count
                });
                totalWin += winInfo.win;
            }
        }

        return { totalWin, winningLines };
    }

    checkLineWin(lineSymbols, betPerLine) {
        const firstSymbol = lineSymbols[0].symbol;
        let matchCount = 1;

        // Count consecutive matching symbols from left to right
        for (let i = 1; i < lineSymbols.length; i++) {
            if (lineSymbols[i].symbol === firstSymbol) {
                matchCount++;
            } else {
                break;
            }
        }

        // Check if we have a winning combination
        if (matchCount >= 3 && this.payouts[firstSymbol]) {
            const multiplier = this.payouts[firstSymbol][matchCount] || 0;
            const win = betPerLine * multiplier;
            return { win, count: matchCount };
        }

        return { win: 0, count: 0 };
    }

    highlightWinningSymbols(winningLines) {
        winningLines.forEach(line => {
            line.symbols.slice(0, line.count).forEach(symbolInfo => {
                const reel = document.getElementById(`reel${symbolInfo.reel}`);
                const symbols = reel.querySelectorAll('.symbol');
                symbols[symbolInfo.position].classList.add('winning');
            });
        });

        // Highlight active paylines
        const paylineIndicators = document.querySelectorAll('.payline-indicator');
        winningLines.forEach(line => {
            if (paylineIndicators[line.line]) {
                paylineIndicators[line.line].classList.add('active');
            }
        });

        // Remove highlights after delay
        setTimeout(() => {
            document.querySelectorAll('.payline-indicator').forEach(indicator => {
                indicator.classList.remove('active');
            });
        }, 3000);
    }

    showWinDisplay(winAmount) {
        const winDisplay = document.getElementById('winDisplay');
        const winAmountEl = document.getElementById('winAmount');

        winAmountEl.textContent = `+KES ${winAmount.toFixed(2)}`;
        winDisplay.classList.add('active');

        setTimeout(() => {
            winDisplay.classList.remove('active');
        }, 2500);
    }

    updateStats(result) {
        this.stats.totalSpins++;
        
        if (result.totalWin > 0) {
            this.stats.wins++;
            this.stats.totalWon += result.totalWin;
            this.stats.biggestWin = Math.max(this.stats.biggestWin, result.totalWin);
        }

        document.getElementById('totalSpins').textContent = this.stats.totalSpins;
        document.getElementById('totalWon').textContent = `KES ${this.stats.totalWon.toFixed(2)}`;
        document.getElementById('biggestWin').textContent = `KES ${this.stats.biggestWin.toFixed(2)}`;
        
        const winRate = this.stats.totalSpins > 0 
            ? ((this.stats.wins / this.stats.totalSpins) * 100).toFixed(1)
            : 0;
        document.getElementById('winRate').textContent = `${winRate}%`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new UltimateHotGame();
});
