require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const gameRoutes = require('./routes/game');
const affiliateRoutes = require('./routes/affiliate');

const roundRoutes = require('./routes/rounds');
const casinoRoutes = require('./routes/casino');
const userRoutes = require('./routes/users');
const supportRoutes = require('./routes/support');

// Import models
const User = require('./models/User');
const SupportConversation = require('./models/SupportConversation');
const { startRoundScheduler } = require('./utils/roundScheduler');
const { sendSlackMessage, postSlackThread, verifySlackSignature } = require('./utils/slack');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

const app = express();

// Trust proxy for rate limiting behind reverse proxies (Render, Heroku, etc.)
app.set('trust proxy', 1);

// Middleware
// Capture raw body for Slack signature verification
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); }
}));
app.use(express.urlencoded({ extended: true }));
// CORS configuration with multiple frontend domains
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5000',
  'http://localhost:5001',
  'http://localhost:5500',
  'http://localhost:8000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8080',
  'https://classybetaviator.com',
  'https://www.classybetaviator.com',
  'https://avisignalspredictor.netlify.app',

  'file://' // For local file access
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('file://')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Still allow for development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Rate limiting for all endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip failed requests to avoid blocking users
  skipFailedRequests: true,
  // Use a custom key generator that handles proxies correctly
  keyGenerator: (req) => {
    // In production behind proxy, use X-Forwarded-For
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-for']) {
      return req.headers['x-forwarded-for'].split(',')[0].trim();
    }
    // Otherwise use IP
    return req.ip;
  }
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});


// Connect to MongoDB
const { connectToMongoDB } = require('./utils/database');
connectToMongoDB()
  .then(() => {
    startRoundScheduler();
    // Initialize game state manager AFTER MongoDB is connected
    gameStateManager.initialize(io);
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB during startup:', error.message);
  });

const PORT = process.env.PORT || 4000;

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/casino', casinoRoutes);
app.use('/api/user', userRoutes);
app.use('/api/support', supportRoutes);

// Serve static files for admin and profile pages
app.use('/admin', express.static('public/admin'));
app.use('/profile', express.static('public/profile'));
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation error', details: err.message });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

// Start server with WebSocket support
const http = require('http');
const { Server } = require('socket.io');
const gameStateManager = require('./utils/gameStateManager');

const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: function (origin, callback) {
      callback(null, true); // Allow all origins for WebSocket
    },
    credentials: true
  }
});

