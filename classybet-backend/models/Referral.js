const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  referredUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  promoCodeUsed: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  referralLink: {
    type: String,
    trim: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  depositTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  lossTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  commissionEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  commissionRate: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1
  },
  lastCommissionAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

referralSchema.index({ affiliate: 1, promoCodeUsed: 1 });

module.exports = mongoose.model('Referral', referralSchema);
