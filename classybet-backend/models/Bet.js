const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameRound: {
    type: String,
    required: true
  },
  gameType: {
    type: String,
    required: true,
    default: 'aviator',
    index: true
  },
  betAmount: {
    type: Number,
    required: true,
    min: 1
  },
  multiplier: {
    type: Number,
    default: null // null if crashed, number if cashed out
  },
  winAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'cashed_out', 'crashed'],
    default: 'active'
  },
  cashOutAt: {
    type: Number, // Auto cash out multiplier
    default: null
  },
  autoBet: {
    type: Boolean,
    default: false
  },
  cashedOutAt: {
    type: Date
  },
  // Game round metadata
  roundStartTime: {
    type: Date,
    required: true
  },
  roundEndTime: {
    type: Date
  },
  crashedAt: {
    type: Number // The multiplier where the round crashed
  }
}, {
  timestamps: true
});

// Calculate win amount
betSchema.methods.calculateWin = function () {
  if (this.status === 'cashed_out' && this.multiplier) {
    this.winAmount = Math.round(this.betAmount * this.multiplier * 100) / 100;
  } else {
    this.winAmount = 0;
  }
  return this.winAmount;
};

module.exports = mongoose.model('Bet', betSchema);