const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    from: { type: String, enum: ['user', 'agent'], required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const supportConversationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    username: { type: String, default: '' },
    sessionId: { type: String, required: true },
    messages: [messageSchema],
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    slackThreadTs: { type: String, default: null },
    slackChannel: { type: String, default: null }
}, { timestamps: true });

supportConversationSchema.index({ userId: 1, status: 1 });
supportConversationSchema.index({ sessionId: 1, status: 1 });
supportConversationSchema.index({ slackThreadTs: 1, slackChannel: 1 });

module.exports = mongoose.model('SupportConversation', supportConversationSchema);
