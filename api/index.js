const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Initialize admin user on startup
async function initializeAdmin() {
  try {
    const { connectToMongoDB } = require('../classybet-backend/utils/database');
    await connectToMongoDB();
    
    const User = require('../classybet-backend/models/User');
    const adminExists = await User.findOne({ isAdmin: true });
    
    if (!adminExists) {
      const adminUser = new User({
        username: 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@classybet.com',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        phone: '254700000000',
        isAdmin: true,
        balance: 0
      });

      await adminUser.save();
      console.log('✅ Admin user created');
      console.log(`📧 Admin email: ${adminUser.email}`);
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error initializing admin user:', error);
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

// Import and use routes
try {
  const authRoutes = require('../classybet-backend/routes/auth');
  const adminRoutes = require('../classybet-backend/routes/admin');
  const gameRoutes = require('../classybet-backend/routes/game');
  const paymentRoutes = require('../classybet-backend/routes/payments');
  const setupRoutes = require('./setup');

  // Use API routes first (more specific routes)
  app.use('/api/auth', authRoutes);
  app.use('/api/game', gameRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/setup', setupRoutes);
  
  // Admin API routes (these need to come BEFORE the redirect)
  app.use('/admin', adminRoutes);

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

// Specific redirect for admin panel access (only for exact /admin path)
app.get('/admin', (req, res) => {
  res.redirect('/management.html');
});

// Profile route fallback
app.get('/profile*', (req, res) => {
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