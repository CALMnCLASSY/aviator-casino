/**
 * Blackjack Game Logic
 * Implements classic blackjack with hit, stand, double, and split
 */

class BlackjackGame extends CasinoGame {
    constructor() {
        super('blackjack', 'Classic Blackjack');
        this.deck = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.currentBet = 0;
        this.gameActive = false;
        this.stats = { wins: 0, losses: 0, pushes: 0 };
        this.setupBlackjackListeners();
    }

    setupBlackjackListeners() {
        // Chip buttons
        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('betAmount').value = btn.dataset.amount;
            });
        });

        // Deal button
        document.getElementById('dealBtn').addEventListener('click', () => {
            this.startNewRound();
        });

        // Hit button
        document.getElementById('hitBtn').addEventListener('click', () => {
            this.hit();
        });

        // Stand button
        document.getElementById('standBtn').addEventListener('click', () => {
            this.stand();
        });

        // Double button
        document.getElementById('doubleBtn').addEventListener('click', () => {
            this.double();
        });

        // Split button (simplified - not fully implemented)
        document.getElementById('splitBtn').addEventListener('click', () => {
            alert('Split feature coming soon!');
        });
    }

    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];

        // Use 6 decks for realistic casino blackjack
        for (let d = 0; d < 6; d++) {
            for (let suit of suits) {
                for (let rank of ranks) {
                    deck.push({ rank, suit });
                }
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

    drawCard() {
        if (this.deck.length < 20) {
            this.deck = this.createDeck();
        }
        return this.deck.pop();
    }

    calculateHandValue(hand) {
        let value = 0;
        let aces = 0;

        for (let card of hand) {
            if (card.rank === 'A') {
                aces++;
                value += 11;
            } else if (['J', 'Q', 'K'].includes(card.rank)) {
                value += 10;
            } else {
                value += parseInt(card.rank);
            }
        }

        // Adjust for aces
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }

        return value;
    }

    isBlackjack(hand) {
        return hand.length === 2 && this.calculateHandValue(hand) === 21;
    }

    async startNewRound() {
        const betAmount = parseFloat(document.getElementById('betAmount').value);
        
        if (betAmount < 10) {
            alert('Minimum bet is KES 10');
            return;
        }

        this.currentBet = betAmount;
        this.gameActive = true;

        // Update UI
        document.getElementById('currentBet').textContent = `KES ${betAmount}`;
        this.setButtonsState('dealing');

        // Clear previous hands
        document.getElementById('playerCards').innerHTML = '';
        document.getElementById('dealerCards').innerHTML = '';
        document.getElementById('playerValue').textContent = '-';
        document.getElementById('dealerValue').textContent = '-';

        // Create new deck if needed
        if (this.deck.length < 20) {
            this.deck = this.createDeck();
        }

        // Deal initial cards
        this.playerHand = [];
        this.dealerHand = [];

        await this.dealInitialCards();
    }

    async dealInitialCards() {
        // Deal player card
        this.playerHand.push(this.drawCard());
        await this.displayCard(this.playerHand[0], 'playerCards');
        await this.delay(300);

        // Deal dealer card (face up)
        this.dealerHand.push(this.drawCard());
        await this.displayCard(this.dealerHand[0], 'dealerCards');
        await this.delay(300);

        // Deal player second card
        this.playerHand.push(this.drawCard());
        await this.displayCard(this.playerHand[1], 'playerCards');
        await this.delay(300);

        // Deal dealer second card (face down)
        this.dealerHand.push(this.drawCard());
        await this.displayCard(this.dealerHand[1], 'dealerCards', true);
        await this.delay(300);

        // Update values
        this.updateHandValues();

        // Check for blackjack
        if (this.isBlackjack(this.playerHand)) {
            await this.revealDealerCard();
            if (this.isBlackjack(this.dealerHand)) {
                this.endRound('push', 'Both Blackjack - Push!');
            } else {
                this.endRound('blackjack', 'Blackjack! You Win!');
            }
        } else {
            this.setButtonsState('playing');
        }
    }

    async displayCard(card, containerId, hidden = false) {
        return new Promise(resolve => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            
            if (hidden) {
                cardEl.classList.add('hidden');
                cardEl.dataset.rank = card.rank;
                cardEl.dataset.suit = card.suit;
            } else {
                if (card.suit === '♥' || card.suit === '♦') {
                    cardEl.classList.add('red');
                } else {
                    cardEl.classList.add('black');
                }

                cardEl.innerHTML = `
                    <div class="card-rank">${card.rank}</div>
                    <div class="card-suit">${card.suit}</div>
                `;
            }

            document.getElementById(containerId).appendChild(cardEl);
            setTimeout(resolve, 100);
        });
    }

    async revealDealerCard() {
        const hiddenCard = document.querySelector('#dealerCards .card.hidden');
        if (hiddenCard) {
            const rank = hiddenCard.dataset.rank;
            const suit = hiddenCard.dataset.suit;
            
            hiddenCard.classList.remove('hidden');
            
            if (suit === '♥' || suit === '♦') {
                hiddenCard.classList.add('red');
            } else {
                hiddenCard.classList.add('black');
            }

            hiddenCard.innerHTML = `
                <div class="card-rank">${rank}</div>
                <div class="card-suit">${suit}</div>
            `;

            await this.delay(300);
            this.updateHandValues();
        }
    }

    updateHandValues() {
        const playerValue = this.calculateHandValue(this.playerHand);
        const dealerValue = this.calculateHandValue(this.dealerHand.slice(0, 1)); // Only show first card initially

        const playerValueEl = document.getElementById('playerValue');
        playerValueEl.textContent = playerValue;
        
        if (playerValue === 21 && this.playerHand.length === 2) {
            playerValueEl.classList.add('blackjack');
        } else if (playerValue > 21) {
            playerValueEl.classList.add('bust');
        } else {
            playerValueEl.classList.remove('bust', 'blackjack');
        }

        // Only show dealer's visible card value during play
        if (this.gameActive && document.querySelector('#dealerCards .card.hidden')) {
            document.getElementById('dealerValue').textContent = dealerValue;
        } else {
            const fullDealerValue = this.calculateHandValue(this.dealerHand);
            document.getElementById('dealerValue').textContent = fullDealerValue;
        }
    }

    async hit() {
        const newCard = this.drawCard();
        this.playerHand.push(newCard);
        await this.displayCard(newCard, 'playerCards');
        this.updateHandValues();

        const playerValue = this.calculateHandValue(this.playerHand);
        
        if (playerValue > 21) {
            await this.revealDealerCard();
            this.endRound('loss', 'Bust! Dealer Wins');
        } else if (playerValue === 21) {
            this.stand();
        } else {
            // Disable double after first hit
            document.getElementById('doubleBtn').disabled = true;
        }
    }

    async stand() {
        this.setButtonsState('dealing');
        await this.revealDealerCard();
        await this.dealerPlay();
    }

    async double() {
        // Double the bet
        this.currentBet *= 2;
        document.getElementById('currentBet').textContent = `KES ${this.currentBet}`;

        // Take one more card
        const newCard = this.drawCard();
        this.playerHand.push(newCard);
        await this.displayCard(newCard, 'playerCards');
        this.updateHandValues();

        const playerValue = this.calculateHandValue(this.playerHand);
        
        if (playerValue > 21) {
            await this.revealDealerCard();
            this.endRound('loss', 'Bust! Dealer Wins');
        } else {
            await this.stand();
        }
    }

    async dealerPlay() {
        let dealerValue = this.calculateHandValue(this.dealerHand);

        // Dealer must hit on 16 or less, stand on 17 or more
        while (dealerValue < 17) {
            await this.delay(800);
            const newCard = this.drawCard();
            this.dealerHand.push(newCard);
            await this.displayCard(newCard, 'dealerCards');
            dealerValue = this.calculateHandValue(this.dealerHand);
            this.updateHandValues();
        }

        await this.delay(500);
        this.determineWinner();
    }

    determineWinner() {
        const playerValue = this.calculateHandValue(this.playerHand);
        const dealerValue = this.calculateHandValue(this.dealerHand);

        if (dealerValue > 21) {
            this.endRound('win', 'Dealer Busts! You Win!');
        } else if (playerValue > dealerValue) {
            this.endRound('win', 'You Win!');
        } else if (dealerValue > playerValue) {
            this.endRound('loss', 'Dealer Wins');
        } else {
            this.endRound('push', 'Push - Tie!');
        }
    }

    endRound(result, message) {
        this.gameActive = false;
        this.setButtonsState('finished');

        let winAmount = 0;
        let overlayClass = '';

        if (result === 'win') {
            winAmount = this.currentBet * 2;
            this.stats.wins++;
            overlayClass = 'win';
        } else if (result === 'blackjack') {
            winAmount = this.currentBet * 2.5;
            this.stats.wins++;
            overlayClass = 'win';
        } else if (result === 'loss') {
            this.stats.losses++;
            overlayClass = 'loss';
        } else if (result === 'push') {
            winAmount = this.currentBet;
            this.stats.pushes++;
            overlayClass = 'push';
        }

        this.updateStats();
        this.showResult(message, winAmount, overlayClass);
    }

    updateStats() {
        document.getElementById('winsCount').textContent = this.stats.wins;
        document.getElementById('lossesCount').textContent = this.stats.losses;
        
        const totalGames = this.stats.wins + this.stats.losses + this.stats.pushes;
        const winRate = totalGames > 0 ? ((this.stats.wins / totalGames) * 100).toFixed(1) : 0;
        document.getElementById('winRate').textContent = `${winRate}%`;
    }

    showResult(message, winAmount, overlayClass) {
        const overlay = document.getElementById('resultOverlay');
        const content = overlay.querySelector('.result-content');

        let html = `<h2>${message}</h2>`;
        
        if (winAmount > 0) {
            html += `<div style="font-size: 48px; margin: 20px 0; color: #36cb12;">+KES ${winAmount.toFixed(2)}</div>`;
        }

        content.innerHTML = html;
        overlay.className = `game-result-overlay active ${overlayClass}`;

        setTimeout(() => {
            overlay.className = 'game-result-overlay';
        }, 3000);
    }

    setButtonsState(state) {
        const dealBtn = document.getElementById('dealBtn');
        const hitBtn = document.getElementById('hitBtn');
        const standBtn = document.getElementById('standBtn');
        const doubleBtn = document.getElementById('doubleBtn');
        const splitBtn = document.getElementById('splitBtn');
        const betInput = document.getElementById('betAmount');

        if (state === 'dealing') {
            dealBtn.disabled = true;
            hitBtn.disabled = true;
            standBtn.disabled = true;
            doubleBtn.disabled = true;
            splitBtn.disabled = true;
            betInput.disabled = true;
        } else if (state === 'playing') {
            dealBtn.disabled = true;
            hitBtn.disabled = false;
            standBtn.disabled = false;
            doubleBtn.disabled = false;
            splitBtn.disabled = true; // Simplified
            betInput.disabled = true;
        } else if (state === 'finished') {
            dealBtn.disabled = false;
            hitBtn.disabled = true;
            standBtn.disabled = true;
            doubleBtn.disabled = true;
            splitBtn.disabled = true;
            betInput.disabled = false;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BlackjackGame();
});
