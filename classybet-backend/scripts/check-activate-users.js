require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectToMongoDB } = require('../utils/database');

async function checkAndFixUserStatus() {
  try {
    await connectToMongoDB();

    console.log('Checking user status in database...');

    // Count total users
    const totalUsers = await User.countDocuments();
    console.log(`Total users: ${totalUsers}`);

    // Count active users
    const activeUsers = await User.countDocuments({ isActive: true });
    console.log(`Active users: ${activeUsers}`);

    // Count deactivated users
    const deactivatedUsers = await User.countDocuments({ isActive: false });
    console.log(`Deactivated users: ${deactivatedUsers}`);

    // Show sample of deactivated users
    if (deactivatedUsers > 0) {
      const sampleDeactivated = await User.find({ isActive: false }).limit(5).select('username email isActive createdAt');
      console.log('\nSample deactivated users:');
      sampleDeactivated.forEach(user => {
        console.log(`- ${user.username} (${user.email || 'no email'}) - isActive: ${user.isActive} - Created: ${user.createdAt}`);
      });
    }

    // Ask if user wants to fix
    if (deactivatedUsers > 0) {
      console.log('\nTo fix this issue, you can run the fix by setting the environment variable FIX=true');
      console.log('Example: FIX=true node scripts/check-activate-users.js');
      
      if (process.env.FIX === 'true') {
        console.log('\nFixing: Setting all users to active...');
        const result = await User.updateMany({}, { isActive: true });
        console.log(`Updated ${result.modifiedCount} users to active`);
        
        // Verify fix
        const newActiveUsers = await User.countDocuments({ isActive: true });
        const newDeactivatedUsers = await User.countDocuments({ isActive: false });
        console.log(`\nAfter fix:`);
        console.log(`Active users: ${newActiveUsers}`);
        console.log(`Deactivated users: ${newDeactivatedUsers}`);
      }
    } else {
      console.log('\nAll users are already active. The issue might be in the frontend display logic.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAndFixUserStatus();
