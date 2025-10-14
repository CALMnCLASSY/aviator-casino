// Global API configuration
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://aviator-casino.onrender.com';

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
        
        // Bet history arrays
        this.betHistory = []; // Personal bet history
        this.globalBetHistory = []; // All players' bets
        this.roundHistory = []; // History of rounds
        
        // Betting state - will be set by authentication system
        this.playerBalance = 0;
        this.bets = {
            bet1: { placed: false, pending: false, amount: 0, cashedOut: false, multiplier: 0, winnings: 0, apiId: null },
            bet2: { placed: false, pending: false, amount: 0, cashedOut: false, multiplier: 0, winnings: 0, apiId: null }
        };
        
        // Auto-betting state
        this.autoBetState = {
            bet1: { active: false, count: 0, wins: 0, profit: 0 },
            bet2: { active: false, count: 0, wins: 0, profit: 0 }
        };

        this.minBetAmount = 10;
        this.reservedBalance = 0;
        this.activeRoundMeta = null;
        this.nextRoundMeta = null;
        this.roundQueue = []; // Queue of upcoming rounds from backend
        this.roundSyncInProgress = false;
        this.forcedCrashMultiplier = null;
        this.backendControlled = true; // Always use backend multipliers
        this.autoStartEnabled = true; // Auto-start game loop

        this.loadImage();
        this.initializeElements();
        this.setupEventListeners();
        this.updateBalance();
        this.updateCounterDisplay();
        
        // Auto-start game loop after initialization
        if (this.autoStartEnabled) {
            this.initializeGameLoop();
        } else {
            this.startGame();
        }
        this.initializeAllBets();
        this.setupGameMenu();
        this.setupResponsiveLayout();
        this.setupBetsTabs();
        this.generateMockBets();
        this.setupQuickAmountButtons();
        this.setupAutoBetting();
        this.setupResponsiveLayout();
        this.setupModalListeners();
        
        // Preserve user balance from localStorage on initialization
        this.initializeUserBalance();
    }
    
    // Initialize user balance from session data
    async initializeUserBalance() {
        try {
            const userData = localStorage.getItem('userData');
            const isDemo = localStorage.getItem('isDemo') === 'true';
            const token = localStorage.getItem('user_token');
            
            // Set initial balance from localStorage to prevent UI flicker
            if (userData) {
                const user = JSON.parse(userData);
                this.currentUser = user;
                this.playerBalance = user.balance || (isDemo ? 3000 : 0);
                this.updateBalance(); // Update UI immediately
            }
            
            // Then sync with server for real users
            if (!isDemo && token) {
                const response = await fetch(`${API_BASE}/api/auth/profile`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.playerBalance = data.balance;
                    
                    // Update localStorage
                    if (userData) {
                        const user = JSON.parse(userData);
                        user.balance = data.balance;
                        localStorage.setItem('userData', JSON.stringify(user));
                    }
                    
                    // Update UI with server balance
                    this.updateBalance();
                    console.log('Real user balance loaded:', this.playerBalance);
                }
            } else {
                console.log('Balance initialized:', this.playerBalance, 'Demo:', isDemo);
            }
        } catch (error) {
            console.error('Error initializing balance:', error);
            // Keep using localStorage balance if server sync fails
        }
    }
    
    // Method to safely update player balance and sync with server
    async updatePlayerBalance(newBalance, reason = 'update') {
        const isDemo = localStorage.getItem('isDemo') === 'true';
        
        // Ensure balance doesn't go below 0
        newBalance = Math.max(0, newBalance);
        
        // Always update the local balance immediately
        this.playerBalance = newBalance;
        
        // Update localStorage for all users
        const userData = localStorage.getItem('userData');
        if (userData) {
            const user = JSON.parse(userData);
            user.balance = newBalance;
            localStorage.setItem('userData', JSON.stringify(user));
        }
        
        // Update UI
        this.updateBalance();
        
        // For real users, sync with server
        if (!isDemo) {
            const token = localStorage.getItem('user_token');
            if (token) {
                try {
                    // Update balance
                    const response = await fetch(`${API_BASE}/api/game/update-balance`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ balance: newBalance, reason })
                    });
                    
                    if (!response.ok) {
                        console.error('Failed to sync balance with server');
                    }
                    
                    // Create transaction record
                    const transactionType = reason === 'deposit' ? 'deposit' : 
                                          reason === 'bet' ? 'bet' :
                                          reason === 'cashout' ? 'win' :
                                          reason === 'bet_cancel' ? 'refund' : 'other';
                                          
                    await fetch(`${API_BASE}/api/game/record-transaction`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            type: transactionType,
                            amount: Math.abs(this.playerBalance - newBalance), // Transaction amount is the difference
                            newBalance: newBalance,
                            description: `Aviator Game: ${reason}`,
                            game: 'aviator',
                            userId: this.currentUser._id // Add user ID
                        })
                    });
                    
                } catch (error) {
                    console.error('Error syncing with server:', error);
                }
            }
        }
        
        console.log(`${isDemo ? 'Demo' : 'Real'} user balance updated to ${newBalance} (${reason})`);
    }

    // Currency formatting method
    formatCurrency(amount) {
        const numAmount = parseFloat(amount) || 0;
        return `KES ${numAmount.toFixed(2)}`;
    }

    updateBalance() {
        if (this.balanceElement) {
            this.balanceElement.textContent = this.formatCurrency(this.playerBalance);
        }

        const navBalance = document.getElementById('nav-balance');
        if (navBalance) {
            navBalance.textContent = this.formatCurrency(this.playerBalance);
        }

        const mobileBalance = document.getElementById('mobile-balance');
        if (mobileBalance) {
            mobileBalance.textContent = this.formatCurrency(this.playerBalance);
        }

        const messageBalance = document.getElementById('message-balance');
        if (messageBalance) {
            messageBalance.textContent = this.formatCurrency(this.playerBalance);
        }
    }

    getAvailableBalance() {
        return Math.max(0, this.playerBalance - this.reservedBalance);
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
                // Mobile: Show sidebar at bottom, hide mobile bets section
                if (leftSidebar) leftSidebar.style.display = 'block';
                if (mobileBets) mobileBets.style.display = 'none';
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
                // Toggle sound - already handled by toggle switch
                break;
            case 'animation':
                // Toggle animation - already handled by toggle switch
                break;
            case 'bet-history':
                this.openModal('bet-history-modal');
                this.loadBetHistoryFromServer();
                break;
            case 'how-to-play':
                this.openModal('how-to-play-modal');
                break;
            case 'game-rules':
                this.openModal('game-rules-modal');
                break;
            case 'game-limits':
                this.openModal('game-limits-modal');
                break;
            case 'provably-fair':
                this.openModal('provably-fair-modal');
                break;
            case 'free-bets':
                this.openModal('free-bets-modal');
                break;
        }
        
        // Close menu after action
        document.getElementById('game-menu').classList.remove('show');
    }

    // Modal functionality
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            
            // Generate new seeds for provably fair modal
            if (modalId === 'provably-fair-modal') {
                this.generateNewSeeds();
            }
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    generateNewSeeds() {
        // Generate random seed for provably fair
        const randomSeed = this.generateRandomString(20);
        const manualSeed = this.generateRandomString(22) + '-0';
        const serverSeed = this.generateRandomHash();
        
        document.getElementById('random-seed').textContent = randomSeed;
        document.getElementById('manual-seed').textContent = manualSeed;
        document.getElementById('server-seed').textContent = serverSeed;
    }

    generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateRandomHash() {
        const chars = '0123456789abcdef';
        let hash = '';
        for (let i = 0; i < 64; i++) {
            hash += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return hash;
    }

    setupModalListeners() {
        // Close button listeners for all modals including deposit modal
        document.querySelectorAll('.modal .close, .modal-overlay .close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = btn.getAttribute('data-modal');
                if (modalId) {
                    this.closeModal(modalId);
                } else {
                    // Find closest modal parent and close it
                    const modal = btn.closest('.modal, .modal-overlay');
                    if (modal) {
                        modal.style.display = 'none';
                    }
                }
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Copy functionality for provably fair seeds
        document.querySelectorAll('.copy-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const keyElement = e.target.previousElementSibling;
                const textToCopy = keyElement.textContent.replace('Current: ', '');
                
                navigator.clipboard.writeText(textToCopy).then(() => {
                    // Show copied feedback
                    const originalHtml = keyElement.innerHTML;
                    keyElement.innerHTML = '<span style="color: #30fcbe;">Copied!</span>';
                    setTimeout(() => {
                        keyElement.innerHTML = originalHtml;
                    }, 1000);
                }).catch(() => {
                    console.log('Copy failed');
                });
            });
        });
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

        // Background timer: trickle in bets continuously during waiting phase
        setInterval(() => {
            if (this.gameState === 'waiting') {
                const bursts = Math.floor(Math.random() * 5) + 3; // 3-7 bets per tick during waiting
                for (let i = 0; i < bursts; i++) {
                    this.generateRandomBet();
                }
            }
        }, 800); // More frequent updates during waiting

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
                '<i class="fas fa-chevron-up"></i> Show Less' : 
                '<i class="fas fa-chevron-down"></i> Show All Bets';
        });
    }

    generateRandomBet() {
        // Generate player name in format 'a***d'
        const playerName = this.generateRandomPlayerName();
        const avatar = this.pickRandomAvatar();
        const betAmount = (Math.random() * 200 + 10).toFixed(2);
        
        // Randomly decide if this bet will cash out or crash
        const willCashOut = Math.random() > 0.3; // 70% chance to cash out
        
        const bet = {
            player: playerName,
            avatar: avatar,
            amount: parseFloat(betAmount),
            cashedOut: false,
            crashed: false,
            multiplier: null,
            win: null,
            status: '',
            targetCashout: null // Store the target multiplier for this bet
        };
        
        // Assign a target cashout multiplier for bets that will cash out
        // Only during waiting phase - they'll cash out when multiplier reaches target during flight
        if (willCashOut) {
            // Most players cash out early, some wait for higher multipliers
            const rand = Math.random();
            if (rand < 0.4) {
                // 40% cash out very early (1.2x - 1.8x)
                bet.targetCashout = 1.2 + Math.random() * 0.6;
            } else if (rand < 0.7) {
                // 30% cash out at low-medium (1.8x - 3.0x)
                bet.targetCashout = 1.8 + Math.random() * 1.2;
            } else if (rand < 0.9) {
                // 20% cash out at medium (3.0x - 5.0x)
                bet.targetCashout = 3.0 + Math.random() * 2.0;
            } else {
                // 10% wait for high multipliers (5.0x - 10.0x)
                bet.targetCashout = 5.0 + Math.random() * 5.0;
            }
        }

        this.allBetsData.unshift(bet);
        this.allBetsHistory.unshift(bet);
        this.betCount++;
        
        // Keep a larger visible window for more realistic display
        // No longer limiting allBetsData array size - allow it to grow as needed

        // Update display immediately during waiting to show growing bet list
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
        
        // Load stored histories
        this.loadBetHistory();
        this.loadRoundHistory();
        
        this.messageElement.textContent = 'Wait for the next round';
        this.updateBalance();
        
        // Ensure buttons are in proper initial state
        this.resetButtonStates();
    }

    setupEventListeners() {
        // Bet button listeners
        if (this.betButton1) {
            this.betButton1.addEventListener('click', () => this.handleBet('bet1'));
        }
        if (this.betButton2) {
            this.betButton2.addEventListener('click', () => this.handleBet('bet2'));
        }
        
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

    updateBetButtons() {
        const updateButtonState = (betType, button) => {
            if (!button) return;
            const bet = this.bets[betType];

            if (bet.pending) {
                button.textContent = `Cancel ${this.formatCurrency(bet.amount)} `;
                button.className = 'bet-button cancel';
                button.disabled = false;
                return;
            }

            if (this.gameState === 'waiting' && !bet.placed) {
                button.textContent = 'BET';
                button.className = 'bet-button';
                button.disabled = false;
                return;
            }

            if (bet.placed && this.gameState === 'flying' && !bet.cashedOut) {
                const potentialWin = bet.amount * this.counter;
                button.textContent = `CASHOUT ${this.formatCurrency(potentialWin)}`;
                button.className = 'bet-button cashout';
                button.disabled = false;
                return;
            }

            if (bet.cashedOut) {
                button.textContent = `Won ${this.formatCurrency(bet.winnings)}`;
                button.className = 'bet-button won';
                button.disabled = true;
                return;
            }

            if (this.gameState === 'flying' && bet.placed) {
                button.textContent = `${this.formatCurrency(bet.amount)} ACTIVE`;
                button.className = 'bet-button placed';
                button.disabled = false;
            }
        };

        updateButtonState('bet1', this.betButton1);
        updateButtonState('bet2', this.betButton2);
    }

    handleBet(betType) {
        const bet = this.bets[betType];
        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
        const input = betType === 'bet1' ? this.betInput1 : this.betInput2;

        if (!button || !input) return;

        if (bet.pending) {
            this.cancelBet(betType);
            return;
        }

        if (bet.placed && this.gameState === 'flying' && !bet.cashedOut) {
            this.cashOut(betType);
            return;
        }

        this.placeBet(betType);
        this.updateBetButtons();
    }

    placeBet(betType, amount) {
        const bet = this.bets[betType];
        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
        const input = betType === 'bet1' ? this.betInput1 : this.betInput2;

        if (!button || !input) return;

        if (bet.pending) {
            this.showGameMessage('Bet already queued for next round.', 'info');
            return;
        }

        if (bet.placed && this.gameState === 'flying' && !bet.cashedOut) {
            this.showGameMessage('Cash out first before placing a new bet.', 'info');
            return;
        }

        const amountToBet = typeof amount === 'number' ? amount : parseFloat(input.value);

        if (Number.isNaN(amountToBet) || amountToBet < this.minBetAmount) {
            this.showGameMessage(`Minimum bet is ${this.formatCurrency(this.minBetAmount)}.`, 'info');
            return;
        }

        if (amountToBet > this.getAvailableBalance()) {
            this.showGameMessage('Insufficient available balance.', 'info');
            return;
        }

        // Queue the bet - it will be activated during countdown
        bet.pending = true;
        bet.amount = amountToBet;
        bet.cashedOut = false;
        bet.winnings = 0;
        bet.multiplier = 0;

        this.reservedBalance += amountToBet;
        this.updateBalance();

        button.textContent = `Cancel ${this.formatCurrency(amountToBet)}`;
        button.className = 'bet-button cancel';
        button.disabled = false;

        if (this.gameState === 'flying') {
            this.showGameMessage(`Bet queued for next round: ${this.formatCurrency(amountToBet)}`, 'info');
        } else {
            this.showGameMessage(`Bet placed: ${this.formatCurrency(amountToBet)}`, 'success');
        }

        console.log(`[BET] Queued ${betType} for ${this.formatCurrency(amountToBet)} | Reserved: ${this.formatCurrency(this.reservedBalance)} | Available: ${this.formatCurrency(this.getAvailableBalance())}`);

        this.updateBetButtons();
    }

    cancelBet(betType) {
        const bet = this.bets[betType];
        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;

        if (!button || !bet.pending) return;

        this.reservedBalance = Math.max(0, this.reservedBalance - bet.amount);
        bet.pending = false;
        bet.amount = 0;
        bet.multiplier = 0;
        bet.winnings = 0;
        bet.apiId = null;
        bet.lastCashoutTime = null;

        this.updateBalance();

        button.textContent = 'BET';
        button.className = 'bet-button';
        button.disabled = false;

        this.showGameMessage('Bet cancelled.', 'info');
        console.log(`[BET] Cancelled ${betType}. Reserved: ${this.formatCurrency(this.reservedBalance)} | Available: ${this.formatCurrency(this.getAvailableBalance())}`);
        this.updateBetButtons();
    }

    cashOut(betType) {
        const bet = this.bets[betType];
        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;

        if (!button || !bet.placed || bet.cashedOut) return;

        const winnings = bet.amount * this.counter;

        bet.cashedOut = true;
        bet.winnings = winnings;
        bet.multiplier = this.counter;

        // Sync cashout with backend via WebSocket
        if (window.gameSocket && gameSocket.connected && window.classyBetAPI && classyBetAPI.isAuthenticated() && bet.apiId) {
            // Get userId from game.currentUser (where it's actually stored)
            const userId = this.currentUser?.username || classyBetAPI.currentUser?.username;
            if (userId) {
                console.log('[CASHOUT] Requesting cashout via WebSocket:', {
                    userId,
                    betId: bet.apiId,
                    multiplier: this.counter
                });
                
                gameSocket.cashout(userId, bet.apiId, this.counter)
                    .then(result => {
                        console.log('[CASHOUT] Response received:', result);
                        if (result && result.success) {
                            if (result.newBalance !== undefined) {
                                this.playerBalance = result.newBalance;
                                
                                // Update localStorage to persist the balance
                                const userData = localStorage.getItem('userData');
                                if (userData) {
                                    const user = JSON.parse(userData);
                                    user.balance = result.newBalance;
                                    localStorage.setItem('userData', JSON.stringify(user));
                                }
                                
                                this.updateBalance();
                                console.log('[CASHOUT] ✅ Balance updated from backend:', result.newBalance);
                            } else {
                                console.warn('[CASHOUT] ⚠️ Success but no newBalance in response:', result);
                            }
                        } else {
                            console.error('[CASHOUT] ❌ Cashout failed:', result);
                        }
                    })
                    .catch(error => {
                        console.error('[CASHOUT] ❌ Failed to sync with backend:', error);
                    });
            } else {
                console.error('[CASHOUT] No user ID available', {
                    gameCurrentUser: this.currentUser,
                    apiCurrentUser: classyBetAPI.currentUser
                });
            }
        }

        this.addBetToHistory({
            amount: bet.amount,
            multiplier: this.counter,
            cashedOut: true
        });

        button.textContent = `Won ${this.formatCurrency(winnings)}`;
        button.className = 'bet-button won';
        button.disabled = true;

        this.showGameMessage(`Cashed out: ${this.formatCurrency(winnings)} (${this.counter.toFixed(2)}x)`, 'success');
        console.log(`[BET] Cashed out ${betType} at ${this.counter.toFixed(2)}x for ${this.formatCurrency(winnings)}`);
        this.updateBetButtons();

        setTimeout(() => {
            this.resetBetAfterPayout(betType);
        }, 1200);
    }

    async activateQueuedBets() {
        let totalQueued = 0;

        for (const betType of Object.keys(this.bets)) {
            const bet = this.bets[betType];
            const button = betType === 'bet1' ? this.betButton1 : this.betButton2;

            if (bet.pending && bet.amount >= this.minBetAmount) {
                // Get userId
                const userId = this.currentUser?.username;
                if (!userId || !window.gameSocket || !window.gameSocket.connected) {
                    console.warn('[BET] Cannot activate - not connected or no user');
                    continue;
                }

                try {
                    // Get auto-cashout value if enabled
                    const autoToggle = document.getElementById(`auto-bet-toggle-${betType === 'bet1' ? '1' : '2'}`);
                    const autoCashoutInput = document.getElementById(`auto-cashout-value-${betType === 'bet1' ? '1' : '2'}`);
                    const autoCashoutValue = (autoToggle && autoToggle.checked && autoCashoutInput) 
                        ? parseFloat(autoCashoutInput.value) 
                        : null;

                    console.log(`[BET] Activating queued ${betType} via WebSocket:`, {
                        amount: bet.amount,
                        userId,
                        autoCashout: autoCashoutValue
                    });

                    // Place bet via WebSocket
                    const result = await gameSocket.placeBet(userId, bet.amount, autoCashoutValue);

                    if (result && result.success) {
                        // ✅ Bet activated successfully
                        bet.pending = false;
                        bet.placed = true;
                        bet.cashedOut = false;
                        bet.winnings = 0;
                        bet.multiplier = 0;
                        bet.apiId = result.betId;

                        totalQueued += bet.amount;

                        // Update balance from backend response
                        if (result.newBalance !== undefined) {
                            this.playerBalance = result.newBalance;
                            
                            // Update localStorage
                            const userData = localStorage.getItem('userData');
                            if (userData) {
                                const user = JSON.parse(userData);
                                user.balance = result.newBalance;
                                localStorage.setItem('userData', JSON.stringify(user));
                            }
                            
                            this.updateBalance();
                        }

                        if (button) {
                            button.textContent = 'Cash Out';
                            button.className = 'bet-button active';
                            button.disabled = false;
                        }

                        console.log(`[BET] ✅ Activated ${betType} for ${this.formatCurrency(bet.amount)} | New balance: ${this.formatCurrency(this.playerBalance)}`);
                    } else {
                        // ❌ Bet failed - keep it queued
                        console.error(`[BET] ❌ Failed to activate ${betType}:`, result);
                    }
                } catch (error) {
                    console.error(`[BET] Error activating ${betType}:`, error);
                }
            }
        }

        if (totalQueued > 0) {
            this.reservedBalance = Math.max(0, this.reservedBalance - totalQueued);
        }

        this.updateBetButtons();
    }

    async loadBetHistoryFromServer() {
        try {
            if (!window.classyBetAPI || !classyBetAPI.isAuthenticated()) {
                // Show local bet history if not authenticated
                this.displayLocalBetHistory();
                return;
            }

            const token = localStorage.getItem('user_token');
            const isLocal = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.protocol === 'file:';
            const apiBase = isLocal ? 'http://localhost:3001' : 'https://aviator-casino.onrender.com';
            
            const response = await fetch(`${apiBase}/api/game/bet-history`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.displayServerBetHistory(data.bets);
            } else {
                this.displayLocalBetHistory();
            }
        } catch (error) {
            console.error('Failed to load bet history:', error);
            this.displayLocalBetHistory();
        }
    }

    displayServerBetHistory(bets) {
        const container = document.querySelector('.bet-history-content');
        if (!container) return;

        if (!bets || bets.length === 0) {
            container.innerHTML = `
                <p class="text-center text-muted">No betting history available yet.</p>
                <p class="text-center text-grey">Start playing to see your bet history here!</p>
            `;
            return;
        }

        const historyHTML = `
            <div class="bet-history-list">
                <table class="bet-history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Round</th>
                            <th>Bet Amount</th>
                            <th>Multiplier</th>
                            <th>Win Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bets.map(bet => `
                            <tr class="bet-row ${bet.status}">
                                <td>${new Date(bet.createdAt).toLocaleDateString()}</td>
                                <td>${bet.gameRound || 'N/A'}</td>
                                <td>${this.formatCurrency(bet.amount)}</td>
                                <td>${bet.actualMultiplier ? bet.actualMultiplier.toFixed(2) + 'x' : '-'}</td>
                                <td>${bet.winAmount ? this.formatCurrency(bet.winAmount) : '-'}</td>
                                <td><span class="status-badge ${bet.status}">${bet.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = historyHTML;
    }

    displayLocalBetHistory() {
        const container = document.querySelector('.bet-history-content');
        if (!container) return;

        if (!this.betHistory || this.betHistory.length === 0) {
            container.innerHTML = `
                <p class="text-center text-muted">No betting history available yet.</p>
                <p class="text-center text-grey">Start playing to see your bet history here!</p>
            `;
            return;
        }

        const historyHTML = `
            <div class="bet-history-list">
                <table class="bet-history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Bet Amount</th>
                            <th>Multiplier</th>
                            <th>Win Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.betHistory.slice(0, 50).map(bet => `
                            <tr class="bet-row ${bet.cashedOut ? 'won' : 'lost'}">
                                <td>${bet.placedAt ? new Date(bet.placedAt).toLocaleDateString() : 'Today'}</td>
                                <td>${this.formatCurrency(bet.amount)}</td>
                                <td>${bet.multiplier ? bet.multiplier.toFixed(2) + 'x' : '-'}</td>
                                <td>${bet.cashedOut && bet.multiplier ? this.formatCurrency(bet.amount * bet.multiplier) : '-'}</td>
                                <td><span class="status-badge ${bet.cashedOut ? 'won' : 'lost'}">${bet.cashedOut ? 'Won' : 'Lost'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = historyHTML;
    }

    resetBetAfterPayout(betType) {
        const bet = this.bets[betType];
        if (!bet) return;

        bet.placed = false;
        bet.pending = false;
        bet.cashedOut = false;
        bet.amount = 0;
        bet.multiplier = 0;
        bet.winnings = 0;
        bet.apiId = null;

        const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
        if (button) {
            button.textContent = 'BET';
            button.className = 'bet-button';
            button.disabled = false;
        }

        this.updateBetButtons();
    }

    setupChatListeners() {
        const chatToggle = document.getElementById('chat-toggle') || document.getElementById('chat-toggle-nav') || document.getElementById('chat-toggle-sidebar');
        const chatToggleBtn = document.getElementById('chat-toggle-btn');
        const chatCloseBtn = document.getElementById('chat-close-btn');
        const rightSidebar = document.getElementById('right-sidebar');
        const sendChatBtn = document.getElementById('send-chat');
        const chatInput = document.getElementById('chat-input');

        if (!rightSidebar) {
            return;
        }

        const isMobile = () => window.innerWidth <= 900;

        const initializeChatState = () => {
            rightSidebar.classList.remove('chat-open');
            if (chatToggle) chatToggle.classList.remove('active');
            if (chatToggleBtn) chatToggleBtn.classList.remove('active');
        };

        const handleChatToggle = () => {
            const isOpen = rightSidebar.classList.contains('chat-open');

            if (isOpen) {
                rightSidebar.classList.remove('chat-open');
                if (chatToggle) chatToggle.classList.remove('active');
                if (chatToggleBtn) {
                    chatToggleBtn.classList.remove('active');
                    chatToggleBtn.classList.remove('chat-hidden');
                }
            } else {
                rightSidebar.classList.add('chat-open');
                if (chatToggle) chatToggle.classList.add('active');
                if (chatToggleBtn) {
                    chatToggleBtn.classList.add('active');
                    chatToggleBtn.classList.add('chat-hidden');
                }
            }
        };

        const handleChatClose = () => {
            rightSidebar.classList.remove('chat-open');
            if (chatToggle) chatToggle.classList.remove('active');
            if (chatToggleBtn) {
                chatToggleBtn.classList.remove('active');
                chatToggleBtn.classList.remove('chat-hidden');
            }
        };

        if (chatToggle) {
            chatToggle.addEventListener('click', handleChatToggle);
        }
        if (chatToggleBtn) {
            chatToggleBtn.addEventListener('click', handleChatToggle);
        }
        if (chatCloseBtn) {
            chatCloseBtn.addEventListener('click', handleChatClose);
        }

        document.addEventListener('click', (e) => {
            if (isMobile() &&
                rightSidebar.classList.contains('chat-open') &&
                !rightSidebar.contains(e.target) &&
                !e.target.closest('#chat-toggle-btn') &&
                !(chatToggle && chatToggle.contains(e.target))) {
                handleChatClose();
            }
        });

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

        if (sendChatBtn) {
            sendChatBtn.addEventListener('click', () => this.sendChatMessage());
        }
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }

        window.addEventListener('resize', () => {
            initializeChatState();
        });

        initializeChatState();
    }

    // Add a bet to history
    addBetToHistory(bet) {
        if (!this.betHistory) {
            this.betHistory = [];
        }

        const betRecord = {
            id: Date.now(),
            timestamp: new Date(),
            roundNumber: this.roundNumber,
            amount: bet.amount,
            multiplier: bet.cashedOut ? bet.multiplier : this.counter,
            cashedOut: bet.cashedOut,
            win: bet.cashedOut ? bet.amount * bet.multiplier : 0,
            status: bet.cashedOut ? 'win' : 'loss'
        };

        this.betHistory.unshift(betRecord);

        if (this.betHistory.length > 50) {
            this.betHistory.pop();
        }

        this.saveBetHistory();
    }

    saveBetHistory() {
        const isDemo = localStorage.getItem('isDemo') === 'true';
        const storageKey = isDemo ? 'demo_bet_history' : 'bet_history';
        localStorage.setItem(storageKey, JSON.stringify(this.betHistory));
    }

    loadBetHistory() {
        const isDemo = localStorage.getItem('isDemo') === 'true';
        const storageKey = isDemo ? 'demo_bet_history' : 'bet_history';
        const history = localStorage.getItem(storageKey);
        if (history) {
            this.betHistory = JSON.parse(history);
        }
    }

    addRoundToHistory(crashPoint) {
        const roundRecord = {
            roundNumber: this.roundNumber,
            timestamp: new Date(),
            crashPoint: crashPoint,
            totalBets: this.allBetsData.length,
            totalWinners: this.allBetsData.filter(bet => bet.cashedOut).length
        };

        this.roundHistory.unshift(roundRecord);

        if (this.roundHistory.length > 100) {
            this.roundHistory.pop();
        }

        this.saveRoundHistory();
    }

    saveRoundHistory() {
        localStorage.setItem('round_history', JSON.stringify(this.roundHistory));
    }

    loadRoundHistory() {
        const history = localStorage.getItem('round_history');
        if (history) {
            this.roundHistory = JSON.parse(history);
        }
    }

    getTopMultipliers(n = 10) {
        return [...this.roundHistory]
            .sort((a, b) => b.crashPoint - a.crashPoint)
            .slice(0, n);
    }

    getTopWinnings(n = 10) {
        return [...this.betHistory]
            .filter(bet => bet.status === 'win')
            .sort((a, b) => b.win - a.win)
            .slice(0, n);
    }

    sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return;

        const message = chatInput.value.trim();
        if (!message) return;

        this.addChatMessage('You', message);
        chatInput.value = '';

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

    addChatMessage(user, message, isSystem = false) {
        return;
    }

    initializeChat() {
        const updateOnlineCount = () => {
            const span = document.querySelector('.online-count span');
            if (span) {
                span.textContent = `${Math.floor(Math.random() * 150 + 100)} online`;
            }
        };

        updateOnlineCount();

        setTimeout(() => {
            this.addChatMessage('W***4821', 'Good luck everyone! 🍀');
        }, 500);

        setTimeout(() => {
            this.addChatMessage('K***7392', 'Going for big wins today! 💰');
        }, 1500);

        setTimeout(() => {
            this.addChatMessage('', '🎉 Welcome to Aviator! Place your bets and cash out before the plane crashes!', true);
        }, 2500);

        setInterval(() => {
            this.generateRandomChatMessage();
        }, Math.random() * 3000 + 2000);

        setInterval(updateOnlineCount, 30000);
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
        if (!this.secondBetPanel) return;

        if (this.secondBetPanel.style.display === 'none') {
            this.showSecondBet();
        } else {
            this.hideSecondBet();
        }
    }

    showSecondBet() {
        if (!this.secondBetPanel) return;

        this.secondBetPanel.style.display = 'block';
        if (this.addBetButton) {
            this.addBetButton.style.display = 'none';
        }

        document.body.setAttribute('data-second-bet-active', 'true');
        this.adjustBettingControlsHeight();
    }

    hideSecondBet() {
        if (!this.secondBetPanel) return;

        this.secondBetPanel.style.display = 'none';
        if (this.addBetButton) {
            this.addBetButton.style.display = 'inline-flex';
        }

        document.body.removeAttribute('data-second-bet-active');

        this.bets.bet2 = { placed: false, amount: 0, cashedOut: false, pending: false, multiplier: 0, winnings: 0 };
        this.betButton2.textContent = 'BET';
        this.betButton2.className = 'bet-button';
        this.betButton2.disabled = false;

        this.adjustBettingControlsHeight();
    }

    adjustBettingControlsHeight() {
        const bettingControls = document.getElementById('betting-controls');
        if (bettingControls && window.innerWidth <= 768) {
            void bettingControls.offsetHeight;

            const secondBetPanel = document.getElementById('second-bet-panel');
            if (secondBetPanel && secondBetPanel.style.display !== 'none') {
                document.body.setAttribute('data-second-bet-active', 'true');
            } else {
                document.body.removeAttribute('data-second-bet-active');
            }

            setTimeout(() => {
                bettingControls.style.height = 'auto';
            }, 10);
        }
    }

    resetButtonStates() {
        [this.betButton1, this.betButton2].forEach((button, index) => {
            if (!button) return;

            const betType = index === 0 ? 'bet1' : 'bet2';
            const bet = this.bets[betType];

            button.textContent = 'BET';
            button.className = 'bet-button';
            button.disabled = false;
            button.removeAttribute('data-disabled-until-reset');

            bet.placed = false;
            bet.cashedOut = false;
            bet.pending = false;
            bet.amount = 0;
            bet.multiplier = 0;
            bet.winnings = 0;
        });
    }

    toggleAutoFeatures(betNumber) {
        const toggle = document.getElementById(`mode-toggle-${betNumber}`);
        const autoFeatures = document.getElementById(`auto-features-${betNumber}`);

        if (!toggle || !autoFeatures) {
            return;
        }

        if (toggle.checked) {
            autoFeatures.style.display = 'block';
        } else {
            autoFeatures.style.display = 'none';
            const autoBetToggle = document.getElementById(`auto-bet-toggle-${betNumber}`);
            const autoCashoutToggle = document.getElementById(`auto-cashout-toggle-${betNumber}`);
            if (autoBetToggle) autoBetToggle.checked = false;
            if (autoCashoutToggle) autoCashoutToggle.checked = false;
        }
    }

    updateCounterDisplay() {
        const screenWidth = window.innerWidth;
        let visibleCount;

        if (screenWidth >= 1200) {
            visibleCount = 16;
        } else if (screenWidth >= 992) {
            visibleCount = 12;
        } else if (screenWidth >= 768) {
            visibleCount = 10;
        } else {
            visibleCount = 8;
        }

        const visibleMultipliers = this.counterDepo.slice(0, visibleCount);
        const hiddenMultipliers = this.counterDepo.slice(visibleCount);

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

        const hiddenRoundsContainer = document.getElementById('hidden-rounds');
        const showMoreBtn = document.getElementById('show-more-rounds');

        if (hiddenRoundsContainer && showMoreBtn) {
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
                showMoreBtn.style.display = 'flex';
            } else {
                hiddenRoundsContainer.innerHTML = '';
                showMoreBtn.style.display = 'none';
            }
        }
    }

    resetButtonStates() {
    [this.betButton1, this.betButton2].forEach((button, index) => {
        if (!button) return;

        const betType = index === 0 ? 'bet1' : 'bet2';
        const bet = this.bets[betType];

        button.textContent = 'BET';
        button.className = 'bet-button';
        button.disabled = false;
        button.removeAttribute('data-disabled-until-reset');

        bet.placed = false;
        bet.cashedOut = false;
        bet.pending = false;
        bet.amount = 0;
        bet.multiplier = 0;
        bet.winnings = 0;
    });
    }

    toggleAutoFeatures(betNumber) {
    const toggle = document.getElementById(`mode-toggle-${betNumber}`);
    const autoFeatures = document.getElementById(`auto-features-${betNumber}`);

    if (!toggle || !autoFeatures) {
        return;
    }

    if (toggle.checked) {
        autoFeatures.style.display = 'block';
    } else {
        autoFeatures.style.display = 'none';
        const autoBetToggle = document.getElementById(`auto-bet-toggle-${betNumber}`);
        const autoCashoutToggle = document.getElementById(`auto-cashout-toggle-${betNumber}`);
        if (autoBetToggle) autoBetToggle.checked = false;
        if (autoCashoutToggle) autoCashoutToggle.checked = false;
    }
    }

    updateCounterDisplay() {
    const screenWidth = window.innerWidth;
    let visibleCount;

    if (screenWidth >= 1200) {
        visibleCount = 16;
    } else if (screenWidth >= 992) {
        visibleCount = 12;
    } else if (screenWidth >= 768) {
        visibleCount = 10;
    } else {
        visibleCount = 8;
    }

    const visibleMultipliers = this.counterDepo.slice(0, visibleCount);
    const hiddenMultipliers = this.counterDepo.slice(visibleCount);

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

    const hiddenRoundsContainer = document.getElementById('hidden-rounds');
    const showMoreBtn = document.getElementById('show-more-rounds');

    if (hiddenRoundsContainer && showMoreBtn) {
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
            showMoreBtn.style.display = 'flex';
        } else {
            hiddenRoundsContainer.innerHTML = '';
            showMoreBtn.style.display = 'none';
        }
    }
    }

    startGame() {
        this.gameState = 'flying';
        if (this.activeRoundMeta) {
            this.roundNumber = this.activeRoundMeta.roundId;
        } else {
            this.roundNumber++;
        }
        this.lastUpdateTime = Date.now();

        this.x = this.startX;
        this.y = this.startY;
        this.counter = 1.0;
        this.dotPath = [];
        this.isFlying = true;

        const bgImage = document.getElementById('bg-image');
        if (bgImage) {
            bgImage.classList.add('rotating');
        }

        const counterElement = document.getElementById('counter');
        if (counterElement) {
            this.updateCounterGlow(counterElement, 1.0);
        }

        this.animationId = requestAnimationFrame(() => this.draw());
    }

    draw() {
        const currentTime = Date.now();

        if (currentTime - this.lastUpdateTime > 100) {
            this.lastUpdateTime = currentTime;

            let increment;
            if (this.counter < 1.5) {
                increment = 0.01;
            } else if (this.counter < 2.0) {
                increment = 0.015;
            } else if (this.counter < 5.0) {
                increment = 0.02 + (this.counter - 2.0) * 0.005;
            } else if (this.counter < 10.0) {
                increment = 0.035 + (this.counter - 5.0) * 0.01;
            } else {
                increment = 0.085 + (this.counter - 10.0) * 0.015;
            }
            
            this.counter += increment;
            const counterElement = document.getElementById('counter');
            counterElement.textContent = this.counter.toFixed(2) + 'x';
            
            this.updateCounterGlow(counterElement, this.counter);
        }

        // Check for auto-cashout conditions
        this.handleAutoCashout();

        // Update bet buttons with potential cashout amounts
        this.updateBetButtons();
        
        // Process cashouts for bets that reached their target multiplier
        // This will update display automatically when cashouts happen
        this.processCashouts();

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

    processCashouts() {
        // Check all bets and cash out those that reached their target multiplier
        // Only works during flying phase - prevents premature cashouts
        if (this.gameState !== 'flying') return;
        
        let cashedOutThisFrame = false;
        
        this.allBetsData.forEach(bet => {
            // Only process bets that have a target, aren't cashed out yet, and have empty status
            if (bet.targetCashout && !bet.cashedOut && !bet.crashed && bet.status === '') {
                // Cash out ONLY when current multiplier reaches or exceeds target
                // This ensures no one cashes out before the multiplier reaches that value
                if (this.counter >= bet.targetCashout) {
                    bet.cashedOut = true;
                    bet.multiplier = parseFloat(this.counter.toFixed(2));
                    bet.win = parseFloat((bet.amount * bet.multiplier).toFixed(2));
                    bet.status = `${bet.multiplier}x`;
                    cashedOutThisFrame = true;
                }
            }
        });
        
        // Update display if any cashouts happened this frame
        if (cashedOutThisFrame) {
            this.updateAllBetsDisplay();
        }
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

    drawCrashedFrame() {
        if (this.image && this.image.complete) {
            this.ctx.drawImage(this.image, this.x - 22, this.y - 65, 150, 70);
        }
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
        const crashMultiplier = this.forcedCrashMultiplier || this.counter;
        const crashMultiplierStr = crashMultiplier.toFixed(2);
        
        // End round on backend if authenticated and sync balance
        if (window.classyBetAPI && typeof classyBetAPI.endRound === 'function' && classyBetAPI.isAuthenticated()) {
            classyBetAPI.endRound(crashMultiplier)
                .then(result => {
                    if (result && result.success && result.data && result.data.newBalance !== undefined) {
                        // Update game balance from backend
                        this.playerBalance = result.data.newBalance;
                        this.updateBalance();
                    }
                })
                .catch(error => {
                    console.warn('Failed to sync balance after round:', error);
                });
        }
        
        // Clear the active round AFTER it's been played
        this.activeRoundMeta = null;
        this.forcedCrashMultiplier = null;
        
        // Add round to history
        this.addRoundToHistory(parseFloat(crashMultiplierStr));
        
        // Update counter to show "FLEW AWAY" above the multiplier
        const counterElement = document.getElementById('counter');
        counterElement.innerHTML = `
            <div style="color: white; font-size: 0.8em; margin-bottom: 8px; font-weight: bold; text-shadow: none;">FLEW AWAY</div>
            <div class="final-multiplier">${crashMultiplierStr}x</div>
        `;
        // Add crashed class for sizing/animation
        counterElement.classList.add('crashed');
        
        // Add red glow specifically to the multiplier
        const multiplierElement = counterElement.querySelector('.final-multiplier');
        if (multiplierElement) {
            multiplierElement.style.color = '#ff4444';
            multiplierElement.style.textShadow = '0 0 10px rgba(255, 68, 68, 0.7)';
        }
        
        // Mark all active bets as crashed (show empty status for crashed bets)
        this.allBetsData.forEach(bet => {
            if (bet.status === '' && !bet.cashedOut) {
                bet.crashed = true;
                bet.status = ''; // Empty status for crashed bets
            }
        });
        this.allBetsHistory.forEach(bet => {
            if (bet.status === '' && !bet.cashedOut) {
                bet.crashed = true;
                bet.status = ''; // Empty status for crashed bets
            }
        });
        // Update display to show final crashed state before countdown
        this.updateAllBetsDisplay();
        

        // Clear canvas and redraw
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawCrashedFrame();
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
        const animateCrashFrame = () => {
            // Move plane upwards rapidly
            this.y -= crashSpeed;
            
            // Clear canvas and redraw
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.drawCrashedFrame();
            
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
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'crash' ? 'rgba(251, 2, 76, 0.95)' : 
                        type === 'success' ? 'rgba(48, 252, 190, 0.95)' : 
                        'rgba(0, 0, 0, 0.95)'};
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            z-index: 1000;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            animation: slideDown 0.3s ease-out, fadeOut 0.3s ease-in 2.7s;
        `;
        
        // Add CSS animation keyframes
        if (!document.querySelector('#game-message-animations')) {
            const style = document.createElement('style');
            style.id = 'game-message-animations';
            style.textContent = `
                @keyframes slideDown {
                    from { transform: translate(-50%, -100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        gameArea.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    async startCountdown() {
        this.gameState = 'waiting';

        // Fetch and ensure we have the next round ready
        // Don't clear activeRoundMeta here - it will be cleared after the round plays
        await this.ensureRoundMeta().catch(error => {
            console.warn('Failed to prepare next round:', error);
        });

        // Reset and seed All Bets for the upcoming round during waiting only
        this.allBetsData = [];
        this.betCount = 0;
        
        // Reset bet count display to 0 immediately
        this.updateBetCount();
        this.updateAllBetsDisplay();
        
        // Generate bets gradually to simulate real-time betting
        const targetBetCount = 500 + Math.floor(Math.random() * 200); // 500-700 target bets
        const betsPerBatch = 25; // Generate 25 bets per batch
        const batchInterval = 100; // Every 100ms
        
        let betsGenerated = 0;
        const generateBetsInterval = setInterval(() => {
            const batchSize = Math.min(betsPerBatch, targetBetCount - betsGenerated);
            for (let i = 0; i < batchSize; i++) {
                this.generateRandomBet();
            }
            betsGenerated += batchSize;
            
            // Update display to show growing bet list
            this.updateAllBetsDisplay();
            this.updateBetCount();
            
            // Stop when we reach target or countdown ends
            if (betsGenerated >= targetBetCount) {
                clearInterval(generateBetsInterval);
            }
        }, batchInterval);
        
        // Store interval ID so we can clear it if needed
        this.betGenerationInterval = generateBetsInterval;
        
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
            if (!button) return;

            if (bet.pending) {
                button.textContent = `Cancel ${this.formatCurrency(bet.amount)} (Queued)`;
                button.className = 'bet-button cancel';
                button.style.animation = '';
            } else if (!bet.placed) {
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
                
                // Clear bet generation interval if still running
                if (this.betGenerationInterval) {
                    clearInterval(this.betGenerationInterval);
                    this.betGenerationInterval = null;
                }
                
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
        // Always use backend multiplier - no random fallback
        if (!this.forcedCrashMultiplier) {
            console.error('No backend multiplier available! Game cannot start.');
            this.randomStop = 1.5; // Emergency fallback
        } else {
            this.randomStop = this.forcedCrashMultiplier;
        }
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
        
        // Reset ALL betting states for fresh round
        Object.keys(this.bets).forEach(betType => {
            const bet = this.bets[betType];
            const button = betType === 'bet1' ? this.betButton1 : this.betButton2;

            if (!button) {
                return;
            }

            // Clear any cooldown timers and disabled states
            bet.lastCashoutTime = null;
            button.removeAttribute('data-disabled-until-reset');
            button.disabled = false;

            if (bet.pending && bet.amount >= this.minBetAmount) {
                // Queue activation happens below after loop to adjust balances
                return;
            }

            // Reset non-queued bets
            bet.placed = false;
            bet.cashedOut = false;
            bet.pending = false;
            bet.amount = 0;
            bet.multiplier = 0;
            bet.winnings = 0;
            bet.apiId = null;

            button.textContent = 'BET';
            button.className = 'bet-button';
        });

        // Activate any bets that were queued during the previous round
        this.activateQueuedBets();

        // DON'T clear bets here - they remain visible during flight
        // Bets will be cleared and repopulated during startCountdown (waiting phase)

        // Execute auto-bets for new round ONLY if auto-betting is enabled
        this.executeAutoBets();

        this.startGame();
    }

    setupBetsTabs() {
        // Setup profile and deposit buttons
        const profileBtn = document.getElementById('profile-btn');
        const depositBtn = document.getElementById('deposit-btn');

        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                // Directly navigate to profile.html
                window.location.href = 'profile.html';
            });
        }

        if (depositBtn) {
            depositBtn.addEventListener('click', () => {
                const depositModal = document.getElementById('deposit-modal');
                if (depositModal) {
                    depositModal.style.display = 'flex';
                }
            });
        }
        
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
        
        // Sort bets by amount in descending order (highest bets first)
        const sortedBets = [...this.allBetsData].sort((a, b) => b.amount - a.amount);
        
        // Show top 50 bets in the visible list with proper formatting
        const betsHTML = sortedBets.slice(0, 50).map(bet => {
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
        
        // Update bet count to show total active bets
        this.updateBetCount();
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

        const ensureAutoMode = (betType) => {
            const betNumber = betType === 'bet1' ? '1' : '2';
            const modeToggle = document.getElementById(`mode-toggle-${betNumber}`);
            const autoToggle = document.getElementById(`auto-bet-toggle-${betNumber}`);
            const button = document.getElementById(`bet-button-${betNumber}`);

            if (!modeToggle || !autoToggle || !button) return false;

            if (!modeToggle.checked || !autoToggle.checked) {
                // Ensure manual mode if auto features aren't enabled
                button.classList.remove('auto-mode');
                this.autoBetState[betType].active = false;
                return false;
            }

            button.classList.add('auto-mode');
            return true;
        };

        // Manual bet clicks are handled in setupEventListeners(); auto mode toggles
        // only affect button styling/state when toggles are enabled.
    }

    toggleAutoBet(betType) {
        const state = this.autoBetState[betType];
        const betNumber = betType === 'bet1' ? '1' : '2';
        const button = document.getElementById(`bet-button-${betNumber}`);
        const modeToggle = document.getElementById(`mode-toggle-${betNumber}`);
        const autoEnableToggle = document.getElementById(`auto-bet-toggle-${betNumber}`);

        if (!modeToggle || !autoEnableToggle || !modeToggle.checked || !autoEnableToggle.checked) {
            // Auto features disabled - revert to manual mode
            if (button) {
                button.classList.remove('auto-mode');
                button.textContent = 'BET';
            }
            state.active = false;
            return;
        }

        if (state.active) {
            // Stop auto-betting
            state.active = false;
            if (button) {
                button.textContent = 'START AUTO BET';
                button.classList.remove('auto-active');
            }
        } else {
            // Start auto-betting
            const autoBetInput = document.getElementById(`auto-bet-input-${betNumber}`);
            const amount = parseFloat(autoBetInput.value);

            if (amount <= 0 || amount > this.playerBalance) {
                this.messageElement.textContent = 'Invalid auto-bet amount!';
                return;
            }

            state.active = true;
            if (button) {
                button.textContent = 'STOP AUTO BET';
                button.classList.add('auto-active');
                button.classList.add('auto-mode');
            }
            
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

        // Update stats when bet successfully queued
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

    handleGameStateUpdate(state) {
        // Handle game state updates from WebSocket
        if (!state) return;
        
        console.log('[GAME STATE] Update received:', state.state, 'Round:', state.roundId);
        
        // When round starts flying, check if any bets should be activated
        if (state.state === 'flying') {
            Object.keys(this.bets).forEach(betType => {
                const bet = this.bets[betType];
                const button = betType === 'bet1' ? this.betButton1 : this.betButton2;
                
                // If bet is placed and has an apiId, make sure button shows "Cash Out"
                if (bet.placed && bet.apiId && !bet.cashedOut && button) {
                    button.textContent = 'Cash Out';
                    button.className = 'bet-button active';
                    button.disabled = false;
                    console.log(`[GAME STATE] Bet ${betType} is active for round ${state.roundId}`);
                }
            });
        }
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
            
            // Only execute auto-bet if toggle is enabled and auto state active
            if (!autoToggle || !autoToggle.checked) {
                return;
            }

            const state = this.autoBetState[betType];
            if (!state || !state.active) {
                return;
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

    // ❌ REMOVED: syncBetWithBackend - bets are now placed directly via placeBet()
}

// Global game instance for onclick handlers
let game;

// WebSocket Initialization
async function initializeWebSocket() {
    const API_BASE_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : 'https://your-backend.onrender.com';
    
    try {
        console.log('[WebSocket] Connecting to:', API_BASE_URL);
        await gameSocket.connect(API_BASE_URL);
        console.log('[WebSocket] ✅ Connected to game server');
        
        // Listen for game state updates
        gameSocket.onStateUpdate = (state) => {
            if (game && game.handleGameStateUpdate) {
                game.handleGameStateUpdate(state);
            }
        };
        
    } catch (error) {
        console.error('[WebSocket] ❌ Connection failed:', error);
    }
}

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

// Enhanced session management - Authentication check on page load
async function checkAuthenticationOnLoad() {
    // Check for new JWT token system
    const authToken = localStorage.getItem('user_token');
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
                    const apiBase = isLocal ? 'http://localhost:3001' : 'https://aviator-casino.onrender.com';
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
    localStorage.removeItem('user_token');
    localStorage.removeItem('userData');
    localStorage.removeItem('isDemo');
    // Also clear old token format
    localStorage.removeItem('user_token');
}

function exitDemoSession(target = 'index.html', promptMessage = 'Exit demo mode?') {
    const confirmMessage = promptMessage || 'Exit demo mode?';
    if (!confirm(confirmMessage)) {
        return;
    }

    clearAuthSession();
    localStorage.removeItem('demo_bet_history');
    localStorage.removeItem('demo_settings');
    hideDemoIndicator();
    window.location.href = target;
}

function redirectToLogin() {
    // Only redirect if not already on index page
    if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
        window.location.href = 'index.html';
    }
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
            
            // Initialize WebSocket connection
            initializeWebSocket();

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
            // API integration now handled by syncBetWithBackend
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
            loginBtn.onclick = () => exitDemoSession('index.html', 'Exit demo mode and go to login?');
        }
        
        if (registerBtn) {
            registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
            registerBtn.onclick = () => exitDemoSession('index.html#register', 'Exit demo mode and register?');
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
    return !!localStorage.getItem('user_token') && !!localStorage.getItem('userData');
}

function isDemo() {
    return localStorage.getItem('isDemo') === 'true';
}

// Authentication is now handled through the index page

    // Deposit form
    document.getElementById('deposit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = parseFloat(document.getElementById('deposit-amount').value);
        let phoneNumber = document.getElementById('deposit-phone').value;

        // Validate amount
        if (isNaN(amount) || amount < 100 || amount > 150000) {
            showError('deposit-error', 'Amount must be between KES 100 and KES 150,000');
            return;
        }
        
        // Format and validate phone number
        phoneNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits
        if (phoneNumber.startsWith('0')) {
            phoneNumber = '254' + phoneNumber.substring(1);
        } else if (phoneNumber.startsWith('+')) {
            phoneNumber = phoneNumber.substring(1);
        }

        // Validate phone number format
        if (!/^254[0-9]{9}$/.test(phoneNumber)) {
            showError('deposit-error', 'Invalid phone number format. Use format: 254XXXXXXXXX or 07XXXXXXXX');
            return;
        }
        
        const result = await classyBetAPI.depositSTK(amount, phoneNumber);

        // Keep local API instance in sync with latest user data after deposit attempt
        const latestUserData = localStorage.getItem('userData');
        if (latestUserData) {
            try {
                classyBetAPI.user = JSON.parse(latestUserData);
            } catch (error) {
                console.error('Failed to parse user data after deposit attempt:', error);
            }
        }
        
        if (result.success) {
            showSuccess('deposit-success', `STK Push sent! Transaction ID: ${result.transactionId}`);
            document.getElementById('deposit-form').reset();
        } else {
            showError('deposit-error', result.error);
        }
    });

    // Navigation button events
    document.getElementById('login-btn').addEventListener('click', () => window.location.href = '/');
    document.getElementById('register-btn').addEventListener('click', () => window.location.href = '/');
    document.getElementById('deposit-btn').addEventListener('click', async () => {
        // Check if user is authenticated via localStorage
        const token = localStorage.getItem('user_token');
        const userData = localStorage.getItem('userData');
        
        if (token && userData) {
            try {
                const user = JSON.parse(userData);
                
                // Track deposit tab click
                await fetch(`${API_BASE}/api/payments/deposit-tab-click`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }).catch(err => console.log('Deposit tab tracking failed:', err));
                
                showModal('deposit-modal');
                // Pre-fill phone number
                if (user.phone) {
                    const phoneInput = document.getElementById('deposit-phone');
                    if (phoneInput) {
                        phoneInput.value = user.phone;
                    }
                }
            } catch (error) {
                console.error('Error opening deposit modal:', error);
                showModal('deposit-modal');
            }
        } else {
            // Not authenticated, redirect to login
            window.location.href = '/';
        }
    });
    
    document.getElementById('profile-btn').addEventListener('click', () => {
        if (!classyBetAPI.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        
        // For localhost, use the full backend URL
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.location.href = 'http://localhost:3001/profile';
            return;
        }

        window.location.href = `${window.location.origin}/profile.html`;
    });
    
    document.getElementById('admin-btn').addEventListener('click', () => {
        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.protocol === 'file:';
        const adminUrl = isLocal ? 'http://localhost:3001/admin' : 'https://aviator-casino.onrender.com/admin';
        console.log('Admin URL:', adminUrl);
        window.open(adminUrl, '_blank');
    });
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => logout());
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

let integrateGameRetries = 0;
// OLD INTEGRATION REMOVED - Now using syncBetWithBackend for all bet/cashout operations
// This prevents duplicate balance deductions and ensures backend is source of truth

// Initialize game loop with backend round synchronization
AviatorGame.prototype.initializeGameLoop = async function() {
    console.log('Initializing backend-controlled game loop...');
    
    // Fetch initial round schedule
    await this.fetchRoundSchedule();
    
    // Start the countdown for first round
    this.startCountdown();
};

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAuthenticationOnLoad();
    
    // Old integration removed - now using syncBetWithBackend
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});


