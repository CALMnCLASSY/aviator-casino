const nodemailer = require('nodemailer');

/**
 * Email Service Utility
 * Handles sending emails using Gmail SMTP
 */

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // classybetcasino@gmail.com
        password: process.env.EMAIL_PASSWORD // Google App Password
    }
});

/**
 * Send OTP Email
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit OTP code intent
 */
const sendOTPEmail = async (email, otp) => {
    try {
        const mailOptions = {
            from: `"ClassyBet Casino" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Email Verification - ClassyBet Casino',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #fff; background-color: #1a1a1a; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #30fcbe; margin: 0;">ClassyBet</h1>
            <p style="color: #ccc; margin-top: 5px;">Your ultimate gaming experience</p>
          </div>
          <div style="background-color: #2a2a2a; padding: 30px; border-radius: 8px; text-align: center;">
            <h2 style="color: #fff; margin-top: 0;">Verify Your Email</h2>
            <p style="color: #ccc; font-size: 16px;">Please use the following code to verify your registration:</p>
            <div style="font-size: 36px; font-weight: bold; color: #30fcbe; letter-spacing: 5px; margin: 30px 0; padding: 15px; border: 2px dashed #30fcbe; border-radius: 5px; display: inline-block;">
              ${otp}
            </div>
            <p style="color: #888; font-size: 14px;">This code will expire in 10 minutes.</p>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">
            If you did not request this code, please ignore this email.
          </p>
        </div>
      `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ OTP Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending OTP email:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendOTPEmail
};
