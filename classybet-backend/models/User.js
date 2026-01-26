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
    sparse: true,
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
  country: {
    type: String,
    required: true,
    default: 'Kenya'
  },
  currency: {
    type: String,
    required: true,
    default: 'KES',
    enum: ['KES', 'NGN', 'GHS', 'ZAR', 'USD', 'GBP', 'EUR']
  },
  isDemo: {
    type: Boolean,
    default: false
  },
  balance: {
    type: Number,
    default: function () {
      return this.isDemo ? 3000 : 0;
    },
    min: 0
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isAffiliate: {
    type: Boolean,
    default: false
  },
  promoCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  affiliateStats: {
    referredUsers: {
      type: Number,
      default: 0
    },
    totalDeposits: {
      type: Number,
      default: 0
    },
    totalLosses: {
      type: Number,
      default: 0
    },
    affiliateBalance: {
      type: Number,
      default: 0
    },
    pendingPayout: {
      type: Number,
      default: 0
    },
    lastPayoutAt: {
      type: Date,
      default: null
    }
  },
  isVerified: {
    type: Boolean,
    default: true
  },
  avatar: {
    type: String,
    default: 'default-avatar.png'
  },
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
  },
  lastGamePlayed: {
    type: String,
    default: null
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.index({ userId: 1 }, { unique: true, sparse: true });
userSchema.index({ fullPhone: 1 }, { unique: true, sparse: true });
userSchema.index({ promoCode: 1 }, { unique: true, sparse: true });

async function generateUniqueUserId(model) {
  const prefix = 'CB';
  const randomPart = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${prefix}${randomPart()}${randomPart()}`;
    const existing = await model.findOne({ userId: candidate }).lean();
    if (!existing) {
      return candidate;
    }
  }

  // Fallback to timestamp-based ID to avoid infinite loop
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

userSchema.pre('validate', async function (next) {
  if (!this.fullPhone && this.countryCode && this.phone) {
    this.fullPhone = `${this.countryCode}${this.phone}`;
  }

  if (!this.userId) {
    this.userId = await generateUniqueUserId(this.constructor);
  }

  next();
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  if (this.isModified('phone') || this.isModified('countryCode')) {
    this.fullPhone = `${this.countryCode}${this.phone}`;
  }

  // Ensure demo balance stays consistent
  if (this.isDemo && (this.isModified('isDemo') || this.isNew) && !this.isModified('balance')) {
    this.balance = 3000;
  }

  next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.updateLastLogin = async function updateLastLogin() {
  this.lastLogin = new Date();
  this.loginCount = (this.loginCount || 0) + 1;
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.getPublicProfile = function getPublicProfile() {
  return {
    id: this._id,
    userId: this.userId,
    username: this.username,
    email: this.email,
    phone: this.phone,
    fullPhone: this.fullPhone,
    country: this.country,
    countryCode: this.countryCode,
    currency: this.currency,
    balance: this.balance,
    isDemo: this.isDemo,
    isAdmin: this.isAdmin,
    isAffiliate: this.isAffiliate,
    promoCode: this.promoCode,
    referralStats: this.affiliateStats,
    lastLogin: this.lastLogin,
    loginCount: this.loginCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.getPublicProfile();
  obj._id = obj.id;
  return obj;
};

userSchema.statics.createDemoSession = function createDemoSession() {
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return {
    _id: `demo_${randomSuffix}`,
    userId: `DEMO${randomSuffix}`,
    username: 'Demo Player',
    email: null,
    phone: null,
    fullPhone: null,
    isDemo: true,
    balance: 3000,
    isAdmin: false,
    isAffiliate: false,
    promoCode: null,
    referralStats: {
      referredUsers: 0,
      totalDeposits: 0,
      totalLosses: 0,
      affiliateBalance: 0,
      pendingPayout: 0,
      lastPayoutAt: null
    },
    lastLogin: new Date(),
    loginCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;