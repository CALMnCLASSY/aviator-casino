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

// Import models
const User = require('./models/User');
const SupportConversation = require('./models/SupportConversation');
const { startRoundScheduler } = require('./utils/roundScheduler');
const { sendSlackMessage, postSlackThread, verifySlackSignature } = require('./utils/slack');
const jwt = require('jsonwebtoken');

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

// ─── Support chat -> Slack bridge (two-way) ───

// AI Chatbot System Prompt - Policy-compliant and professional
const SYSTEM_PROMPT = `You are a professional customer support agent for ClassyBet, an online betting platform. Your role is to help customers with deposit, withdrawal, and general site-related questions.

STRICT GUIDELINES:
1. Always be polite, professional, and helpful
2. NEVER share sensitive information about other users or company operations
3. NEVER make promises about processing times or guaranteed outcomes
4. For deposit/withdrawal issues, guide users to check their transaction history in the profile section
5. If a user reports a technical issue, advise them to clear cache, try a different browser, or contact technical support
6. NEVER encourage gambling or provide betting strategies
7. For account issues (login, verification), guide users through the standard process
8. If a question requires human intervention, politely explain that an agent will review their case
9. Keep responses concise (under 200 words when possible)
10. Always maintain a helpful but professional tone

DEPOSIT INFORMATION:
- Minimum deposit varies by currency (KES: 350, NGN: 6,500, GHS: 600, ZAR: 125, USD: 3, GBP: 2, EUR: 3)
- Deposits are processed via M-Pesa (Kenya) and other payment methods
- Pending deposits require manual approval by admin
- Check transaction status in Profile > Deposits tab

WITHDRAWAL INFORMATION:
- Withdrawals are processed to the user's registered payment method
- Pending withdrawals require admin approval
- Processing times vary (usually within 24-48 hours)
- Check transaction status in Profile > Withdrawals tab

COMMON ISSUES:
- Transaction pending: Wait for admin approval, check transaction history
- Payment failed: Verify payment details, try again, or contact support
- Account locked: Contact support for assistance
- Balance not updated: Refresh page, check transaction history

If you cannot answer a question or it requires human intervention, say: "I'll need to connect you with a human agent who can better assist you with this matter. An agent will review your message and get back to you shortly."`;

// Generate AI response using OpenAI
async function generateAIResponse(userMessage, conversationHistory = []) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not configured, using fallback response');
    return getFallbackResponse(userMessage);
  }

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-6).map(msg => ({
        role: msg.from === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      { role: 'user', content: userMessage }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 300,
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      return getFallbackResponse(userMessage);
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return getFallbackResponse(userMessage);
  }
}

// Fallback responses when AI is unavailable
function getFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('deposit') || lowerMessage.includes('depos')) {
    return 'For deposit-related questions, please check your transaction history in the Profile > Deposits tab. If your deposit is pending, it requires admin approval. If you have specific issues, I can connect you with a human agent.';
  }

  if (lowerMessage.includes('withdraw') || lowerMessage.includes('cash out')) {
    return 'For withdrawal-related questions, please check your transaction history in the Profile > Withdrawals tab. Pending withdrawals require admin approval. Processing typically takes 24-48 hours. If you have specific issues, I can connect you with a human agent.';
  }

  if (lowerMessage.includes('login') || lowerMessage.includes('password') || lowerMessage.includes('account')) {
    return 'For account and login issues, please try clearing your browser cache or using a different browser. If the issue persists, I can connect you with a human agent for assistance.';
  }

  if (lowerMessage.includes('pending') || lowerMessage.includes('status')) {
    return 'To check your transaction status, please visit your Profile and view the Deposits or Withdrawals tab. Pending transactions require admin approval.';
  }

  return 'Thank you for your message. I can help with deposit, withdrawal, and general site questions. If you need specific assistance, I can connect you with a human agent who will review your case.';
}

// Helper: extract user from JWT if present
function extractUserFromToken(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    return decoded;
  } catch { return null; }
}

