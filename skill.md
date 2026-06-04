# Skill Guide: Multi-Currency Payment & Backend Casino Game Integration

This guide provides a comprehensive, step-by-step set of instructions for a developer or AI agent to replicate the payment gateway setup, backend casino balance syncing, and regional currency formatting on another casino project.

---

## 1. Setup Primary Flutterwave with Paystack Fallback

### A. Backend Implementation (`routes/payments.js` & services)
1. **Create the Exchange Rate Service**:
   - Create `services/ExchangeRateService.js` to fetch live exchange rates relative to USD from a public API (e.g., `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json`) and cache them.
   - Implement `getRate(currencyCode)` to return the rate (e.g. 1 USD = 278 PKR).
   - Start daily cron/periodic updates on server startup.
2. **Implement Currency Conversion Logic**:
   - In a utility file (e.g., `utils/currencyConfig.js`), list currencies supported directly by Flutterwave (`FLUTTERWAVE_CURRENCIES`).
   - Implement `convertToFlutterwaveCurrency(amount, fromCurrency)`:
     - If the currency is supported directly, return it unchanged.
     - If unsupported, fetch the live rate via `ExchangeRateService.getRate(fromCurrency)`, convert the amount to USD, set the billing currency to `'USD'`, and set the metadata fields.
3. **Register Backend Endpoints**:
   - `/api/payments/flw-deposit-initialize`: 
     - Authenticate the user and check the user's currency.
     - Convert the requested amount to the target billing currency using `convertToFlutterwaveCurrency`.
     - Create a pending transaction record storing the original home currency and amount.
     - Initialize a Flutterwave widget payload (including `public_key`, `tx_ref`, `amount`, `currency`, `customer` info).
     - If Flutterwave initialization fails, **automatically fall back to Paystack** by calling the Paystack initialize logic, returning a fallback response payload.
   - `/api/payments/flw-deposit-verify`:
     - Verify the payment using Flutterwave's transaction verification API (`GET /transactions/:id/verify`) or webhook hash matching.
     - Retrieve the original reference amount from the database transaction record and credit the user's account balance in their **home currency** (NOT the USD converted amount).
   - `/api/payments/flw-deposit-status`:
     - Poll the database transaction record status and return the updated balance upon completion.

### B. Client-side Implementation (`flutterwave-payment.js` & `paystack-payment.js`)
1. **Scope Variables & Functions (IIFE wrapping)**:
   - Wrap both `paystack-payment.js` and `flutterwave-payment.js` in Immediately Invoked Function Expressions (IIFEs) to prevent global variable/function declaration hoisting conflicts.
   - Export required public entrypoints (e.g., `initiatePaystackDeposit`, `initiateFlutterwaveDeposit`) explicitly to the `window` object.
2. **Guard Global Overwrites**:
   - Inside `paystack-payment.js`, only assign utility formatting functions (`formatCurrency`, `updateBalanceDisplay`, `getUserCurrency`) to the `window` object if they do not already exist on `window`.
   - Save the unaliased local Paystack deposit initialization as `window.initiateOriginalPaystackDeposit`.
3. **Graceful Client-side Fallback**:
   - In `flutterwave-payment.js`, if the dynamic loading of Flutterwave's SDK (`checkout.flutterwave.com/v3.js`) fails (which commonly happens due to client-side adblockers or regional ISP blocks), catch the failure inside the script's `onerror` handler.
   - Intercept this failure, notify the user, and immediately trigger the Paystack fallback checkout by calling `window.initiateOriginalPaystackDeposit(amount)`.

---

## 2. Syncing Casino Games with Backend Balance

### A. Base Game Class Refactoring (`casino-game.js`)
1. **Retrieve Token & Host dynamically**:
   - Resolve the backend hostname/API URL dynamically based on the current `window.location.hostname` (e.g. local vs production).
   - Look up the auth token under the correct key (e.g., `user_token`) in `localStorage`.
2. **Place Bets & Win Handlers**:
   - Implement `placeBetOnGame(amount, description)`:
     - Check if the user has sufficient balance.
     - Deduct the bet amount from the client-side state.
     - Send a POST request to `/api/user/balance/update` to persist the deduction.
     - Call `/api/game/record-transaction` to log the transaction history.
   - Implement `winBetOnGame(winAmount, description)`:
     - Add the win amount to the client-side balance.
     - Persist the increase to the database by calling `/api/user/balance/update`.
     - Log the win transaction via `/api/game/record-transaction`.
3. **Connect Game Implementations**:
   - Modify the specific game scripts (e.g., `mines-game.js`, `blackjack-game.js`, `jetx-game.js`, etc.) to call `this.placeBetOnGame` on round start and `this.winBetOnGame` on cashout or win conditions.
   - Resolve any code crashes (e.g., casting parameters using `parseFloat()` in `jetx-game.js` before calling `.toFixed(2)`).

---

## 3. Setting Up Regional Currencies & Formatting

### A. Centralized Currency Configuration (`currency-utils.js`)
1. **Import Full Currency Mapping**:
   - Expand the `CURRENCY_SYMBOLS` map in the frontend `currency-utils.js` script to match all 93 symbols defined on the backend (e.g., `PKR: '₨'`).
2. **Delegate Formatting**:
   - In `dashboard.html`, guard the local/inline `formatCurrency` helper. If `window.formatCurrency` is defined, call the centralized helper instead of formatting locally.
   - In `flutterwave-payment.js`, make `flwFormatCurrency` delegate to `window.formatCurrency` to avoid using a restricted local currency symbol map.
   - In `casino-game.js`, update `getCurrencySymbol` to check `window.getCurrencySymbol` first, so the game UI inherits the centralized symbol map.

### B. Replace Static "KES" References in HTML
1. **Create DOM Walker**:
   - In the base `CasinoGame` class, add a helper method `replaceKESInDOM()`.
   - Use `document.createTreeWalker` to walk through all text nodes in the document body.
   - Replace any occurrences of `'KES'`, `'KSh'`, or similar hardcoded currency strings with the active user's currency symbol.
   - Traverse input labels, placeholders, lists, and headers. Run this function on window load.

---

## 4. Other Key Fixes

### A. AI Chatbot Handover & Support
1. **Bot Muting on Handoff**:
   - When a human admin replies or escalates a support chat, flag the database session (e.g., `isMuted: true` or `agentHandover: true`).
   - In the AI response hook, check this flag before allowing the AI model to respond, so it doesn't interrupt human replies.
2. **Real-time human chat updates**:
   - Implement a polling/SSE/WebSocket listener on the frontend support chat widget to pull messages from the backend database periodically, so the client receives admin responses in real-time.
