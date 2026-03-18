/**
 * Centralized Game State Manager
 * Manages a single, live game session that all users connect to
 */

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
    
    // Ensure we have rounds populated before starting
    const { populateRoundSchedule } = require('./roundScheduler');
    await populateRoundSchedule();
    
    // Start with first round and fetch the next one
    await this.prepareNextRound();
    
    // Ensure we have a next round before starting
    if (!this.nextRound) {
      console.log('🔄 Fetching next round before starting...');
      await this.fetchFutureRound();
    }
    
    await this.startCountdown();
  }

  /**
   * Prepare the next round from backend schedule
   */
  async prepareNextRound() {
    try {
      // If we already have a nextRound cached, promote it to currentRound
      if (this.nextRound) {
        console.log(`🔄 Promoting cached round: ${this.nextRound.roundId}`);
        this.currentRound = this.nextRound;
        this.crashMultiplier = this.nextRound.multiplier;
        
        // Mark the promoted round as scheduled
        await RoundSchedule.updateOne(
          { roundId: this.currentRound.roundId },
          { status: 'scheduled' }
        ).catch(err => console.error('Failed to mark round as scheduled:', err));
        
        // Now fetch the round after this one
        await this.fetchFutureRound();
        return;
      }
      
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

        this.nextRound = null;

        console.log(`📋 Round prepared: ${this.currentRound.roundId} (${this.crashMultiplier}x)`);
        console.log(`📋 Next round: ${this.nextRound?.roundId || 'Not available'}`);
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

      // Fetch the round after this one
      await this.fetchFutureRound();

      console.log(`📋 Round prepared: ${this.currentRound.roundId} (${this.crashMultiplier}x)`);
      console.log(`📋 Next round: ${this.nextRound?.roundId || 'Not available'}`);
    } catch (error) {
      console.error('❌ Error preparing round:', error);
      // Retry after 2 seconds on error
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.prepareNextRound();
    }
  }

  /**
   * Fetch the round after the current one
   */
  async fetchFutureRound() {
    try {
      if (!this.currentRound) {
        this.nextRound = null;
        return;
      }

      // First try to find the next round in database
      const futureRound = await RoundSchedule.findOne({
        startTime: { $gt: this.currentRound.startTime },
        status: { $in: ['pending', 'scheduled'] }
      }).sort({ startTime: 1 });

      if (futureRound) {
        this.nextRound = {
          roundId: futureRound.roundId,
          multiplier: futureRound.multiplier,
          startTime: futureRound.startTime
        };
        console.log(`✅ Found future round: ${this.nextRound.roundId}`);
        return;
      }

      // If no future round found, use deterministic calculation
      console.warn('⚠️ No future round in DB, calculating deterministically...');
      const nextRoundId = this.currentRound.roundId + 1;
      const nextStartTime = new Date(this.currentRound.startTime.getTime() + 30 * 1000);
      
      // Try to find by round ID as fallback
      const fallbackRound = await RoundSchedule.findOne({ roundId: nextRoundId });
      
      if (fallbackRound) {
        this.nextRound = {
          roundId: fallbackRound.roundId,
          multiplier: fallbackRound.multiplier,
          startTime: fallbackRound.startTime
        };
        console.log(`✅ Found fallback round by ID: ${this.nextRound.roundId}`);
      } else {
        // Create temporary next round with deterministic values
        const { generateMultiplier } = require('./roundScheduler');
        this.nextRound = {
          roundId: nextRoundId,
          multiplier: generateMultiplier(nextRoundId, nextStartTime),
          startTime: nextStartTime
        };
        console.log(`⚡ Created temporary next round: ${this.nextRound.roundId} (${this.nextRound.multiplier}x)`);
        
        // Trigger population to ensure this round gets saved
        const { populateRoundSchedule } = require('./roundScheduler');
        populateRoundSchedule().catch(err => console.error('Failed to populate rounds:', err));
      }
    } catch (error) {
      console.error('❌ Error fetching future round:', error);
      this.nextRound = null;
    }
  }

  /**
   * Countdown phase (2.5 seconds)
   */
  async startCountdown() {
    this.currentState = 'countdown';
    this.countdownSeconds = 2.5;

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
    this.activeBets = 0; // Reset bet count for new round

    // ❌ REMOVED: Flying log - frontend handles display
    this.broadcastState();

    // Update multiplier every 100ms
    const flyingInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      
      // Calculate multiplier based on time (more gradual growth: 1.0012 base)
      this.currentMultiplier = Math.pow(1.0012, elapsed * 100);

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

    // Broadcast crash state immediately
    this.broadcastState();

    // Start countdown after 2500ms (2.5 seconds to show "FLEW AWAY")
    setTimeout(async () => {
      // Prepare next round before starting countdown
      await this.prepareNextRound();
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

      // IMPORTANT: Don't call prepareNextRound here anymore
      // The next round preparation will happen when the countdown ends
      // This ensures we use the cached nextRound instead of re-fetching
      
      // Broadcast state to show we have nextRound ready
      this.broadcastState();
      
      // Pre-fetch the round after nextRound to stay ahead
      if (this.nextRound && !this.nextRound._preFetched) {
        this.nextRound._preFetched = true;
        // In background, ensure we have the round after nextRound
        setTimeout(async () => {
          try {
            const futureRound = await RoundSchedule.findOne({
              startTime: { $gt: this.nextRound.startTime },
              status: { $in: ['pending', 'scheduled'] }
            }).sort({ startTime: 1 });
            
            if (!futureRound) {
              console.log('🔄 Triggering population for future rounds...');
              const { populateRoundSchedule } = require('./roundScheduler');
              await populateRoundSchedule();
            }
          } catch (error) {
            console.error('Error pre-fetching future rounds:', error);
          }
        }, 1000);
      }
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
  broadcastState() {
    if (!this.io) return;

    const statePayload = this.getCurrentState();
    
    // Log nextRound availability for debugging
    if (this.currentState === 'countdown' || this.currentState === 'flying') {
      if (statePayload.nextRound) {
        console.log(`📡 Broadcasting: Round ${statePayload.roundId} | Next: ${statePayload.nextRound.roundId} (${statePayload.nextRound.multiplier}x)`);
      } else {
        console.warn(`⚠️ Broadcasting: Round ${statePayload.roundId} | Next: NOT AVAILABLE`);
      }
    }

    this.io.emit('game-state', statePayload);
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
      startTime: this.startTime,
      activeBets: this.activeBets,
      timestamp: Date.now(),
      nextRound: this.nextRound
        ? {
            roundId: this.nextRound.roundId,
            multiplier: this.nextRound.multiplier,
            startTime: this.nextRound.startTime
          }
        : null
    };
  }

  /** Call from server.js when a bet is successfully placed */
  incrementActiveBets() {
    this.activeBets++;
    this.broadcastState();
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
