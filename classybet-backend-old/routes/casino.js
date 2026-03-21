const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Bet = require('../models/Bet');
const Transaction = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');
const { recordAffiliateLoss } = require('../utils/affiliate');

const router = express.Router();

/**
 * Generic Play Endpoint for Casino Games (Slots, Table Games)
 * Supports: 'jetx', 'ultimate_hot', 'roulette', 'blackjack', etc.
 */
router.post('/play',
    authenticateToken,
    [
        body('gameId').notEmpty().toLowerCase().withMessage('Game ID is required'),
        body('amount').isNumeric().custom(value => {
            if (value < 10) throw new Error('Minimum bet amount is KES 10');
            if (value > 10000) throw new Error('Maximum bet amount is KES 10,000');
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

            const { gameId, amount } = req.body;
            const userId = req.user.id;

            // 1. Check user balance
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });
            if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

            // 2. Determine Win/Loss (Simple Server-side RNG for Demo/Clone purposes)
            // RTP (Return to Player) simulated at ~95%
            // Win chance depends on the game mechanics, here we use a generic simplified model for demo
            const isWin = Math.random() > 0.6; // 40% win chance for demo excitement
            let multiplier = 0;
            let winAmount = 0;

            if (isWin) {
                // Generate random multiplier based on game type (mock logic)
                // Slots might have higher variance, Blackjack 2x, etc.
                if (['blackjack', 'baccarat', 'roulette'].includes(gameId)) {
                    multiplier = 2.0; // Standard 1:1 win
                } else {
                    // Slots / Crash variations
                    multiplier = (Math.random() * 5) + 1.1; // Random 1.1x to 6.1x
                }
                winAmount = Math.floor(amount * multiplier);
            }

            // 3. Update Balance
            user.balance -= amount; // Deduct bet
            if (winAmount > 0) {
                user.balance += winAmount; // Add winnings
            }

            // Update Activity Tracking
            user.lastGamePlayed = gameId;
            user.lastActivityAt = new Date();

            await user.save();

            // 4. Create Bet Record
            const bet = new Bet({
                user: userId, // Ensure this matches schema (using 'user' ref instead of userId string if schema requires ObjectId)
                gameRound: `CASINO-${Date.now()}`,
                gameType: gameId,
                betAmount: amount,
                multiplier: isWin ? multiplier : 0,
                winAmount: winAmount,
                status: isWin ? 'cashed_out' : 'crashed', // Borrowing status terms from Aviator model
                roundStartTime: new Date(),
                cashedOutAt: isWin ? new Date() : null
            });
            await bet.save();

            // 5. Create Transaction Record
            const description = isWin
                ? `Won KES ${winAmount} in ${gameId} (${multiplier.toFixed(2)}x)`
                : `Bet KES ${amount} in ${gameId}`;

            const transaction = new Transaction({
                user: userId,
                type: isWin ? 'win' : 'bet',
                amount: isWin ? (winAmount - amount) : -amount, // Net change
                description: description,
                game: gameId,
                status: 'completed',
                balanceAfter: user.balance
            });
            await transaction.save();

            // 6. Handle Affiliate Logic on Loss
            if (!isWin) {
                try {
                    await recordAffiliateLoss(user, amount);
                } catch (affError) {
                    console.error('Affiliate tracking error:', affError.message);
                }
            }

            res.json({
                success: true,
                isWin,
                multiplier: isWin ? parseFloat(multiplier.toFixed(2)) : 0,
                balance: user.balance,
                winAmount
            });

        } catch (error) {
            console.error('Casino play error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;
