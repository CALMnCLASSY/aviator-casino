// Game State Management
class AviatorGame {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.speedX = 3;
        this.speedY = 1;
        this.canvas.width = 800;
        this.canvas.height = 400;
        // Start plane from absolute bottom of canvas (ground level)
        this.x = 0;
        this.y = this.canvas.height;
        this.startX = 0;
        this.startY = this.canvas.height;
        this.dotPath = [];
        this.counter = 1.0;
        this.counterDepo = [1.01, 18.45, 2.00, 5.21, 1.22, 1.25, 2.03, 4.55, 65.11, 1.03, 1.10, 3.01, 8.85, 6.95, 11.01, 2.07, 4.05, 1.51, 1.02, 1.95, 1.05, 3.99, 2.89, 4.09, 11.20, 2.55];
        this.randomStop = Math.random() * (10 - 0.8) + 0.8;
        this.isFlying = true;
        this.hoverOffset = 0; // For vertical hovering animation
        this.animationId = null;
        this.pathX = 0; // Separate variable for path progression
        this.pathY = this.canvas.height; // Path Y position
        this.isHovering = false; // Track if plane is in hovering mode
        this.gameState = 'waiting'; // 'waiting', 'flying', 'crashed'
        this.roundNumber = 12345;
        this.lastUpdateTime = 0; // For controlling multiplier update frequency
        
        // Betting state - will be set by authentication system
        this.playerBalance = 0;
        this.bets = {
            bet1: { placed: false, amount: 0, cashedOut: false, pending: false },
            bet2: { placed: false, amount: 0, cashedOut: false, pending: false }
        };
        
        // Auto-betting state
        this.autoBetState = {
            bet1: { active: false, count: 0, wins: 0, profit: 0 },
            bet2: { active: false, count: 0, wins: 0, profit: 0 }
        };
        
        this.loadImage();
        this.initializeElements();
        this.setupEventListeners();
        this.updateBalance();
        this.updateCounterDisplay();
        this.startGame();
        this.initializeAllBets();
        this.setupGameMenu();
        this.setupResponsiveLayout();
        this.setupBetsTabs();
        this.generateMockBets();
        this.setupQuickAmountButtons();
        this.setupAutoBetting();
        this.setupResponsiveLayout();
        
