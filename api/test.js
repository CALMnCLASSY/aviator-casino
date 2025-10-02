const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working',
    timestamp: new Date().toISOString(),
    env: {
      hasMongoUri: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      nodeEnv: process.env.NODE_ENV
    }
  });
});

// MongoDB connection test
app.get('/api/db-test', async (req, res) => {
  try {
    if (!process.env.MONGODB_URI) {
      return res.status(500).json({ error: 'MONGODB_URI not set' });
    }

    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });

    res.json({ 
      message: 'MongoDB connection successful',
      state: mongoose.connection.readyState
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'MongoDB connection failed',
      message: error.message
    });
  }
});

// Simple login test without complex logic
app.post('/api/login-test', async (req, res) => {
  try {
    console.log('Login test started');
    
    const { login } = req.body;
    
    if (!login) {
      return res.status(400).json({ error: 'Login field required' });
    }

    res.json({ 
      message: 'Login test successful',
      login: login,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Login test error:', error);
    res.status(500).json({ 
      error: 'Login test failed',
      message: error.message
    });
  }
});

// Export for Vercel
module.exports = app;