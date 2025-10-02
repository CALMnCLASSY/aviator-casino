const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Bet = require('../models/Bet');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { connectToMongoDB } = require('../utils/database');

const router = express.Router();

// Admin login route
router.post('/login', async (req, res) => {
  try {
    console.log('Admin login attempt started');
    console.log('Request body:', req.body);
    
    await connectToMongoDB();
    console.log('Database connected successfully');
    
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('Searching for user with email:', email.toLowerCase());
    
    // Find admin user
    let user = await User.findOne({ email: email.toLowerCase() });
    console.log('User found:', user ? 'Yes' : 'No');
    
    // If no user found, try to create default admin if this is the expected admin email
    if (!user && email.toLowerCase() === 'admin@classybet.com') {
      console.log('Creating default admin user...');
      try {
        user = new User({
          username: 'admin',
          email: 'admin@classybet.com',
          password: password, // Use the provided password
          phone: '254700000000',
          isAdmin: true,
          balance: 0
        });
        await user.save();
        console.log('Default admin user created');
      } catch (createError) {
        console.error('Error creating admin user:', createError);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }
    
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('User isAdmin:', user.isAdmin);
    
    // Check if user is admin
    if (!user.isAdmin) {
      console.log('User is not admin');
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    console.log('Verifying password...');
    
    // Verify password using the user model method
    const validPassword = await user.comparePassword(password);
    console.log('Password valid:', validPassword);
    
    if (!validPassword) {
      console.log('Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Generating JWT token...');
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        isAdmin: user.isAdmin 
      },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );

    console.log('Admin login successful');

    res.json({
      message: 'Admin login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error('Admin login error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Server error during admin login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all users (Admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments();

    // Return array directly for the management.html compatibility
    if (req.query.simple === 'true') {
      res.json(users);
    } else {
      res.json({
        users,
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers
      });
    }
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details (Admin only)
router.get('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's transaction history
    const transactions = await Transaction.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get user's betting history
    const bets = await Bet.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      user,
      recentTransactions: transactions,
      recentBets: bets
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user balance (Admin only)
router.post('/users/:userId/balance', 
  authenticateToken, 
  requireAdmin,
  async (req, res) => {
    try {
      const { amount, type, description } = req.body;
      const userId = req.params.userId;

      if (!amount || !type || !description) {
        return res.status(400).json({ error: 'Amount, type, and description are required' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const admin = await User.findById(req.userId);
      const oldBalance = user.balance;
      
      if (type === 'add') {
        user.balance += parseFloat(amount);
      } else if (type === 'subtract') {
        user.balance = Math.max(0, user.balance - parseFloat(amount));
      } else {
        return res.status(400).json({ error: 'Invalid type. Use "add" or "subtract"' });
      }

      await user.save();

      // Create transaction record
      const transaction = new Transaction({
        user: user._id,
        type: type === 'add' ? 'bonus' : 'withdrawal',
        amount: parseFloat(amount),
        balanceBefore: oldBalance,
        balanceAfter: user.balance,
        status: 'completed',
        description: `Admin ${type}: ${description}`,
        processedBy: admin._id,
        processedAt: new Date()
      });

      await transaction.save();

      res.json({
        message: `Balance ${type === 'add' ? 'added' : 'subtracted'} successfully`,
        user: user.getPublicProfile(),
        transaction
      });

    } catch (error) {
      console.error('Update balance error:', error);
      res.status(500).json({ error: 'Failed to update balance' });
    }
  }
);

// Toggle user status (Admin only)
router.post('/users/:userId/toggle-status', 
  authenticateToken, 
  requireAdmin,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.isActive = !user.isActive;
      await user.save();

      res.json({
        message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
        user: user.getPublicProfile()
      });

    } catch (error) {
      console.error('Toggle user status error:', error);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  }
);

// Get all transactions (Admin only)
router.get('/transactions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get pending transactions (Admin only)
router.get('/transactions/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    
    const pendingTransactions = await Transaction.find({ status: 'pending' })
      .populate('user', 'username email phone')
      .sort({ createdAt: -1 });

    res.json(pendingTransactions);
  } catch (error) {
    console.error('Get pending transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch pending transactions' });
  }
});

// Get dashboard stats (Admin only)
router.get('/dashboard-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalBalance = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);

    const totalBets = await Bet.countDocuments();
    const totalTransactions = await Transaction.countDocuments();

    const pendingDeposits = await Transaction.countDocuments({ 
      type: 'deposit', 
      status: 'pending' 
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayRegistrations = await User.countDocuments({ 
      createdAt: { $gte: todayStart } 
    });

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

    res.json({
      totalUsers,
      activeUsers,
      totalBets,
      totalTransactions,
      totalBalance: totalBalance[0]?.total || 0,
      pendingDeposits,
      todayRegistrations,
      todayTransactions: todayTransactionStats
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

module.exports = router;