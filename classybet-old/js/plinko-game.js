/**
 * Plinko Game Logic
 * Implements ball drop physics and multiplier system
 */

class PlinkoGame extends CasinoGame {
    constructor() {
        super('plinko', 'Plinko');
        this.rows = 12;
        this.riskLevel = 'medium';
        this.isDropping = false;
        this.stats = {
            totalDrops: 0,
            totalWon: 0,
            biggestWin: 0
        };
        
        this.multipliers = {
            low: [1.5, 1.2, 1.1, 1.0, 0.5, 0.3, 0.5, 1.0, 1.1, 1.2, 1.5],
            medium: [3.0, 2.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 2.0, 3.0],
            high: [10.0, 5.0, 2.0, 1.0, 0.5, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0]
        };

        this.setupPlinkoBoard();
        this.setupPlinkoListeners();
    }

    setupPlinkoBoard() {
        this.createPegs();
        this.createMultiplierSlots();
    }

    createPegs() {
        const container = document.getElementById('pegsContainer');
        container.innerHTML = '';

        for (let row = 0; row < this.rows; row++) {
            const pegRow = document.createElement('div');
            pegRow.className = 'peg-row';
            
            const pegsInRow = row + 3; // Start with 3, increase each row
            
            for (let peg = 0; peg < pegsInRow; peg++) {
                const pegEl = document.createElement('div');
                pegEl.className = 'peg';
                pegRow.appendChild(pegEl);
            }

            container.appendChild(pegRow);
        }
    }

    createMultiplierSlots() {
        const multipliersRow = document.getElementById('multipliersRow');
        multipliersRow.innerHTML = '';

        const multipliers = this.multipliers[this.riskLevel];

        multipliers.forEach((mult, index) => {
            const slot = document.createElement('div');
            slot.className = 'multiplier-slot';
            slot.dataset.index = index;
            
            // Color coding based on multiplier value
            if (mult >= 2.0) {
                slot.classList.add('high');
            } else if (mult >= 1.0) {
                slot.classList.add('medium');
            } else {
                slot.classList.add('low');
            }

            slot.textContent = mult + 'x';
            multipliersRow.appendChild(slot);
        });
    }

