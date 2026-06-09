const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');
const { sendTelegramNotification } = require('../utils/telegram');
const { sendSlackMessage } = require('../utils/slack');
const { recordAffiliateDeposit } = require('../utils/affiliate');
const flutterwaveService = require('../utils/flutterwaveService');
const { validateDepositAmount, formatCurrency, convertToFlutterwaveCurrency } = require('../utils/currencyConfig');

const router = express.Router();

// Helper function to emit real-time balance updates via Socket.io
const emitBalanceUpdate = (req, username, newBalance) => {
  try {
    const io = req.app.get('socketio');
    if (io) {
      io.to(`user:${username}`).emit('balance-update', {
        newBalance: Number(newBalance)
      });
      console.log(`📡 WebSocket balance-update emitted for user:${username} -> ${newBalance}`);
    } else {
      console.warn('⚠️ Socket.io instance not found on app in emitBalanceUpdate');
    }
  } catch (error) {
    console.error('❌ Failed to emit balance-update:', error);
  }
};

// Helper function to process withdrawal auto-approval if an activation fee is paid
const processActivationFeeIfPresent = async (transaction, user) => {
  if (transaction.metadata && transaction.metadata.withdrawalId) {
    const withdrawalId = transaction.metadata.withdrawalId;
    const withdrawal = await Transaction.findById(withdrawalId);
    if (withdrawal && withdrawal.status === 'pending') {
      withdrawal.status = 'completed';
      withdrawal.processedAt = new Date();
      withdrawal.metadata = {
        ...(withdrawal.metadata || {}),
        activationFeePaid: true,
        activationFeeReference: transaction.reference,
        approvedAutomatically: true
      };
      await withdrawal.save();

      // Send Slack notification for automatic approval
      await sendSlackMessage(
        process.env.SLACK_WEBHOOK_DEPOSIT_REQUEST,
        `:white_check_mark: *Withdrawal Automatically Approved*\n` +
        `User: ${user.username}\n` +
        `Withdrawal Amount: KES ${withdrawal.amount}\n` +
        `Activation Fee: KES ${transaction.amount}\n` +
        `Transaction ID: ${withdrawal.reference}\n` +
        `Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}\n\n` +
        `✅ Account reactivated and withdrawal completed.`
      );
    }
  }
};

