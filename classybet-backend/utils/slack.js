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

module.exports = { sendSlackMessage };