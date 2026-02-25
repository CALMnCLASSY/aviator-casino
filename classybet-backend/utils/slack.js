const crypto = require('crypto');

// ─── Legacy webhook helper (used by other notification channels) ───
async function sendSlackMessage(webhook, text) {
  if (!webhook) {
    console.warn('Slack webhook missing, skipping:', text);
    return;
  }

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error('Slack notification failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error.message);
  }
}

// ─── Slack Web API: post a message (optionally in a thread) ───
async function postSlackThread(channel, text, threadTs = null) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn('SLACK_BOT_TOKEN missing, falling back to webhook');
    // fallback: fire-and-forget via support webhook
    await sendSlackMessage(process.env.SLACK_WEBHOOK_SUPPORT, text);
    return null;
  }

  const body = {
    channel,
    text,
    ...(threadTs ? { thread_ts: threadTs } : {})
  };

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack API error:', data.error);
      return null;
    }

    return data.ts; // message timestamp (used as thread_ts for replies)
  } catch (error) {
    console.error('Error posting to Slack API:', error.message);
    return null;
  }
}

// ─── Verify Slack request signature ───
function verifySlackSignature(req) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const timestamp = req.headers['x-slack-request-timestamp'];
  const slackSig = req.headers['x-slack-signature'];
  if (!timestamp || !slackSig) return false;

  // Reject requests older than 5 minutes
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;

  const sigBasestring = `v0:${timestamp}:${req.rawBody}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(slackSig, 'utf8')
  );
}

module.exports = { sendSlackMessage, postSlackThread, verifySlackSignature };