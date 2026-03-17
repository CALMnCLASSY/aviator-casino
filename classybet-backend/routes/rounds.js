const express = require('express');
const router = express.Router();

const {
  getRoundState,
  getRoundById,
  getRoundsInRange,
  getRecentRounds,
  ROUND_INTERVAL_SECONDS,
  ROUND_DURATION_MS
} = require('../utils/roundScheduler');

router.get('/state', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const { currentRound, nextRound, upcoming } = await getRoundState(limit);

    res.json({
      serverTime: new Date().toISOString(),
      currentRound,
      nextRound,
      upcoming
    });
  } catch (error) {
    console.error('Round state fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch round state' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const rounds = await getRecentRounds(limit);
    res.json({
      serverTime: new Date().toISOString(),
      rounds
    });
  } catch (error) {
    console.error('Round history fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch round history' });
  }
});

router.get('/by-id/:roundId', async (req, res) => {
  try {
    const round = await getRoundById(req.params.roundId);
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }
    res.json(round);
  } catch (error) {
    console.error('Round fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch round' });
  }
});

router.get('/range', async (req, res) => {
  try {
    const { from, to, limit } = req.query;

    let fromDate;
    let toDate;

    if (from) {
      const parsedFrom = new Date(from);
      if (Number.isNaN(parsedFrom.getTime())) {
        return res.status(400).json({ error: 'Invalid "from" timestamp' });
      }
      fromDate = parsedFrom;
    }

    if (to) {
      const parsedTo = new Date(to);
      if (Number.isNaN(parsedTo.getTime())) {
        return res.status(400).json({ error: 'Invalid "to" timestamp' });
      }
      toDate = parsedTo;
    }

    const rounds = await getRoundsInRange(fromDate, toDate, limit ? parseInt(limit, 10) : undefined);
    res.json({
      serverTime: new Date().toISOString(),
      rounds
    });
  } catch (error) {
    console.error('Round range fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
});

router.get('/config', (req, res) => {
  res.json({
    roundIntervalSeconds: ROUND_INTERVAL_SECONDS,
    roundDurationMs: ROUND_DURATION_MS
  });
});

// Get current live game state (for predictor bot)
router.get('/current-state', (req, res) => {
  try {
    const { gameStateManager } = require('../utils/gameStateManager');
    
    res.json({
      serverTime: new Date().toISOString(),
      currentRound: gameStateManager.currentRound ? {
        roundId: gameStateManager.currentRound.roundId,
        multiplier: gameStateManager.currentRound.multiplier,
        startTime: gameStateManager.currentRound.startTime
      } : null,
      gameState: gameStateManager.currentState,
      currentMultiplier: gameStateManager.currentMultiplier,
      crashMultiplier: gameStateManager.crashMultiplier
    });
  } catch (error) {
    console.error('Current state fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch current state' });
  }
});

module.exports = router;
