const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Initialize admin user on startup
async function initializeAdmin() {
  try {
    console.log('🔧 Initializing admin user...');
    
    const { connectToMongoDB } = require('../classybet-backend/utils/database');
    await connectToMongoDB();
    console.log('✅ Database connected for admin initialization');
    
    const User = require('../classybet-backend/models/User');
    const adminExists = await User.findOne({ isAdmin: true });
    
    if (!adminExists) {
      console.log('❌ No admin user found, creating one...');
      
      const adminUser = new User({
        username: 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@classybet.com',
        password: process.env.ADMIN_PASSWORD || 'admin123secure',
        phone: '254700000000',
        countryCode: '+254',
        isAdmin: true,
        balance: 0,
        isActive: true
      });

      await adminUser.save();
      console.log('✅ Admin user created successfully');
      console.log(`📧 Admin email: ${adminUser.email}`);
      console.log(`🔑 Admin password: ${process.env.ADMIN_PASSWORD || 'admin123secure'}`);
    } else {
      console.log('✅ Admin user already exists');
      console.log(`📧 Admin email: ${adminExists.email}`);
      console.log(`👤 Admin username: ${adminExists.username}`);
      console.log(`🔐 Admin active: ${adminExists.isActive}`);
    }
  } catch (error) {
    console.error('❌ Error initializing admin user:', {
      message: error.message,
      stack: error.stack,
      mongoUri: !!process.env.MONGODB_URI,
      adminEmail: process.env.ADMIN_EMAIL,
      nodeEnv: process.env.NODE_ENV
    });
  }
}

// Initialize admin user on first request (better for serverless)
let adminInitialized = false;

app.use(async (req, res, next) => {
  if (!adminInitialized && (req.path.startsWith('/api/auth') || req.path.startsWith('/api/admin'))) {
    console.log('🔧 First API request - initializing admin...');
    await initializeAdmin();
    adminInitialized = true;
  }
  next();
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true); // Allow all origins for production
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Direct route implementation for serverless (bypassing complex imports)
console.log('🔧 Setting up direct routes...');

// Basic auth login route - directly implemented
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Direct auth login attempt:', req.body);
    
    const { login, password } = req.body;
    
    if (!login || !password) {
      return res.status(400).json({ 
        error: 'Login and password are required',
        received: { login: !!login, password: !!password }
      });
    }

    // Connect to database
    const { connectToMongoDB } = require('../classybet-backend/utils/database');
    await connectToMongoDB();
    console.log('✅ Database connected for login');
    
    const User = require('../classybet-backend/models/User');
    
    // Find user
    const searchQuery = [
      { username: login },
      { email: login.toLowerCase() }
    ];
    
    const user = await User.findOne({ $or: searchQuery });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        userId: user._id,
        userIdString: user.userId,
        isDemo: user.isDemo || false
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('❌ Direct login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Basic admin login route - directly implemented  
app.post('/api/admin/login', async (req, res) => {
  try {
    console.log('� Direct admin login attempt:', req.body);
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Connect to database
    const { connectToMongoDB } = require('../classybet-backend/utils/database');
    await connectToMongoDB();
    
    const User = require('../classybet-backend/models/User');
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user || !user.isAdmin) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        isAdmin: user.isAdmin 
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

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
    console.error('❌ Direct admin login error:', error);
    res.status(500).json({ 
      error: 'Admin login failed',
      message: error.message 
    });
  }
});

console.log('✅ Direct routes configured');

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'production',
    routes: {
      auth: '/api/auth/*',
      admin: '/admin/*',
      game: '/api/game/*',
      payments: '/api/payments/*'
    }
  });
});

// Root API endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'ClassyBet Aviator Backend API',
    status: 'OK',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      admin: '/api/admin',
      auth: '/api/auth',
      game: '/api/game',
      payments: '/api/payments'
    },
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint for checking environment
app.get('/api/debug', (req, res) => {
  res.json({
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasMongoUri: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasAdminEmail: !!process.env.ADMIN_EMAIL,
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      mongoUriPrefix: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'NOT_SET'
    },
    routes: {
      mounted: ['auth', 'admin', 'game', 'payments', 'setup'],
      available: ['/api/auth/login', '/api/admin/login', '/api/game/*', '/api/payments/*']
    },
    timestamp: new Date().toISOString()
  });
});



// Handle frontend routes (after API routes are mounted)
app.get('/profile', (req, res) => {
  res.redirect('/management.html');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global error handler:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    headers: req.headers,
    body: req.body
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Catch all for API routes
app.use('/api/*', (req, res) => {
  console.log('🔍 404 - API endpoint not found:', {
    path: req.path,
    method: req.method,
    originalUrl: req.originalUrl
  });
  
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    availableRoutes: ['/api/auth/*', '/api/admin/*', '/api/game/*', '/api/payments/*', '/api/setup/*']
  });
});
