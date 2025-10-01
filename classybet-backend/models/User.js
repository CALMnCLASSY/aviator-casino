const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    uppercase: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Allows multiple null values
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  countryCode: {
    type: String,
    required: true,
    default: '+254'
  },
  fullPhone: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  isDemo: {
    type: Boolean,
    default: false
  },
  balance: {
    type: Number,
    default: function() {
      return this.isDemo ? 3000 : 0;
    },
    min: 0
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: true // For simplicity, auto-verify users
  },
  avatar: {
    type: String,
    default: 'default-avatar.png'
  },
  // Betting statistics
  totalBets: {
    type: Number,
    default: 0
  },
  totalWins: {
    type: Number,
    default: 0
  },
  totalLosses: {
    type: Number,
    default: 0
  },
  biggestWin: {
    type: Number,
    default: 0
  },
  biggestMultiplier: {
    type: Number,
    default: 0
  },
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Generate userId and hash password before saving
userSchema.pre('save', async function(next) {
  try {
    // Generate userId if new user or existing user without userId
    if (!this.userId) {
      this.userId = await this.constructor.generateUserId();
    }
    
    // Set fullPhone
    if (this.countryCode && this.phone) {
      this.fullPhone = `${this.countryCode}${this.phone}`;
    } else if (this.phone && !this.fullPhone) {
      // Handle existing users - assume +254 if no country code
      this.fullPhone = this.phone.startsWith('+') ? this.phone : `+254${this.phone}`;
      if (!this.countryCode) {
        this.countryCode = '+254';
      }
    }
    
    // Hash password if modified
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to generate unique userId
userSchema.statics.generateUserId = async function() {
  let userId;
  let exists = true;
  
  while (exists) {
    // Generate 8-character alphanumeric ID
    userId = Math.random().toString(36).substr(2, 4).toUpperCase() + 
             Math.random().toString(36).substr(2, 4).toUpperCase();
    
    // Check if it exists
    const existingUser = await this.findOne({ userId });
    exists = !!existingUser;
  }
  
  return userId;
};

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update last login
userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return await this.save();
};

// Get user profile data (excluding sensitive info)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

// Static method to create demo session
userSchema.statics.createDemoSession = function() {
  return {
    _id: 'demo_' + Date.now(),
    userId: 'DEMO' + Math.random().toString(36).substr(2, 4).toUpperCase(),
    username: 'Demo Player',
    email: null,
    phone: null,
    countryCode: '+254',
    fullPhone: null,
    isDemo: true,
    balance: 3000,
    isActive: true,
    isVerified: true,
    totalBets: 0,
    totalWins: 0,
    totalLosses: 0,
    biggestWin: 0,
    biggestMultiplier: 0,
    loginCount: 1,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

module.exports = mongoose.model('User', userSchema);