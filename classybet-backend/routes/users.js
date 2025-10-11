// Add new route to game.js for balance sync
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

// Get current balance
router.get('/balance', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ balance: user.balance });
    } catch (error) {
        console.error('Error getting balance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user balance
router.post('/balance/update', authenticateToken, async (req, res) => {
    try {
        const { balance, reason } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update user balance
        user.balance = Math.max(0, balance); // Ensure balance never goes below 0
        await user.save();
        
        res.json({ 
            message: 'Balance updated successfully',
            balance: user.balance 
        });
    } catch (error) {
        console.error('Error updating balance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;