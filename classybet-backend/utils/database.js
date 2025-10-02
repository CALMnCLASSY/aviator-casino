const mongoose = require('mongoose');

let cachedConnection = null;

async function connectToMongoDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('Using cached MongoDB connection');
    return cachedConnection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    console.log('Creating new MongoDB connection...');
    
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      maxPoolSize: 10, // Limit connection pool for serverless
      bufferCommands: false // Disable mongoose buffering for serverless
    });

    cachedConnection = connection;
    console.log('✅ Connected to MongoDB successfully');
    return connection;
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

module.exports = { connectToMongoDB };