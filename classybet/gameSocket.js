/**
 * WebSocket Client for Real-Time Game Connection
 * Connects to centralized backend game session
 */

class GameSocketClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.currentGameState = null;
        this.onStateUpdate = null;
        this.onBetPlaced = null;
        this.onCashoutResult = null;
    }

    /**
     * Connect to backend WebSocket server
     */
    connect(serverUrl) {
        return new Promise((resolve, reject) => {
            try {
                // Load socket.io client from CDN if not already loaded
                if (typeof io === 'undefined') {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
                    script.onload = () => {
                        this.initializeSocket(serverUrl);
                        resolve();
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                } else {
                    this.initializeSocket(serverUrl);
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Initialize socket connection
     */
    initializeSocket(serverUrl) {
        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10
        });

        // Connection events
        this.socket.on('connect', () => {
            console.log('🔌 Connected to game server');
            this.connected = true;
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Disconnected from game server');
            this.connected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('🔌 Connection error:', error);
        });

        // Game state updates
        this.socket.on('game-state', (state) => {
            this.currentGameState = state;
            if (this.onStateUpdate) {
                this.onStateUpdate(state);
            }
        });

        // Bet placement response
        this.socket.on('bet-placed', (result) => {
            if (this.onBetPlaced) {
                this.onBetPlaced(result);
            }
        });

        this.socket.on('bet-error', (error) => {
            console.error('❌ Bet error:', error);
            if (this.onBetPlaced) {
                this.onBetPlaced({ success: false, error: error.error });
            }
        });

        // Cashout response
        this.socket.on('cashout-result', (result) => {
            console.log('💸 Cashout result received:', result);
            if (this.onCashoutResult) {
                this.onCashoutResult(result);
                this.onCashoutResult = null; // Clear callback after use
            }
        });

        this.socket.on('cashout-error', (error) => {
            console.error('❌ Cashout error:', error);
            if (this.onCashoutResult) {
                this.onCashoutResult({ success: false, error: error.error });
                this.onCashoutResult = null; // Clear callback after use
            }
        });
    }

    /**
     * Place a bet
     */
    placeBet(userId, amount, autoCashout = null, token = null) {
        if (!this.connected) {
            return Promise.reject(new Error('Not connected to game server'));
        }

        return new Promise((resolve) => {
            this.onBetPlaced = resolve;
            this.socket.emit('place-bet', {
                userId,
                amount,
                autoCashout,
                token
            });
        });
    }

    /**
     * Request cashout
     */
    cashout(userId, betId, multiplier) {
        if (!this.connected) {
            return Promise.reject(new Error('Not connected to game server'));
        }

        return new Promise((resolve) => {
            this.onCashoutResult = resolve;
            this.socket.emit('cashout', { userId, betId, multiplier });
        });
    }

    /**
     * Get current game state
     */
    getState() {
        return this.currentGameState;
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.connected = false;
        }
    }
}

// Create global instance
window.gameSocket = new GameSocketClient();