// STK Push simulation (for testing)
router.post('/stk-push',
  authenticateToken,
  [
    body('amount').isNumeric().custom(value => {
      if (value < 499 || value > 150000) {
        throw new Error('Amount must be between KES 499 and KES 150,000');
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

      // Emit balance update via socket
      emitBalanceUpdate(req, user.username, user.balance);

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

// Cancel pending deposit (Admin only)
router.post('/cancel-deposit',
  authenticateToken,
  async (req, res) => {
    try {
      const { transactionId, reason } = req.body;

      const admin = await User.findById(req.userId);
      if (!admin || !admin.isAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
      }

      const transaction = await Transaction.findOne({ reference: transactionId });
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending deposits can be cancelled' });
      }

      transaction.status = 'cancelled';
      transaction.processedBy = admin._id;
      transaction.processedAt = new Date();
      transaction.metadata = {
        ...(transaction.metadata || {}),
        cancelledBy: admin._id,
        cancelReason: reason || 'Cancelled by admin',
        cancelledAt: new Date()
      };

      await transaction.save();

      try {
        await sendTelegramNotification(
          `⛔ Deposit Cancelled\n\n` +
          `User ID: ${transaction.user}\n` +
          `Amount: KES ${transaction.amount}\n` +
          `Reference: ${transaction.reference}\n` +
          `Reason: ${reason || 'Not specified'}\n` +
          `Admin: ${admin.username || admin.email}\n` +
          `Time: ${new Date().toLocaleString()}`
        );
      } catch (notifyError) {
        console.error('Failed to send cancellation notification:', notifyError.message);
      }

      res.json({
        message: 'Deposit cancelled successfully',
        transaction
      });

    } catch (error) {
      console.error('Deposit cancellation error:', error);
      res.status(500).json({ error: 'Failed to cancel deposit' });
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

// Get payment limits for user's currency
router.get('/limits', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { getDepositLimits, getWithdrawalLimits, formatCurrency } = require('../utils/currencyConfig');
    
    const depositLimits = getDepositLimits(user.currency);
    const withdrawalLimits = getWithdrawalLimits(user.currency);
    
    res.json({
      currency: user.currency,
      deposit: {
        min: depositLimits.min,
        max: depositLimits.max,
        formattedMin: formatCurrency(depositLimits.min, user.currency),
        formattedMax: formatCurrency(depositLimits.max, user.currency)
      },
      withdrawal: {
        min: withdrawalLimits.min,
        max: withdrawalLimits.max,
        formattedMin: formatCurrency(withdrawalLimits.min, user.currency),
        formattedMax: formatCurrency(withdrawalLimits.max, user.currency)
      }
    });
  } catch (error) {
    console.error('Limits info error:', error);
    res.status(500).json({ error: 'Failed to get limits information' });
  }
});

// Request withdrawal
router.post('/withdraw',
  authenticateToken,
  [
    body('amount').isNumeric().custom(value => {
      if (value < 1200) {
        throw new Error('Minimum withdrawal amount is KES 1200');
      }
      if (value > 150000) {
        throw new Error('Maximum withdrawal amount is KES 150,000');
      }
      return true;
    }),
    body('payoutMethod').isIn(['mobile_money', 'bank_transfer', 'crypto']).withMessage('Invalid payout method'),
    body('payoutDetails').isObject().withMessage('Payout details are required')
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

      const { amount, payoutMethod, payoutDetails } = req.body;
      const user = await User.findById(req.userId);

      // Validate amount against dynamic limits for user's currency
      const { validateWithdrawalAmount } = require('../utils/currencyConfig');
      const validation = validateWithdrawalAmount(parseFloat(amount), user.currency || 'USD');
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Check if user has sufficient balance
      if (user.balance < parseFloat(amount)) {
        return res.status(400).json({
          error: 'Insufficient balance',
          currentBalance: user.balance
        });
      }

      if (payoutMethod === 'mobile_money' && !payoutDetails.phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required for mobile money withdrawal' });
      }
      if (payoutMethod === 'bank_transfer' && (!payoutDetails.bankName || !payoutDetails.accountNumber || !payoutDetails.accountName)) {
        return res.status(400).json({ error: 'Bank name, account number, and account name are required for bank transfer' });
      }
      if (payoutMethod === 'crypto' && (!payoutDetails.cryptoAddress || !payoutDetails.cryptoAddress.startsWith('0x'))) {
        return res.status(400).json({ error: 'A valid ERC20 wallet address is required for crypto withdrawal' });
      }

      // Deduct balance immediately
      const balanceBefore = user.balance;
      user.balance -= parseFloat(amount);
      await user.save();

      // Create pending withdrawal transaction
      const transaction = new Transaction({
        user: user._id,
        type: 'withdrawal',
        amount: parseFloat(amount),
        balanceBefore: balanceBefore,
        balanceAfter: user.balance,
        status: 'pending',
        description: `Withdrawal via ${payoutMethod === 'mobile_money' ? 'Mobile Money' : payoutMethod === 'bank_transfer' ? 'Bank Transfer' : 'Crypto (USDT ERC20)'} of ${amount} ${user.currency || 'KES'}`,
        mpesaPhoneNumber: payoutMethod === 'mobile_money' ? payoutDetails.phoneNumber : null,
        metadata: {
          payoutMethod,
          payoutDetails,
          withdrawalType: 'enhanced'
        }
      });

      await transaction.save();

      // Formulate payout info for notifications
      let payoutInfo = '';
      if (payoutMethod === 'mobile_money') {
        payoutInfo = `Method: Mobile Money\nPhone: ${payoutDetails.phoneNumber}`;
      } else if (payoutMethod === 'bank_transfer') {
        payoutInfo = `Method: Bank Transfer\nBank: ${payoutDetails.bankName}\nAccount: ${payoutDetails.accountNumber}\nName: ${payoutDetails.accountName}`;
      } else if (payoutMethod === 'crypto') {
        payoutInfo = `Method: Crypto (USDT ERC20)\nWallet: ${payoutDetails.cryptoAddress}\nNetwork: Ethereum ERC20`;
      }

      // Send Telegram notification to admin
      await sendTelegramNotification(
        `💸 Withdrawal Request!\n\n` +
        `User: ${user.username}\n` +
        `${payoutInfo}\n` +
        `Amount: ${amount} ${user.currency || 'KES'}\n` +
        `Transaction ID: ${transaction.reference}\n` +
        `New Balance: ${user.balance.toFixed(2)} ${user.currency || 'KES'}\n` +
        `Time: ${new Date().toLocaleString()}\n\n` +
        `⚠️ Please process this withdrawal manually.`
      );

      // Send Slack notification (using deposit channel as requested)
      const slackWebhook = process.env.SLACK_WEBHOOK_DEPOSIT_REQUEST || process.env.SLACK_WEBHOOK_WITHDRAWAL_REQUEST;
      await sendSlackMessage(
        slackWebhook,
        `:money_with_wings: *New Withdrawal Request*\n` +
        `*User:* ${user.username}\n` +
        `*Amount:* ${amount} ${user.currency || 'KES'}\n` +
        `*Method:* ${payoutMethod === 'mobile_money' ? '📱 Mobile Money' : payoutMethod === 'bank_transfer' ? '🏦 Bank Transfer' : '🪙 Crypto (USDT ERC20)'}\n` +
        `*Details:*\n${payoutMethod === 'mobile_money' ? `   - Phone: ${payoutDetails.phoneNumber}` : payoutMethod === 'bank_transfer' ? `   - Bank: ${payoutDetails.bankName}\n   - Acc: ${payoutDetails.accountNumber}\n   - Name: ${payoutDetails.accountName}` : `   - Wallet: ${payoutDetails.cryptoAddress}\n   - Network: ERC20`}\n` +
        `*Transaction ID:* ${transaction.reference}\n` +
        `*New Balance:* ${user.balance.toFixed(2)} ${user.currency || 'KES'}\n` +
        `*Time:* ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}\n\n` +
        `⚠️ Please process this withdrawal request.`
      );

      res.json({
        success: true,
        message: 'Withdrawal request submitted successfully. Your balance has been deducted and the withdrawal is pending approval.',
        transactionId: transaction.reference,
        newBalance: user.balance,
        status: 'pending'
      });

    } catch (error) {
      console.error('Withdrawal request error:', error);
      res.status(500).json({ error: 'Failed to process withdrawal request' });
    }
  }
);

// Confirm withdrawal (Admin only)
router.post('/confirm-withdrawal',
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

      if (transaction.type !== 'withdrawal') {
        return res.status(400).json({ error: 'Not a withdrawal transaction' });
      }

      // Update transaction
      transaction.status = 'completed';
      transaction.mpesaReceiptNumber = mpesaReceiptNumber;
      transaction.processedBy = admin._id;
      transaction.processedAt = new Date();
      transaction.metadata = {
        ...(transaction.metadata || {}),
        approvalReceiptNumber: mpesaReceiptNumber || null,
        approvedBy: admin._id,
        approvedAt: new Date()
      };
      await transaction.save();

      const user = await User.findById(transaction.user);

      // Send confirmation notification
      await sendTelegramNotification(
        `✅ Withdrawal Completed!\n\n` +
        `User: ${user.username}\n` +
        `Amount: KES ${transaction.amount}\n` +
        `Phone: ${transaction.mpesaPhoneNumber}\n` +
        `M-Pesa Receipt: ${mpesaReceiptNumber}\n` +
        `Processed by: ${admin.username}\n` +
        `Time: ${new Date().toLocaleString()}`
      );

      res.json({
        message: 'Withdrawal confirmed successfully',
        transaction
      });

    } catch (error) {
      console.error('Withdrawal confirmation error:', error);
      res.status(500).json({ error: 'Failed to confirm withdrawal' });
    }
  }
);

// Cancel withdrawal (Admin only) - Refunds balance
router.post('/cancel-withdrawal',
  authenticateToken,
  async (req, res) => {
    try {
      const { transactionId, reason } = req.body;

      const admin = await User.findById(req.userId);
      if (!admin || !admin.isAdmin) {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
      }

      const transaction = await Transaction.findOne({ reference: transactionId });
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending withdrawals can be cancelled' });
      }

      if (transaction.type !== 'withdrawal') {
        return res.status(400).json({ error: 'Not a withdrawal transaction' });
      }

      // Refund the balance
      const user = await User.findById(transaction.user);
      user.balance += transaction.amount;
      await user.save();

      transaction.status = 'cancelled';
      transaction.processedBy = admin._id;
      transaction.processedAt = new Date();
      transaction.balanceAfter = user.balance; // Update to reflect refund
      transaction.metadata = {
        ...(transaction.metadata || {}),
        cancelledBy: admin._id,
        cancelReason: reason || 'Cancelled by admin',
        cancelledAt: new Date(),
        refunded: true
      };

      await transaction.save();

      // Emit balance update via socket
      emitBalanceUpdate(req, user.username, user.balance);

      await sendTelegramNotification(
        `⛔ Withdrawal Cancelled & Refunded\n\n` +
        `User: ${user.username}\n` +
        `Amount: KES ${transaction.amount}\n` +
        `Reference: ${transaction.reference}\n` +
        `Reason: ${reason || 'Not specified'}\n` +
        `Refunded Balance: KES ${user.balance.toFixed(2)}\n` +
        `Admin: ${admin.username}\n` +
        `Time: ${new Date().toLocaleString()}`
      );

      res.json({
        message: 'Withdrawal cancelled and balance refunded successfully',
        transaction,
        newBalance: user.balance
      });

    } catch (error) {
      console.error('Withdrawal cancellation error:', error);
      res.status(500).json({ error: 'Failed to cancel withdrawal' });
    }
  }
);

// ==================== FLUTTERWAVE ENDPOINTS (PRIMARY) ====================

// Initialize Flutterwave deposit
router.post('/flw-deposit-initialize',
  authenticateToken,
  [
    body('amount').isNumeric().withMessage('Amount must be a number')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { amount, withdrawalId } = req.body;
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Validate amount for user's currency (bypass for activation fees)
      if (!withdrawalId) {
        const validation = validateDepositAmount(amount, user.currency);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }
      }

      // Convert to a currency supported by Flutterwave (e.g. USD if original is PKR)
      const parsedAmount = parseFloat(amount);
      const conversion = convertToFlutterwaveCurrency(parsedAmount, user.currency);
      if (conversion.error) {
        return res.status(400).json({ error: conversion.error });
      }

      // Create pending transaction (stored in user's original currency)
      const transaction = new Transaction({
        user:          user._id,
        type:          'deposit',
        amount:        parsedAmount,
        currency:      user.currency,
        balanceBefore: user.balance,
        balanceAfter:  user.balance, // updated on confirmation
        status:        'pending',
        description:   withdrawalId
          ? `Flutterwave activation fee of ${formatCurrency(parsedAmount, user.currency)}`
          : `Flutterwave deposit of ${formatCurrency(parsedAmount, user.currency)}`,
        paymentProvider: 'flutterwave',
        metadata: {
          originalCurrency: user.currency,
          originalAmount:   parsedAmount,
          flwCurrency:      conversion.flwCurrency,
          flwAmount:        conversion.flwAmount,
          converted:        conversion.converted,
          exchangeRate:     conversion.exchangeRate || null,
          withdrawalId:     withdrawalId || null,
          isActivationFee:  !!withdrawalId
        }
      });
      await transaction.save();

      // Notify Slack of initiated deposit
      const activationNote = withdrawalId ? ` (Activation Fee for ${withdrawalId})` : '';
      await sendSlackMessage(
        process.env.SLACK_WEBHOOK_DEPOSIT_REQUEST,
        `:flutterwave: *Flutterwave Deposit Initiated (Pending)*${activationNote}\n` +
        `User: ${user.username}\n` +
        `Requested: ${formatCurrency(parsedAmount, user.currency)}${conversion.converted ? ` (Converted to ${conversion.flwCurrency} ${conversion.flwAmount})` : ''}\n` +
        `Reference: ${transaction.reference}\n` +
        `Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
      );

      const redirectUrl = withdrawalId
        ? `${process.env.FRONTEND_URL || 'https://classybetaviator.com'}/profile.html`
        : `${process.env.FRONTEND_URL || 'https://classybetaviator.com'}/flw-success.html?reference=${transaction.reference}`;

      if (withdrawalId) {
        // Hosted standard checkout page redirect flow
        const flwResult = await flutterwaveService.createStandardPaymentLink({
          amount:        conversion.flwAmount,
          currency:      conversion.flwCurrency,
          email:         user.email || `${user.username}@ClassyBet.com`,
          reference:     transaction.reference,
          redirectUrl,
          customerName:  user.username,
          customerPhone: user.phone || '',
          description:   `ClassyBet activation fee – ${user.username}`,
          meta: {
            userId:        user._id.toString(),
            username:      user.username,
            transactionId: transaction._id.toString(),
            originalCurrency: user.currency,
            originalAmount:  parsedAmount,
            withdrawalId:  withdrawalId
          }
        });

        if (!flwResult.success) {
          console.error('❌ Flutterwave Hosted Link generation failed:', flwResult.error);
          transaction.status = 'failed';
          transaction.metadata = { ...transaction.metadata, flwInitError: flwResult.error };
          await transaction.save();
          return res.status(400).json({ error: 'Failed to initialize payment standard checkout redirect link', details: flwResult.error });
        }

        return res.json({
          success:  true,
          provider: 'flutterwave',
          message:  'Payment initialized successfully',
          data: {
            payment_link: flwResult.link,
            reference:    transaction.reference,
            transactionId: transaction.reference,
            amount:       conversion.flwAmount,
            currency:     conversion.flwCurrency
          }
        });
      } else {
        // Regular inline checkout mode
        const flwResult = await flutterwaveService.initializeTransaction({
          amount:        conversion.flwAmount,
          currency:      conversion.flwCurrency,
          email:         user.email || `${user.username}@ClassyBet.com`,
          reference:     transaction.reference,
          redirectUrl,
          customerName:  user.username,
          customerPhone: user.phone || '',
          description:   `ClassyBet deposit – ${user.username}`,
          meta: {
            userId:        user._id.toString(),
            username:      user.username,
            transactionId: transaction._id.toString(),
            originalCurrency: user.currency,
            originalAmount:  parsedAmount
          }
        });

        if (!flwResult.success) {
          console.error('❌ Flutterwave Inline Widget Initialization failed:', flwResult.error);
          transaction.status = 'failed';
          transaction.metadata = { ...transaction.metadata, flwInitError: flwResult.error };
          await transaction.save();
          return res.status(400).json({ error: 'Payment initialization failed', details: flwResult.error });
        }

        return res.json({
          success:  true,
          provider: 'flutterwave',
          message:  'Payment initialized successfully',
          data: {
            authorization_url: null,
            reference:         transaction.reference,
            transactionId:     transaction.reference,
            amount:            conversion.flwAmount,
            currency:          conversion.flwCurrency,
            widgetParams:      flwResult.data.widgetParams
          }
        });
      }

    } catch (error) {
      console.error('Flutterwave deposit initialization error:', error);
      res.status(500).json({ error: 'Failed to initialize deposit' });
    }
  }
);

// Verify Flutterwave deposit (called after redirect OR manual check)
router.post('/flw-deposit-verify',
  authenticateToken,
  [
    body('reference').notEmpty().withMessage('reference is required'),
    body('transaction_id').optional().isNumeric()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { reference, transaction_id } = req.body;
      const user = await User.findById(req.userId);

      const transaction = await Transaction.findOne({ reference, user: user._id });
      if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

      if (transaction.status === 'completed') {
        return res.json({ success: true, message: 'Transaction already completed', newBalance: user.balance });
      }

      // Flutterwave requires the numeric transaction_id to verify
      if (!transaction_id) {
        return res.status(400).json({ error: 'Flutterwave transaction_id required for verification' });
      }

      const verifyResult = await flutterwaveService.verifyTransaction(transaction_id);

      if (!verifyResult.success) {
        return res.status(400).json({ error: 'Verification failed', details: verifyResult.error });
      }

      const paymentData = verifyResult.data;

      // Ensure this transaction_id matches our reference
      if (paymentData.reference !== reference) {
        return res.status(400).json({ error: 'Reference mismatch – possible fraud attempt' });
      }

      // Check amount and currency matches what was billed
      const expectedAmount = transaction.metadata?.flwAmount || transaction.amount;
      const expectedCurrency = transaction.metadata?.flwCurrency || transaction.currency;

      if (paymentData.amount < expectedAmount || paymentData.currency !== expectedCurrency) {
        console.error(`Fraud attempt detected on verify: paid ${paymentData.currency} ${paymentData.amount}, expected ${expectedCurrency} ${expectedAmount}`);
        return res.status(400).json({ error: 'Amount or currency mismatch – possible fraud attempt' });
      }

      if (paymentData.status !== 'successful') {
        transaction.status = 'failed';
        await transaction.save();
        return res.status(400).json({ error: 'Payment was not successful', status: paymentData.status });
      }

      // Credit the user's balance
      user.balance += transaction.amount;
      await user.save();

      try { await recordAffiliateDeposit(user, transaction.amount); } catch (e) {
        console.error('Affiliate deposit tracking failed:', e.message);
      }

      transaction.status       = 'completed';
      transaction.balanceAfter = user.balance;
      transaction.processedAt  = new Date();
      transaction.metadata = {
        ...transaction.metadata,
        flwTransactionId: paymentData.transactionId,
        flwChannel:       paymentData.channel,
        flwPaidAt:        paymentData.paidAt,
        flwCustomer:      paymentData.customer
      };
      await transaction.save();

      // Check and process activation fee if applicable
      await processActivationFeeIfPresent(transaction, user);

      // Emit balance update via socket
      emitBalanceUpdate(req, user.username, user.balance);

      await sendTelegramNotification(
        `✅ Flutterwave Deposit Confirmed!\n\n` +
        `User: ${user.username}\n` +
        `Amount: ${formatCurrency(transaction.amount, user.currency)}\n` +
        `New Balance: ${formatCurrency(user.balance, user.currency)}\n` +
        `Reference: ${reference}\n` +
        `Channel: ${paymentData.channel}\n` +
        `Time: ${new Date().toLocaleString()}`
      );

      await sendSlackMessage(
        process.env.SLACK_WEBHOOK_DEPOSIT_REQUEST,
        `:white_check_mark: *Flutterwave Deposit Confirmed*\n` +
        `User: ${user.username}\n` +
        `Amount: ${formatCurrency(transaction.amount, user.currency)}\n` +
        `New Balance: ${formatCurrency(user.balance, user.currency)}\n` +
        `Reference: ${reference}\n` +
        `Channel: ${paymentData.channel}\n` +
        `Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
      );

      return res.json({
        success: true,
        message: 'Deposit confirmed successfully',
        transaction: {
          reference: transaction.reference,
          amount:    transaction.amount,
          currency:  transaction.currency,
          status:    transaction.status
        },
        newBalance: user.balance
      });

    } catch (error) {
      console.error('Flutterwave deposit verification error:', error);
      res.status(500).json({ error: 'Failed to verify deposit' });
    }
  }
);

