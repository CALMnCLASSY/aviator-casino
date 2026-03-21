const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'bet', 'win', 'bonus'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  balanceBefore: {
    type: Number,
    required: true,
    min: 0
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  description: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    unique: true,
    sparse: true
  },
  currency: {
    type: String,
    required: true,
    default: 'KES'
  },
  paymentProvider: {
    type: String,
    enum: ['mpesa', 'paystack', 'manual'],
    default: 'manual'
  },
  // M-Pesa specific fields
  mpesaReceiptNumber: {
    type: String,
    sparse: true
  },
  mpesaPhoneNumber: {
    type: String,
    sparse: true
  },
  // Paystack specific fields
  paystackReference: {
    type: String,
    sparse: true
  },
  paystackAccessCode: {
    type: String,
    sparse: true
  },
  // Admin who approved/processed (for manual transactions)
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  },
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Generate unique reference
transactionSchema.pre('save', async function (next) {
  if (!this.reference) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.reference = `TXN_${timestamp}_${random}`.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);