// POST /api/support/chat — send a message & persist conversation
app.post('/api/support/chat', async (req, res) => {
  try {
    const { message, page, url, meta, conversationId, sessionId } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const tokenUser = extractUserFromToken(req);
    const userId = tokenUser ? tokenUser.userId : null;
    const username = meta?.username || tokenUser?.username || 'Anonymous';
    const sid = sessionId || `anon-${Date.now()}`;

    // Find or create conversation
    let conversation;
    if (conversationId) {
      conversation = await SupportConversation.findById(conversationId);
    }
    if (!conversation && userId) {
      conversation = await SupportConversation.findOne({ userId, status: 'open' });
    }
    if (!conversation) {
      conversation = await SupportConversation.findOne({ sessionId: sid, status: 'open' });
    }
    if (!conversation) {
      conversation = new SupportConversation({
        userId,
        username,
        sessionId: sid,
        messages: [],
        status: 'open'
      });
    }

    // Append user message
    const now = new Date();
    conversation.messages.push({ from: 'user', text: message.trim(), createdAt: now });

    // Build Slack text
    const metaLines = [];
    if (username !== 'Anonymous') metaLines.push(`*User:* ${username}`);
    if (meta?.email) metaLines.push(`*Email:* ${meta.email}`);
    if (meta?.phone) metaLines.push(`*Phone:* ${meta.phone}`);
    if (page) metaLines.push(`*Page:* ${page}`);
    const header = metaLines.length ? metaLines.join(' | ') + '\n' : '';
    const slackText = conversation.slackThreadTs
      ? `👤 *${username}*: ${message.trim()}`
      : `:speech_balloon: *New Support Conversation*\n${header}\n👤 *${username}*: ${message.trim()}`;

    // Post to Slack (thread if existing)
    const channel = process.env.SLACK_SUPPORT_CHANNEL_ID;
    if (channel) {
      const ts = await postSlackThread(channel, slackText, conversation.slackThreadTs);
      if (ts && !conversation.slackThreadTs) {
        conversation.slackThreadTs = ts;
        conversation.slackChannel = channel;
      }
    } else {
      // Fallback to webhook
      await sendSlackMessage(process.env.SLACK_WEBHOOK_SUPPORT || process.env.SLACK_WEBHOOK_PROFILE, slackText);
    }

    // Generate AI response
    const aiResponse = await generateAIResponse(message.trim(), conversation.messages);

    // Add AI response to conversation
    conversation.messages.push({
      from: 'agent',
      text: aiResponse,
      createdAt: new Date()
    });

    // Post AI response to Slack thread
    if (conversation.slackThreadTs && conversation.slackChannel) {
      const botSlackText = `🤖 *AI Agent*: ${aiResponse}`;
      await postSlackThread(conversation.slackChannel, botSlackText, conversation.slackThreadTs);
    }

    await conversation.save();

    res.json({
      success: true,
      conversationId: conversation._id,
      sessionId: conversation.sessionId,
      messages: conversation.messages
    });
  } catch (error) {
    console.error('Support chat error:', error);
    res.status(500).json({ error: 'Failed to send support message' });
  }
});

// GET /api/support/conversation/current — fetch latest open conversation
app.get('/api/support/conversation/current', async (req, res) => {
  try {
    const tokenUser = extractUserFromToken(req);
    const sessionId = req.query.sessionId;

    let conversation = null;
    if (tokenUser?.userId) {
      conversation = await SupportConversation.findOne(
        { userId: tokenUser.userId, status: 'open' }
      ).sort({ updatedAt: -1 });
    }
    if (!conversation && sessionId) {
      conversation = await SupportConversation.findOne(
        { sessionId, status: 'open' }
      ).sort({ updatedAt: -1 });
    }

    if (!conversation) {
      return res.json({ conversationId: null, messages: [] });
    }

    res.json({
      conversationId: conversation._id,
      sessionId: conversation.sessionId,
      messages: conversation.messages
    });
  } catch (error) {
    console.error('Fetch conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// GET /api/support/conversation/:id/updates — poll for new messages
app.get('/api/support/conversation/:id/updates', async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(0);
    const conversation = await SupportConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const newMessages = conversation.messages.filter(m => new Date(m.createdAt) > since);
    res.json({ messages: newMessages });
  } catch (error) {
    console.error('Poll updates error:', error);
    res.status(500).json({ error: 'Failed to poll updates' });
  }
});

// POST /api/support/slack-events — receive replies from Slack
app.post('/api/support/slack-events', async (req, res) => {
  try {
    // URL verification challenge
    if (req.body.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }

    // Verify signature
    if (!verifySlackSignature(req)) {
      console.warn('Slack signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    if (!event) return res.sendStatus(200);

    // Ignore bot messages
    if (event.bot_id || event.subtype === 'bot_message') {
      return res.sendStatus(200);
    }

    // Only process threaded replies in our support channel
    if (event.thread_ts && event.channel) {
      const conversation = await SupportConversation.findOne({
        slackThreadTs: event.thread_ts,
        slackChannel: event.channel
      });

      if (conversation) {
        conversation.messages.push({
          from: 'agent',
          text: event.text,
          createdAt: new Date()
        });
        await conversation.save();
        console.log(`💬 Agent reply saved for conversation ${conversation._id}`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Slack events error:', error);
    res.sendStatus(200); // Always 200 so Slack doesn't retry
  }
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

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

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

      console.log(`💰 Bet placed: ${userId} - ${amount} KES | New balance: ${user.balance} | Round: ${gameState.roundId}`);

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

      console.log(`💸 Cashout: ${userId} - ${winAmount} KES at ${currentMultiplier.toFixed(2)}x | New balance: ${user.balance} | Round: ${bet.gameRound}`);

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
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Start server only if not in Vercel serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ClassyBet Backend Server is running!`);
    console.log(`📍 Binding: 0.0.0.0:${PORT}`);
    console.log(`🔗 Local Access: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`👨‍💼 Admin: http://localhost:${PORT}/admin`);
    console.log(`👤 Profile: http://localhost:${PORT}/profile`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🎮 WebSocket: Enabled`);
    console.log('='.repeat(50));
  });
}

// Export for Vercel serverless functions
module.exports = app;