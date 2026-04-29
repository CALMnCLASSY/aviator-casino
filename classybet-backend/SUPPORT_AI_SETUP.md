# AI-Powered Support Chat Setup Guide

This document explains how to set up and configure the AI-powered support chat system for ClassyBet.

## Overview

The support chat system now includes:
- **AI Chatbot**: Automatically responds to customer queries using OpenAI's GPT-3.5-turbo
- **Slack Integration**: All conversations are still sent to your Slack support channel for visibility
- **Policy Compliance**: The AI is configured to follow strict guidelines and company policies
- **Fallback System**: Works even without OpenAI API key using predefined responses

## Features

### AI Capabilities
- Answers deposit and withdrawal questions
- Provides guidance on transaction status checks
- Helps with account and login issues
- Escalates to human agents when needed
- Maintains conversation context for better responses

### Slack Integration
- All user messages are posted to your Slack support channel
- AI responses are also visible in Slack threads
- Human agents can reply via Slack and responses will appear in the chat
- Full conversation history is maintained

### Policy Compliance
The AI is configured with strict guidelines:
- Never shares sensitive information
- Never makes promises about processing times
- Never encourages gambling
- Always maintains professional tone
- Escalates complex issues to human agents

## Installation

### 1. Install Dependencies

```bash
cd classybet-backend
npm install openai
```

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Slack Configuration (existing)
SLACK_SUPPORT_CHANNEL_ID=C1234567890
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_WEBHOOK_SUPPORT=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3. Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and add it to your `.env` file

**Note**: Without `OPENAI_API_KEY`, the system will use fallback responses which are less intelligent but still functional.

## Integration

### Embedding the Chat Widget

To add the chat widget to your pages, use one of these methods:

#### Method 1: Iframe (Recommended)

```html
<iframe 
    src="/support-chat-widget.html" 
    style="position: fixed; bottom: 0; right: 0; width: 100%; height: 100%; border: none; z-index: 9999; pointer-events: none;"
    allow="clipboard-read; clipboard-write">
</iframe>

<script>
// Make the iframe clickable only on the chat widget
const iframe = document.querySelector('iframe');
iframe.style.pointerEvents = 'none';
iframe.addEventListener('load', () => {
    iframe.contentWindow.document.querySelector('.chat-widget').style.pointerEvents = 'auto';
});
</script>
```

#### Method 2: Direct Embed

Copy the contents of `public/support-chat-widget.html` and paste it into your existing pages before the closing `</body>` tag.

#### Method 3: JavaScript Widget

```html
<script>
(function() {
    const script = document.createElement('script');
    script.src = '/support-chat-widget.js';
    document.body.appendChild(script);
})();
</script>
```

## Configuration Options

### AI Model Settings

You can modify the AI settings in `server.js` (lines 170-175):

```javascript
body: JSON.stringify({
    model: 'gpt-3.5-turbo',  // Change to 'gpt-4' for better responses
    messages,
    max_tokens: 300,         // Increase for longer responses
    temperature: 0.7         // 0 = more deterministic, 1 = more creative
})
```

### System Prompt Customization

The AI's behavior is controlled by the system prompt in `server.js` (lines 111-143). You can modify:
- Company information
- Deposit/withdrawal policies
- Common issues and solutions
- Escalation criteria

### Fallback Responses

Fallback responses are in `server.js` (lines 192-212). These are used when:
- OpenAI API key is not configured
- API call fails
- Rate limit is reached

## API Endpoints

### POST /api/support/chat
Send a message to the support chat.

**Request:**
```json
{
    "message": "My deposit is pending",
    "sessionId": "sess_abc123_1234567890",
    "conversationId": "507f1f77bcf86cd799439011",
    "meta": {
        "username": "john_doe",
        "email": "john@example.com",
        "phone": "+254712345678"
    }
}
```

**Response:**
```json
{
    "success": true,
    "conversationId": "507f1f77bcf86cd799439011",
    "sessionId": "sess_abc123_1234567890",
    "messages": [
        {
            "from": "user",
            "text": "My deposit is pending",
            "createdAt": "2026-04-27T06:00:00.000Z"
        },
        {
            "from": "agent",
            "text": "For deposit-related questions...",
            "createdAt": "2026-04-27T06:00:01.000Z"
        }
    ]
}
```

### GET /api/support/conversation/current
Get the current open conversation for the user.

**Query Parameters:**
- `sessionId` (optional): Session ID for guest users

