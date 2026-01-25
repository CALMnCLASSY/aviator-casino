/**
 * Baccarat Game Logic
 * Implements complete baccarat gameplay with card dealing, scoring, and betting
 */

class BaccaratGame extends CasinoGame {
    constructor() {
        super('baccarat', 'Speed Baccarat');
        this.selectedBet = null;
        this.stats = {
            playerWins: 0,
            bankerWins: 0,
            ties: 0,
            lastWinner: null
        };
        this.setupBaccaratListeners();
    }

    setupBaccaratListeners() {
        // Bet selection buttons
        document.querySelectorAll('.bet-button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectBet(btn.dataset.bet);
            });
        });

        // Quick bet chips
        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseInt(btn.dataset.amount);
                document.getElementById('betAmount').value = amount;
            });
        });

        // Deal button
        const dealBtn = document.getElementById('dealBtn');
        dealBtn.addEventListener('click', () => {
            this.dealCards();
        });
    }

    selectBet(betType) {
        this.selectedBet = betType;
        
        // Update UI
        document.querySelectorAll('.bet-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        const selectedBtn = document.querySelector(`[data-bet="${betType}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }

        // Enable deal button
        document.getElementById('dealBtn').disabled = false;
        document.getElementById('dealBtn').innerHTML = '<i class="fas fa-play-circle"></i> Deal Cards';
    }

    async dealCards() {
        if (!this.selectedBet) {
            alert('Please select a bet first!');
            return;
        }

        const betAmount = parseFloat(document.getElementById('betAmount').value);
        if (betAmount < 10) {
            alert('Minimum bet is KES 10');
            return;
        }

        // Disable controls during game
        this.setGameState(true);

        // Clear previous cards
        document.getElementById('playerCards').innerHTML = '';
        document.getElementById('bankerCards').innerHTML = '';
        document.getElementById('playerTotal').textContent = '-';
        document.getElementById('bankerTotal').textContent = '-';
        document.getElementById('playerSection').classList.remove('winner');
        document.getElementById('bankerSection').classList.remove('winner');

        // Simulate card dealing with animation delay
        await this.animateDeal();

        // Place bet with backend
        await this.placeBaccaratBet(betAmount);
    }

    async animateDeal() {
        // Generate random cards for visual effect
        const deck = this.createDeck();
        const playerHand = [this.drawCard(deck), this.drawCard(deck)];
        const bankerHand = [this.drawCard(deck), this.drawCard(deck)];

        // Deal player cards
        await this.displayCard(playerHand[0], 'playerCards', 0);
        await this.delay(300);
        await this.displayCard(bankerHand[0], 'bankerCards', 0);
        await this.delay(300);
        await this.displayCard(playerHand[1], 'playerCards', 300);
        await this.delay(300);
        await this.displayCard(bankerHand[1], 'bankerCards', 300);
        await this.delay(500);

        // Calculate totals
        const playerTotal = this.calculateHandValue(playerHand);
        const bankerTotal = this.calculateHandValue(bankerHand);

        // Display totals
        document.getElementById('playerTotal').textContent = playerTotal;
        document.getElementById('bankerTotal').textContent = bankerTotal;

        // Store for result display
        this.currentHands = { playerHand, bankerHand, playerTotal, bankerTotal };

        // Third card rules (simplified for demo)
        if (playerTotal <= 5) {
            await this.delay(500);
            const thirdCard = this.drawCard(deck);
            await this.displayCard(thirdCard, 'playerCards', 300);
            playerHand.push(thirdCard);
            const newTotal = this.calculateHandValue(playerHand);
            document.getElementById('playerTotal').textContent = newTotal;
            this.currentHands.playerTotal = newTotal;
        }

        if (bankerTotal <= 5) {
            await this.delay(500);
            const thirdCard = this.drawCard(deck);
            await this.displayCard(thirdCard, 'bankerCards', 300);
            bankerHand.push(thirdCard);
            const newTotal = this.calculateHandValue(bankerHand);
            document.getElementById('bankerTotal').textContent = newTotal;
            this.currentHands.bankerTotal = newTotal;
        }

        await this.delay(500);
    }

    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];

        for (let suit of suits) {
            for (let rank of ranks) {
                deck.push({ rank, suit });
            }
        }

        return this.shuffleDeck(deck);
    }

    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    drawCard(deck) {
        return deck.pop();
    }

    calculateHandValue(hand) {
        let total = 0;
        for (let card of hand) {
            let value = 0;
            if (card.rank === 'A') value = 1;
            else if (['J', 'Q', 'K'].includes(card.rank)) value = 0;
            else value = parseInt(card.rank);
            total += value;
        }
        return total % 10; // Baccarat rule: only last digit counts
    }

    async displayCard(card, containerId, delay = 0) {
        return new Promise(resolve => {
            setTimeout(() => {
                const cardEl = document.createElement('div');
                cardEl.className = 'card';
                
                // Red suits: hearts and diamonds
                if (card.suit === '♥' || card.suit === '♦') {
                    cardEl.classList.add('red');
                } else {
                    cardEl.classList.add('black');
                }

                cardEl.innerHTML = `
                    <div>${card.rank}</div>
                    <div class="card-suit">${card.suit}</div>
                `;

                document.getElementById(containerId).appendChild(cardEl);
                resolve();
            }, delay);
        });
    }

    async placeBaccaratBet(amount) {
        try {
            const response = await fetch(`${this.apiBase}/api/casino/play`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    gameId: 'baccarat',
                    amount: parseFloat(amount),
                    betType: this.selectedBet
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Bet failed');
            }

            this.updateBalanceUI(data.balance);
            this.handleBaccaratResult(data);

        } catch (error) {
            // Fallback to client-side simulation if API fails
            this.simulateResult(amount);
        }
    }

    simulateResult(amount) {
        const { playerTotal, bankerTotal } = this.currentHands;
        
        let winner;
        if (playerTotal > bankerTotal) {
            winner = 'player';
        } else if (bankerTotal > playerTotal) {
            winner = 'banker';
        } else {
            winner = 'tie';
        }

        // Determine if player won
        const isWin = winner === this.selectedBet;
        let multiplier = 0;
        let winAmount = 0;

        if (isWin) {
            if (this.selectedBet === 'tie') {
                multiplier = 8;
            } else {
                multiplier = 1;
            }
            winAmount = amount * multiplier;
        }

        // Update stats
        this.updateStats(winner);

        // Show result
        this.handleBaccaratResult({
            isWin,
            winAmount,
            multiplier,
            result: winner,
            balance: 0 // Will not update in demo
        });
    }

    handleBaccaratResult(data) {
        const { playerTotal, bankerTotal } = this.currentHands;
        
        // Highlight winner
        if (playerTotal > bankerTotal) {
            document.getElementById('playerSection').classList.add('winner');
        } else if (bankerTotal > playerTotal) {
            document.getElementById('bankerSection').classList.add('winner');
        } else {
            document.getElementById('playerSection').classList.add('winner');
            document.getElementById('bankerSection').classList.add('winner');
        }

        // Show result overlay
        setTimeout(() => {
            if (data.isWin) {
                this.showWinAnimation(data.winAmount, data.multiplier);
            } else {
                this.showLossAnimation();
            }
            this.setGameState(false);
        }, 1000);
    }

    updateStats(winner) {
        if (winner === 'player') {
            this.stats.playerWins++;
            this.stats.lastWinner = 'P';
        } else if (winner === 'banker') {
            this.stats.bankerWins++;
            this.stats.lastWinner = 'B';
        } else {
            this.stats.ties++;
            this.stats.lastWinner = 'T';
        }

        document.getElementById('playerWins').textContent = this.stats.playerWins;
        document.getElementById('bankerWins').textContent = this.stats.bankerWins;
        document.getElementById('ties').textContent = this.stats.ties;
        document.getElementById('streak').textContent = this.stats.lastWinner;
    }

    showWinAnimation(amount, multiplier) {
        const message = `
            <h2>YOU WIN!</h2>
            <div class="result-amount" style="color: #36cb12;">
                +KES ${amount.toFixed(2)}
            </div>
            <p style="font-size: 24px;">Multiplier: ${multiplier}x</p>
        `;
        this.showOverlay(message, 'win');
    }

    showLossAnimation() {
        const message = `
            <h2>BETTER LUCK NEXT TIME</h2>
            <p style="font-size: 24px; opacity: 0.8;">Try again!</p>
        `;
        this.showOverlay(message, 'loss');
    }

    setGameState(isPlaying) {
        const dealBtn = document.getElementById('dealBtn');
        const betButtons = document.querySelectorAll('.bet-button');
        const betInput = document.getElementById('betAmount');

        dealBtn.disabled = isPlaying;
        betInput.disabled = isPlaying;
        
        betButtons.forEach(btn => {
            btn.style.pointerEvents = isPlaying ? 'none' : 'auto';
        });

        if (isPlaying) {
            dealBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dealing...';
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BaccaratGame();
});
