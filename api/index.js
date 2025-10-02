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

// Initialize admin user when the API starts
initializeAdmin();

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
  const authRoutes = require('../classybet-backend/routes/auth');
  const adminRoutes = require('../classybet-backend/routes/admin');
  const gameRoutes = require('../classybet-backend/routes/game');
  const paymentRoutes = require('../classybet-backend/routes/payments');
  const setupRoutes = require('./setup');

  // Mount routes exactly like localhost
  app.use('/api/auth', authRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);  // ← CRITICAL: localhost uses /api/admin not /admin
  app.use('/api/game', gameRoutes);
  app.use('/api/setup', setupRoutes);

} catch (error) {
  console.error('Error loading routes:', error);
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
      admin: '/admin',
      api: '/api'
    },
    timestamp: new Date().toISOString()
  });
});

// Handle frontend routes (after API routes are mounted)
app.get('/profile', (req, res) => {
  res.redirect('/management.html');
});

// Catch all for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Export for Vercel
module.exports = app;