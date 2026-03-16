require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectToMongoDB } = require('../utils/database');

async function seedAdmin() {
  try {
    console.log('--- Admin Seeding Script ---');
    
    // Connect to database
    await connectToMongoDB();

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('❌ Error: ADMIN_EMAIL or ADMIN_PASSWORD not found in .env');
      process.exit(1);
    }

    console.log(`Checking if admin exists: ${adminEmail}`);
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists. Updating password and ensuring isAdmin is true...');
      existingAdmin.password = adminPassword;
      existingAdmin.isAdmin = true;
      existingAdmin.username = 'Admin';
      await existingAdmin.save();
      console.log('✅ Admin user updated successfully.');
    } else {
      console.log('Creating new admin user...');
      const adminUser = new User({
        username: 'Admin',
        email: adminEmail,
        password: adminPassword,
        isAdmin: true,
        phone: '0000000000', // Placeholder phone
        countryCode: '+254',
        isVerified: true,
        isEmailVerified: true,
        isActive: true
      });

      await adminUser.save();
      console.log('✅ Admin user created successfully.');
    }

    console.log('--- Seeding Complete ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedAdmin();
