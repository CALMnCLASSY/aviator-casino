const express = require('express');
const { body, validationResult } = require('express-validator');
const SupportConversation = require('../models/SupportConversation');
const User = require('../models/User');
const { postSlackThread, sendSlackMessage } = require('../utils/slack');
const { connectToMongoDB } = require('../utils/database');

// OpenAI configuration (will use environment variables)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const router = express.Router();

// Ensure database connection
router.use(async (req, res, next) => {
  try {
    await connectToMongoDB();
    next();
  } catch (error) {
    console.error('Support DB connection error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// AI Chatbot System Prompt - Policy-compliant and professional
const SYSTEM_PROMPT = `You are a professional customer support agent for ClassyBet, an online betting platform. Your role is to help customers with deposit, withdrawal, and general site-related questions.

STRICT GUIDELINES:
1. Always be polite, professional, and helpful
2. NEVER share sensitive information about other users or company operations
3. NEVER make promises about processing times or guaranteed outcomes
4. For deposit/withdrawal issues, guide users to check their transaction history in the profile section
5. If a user reports a technical issue, advise them to clear cache, try a different browser, or contact technical support
6. NEVER encourage gambling or provide betting strategies
7. For account issues (login, verification), guide users through the standard process
8. If a question requires human intervention, politely explain that an agent will review their case
9. Keep responses concise (under 200 words when possible)
10. Always maintain a helpful but professional tone

DEPOSIT INFORMATION:
- Minimum deposit varies by currency (KES: 350, NGN: 6,500, GHS: 600, ZAR: 125, USD: 3, GBP: 2, EUR: 3)
- Deposits are processed via M-Pesa (Kenya) and other payment methods
- Pending deposits require manual approval by admin
- Check transaction status in Profile > Deposits tab

WITHDRAWAL INFORMATION:
- Withdrawals are processed to the user's registered payment method
- Pending withdrawals require admin approval
- Processing times vary (usually within 24-48 hours)
- Check transaction status in Profile > Withdrawals tab

COMMON ISSUES:
- Transaction pending: Wait for admin approval, check transaction history
- Payment failed: Verify payment details, try again, or contact support
- Account locked: Contact support for assistance
- Balance not updated: Refresh page, check transaction history

If you cannot answer a question or it requires human intervention, say: "I'll need to connect you with a human agent who can better assist you with this matter. An agent will review your message and get back to you shortly."`;

// Generate AI response using OpenAI
async function generateAIResponse(userMessage, conversationHistory = []) {
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not configured, using fallback response');
    return getFallbackResponse(userMessage);
  }

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-6).map(msg => ({
        role: msg.from === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      { role: 'user', content: userMessage }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 300,
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      return getFallbackResponse(userMessage);
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return getFallbackResponse(userMessage);
  }
}

// Fallback responses when AI is unavailable
function getFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('deposit') || lowerMessage.includes('depos')) {
    return 'For deposit-related questions, please check your transaction history in the Profile > Deposits tab. If your deposit is pending, it requires admin approval. If you have specific issues, I can connect you with a human agent.';
  }
  
  if (lowerMessage.includes('withdraw') || lowerMessage.includes('cash out')) {
    return 'For withdrawal-related questions, please check your transaction history in the Profile > Withdrawals tab. Pending withdrawals require admin approval. Processing typically takes 24-48 hours. If you have specific issues, I can connect you with a human agent.';
  }
  
  if (lowerMessage.includes('login') || lowerMessage.includes('password') || lowerMessage.includes('account')) {
    return 'For account and login issues, please try clearing your browser cache or using a different browser. If the issue persists, I can connect you with a human agent for assistance.';
  }
  
  if (lowerMessage.includes('pending') || lowerMessage.includes('status')) {
    return 'To check your transaction status, please visit your Profile and view the Deposits or Withdrawals tab. Pending transactions require admin approval.';
  }
  
  return 'Thank you for your message. I can help with deposit, withdrawal, and general site questions. If you need specific assistance, I can connect you with a human agent who will review your case.';
}

// Create or get conversation
async function getOrCreateConversation(userId, username, sessionId) {
  let conversation = await SupportConversation.findOne({
    sessionId,
    status: 'open'
  });

  if (!conversation) {
    conversation = new SupportConversation({
      userId: userId || null,
      username: username || 'Guest',
      sessionId,
      messages: [],
      status: 'open'
    });

    // Post to Slack for new conversation
    const slackText = `🆕 *New Support Conversation*\nUser: ${username || 'Guest'}\nSession: ${sessionId}\nTime: ${new Date().toLocaleString()}`;
    const threadTs = await postSlackThread(process.env.SLACK_SUPPORT_CHANNEL, slackText);
    
    if (threadTs) {
      conversation.slackThreadTs = threadTs;
      conversation.slackChannel = process.env.SLACK_SUPPORT_CHANNEL;
    }

    await conversation.save();
  }

  return conversation;
}

// Send message endpoint
router.post('/message', [
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('sessionId').trim().notEmpty().withMessage('Session ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { message, sessionId } = req.body;
    const userId = req.user?.id || null;
    const username = req.user?.username || req.body.username || 'Guest';

    // Get or create conversation
    const conversation = await getOrCreateConversation(userId, username, sessionId);

    // Add user message
    conversation.messages.push({
      from: 'user',
      text: message,
      createdAt: new Date()
    });

    // Post user message to Slack thread
    if (conversation.slackThreadTs && conversation.slackChannel) {
      const userSlackText = `👤 *${username}*: ${message}`;
      await postSlackThread(conversation.slackChannel, userSlackText, conversation.slackThreadTs);
    }

    // Generate AI response
    const conversationHistory = conversation.messages.slice(-10);
    const aiResponse = await generateAIResponse(message, conversationHistory);

    // Add AI response to conversation
    conversation.messages.push({
      from: 'agent',
      text: aiResponse,
      createdAt: new Date()
    });

    // Post AI response to Slack thread
    if (conversation.slackThreadTs && conversation.slackChannel) {
      const botSlackText = `🤖 *AI Agent*: ${aiResponse}`;
      await postSlackThread(conversation.slackChannel, botSlackText, conversation.slackThreadTs);
    }

    await conversation.save();

    res.json({
      success: true,
      message: aiResponse,
      conversationId: conversation._id
    });
  } catch (error) {
    console.error('Support message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get conversation history
router.get('/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversation = await SupportConversation.findOne({
      sessionId,
      status: 'open'
    });

    if (!conversation) {
      return res.json({ messages: [] });
    }

    res.json({
      messages: conversation.messages,
      conversationId: conversation._id
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Close conversation
router.post('/close/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversation = await SupportConversation.findOneAndUpdate(
      { sessionId, status: 'open' },
      { status: 'closed' },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Notify Slack
    if (conversation.slackThreadTs && conversation.slackChannel) {
      const closeText = `✅ *Conversation Closed*\nSession: ${sessionId}\nTime: ${new Date().toLocaleString()}`;
      await postSlackThread(conversation.slackChannel, closeText, conversation.slackThreadTs);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Close conversation error:', error);
    res.status(500).json({ error: 'Failed to close conversation' });
  }
});

// Escalate to human agent
router.post('/escalate/:sessionId', [
  body('reason').trim().notEmpty().withMessage('Reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { sessionId } = req.params;
    const { reason } = req.body;

    const conversation = await SupportConversation.findOne({
      sessionId,
      status: 'open'
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Notify Slack about escalation
    if (conversation.slackThreadTs && conversation.slackChannel) {
      const escalateText = `🚨 *Escalated to Human Agent*\nReason: ${reason}\nSession: ${sessionId}\nPlease review this conversation.`;
      await postSlackThread(conversation.slackChannel, escalateText, conversation.slackThreadTs);
    }

    res.json({ success: true, message: 'Escalated to human agent' });
  } catch (error) {
    console.error('Escalate error:', error);
    res.status(500).json({ error: 'Failed to escalate' });
  }
});

module.exports = router;
