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

// ─── Support chat -> Slack bridge (two-way) ───

// AI Chatbot System Prompt - Policy-compliant and professional
const SYSTEM_PROMPT = `You are a professional customer support agent for ClassyBet, an online betting casino platform. Your role is to help customers with deposit, withdrawal, and general site-related questions.

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

// Comprehensive keyword-based response system
const KEYWORD_RESPONSES = [
  // Deposit-related keywords
  {
    keywords: ['deposit', 'depos', 'add money', 'add fund', 'top up', 'load money', 'fund account'],
    response: 'To make a deposit:\n1. Go to your Profile and click the Deposit button\n2. Choose your preferred payment method (Mobile Money, Crypto, or Card)\n3. Enter the amount and follow the payment instructions\n4. Your balance will be updated automatically once the payment is confirmed\n\nMinimum deposits: KES 350, NGN 6,500, GHS 600, ZAR 125, USD 3, GBP 2, EUR 3\n\nIf your deposit is pending, it requires verification. Check your transaction history in Profile > Deposits tab.'
  },
  {
    keywords: ['deposit pending', 'deposit not showing', 'deposit not credited', 'deposit stuck'],
    response: 'If your deposit is pending:\n1. Check your transaction history in Profile > Deposits tab\n2. Pending deposits are being verified automatically\n3. Verification typically takes 5-30 minutes\n4. If it remains pending after 1 hour, please contact support with your transaction ID'
  },
  {
    keywords: ['deposit failed', 'deposit declined', 'deposit rejected'],
    response: 'If your deposit failed:\n1. Verify you have sufficient funds in your payment method\n2. Check that your payment details are correct\n3. Try using a different payment method\n4. Contact your bank if the issue persists\n5. If you believe this is an error, contact support with the error message'
  },
  
  // Withdrawal-related keywords
  {
    keywords: ['withdraw', 'withdrawal', 'cash out', 'payout', 'take out', 'get money'],
    response: 'To withdraw your winnings:\n1. Go to your Profile and click the Withdraw button\n2. Enter the amount you wish to withdraw\n3. Withdrawals are processed to your registered payment method\n4. Processing time: 24-48 hours\n5. You can track your withdrawal status in Profile > Withdrawals tab\n\nNote: Pending withdrawals require verification before processing.'
  },
  {
    keywords: ['withdrawal pending', 'withdrawal not received', 'withdrawal stuck', 'where is my withdrawal'],
    response: 'If your withdrawal is pending:\n1. Check your transaction history in Profile > Withdrawals tab\n2. Pending withdrawals are being verified\n3. Verification is required for security purposes\n4. Processing time: 24-48 hours after verification\n5. If it remains pending after 48 hours, please contact support'
  },
  {
    keywords: ['withdrawal failed', 'withdrawal declined', 'withdrawal rejected'],
    response: 'If your withdrawal failed:\n1. Verify your withdrawal details are correct\n2. Ensure you have sufficient balance\n3. Check that your payment method is valid and active\n4. Some withdrawals may require additional verification\n5. Contact support with the specific error message for assistance'
  },
  {
    keywords: ['withdrawal limit', 'maximum withdrawal', 'minimum withdrawal'],
    response: 'Withdrawal limits:\n- Minimum withdrawal: KES 500, NGN 10,000, GHS 900, ZAR 200, USD 5, GBP 4, EUR 4\n- Maximum withdrawal: Varies by payment method and account status\n- You can withdraw up to 5 times per day\n- For higher limits, contact support for VIP verification'
  },
  
  // Account-related keywords
  {
    keywords: ['login', 'sign in', 'cannot login', 'login issue', 'cannot sign in'],
    response: 'If you cannot login:\n1. Clear your browser cache and cookies\n2. Try using a different browser (Chrome, Firefox, Safari)\n3. Ensure you are using the correct email and password\n4. Reset your password using the "Forgot Password" link\n5. If the issue persists, contact support with your email address'
  },
  {
    keywords: ['password', 'forgot password', 'reset password', 'change password'],
    response: 'To reset your password:\n1. Click "Forgot Password" on the login page\n2. Enter your registered email address\n3. Check your email for the reset link (check spam folder)\n4. Click the link and create a new password\n5. Login with your new password\n\nIf you do not receive the email within 5 minutes, contact support.'
  },
  {
    keywords: ['account locked', 'account suspended', 'account banned', 'cannot access account'],
    response: 'If your account is locked:\n1. This may be due to multiple failed login attempts or suspicious activity\n2. Contact support for assistance\n3. Provide your username and email address\n4. Our team will review your account and assist with unlocking\n\nFor security reasons, account unlocks require manual verification.'
  },
  {
    keywords: ['verify account', 'account verification', 'kyc', 'identity verification'],
    response: 'Account verification:\n1. Go to Profile > Settings\n2. Click on "Verify Account"\n3. Upload a clear photo of your ID (passport, national ID, or driver\'s license)\n4. Upload a selfie holding your ID\n5. Verification typically takes 24-48 hours\n\nVerified accounts have higher withdrawal limits and faster processing times.'
  },
  {
    keywords: ['delete account', 'close account', 'remove account'],
    response: 'To close your account:\n1. Withdraw all your remaining balance first\n2. Go to Profile > Settings\n3. Click "Close Account"\n4. Confirm your decision\n5. Your account will be permanently closed\n\nNote: This action cannot be undone. If you change your mind, you will need to create a new account.'
  },
  
  // Game-related keywords
  {
    keywords: ['aviator', 'crash game', 'fly game'],
    response: 'Aviator Game Guide:\n1. Place your bet before the plane takes off\n2. Cash out before the plane flies away to win\n3. The multiplier increases as the plane flies higher\n4. If you don\'t cash out in time, you lose your bet\n5. Start with small bets to understand the game pattern\n\nTip: Set a cash-out target and stick to it for consistent winnings!'
  },
  {
    keywords: ['how to play', 'game rules', 'how do i play'],
    response: 'How to play:\n1. Select a game from the lobby\n2. Read the game rules before playing\n3. Set your bet amount within your budget\n4. Click "Play" or "Spin" to start\n5. Follow the game instructions to win\n\nAlways gamble responsibly. Set limits and never bet more than you can afford to lose.'
  },
  {
    keywords: ['game not loading', 'game stuck', 'game freeze', 'game error'],
    response: 'If a game is not loading:\n1. Refresh the page\n2. Clear your browser cache\n3. Check your internet connection\n4. Try using a different browser\n5. Disable any browser extensions that might block the game\n6. If the issue persists, contact support with the game name and error message'
  },
  {
    keywords: ['fair', 'rigged', 'cheat', 'random'],
    response: 'Our games are provably fair:\n1. All games use certified Random Number Generators (RNG)\n2. Game outcomes are completely random and cannot be manipulated\n3. We are licensed and regulated\n4. You can verify game results in your transaction history\n5. If you have concerns about game fairness, contact support for detailed verification'
  },
  
  // Bonus and promotion keywords
  {
    keywords: ['bonus', 'promotion', 'promo', 'offer', 'reward'],
    response: 'Bonuses and Promotions:\n1. Check the "Promotions" page for current offers\n2. Welcome bonus is available for new players\n3. Deposit bonuses are available on certain days\n4. Referral bonuses: Invite friends and earn rewards\n5. Read the terms and conditions for each bonus\n\nNote: Bonuses have wagering requirements that must be met before withdrawal.'
  },
  {
    keywords: ['welcome bonus', 'sign up bonus', 'first deposit bonus'],
    response: 'Welcome Bonus:\n1. Available for new players on their first deposit\n2. Bonus amount varies by deposit amount\n3. Wagering requirements apply (check terms)\n4. Bonus is credited automatically after qualifying deposit\n5. Contact support if your bonus is not credited within 30 minutes'
  },
  {
    keywords: ['referral', 'invite friend', 'refer a friend'],
    response: 'Referral Program:\n1. Go to Profile > Referral\n2. Copy your unique referral link\n3. Share it with friends\n4. You earn a commission on their deposits\n5. Your friend also gets a welcome bonus\n\nTrack your referrals and earnings in the Referral section.'
  },
  
  // Transaction status keywords
  {
    keywords: ['pending', 'status', 'where is my money', 'transaction status'],
    response: 'To check your transaction status:\n1. Go to your Profile\n2. Click on Deposits or Withdrawals tab\n3. Find your transaction in the list\n4. Status will show: Pending, Completed, or Cancelled\n\nPending transactions are being verified. This typically takes 5-30 minutes for deposits and 24-48 hours for withdrawals.'
  },
  {
    keywords: ['transaction history', 'my transactions', 'view transactions'],
    response: 'To view your transaction history:\n1. Go to your Profile\n2. Click on Deposits tab for deposit history\n3. Click on Withdrawals tab for withdrawal history\n4. You can see: date, amount, status, and receipt number\n5. Download or print receipts for your records'
  },
  
  // Payment method keywords
  {
    keywords: ['mpesa', 'mobile money', 'm-pesa'],
    response: 'M-Pesa/Mobile Money:\n1. Select M-Pesa as your payment method\n2. Enter your phone number\n3. Enter the amount\n4. You will receive an STK Push on your phone\n5. Enter your M-Pesa PIN to confirm\n6. Payment is processed instantly\n\nNote: Ensure you have sufficient funds in your M-Pesa account.'
  },
  {
    keywords: ['crypto', 'bitcoin', 'ethereum', 'usdt', 'cryptocurrency'],
    response: 'Crypto Payments:\n1. Select Crypto as your payment method\n2. Choose your preferred cryptocurrency (BTC, ETH, USDT)\n3. Send the exact amount to the provided wallet address\n4. Transaction is confirmed after network confirmations\n5. Your balance is updated automatically\n\nNote: Crypto deposits may take 10-30 minutes depending on network congestion.'
  },
  {
    keywords: ['card', 'credit card', 'debit card', 'visa', 'mastercard'],
    response: 'Card Payments:\n1. Select Card as your payment method\n2. Enter your card details (number, expiry, CVV)\n3. Enter the amount\n4. Complete the 3D Secure verification if required\n5. Payment is processed instantly\n\nYour card details are secure and encrypted. We do not store your card information.'
  },
  
  // General support keywords
  {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
    response: 'Hello! Welcome to ClassyBet Support. How can I help you today? I can assist with:\n- Deposits and withdrawals\n- Account issues\n- Game questions\n- Bonuses and promotions\n- Payment methods\n\nPlease let me know how I can assist you.'
  },
  {
    keywords: ['thank', 'thanks', 'appreciate'],
    response: 'You\'re welcome! If you have any other questions or need further assistance, feel free to ask. We\'re here to help 24/7. Good luck and have fun playing!'
  },
  {
    keywords: ['human', 'agent', 'speak to person', 'real person', 'talk to human'],
    response: 'I understand you need to speak with a human agent. I\'ve flagged your conversation for priority review. A human agent will review your message and get back to you shortly. In the meantime, please provide any relevant details about your issue.'
  },
  {
    keywords: ['complaint', 'unhappy', 'dissatisfied', 'issue', 'problem'],
    response: 'I\'m sorry to hear you\'re experiencing an issue. Please provide more details about your problem so I can assist you better. Include:\n- What you were trying to do\n- What happened instead\n- Any error messages you received\n\nI will do my best to help resolve this for you.'
  },
  {
    keywords: ['contact', 'phone number', 'email', 'support team', 'help'],
    response: 'Contact Information:\n- Live Chat: Available 24/7 on this platform\n- Email: support@classybetaviator.com\n- Response time: Usually within 1-2 hours\n\nFor urgent issues, use the live chat for immediate assistance.'
  },
  
  // Security keywords
  {
    keywords: ['security', 'safe', 'secure', 'protect'],
    response: 'Security Features:\n1. All data is encrypted with SSL\n2. Two-factor authentication available\n3. Regular security audits\n4. Licensed and regulated\n5. Your personal and financial information is protected\n\nWe take security seriously. Never share your password with anyone.'
  },
  {
    keywords: ['fraud', 'scam', 'suspicious', 'unauthorized'],
    response: 'If you suspect fraud or unauthorized activity:\n1. Immediately change your password\n2. Contact support right away\n3. Provide details of the suspicious activity\n4. We will investigate and secure your account\n5. Your account may be temporarily locked for security\n\nReport any suspicious activity immediately to protect your account.'
  },
  
  // Responsible gaming
  {
    keywords: ['responsible gaming', 'addiction', 'limit', 'self exclusion', 'gambling problem'],
    response: 'Responsible Gaming:\n1. Set deposit limits in your Profile > Settings\n2. Set session time limits\n3. Take regular breaks\n4. Never gamble more than you can afford to lose\n5. If you have a gambling problem, contact support for self-exclusion\n\nWe are committed to responsible gaming. Help is available if you need it.'
  },
  
  // Technical issues
  {
    keywords: ['slow', 'lag', 'loading', 'performance'],
    response: 'If the site is slow or lagging:\n1. Check your internet connection\n2. Clear your browser cache\n3. Close other browser tabs\n4. Try a different browser\n5. Disable VPN if you are using one\n6. If the issue persists, contact support with your browser type and internet speed'
  },
  {
    keywords: ['error', 'bug', 'glitch', 'something went wrong'],
    response: 'If you encounter an error:\n1. Refresh the page\n2. Try the action again\n3. Clear your browser cache\n4. Note the error message or code\n5. Contact support with the error details\n\nProviding screenshots of the error can help us resolve the issue faster.'
  }
];

// Function to find matching response based on keywords
function findKeywordResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  for (const item of KEYWORD_RESPONSES) {
    for (const keyword of item.keywords) {
      if (lowerMessage.includes(keyword)) {
        return item.response;
      }
    }
  }
  
  // Default response if no keywords match
  return 'Thank you for your message. I can help with:\n- Deposits and withdrawals\n- Account and login issues\n- Game questions and rules\n- Bonuses and promotions\n- Payment methods\n- Transaction status\n\nPlease provide more details about your question, or type "human" to speak with a human agent who will review your case.';
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

    // Generate keyword-based response immediately
    const botResponse = findKeywordResponse(message.trim());

    // Add bot response to conversation
    conversation.messages.push({
      from: 'agent',
      text: botResponse,
      createdAt: new Date()
    });

    // Post bot response to Slack thread
    if (conversation.slackThreadTs && conversation.slackChannel) {
      const botSlackText = `🤖 *Support Bot*: ${botResponse}`;
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
          const botSlackText = `🤖 *Support Bot (Cron)*: ${botResponse}`;
          await postSlackThread(conversation.slackChannel, botSlackText, conversation.slackThreadTs);
        }

        await conversation.save();
        console.log(`✅ Responded to conversation ${conversation._id} via cron job`);
      }
    }

    console.log(`✅ Cron job completed. Processed ${conversations.length} conversations.`);
  } catch (error) {
    console.error('❌ Error in support message cron job:', error);
  }
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