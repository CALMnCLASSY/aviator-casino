/**
 * Centralized Game State Manager
 * Manages a single, live game session that all users connect to
 */

const RoundSchedule = require('../models/RoundSchedule');

class GameStateManager {
  constructor() {
    this.currentState = 'waiting'; // waiting, countdown, flying, crashed
    this.currentRound = null;
    this.currentMultiplier = 1.00;
    this.startTime = null;
    this.crashMultiplier = null;
    this.countdownSeconds = 5;
    this.io = null; // Socket.io instance
    this.gameLoopInterval = null;
    // No bet tracking - bets are handled independently via WebSocket
  }

  /**
   * Initialize with Socket.IO instance
   */
  initialize(io) {
    this.io = io;
    console.log('🎮 Game State Manager initialized');
    this.startGameLoop();
  }

  /**
   * Main game loop - runs continuously
   */
  async startGameLoop() {
    console.log('🔄 Starting centralized game loop...');
    
    // Start with first round
    await this.prepareNextRound();
    await this.startCountdown();
  }

  /**
   * Prepare the next round from backend schedule
   */
  async prepareNextRound() {
    try {
      // Fetch next scheduled round (status can be 'pending' or 'scheduled')
      const now = new Date();
      const nextRound = await RoundSchedule.findOne({
        startTime: { $gte: now },
        status: { $in: ['pending', 'scheduled'] }
      }).sort({ startTime: 1 });

      if (!nextRound) {
        console.warn('⚠️ No scheduled rounds found, triggering round generation...');
        // Trigger round population
        const { populateRoundSchedule } = require('./roundScheduler');
        await populateRoundSchedule();
        
        // Try again after population
        const retryRound = await RoundSchedule.findOne({
          startTime: { $gte: now },
          status: { $in: ['pending', 'scheduled'] }
        }).sort({ startTime: 1 });
        
        if (!retryRound) {
          console.error('❌ Still no rounds after population, retrying in 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.prepareNextRound();
        }
        
        // Use the retry round
        this.currentRound = {
          roundId: retryRound.roundId,
          multiplier: retryRound.multiplier,
          startTime: retryRound.startTime
        };

        this.crashMultiplier = retryRound.multiplier;

        console.log(`📋 Round prepared: ${this.currentRound.roundId} (${this.crashMultiplier}x)`);
        return;
      }

      this.currentRound = {
        roundId: nextRound.roundId,
        multiplier: nextRound.multiplier,
        startTime: nextRound.startTime
      };

      this.crashMultiplier = nextRound.multiplier;

      // Mark round as scheduled
      await RoundSchedule.updateOne(
        { roundId: nextRound.roundId },
        { status: 'scheduled' }
      );

      console.log(`📋 Round prepared: ${this.currentRound.roundId} (${this.crashMultiplier}x)`);
    } catch (error) {
      console.error('❌ Error preparing round:', error);
      // Retry after 2 seconds on error
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.prepareNextRound();
    }
  }

  /**
   * Countdown phase (5 seconds)
   */
  async startCountdown() {
    this.currentState = 'countdown';
    this.countdownSeconds = 5;

    // ❌ REMOVED: Countdown log - frontend handles display
    this.broadcastState();

    const countdownInterval = setInterval(() => {
      this.countdownSeconds--;
      this.broadcastState();

      if (this.countdownSeconds <= 0) {
        clearInterval(countdownInterval);
        this.startFlying();
      }
    }, 1000);
  }

  /**
   * Flying phase - multiplier increases
   */
  startFlying() {
    if (!this.currentRound || !this.crashMultiplier) {
      console.error('❌ Cannot start flying - no round prepared');
      setTimeout(() => this.prepareNextRound().then(() => this.startCountdown()), 1000);
      return;
    }

    this.currentState = 'flying';
    this.currentMultiplier = 1.00;
    this.startTime = Date.now();

    // ❌ REMOVED: Flying log - frontend handles display
    this.broadcastState();

    // Update multiplier every 100ms
    const flyingInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      
      // Calculate multiplier based on time (exponential growth)
      this.currentMultiplier = Math.pow(1.0024, elapsed * 100);

      // Check if we've reached crash point
      if (this.currentMultiplier >= this.crashMultiplier) {
        clearInterval(flyingInterval);
        this.crash();
      } else {
        this.broadcastState();
      }
    }, 100);
  }

  /**
   * Crash phase
   */
  async crash() {
    this.currentState = 'crashed';
    this.currentMultiplier = this.crashMultiplier;

    // ❌ REMOVED: Crash log - frontend handles display
    this.broadcastState();

    // Mark round as complete in database
    if (this.currentRound) {
      await RoundSchedule.updateOne(
        { roundId: this.currentRound.roundId },
        { status: 'complete' }
      ).catch(err => console.error('Failed to mark round complete:', err));
    }

    // Process all remaining bets as losses
    await this.processRoundEnd();

    // Wait 2 seconds, then start next round
    setTimeout(async () => {
      await this.prepareNextRound();
      await this.startCountdown();
    }, 2000);
  }

  /**
   * Process round end - just mark uncashed bets as lost
   * NOTE: No balance changes here - balance is managed by WebSocket handlers
   */
  async processRoundEnd() {
    const Bet = require('../models/Bet');

    try {
      // Mark all uncashed bets for this round as crashed
      const result = await Bet.updateMany(
        {
          gameRound: String(this.currentRound.roundId),
          status: 'active'
        },
        {
          $set: {
            status: 'crashed',
            crashedAt: this.crashMultiplier,
            roundEndTime: new Date()
          }
        }
      );

      // ❌ REMOVED: Log - silent processing
    } catch (error) {
      console.error('❌ Error processing round end:', error);
    }
  }

  /**
   * Broadcast current game state to all connected clients
   */
  broadcastState() {
    if (!this.io) return;

    const state = {
      state: this.currentState,
      roundId: this.currentRound?.roundId,
      multiplier: this.currentMultiplier,
      countdown: this.countdownSeconds,
      crashMultiplier: this.currentState === 'crashed' ? this.crashMultiplier : null,
      timestamp: Date.now()
    };

    this.io.emit('game-state', state);
  }

  /**
   * Get current state for new connections
   */
  getCurrentState() {
    return {
      state: this.currentState,
      roundId: this.currentRound?.roundId,
      multiplier: this.currentMultiplier,
      countdown: this.countdownSeconds,
      crashMultiplier: this.currentState === 'crashed' ? this.crashMultiplier : null,
      timestamp: Date.now()
    };
  }
}

// Singleton instance
const gameStateManager = new GameStateManager();

module.exports = gameStateManager;
