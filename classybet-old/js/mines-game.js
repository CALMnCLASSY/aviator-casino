/**
 * Mines Game Logic
 * Implements grid-based mine-sweeper style risk game
 */

class MinesGame extends CasinoGame {
    constructor() {
        super('mines', 'Mines');
        this.gridSize = 25; // 5x5 grid
        this.selectedMines = 5;
        this.minePositions = [];
        this.revealedTiles = [];
        this.currentBet = 0;
        this.currentMultiplier = 1.00;
        this.gameActive = false;
        
        this.setupMinesGrid();
        this.setupMinesListeners();
    }

    setupMinesGrid() {
        const grid = document.getElementById('minesGrid');
        grid.innerHTML = '';

        for (let i = 0; i < this.gridSize; i++) {
            const tile = document.createElement('div');
            tile.className = 'mine-tile';
            tile.dataset.index = i;
            
            tile.addEventListener('click', () => {
                if (this.gameActive && !this.revealedTiles.includes(i)) {
                    this.revealTile(i);
                }
            });

            grid.appendChild(tile);
        }
    }

    setupMinesListeners() {
        // Mines selector buttons
        document.querySelectorAll('.mines-option').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.gameActive) {
                    this.selectMinesCount(parseInt(btn.dataset.mines));
                    
                    document.querySelectorAll('.mines-option').forEach(b => {
                        b.classList.remove('selected');
                    });
                    btn.classList.add('selected');
                }
            });
        });

        // Start button
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });

        // Cashout button
        document.getElementById('cashoutBtn').addEventListener('click', () => {
            this.cashOut();
        });
    }

    selectMinesCount(count) {
        this.selectedMines = count;
        this.updateNextMultiplier();
    }

    startGame() {
        const betAmount = parseFloat(document.getElementById('betAmount').value);
        
        if (betAmount < 10) {
            alert('Minimum bet is KES 10');
            return;
        }

        this.currentBet = betAmount;
        this.gameActive = true;
        this.revealedTiles = [];
        this.currentMultiplier = 1.00;

        // Generate mine positions
        this.generateMines();

        // Reset grid
        this.resetGrid();

        // Update UI
        this.updateGameStats();
        document.getElementById('startBtn').disabled = true;
        document.getElementById('cashoutBtn').disabled = false;
        document.getElementById('betAmount').disabled = true;
        
        document.querySelectorAll('.mines-option').forEach(btn => {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
        });
    }

    generateMines() {
        this.minePositions = [];
        const available = Array.from({length: this.gridSize}, (_, i) => i);

        for (let i = 0; i < this.selectedMines; i++) {
            const randomIndex = Math.floor(Math.random() * available.length);
            this.minePositions.push(available[randomIndex]);
            available.splice(randomIndex, 1);
        }
    }

    resetGrid() {
        document.querySelectorAll('.mine-tile').forEach(tile => {
            tile.className = 'mine-tile';
            tile.textContent = '';
        });
    }

    async revealTile(index) {
        const tile = document.querySelector(`[data-index="${index}"]`);
        if (!tile || tile.classList.contains('revealed')) return;

        tile.classList.add('revealed');
        this.revealedTiles.push(index);

        // Check if mine
        if (this.minePositions.includes(index)) {
            tile.classList.add('mine');
            tile.textContent = '💣';
            await this.hitMine();
        } else {
            tile.classList.add('gem');
            tile.textContent = '💎';
            this.foundGem();
        }
    }

    foundGem() {
        // Calculate new multiplier
        const gemsFound = this.revealedTiles.length;
        const remainingTiles = this.gridSize - this.selectedMines;
        
        // Multiplier increases based on risk
        this.currentMultiplier = this.calculateMultiplier(gemsFound, this.selectedMines);

        this.updateGameStats();

        // Check if all gems found (won maximum)
        if (gemsFound === remainingTiles) {
            this.autoWin();
        }
    }

    calculateMultiplier(gemsFound, minesCount) {
        // Formula: multiplier increases exponentially with each gem found
        // More mines = higher multiplier per gem
        const baseMultiplier = 1.0;
        const riskFactor = minesCount / this.gridSize;
        const progressFactor = gemsFound / (this.gridSize - minesCount);
        
        // Exponential growth based on risk and progress
        const multiplier = baseMultiplier + (Math.pow(1 + riskFactor * 2, gemsFound) - 1) * 0.1;
        
        return Math.max(1.0, multiplier);
    }

    calculateNextMultiplier() {
        const nextGems = this.revealedTiles.length + 1;
        return this.calculateMultiplier(nextGems, this.selectedMines);
    }

    updateNextMultiplier() {
        if (this.gameActive) {
            const nextMult = this.calculateNextMultiplier();
            document.getElementById('nextMultiplier').textContent = nextMult.toFixed(2) + 'x';
        } else {
            const firstMult = this.calculateMultiplier(1, this.selectedMines);
            document.getElementById('nextMultiplier').textContent = firstMult.toFixed(2) + 'x';
        }
    }

    updateGameStats() {
        document.getElementById('gemsFound').textContent = this.revealedTiles.length;
        document.getElementById('currentMultiplier').textContent = this.currentMultiplier.toFixed(2) + 'x';
        
        const potentialWin = this.currentBet * this.currentMultiplier;
        document.getElementById('potentialWin').textContent = `KES ${potentialWin.toFixed(2)}`;

        this.updateNextMultiplier();
    }

    async hitMine() {
        this.gameActive = false;

        // Reveal all mines
        await this.delay(500);
        this.revealAllMines();

        await this.delay(1000);
        this.showLossResult();

        setTimeout(() => {
            this.endGame();
        }, 3000);
    }

    revealAllMines() {
        this.minePositions.forEach(index => {
            if (!this.revealedTiles.includes(index)) {
                const tile = document.querySelector(`[data-index="${index}"]`);
                if (tile) {
                    tile.classList.add('revealed', 'mine');
                    tile.textContent = '💣';
                }
            }
        });
    }

    async autoWin() {
        this.gameActive = false;
        
        await this.delay(500);
        
        const winAmount = this.currentBet * this.currentMultiplier;
        this.showWinResult(winAmount);

        setTimeout(() => {
            this.endGame();
        }, 3000);
    }

    cashOut() {
        if (!this.gameActive || this.revealedTiles.length === 0) {
            return;
        }

        this.gameActive = false;

        // Reveal all mines
        this.revealAllMines();

        const winAmount = this.currentBet * this.currentMultiplier;
        this.showWinResult(winAmount);

        setTimeout(() => {
            this.endGame();
        }, 3000);
    }

    showWinResult(winAmount) {
        const message = `
            <h2>CASHED OUT!</h2>
            <div style="font-size: 48px; color: #36cb12; margin: 20px 0;">
                +KES ${winAmount.toFixed(2)}
            </div>
            <p style="font-size: 24px;">
                ${this.revealedTiles.length} gems found!
            </p>
            <p style="font-size: 20px; opacity: 0.8;">
                Multiplier: ${this.currentMultiplier.toFixed(2)}x
            </p>
        `;
        this.showOverlay(message, 'win');
    }

    showLossResult() {
        const message = `
            <h2>BOOM! 💥</h2>
            <p style="font-size: 24px; opacity: 0.8;">
                You hit a mine!
            </p>
            <p style="font-size: 18px; opacity: 0.6;">
                ${this.revealedTiles.length - 1} gems found before explosion
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
            }, 3000);
        }
    }

    endGame() {
        this.gameActive = false;
        this.revealedTiles = [];
        this.minePositions = [];
        this.currentMultiplier = 1.00;

        // Reset UI
        this.resetGrid();
        this.updateGameStats();

        document.getElementById('startBtn').disabled = false;
        document.getElementById('cashoutBtn').disabled = true;
        document.getElementById('betAmount').disabled = false;

        document.querySelectorAll('.mines-option').forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        });

        document.getElementById('gemsFound').textContent = '0';
        document.getElementById('currentMultiplier').textContent = '1.00x';
        document.getElementById('potentialWin').textContent = 'KES 0';
        
        this.updateNextMultiplier();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MinesGame();
});
