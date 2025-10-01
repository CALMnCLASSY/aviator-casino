const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Bet = require('../models/Bet');
const Transaction = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');
const { sendTelegramNotification } = require('../utils/telegram');

const router = express.Router();

// Place a bet
router.post('/bet', 
  authenticateToken,
  [
    body('amount').isNumeric().custom(value => {
      if (value < 10) throw new Error('Minimum bet amount is KES 10');
      if (value > 10000) throw new Error('Maximum bet amount is KES 10,000');
      return true;
    }),
    body('cashoutMultiplier').optional().isNumeric().custom(value => {
      if (value < 1.01) throw new Error('Minimum cashout multiplier is 1.01x');
      if (value > 100) throw new Error('Maximum cashout multiplier is 100x');
      return true;
    }),
    body('gameRound').notEmpty().withMessage('Game round is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { amount, cashoutMultiplier, gameRound } = req.body;
      const userId = req.user.id;

      // Check user balance
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Check if user already has a bet for this round
      const existingBet = await Bet.findOne({ 
        userId, 
        gameRound, 
        status: { $in: ['pending', 'active'] }
      });

      if (existingBet) {
        return res.status(400).json({ error: 'You already have an active bet for this round' });
      }

      // Create bet
      const bet = new Bet({
        userId,
        gameRound,
        amount,
        cashoutMultiplier: cashoutMultiplier || null,
        status: 'pending'
      });

      // Deduct amount from user balance
      user.balance -= amount;
      user.totalBets = (user.totalBets || 0) + 1;
      
      await Promise.all([bet.save(), user.save()]);

      // Create transaction record
      const transaction = new Transaction({
        userId,
        type: 'bet',
        amount: -amount,
        description: `Bet placed on round ${gameRound}`,
        status: 'completed',
        balanceAfter: user.balance
      });
      await transaction.save();

      res.json({
        message: 'Bet placed successfully',
        bet: bet.toObject(),
        newBalance: user.balance
      });

    } catch (error) {
      console.error('Bet placement error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Cashout a bet
router.post('/cashout',
  authenticateToken,
  [
    body('betId').notEmpty().withMessage('Bet ID is required'),
    body('multiplier').isNumeric().custom(value => {
      if (value < 1.01) throw new Error('Invalid multiplier');
      return true;
    })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { betId, multiplier } = req.body;
      const userId = req.user.id;

      const bet = await Bet.findOne({ _id: betId, userId });
      if (!bet) {
        return res.status(404).json({ error: 'Bet not found' });
      }

      if (bet.status !== 'active') {
        return res.status(400).json({ error: 'Bet is not active' });
      }

      // Check if user set auto-cashout and this multiplier meets it
      if (bet.cashoutMultiplier && multiplier < bet.cashoutMultiplier) {
        return res.status(400).json({ error: 'Multiplier below auto-cashout threshold' });
      }

      const winAmount = bet.amount * multiplier;
      
      // Update bet
      bet.status = 'won';
      bet.actualMultiplier = multiplier;
      bet.winAmount = winAmount;
      bet.cashoutAt = new Date();

      // Update user balance and stats
      const user = await User.findById(userId);
      user.balance += winAmount;
      user.totalWins = (user.totalWins || 0) + 1;
      
      if (winAmount > (user.biggestWin || 0)) {
        user.biggestWin = winAmount;
      }
      
      if (multiplier > (user.biggestMultiplier || 0)) {
        user.biggestMultiplier = multiplier;
      }

      await Promise.all([bet.save(), user.save()]);

      // Create transaction record
      const transaction = new Transaction({
        userId,
        type: 'win',
        amount: winAmount,
        description: `Won ${multiplier.toFixed(2)}x on round ${bet.gameRound}`,
        status: 'completed',
        balanceAfter: user.balance
      });
      await transaction.save();

      // Send Telegram notification for big wins
      if (multiplier >= 10) {
        await sendTelegramNotification(
          `🎉 BIG WIN! 🎉\n\n` +
          `Username: ${user.username}\n` +
          `Bet: KES ${bet.amount}\n` +
          `Multiplier: ${multiplier.toFixed(2)}x\n` +
          `Win: KES ${winAmount.toFixed(2)}\n` +
          `Round: ${bet.gameRound}\n` +
          `Time: ${new Date().toLocaleString()}`
        );
      }

      res.json({
        message: 'Cashout successful',
        bet: bet.toObject(),
        newBalance: user.balance,
        winAmount
      });

    } catch (error) {
      console.error('Cashout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// End game round (called by game server)
router.post('/end-round',
  authenticateToken,
  [
    body('gameRound').notEmpty().withMessage('Game round is required'),
    body('crashMultiplier').isNumeric().withMessage('Crash multiplier is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { gameRound, crashMultiplier } = req.body;

      // Process all active bets for this round
      const activeBets = await Bet.find({ 
        gameRound, 
        status: { $in: ['pending', 'active'] }
      });

      const updates = [];
      const userUpdates = {};

      for (const bet of activeBets) {
        // If bet has auto-cashout and crash multiplier reached it
        if (bet.cashoutMultiplier && crashMultiplier >= bet.cashoutMultiplier) {
          const winAmount = bet.amount * bet.cashoutMultiplier;
          bet.status = 'won';
          bet.actualMultiplier = bet.cashoutMultiplier;
          bet.winAmount = winAmount;
          bet.cashoutAt = new Date();

          // Update user stats
          if (!userUpdates[bet.userId]) {
            const user = await User.findById(bet.userId);
            userUpdates[bet.userId] = user;
          }
          
          const user = userUpdates[bet.userId];
          user.balance += winAmount;
          user.totalWins = (user.totalWins || 0) + 1;
          
          if (winAmount > (user.biggestWin || 0)) {
            user.biggestWin = winAmount;
          }
          
          if (bet.cashoutMultiplier > (user.biggestMultiplier || 0)) {
            user.biggestMultiplier = bet.cashoutMultiplier;
          }

          // Create transaction record
          const transaction = new Transaction({
            userId: bet.userId,
            type: 'win',
            amount: winAmount,
            description: `Auto-cashout ${bet.cashoutMultiplier.toFixed(2)}x on round ${gameRound}`,
            status: 'completed',
            balanceAfter: user.balance
          });
          updates.push(transaction.save());

        } else {
          // Bet lost
          bet.status = 'lost';
          bet.actualMultiplier = crashMultiplier;
        }

        updates.push(bet.save());
      }

      // Save all user updates
      for (const user of Object.values(userUpdates)) {
        updates.push(user.save());
      }

      await Promise.all(updates);

      res.json({
        message: 'Round ended successfully',
        processedBets: activeBets.length
      });

    } catch (error) {
      console.error('End round error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get active bets for display
router.get('/active-bets/:gameRound', async (req, res) => {
  try {
    const { gameRound } = req.params;
    
    const activeBets = await Bet.find({ 
      gameRound, 
      status: { $in: ['pending', 'active'] }
    })
    .populate('userId', 'username')
    .select('userId amount cashoutMultiplier createdAt')
    .sort({ createdAt: -1 })
    .limit(50);

    const formattedBets = activeBets.map(bet => ({
      username: bet.userId.username,
      amount: bet.amount,
      cashoutMultiplier: bet.cashoutMultiplier
    }));

    res.json(formattedBets);

  } catch (error) {
    console.error('Active bets fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's current bet for a round
router.get('/my-bet/:gameRound', authenticateToken, async (req, res) => {
  try {
    const { gameRound } = req.params;
    const userId = req.user.id;

    const bet = await Bet.findOne({ 
      userId, 
      gameRound,
      status: { $in: ['pending', 'active'] }
    });

    res.json(bet);

  } catch (error) {
    console.error('User bet fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;