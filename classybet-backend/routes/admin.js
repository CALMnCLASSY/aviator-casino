const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult, query } = require('express-validator');

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Bet = require('../models/Bet');
const Referral = require('../models/Referral');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { connectToMongoDB } = require('../utils/database');
const { sendTelegramNotification } = require('../utils/telegram');
const { sendSlackMessage } = require('../utils/slack');

const router = express.Router();

// Ensure database connection (important for serverless environments)
router.use(async (req, res, next) => {
  try {
    await connectToMongoDB();
    next();
  } catch (error) {
    console.error('Admin DB connection error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Admin login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { email, password } = req.body;
      const admin = await User.findOne({ email, isAdmin: true });

      if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Temporarily disable isActive check for admin login
      // if (!admin.isActive) {
      //   return res.status(403).json({ error: 'Account is suspended' });
      // }

      const passwordValid = await bcrypt.compare(password, admin.password);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        {
          userId: admin._id,
          isAdmin: true,
          email: admin.email
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      await sendSlackMessage(
        process.env.SLACK_WEBHOOK_ADMIN_LOGIN,
        `:shield: *Admin Login*\nEmail: ${admin.email}\nTime: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
      );

      res.json({
        token,
        admin: {
          id: admin._id,
          email: admin.email,
          username: admin.username
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Verify admin token
router.get('/verify', authenticateToken, requireAdmin, (req, res) => {
  const adminId = req.user._id || req.user.id || req.userId;

  res.json({
    message: 'Token valid',
    admin: {
      id: adminId,
      email: req.user.email,
      username: req.user.username
    }
  });
});

// Dashboard statistics
router.get('/dashboard-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalBalanceAgg = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);
    const totalBalance = totalBalanceAgg[0]?.total || 0;

    const totalBets = await Bet.countDocuments();
    const totalTransactions = await Transaction.countDocuments();
    const pendingDeposits = await Transaction.countDocuments({ type: 'deposit', status: 'pending' });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayRegistrations = await User.countDocuments({ createdAt: { $gte: todayStart } });
    const todayTransactionStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);

    const affiliateStatsAgg = await User.aggregate([
      { $match: { isAffiliate: true } },
      {
        $group: {
          _id: null,
          affiliates: { $sum: 1 },
          totalPendingPayout: { $sum: { $ifNull: ['$affiliateStats.pendingPayout', 0] } },
          totalAffiliateBalance: { $sum: { $ifNull: ['$affiliateStats.affiliateBalance', 0] } },
          totalTrackedDeposits: { $sum: { $ifNull: ['$affiliateStats.totalDeposits', 0] } },
          totalTrackedLosses: { $sum: { $ifNull: ['$affiliateStats.totalLosses', 0] } },
          totalReferredUsers: { $sum: { $ifNull: ['$affiliateStats.referredUsers', 0] } }
        }
      }
    ]);

    const referralStatsAgg = await Referral.aggregate([
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          totalDeposits: { $sum: '$depositTotal' },
          totalLosses: { $sum: '$lossTotal' },
          totalCommission: { $sum: '$commissionEarned' }
        }
      }
    ]);

    const topAffiliates = await Referral.aggregate([
      {
        $group: {
          _id: '$affiliate',
          referredUsers: { $sum: 1 },
          totalDeposits: { $sum: '$depositTotal' },
          totalLosses: { $sum: '$lossTotal' },
          totalCommission: { $sum: '$commissionEarned' }
        }
      },
      { $sort: { totalCommission: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'affiliate'
        }
      },
      { $unwind: '$affiliate' },
      {
        $project: {
          _id: 0,
          affiliateId: '$_id',
          username: '$affiliate.username',
          email: '$affiliate.email',
          promoCode: '$affiliate.promoCode',
          referredUsers: 1,
          totalDeposits: 1,
          totalLosses: 1,
          totalCommission: 1,
          pendingPayout: { $ifNull: ['$affiliate.affiliateStats.pendingPayout', 0] }
        }
      }
    ]);

    const affiliateStats = affiliateStatsAgg[0] || {};
    const referralStats = referralStatsAgg[0] || {};

    res.json({
      totalUsers,
      activeUsers,
      totalBets,
      totalTransactions,
      totalBalance,
      pendingDeposits,
      todayRegistrations,
      todayTransactions: todayTransactionStats,
      affiliateSummary: {
        affiliates: affiliateStats.affiliates || 0,
        totalReferredUsers: affiliateStats.totalReferredUsers || 0,
        totalTrackedDeposits: affiliateStats.totalTrackedDeposits || 0,
        totalTrackedLosses: affiliateStats.totalTrackedLosses || 0,
        totalAffiliateBalance: affiliateStats.totalAffiliateBalance || 0,
        totalPendingPayout: affiliateStats.totalPendingPayout || 0,
        totalReferrals: referralStats.totalReferrals || 0,
        totalReferralDeposits: referralStats.totalDeposits || 0,
        totalReferralLosses: referralStats.totalLosses || 0,
        totalReferralCommission: referralStats.totalCommission || 0
      },
      topAffiliates
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Pending deposit transactions
router.get('/transactions/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const transactions = await Transaction.find({ type: 'deposit', status: 'pending' })
      .populate('user', 'username email balance')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ transactions });
  } catch (error) {
    console.error('Pending transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch pending transactions' });
  }
});

// Pending withdrawal transactions
router.get('/transactions/pending-withdrawals', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const transactions = await Transaction.find({ type: 'withdrawal', status: 'pending' })
      .populate('user', 'username email balance phone')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ transactions });
  } catch (error) {
    console.error('Pending withdrawals error:', error);
    res.status(500).json({ error: 'Failed to fetch pending withdrawals' });
  }
});

// Detailed affiliate data with referrals
router.get('/affiliates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const referrals = await Referral.find()
      .populate('affiliate', 'username email promoCode affiliateStats')
      .populate('referredUser', 'username balance email createdAt');

    const affiliatesMap = new Map();

    referrals.forEach(ref => {
      if (!ref.affiliate) {
        return;
      }

      const affiliateId = ref.affiliate._id.toString();
      if (!affiliatesMap.has(affiliateId)) {
        affiliatesMap.set(affiliateId, {
          _id: affiliateId,
          username: ref.affiliate.username,
          email: ref.affiliate.email,
          promoCode: ref.affiliate.promoCode,
          totalDeposits: 0,
          totalLosses: 0,
          totalCommission: 0,
          pendingPayout: ref.affiliate.affiliateStats?.pendingPayout || 0,
          affiliateBalance: ref.affiliate.affiliateStats?.affiliateBalance || 0,
          referredUsers: 0,
          referredUsersList: []
        });
      }

      const affiliateEntry = affiliatesMap.get(affiliateId);
      const depositTotal = ref.depositTotal || 0;
      const lossTotal = ref.lossTotal || 0;
      const commission = depositTotal * 0.5;

      affiliateEntry.totalDeposits += depositTotal;
      affiliateEntry.totalLosses += lossTotal;
      affiliateEntry.totalCommission += commission;
      affiliateEntry.referredUsers += 1;

      affiliateEntry.referredUsersList.push({
        username: ref.referredUser?.username || 'Unknown',
        email: ref.referredUser?.email || null,
        totalDeposits: depositTotal,
        totalLosses: lossTotal,
        joinedAt: ref.joinedAt
      });
    });

    const affiliates = Array.from(affiliatesMap.values()).sort((a, b) => b.totalDeposits - a.totalDeposits);

    res.json({ affiliates });

  } catch (error) {
    console.error('Affiliate list error:', error);
    res.status(500).json({ error: 'Failed to fetch affiliates' });
  }
});

// Fetch latest users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Search users
router.get(
  '/users/search',
  authenticateToken,
  requireAdmin,
  [query('q').trim().notEmpty().withMessage('Search query is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const searchTerm = req.query.q;
      const regex = new RegExp(searchTerm, 'i');

      const users = await User.find({
        $or: [
          { username: regex },
          { email: regex },
          { phone: regex },
          { userId: regex }
        ]
      })
        .select('-password')
        .limit(50);

      res.json({ users });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  }
);

// Toggle user active status
router.post('/users/:userId/toggle-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isActive = !user.isActive;
    await user.save();

    await sendTelegramNotification(
      `⚠️ User status changed\n\nUser: ${user.username}\nStatus: ${user.isActive ? 'Activated' : 'Deactivated'}\nTime: ${new Date().toISOString()}`
    );

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        username: user.username,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

// Manual balance adjustments
router.post('/users/:userId/balance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { amount, type, description } = req.body;

    if (!amount || !type || !description) {
      return res.status(400).json({ error: 'Amount, type, and description are required' });
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const balanceBefore = user.balance;
    let balanceAfter = balanceBefore;

    if (type === 'add') {
      balanceAfter += numericAmount;
    } else if (type === 'subtract') {
      if (balanceBefore < numericAmount) {
        return res.status(400).json({ error: 'Insufficient user balance' });
      }
      balanceAfter -= numericAmount;
    } else {
      return res.status(400).json({ error: 'Invalid balance adjustment type' });
    }

    user.balance = balanceAfter;
    await user.save();

    const transaction = await Transaction.create({
      user: user._id,
      type: type === 'add' ? 'bonus' : 'withdrawal',
      amount: numericAmount,
      balanceBefore,
      balanceAfter,
      status: 'completed',
      description,
      processedBy: req.user.id,
      processedAt: new Date(),
      metadata: { source: 'admin-panel' }
    });

    await sendSlackMessage(
      process.env.SLACK_WEBHOOK_ADMIN_BALANCE,
      `:money_with_wings: *Admin Balance Update*\nUser: ${user.username}\nAction: ${type === 'add' ? 'Credit' : 'Debit'}\nAmount: KES ${numericAmount}\nNew Balance: KES ${balanceAfter}\nDescription: ${description}\nAdmin: ${req.user.username || req.user.email}`
    );

    res.json({
      message: 'Balance updated successfully',
      user: {
        id: user._id,
        balance: balanceAfter
      },
      transaction
    });
  } catch (error) {
    console.error('Balance update error:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

module.exports = router;