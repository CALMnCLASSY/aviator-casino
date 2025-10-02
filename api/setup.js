const express = require('express');
const bcrypt = require('bcryptjs');
const { connectToMongoDB } = require('../classybet-backend/utils/database');

const router = express.Router();

// Create admin user endpoint (for setup)
router.post('/create-admin', async (req, res) => {
  try {
    await connectToMongoDB();
    
    const User = require('../classybet-backend/models/User');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@classybet.com' });
    
    if (existingAdmin) {
      return res.json({ 
        message: 'Admin user already exists',
        admin: {
          email: existingAdmin.email,
          username: existingAdmin.username,
          isAdmin: existingAdmin.isAdmin
        }
      });
    }
    
    // Create admin user
    const adminUser = new User({
      username: 'admin',
      email: 'admin@classybet.com',
      password: 'admin123', // Will be hashed by pre-save middleware
      phone: '700000000',
      countryCode: '+254',
      isAdmin: true,
      isDemo: false,
      balance: 0
    });
    
    await adminUser.save();
    
    res.json({ 
      message: 'Admin user created successfully',
      admin: {
        email: adminUser.email,
        username: adminUser.username,
        isAdmin: adminUser.isAdmin
      }
    });
    
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin user: ' + error.message });
  }
});

// Database connection test
router.get('/db-status', async (req, res) => {
  try {
    await connectToMongoDB();
    
    const User = require('../classybet-backend/models/User');
    const userCount = await User.countDocuments();
    const adminCount = await User.countDocuments({ isAdmin: true });
    
    res.json({
      status: 'Database connected',
      totalUsers: userCount,
      adminUsers: adminCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Database status error:', error);
    res.status(500).json({ error: 'Database connection failed: ' + error.message });
  }
});

module.exports = router;