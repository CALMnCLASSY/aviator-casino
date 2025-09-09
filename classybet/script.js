// Game State Management
class AviatorGame {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.speedX = 3;
        this.speedY = 1;
        this.canvas.width = 800;
        this.canvas.height = 400;
        this.x = 0;
        this.y = this.canvas.height;
        this.dotPath = [];
        this.counter = 1.0;
        this.counterDepo = [1.01, 18.45, 2.02, 5.21, 1.22, 1.25, 2.03, 4.55, 65.11, 1.03, 1.10, 3.01, 8.85, 6.95, 11.01, 2.07, 4.05, 1.51, 1.02, 1.95, 1.05, 3.99, 2.89, 4.09, 11.20, 2.55];
        this.randomStop = Math.random() * (10 - 0.8) + 0.8;
        this.isFlying = true;
        this.animationId = null;
        
        // Betting state
        this.playerBalance = 3000;
        this.bets = {
            bet1: { placed: false, amount: 0, cashedOut: false },
            bet2: { placed: false, amount: 0, cashedOut: false }
        };
        
        this.loadImage();
        this.initializeElements();
        this.setupEventListeners();
        this.updateBalance();
        this.updateCounterDisplay();
        this.startGame();
        this.initializeChat();
        this.initializeAllBets();
        this.setupGameMenu();
    }

    setupGameMenu() {
        const gameMenuBtn = document.getElementById('game-menu-btn');
        const gameMenu = document.getElementById('game-menu');
        
        gameMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            gameMenu.classList.toggle('show');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!gameMenu.contains(e.target) && !gameMenuBtn.contains(e.target)) {
                gameMenu.classList.remove('show');
            }
        });

        // Handle menu item clicks
        gameMenu.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) {
                const action = menuItem.dataset.action;
                this.handleMenuAction(action);
            }
        });
    }

    handleMenuAction(action) {
        switch (action) {
            case 'sound':
                this.addChatMessage('', '🔊 Sound settings toggled', true);
                break;
            case 'animation':
                this.addChatMessage('', '🎬 Animation settings toggled', true);
                break;
            case 'bet-history':
                this.addChatMessage('', '📊 Bet history feature coming soon!', true);
                break;
            case 'how-to-play':
                this.addChatMessage('', '❓ How to Play: Place bets and cash out before the plane crashes!', true);
                break;
            case 'game-rules':
                this.addChatMessage('', '📖 Game Rules: Multiplier increases until crash. Cash out to win!', true);
                break;
            case 'provably-fair':
                this.addChatMessage('', '🛡️ Provably Fair: All rounds are cryptographically verifiable', true);
                break;
        }
        
        // Close menu after action
        document.getElementById('game-menu').classList.remove('show');
    }

    // All Bets functionality
    initializeAllBets() {
        this.allBetsData = [];
        this.betCount = 350; // Start with minimum 350 bets
        this.generateRandomBets();
        
        // Generate random betting activity
        setInterval(() => {
            this.generateRandomBets();
        }, 2000); // More frequent betting

        // Setup show more rounds functionality
        this.setupShowMoreRounds();
    }

    setupShowMoreRounds() {
        const showMoreBtn = document.getElementById('show-more-rounds');
        const hiddenRounds = document.getElementById('hidden-rounds');
        
        showMoreBtn.addEventListener('click', () => {
            hiddenRounds.classList.toggle('show');
            const icon = showMoreBtn.querySelector('i');
            icon.className = hiddenRounds.classList.contains('show') ? 'fas fa-times' : 'fas fa-ellipsis-h';
        });
    }

    generateRandomBets() {
        // Generate bet ID with pattern 2***X where X is random
        const lastDigit = Math.floor(Math.random() * 10);
        const betId = `2***${lastDigit}`;
        
        const betAmount = (Math.random() * 200 + 10).toFixed(2);
        
        // Randomly decide if this bet will cash out or crash
        const willCashOut = Math.random() > 0.3; // 70% chance to cash out
        
        const bet = {
            id: betId,
            amount: parseFloat(betAmount),
            cashedOut: false,
            crashed: false,
            multiplier: null,
            status: 'Active'
        };

        this.allBetsData.unshift(bet);
        this.betCount++;
        
        // Keep only last 15 bets for performance
        if (this.allBetsData.length > 15) {
            this.allBetsData.pop();
        }

        // Simulate cash out after some time
        if (willCashOut && this.isFlying) {
            setTimeout(() => {
                if (bet.status === 'Active' && this.isFlying) {
                    const cashOutMultiplier = (Math.random() * 5 + 1.2).toFixed(2);
                    bet.cashedOut = true;
                    bet.multiplier = parseFloat(cashOutMultiplier);
                    bet.status = `${bet.multiplier}x`;
                    this.updateAllBetsDisplay();
                    
                    // Add to chat with bet amount and winnings
                    const winnings = (bet.amount * bet.multiplier).toFixed(2);
                    this.addChatMessage('', `💰 Player cashed out €${bet.amount} at ${bet.multiplier}x for €${winnings}!`, true);
                }
            }, Math.random() * 8000 + 2000);
        }

        this.updateAllBetsDisplay();
        this.updateBetCount();
    }

    updateBetCount() {
        document.getElementById('bet-count').textContent = this.betCount;
    }

    updateAllBetsDisplay() {
        this.allBetsContainer.innerHTML = this.allBetsData.map(bet => {
            let statusClass = 'active';
            let statusText = bet.status;

            if (bet.cashedOut) {
                statusClass = 'cashout';
            } else if (bet.crashed) {
                statusClass = 'crashed';
                statusText = 'Crashed';
            }

            return `
                <div class="all-bet-item ${statusClass}">
                    <div class="bet-id">${bet.id}</div>
                    <div class="bet-amount">€${bet.amount.toFixed(2)}</div>
                    <div class="bet-status ${statusClass}">${statusText}</div>
                </div>
            `;
        }).join('');
    }

    loadImage() {
        this.image = new Image();
        this.image.src = './img/aviator_jogo.png';
    }

    initializeElements() {
        this.balanceElement = document.getElementById('balance-amount');
        this.betButton1 = document.getElementById('bet-button-1');
        this.betButton2 = document.getElementById('bet-button-2');
        this.betInput1 = document.getElementById('bet-input-1');
        this.betInput2 = document.getElementById('bet-input-2');
        this.messageElement = document.getElementById('message');
        this.lastCounters = document.getElementById('last-counters');
        this.addBetButton = document.getElementById('add-bet-button');
        this.secondBetPanel = document.getElementById('second-bet-panel');
        this.nextRoundTimer = document.getElementById('next-round-timer');
        this.allBetsContainer = document.getElementById('all-bets');
        this.mainContainer = document.getElementById('main-container');
        
        this.messageElement.textContent = 'Wait for the next round';
        this.updateBalance();
    }

    setupEventListeners() {
        // Bet button listeners
        this.betButton1.addEventListener('click', () => this.handleBet('bet1'));
        this.betButton2.addEventListener('click', () => this.handleBet('bet2'));
        
        // Add second bet button
        this.addBetButton.addEventListener('click', () => this.toggleSecondBet());
        
        // Quick amount buttons
        document.querySelectorAll('.quick-amount').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = e.target.dataset.amount;
                const panel = e.target.closest('.bet-panel');
                const input = panel.querySelector('input[type="number"]');
                input.value = amount;
            });
        });

        // Input validation
        [this.betInput1, this.betInput2].forEach(input => {
            input.addEventListener('keydown', (e) => {
                const invalidChars = ["-", "+", "e"];
                if (invalidChars.includes(e.key)) {
                    e.preventDefault();
                }
            });
        });

        // Chat functionality
        this.setupChatListeners();
    }

    setupChatListeners() {
        const chatToggle = document.getElementById('chat-toggle');
        const chatContainer = document.getElementById('chat-container');
        const sendChatBtn = document.getElementById('send-chat');
        const chatInput = document.getElementById('chat-input');

        // Check screen size and auto-hide chat on small screens
        if (window.innerWidth <= 900) {
            chatContainer.classList.add('chat-hidden');
            this.mainContainer.classList.add('chat-hidden');
        } else {
            // Ensure chat is visible on larger screens
            chatContainer.classList.remove('chat-hidden');
            this.mainContainer.classList.remove('chat-hidden');
        }

        chatToggle.addEventListener('click', () => {
            chatContainer.classList.toggle('chat-hidden');
            this.mainContainer.classList.toggle('chat-hidden');
        });

        sendChatBtn.addEventListener('click', () => this.sendChatMessage());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 900) {
                chatContainer.classList.add('chat-hidden');
                this.mainContainer.classList.add('chat-hidden');
            } else {
                chatContainer.classList.remove('chat-hidden');
                this.mainContainer.classList.remove('chat-hidden');
            }
        });
    }

    sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        if (message) {
            this.addChatMessage('You', message);
            chatInput.value = '';
            
            // Simulate a response from other players occasionally
            if (Math.random() > 0.7) {
                setTimeout(() => {
                    const responses = [
                        'Good luck! 🍀',
                        'Nice! 👍',
                        'Let\'s win big! 💰',
                        'Same here!',
                        'Hope it flies high! 🚀'
                    ];
                    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                    this.generateRandomChatMessage(randomResponse);
                }, 1000 + Math.random() * 2000);
            }
        }
    }

    addChatMessage(user, message, isSystem = false) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isSystem ? 'system' : ''}`;
        
        if (isSystem) {
            messageDiv.innerHTML = `<span class="chat-text">${message}</span>`;
        } else {
            messageDiv.innerHTML = `
                <span class="chat-user">${user}:</span>
                <span class="chat-text">${message}</span>
            `;
        }
        
        // Add new message at the bottom
        chatMessages.appendChild(messageDiv);
        
        // Manage message count - keep only last 8 visible messages
        const messages = chatMessages.querySelectorAll('.chat-message');
        if (messages.length > 8) {
            // Fade out oldest messages
            for (let i = 0; i < messages.length - 8; i++) {
                const oldMessage = messages[i];
                if (!oldMessage.classList.contains('fade-out')) {
                    oldMessage.classList.add('fade-out');
                    
                    // Remove the message after fade animation
                    setTimeout(() => {
                        if (oldMessage.parentNode) {
                            oldMessage.parentNode.removeChild(oldMessage);
                        }
                    }, 500); // Match the CSS transition duration
                }
            }
        }
    }

    initializeChat() {
        // Update online count to 100+
        document.querySelector('.online-count span').textContent = `${Math.floor(Math.random() * 150 + 100)} online`;
        
        // Add some initial messages to show the chat is active
        setTimeout(() => {
            this.addChatMessage('W***4821', 'Good luck everyone! 🍀');
        }, 500);
        
        setTimeout(() => {
            this.addChatMessage('K***7392', 'Going for big wins today! 💰');
        }, 1500);
        
        setTimeout(() => {
            this.addChatMessage('', '🎉 Welcome to Aviator! Place your bets and cash out before the plane crashes!', true);
        }, 2500);
        
        // Add frequent random chat messages
        setInterval(() => {
            this.generateRandomChatMessage();
        }, Math.random() * 3000 + 2000); // Every 2-5 seconds
        
        // Update online count periodically
        setInterval(() => {
            document.querySelector('.online-count span').textContent = `${Math.floor(Math.random() * 150 + 100)} online`;
        }, 30000); // Every 30 seconds
    }

    generateRandomChatMessage(customMessage = null) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const randomLetter = letters[Math.floor(Math.random() * letters.length)];
        const randomNumber = Math.floor(Math.random() * 9999);
        const username = `${randomLetter}***${randomNumber}`;
        
        const message = customMessage || (() => {
            const messages = [
                'Going big this round! 🚀',
                'Just hit a nice multiplier! 💰',
                'Good luck everyone!',
                'Feeling lucky today',
                'This plane is flying high!',
                'Anyone else betting big?',
                'Let\'s get that 10x!',
                'Cash out or risk it?',
                'Here we go again!',
                'Big bet incoming 💪',
                'Who else is ready?',
                'Nice flight so far',
                'Steady climb!',
                'Keep going up! ⬆️',
                'Almost at my target',
                'This looks promising',
                'Green candles! 📈',
                'Perfect timing',
                'Nice and steady',
                'Building up nicely'
            ];
            return messages[Math.floor(Math.random() * messages.length)];
        })();
        
        this.addChatMessage(username, message);
    }

    toggleSecondBet() {
        if (this.secondBetPanel.style.display === 'none') {
            this.secondBetPanel.style.display = 'block';
            this.addBetButton.innerHTML = '<i class="fas fa-minus"></i>';
        } else {
            this.secondBetPanel.style.display = 'none';
            this.addBetButton.innerHTML = '<i class="fas fa-plus"></i>';
            // Reset second bet if hidden
            this.bets.bet2 = { placed: false, amount: 0, cashedOut: false };
            this.betButton2.textContent = 'BET';
            this.betButton2.className = 'bet-button';
        }
    }

    handleBet(betType) {
        const bet = this.bets[betType];
        const input = betType === 'bet1' ? this.betInput1 : this.betInput2;
        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;

        if (bet.placed && !bet.cashedOut) {
            this.cashOut(betType);
        } else {
            this.placeBet(betType);
        }
    }

    placeBet(betType) {
        const bet = this.bets[betType];
        const input = betType === 'bet1' ? this.betInput1 : this.betInput2;
        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
        const amount = parseFloat(input.value);

        if (bet.placed || isNaN(amount) || amount <= 0 || amount > this.playerBalance || this.isFlying) {
            this.messageElement.textContent = this.isFlying ? 'Wait for the next round' : 'Invalid bet amount';
            return;
        }

        this.playerBalance -= amount;
        bet.placed = true;
        bet.amount = amount;
        bet.cashedOut = false;

        button.textContent = `€${amount.toFixed(2)}`;
        button.className = 'bet-button cashing-out';
        this.updateBalance();
        this.messageElement.textContent = `Bet placed: €${amount.toFixed(2)}`;
    }

    // Update bet buttons during flight to show potential cashout
    updateBetButtons() {
        Object.keys(this.bets).forEach(betType => {
            const bet = this.bets[betType];
            if (bet.placed && !bet.cashedOut && this.isFlying) {
                const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
                const potentialWinnings = (bet.amount * this.counter).toFixed(2);
                button.textContent = `CASH OUT €${potentialWinnings}`;
            }
        });
    }

    cashOut(betType) {
        const bet = this.bets[betType];
        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;

        if (!bet.placed || bet.cashedOut || !this.isFlying) {
            this.messageElement.textContent = "Can't cash out now";
            return;
        }

        const winnings = bet.amount * this.counter;
        this.playerBalance += winnings;
        bet.cashedOut = true;
        bet.placed = false;

        button.textContent = 'BET';
        button.className = 'bet-button';
        this.updateBalance();
        this.messageElement.textContent = `Cashed out: €${winnings.toFixed(2)} (${this.counter.toFixed(2)}x)`;
        
        // Add to chat
        this.addChatMessage('', `🎉 You cashed out at ${this.counter.toFixed(2)}x for €${winnings.toFixed(2)}!`, true);
    }

    updateBalance() {
        this.balanceElement.textContent = `€${this.playerBalance.toFixed(2)}`;
        // Also update the navigation balance
        const userBalance = document.querySelector('.user-balance');
        if (userBalance) {
            userBalance.textContent = `€${this.playerBalance.toFixed(2)}`;
        }
    }

    updateCounterDisplay() {
        const visibleCount = 6; // Show fewer multipliers to reach the dropdown sooner
        const visibleMultipliers = this.counterDepo.slice(0, visibleCount);
        const hiddenMultipliers = this.counterDepo.slice(visibleCount);

        // Update visible multipliers
        this.lastCounters.innerHTML = visibleMultipliers.map(i => {
            let classNameForCounter = '';
            if (i < 2.00) {
                classNameForCounter = 'blueBorder';
            } else if (i >= 2 && i < 10) {
                classNameForCounter = 'purpleBorder';
            } else {
                classNameForCounter = 'burgundyBorder';
            }
            return `<p class="${classNameForCounter}">${i}</p>`;
        }).join('');

        // Update hidden multipliers
        const hiddenRoundsContainer = document.getElementById('hidden-rounds');
        const showMoreBtn = document.getElementById('show-more-rounds');
        
        if (hiddenMultipliers.length > 0) {
            hiddenRoundsContainer.innerHTML = `
                <div class="hidden-rounds-grid">
                    ${hiddenMultipliers.map(i => {
                        let classNameForCounter = '';
                        if (i < 2.00) {
                            classNameForCounter = 'blueBorder';
                        } else if (i >= 2 && i < 10) {
                            classNameForCounter = 'purpleBorder';
                        } else {
                            classNameForCounter = 'burgundyBorder';
                        }
                        return `<p class="${classNameForCounter}">${i}</p>`;
                    }).join('')}
                </div>
            `;
            
            // Show the show-more button
            showMoreBtn.style.display = 'flex';
        } else {
            // Hide the show-more button if no hidden rounds
            showMoreBtn.style.display = 'none';
        }
    }

    startGame() {
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    draw() {
        // Update counter
        this.counter += 0.001;
        document.getElementById('counter').textContent = this.counter.toFixed(2) + 'x';

        // Update bet buttons with potential cashout amounts
        this.updateBetButtons();

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update position
        this.x += this.speedX;

        if (this.counter < this.randomStop) {
            this.y -= this.speedY;
            this.y = this.canvas.height / 2 + 50 * Math.cos(this.x / 100);
            this.isFlying = true;
        } else {
            this.isFlying = false;
            this.handleCrash();
            return;
        }

        // Draw path and plane
        this.dotPath.push({ x: this.x, y: this.y });
        this.drawGame();

        // Continue animation
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    drawGame() {
        const canvasOffsetX = this.canvas.width / 2 - this.x;
        const canvasOffsetY = this.canvas.height / 2 - this.y;

        this.ctx.save();
        this.ctx.translate(canvasOffsetX, canvasOffsetY);

        // Draw path with RED color (restored original)
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#dc3545'; // Red color restored
        this.ctx.lineWidth = 3;
        for (let i = 1; i < this.dotPath.length; i++) {
            this.ctx.moveTo(this.dotPath[i - 1].x, this.dotPath[i - 1].y);
            this.ctx.lineTo(this.dotPath[i].x, this.dotPath[i].y);
        }
        this.ctx.stroke();

        // Draw plane
        if (this.image.complete) {
            this.ctx.drawImage(this.image, this.x - 28, this.y - 78, 185, 85);
        }

        this.ctx.restore();
    }

    handleCrash() {
        cancelAnimationFrame(this.animationId);
        
        // Show crash message in game area
        this.showGameMessage(`💥 Crashed at ${this.counter.toFixed(2)}x`, 'crash');
        
        // Mark all active bets as crashed
        this.allBetsData.forEach(bet => {
            if (bet.status === 'Active') {
                bet.crashed = true;
                bet.status = 'Crashed';
            }
        });
        this.updateAllBetsDisplay();
        
        // Handle uncashed bets - reset button text to BET
        Object.keys(this.bets).forEach(betType => {
            const bet = this.bets[betType];
            const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
            if (bet.placed && !bet.cashedOut) {
                button.textContent = 'BET';
                button.className = 'bet-button';
                bet.placed = false;
                bet.cashedOut = false;
            }
        });

        // Add crash to history
        this.counterDepo.unshift(this.counter.toFixed(2));
        this.updateCounterDisplay();

        // Add crash message to chat
        this.addChatMessage('', `💥 Plane crashed at ${this.counter.toFixed(2)}x`, true);

        this.messageElement.textContent = 'Place your bet for the next round';
        
        // Countdown timer
        this.startCountdown();
    }

    showGameMessage(message, type = 'info') {
        const gameArea = document.getElementById('counterWrapper');
        const messageDiv = document.createElement('div');
        messageDiv.className = `game-message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px 30px;
            border-radius: 15px;
            font-size: 24px;
            font-weight: bold;
            z-index: 1000;
            border: 2px solid ${type === 'crash' ? '#fb024c' : '#30fcbe'};
            animation: fadeInOut 3s ease-in-out;
        `;
        
        gameArea.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    startCountdown() {
        let countdown = 8;
        this.nextRoundTimer.textContent = `Next round in: ${countdown}s`;
        
        // Show next round message in game area
        this.showGameMessage(`Next round starts in ${countdown}s`, 'info');
        
        const countdownInterval = setInterval(() => {
            countdown--;
            this.nextRoundTimer.textContent = countdown > 0 ? `Next round in: ${countdown}s` : 'Starting...';
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                this.resetGame();
            }
        }, 1000);
    }

    resetGame() {
        this.randomStop = Math.random() * (10 - 0.8) + 0.8;
        this.counter = 1.0;
        this.x = 0;
        this.y = this.canvas.height;
        this.dotPath = [];
        this.isFlying = true;
        this.nextRoundTimer.textContent = '';
        this.messageElement.textContent = '';
        
        // Reset bet count for new round but keep it above 350
        this.betCount = Math.floor(Math.random() * 50 + 350);
        this.updateBetCount();
        
        // Clear all bets data for new round
        this.allBetsData = [];
        this.updateAllBetsDisplay();
        
        this.startGame();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AviatorGame();
});


