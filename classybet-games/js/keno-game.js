/**
 * Keno Game Logic
 * Implements lottery-style number selection and drawing
 */

class KenoGame extends CasinoGame {
    constructor() {
        super('keno', 'Keno');
        this.selectedNumbers = new Set();
        this.drawnNumbers = [];
        this.maxSelection = 10;
        this.totalNumbers = 40;
        this.numbersToDraw = 20;
        this.gameActive = false;
        
        this.payoutTable = {
            1: { 1: 3 },
            2: { 2: 10, 1: 1 },
            3: { 3: 25, 2: 3 },
            4: { 4: 50, 3: 5, 2: 1 },
            5: { 5: 100, 4: 20, 3: 5, 2: 1 },
            6: { 6: 200, 5: 50, 4: 10, 3: 2 },
            7: { 7: 500, 6: 100, 5: 20, 4: 5, 3: 1 },
            8: { 8: 1000, 7: 200, 6: 50, 5: 10, 4: 2 },
            9: { 9: 2000, 8: 500, 7: 100, 6: 20, 5: 5, 4: 1 },
            10: { 10: 5000, 9: 1000, 8: 200, 7: 50, 6: 10, 5: 2 }
        };

        this.setupKenoBoard();
        this.setupKenoListeners();
    }

    setupKenoBoard() {
        const board = document.getElementById('kenoBoard');
        board.innerHTML = '';

        for (let i = 1; i <= this.totalNumbers; i++) {
            const numberEl = document.createElement('div');
            numberEl.className = 'keno-number';
            numberEl.textContent = i;
            numberEl.dataset.number = i;
            
            numberEl.addEventListener('click', () => {
                if (!this.gameActive) {
                    this.toggleNumber(i);
                }
            });

            board.appendChild(numberEl);
        }
    }

