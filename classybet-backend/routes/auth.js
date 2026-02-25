const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Bet = require('../models/Bet');
const { sendTelegramNotification } = require('../utils/telegram');
const { sendSlackMessage } = require('../utils/slack');
const { applyPromoCodeToUser } = require('../utils/affiliate');
const { getCurrencyForCountryCode } = require('../utils/currencyConfig');
const rateLimit = require('express-rate-limit');
const { sendOTPEmail } = require('../utils/emailService'); // kept for reference, not used
const crypto = require('crypto');

const router = express.Router();

// --- OTP Endpoints ---

// Send/Resend OTP – generates code and returns it directly (no email)
router.post('/send-otp', async (req, res) => {
  try {
    const { userId, email } = req.body;
    const user = await User.findOne({
      $or: [
        { _id: userId },
        { email: email }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
    await user.save();

    // Return the OTP directly in the response so the frontend can display it
    res.json({ success: true, otp });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.json({ success: true, message: 'Email already verified' });
    }

    if (user.otpCode !== otp) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: 'OTP code has expired' });
    }

    user.isEmailVerified = true;
    user.isVerified = true; // Also mark as generally verified
    user.otpCode = null;
    user.otpExpiresAt = null;
    await user.save();

    // Generate token after successful verification
    const token = jwt.sign(
      {
        userId: user._id,
        userIdString: user.userId,
        isDemo: user.isDemo || false
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
      // Connect to MongoDB for serverless
      const { connectToMongoDB } = require('../utils/database');
      await connectToMongoDB();

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Format validation errors into a more readable structure
        const formattedErrors = errors.array().reduce((acc, error) => {
          acc[error.param] = error.msg;
          return acc;
        }, {});

        return res.status(400).json({
          error: 'Validation failed',
          message: Object.values(formattedErrors).join('\n'),
          errors: formattedErrors
        });
      }

      const { username, email, password, phone, countryCode, promoCode } = req.body;
      const fullPhone = `${countryCode}${phone}`;

      // Get currency and country from country code
      const { currency, country } = getCurrencyForCountryCode(countryCode);

      // Check if user already exists
      // Check each field individually for more specific error messages
      let existingUsername = await User.findOne({ username });
      let existingPhone = await User.findOne({ fullPhone });
      let existingEmail = email ? await User.findOne({ email }) : null;

      if (existingUsername || existingPhone || existingEmail) {
        let errorMessage = [];
        if (existingUsername) {
          errorMessage.push('Username is already taken');
        }
        if (existingPhone) {
          errorMessage.push('Phone number is already registered');
        }
        if (existingEmail) {
          errorMessage.push('Email address is already registered');
        }

        return res.status(400).json({
          error: 'User already exists',
          message: errorMessage.join('\n'),
          errors: {
            username: existingUsername ? 'Username is already taken' : null,
            phone: existingPhone ? 'Phone number is already registered' : null,
            email: existingEmail ? 'Email address is already registered' : null
          }
        });
      }

      // Create new user
      const user = new User({
        username,
        email: email || null,
        password,
        phone,
        countryCode,
        currency,
        country
      });

      await user.save();

      if (promoCode) {
        try {
          await applyPromoCodeToUser(user, promoCode);
        } catch (error) {
          console.error('Promo code application failed during registration:', error.message);
        }
      }

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

      // Send Slack notification
      await sendSlackMessage(
        process.env.SLACK_WEBHOOK_REGISTRATION,
        `:new: *New Registration*\n` +
        `User ID: ${user.userId}\n` +
        `Username: ${username}\n` +
        `Email: ${email || 'Not provided'}\n` +
        `Phone: ${fullPhone}\n` +
        `Country: ${countryCode}\n` +
        `Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
      );

      // Generate OTP and return it directly (no email sent)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpCode = otp;
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save();

      res.status(201).json({
        message: 'Registration successful. Please verify your account.',
        requiresVerification: true,
        otp, // Return OTP directly so frontend can display it in a popup
        userId: user._id,
        email: user.email,
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

      // Connect to MongoDB for serverless
      const { connectToMongoDB } = require('../utils/database');
      await connectToMongoDB();

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { login, password, promoCode } = req.body;
      console.log('Processing login for:', login);

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

      if (promoCode && !user.referredBy) {
        try {
          await applyPromoCodeToUser(user, promoCode);
        } catch (error) {
          console.error('Promo code application failed during login:', error.message);
        }
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

      // Send Slack notification
      await sendSlackMessage(
        process.env.SLACK_WEBHOOK_LOGIN,
        `:lock: *User Login*\n` +
        `Username: ${user.username}\n` +
        `Phone: ${user.fullPhone || 'N/A'}\n` +
        `Login Count: ${user.loginCount}\n` +
        `Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
      );

      // Check if email is verified
      if (!user.isEmailVerified && user.email) {
        // Generate and send new OTP if existing one expired or doesn't exist
        if (!user.otpCode || user.otpExpiresAt < new Date()) {
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          user.otpCode = otp;
          user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
          await user.save();
          await sendOTPEmail(user.email, otp);
        }

        return res.status(200).json({
          message: 'Email verification required',
          requiresVerification: true,
          userId: user._id,
          email: user.email
        });
      }

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
    // Connect to MongoDB for serverless
    const { connectToMongoDB } = require('../utils/database');
    await connectToMongoDB();

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

    const profile = user.getPublicProfile();
    // Include admin status in the profile
    profile.isAdmin = user.isAdmin || false;

    // Send Slack notification for profile access
    await sendSlackMessage(
      process.env.SLACK_WEBHOOK_PROFILE,
      `:bust_in_silhouette: *Profile Accessed*\n` +
      `Username: ${user.username}\n` +
      `Phone: ${user.fullPhone || 'N/A'}\n` +
      `Balance: KES ${user.balance.toFixed(2)}\n` +
      `Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}`
    );

    res.json(profile);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user transactions (deposits & withdrawals only, with status filtering)
router.get('/transactions', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { page = 1, limit = 20, type } = req.query;

    // Build filter: only deposit & withdrawal by default
    // Deposits: only completed
    // Withdrawals: pending, completed, cancelled (so user can see status)
    let filter;
    if (type) {
      // If specific type requested, use it with user filter
      filter = { user: decoded.userId, type };
    } else {
      // Default: show completed deposits + all withdrawals
      filter = {
        user: decoded.userId,
        $or: [
          { type: 'deposit', status: 'completed' },
          { type: 'withdrawal', status: { $in: ['pending', 'completed', 'cancelled'] } }
        ]
      };
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('type amount currency status description createdAt balanceBefore balanceAfter metadata processedAt')
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