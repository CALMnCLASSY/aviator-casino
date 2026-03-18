/**
 * Centralized Game State Manager
 * Manages a single, live game session that all users connect to
 */

const mongoose = require('mongoose');
const RoundSchedule = require('../models/RoundSchedule');

class GameStateManager {
  constructor() {
    this.currentState = 'waiting'; // waiting, countdown, flying, crashed
    this.currentRound = null;
    this.nextRound = null; // Store the upcoming round
    this.currentMultiplier = 1.00;
    this.startTime = null;
    this.crashMultiplier = null;
    this.countdownSeconds = 2.5;
    this.io = null; // Socket.io instance
    this.gameLoopInterval = null;
    this.activeBets = 0; // Live bet count — broadcast to all clients
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
      // Check database connection
      if (mongoose.connection.readyState !== 1) {
        console.error('❌ Database not connected, state:', mongoose.connection.readyState);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.prepareNextRound();
      }
      
      // Fetch next scheduled round (status can be 'pending' or 'scheduled')
      const now = new Date();
      const nextRound = await RoundSchedule.findOne({
        startTime: { $gte: now },
        status: { $in: ['pending', 'scheduled'] }
      }).sort({ startTime: 1 });
      
      console.log('🔍 Querying for rounds after:', now);
      const totalRounds = await RoundSchedule.countDocuments({
        startTime: { $gte: now }
      });
      console.log(`📊 Found ${totalRounds} rounds in database`);

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

        this.nextRound = null;

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

      // Also fetch the round after this one
      const futureRound = await RoundSchedule.findOne({
        startTime: { $gt: nextRound.startTime },
        status: { $in: ['pending', 'scheduled'] }
      }).sort({ startTime: 1 });

      this.nextRound = futureRound ? {
        roundId: futureRound.roundId,
        multiplier: futureRound.multiplier,
        startTime: futureRound.startTime
      } : null;
      
      console.log(`📋 Round prepared: ${this.currentRound.roundId} (${this.crashMultiplier}x)`);
      console.log(`🔮 Next round: ${this.nextRound ? `${this.nextRound.roundId} (${this.nextRound.multiplier}x)` : 'None'}`);
    } catch (error) {
      console.error('❌ Error preparing round:', error);
      // Retry after 2 seconds on error
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.prepareNextRound();
    }
  }

  /**
   * Countdown phase (2.5 seconds)
   */
  async startCountdown() {
    this.currentState = 'countdown';
    this.countdownSeconds = 2.5;

    // ❌ REMOVED: Countdown log - frontend handles display
    await this.broadcastState();

    const countdownInterval = setInterval(async () => {
      this.countdownSeconds--;
      await this.broadcastState();

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
    this.activeBets = 0; // Reset bet count for new round

    // ❌ REMOVED: Flying log - frontend handles display
    this.broadcastState();

    // Update multiplier every 100ms
    const flyingInterval = setInterval(async () => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      
      // Calculate multiplier based on time (more gradual growth: 1.0012 base)
      this.currentMultiplier = Math.pow(1.0012, elapsed * 100);

      // Check if we've reached crash point
      if (this.currentMultiplier >= this.crashMultiplier) {
        clearInterval(flyingInterval);
        this.crash();
      } else {
        await this.broadcastState();
      }
    }, 100);
  }

  /**
   * Crash phase
   */
  async crash() {
    this.currentState = 'crashed';
    this.currentMultiplier = this.crashMultiplier;

    // Broadcast crash state immediately
    await this.broadcastState();

    // Start countdown after 2500ms (2.5 seconds to show "FLEW AWAY")
    setTimeout(async () => {
      await this.startCountdown();
    }, 2500);

    // Process round end in background during countdown
    this.processRoundEndAsync();
  }

  /**
   * Process round end asynchronously (runs during countdown)
   */
  async processRoundEndAsync() {
    try {
      // Mark round as complete in database
      if (this.currentRound) {
        await RoundSchedule.updateOne(
          { roundId: this.currentRound.roundId },
          { status: 'complete' }
        ).catch(err => console.error('Failed to mark round complete:', err));
      }

      // Process all remaining bets as losses
      await this.processRoundEnd();

      // Prepare next round immediately so it's available for prediction
      await this.prepareNextRound();
      
      // Broadcast updated state with next round
      await this.broadcastState();
    } catch (error) {
      console.error('❌ Error processing round end:', error);
    }
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

      // Reset active bets counter for the round
      this.activeBets = 0;

      // ❌ REMOVED: Log - silent processing
    } catch (error) {
      console.error('❌ Error processing round end:', error);
    }
  }

  /**
   * Broadcast game state to all connected clients
   */
  async broadcastState() {
    if (!this.io) return;

    const statePayload = await this.getCurrentState();

    this.io.emit('game-state', statePayload);
  }

  /**
   * Get current state for new connections
   */
  async getCurrentState() {
    // Fetch future rounds for prediction
    const futureRounds = await RoundSchedule.find({
      startTime: { $gt: this.currentRound?.startTime || new Date() },
      status: { $in: ['pending', 'scheduled'] }
    }).sort({ startTime: 1 }).limit(5).lean();
    
    const state = {
      state: this.currentState,
      roundId: this.currentRound?.roundId,
      multiplier: this.currentMultiplier,
      countdown: this.countdownSeconds,
      crashMultiplier: this.currentState === 'crashed' ? this.crashMultiplier : null,
      startTime: this.startTime,
      activeBets: this.activeBets,
      timestamp: Date.now(),
      nextRound: this.nextRound
        ? {
            roundId: this.nextRound.roundId,
            multiplier: this.nextRound.multiplier,
            startTime: this.nextRound.startTime
          }
        : null,
      futureRounds: futureRounds.map(r => ({
        roundId: r.roundId,
        multiplier: r.multiplier,
        startTime: r.startTime
      }))
    };
    
    // Debug logging
    if (this.currentState === 'countdown' || this.currentState === 'waiting') {
      console.log('📤 Broadcasting state:', {
        state: state.state,
        roundId: state.roundId,
        hasNextRound: !!state.nextRound,
        nextRoundId: state.nextRound?.roundId,
        nextRoundMultiplier: state.nextRound?.multiplier,
        futureRoundsCount: state.futureRounds.length
      });
    }
    
    return state;
  }

  /** Call from server.js when a bet is successfully placed */
  async incrementActiveBets() {
    this.activeBets++;
    await this.broadcastState();
  }

  /** Call from server.js when a bet is cashed out or crashes */
  decrementActiveBets() {
    this.activeBets = Math.max(0, this.activeBets - 1);
  }

  /** Cleanup method to stop all intervals */
  cleanup() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
    }
  }
}

// Singleton instance
const gameStateManager = new GameStateManager();

module.exports = gameStateManager;
