const mongoose = require('mongoose');

const roundScheduleSchema = new mongoose.Schema({
  roundId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  startTime: {
    type: Date,
    required: true,
    index: true
  },
  multiplier: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'complete'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RoundSchedule', roundScheduleSchema);