### GET /api/support/conversation/:id/updates
Poll for new messages in a conversation.

**Query Parameters:**
- `since` (optional): ISO date string to get messages after this time

### POST /api/support/slack-events
Webhook endpoint for Slack events (replies from human agents).

## Slack Setup

### Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app
3. Enable the following features:
   - **Incoming Webhooks**: For sending messages to Slack
   - **Bot User**: For posting messages and receiving events
   - **Event Subscriptions**: For receiving replies from Slack

### Configure Bot Permissions

Required OAuth scopes:
- `chat:write` - Post messages
- `channels:history` - Read channel history
- `channels:join` - Join channels

Required Bot Token Scopes:
- `chat:write`
- `channels:history`
- `channels:join`

### Subscribe to Events

Subscribe to these events:
- `message.channels` - To receive replies from agents

### Enable Interactive Components

If you want to add quick actions or buttons in Slack, enable interactive components.

## Testing

### Test Without OpenAI API Key

The system will work with fallback responses:
```bash
# Remove OPENAI_API_KEY from .env
# Restart server
npm start
# Chat will use predefined responses
```

### Test With OpenAI API Key

```bash
# Add OPENAI_API_KEY to .env
# Restart server
npm start
# Chat will use AI responses
```

### Test Slack Integration

1. Send a message via the chat widget
2. Check your Slack support channel
3. You should see the conversation thread
4. Reply in Slack and check if it appears in the chat

## Monitoring

### View Logs

The system logs:
- AI response generation errors
- Slack API errors
- Conversation creation and updates

```bash
# Check logs for AI errors
grep "OpenAI API error" logs/server.log

# Check logs for Slack errors
grep "Slack API error" logs/server.log
```

### Analytics

You can track:
- Number of conversations
- Response times
- Escalation rate
- Common query types

## Troubleshooting

### AI Not Responding

**Problem**: AI responses not appearing

**Solutions**:
1. Check if `OPENAI_API_KEY` is set in `.env`
2. Verify the API key is valid
3. Check if you have OpenAI credits
4. Check server logs for errors

### Slack Not Receiving Messages

**Problem**: Messages not appearing in Slack

**Solutions**:
1. Verify `SLACK_SUPPORT_CHANNEL_ID` is correct
2. Check `SLACK_BOT_TOKEN` has required permissions
3. Ensure bot is invited to the channel
4. Check Slack app event subscriptions

### Chat Widget Not Loading

**Problem**: Chat widget not appearing on page

**Solutions**:
1. Check if the file path is correct
2. Check browser console for errors
3. Verify CORS settings in server.js
4. Check if the static file is being served

### High API Costs

**Problem**: OpenAI API costs are high

**Solutions**:
1. Reduce `max_tokens` in AI settings
2. Use `gpt-3.5-turbo` instead of `gpt-4`
3. Implement rate limiting per user
4. Cache common responses

## Security Considerations

1. **API Key Security**: Never commit `.env` file to version control
2. **Rate Limiting**: The system has built-in rate limiting (200 requests per 15 minutes)
3. **Input Validation**: All user inputs are validated
4. **Slack Verification**: Slack webhook signatures are verified
5. **CORS**: Configure allowed origins in production

## Performance Optimization

1. **Response Caching**: Cache common AI responses
2. **Connection Pooling**: Use connection pooling for database
3. **Lazy Loading**: Load chat widget only when needed
4. **CDN**: Serve static files via CDN in production

## Future Enhancements

Potential improvements:
- Multi-language support
- Sentiment analysis
- Automatic ticket creation
- Integration with CRM
- Voice support
- File attachment support
- Video chat
- Co-browsing
- Knowledge base integration

## Support

For issues or questions:
1. Check server logs
2. Review this documentation
3. Check OpenAI API status
4. Check Slack API status
5. Contact development team

## Cost Estimates

### OpenAI API Costs (as of 2026)

**GPT-3.5-turbo**:
- Input: $0.50 per 1M tokens
- Output: $1.50 per 1M tokens
- Estimated cost per 1000 conversations: ~$0.10-0.30

**GPT-4**:
- Input: $30 per 1M tokens
- Output: $60 per 1M tokens
- Estimated cost per 1000 conversations: ~$5-15

### Slack Costs

- Free tier: Up to 10,000 messages
- Pro tier: $8/user/month

## License

This support chat system is part of ClassyBet and is subject to the same license terms.
