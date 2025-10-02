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

// Import and use routes (exact localhost structure)
try {
  console.log('🔧 Loading routes...');
  
  const authRoutes = require('../classybet-backend/routes/auth');
  console.log('✅ Auth routes loaded');
  
  const adminRoutes = require('../classybet-backend/routes/admin');
  console.log('✅ Admin routes loaded');
  
  const gameRoutes = require('../classybet-backend/routes/game');
  console.log('✅ Game routes loaded');
  
  const paymentRoutes = require('../classybet-backend/routes/payments');
  console.log('✅ Payment routes loaded');
  
  const setupRoutes = require('./setup');
  console.log('✅ Setup routes loaded');

  // Mount routes exactly like localhost
  app.use('/api/auth', authRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);  // ← CRITICAL: localhost uses /api/admin not /admin
  app.use('/api/game', gameRoutes);
  app.use('/api/setup', setupRoutes);
  
  console.log('✅ All routes mounted successfully');

} catch (error) {
  console.error('❌ Error loading routes:', {
    message: error.message,
    stack: error.stack,
    cwd: process.cwd()
  });
}

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
      hasAdminPassword: !!process.env.ADMIN_PASSWORD
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

// Export for Vercel
module.exports = app;