    setupKenoListeners() {
        // Quick Pick button
        document.getElementById('quickPickBtn').addEventListener('click', () => {
            if (!this.gameActive) {
                this.quickPick();
            }
        });

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            if (!this.gameActive) {
                this.clearSelection();
            }
        });

        // Play button
        document.getElementById('playBtn').addEventListener('click', () => {
            this.playGame();
        });

        // Bet amount change
        document.getElementById('betAmount').addEventListener('input', () => {
            this.updatePotentialWin();
        });
    }

    toggleNumber(number) {
        if (this.selectedNumbers.has(number)) {
            this.selectedNumbers.delete(number);
            this.updateNumberDisplay(number, false);
        } else {
            if (this.selectedNumbers.size < this.maxSelection) {
                this.selectedNumbers.add(number);
                this.updateNumberDisplay(number, true);
            } else {
                alert(`You can only select up to ${this.maxSelection} numbers`);
            }
        }

        this.updateGameInfo();
    }

    updateNumberDisplay(number, selected) {
        const numberEl = document.querySelector(`[data-number="${number}"]`);
        if (numberEl) {
            if (selected) {
                numberEl.classList.add('selected');
            } else {
                numberEl.classList.remove('selected');
            }
        }
    }

    quickPick() {
        this.clearSelection();
        
        const count = 5; // Default quick pick count
        const available = Array.from({length: this.totalNumbers}, (_, i) => i + 1);
        
        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * available.length);
            const number = available[randomIndex];
            available.splice(randomIndex, 1);
            
            this.selectedNumbers.add(number);
            this.updateNumberDisplay(number, true);
        }

        this.updateGameInfo();
    }

    clearSelection() {
        this.selectedNumbers.forEach(number => {
            this.updateNumberDisplay(number, false);
        });
        this.selectedNumbers.clear();
        this.updateGameInfo();
    }

    updateGameInfo() {
        document.getElementById('selectedCount').textContent = this.selectedNumbers.size;
        document.getElementById('selectCount').value = this.selectedNumbers.size;
        this.updatePotentialWin();
    }

    updatePotentialWin() {
        const betAmount = parseFloat(document.getElementById('betAmount').value) || 0;
        const selectedCount = this.selectedNumbers.size;
        
        document.getElementById('displayBet').textContent = `KES ${betAmount}`;

        if (selectedCount > 0 && this.payoutTable[selectedCount]) {
            const maxMultiplier = this.payoutTable[selectedCount][selectedCount] || 0;
            const potentialWin = betAmount * maxMultiplier;
            document.getElementById('potentialWin').textContent = `KES ${potentialWin}`;
        } else {
            document.getElementById('potentialWin').textContent = 'KES 0';
        }
    }

    async playGame() {
        if (this.selectedNumbers.size === 0) {
            alert('Please select at least 1 number');
            return;
        }

        const betAmount = parseFloat(document.getElementById('betAmount').value);
        if (betAmount < 10) {
            alert('Minimum bet is KES 10');
            return;
        }

        this.gameActive = true;
        this.drawnNumbers = [];
        
        // Disable controls
        document.getElementById('playBtn').disabled = true;
        document.getElementById('playBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Drawing...';
        document.getElementById('quickPickBtn').disabled = true;
        document.getElementById('clearBtn').disabled = true;
        
        // Disable all number buttons
        document.querySelectorAll('.keno-number').forEach(el => {
            el.classList.add('disabled');
        });

        // Clear previous drawn numbers display
        document.getElementById('drawnNumbers').innerHTML = '';

        // Draw numbers with animation
        await this.drawNumbers();

        // Calculate results
        await this.calculateResults(betAmount);
    }

    async drawNumbers() {
        const available = Array.from({length: this.totalNumbers}, (_, i) => i + 1);
        
        for (let i = 0; i < this.numbersToDraw; i++) {
            await this.delay(150);
            
            const randomIndex = Math.floor(Math.random() * available.length);
            const drawnNumber = available[randomIndex];
            available.splice(randomIndex, 1);
            
            this.drawnNumbers.push(drawnNumber);
            
            // Update board
            const numberEl = document.querySelector(`[data-number="${drawnNumber}"]`);
            if (numberEl) {
                if (this.selectedNumbers.has(drawnNumber)) {
                    numberEl.classList.add('hit');
                } else {
                    numberEl.classList.add('drawn');
                }
            }

            // Add to drawn numbers display
            this.addDrawnNumberBadge(drawnNumber, this.selectedNumbers.has(drawnNumber));
        }
    }

    addDrawnNumberBadge(number, isHit) {
        const drawnNumbersEl = document.getElementById('drawnNumbers');
        const badge = document.createElement('div');
        badge.className = 'drawn-number-badge';
        badge.textContent = number;
        
        if (isHit) {
            badge.style.background = 'linear-gradient(135deg, #36cb12, #2d9a2d)';
            badge.style.color = '#fff';
        }

        drawnNumbersEl.appendChild(badge);
    }

    async calculateResults(betAmount) {
        await this.delay(500);

        // Count hits
        let hits = 0;
        this.selectedNumbers.forEach(number => {
            if (this.drawnNumbers.includes(number)) {
                hits++;
            }
        });

        document.getElementById('hitsCount').textContent = hits;

        // Calculate payout
        const selectedCount = this.selectedNumbers.size;
        const multiplier = this.payoutTable[selectedCount]?.[hits] || 0;
        const winAmount = betAmount * multiplier;

        // Show result
        if (winAmount > 0) {
            this.showWinResult(hits, selectedCount, winAmount, multiplier);
        } else {
            this.showLossResult(hits, selectedCount);
        }

        // Reset game after delay
        setTimeout(() => {
            this.resetGame();
        }, 4000);
    }

    showWinResult(hits, selected, winAmount, multiplier) {
        const message = `
            <h2>YOU WIN!</h2>
            <div style="font-size: 48px; color: #36cb12; margin: 20px 0;">
                +KES ${winAmount.toFixed(2)}
            </div>
            <p style="font-size: 24px;">
                ${hits} out of ${selected} numbers matched!
            </p>
            <p style="font-size: 20px; opacity: 0.8;">
                Multiplier: ${multiplier}x
            </p>
        `;
        this.showOverlay(message, 'win');
    }

    showLossResult(hits, selected) {
        const message = `
            <h2>TRY AGAIN</h2>
            <p style="font-size: 24px; opacity: 0.8;">
                ${hits} out of ${selected} numbers matched
            </p>
            <p style="font-size: 18px; opacity: 0.6;">
                Better luck next time!
            </p>
        `;
        this.showOverlay(message, 'loss');
    }

    showOverlay(html, type) {
        const overlay = document.getElementById('resultOverlay');
        const content = overlay.querySelector('.result-content');

        if (overlay && content) {
            content.innerHTML = html;
            overlay.className = `game-result-overlay active ${type}`;

            setTimeout(() => {
                overlay.className = 'game-result-overlay';
            }, 3500);
        }
    }

    resetGame() {
        this.gameActive = false;
        this.drawnNumbers = [];

        // Clear visual states
        document.querySelectorAll('.keno-number').forEach(el => {
            el.classList.remove('drawn', 'hit', 'disabled');
        });

        // Reset hits count
        document.getElementById('hitsCount').textContent = '0';

        // Re-enable controls
        document.getElementById('playBtn').disabled = false;
        document.getElementById('playBtn').innerHTML = '<i class="fas fa-play-circle"></i> Play Keno';
        document.getElementById('quickPickBtn').disabled = false;
        document.getElementById('clearBtn').disabled = false;

        // Keep selection for replay
        this.selectedNumbers.forEach(number => {
            this.updateNumberDisplay(number, true);
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new KenoGame();
});