// Attach socket.io to app to allow access in routes
app.set('socketio', io);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected: ' + socket.id);

  // Handle client registration to join username-specific room
  socket.on('register', (username) => {
    if (username) {
      socket.username = username;
      socket.join(`user:${username}`);
      console.log(`👤 Socket ${socket.id} joined room user:${username}`);
    }
  });

  // Send current game state immediately
  socket.emit('game-state', gameStateManager.getCurrentState());

  // Handle bet placement
  socket.on('place-bet', async (data) => {
    const { userId, amount, autoCashout, token } = data;

    try {
      const User = require('./models/User');
      const Bet = require('./models/Bet');

      // Find user
      const user = await User.findOne({ username: userId });
      if (!user) {
        return socket.emit('bet-error', { error: 'User not found' });
      }

      // Validate amount
      if (amount < 10 || amount > 10000) {
        return socket.emit('bet-error', { error: 'Invalid bet amount' });
      }

      // Check balance
      if (user.balance < amount) {
        return socket.emit('bet-error', { error: 'Insufficient balance' });
      }

      // Get current game state
      const gameState = gameStateManager.getCurrentState();

      // ✅ REMOVED: Countdown constraint - bets can be placed anytime
      // They will be active for the NEXT round if placed during flying

      // Deduct balance immediately
      user.balance -= amount;
      await user.save();

      // Determine which round this bet is for
      // If currently flying, bet is for next round
      const betRoundId = gameState.state === 'flying' ? gameState.roundId + 1 : gameState.roundId;

      // Create bet record with correct field names
      const bet = new Bet({
        user: user._id,  // ✅ Changed from userId
        gameRound: String(betRoundId),
        betAmount: amount,  // ✅ Changed from amount
        cashOutAt: autoCashout,  // ✅ Changed from autoCashout
        status: 'active',
        roundStartTime: new Date()  // ✅ Added required field
      });
      await bet.save();

      console.log('💰 Bet placed: ' + userId + ' - ' + amount + ' KES | New balance: ' + user.balance + ' | Round: ' + gameState.roundId);

      // Increment shared bet counter — triggers broadcast to all clients
      gameStateManager.incrementActiveBets();

      socket.emit('bet-placed', {
        success: true,
        roundId: gameState.roundId,
        betId: bet._id,
        newBalance: user.balance,
        amount: amount
      });
    } catch (error) {
      console.error('Bet placement error:', error);
      socket.emit('bet-error', { error: error.message });
    }
  });

  // Handle cashout request
  socket.on('cashout', async (data) => {
    const { userId, betId } = data;

    try {
      const User = require('./models/User');
      const Bet = require('./models/Bet');

      // Find user
      const user = await User.findOne({ username: userId });
      if (!user) {
        return socket.emit('cashout-error', { error: 'User not found' });
      }

      // Find bet
      const bet = await Bet.findById(betId);
      if (!bet) {
        return socket.emit('cashout-error', { error: 'Bet not found' });
      }

      // Check if already cashed out
      if (bet.status === 'cashed_out') {
        return socket.emit('cashout-error', { error: 'Already cashed out' });
      }

      // Check if bet was already crashed
      if (bet.status === 'crashed') {
        return socket.emit('cashout-error', { error: 'Bet already crashed' });
      }

      // Get multiplier from data (frontend sends it)
      const currentMultiplier = data.multiplier || 1.00;

      // Calculate winnings using correct field name
      const winAmount = bet.betAmount * currentMultiplier;

      // Add winnings to balance immediately
      user.balance += winAmount;
      await user.save();

      // Update bet record with correct field names
      bet.status = 'cashed_out';  // ✅ Changed from 'won'
      bet.multiplier = currentMultiplier;  // ✅ Changed from cashoutMultiplier
      bet.winAmount = winAmount;
      bet.cashedOutAt = new Date();  // ✅ Added timestamp
      await bet.save();

      console.log('💸 Cashout: ' + userId + ' - ' + winAmount + ' KES at ' + currentMultiplier.toFixed(2) + 'x | New balance: ' + user.balance + ' | Round: ' + bet.gameRound);

      // Decrement shared bet counter
      gameStateManager.decrementActiveBets();

      socket.emit('cashout-result', {
        success: true,
        multiplier: currentMultiplier,
        winAmount: winAmount,
        newBalance: user.balance
      });
    } catch (error) {
      console.error('Cashout error:', error);
      socket.emit('cashout-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected: ' + socket.id);
  });
});

// Cron job to process pending support messages every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    console.log('🔄 Running support message cron job...');

    // Find conversations where the last message is from user and is more than 1 minute old
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const conversations = await SupportConversation.find({
      status: 'open',
      'messages.createdAt': { $lt: oneMinuteAgo }
    });

    for (const conversation of conversations) {
      const lastMessage = conversation.messages[conversation.messages.length - 1];

      // Only process if last message is from user and hasn't been responded to recently
      if (lastMessage && lastMessage.from === 'user') {
        const botResponse = findKeywordResponse(lastMessage.text);

        conversation.messages.push({
          from: 'agent',
          text: botResponse,
          createdAt: new Date()
        });

        // Post to Slack if configured
        if (conversation.slackThreadTs && conversation.slackChannel) {
          const botSlackText = '🤖 *Support Bot (Cron)*: ' + botResponse;
          await postSlackThread(conversation.slackChannel, botSlackText, conversation.slackThreadTs);
        }

        await conversation.save();
        console.log('✅ Responded to conversation ' + conversation._id + ' via cron job');
      }
    }

    console.log('✅ Cron job completed. Processed ' + conversations.length + ' conversations.');
  } catch (error) {
    console.error('❌ Error in support message cron job:', error);
  }
});

// Start Exchange Rate Service
const ExchangeRateService = require('./services/ExchangeRateService');
ExchangeRateService.startPeriodicUpdates();

// Start server only if not in Vercel serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 ClassyBet Backend Server is running!');
    console.log('📍 Binding: 0.0.0.0:' + PORT);
    console.log('🔗 Local Access: http://localhost:' + PORT);
    console.log('🏥 Health: http://localhost:' + PORT + '/health');
    console.log('👨‍💼 Admin: http://localhost:' + PORT + '/admin');
    console.log('👤 Profile: http://localhost:' + PORT + '/profile');
    console.log('🌍 Environment: ' + (process.env.NODE_ENV || 'development'));
    console.log('🎮 WebSocket: Enabled');
    console.log('='.repeat(50));
  });
}

// Export for Vercel serverless functions
module.exports = app;