        // Preserve user balance from localStorage on initialization
        this.initializeUserBalance();
    }
    
    // Initialize user balance from session data
    initializeUserBalance() {
        const userData = localStorage.getItem('userData');
        const isDemo = localStorage.getItem('isDemo') === 'true';
        
        if (userData) {
            const user = JSON.parse(userData);
            // Set balance based on user type - use saved balance for demo users too
            this.playerBalance = user.balance || (isDemo ? 3000 : 0);
            this.currentUser = user;
            
            // Update the display
            this.updateBalance();
            
            console.log('Balance initialized:', this.playerBalance, 'Demo:', isDemo);
        }
    }
    
    // Method to safely update player balance and sync with server
    async updatePlayerBalance(newBalance, reason = 'update') {
        const isDemo = localStorage.getItem('isDemo') === 'true';
        
        // Ensure balance doesn't go below 0
        newBalance = Math.max(0, newBalance);
        
        if (isDemo) {
            // For demo users, update locally and maintain in localStorage
            this.playerBalance = newBalance;
            
            // Update user data in localStorage for demo
            const userData = localStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                user.balance = newBalance;
                localStorage.setItem('userData', JSON.stringify(user));
            }
            
            this.updateBalance();
            console.log(`Demo balance updated to ${newBalance} (${reason})`);
            return;
        }
        
        // For real users, update locally and sync with server
        this.playerBalance = newBalance;
        this.updateBalance();
        
        // Update user data in localStorage
        const userData = localStorage.getItem('userData');
        if (userData) {
            const user = JSON.parse(userData);
            user.balance = newBalance;
            localStorage.setItem('userData', JSON.stringify(user));
        }
        
        console.log(`Real user balance updated to ${newBalance} (${reason})`);
    }

    // Currency formatting method
    formatCurrency(amount) {
        const numAmount = parseFloat(amount) || 0;
        return `KES ${numAmount.toFixed(2)}`;
    }

    updateCounterGlow(counterElement, multiplier) {
        // Remove all existing glow classes from counter
        counterElement.classList.remove('blue-glow', 'purple-glow', 'pink-glow');
        
        // Get game container for canvas-wide glow effects
        const gameContainer = document.querySelector('.game-container') || document.body;
        gameContainer.classList.remove('blue-glow', 'purple-glow', 'pink-glow');
        
        // Apply color glow based on multiplier ranges
        if (multiplier >= 1.00 && multiplier < 2.00) {
            counterElement.classList.add('blue-glow');
            gameContainer.classList.add('blue-glow');
        } else if (multiplier >= 2.00 && multiplier < 10.00) {
            counterElement.classList.add('purple-glow');
            gameContainer.classList.add('purple-glow');
        } else if (multiplier >= 10.00) {
            counterElement.classList.add('pink-glow');
            gameContainer.classList.add('pink-glow');
        }
    }

    setupResponsiveLayout() {
        const handleResize = () => {
            const isMobile = window.innerWidth <= 768;
            const leftSidebar = document.getElementById('left-sidebar');
            const mobileBets = document.getElementById('mobile-bets-section');
            
            if (isMobile) {
                // Mobile: Hide sidebar, show mobile bets
                if (leftSidebar) leftSidebar.style.display = 'none';
                if (mobileBets) mobileBets.style.display = 'block';
            } else {
                // Desktop: Show sidebar, hide mobile bets
                if (leftSidebar) leftSidebar.style.display = 'flex';
                if (mobileBets) mobileBets.style.display = 'none';
            }
        };
        
        // Initial call
        handleResize();
        
        // Add resize listener with debouncing
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleResize, 100);
        });
    }

    setupGameMenu() {
        const gameMenuBtn = document.getElementById('game-menu-btn');
        const gameMenu = document.getElementById('game-menu');
        
        if (!gameMenuBtn || !gameMenu) {
            console.error('Game menu elements not found');
            return;
        }
        
        // Ensure menu starts hidden
        gameMenu.style.display = 'none';
        gameMenu.classList.remove('show');
        
        gameMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            console.log('Menu button clicked');
            
            // Toggle the menu visibility
            const isVisible = gameMenu.classList.contains('show');
            
            if (isVisible) {
                gameMenu.classList.remove('show');
                setTimeout(() => {
                    gameMenu.style.display = 'none';
                }, 300); // Wait for transition
            } else {
                gameMenu.style.display = 'block';
                // Force reflow
                gameMenu.offsetHeight;
                gameMenu.classList.add('show');
            }
            
            console.log('Menu visibility toggled, now showing:', !isVisible);
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!gameMenu.contains(e.target) && !gameMenuBtn.contains(e.target)) {
                if (gameMenu.classList.contains('show')) {
                    gameMenu.classList.remove('show');
                    setTimeout(() => {
                        gameMenu.style.display = 'none';
                    }, 300);
                }
            }
        });

        // Handle menu item clicks
        gameMenu.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) {
                const action = menuItem.dataset.action;
                this.handleMenuAction(action);
                // Close menu after action
                gameMenu.classList.remove('show');
                setTimeout(() => {
                    gameMenu.style.display = 'none';
                }, 300);
            }
        });
    }

    handleMenuAction(action) {
        switch (action) {
            case 'sound':
                break;
            case 'animation':
                break;
            case 'bet-history':
                break;
            case 'how-to-play':
                break;
            case 'game-rules':
                break;
            case 'provably-fair':
                break;
        }
        
        // Close menu after action
        document.getElementById('game-menu').classList.remove('show');
    }

    // Round Info Modal functionality
    showRoundInfo(roundNumber, multiplier) {
        const modal = document.getElementById('round-info-modal');
        const currentTime = new Date();
        const timeString = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}:${currentTime.getSeconds().toString().padStart(2, '0')}`;
        
        // Generate random hash values (simulating provably fair hashes)
        const generateHash = (length) => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };
        
        // Update modal content
        document.getElementById('modal-round-number').textContent = roundNumber;
        document.getElementById('modal-multiplier').textContent = `${multiplier.toFixed(2)}x`;
        document.getElementById('modal-time').textContent = timeString;
        document.getElementById('modal-hash1').textContent = generateHash(40);
        document.getElementById('modal-hash2').textContent = generateHash(20);
        document.getElementById('modal-hash3').textContent = generateHash(20);
        document.getElementById('modal-hash4').textContent = generateHash(20);
        
        // Show modal
        modal.style.display = 'block';
        
        // Add event listeners for closing modal
        const closeBtn = modal.querySelector('.close-modal');
        const modalContent = modal.querySelector('.modal-content');
        
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        // Add copy functionality to hash items
        modal.querySelectorAll('.hash-item').forEach(item => {
            item.onclick = () => {
                navigator.clipboard.writeText(item.textContent).then(() => {
                    const originalText = item.textContent;
                    item.textContent = 'Copied!';
                    item.style.color = '#30fcbe';
                    setTimeout(() => {
                        item.textContent = originalText;
                        item.style.color = '#ffffff';
                    }, 1000);
                }).catch(() => {
                    console.log('Copy failed');
                });
            };
        });
    }

    // All Bets functionality
    initializeAllBets() {
        this.allBetsData = [];
        this.allBetsHistory = []; // Store all bets for the "show more" feature
        this.betCount = 0;

        // Do not seed here; we populate during the 'waiting' phase only
        // Background timer: trickle in bets only while waiting for next round
        setInterval(() => {
            if (this.gameState === 'waiting') {
                const bursts = Math.floor(Math.random() * 3) + 1; // 1-3 bets per tick
                for (let i = 0; i < bursts; i++) {
                    this.generateRandomBet();
                }
            }
        }, 1500);

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
        
        // Setup show more bets functionality
        this.setupShowMoreBets();
    }

    setupShowMoreBets() {
        // Add a "Show More Bets" button to the all bets section
        const allBetsContainer = document.getElementById('all-bets');
        const showMoreBetsBtn = document.createElement('div');
        showMoreBetsBtn.className = 'show-more-bets-btn';
        showMoreBetsBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Show All Bets';
        showMoreBetsBtn.style.cssText = `
            text-align: center;
            padding: 10px;
            background: rgba(48, 252, 190, 0.1);
            border-radius: 8px;
            cursor: pointer;
            color: #30fcbe;
            font-size: 12px;
            margin-top: 10px;
            transition: all 0.3s ease;
        `;
        
        allBetsContainer.parentNode.appendChild(showMoreBetsBtn);
        
        showMoreBetsBtn.addEventListener('click', () => {
            const isExpanded = allBetsContainer.classList.contains('expanded');
            allBetsContainer.classList.toggle('expanded');
            showMoreBetsBtn.innerHTML = isExpanded ? 
                '<i class="fas fa-chevron-down"></i> Show All Bets' : 
                '<i class="fas fa-chevron-up"></i> Show Less';
        });
    }

    generateRandomBet() {
        // Generate player name in format 'a****u'
        const playerName = this.generateRandomPlayerName();
        
        const betAmount = (Math.random() * 200 + 10).toFixed(2);
        
        // Randomly decide if this bet will cash out or crash
        const willCashOut = Math.random() > 0.3; // 70% chance to cash out
        
        const bet = {
            id: playerName,
            amount: parseFloat(betAmount),
            cashedOut: false,
            crashed: false,
            multiplier: null,
            status: ''
        };

        this.allBetsData.unshift(bet);
        this.allBetsHistory.unshift(bet);
        this.betCount++;
        
        // Keep only last 8 bets visible in main view
        if (this.allBetsData.length > 8) {
            this.allBetsData.pop();
        }

    // Simulate realistic cash out timing based on current multiplier
    // Note: during 'waiting' we just collect bets; no cashouts are processed then
    if (willCashOut && this.gameState === 'flying') {
            setTimeout(() => {
                if (bet.status === '' && this.gameState === 'flying' && this.counter <= this.randomStop) {
                    // Cash out at current multiplier with slight randomization
                    const cashOutMultiplier = Math.min(this.counter + (Math.random() * 0.2 - 0.1), this.randomStop - 0.1);
                    bet.cashedOut = true;
                    bet.multiplier = Math.max(1.0, parseFloat(cashOutMultiplier.toFixed(2)));
                    bet.status = `${bet.multiplier}x`;
                    this.updateAllBetsDisplay();
                }
            }, Math.random() * 5000 + 1000); // Cash out between 1-6 seconds
        }

        // Only redraw the All Bets list live during 'waiting'.
        if (this.gameState === 'waiting') {
            this.updateAllBetsDisplay();
            this.updateBetCount();
        }
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
        this.removeBetButton = document.getElementById('remove-bet-button');
        this.secondBetPanel = document.getElementById('second-bet-panel');
        this.allBetsContainer = document.getElementById('all-bets');
        this.mainContainer = document.getElementById('main-container');
        
        // Mode toggles
        this.modeToggle1 = document.getElementById('mode-toggle-1');
        this.modeToggle2 = document.getElementById('mode-toggle-2');
        this.autoFeatures1 = document.getElementById('auto-features-1');
        this.autoFeatures2 = document.getElementById('auto-features-2');
        
        this.messageElement.textContent = 'Wait for the next round';
        this.updateBalance();
    }

    setupEventListeners() {
        // Bet button listeners
        this.betButton1.addEventListener('click', () => this.handleBet('bet1'));
        this.betButton2.addEventListener('click', () => this.handleBet('bet2'));
        
        // Add/Remove bet buttons (inline)
        if (this.addBetButton) {
            this.addBetButton.addEventListener('click', () => this.showSecondBet());
        }
        if (this.removeBetButton) {
            this.removeBetButton.addEventListener('click', () => this.hideSecondBet());
        }
        
        // Mode toggle listeners
        if (this.modeToggle1) {
            this.modeToggle1.addEventListener('change', () => this.toggleAutoFeatures(1));
        }
        if (this.modeToggle2) {
            this.modeToggle2.addEventListener('change', () => this.toggleAutoFeatures(2));
        }
        
        // Quick amount buttons with enhanced functionality
        document.querySelectorAll('.quick-amount').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = parseInt(e.target.dataset.amount);
                const panel = e.target.closest('.bet-panel');
                const input = panel.querySelector('input[type="number"]');
                const currentValue = parseInt(input.value) || 0;
                
                // Add to current value instead of replacing
                input.value = currentValue + amount;
                
                // Trigger change event for any listeners
                input.dispatchEvent(new Event('input'));
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

    }

    setupChatListeners() {
    // Support multiple chat toggles including header button
    const chatToggle = document.getElementById('chat-toggle') || document.getElementById('chat-toggle-nav') || document.getElementById('chat-toggle-sidebar');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatCloseBtn = document.getElementById('chat-close-btn');
        const rightSidebar = document.getElementById('right-sidebar');
        const sendChatBtn = document.getElementById('send-chat');
        const chatInput = document.getElementById('chat-input');

        // Enhanced mobile chat handling
        const isMobile = () => window.innerWidth <= 900;
        
        // Initialize chat state - chat is hidden by default
        const initializeChatState = () => {
            rightSidebar.classList.remove('chat-open');
            if (chatToggle) chatToggle.classList.remove('active');
            if (chatToggleBtn) chatToggleBtn.classList.remove('active');
            
            if (isMobile()) {
                // Show mobile bets section
                const mobileBetsSection = document.getElementById('mobile-bets-section');
                if (mobileBetsSection) {
                    mobileBetsSection.style.display = 'block';
                }
            }
        };

        // Chat toggle functionality for both buttons
        const handleChatToggle = () => {
            const isOpen = rightSidebar.classList.contains('chat-open');
            
            if (isOpen) {
                // Close chat
                rightSidebar.classList.remove('chat-open');
                if (chatToggle) chatToggle.classList.remove('active');
                if (chatToggleBtn) {
                    chatToggleBtn.classList.remove('active');
                    chatToggleBtn.classList.remove('chat-hidden'); // Show chat button
                }
            } else {
                // Open chat
                rightSidebar.classList.add('chat-open');
                if (chatToggle) chatToggle.classList.add('active');
                if (chatToggleBtn) {
                    chatToggleBtn.classList.add('active');
                    chatToggleBtn.classList.add('chat-hidden'); // Hide chat button
                }
            }
        };

        // Close chat function
        const handleChatClose = () => {
            rightSidebar.classList.remove('chat-open');
            if (chatToggle) chatToggle.classList.remove('active');
            if (chatToggleBtn) {
                chatToggleBtn.classList.remove('active');
                chatToggleBtn.classList.remove('chat-hidden'); // Show chat button again
            }
        };

        // Add event listeners for all buttons
        if (chatToggle) {
            chatToggle.addEventListener('click', handleChatToggle);
        }
        if (chatToggleBtn) {
            chatToggleBtn.addEventListener('click', handleChatToggle);
        }
        if (chatCloseBtn) {
            chatCloseBtn.addEventListener('click', handleChatClose);
        }

        // Close chat when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (isMobile() && 
                rightSidebar.classList.contains('chat-open') && 
                !rightSidebar.contains(e.target) && 
                !e.target.closest('#chat-toggle-btn') &&
                !(chatToggle && chatToggle.contains(e.target))) {
                handleChatClose();
            }
        });

        // Sidebar toggle (hamburger) for left sidebar on mobile
        const sidebarToggleBtn = document.getElementById('sidebar-toggle');
        const leftSidebar = document.getElementById('left-sidebar');
        if (sidebarToggleBtn && leftSidebar) {
            sidebarToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                leftSidebar.classList.toggle('open');
            });
            document.addEventListener('click', (e) => {
                if (leftSidebar.classList.contains('open') && !leftSidebar.contains(e.target) && !sidebarToggleBtn.contains(e.target)) {
                    leftSidebar.classList.remove('open');
                }
            });
        }

        sendChatBtn.addEventListener('click', () => this.sendChatMessage());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });

        // Handle window resize with proper state management
        window.addEventListener('resize', () => {
            initializeChatState();
        });

        // Initialize on load
        initializeChatState();
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
        // Chat functionality removed - empty stub to prevent errors
        return;
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

    showSecondBet() {
        this.secondBetPanel.style.display = 'block';
        if (this.addBetButton) {
            this.addBetButton.style.display = 'none';
        }
    }
    
    hideSecondBet() {
        this.secondBetPanel.style.display = 'none';
        if (this.addBetButton) {
            this.addBetButton.style.display = 'inline-flex';
        }
        // Reset second bet if hidden
        this.bets.bet2 = { placed: false, amount: 0, cashedOut: false };
        this.betButton2.textContent = 'BET';
        this.betButton2.className = 'bet-button';
    }
    
    toggleAutoFeatures(betNumber) {
        const toggle = document.getElementById(`mode-toggle-${betNumber}`);
        const autoFeatures = document.getElementById(`auto-features-${betNumber}`);
        
        if (toggle && autoFeatures) {
            if (toggle.checked) {
                autoFeatures.style.display = 'block';
            } else {
                autoFeatures.style.display = 'none';
                // Reset auto options when switching to manual mode
                const autoBetToggle = document.getElementById(`auto-bet-toggle-${betNumber}`);
                const autoCashoutToggle = document.getElementById(`auto-cashout-toggle-${betNumber}`);
                if (autoBetToggle) autoBetToggle.checked = false;
                if (autoCashoutToggle) autoCashoutToggle.checked = false;
            }
        }
    }

    toggleSecondBet() {
        // Legacy function - keeping for compatibility
        if (this.secondBetPanel.style.display === 'none') {
            this.showSecondBet();
        } else {
            this.hideSecondBet();
        }
    }

    handleBet(betType) {
        const bet = this.bets[betType];
        const input = betType === 'bet1' ? this.betInput1 : this.betInput2;
        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;

        if (bet.placed && !bet.cashedOut && this.gameState === 'flying') {
            // Cash out during flight
            this.cashOut(betType);
        } else if (bet.pending) {
            // Cancel pending bet
            this.cancelBet(betType);
        } else {
            // Place new bet
            this.placeBet(betType);
        }
    }

    placeBet(betType, customAmount = null) {
        const bet = this.bets[betType];
        const input = betType === 'bet1' ? this.betInput1 : this.betInput2;
        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
        const amount = customAmount !== null ? customAmount : parseFloat(input.value);

        if (bet.placed || bet.pending || isNaN(amount) || amount <= 0 || amount > this.playerBalance) {
            this.messageElement.textContent = amount > this.playerBalance ? 'Insufficient balance' : 'Invalid bet amount';
            return;
        }

        // Update balance using the proper method
        this.updatePlayerBalance(this.playerBalance - amount, 'bet');
        
        if (this.gameState === 'waiting') {
            // Place bet immediately for current round
            bet.placed = true;
            bet.amount = amount;
            bet.cashedOut = false;
            bet.pending = false;

            button.textContent = `${this.formatCurrency(amount)} PLACED`;
            button.className = 'bet-button placed';
            this.messageElement.textContent = `Bet placed: ${this.formatCurrency(amount)} - Ready for takeoff!`;
        } else {
            // Place bet for next round
            bet.pending = true;
            bet.amount = amount;
            bet.placed = false;
            bet.cashedOut = false;

            button.textContent = 'CANCEL';
            button.className = 'bet-button cancel';
            this.messageElement.textContent = `Bet queued for next round: ${this.formatCurrency(amount)}`;
        }
    }

    cancelBet(betType) {
        const bet = this.bets[betType];
        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;

        if (!bet.pending) return;

        // Refund the bet amount
        this.playerBalance += bet.amount;
        
        // Reset bet state
        bet.pending = false;
        bet.placed = false;
        bet.amount = 0;
        bet.cashedOut = false;

        button.textContent = 'BET';
        button.className = 'bet-button';
        this.updateBalance();
        this.messageElement.textContent = 'Bet cancelled and refunded';
        
        // Add to chat
    }

    // Update bet buttons during flight to show potential cashout
    updateBetButtons() {
        Object.keys(this.bets).forEach(betType => {
            const bet = this.bets[betType];
            const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
            
            if (bet.placed && !bet.cashedOut && this.gameState === 'flying') {
                // Show cashout option during flight with orange color
                const potentialWinnings = (bet.amount * this.counter).toFixed(2);
                button.textContent = `CASH OUT ${this.formatCurrency(potentialWinnings)}`;
                button.className = 'bet-button placed'; // Use 'placed' class for orange color
            } else if (bet.pending) {
                // Show cancel option for pending bets
                button.textContent = 'CANCEL';
                button.className = 'bet-button cancel';
            } else if (!bet.placed && !bet.pending) {
                // Show bet option when no bet is active
                button.textContent = 'BET';
                button.className = 'bet-button';
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
        bet.cashedOut = true;
        bet.placed = false;
        bet.multiplier = this.counter;

        // Update balance using the proper method
        this.updatePlayerBalance(this.playerBalance + winnings, 'cashout');

        button.textContent = 'BET';
        button.className = 'bet-button';
        this.messageElement.textContent = `Cashed out: ${this.formatCurrency(winnings)} (${this.counter.toFixed(2)}x)`;
        
        // Add to chat
    }

    updateBalance() {
        // Update game header balance
        if (this.balanceElement) {
            this.balanceElement.textContent = this.formatCurrency(this.playerBalance);
        }
        
        // Update navigation balance as well for consistency
        const navBalance = document.getElementById('nav-balance');
        if (navBalance) {
            navBalance.textContent = this.formatCurrency(this.playerBalance);
        }
    }

    updateCounterDisplay() {
        // Calculate visible count based on screen width
        const screenWidth = window.innerWidth;
        let visibleCount;
        
        if (screenWidth >= 1200) {
            visibleCount = 10; // Large screens show 10 rounds
        } else if (screenWidth >= 992) {
            visibleCount = 8; // Medium screens show 8 rounds
        } else if (screenWidth >= 768) {
            visibleCount = 6; // Small screens show 6 rounds
        } else {
            visibleCount = 4; // Very small screens show 4 rounds
        }
        
        const visibleMultipliers = this.counterDepo.slice(0, visibleCount);
        const hiddenMultipliers = this.counterDepo.slice(visibleCount);

        // Update visible multipliers with click handlers
        this.lastCounters.innerHTML = visibleMultipliers.map((i, index) => {
            let classNameForCounter = '';
            if (i < 2.00) {
                classNameForCounter = 'blueBorder';
            } else if (i >= 2 && i < 10) {
                classNameForCounter = 'purpleBorder';
            } else {
                classNameForCounter = 'burgundyBorder';
            }
            return `<p class="${classNameForCounter}" data-round="${this.roundNumber - index}" data-multiplier="${i}" onclick="game.showRoundInfo(${this.roundNumber - index}, ${i})">${i.toFixed(2)}</p>`;
        }).join('');

        // Update hidden multipliers with click handlers
        const hiddenRoundsContainer = document.getElementById('hidden-rounds');
        const showMoreBtn = document.getElementById('show-more-rounds');
        
        if (hiddenMultipliers.length > 0) {
            hiddenRoundsContainer.innerHTML = `
                <div class="hidden-rounds-grid">
                    ${hiddenMultipliers.map((i, index) => {
                        let classNameForCounter = '';
                        if (i < 2.00) {
                            classNameForCounter = 'blueBorder';
                        } else if (i >= 2 && i < 10) {
                            classNameForCounter = 'purpleBorder';
                        } else {
                            classNameForCounter = 'burgundyBorder';
                        }
                        const roundNum = this.roundNumber - visibleCount - index;
                        return `<p class="${classNameForCounter}" data-round="${roundNum}" data-multiplier="${i}" onclick="game.showRoundInfo(${roundNum}, ${i})">${i.toFixed(2)}</p>`;
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
        this.gameState = 'flying';
        this.roundNumber++;
        this.lastUpdateTime = Date.now(); // Reset timing for smooth progression
        
        // Reset plane position to starting point (bottom left)
        this.x = this.startX;
        this.y = this.startY;
        this.counter = 1.0;
        this.dotPath = []; // Clear the previous path
        this.isFlying = true;
        
        // Start background rotation during flying state
        const bgImage = document.getElementById('bg-image');
        if (bgImage) {
            bgImage.classList.add('rotating');
        }
        
        // Set initial counter glow (starts at 1.00x - blue glow)
        const counterElement = document.getElementById('counter');
        if (counterElement) {
            this.updateCounterGlow(counterElement, 1.0);
        }
        
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    draw() {
        const currentTime = Date.now();
        
        // Update counter every ~100ms for smooth but not too frequent updates
        if (currentTime - this.lastUpdateTime > 100) {
            this.lastUpdateTime = currentTime;
            
            // Update counter with realistic Aviator progression - starts slow, speeds up gradually
            let increment;
            if (this.counter < 1.5) {
                // Very slow start (like real Aviator)
                increment = 0.01;
            } else if (this.counter < 2.0) {
                // Slightly faster
                increment = 0.015;
            } else if (this.counter < 5.0) {
                // Medium speed
                increment = 0.02 + (this.counter - 2.0) * 0.005;
            } else if (this.counter < 10.0) {
                // Faster progression
                increment = 0.035 + (this.counter - 5.0) * 0.01;
            } else {
                // Very fast at high multipliers
                increment = 0.085 + (this.counter - 10.0) * 0.015;
            }
            
            this.counter += increment;
            const counterElement = document.getElementById('counter');
            counterElement.textContent = this.counter.toFixed(2) + 'x';
            
            // Update counter glow based on multiplier value
            this.updateCounterGlow(counterElement, this.counter);
        }

        // Check for auto-cashout conditions
        this.handleAutoCashout();

        // Update bet buttons with potential cashout amounts
        this.updateBetButtons();

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update position - plane flies from bottom left toward top right with realistic trajectory
        
        if (this.counter < this.randomStop) {
            // Check if plane should be in hovering mode (after 60% of canvas width)
            const hoverPoint = this.canvas.width * 0.6;
            
            if (this.x < hoverPoint) {
                // Phase 1: Horizontal movement for first 5px (more visible horizontal phase)
                if (this.x < 5) {
                    this.x += this.speedX;
                    this.y = this.startY; // Stay at ground level
                    this.pathX = this.x;
                    this.pathY = this.y;
                } else {
                    // Phase 2: Curved upward trajectory moving toward hovering position
                    this.x += this.speedX;
                    
                    // Calculate progress to hover point
                    const totalDistance = hoverPoint - 5; 
                    const horizontalProgress = Math.min(1, (this.x - 5) / totalDistance);
                    
                    // Create a realistic takeoff curve - steep at start, then gradual
                    const curveHeight = this.startY - 100; // Total height to climb
                    const curveFactor = 1 - Math.pow(1 - horizontalProgress, 1.5); // Steep initial rise
                    
                    this.y = this.startY - (curveHeight * curveFactor);
                    this.pathX = this.x;
                    this.pathY = this.y;
                }
            } else {
                // Phase 3: Hovering - plane hovers at fixed position while path continues smoothly
                if (!this.isHovering) {
                    // First time entering hover mode - set fixed plane position
                    this.isHovering = true;
                    this.planeHoverX = hoverPoint;
                    this.planeHoverY = this.y; // Current Y position becomes hover center
                    // Ensure the path has a terminal point at the baseline hover position
                    if (this.dotPath.length === 0) {
                        this.dotPath.push({ x: this.planeHoverX, y: this.planeHoverY });
                    }
                }
                
                // Don't continue extending path during hovering - make path and plane move together
                // Calculate hover movement
                this.hoverOffset += 0.05; // Reduced speed of hovering animation for smoother, slower bobbing
                const hoverAmplitude = 30; // How far up/down to hover
                const verticalOffset = Math.sin(this.hoverOffset) * hoverAmplitude;
                
                // Both plane and path endpoint move together in perfect sync
                this.x = this.planeHoverX;
                this.y = this.planeHoverY + verticalOffset;
                
                // Update the last path point to exactly match plane position
                // Store baseline (no verticalOffset) to avoid double-offset when rendering
                if (this.dotPath.length > 0) {
                    this.dotPath[this.dotPath.length - 1] = { x: this.planeHoverX, y: this.planeHoverY };
                }
            }
            this.isFlying = true;
        } else {
            this.isFlying = false;
            this.handleCrash();
            return;
        }

        // Draw path and plane
        if (!this.isHovering) {
            // Normal flight - path follows plane, continue extending
            this.dotPath.push({ x: this.x, y: this.y });
        }
        // During hovering, don't add new path points - the existing path will move with hover offset in drawPlaneShadow and drawGame
        this.drawGame();

        // Continue animation
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    generateRandomBet() {
        // Generate player name in format 'a***d'
        const playerName = this.generateRandomPlayerName();
        const avatar = this.pickRandomAvatar();
        const betAmount = (Math.random() * 200 + 10).toFixed(2);
        
        // Randomly decide if this bet will cash out or crash
        const willCashOut = Math.random() > 0.3; // 70% chance to cash out
        
        // Use a consistent schema with other bet lists to avoid undefineds
        const bet = {
            player: playerName,
            avatar,
            amount: parseFloat(betAmount),
            cashedOut: false,
            crashed: false,
            multiplier: null,
            win: null,
            status: ''
        };

        this.allBetsData.unshift(bet);
        this.allBetsHistory.unshift(bet);
        this.betCount++;
        
        // Keep only a recent window visible in main list for performance
        if (this.allBetsData.length > 80) {
            this.allBetsData.pop();
        }

        // Simulate realistic cash out timing based on current multiplier
        if (willCashOut && this.gameState === 'flying') {
            setTimeout(() => {
                if (bet.status === '' && this.gameState === 'flying' && this.counter <= this.randomStop) {
                    // Cash out at current multiplier with slight randomization
                    const cashOutMultiplier = Math.min(this.counter + (Math.random() * 0.2 - 0.1), this.randomStop - 0.1);
                    bet.cashedOut = true;
                    bet.multiplier = Math.max(1.0, parseFloat(cashOutMultiplier.toFixed(2)));
                    bet.win = parseFloat((bet.amount * bet.multiplier).toFixed(2));
                    bet.status = `${bet.multiplier}x`;
                    this.updateAllBetsDisplay();
                }
            }, Math.random() * 5000 + 1000); // Cash out between 1-6 seconds
        }

        this.updateAllBetsDisplay();
        this.updateBetCount();
    }

    drawPlaneShadow() {
        if (this.dotPath.length > 2) {
            // Calculate hover offset to apply to entire shadow curve during hovering
            let shadowOffset = 0;
            if (this.isHovering) {
                const hoverAmplitude = 30;
                shadowOffset = Math.sin(this.hoverOffset) * hoverAmplitude;
            }
            this.ctx.beginPath();
            this.ctx.moveTo(this.dotPath[0].x, this.dotPath[0].y + shadowOffset);
            for (let i = 1; i < this.dotPath.length; i++) {
                this.ctx.lineTo(this.dotPath[i].x, this.dotPath[i].y + shadowOffset);
            }
            this.ctx.lineTo(this.dotPath[this.dotPath.length - 1].x, this.canvas.height);
            this.ctx.lineTo(this.dotPath[0].x, this.canvas.height);
            this.ctx.closePath();
            this.ctx.fillStyle = 'rgba(220, 53, 69, 0.1)';
            this.ctx.fill();
        }
    }

    drawGame() {
        this.ctx.save();
        // Draw path with gradient trail effect
        if (this.dotPath.length > 1) {
            this.ctx.beginPath();
            this.ctx.lineWidth = 4;
            // Calculate hover offset to apply to entire curve during hovering
            let curveOffset = 0;
            if (this.isHovering) {
                const hoverAmplitude = 30;
                curveOffset = Math.sin(this.hoverOffset) * hoverAmplitude;
            }
            // Create gradient trail effect with hover offset applied to entire curve
            for (let i = 1; i < this.dotPath.length; i++) {
                const opacity = Math.min(1, (i / this.dotPath.length) * 2); // Fade in effect
                this.ctx.strokeStyle = `rgba(220, 53, 69, ${opacity})`; // Red with varying opacity
                this.ctx.beginPath();
                this.ctx.moveTo(this.dotPath[i - 1].x, this.dotPath[i - 1].y + curveOffset);
                this.ctx.lineTo(this.dotPath[i].x, this.dotPath[i].y + curveOffset);
                this.ctx.stroke();
            }
            // Draw red translucent shadow under the curve only during flight
            if (this.isFlying) {
                this.drawPlaneShadow();
            }
        }
        // Draw plane at its current position (already includes hover movement)
        if (this.image.complete) {
            this.ctx.drawImage(this.image, this.x - 22, this.y - 65, 150, 70);
        }
        this.ctx.restore();
    }

    handleCrash() {
        this.gameState = 'crashed';
        cancelAnimationFrame(this.animationId);
        
        // Stop background rotation when crashed
        const bgImage = document.getElementById('bg-image');
        if (bgImage) {
            bgImage.classList.remove('rotating');
        }
        
        // Remove any canvas-wide glow classes on crash
        const gameContainer = document.querySelector('.game-container') || document.body;
        if (gameContainer) {
            gameContainer.classList.remove('blue-glow', 'purple-glow', 'pink-glow');
        }
        
        // Start crash animation - plane disappears upwards quickly
        this.animateCrash();
        
        // Store the crash multiplier
        const crashMultiplier = this.counter.toFixed(2);
        
        // Update counter to show "FLEW AWAY" above the multiplier
        const counterElement = document.getElementById('counter');
        counterElement.innerHTML = `
            <div style="color: white; font-size: 0.8em; margin-bottom: 8px; font-weight: bold;">FLEW AWAY</div>
            <div style="color: #ff4444;">${crashMultiplier}x</div>
        `;
        // Keep existing glow class, just add crashed for sizing/animation
        counterElement.classList.add('crashed');
        
        // Mark all active bets as crashed (leave status empty)
        this.allBetsData.forEach(bet => {
            if (bet.status === '') {
                bet.crashed = true;
                bet.status = '';
            }
        });
        this.allBetsHistory.forEach(bet => {
            if (bet.status === '') {
                bet.crashed = true;
                bet.status = '';
            }
        });
        this.updateAllBetsDisplay();
        
        // Handle uncashed player bets
        Object.keys(this.bets).forEach(betType => {
            const bet = this.bets[betType];
            const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
            if (bet.placed && !bet.cashedOut) {
                button.textContent = 'BET';
                button.className = 'bet-button';
                button.style.animation = '';
                bet.placed = false;
                bet.cashedOut = false;
                bet.amount = 0;
            }
        });

        // Add crash to history (left side of previous rounds)
        this.counterDepo.unshift(parseFloat(crashMultiplier));
        this.updateCounterDisplay();

        this.messageElement.textContent = 'Round ended - Place your bet for the next round';
        
        // Wait 2 seconds, then start countdown
        setTimeout(() => {
            this.startCountdown();
        }, 2000);
    }

    animateCrash() {
        const crashSpeed = 20; // pixels per frame - very fast upward movement
        
        // Ensure no lingering path/shadow gets drawn during crash
        const drawCrashedFrame = () => {
            // Only draw the plane sprite at its current position
            if (this.image && this.image.complete) {
                this.ctx.drawImage(this.image, this.x - 22, this.y - 65, 150, 70);
            }
        };
        
        const animateCrashFrame = () => {
            // Move plane upwards rapidly
            this.y -= crashSpeed;
            
            // Clear canvas and redraw
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            drawCrashedFrame();
            
            // Continue animation until plane is off-screen
            if (this.y > -50) { // Continue until well above canvas
                requestAnimationFrame(animateCrashFrame);
            } else {
                // Clear canvas completely when plane is gone
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                // Do not draw path or shadow after crash
            }
        };
        
        animateCrashFrame();
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
        this.gameState = 'waiting';

        // Reset and seed All Bets for the upcoming round during waiting only
        this.allBetsData = [];
        this.betCount = 0;
        // Initial seed so the list isn't empty at the start of waiting
        for (let i = 0; i < 15; i++) {
            this.generateRandomBet();
        }
        this.updateAllBetsDisplay();
        this.updateBetCount();
        let countdown = 5; // Extended to 5 seconds
        
        // Clear the main counter display
        const counterElement = document.getElementById('counter');
        counterElement.innerHTML = '';
        counterElement.className = 'waiting';
        
        // Create simple overlay on the game area
        const gameArea = document.getElementById('counterWrapper');
        const overlay = document.createElement('div');
        overlay.className = 'countdown-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1000;
            text-align: center;
            pointer-events: none;
        `;
        
        overlay.innerHTML = `
            <!-- UFC Logo above loading bar -->
            <div style="
                display: flex;
                justify-content: center;
                margin-bottom: 20px;
            ">
                <img src="ufc.svg" alt="UFC" height="100" style="opacity: 0.9;">
            </div>
            
            <!-- Loading Bar -->
            <div style="
                width: 200px;
                height: 6px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 3px;
                margin: 0 auto;
                overflow: hidden;
                box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
            ">
                <div class="countdown-progress" style="
                    height: 100%;
                    background: linear-gradient(90deg, #ff4444, #ff6666);
                    width: 0%;
                    transition: width 0.3s ease;
                    border-radius: 3px;
                "></div>
            </div>
            
            <!-- Spribe Logo below loading bar -->
            <div style="
                display: flex;
                justify-content: center;
                margin-top: 20px;
            ">
                <img src="spribe.svg" alt="Spribe" height="55" style="opacity: 0.8;">
            </div>
        `;
        
        gameArea.appendChild(overlay);
        
        // Enable betting immediately after crash
        Object.keys(this.bets).forEach(betType => {
            const bet = this.bets[betType];
            const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
            if (!bet.placed && !bet.pending) {
                button.textContent = 'BET';
                button.className = 'bet-button';
                button.style.animation = '';
            }
        });
        
        const countdownInterval = setInterval(() => {
            countdown--;
            
            // Update loading bar progress
            const progressBar = overlay.querySelector('.countdown-progress');
            if (progressBar) {
                const progress = ((5 - countdown) / 5) * 100;
                progressBar.style.width = `${progress}%`;
            }
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                
                // Remove overlay
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                
                // Reset counter appearance
                counterElement.className = '';
                
                // Update button states for placed bets when round starts
                Object.keys(this.bets).forEach(betType => {
                    const bet = this.bets[betType];
                    const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
                    if (bet.placed) {
                        button.textContent = `${this.formatCurrency(bet.amount)} ACTIVE`;
                        button.className = 'bet-button placed';
                    }
                });
                
                // Add 1 second wait before starting the game
                setTimeout(() => {
                    this.resetGame();
                }, 1000);
            }
        }, 1000);
    }

    resetGame() {
        this.randomStop = Math.random() * (10 - 0.8) + 0.8;
        this.counter = 1.0;
        this.x = this.startX; // Reset to starting position (bottom left)
        this.y = this.startY; // Reset to starting position (bottom left)
        this.pathX = 0; // Reset path X position
        this.pathY = this.canvas.height; // Reset path Y position
        this.isHovering = false; // Reset hovering state
        this.hoverOffset = 0; // Reset hover animation
        this.dotPath = [];
        this.isFlying = true;
        this.messageElement.textContent = '';
        
        // Reset counter display
        const counterElement = document.getElementById('counter');
        counterElement.textContent = '1.00x';
        counterElement.className = '';
        
        // Set initial counter glow for reset (starts at 1.00x - blue glow)
        this.updateCounterGlow(counterElement, 1.0);
        
        // Convert pending bets to active bets FIRST, then reset other bets
        Object.keys(this.bets).forEach(betType => {
            const bet = this.bets[betType];
            const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
            
            if (bet.pending) {
                // Convert pending bet to active bet
                bet.pending = false;
                bet.placed = true;
                bet.cashedOut = false;
                
                button.textContent = `${this.formatCurrency(bet.amount)} PLACED`;
                button.className = 'bet-button placed';
            } else if (!bet.placed) {
                // Reset empty bet slots
                bet.placed = false;
                bet.cashedOut = false;
                bet.amount = 0;
                
                button.textContent = 'BET';
                button.className = 'bet-button';
            }
        });
        
        // Clear visible bets for new round (but keep history)
        this.allBetsData = [];
        this.updateAllBetsDisplay();
        
        // Execute auto-bets for new round
        this.executeAutoBets();
        
        this.startGame();
    }

    setupBetsTabs() {
        // Desktop tabs
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabType = btn.dataset.tab;
                this.switchTab(tabType);
            });
        });

        // Show all bets toggles
        const showAllBtns = document.querySelectorAll('.show-all-toggle');
        showAllBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const betList = e.target.closest('.tab-content').querySelector('.bet-list');
                if (betList.classList.contains('expanded')) {
                    betList.classList.remove('expanded');
                    e.target.textContent = 'Show All';
                } else {
                    betList.classList.add('expanded');
                    e.target.textContent = 'Show Less';
                }
            });
        });

        // Top Results submenu handlers
        const topContent = document.getElementById('top-results-content');
        if (topContent) {
            topContent.querySelectorAll('.top-filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    topContent.querySelectorAll('.top-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.loadTopResults();
                });
            });
            const periodEl = document.getElementById('top-period');
            if (periodEl) {
                periodEl.addEventListener('change', () => this.loadTopResults());
            }
        }
    }

    switchTab(tabType) {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        document.querySelector(`[data-tab="${tabType}"]`).classList.add('active');
        
        // Handle different tab types
        if (tabType.includes('all-bets')) {
            document.getElementById(tabType.replace('all-bets', 'all-bets-content')).classList.add('active');
        } else if (tabType.includes('previous')) {
            document.getElementById(tabType.replace('previous-bets', 'previous-bets-content')).classList.add('active');
            this.loadPreviousBets();
        } else if (tabType.includes('top')) {
            document.getElementById(tabType.replace('top-results', 'top-results-content')).classList.add('active');
            this.loadTopResults();
        }
    }

    generateRandomPlayerName() {
        // Always return a username in the format a***d (avoid undefined)
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        const first = letters[Math.floor(Math.random() * letters.length)] || 'a';
        const last = letters[Math.floor(Math.random() * letters.length)] || 'd';
        return `${first}***${last}`;
    }

    generateMockBets() {
        this.allBetsData = [];
        this.previousBetsData = [];
        this.topResultsData = [];

        // Ensure 600+ bets per round
        const betCount = 600 + Math.floor(Math.random() * 250);
        for (let i = 0; i < betCount; i++) {
            const playerName = this.generateRandomPlayerName();
            const amount = parseFloat((Math.random() * 500 + 5).toFixed(2));
            const didCashOut = Math.random() < 0.35; // ~35% cash out
            const multiplier = didCashOut ? parseFloat((Math.random() * 5 + 1).toFixed(2)) : null;
            const win = multiplier ? parseFloat((amount * multiplier).toFixed(2)) : null;
            this.allBetsData.push({
                id: i + 1,
                player: playerName,
                avatar: this.pickRandomAvatar(),
                amount,
                multiplier,
                win,
                cashedOut: !!multiplier
            });
        }

        // Previous round simulated results: same schema as all-bets
        const prevCount = 600 + Math.floor(Math.random() * 250);
        for (let i = 0; i < prevCount; i++) {
            const playerName = this.generateRandomPlayerName();
            const amount = parseFloat((Math.random() * 500 + 5).toFixed(2));
            const multiplier = parseFloat((Math.random() * 5 + 1).toFixed(2));
            const win = parseFloat((amount * multiplier).toFixed(2));
            this.previousBetsData.push({
                id: i + 1,
                player: playerName,
                avatar: this.pickRandomAvatar(),
                amount,
                multiplier,
                win
            });
        }

        // Top results: randomize by current filter later
        for (let i = 0; i < 50; i++) {
            const playerName = this.generateRandomPlayerName();
            const amount = parseFloat((Math.random() * 700 + 20).toFixed(2));
            const multiplier = parseFloat((Math.random() * 90 + 10).toFixed(2));
            const win = parseFloat((amount * Math.max(1.1, multiplier)).toFixed(2));
            this.topResultsData.push({
                player: playerName,
                avatar: this.pickRandomAvatar(),
                amount,
                multiplier,
                win
            });
        }

        // Default sort by multiplier
        this.topResultsData.sort((a, b) => b.multiplier - a.multiplier);

        this.updateAllBetsDisplay();
        this.updateBetCount();
        this.loadPreviousBets();
        this.loadTopResults();
    }

    pickRandomAvatar() {
        // Avatars are 1..72 according to list_dir; pick safely within range
        const max = 72; 
        const idx = 1 + Math.floor(Math.random() * max);
        return `images/avtar/av-${idx}.png`;
    }
    
    getAvatarWithFallback(avatar) {
        // Create img element to test if avatar loads
        const img = new Image();
        img.onerror = () => {
            // If image fails to load, use a default avatar or icon
            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMzMGZjYmUiLz4KPGF2YXRhciBmaWxsPSIjMTkxOTE5IiBkPSJNMTIgMTJjMi4yIDAgNC0xLjggNC00cy0xLjgtNC00LTQtNCAxLjgtNCA0IDEuOCA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPgo8L3N2Zz4K';
        };
        img.src = avatar;
        return avatar;
    }

    updateAllBetsDisplay() {
        const allBetsContainer = document.getElementById('all-bets');
        const mobileAllBetsContainer = document.getElementById('mobile-all-bets');
        
        const betsHTML = this.allBetsData.slice(0, 50).map(bet => {
            const classes = ['bet-item'];
            if (bet.cashedOut) classes.push('cashed-glow');
            const x = bet.multiplier ? `${(bet.multiplier.toFixed ? bet.multiplier.toFixed(2) : bet.multiplier)}x` : '';
            const win = bet.win != null ? this.formatCurrency(bet.win) : '';
            const player = bet.player || bet.id || this.generateRandomPlayerName();
            const avatar = bet.avatar || this.pickRandomAvatar();
            return `
            <div class="${classes.join(' ')}">
                <span class="bet-player">
                    <img class="avatar" src="${avatar}" alt="${player}" 
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMzMGZjYmUiLz4KPHRleHQgeD0iMTIiIHk9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMTkxOTE5IiBmb250LXNpemU9IjEwIj7wn5G3PC90ZXh0Pgo8L3N2Zz4K'" 
                         loading="lazy"> 
                    ${player}
                </span>
                <span class="bet-amount">${this.formatCurrency(bet.amount)}</span>
                <span class="bet-multiplier">${x}</span>
                <span class="bet-status ${bet.cashedOut ? 'cashed-out' : ''}">${win}</span>
            </div>`;
        }).join('');

        if (allBetsContainer) allBetsContainer.innerHTML = betsHTML;
        if (mobileAllBetsContainer) mobileAllBetsContainer.innerHTML = betsHTML;
    }

    loadPreviousBets() {
        const previousBetsContainer = document.getElementById('previous-bets');
        const mobilePreviousBetsContainer = document.getElementById('mobile-previous-bets');
        const betsHTML = this.previousBetsData.slice(0, 100).map(bet => {
            const player = bet.player || this.generateRandomPlayerName();
            const avatar = bet.avatar || this.pickRandomAvatar();
            const mult = bet.multiplier.toFixed ? bet.multiplier.toFixed(2) : bet.multiplier;
            return `
            <div class="bet-item">
                <span class="bet-player">
                    <img class="avatar" src="${avatar}" alt="${player}" 
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMzMGZjYmUiLz4KPHRleHQgeD0iMTIiIHk9IjE2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMTkxOTE5IiBmb250LXNpemU9IjEwIj7wn5G3PC90ZXh0Pgo8L3N2Zz4K'" 
                         loading="lazy"> 
                    ${player}
                </span>
                <span class="bet-amount">${this.formatCurrency(bet.amount)}</span>
                <span class="bet-multiplier">${mult}x</span>
                <span class="bet-status">${this.formatCurrency(bet.win)}</span>
            </div>`;
        }).join('');
        if (previousBetsContainer) previousBetsContainer.innerHTML = betsHTML;
        if (mobilePreviousBetsContainer) mobilePreviousBetsContainer.innerHTML = betsHTML;
        const countEl = document.getElementById('previous-bet-count');
        if (countEl) countEl.textContent = this.previousBetsData.length;
    }

    loadTopResults() {
        const topResultsContainer = document.getElementById('top-results');
        const mobileTopResultsContainer = document.getElementById('mobile-top-results');
        
        // Decide current view
        const activeBtn = document.querySelector('#top-results-content .top-filter-btn.active');
        const view = activeBtn ? activeBtn.dataset.view : 'multipliers';
        const periodEl = document.getElementById('top-period');
        const period = periodEl ? periodEl.value : 'day';
        
        // Create a randomized list according to the view
        let list = [...this.topResultsData];
        if (view === 'multipliers') {
            list.sort((a, b) => b.multiplier - a.multiplier);
        } else if (view === 'wins') {
            list.sort((a, b) => b.win - a.win);
        } else {
            // rounds: simulate by sorting by amount as a proxy
            list.sort((a, b) => b.amount - a.amount);
        }
        
        // Optionally slice differently by period
        const sliceSize = period === 'day' ? 30 : period === 'month' ? 40 : 50;
        const betsHTML = list.slice(0, sliceSize).map(bet => {
            const player = bet.player || this.generateRandomPlayerName();
            const avatar = bet.avatar || this.pickRandomAvatar();
            const mult = bet.multiplier.toFixed ? bet.multiplier.toFixed(2) : bet.multiplier;
            return `
            <div class="bet-item">
                <span class="bet-player"><img class="avatar" src="${avatar}" alt="avatar"> ${player}</span>
                <span class="bet-amount">${this.formatCurrency(bet.amount)}</span>
                <span class="bet-multiplier">${mult}x</span>
                <span class="bet-status">${this.formatCurrency(bet.win)}</span>
            </div>`;
        }).join('');

        if (topResultsContainer) topResultsContainer.innerHTML = betsHTML;
        if (mobileTopResultsContainer) mobileTopResultsContainer.innerHTML = betsHTML;
        const countEl = document.getElementById('top-results-count');
        if (countEl) countEl.textContent = list.length;
    }

    updateBetCount() {
        const betCountElement = document.getElementById('bet-count');
        const mobileBetCountElement = document.getElementById('mobile-bet-count');
        
        if (betCountElement) betCountElement.textContent = this.allBetsData.length;
        if (mobileBetCountElement) mobileBetCountElement.textContent = this.allBetsData.length;
    }

    setupQuickAmountButtons() {
        // Enhanced quick amount functionality - adds to existing amount on repeated clicks
        this.lastClickedAmount = {};
        
        document.querySelectorAll('.quick-amount').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = parseFloat(e.target.dataset.amount);
                const panel = e.target.closest('.bet-panel');
                const input = panel.querySelector('input[type="number"]'); // Main bet input
                const currentValue = parseFloat(input.value) || 0;
                
                // Check if this button was clicked recently (within 2 seconds)
                const buttonKey = panel.id + '-' + e.target.textContent;
                const now = Date.now();
                
                if (this.lastClickedAmount[buttonKey] && (now - this.lastClickedAmount[buttonKey] < 2000)) {
                    // Add to existing amount
                    input.value = (currentValue + amount).toFixed(2);
                } else {
                    // Set new amount
                    input.value = amount.toFixed(2);
                }
                
                this.lastClickedAmount[buttonKey] = now;
                
                // Visual feedback
                e.target.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    e.target.style.transform = 'scale(1)';
                }, 150);
            });
        });
    }

    setupAutoBetting() {
        // Auto-betting state is already initialized in constructor
        
        // Handle bet button clicks in auto mode
        const betButton1 = document.getElementById('bet-button-1');
        const betButton2 = document.getElementById('bet-button-2');
        
        const originalPlaceBet1 = this.placeBet.bind(this, 'bet1');
        const originalPlaceBet2 = this.placeBet.bind(this, 'bet2');
        
        betButton1.addEventListener('click', (e) => {
            if (betButton1.classList.contains('auto-mode')) {
                this.toggleAutoBet('bet1');
            } else {
                originalPlaceBet1();
            }
        });
        
        betButton2.addEventListener('click', (e) => {
            if (betButton2.classList.contains('auto-mode')) {
                this.toggleAutoBet('bet2');
            } else {
                originalPlaceBet2();
            }
        });
    }

    toggleAutoBet(betType) {
        const state = this.autoBetState[betType];
        const betNumber = betType === 'bet1' ? '1' : '2';
        const button = document.getElementById(`bet-button-${betNumber}`);
        
        if (state.active) {
            // Stop auto-betting
            state.active = false;
            button.textContent = 'START AUTO BET';
            button.classList.remove('auto-active');
        } else {
            // Start auto-betting
            const autoBetInput = document.getElementById(`auto-bet-input-${betNumber}`);
            const amount = parseFloat(autoBetInput.value);
            
            if (amount <= 0 || amount > this.playerBalance) {
                this.messageElement.textContent = 'Invalid auto-bet amount!';
                return;
            }
            
            state.active = true;
            button.textContent = 'STOP AUTO BET';
            button.classList.add('auto-active');
            
            // Place first auto bet if game is waiting
            if (this.gameState === 'waiting') {
                this.placeAutoBet(betType);
            }
        }
    }

    placeAutoBet(betType) {
        const state = this.autoBetState[betType];
        if (!state.active) return;
        
        const betNumber = betType === 'bet1' ? '1' : '2';
        const autoBetInput = document.getElementById(`auto-bet-input-${betNumber}`);
        const amount = parseFloat(autoBetInput.value);
        
        if (amount > this.playerBalance) {
            // Stop auto-betting if insufficient funds
            this.toggleAutoBet(betType);
            this.messageElement.textContent = 'Insufficient funds for auto-bet!';
            return;
        }
        
        // Place the bet
        this.placeBet(betType, amount);
        
        // Update stats
        state.count++;
        this.updateAutoBetStats(betType);
    }

    updateAutoBetStats(betType) {
        const state = this.autoBetState[betType];
        const betNumber = betType === 'bet1' ? '1' : '2';
        
        document.getElementById(`auto-bet-count-${betNumber}`).textContent = state.count;
        document.getElementById(`auto-win-count-${betNumber}`).textContent = state.wins;
    document.getElementById(`auto-profit-${betNumber}`).textContent = this.formatCurrency(state.profit);
    }

    handleAutoCashout() {
        // Check auto-cashout conditions during game
        if (this.gameState !== 'flying') return;
        
        ['bet1', 'bet2'].forEach(betType => {
            const bet = this.bets[betType];
            if (!bet.placed || bet.cashedOut) return;
            
            const betNumber = betType === 'bet1' ? '1' : '2';
            
            // Check if auto-cashout is enabled for this bet
            const autoCashoutToggle = document.getElementById(`auto-cashout-toggle-${betNumber}`);
            if (!autoCashoutToggle || !autoCashoutToggle.checked) {
                return; // Auto-cashout is not enabled for this bet
            }
            
            const autoCashoutValue = parseFloat(document.getElementById(`auto-cashout-value-${betNumber}`).value);
            
            // Only auto-cashout if the value is valid and the multiplier has reached it
            if (autoCashoutValue > 1.0 && this.counter >= autoCashoutValue) {
                this.cashOut(betType);
                
                // Update auto-bet stats if auto-betting is active
                const state = this.autoBetState[betType];
                if (state && state.active) {
                    state.wins++;
                    const winAmount = bet.amount * autoCashoutValue - bet.amount;
                    state.profit += winAmount;
                    this.updateAutoBetStats(betType);
                }
            }
        });
    }

    executeAutoBets() {
        // Execute auto-bets at the start of each round
        // Make sure autoBetState exists
        if (!this.autoBetState) {
            this.autoBetState = {
                bet1: { active: false, count: 0, wins: 0, profit: 0 },
                bet2: { active: false, count: 0, wins: 0, profit: 0 }
            };
        }
        
        ['bet1', 'bet2'].forEach(betType => {
            const betNumber = betType === 'bet1' ? '1' : '2';
            const autoToggle = document.getElementById(`auto-bet-toggle-${betNumber}`);
            
            // Only execute auto-bet if toggle is enabled
            if (!autoToggle || !autoToggle.checked) {
                return; // Auto-bet is not enabled for this bet
            }
            
            const state = this.autoBetState[betType];
            if (!state || !state.active) {
                return; // Auto-bet state is not active
            }
            
            const input = document.getElementById(`bet-input-${betNumber}`);
            const amount = parseFloat(input.value);
            
            if (amount > 0 && amount <= this.playerBalance) {
                this.placeBet(betType, amount);
                state.count++;
                this.updateAutoBetStats(betType);
            } else if (amount > this.playerBalance) {
                // Stop auto-betting if insufficient funds
                state.active = false;
                autoToggle.checked = false;
                const statsElement = document.getElementById(`auto-stats-${betNumber}`);
                if (statsElement) statsElement.style.display = 'none';
                this.messageElement.textContent = 'Auto-betting stopped: Insufficient funds';
            }
        });
    }
}

// Global game instance for onclick handlers
let game;

// Preloader Management
function showPreloader() {
    const preloader = document.getElementById('spribe-custom-preloader');
    const mainContainer = document.getElementById('main-container');
    
    if (preloader && mainContainer) {
        preloader.style.display = 'flex';
        mainContainer.style.display = 'none';
        
        // Show connecting text after 1 second
        setTimeout(() => {
            const connectingText = document.querySelector('.spribe-connecting-text');
            const spinner = document.querySelector('.spribe-preloader-spinner');
            const logo = document.querySelector('.spribe-preloader-logo');
            const powered = document.querySelector('.spribe-preloader-powered-by');
            if (connectingText) {
                connectingText.style.display = 'block';
            }
            if (spinner) spinner.style.display = 'none';
            if (logo) logo.style.display = 'none';
            if (powered) powered.style.display = 'none';
        }, 1000);
    }
}

function hidePreloader() {
    const preloader = document.getElementById('spribe-custom-preloader');
    const mainContainer = document.getElementById('main-container');
    
    if (preloader) {
        preloader.style.opacity = '0';
        
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 300);
    }
    
    if (mainContainer) {
        setTimeout(() => {
            mainContainer.style.display = 'grid';
        }, 300);
    }
    
    console.log('Preloader hidden, main container shown');
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Show preloader immediately
    showPreloader();
    
    // Safety timeout to ensure preloader is hidden even if something goes wrong
    setTimeout(() => {
        hidePreloader();
        console.log('Preloader hidden by safety timeout');
    }, 5000);
    
    // Initialize game after preloader duration (3-4 seconds)
    setTimeout(() => {
        try {
            game = new AviatorGame();
            
            // Make switchTab globally accessible
            window.switchTab = function(tabType) {
                if (game && game.switchTab) {
                    game.switchTab(tabType);
                }
            };
            
            // Add authentication tab switching function
            window.switchAuthTab = function(tabType) {
                // Remove active class from all tabs and contents
                document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                document.querySelector(`[onclick="switchAuthTab('${tabType}')"]`).classList.add('active');
                document.getElementById(`${tabType}-tab`).classList.add('active');
            };
            
            // Initialize authentication system
            window.classyBetAPI = new ClassyBetAPI();
            setupAuthEventListeners();
            setupModalEventListeners();
            
            console.log('Game initialized successfully');
            
            // Hide preloader after game is initialized
            setTimeout(() => {
                hidePreloader();
            }, 500);
        } catch (error) {
            console.error('Game initialization failed:', error);
            // Hide preloader even if game fails to initialize
            setTimeout(() => {
                hidePreloader();
            }, 500);
        }
    }, 3000);
    
    // Check for existing authentication on page load
    checkAuthenticationOnLoad();
});

// Authentication Event Listeners
function setupAuthEventListeners() {
    // Set up API event listeners
    classyBetAPI.on('onAuthChange', (data) => {
        if (data.authenticated) {
            showUserView();
            updateUserDisplay(data.user);
        } else {
            showGuestView();
        }
    });

    classyBetAPI.on('onBalanceUpdate', (balance) => {
        updateBalanceDisplay(balance);
    });

    classyBetAPI.on('onBetUpdate', (data) => {
        updateBetDisplay(data);
    });
}

// Enhanced session management - Authentication check on page load
async function checkAuthenticationOnLoad() {
    // Check for new JWT token system
    const authToken = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    const isDemo = localStorage.getItem('isDemo') === 'true';
    
    if (authToken && userData) {
        try {
            const user = JSON.parse(userData);
            
            // Verify token is still valid (only for real users, not demo)
            if (!isDemo) {
                try {
                    const isLocal = window.location.hostname === 'localhost' || 
                                   window.location.hostname === '127.0.0.1' ||
                                   window.location.protocol === 'file:';
                    const apiBase = isLocal ? 'http://localhost:3001' : window.location.origin;
                    console.log('Profile API Base URL:', apiBase);
                    const response = await fetch(`${apiBase}/api/auth/profile`, {
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error('Token invalid');
                    }
                    
                    // Update user data from server (this will have the real balance)
                    const profileData = await response.json();
                    localStorage.setItem('userData', JSON.stringify(profileData));
                    updateUserDisplay(profileData);
                    showUserView(profileData);
                    console.log('Real user balance loaded:', profileData.balance);
                } catch (serverError) {
                    console.log('Server not available for profile check:', serverError.message);
                    // Use stored user data if server is not available
                    updateUserDisplay(user);
                    showUserView(user);
                }
            } else {
                // Demo user - preserve existing balance or set to 3000 if first time
                if (!user.balance || user.balance <= 0) {
                    user.balance = 3000;
                }
                user.isDemo = true;
                localStorage.setItem('userData', JSON.stringify(user));
                localStorage.setItem('isDemo', 'true');
                updateUserDisplay(user);
                showUserView(user);
                showDemoIndicator();
                console.log('Demo user balance preserved/initialized:', user.balance);
            }
            
            console.log('User session restored:', user.username || user.userId);
            
        } catch (error) {
            console.log('Session validation failed:', error);
            clearAuthSession();
            redirectToLogin();
        }
    } else {
        // No authentication found, redirect to login
        redirectToLogin();
    }
}

function clearAuthSession() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('isDemo');
    // Also clear old token format
    localStorage.removeItem('user_token');
}

function redirectToLogin() {
    // Only redirect if not already on index page
    if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
        window.location.href = 'index.html';
    }
}

function showDemoIndicator() {
    // Show demo mode bar
    const demoBar = document.getElementById('demo-mode-bar');
    if (demoBar) {
        demoBar.style.display = 'block';
    }
    
    // Hide left sidebar for demo users
    const leftSidebar = document.getElementById('left-sidebar');
    if (leftSidebar) {
        leftSidebar.style.display = 'none';
    }
    
    // Hide sidebar toggle button for demo users
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.style.display = 'none';
    }
    
    // Expand main content to full width
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.marginLeft = '0';
        mainContent.style.width = '100%';
    }
    
    // Add demo mode class to body for styling
    document.body.classList.add('demo-mode');
    
    // Update page title to indicate demo mode
    document.title = 'ClassyBet Aviator - Demo Mode';
    
    // Replace user navigation with demo navigation
    const userNav = document.getElementById('user-nav');
    const guestNav = document.getElementById('guest-nav');
    
    if (userNav) {
        userNav.style.display = 'none';
    }
    
    if (guestNav) {
        guestNav.style.display = 'flex';
        // Update guest nav for demo mode
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        
        if (loginBtn) {
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Exit Demo';
            loginBtn.onclick = () => {
                if (confirm('Exit demo mode and go to login?')) {
                    localStorage.clear();
                    window.location.href = 'index.html';
                }
            };
        }
        
        if (registerBtn) {
            registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
            registerBtn.onclick = () => {
                if (confirm('Exit demo mode and register?')) {
                    localStorage.clear();
                    window.location.href = 'index.html#register';
                }
            };
        }
    }
    
    console.log('Demo mode activated - sidebar hidden, layout expanded');
}

function hideDemoIndicator() {
    // Hide demo mode bar
    const demoBar = document.getElementById('demo-mode-bar');
    if (demoBar) {
        demoBar.style.display = 'none';
    }
    
    // Show left sidebar for real users
    const leftSidebar = document.getElementById('left-sidebar');
    if (leftSidebar) {
        leftSidebar.style.display = 'block';
    }
    
    // Show sidebar toggle button for real users
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.style.display = 'block';
    }
    
    // Remove demo mode class from body
    document.body.classList.remove('demo-mode');
    
    // Reset page title
    document.title = 'ClassyBet Aviator - Premium Gaming';
}

function showUserView(user) {
    // Check if navigation elements exist (they might not in all page layouts)
    const guestNav = document.getElementById('guest-nav');
    const userNav = document.getElementById('user-nav');
    const adminBtn = document.getElementById('admin-btn');
    
    if (guestNav) guestNav.style.display = 'none';
    if (userNav) userNav.style.display = 'flex';
    
    // Show/hide admin button based on user role
    if (adminBtn) {
        if (user && user.isAdmin) {
            adminBtn.style.display = 'block';
        } else {
            adminBtn.style.display = 'none';
        }
    }
    
    // Show betting controls
    document.querySelectorAll('.bet-controls').forEach(el => {
        el.style.display = 'block';
    });
    
    // Handle demo vs real user display and initialize balance
    if (user && user.isDemo) {
        // Demo user - ensure 3000 balance and show demo indicator
        user.balance = 3000;
        showDemoIndicator();
        initializeGameBalance(user);
    } else if (user) {
        // Real user - hide demo indicator, use their actual balance
        hideDemoIndicator();
        initializeGameBalance(user);
    }
    
    // Update game instance with user data if available
    if (window.game && user) {
        window.game.currentUser = user;
        window.game.playerBalance = user.balance || 0; // Default to 0 for real users, 3000 for demo set above
        window.game.updateBalance();
        console.log(`Game balance set to: ${window.game.playerBalance} for ${user.isDemo ? 'demo' : 'real'} user`);
    }
}

function showGuestView() {
    document.getElementById('guest-nav').style.display = 'flex';
    document.getElementById('user-nav').style.display = 'none';
    document.getElementById('admin-btn').style.display = 'none';
    
    // Hide betting controls
    document.querySelectorAll('.bet-controls').forEach(el => {
        el.style.display = 'none';
    });
}

function updateUserDisplay(user) {
    // Update username display - check if elements exist
    const navUsername = document.getElementById('nav-username');
    if (navUsername) {
        navUsername.textContent = user.username || user.userId || 'Player';
    }
    
    // Update User ID display if element exists
    const userIdDisplay = document.getElementById('nav-userid');
    if (userIdDisplay && user.userId) {
        userIdDisplay.textContent = `ID: ${user.userId}`;
    }
    
    // Update balance display
    const isDemo = localStorage.getItem('isDemo') === 'true';
    updateBalanceDisplay(isDemo ? 3000 : (user.balance || 0));
    
    // Update demo status if applicable
    if (user.isDemo) {
        const balanceElement = document.getElementById('nav-balance');
        if (balanceElement) {
            balanceElement.style.color = '#ffa726'; // Orange for demo
            balanceElement.title = 'Demo Balance - Virtual Money';
        }
    }
    
    // Update game balance
    if (window.game) {
        const isDemo = localStorage.getItem('isDemo') === 'true';
        window.game.playerBalance = isDemo ? 3000 : (user.balance || 0);
        window.game.currentUser = user;
        window.game.updateBalance();
    }
}

function updateBalanceDisplay(balance) {
    // Update navigation balance
    const navBalance = document.getElementById('nav-balance');
    if (navBalance) {
        navBalance.textContent = `KES ${balance.toFixed(2)}`;
    }
    
    // Update game header balance
    const gameHeaderBalance = document.getElementById('balance-amount');
    if (gameHeaderBalance) {
        gameHeaderBalance.textContent = `KES ${balance.toFixed(2)}`;
    }
    
    // Update game instance balance
    if (window.game) {
        window.game.playerBalance = balance;
        // The game's updateBalance will also update navigation, but we already did it above
    }
}

function initializeGameBalance(user) {
    if (user) {
        const balance = user.balance || (user.isDemo ? 3000 : 0);
        
        // Update game instance if available
        if (window.game) {
            window.game.playerBalance = balance;
        }
        
        // Update all balance displays using the centralized function
        updateBalanceDisplay(balance);
        console.log('Game balance initialized:', balance);
    }
}

function updateBetDisplay(data) {
    // Update game bet state based on API response
    if (data.bet && window.game) {
        // Handle bet placement or cashout updates
        console.log('Bet updated:', data);
    }
}

// Enhanced logout functionality
function logout() {
    // Clear all authentication data
    clearAuthSession();
    
    // Remove demo indicator if present
    const demoIndicator = document.getElementById('demo-indicator');
    if (demoIndicator) demoIndicator.remove();
    
    // Show confirmation message
    const confirmed = confirm('Are you sure you want to logout?');
    if (confirmed) {
        // Redirect to login page
        window.location.href = 'index.html';
    }
}

// Session management utilities
function getCurrentUser() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

function isUserLoggedIn() {
    return !!localStorage.getItem('authToken') && !!localStorage.getItem('userData');
}

function isDemo() {
    return localStorage.getItem('isDemo') === 'true';
}

function setupModalEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const login = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        const result = await classyBetAPI.login(login, password);
        
        if (result.success) {
            closeModal('login-modal');
            document.getElementById('login-form').reset();
        } else {
            showError('login-error', result.error);
        }
    });

    // Register form
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const userData = {
            username: document.getElementById('register-username').value,
            email: document.getElementById('register-email').value,
            phone: document.getElementById('register-phone').value,
            password: document.getElementById('register-password').value
        };
        
        const result = await classyBetAPI.register(userData);
        
        if (result.success) {
            closeModal('register-modal');
            document.getElementById('register-form').reset();
        } else {
            showError('register-error', result.error);
        }
    });

    // Deposit form
    document.getElementById('deposit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = document.getElementById('deposit-amount').value;
        const phoneNumber = document.getElementById('deposit-phone').value;
        
        const result = await classyBetAPI.depositSTK(parseFloat(amount), phoneNumber);
        
        if (result.success) {
            showSuccess('deposit-success', `STK Push sent! Transaction ID: ${result.transactionId}`);
            document.getElementById('deposit-form').reset();
        } else {
            showError('deposit-error', result.error);
        }
    });

    // Navigation button events
    document.getElementById('login-btn').addEventListener('click', () => showModal('login-modal'));
    document.getElementById('register-btn').addEventListener('click', () => showModal('register-modal'));
    document.getElementById('deposit-btn').addEventListener('click', () => {
        if (classyBetAPI.isAuthenticated()) {
            showModal('deposit-modal');
            // Pre-fill phone number
            if (classyBetAPI.user && classyBetAPI.user.phone) {
                document.getElementById('deposit-phone').value = classyBetAPI.user.phone;
            }
        }
    });
    
    document.getElementById('profile-btn').addEventListener('click', () => {
        window.open('profile.html', '_blank');
    });
    
    document.getElementById('admin-btn').addEventListener('click', () => {
        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.protocol === 'file:';
        const adminUrl = isLocal ? 'http://localhost:3001/admin' : '/management.html';
        console.log('Admin URL:', adminUrl);
        window.open(adminUrl, '_blank');
    });
    
    document.getElementById('logout-btn').addEventListener('click', () => {
        logout();
    });
}

// Modal utility functions
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    
    // Clear error messages
    const errorElements = document.querySelectorAll('.error-message, .success-message');
    errorElements.forEach(el => el.style.display = 'none');
}

function switchModal(fromModal, toModal) {
    closeModal(fromModal);
    showModal(toModal);
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => element.style.display = 'none', 5000);
    }
}

function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => element.style.display = 'none', 8000);
    }
}

// Enhanced game integration
function integrateGameWithAPI() {
    if (window.game && classyBetAPI.isAuthenticated()) {
        // Generate new game round ID
        const roundId = classyBetAPI.generateGameRound();
        classyBetAPI.setGameRound(roundId);
        game.roundNumber = roundId;
        
        // Override game betting functions to use API
        const originalPlaceBet = game.placeBet;
        game.placeBet = async function(betSlot, amount, autoCashout = null) {
            if (!classyBetAPI.isAuthenticated()) {
                alert('Please login to place bets');
                return false;
            }
            
            const result = await classyBetAPI.placeBet(amount, autoCashout);
            if (result.success) {
                // Update local game state
                this.bets[betSlot] = {
                    placed: true,
                    amount: amount,
                    cashedOut: false,
                    pending: false,
                    apiId: result.bet._id
                };
                this.updateBetControls();
                return true;
            } else {
                alert(result.error);
                return false;
            }
        };
        
        const originalCashOut = game.cashOut;
        game.cashOut = async function(betSlot) {
            const bet = this.bets[betSlot];
            if (!bet.placed || bet.cashedOut || !bet.apiId) return;
            
            const result = await classyBetAPI.cashout(this.counter);
            if (result.success) {
                this.bets[betSlot].cashedOut = true;
                this.updateBetControls();
                return true;
            } else {
                console.error('Cashout failed:', result.error);
                return false;
            }
        };
    }
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAuthenticationOnLoad();
    
    // Wait for game to initialize, then integrate
    setTimeout(() => {
        integrateGameWithAPI();
    }, 1000);
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});