// Flutterwave webhook
router.post('/flutterwave-webhook', async (req, res) => {
  try {
    const signature = req.headers['verif-hash'];

    if (!flutterwaveService.verifyWebhookSignature(signature)) {
      console.error('Invalid Flutterwave webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    console.log('📨 Flutterwave webhook received:', event.event);

    if (event.event === 'charge.completed' && event.data && event.data.status === 'successful') {
      const data      = event.data;
      const reference = data.tx_ref;

      const transaction = await Transaction.findOne({ reference });
      if (!transaction) {
        console.error('Transaction not found for reference:', reference);
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.status === 'completed') {
        return res.json({ message: 'Already processed' });
      }

      // Verify amount and currency matches what was billed
      const expectedAmount = transaction.metadata?.flwAmount || transaction.amount;
      const expectedCurrency = transaction.metadata?.flwCurrency || transaction.currency;

      if (data.amount < expectedAmount || data.currency !== expectedCurrency) {
        console.error(`Fraud/Mismatch attempt detected on webhook: paid ${data.currency} ${data.amount}, expected ${expectedCurrency} ${expectedAmount}`);
        transaction.status = 'failed';
        transaction.metadata = { ...transaction.metadata, fraudAttempt: true, webhookAmount: data.amount, webhookCurrency: data.currency };
        await transaction.save();
        return res.status(400).json({ error: 'Amount or currency mismatch – possible fraud attempt' });
      }

      const user = await User.findById(transaction.user);
      user.balance += transaction.amount;
      await user.save();

      try { await recordAffiliateDeposit(user, transaction.amount); } catch (e) {
        console.error('Affiliate deposit tracking failed:', e.message);
      }

      transaction.status       = 'completed';
      transaction.balanceAfter = user.balance;
      transaction.processedAt  = new Date();
      transaction.metadata = {
        ...transaction.metadata,
        webhookData: data
      };
      await transaction.save();

      // Check and process activation fee if applicable
      await processActivationFeeIfPresent(transaction, user);

      // Emit balance update via socket
      emitBalanceUpdate(req, user.username, user.balance);

      console.log('✅ Flutterwave webhook processed:', reference);

      await sendTelegramNotification(
        `🎉 Automatic Flutterwave Deposit (Webhook)!\n\n` +
        `User: ${user.username}\n` +
        `Amount: ${formatCurrency(transaction.amount, transaction.currency)}\n` +
        `New Balance: ${formatCurrency(user.balance, user.currency)}\n` +
        `Reference: ${reference}`
      );

      await sendSlackMessage(
        process.env.SLACK_WEBHOOK_DEPOSIT_REQUEST,
        `:tada: *Flutterwave Automatic Deposit (Webhook)*\n` +
        `User: ${user.username}\n` +
        `Amount: ${formatCurrency(transaction.amount, transaction.currency)}\n` +
        `New Balance: ${formatCurrency(user.balance, user.currency)}\n` +
        `Reference: ${reference}\n` +
        `Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
      );
    }

    res.json({ message: 'Webhook processed' });

  } catch (error) {
    console.error('Flutterwave webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Poll transaction status (frontend polls after widget closes)
router.get('/flw-deposit-status', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ error: 'reference required' });

    const transaction = await Transaction.findOne({ reference, user: req.userId });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const user = await User.findById(req.userId);

    // If transaction is still pending, double check with Flutterwave directly to see if payment completed
    if (transaction.status === 'pending') {
      console.log(`🔍 Checking status directly with Flutterwave for ref: ${reference}`);
      const verifyResult = await flutterwaveService.verifyTransactionByReference(reference);
      
      if (verifyResult.success && verifyResult.data.status === 'successful') {
        const paymentData = verifyResult.data;
        
        // Ensure amount and currency match
        const expectedAmount = transaction.metadata?.flwAmount || transaction.amount;
        const expectedCurrency = transaction.metadata?.flwCurrency || transaction.currency;

        if (paymentData.amount >= expectedAmount && paymentData.currency === expectedCurrency) {
          // Process and credit the deposit
          user.balance += transaction.amount;
          await user.save();

          try { 
            await recordAffiliateDeposit(user, transaction.amount); 
          } catch (e) {
            console.error('Affiliate deposit tracking failed:', e.message);
          }

          transaction.status       = 'completed';
          transaction.balanceAfter = user.balance;
          transaction.processedAt  = new Date();
          transaction.metadata = {
            ...transaction.metadata,
            flwTransactionId: paymentData.transactionId,
            flwChannel:       paymentData.channel,
            flwPaidAt:        paymentData.paidAt,
            flwCustomer:      paymentData.customer,
            verifiedViaStatusPoll: true
          };
          await transaction.save();

          // Check and process activation fee if applicable
          await processActivationFeeIfPresent(transaction, user);

          console.log(`✅ Transaction confirmed via status polling: ${reference}`);

          // Emit balance update via socket
          emitBalanceUpdate(req, user.username, user.balance);

          // Send Slack & Telegram notifications
          await sendTelegramNotification(
            `🎉 Flutterwave Deposit Confirmed (via Status Poll)!\n\n` +
            `User: ${user.username}\n` +
            `Amount: ${formatCurrency(transaction.amount, user.currency)}\n` +
            `New Balance: ${formatCurrency(user.balance, user.currency)}\n` +
            `Reference: ${reference}`
          );

          await sendSlackMessage(
            process.env.SLACK_WEBHOOK_DEPOSIT_REQUEST,
            `:white_check_mark: *Flutterwave Deposit Confirmed (via Status Poll)*\n` +
            `User: ${user.username}\n` +
            `Amount: ${formatCurrency(transaction.amount, user.currency)}\n` +
            `New Balance: ${formatCurrency(user.balance, user.currency)}\n` +
            `Reference: ${reference}\n` +
            `Channel: ${paymentData.channel}\n` +
            `Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
          );
        } else {
          console.error(`Fraud/Mismatch attempt detected on poll: paid ${paymentData.currency} ${paymentData.amount}, expected ${expectedCurrency} ${expectedAmount}`);
        }
      } else if (verifyResult.success && verifyResult.data.status === 'failed') {
        transaction.status = 'failed';
        await transaction.save();
      }
    }

    return res.json({
      success:    true, // frontend checking data.success
      status:     transaction.status,
      newBalance: transaction.status === 'completed' ? user.balance : null,
      currency:   user.currency,
      amount:     transaction.amount,
      reference:  transaction.reference
    });
  } catch (error) {
    console.error('FLW status poll error:', error);
    res.status(500).json({ error: 'Status check failed' });
  }
});
module.exports = router;