    setupPlinkoListeners() {
        // Risk selector buttons
        document.querySelectorAll('.risk-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.isDropping) {
                    this.riskLevel = btn.dataset.risk;
                    
                    document.querySelectorAll('.risk-btn').forEach(b => {
                        b.classList.remove('selected');
                    });
                    btn.classList.add('selected');

                    this.createMultiplierSlots();
                }
            });
        });

        // Drop button
        document.getElementById('dropBtn').addEventListener('click', () => {
            this.dropBall();
        });
    }

    async dropBall() {
        if (this.isDropping) return;

        const betAmount = parseFloat(document.getElementById('betAmount').value);
        if (betAmount < 10) {
            alert('Minimum bet is KES 10');
            return;
        }

        this.isDropping = true;
        document.getElementById('dropBtn').disabled = true;
        document.getElementById('dropBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dropping...';

        // Create ball element
        const ball = document.createElement('div');
        ball.className = 'ball';
        document.getElementById('plinkoCanvas').appendChild(ball);

        // Simulate ball drop
        const landingSlot = await this.animateBallDrop(ball);

        // Calculate result
        const multiplier = this.multipliers[this.riskLevel][landingSlot];
        const winAmount = betAmount * multiplier;

        // Highlight landing slot
        this.highlightSlot(landingSlot);

        // Show result
        await this.delay(500);
        this.showResult(winAmount, multiplier);

        // Update stats
        this.updateStats(winAmount, multiplier);

        // Cleanup
        await this.delay(1500);
        ball.remove();

        this.isDropping = false;
        document.getElementById('dropBtn').disabled = false;
        document.getElementById('dropBtn').innerHTML = '<i class="fas fa-circle"></i> Drop Ball';
    }

    async animateBallDrop(ball) {
        const canvas = document.getElementById('plinkoCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        const canvasWidth = canvasRect.width;
        const canvasHeight = canvasRect.height;

        // Start position (top center)
        let x = canvasWidth / 2;
        let y = 20;

        ball.style.left = x + 'px';
        ball.style.top = y + 'px';

        // Simulate bouncing through pegs
        const rowHeight = (canvasHeight - 100) / this.rows;
        let direction = 0; // Track horizontal position

        for (let row = 0; row < this.rows; row++) {
            await this.delay(150);

            // Random bounce left or right
            const bounce = Math.random() < 0.5 ? -1 : 1;
            direction += bounce;

            // Calculate new position
            y += rowHeight;
            const horizontalSpread = 30;
            x += bounce * horizontalSpread;

            // Keep within bounds
            x = Math.max(30, Math.min(canvasWidth - 30, x));

            ball.style.left = x + 'px';
            ball.style.top = y + 'px';
        }

        // Determine landing slot based on final x position
        const slotCount = this.multipliers[this.riskLevel].length;
        const slotWidth = canvasWidth / slotCount;
        const landingSlot = Math.floor(x / slotWidth);

        return Math.max(0, Math.min(slotCount - 1, landingSlot));
    }

    highlightSlot(slotIndex) {
        const slots = document.querySelectorAll('.multiplier-slot');
        slots.forEach((slot, index) => {
            if (index === slotIndex) {
                slot.classList.add('hit');
                setTimeout(() => {
                    slot.classList.remove('hit');
                }, 1000);
            }
        });
    }

    showResult(winAmount, multiplier) {
        const betAmount = parseFloat(document.getElementById('betAmount').value);
        const isWin = winAmount >= betAmount;

        const message = `
            <div style="text-align: center;">
                <h2 style="font-size: 48px; color: ${isWin ? '#36cb12' : '#ffa726'}; margin-bottom: 20px;">
                    ${multiplier.toFixed(1)}x
                </h2>
                <div style="font-size: 36px; color: ${isWin ? '#36cb12' : '#fff'}; margin: 15px 0;">
                    ${isWin ? '+' : ''}KES ${(winAmount - betAmount).toFixed(2)}
                </div>
                <p style="font-size: 20px; opacity: 0.8;">
                    ${isWin ? 'Nice drop!' : 'Try again!'}
                </p>
            </div>
        `;

        // Create temporary result display
        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            padding: 40px;
            border-radius: 16px;
            z-index: 1000;
            border: 3px solid ${isWin ? '#36cb12' : '#ffa726'};
            animation: resultPop 0.5s ease-out;
        `;
        resultDiv.innerHTML = message;
        document.body.appendChild(resultDiv);

        setTimeout(() => resultDiv.remove(), 2000);
    }

    updateStats(winAmount, multiplier) {
        const betAmount = parseFloat(document.getElementById('betAmount').value);
        const profit = winAmount - betAmount;

        this.stats.totalDrops++;
        this.stats.totalWon += profit;
        this.stats.biggestWin = Math.max(this.stats.biggestWin, multiplier);

        document.getElementById('totalDrops').textContent = this.stats.totalDrops;
        document.getElementById('totalWon').textContent = `KES ${this.stats.totalWon.toFixed(2)}`;
        document.getElementById('biggestWin').textContent = this.stats.biggestWin.toFixed(1) + 'x';

        // Add to recent drops
        this.addRecentDrop(multiplier, profit >= 0);
    }

    addRecentDrop(multiplier, isWin) {
        const recentDrops = document.getElementById('recentDrops');
        
        // Remove placeholder text if present
        if (recentDrops.querySelector('span')) {
            recentDrops.innerHTML = '';
        }

        const badge = document.createElement('div');
        badge.className = 'drop-badge';
        badge.classList.add(isWin ? 'win' : 'loss');
        badge.textContent = multiplier.toFixed(1) + 'x';

        recentDrops.insertBefore(badge, recentDrops.firstChild);

        // Keep only last 10 drops
        while (recentDrops.children.length > 10) {
            recentDrops.removeChild(recentDrops.lastChild);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PlinkoGame();
});
