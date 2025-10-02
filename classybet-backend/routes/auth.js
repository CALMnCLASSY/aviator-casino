const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Bet = require('../models/Bet');
const { sendTelegramNotification } = require('../utils/telegram');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many attempts, please try again later' }
});

// Register
router.post('/register', 
  authLimiter,
  [
    body('username')
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-20 characters and contain only letters, numbers, and underscores'),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone')
      .matches(/^[0-9]{9,15}$/)
      .withMessage('Phone number must be 9-15 digits'),
    body('countryCode')
      .matches(/^\+[1-9][0-9]{0,3}$/)
      .withMessage('Invalid country code format')
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

      const { username, email, password, phone, countryCode } = req.body;
      const fullPhone = `${countryCode}${phone}`;

      // Check if user already exists
      const existingQuery = [{ username }, { fullPhone }];
      if (email) {
        existingQuery.push({ email });
      }
      
      const existingUser = await User.findOne({
        $or: existingQuery
      });

      if (existingUser) {
        return res.status(400).json({ 
          error: 'User already exists with this email, username, or phone number' 
        });
      }

      // Create new user
      const user = new User({
        username,
        email: email || null,
        password,
        phone,
        countryCode
      });

      await user.save();

      // Generate JWT
      const token = jwt.sign(
        { 
          userId: user._id,
          userIdString: user.userId,
          isDemo: user.isDemo || false
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Send Telegram notification
      await sendTelegramNotification(
        `🆕 New Registration!\n\n` +
        `User ID: ${user.userId}\n` +
        `Username: ${username}\n` +
        `Email: ${email || 'Not provided'}\n` +
        `Phone: ${fullPhone}\n` +
        `Country: ${countryCode}\n` +
        `Demo User: ${user.isDemo ? 'Yes' : 'No'}\n` +
        `Time: ${new Date().toLocaleString()}`
      );

      res.status(201).json({
        message: 'Registration successful',
        token,
        user: user.getPublicProfile()
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Demo session
router.post('/demo', async (req, res) => {
  try {
    const demoUser = User.createDemoSession();
    
    // Generate JWT for demo session (shorter expiry)
    const token = jwt.sign(
      { 
        userId: demoUser._id,
        isDemo: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' } // Demo sessions expire in 1 day
    );

    res.json({
      message: 'Demo session created',
      token,
      user: demoUser
    });

  } catch (error) {
    console.error('Demo session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login',
  authLimiter,
  [
    body('login').notEmpty().withMessage('Username/email/phone/userId is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      console.log('Login attempt started:', req.body.login);
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { login, password } = req.body;
      console.log('Processing login for:', login);
      
      // Check MongoDB connection
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        console.error('MongoDB not connected. State:', mongoose.connection.readyState);
        return res.status(500).json({ error: 'Database connection error' });
      }

      // Find user by username, email, userId, or phone
      const searchQuery = [
        { username: login },
        { userId: login.toUpperCase() },
        { fullPhone: login }
      ];
      
      // Only search by email if it looks like an email
      if (login.includes('@')) {
        searchQuery.push({ email: login.toLowerCase() });
      }
      
      const user = await User.findOne({
        $or: searchQuery
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is suspended' });
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      await user.updateLastLogin();

      // Generate JWT
      const token = jwt.sign(
        { 
          userId: user._id,
          userIdString: user.userId,
          isDemo: user.isDemo || false
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Send Telegram notification
      await sendTelegramNotification(
        `🔐 User Login!\n\n` +
        `Username: ${user.username}\n` +
        `Email: ${user.email}\n` +
        `Login Count: ${user.loginCount}\n` +
        `Time: ${new Date().toLocaleString()}`
      );

      res.json({
        message: 'Login successful',
        token,
        user: user.getPublicProfile()
      });

    } catch (error) {
      console.error('Login error details:', {
        message: error.message,
        stack: error.stack,
        jwtSecret: !!process.env.JWT_SECRET,
        mongodbUri: !!process.env.MONGODB_URI
      });
      res.status(500).json({ 
        error: 'Internal server error',
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Handle demo users
    if (decoded.isDemo || decoded.userId.startsWith('demo_')) {
      return res.json({
        _id: decoded.userId,
        userId: 'DEMO' + Math.random().toString(36).substr(2, 4).toUpperCase(),
        username: 'Demo Player',
        email: null,
        phone: null,
        isDemo: true,
        balance: 3000,
        createdAt: new Date()
      });
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.getPublicProfile());
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user transactions
router.get('/transactions', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { page = 1, limit = 20, type } = req.query;
    
    const filter = { userId: decoded.userId };
    if (type) {
      filter.type = type;
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Transaction.countDocuments(filter);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Transaction fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user bets
router.get('/bets', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { page = 1, limit = 20 } = req.query;
    
    const bets = await Bet.find({ userId: decoded.userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Bet.countDocuments({ userId: decoded.userId });

    res.json({
      bets,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Bets fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;