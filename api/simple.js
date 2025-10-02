const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true); // Allow all origins for now
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic routes
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Simple auth route for testing
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Simple login attempt:', req.body);
    
    const { login, password } = req.body;
    
    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password required' });
    }

    // For now, just return success for any login attempt
    res.json({
      success: true,
      message: 'Login endpoint working',
      user: {
        username: login,
        userId: 'TEST123'
      },
      token: 'test-token'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Catch all for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Export for Vercel
module.exports = app;