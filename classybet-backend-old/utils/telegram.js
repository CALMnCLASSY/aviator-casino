const axios = require('axios');

const sendTelegramNotification = async (message) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ADMIN_CHAT_ID) {
      console.log('Telegram not configured, skipping notification:', message);
      return;
    }

    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    await axios.post(url, {
      chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });

    console.log('Telegram notification sent successfully');
  } catch (error) {
    console.error('Telegram notification failed:', error.message);
  }
};

module.exports = {
  sendTelegramNotification
};