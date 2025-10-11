const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');
const { sendTelegramNotification } = require('../utils/telegram');
const { sendSlackMessage } = require('../utils/slack');
const { recordAffiliateDeposit } = require('../utils/affiliate');

const router = express.Router();

// STK Push simulation (for testing)
router.post('/stk-push',
  authenticateToken,
  [
    body('amount').isNumeric().custom(value => {
      if (value < 10 || value > 150000) {
        throw new Error('Amount must be between KES 10 and KES 150,000');
      }
      return true;
    }),
    body('phoneNumber').matches(/^254[0-9]{9}$/).withMessage('Invalid phone number format')
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

      const { amount, phoneNumber } = req.body;
      const user = await User.findById(req.userId);

      // Create pending transaction
      const transaction = new Transaction({
        user: user._id,
        type: 'deposit',
        amount: parseFloat(amount),
        balanceBefore: user.balance,
        balanceAfter: user.balance, // Will be updated when confirmed
        status: 'pending',
        description: `M-Pesa deposit of KES ${amount}`,
        mpesaPhoneNumber: phoneNumber
      });

      await transaction.save();

      // Simulate STK Push response
      const stkResponse = {
        MerchantRequestID: `MR${Date.now()}`,
        CheckoutRequestID: `CR${Date.now()}`,
        ResponseCode: "0",
        ResponseDescription: "Success. Request accepted for processing",
        CustomerMessage: "Success. Request accepted for processing"
      };

      // Send Telegram notification to admin
      await sendTelegramNotification(
        `💰 STK Push Request!\n\n` +
        `User: ${user.username}\n` +
        `Phone: ${phoneNumber}\n` +
        `Amount: KES ${amount}\n` +
        `Transaction ID: ${transaction.reference}\n` +
        `Time: ${new Date().toLocaleString()}\n\n` +
        `⚠️ Please process this deposit manually through the admin panel.`
      );

      // Send Slack notification for deposit request
      await sendSlackMessage(
        process.env.SLACK_WEBHOOK_DEPOSIT_REQUEST,
        `:moneybag: *Deposit Request*\n` +
        `User: ${user.username}\n` +
        `Phone: ${phoneNumber}\n` +
        `Amount: KES ${amount}\n` +
        `Transaction ID: ${transaction.reference}\n` +
        `Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}\n\n` +
        `⚠️ Please process this deposit manually through the admin panel.`
      );

      res.json({
        message: 'STK Push sent successfully',
        transactionId: transaction.reference,
        merchantRequestId: stkResponse.MerchantRequestID,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        instructions: `Please complete the payment on your phone (${phoneNumber}) and wait for confirmation.`
      });

    } catch (error) {
      console.error('STK Push error:', error);
      res.status(500).json({ error: 'Failed to process STK push request' });
    }
  }
);

// Manual deposit confirmation (Admin only)
router.post('/confirm-deposit',
  authenticateToken,
  async (req, res) => {
    try {
      const { transactionId, mpesaReceiptNumber } = req.body;
      
      // Check if user is admin
      const admin = await User.findById(req.userId);
      if (!admin.isAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
      }

      const transaction = await Transaction.findOne({ reference: transactionId });
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.status !== 'pending') {
        return res.status(400).json({ error: 'Transaction already processed' });
      }

      // Update user balance
      const user = await User.findById(transaction.user);
      user.balance += transaction.amount;
      await user.save();

      try {
        await recordAffiliateDeposit(user, transaction.amount);
      } catch (error) {
        console.error('Affiliate deposit tracking failed:', error.message);
      }

      // Update transaction
      transaction.status = 'completed';
      transaction.balanceAfter = user.balance;
      transaction.mpesaReceiptNumber = mpesaReceiptNumber;
      transaction.processedBy = admin._id;
      transaction.processedAt = new Date();
      await transaction.save();

      // Send confirmation notification
      await sendTelegramNotification(
        `✅ Deposit Confirmed!\n\n` +
        `User: ${user.username}\n` +
        `Amount: KES ${transaction.amount}\n` +
        `New Balance: KES ${user.balance}\n` +
        `M-Pesa Receipt: ${mpesaReceiptNumber}\n` +
        `Processed by: ${admin.username}\n` +
        `Time: ${new Date().toLocaleString()}`
      );

      res.json({
        message: 'Deposit confirmed successfully',
        transaction,
        newBalance: user.balance
      });

    } catch (error) {
      console.error('Deposit confirmation error:', error);
      res.status(500).json({ error: 'Failed to confirm deposit' });
    }
  }
);

// Track deposit tab click
router.post('/deposit-tab-click', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    // Send Slack notification for deposit tab click
    await sendSlackMessage(
      process.env.SLACK_WEBHOOK_DEPOSIT_TAB,
      `:credit_card: *Deposit Tab Accessed*\n` +
      `User: ${user.username}\n` +
      `Phone: ${user.fullPhone || 'N/A'}\n` +
      `Balance: KES ${user.balance.toFixed(2)}\n` +
      `Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Deposit tab click tracking error:', error);
    res.status(500).json({ error: 'Failed to track deposit tab click' });
  }
});

// Get deposit instructions
router.get('/deposit-info', authenticateToken, async (req, res) => {
  try {
    res.json({
      paybillNumber: process.env.PAYBILL_NUMBER,
      accountNumber: process.env.ACCOUNT_NUMBER,
      instructions: [
        '1. Go to M-PESA on your phone',
        '2. Select Lipa na M-PESA',
        '3. Select Pay Bill',
        `4. Enter Business Number: ${process.env.PAYBILL_NUMBER}`,
        `5. Enter Account Number: ${process.env.ACCOUNT_NUMBER}`,
        '6. Enter the amount you want to deposit',
        '7. Enter your M-PESA PIN',
        '8. Confirm the payment',
        '9. Wait for SMS confirmation',
        '10. Your balance will be updated within 5 minutes'
      ],
      minDeposit: 10,
      maxDeposit: 50000
    });
  } catch (error) {
    console.error('Deposit info error:', error);
    res.status(500).json({ error: 'Failed to get deposit information' });
  }
});

module.exports = router;