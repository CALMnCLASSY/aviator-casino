/**
 * Flutterwave Payment Integration – Frontend
 * Primary payment provider. Paystack is the automatic fallback.
 *
 * Requires: API_BASE global to be defined before this script loads.
 */

'use strict';

const FLW_PUBLIC_KEY = 'FLWPUBK-e450961746a39675aadee69fea53e983-X';

// ─── Currency helpers (kept in sync with paystack-payment.js) ─────────────

const FLW_CURRENCY_LIMITS = {
    KES: { min: 499,   max: 150000,  symbol: 'KSh' },
    NGN: { min: 5000,  max: 500000,  symbol: '₦'   },
    GHS: { min: 50,    max: 5000,    symbol: 'GH₵'  },
    ZAR: { min: 100,   max: 50000,   symbol: 'R'   },
    USD: { min: 5,     max: 10000,   symbol: '$'   },
    GBP: { min: 4,     max: 8000,    symbol: '£'   },
    EUR: { min: 5,     max: 9000,    symbol: '€'   }
};

function flwFormatCurrency(amount, currency = 'KES') {
    const limits = FLW_CURRENCY_LIMITS[currency] || FLW_CURRENCY_LIMITS.USD;
    return `${limits.symbol} ${parseFloat(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    })}`;
}

function flwGetCurrencyLimits(currency = 'KES') {
    return FLW_CURRENCY_LIMITS[currency] || FLW_CURRENCY_LIMITS.USD;
}

// ─── Show loading overlay while payment window opens ─────────────────────

function _showFlwLoading(show) {
    let overlay = document.getElementById('flw-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'flw-loading-overlay';
        overlay.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(8,12,24,.85);z-index:99999;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            font-family:'Inter',sans-serif;color:#fff;
        `;
        overlay.innerHTML = `
            <div style="width:60px;height:60px;border:4px solid rgba(255,255,255,.15);
                        border-top-color:#30fcbe;border-radius:50%;
                        animation:flwSpin 0.8s linear infinite;margin-bottom:20px"></div>
            <p style="font-size:1.1rem;color:#30fcbe;font-weight:600">Opening payment…</p>
            <p style="font-size:.85rem;color:#aaa;margin-top:6px">You will be redirected to Flutterwave's secure checkout</p>
            <style>@keyframes flwSpin{to{transform:rotate(360deg)}}</style>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = show ? 'flex' : 'none';
}

// ─── Main: initialize deposit ─────────────────────────────────────────────

/**
 * Primary entry-point, called from handleDepositSubmit() in every page.
 * Returns a promise that resolves when the flow is complete.
 */
async function initiateFlutterwaveDeposit(amount) {
    const token    = localStorage.getItem('user_token');
    const userData = (() => {
        try { return JSON.parse(localStorage.getItem('userData')); } catch { return null; }
    })();

    if (!userData || !token) {
        throw new Error('Please login to make a deposit');
    }

    const currency = userData.currency || 'KES';
    const limits   = flwGetCurrencyLimits(currency);

    if (amount < limits.min || amount > limits.max) {
        throw new Error(
            `Amount must be between ${flwFormatCurrency(limits.min, currency)} and ${flwFormatCurrency(limits.max, currency)}`
        );
    }

    console.log('🔄 Initializing Flutterwave deposit:', { amount, currency });
    _showFlwLoading(true);

    try {
        // ── Step 1: call our backend to create the pending transaction ────
        const initResp = await fetch(`${API_BASE}/api/payments/flw-deposit-initialize`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ amount: parseFloat(amount) })
        });

        const initData = await initResp.json();

        if (!initResp.ok || !initData.success) {
            throw new Error(initData.error || 'Failed to initialize payment');
        }

        _showFlwLoading(false);

        // ── Step 2a: Paystack fallback ─────────────────────────────────
        if (initData.provider === 'paystack' || initData.fallback) {
            console.log('⚠️  Flutterwave unavailable – falling back to Paystack');
            _openPaystackFallback(initData.data, userData, initData.data.currency);
            return;
        }

        // ── Step 2b: Open Flutterwave inline widget ───────────────────
        const { authorization_url, reference } = initData.data;

        _openFlutterwaveWidget({
            amount,
            currency,
            email:        userData.email || `${userData.username}@ClassyBet.com`,
            reference,
            name:         userData.username,
            phone:        userData.phone || '',
            redirect_url: authorization_url   // used for the modal's hosted-link fallback
        });

    } catch (error) {
        _showFlwLoading(false);
        console.error('❌ Flutterwave deposit error:', error);
        throw error;
    }
}

// ─── Flutterwave inline widget ────────────────────────────────────────────

function _openFlutterwaveWidget(params) {
    const { amount, currency, email, reference, name, phone } = params;

    // Make sure the Flutterwave inline SDK is loaded
    if (typeof FlutterwaveCheckout === 'undefined') {
        // SDK not yet loaded – load it on-the-fly then retry
        const script  = document.createElement('script');
        script.src    = 'https://checkout.flutterwave.com/v3.js';
        script.onload = () => _openFlutterwaveWidget(params);
        script.onerror = () => {
            _showFlwLoading(false);
            _showFlwNotification('Failed to load Flutterwave SDK. Please refresh and try again.', 'error');
        };
        document.head.appendChild(script);
        return;
    }

    FlutterwaveCheckout({
        public_key:    FLW_PUBLIC_KEY,
        tx_ref:        reference,
        amount:        amount,
        currency:      currency,
        payment_options: 'card,mobilemoney,ussd,banktransfer,mpesa,barter',
        customer: {
            email:        email,
            phonenumber:  phone,
            name:         name
        },
        customizations: {
            title:       'ClassyBet Deposit',
            description: `Deposit of ${currency} ${amount}`,
            logo:        'https://classybetaviator.com/images/classybetcasino-logo.jpeg'
        },
        callback: function (data) {
            console.log('✅ Flutterwave payment callback:', data);
            if (data.status === 'successful' || data.status === 'completed') {
                verifyFlutterwavePayment(reference, data.transaction_id);
            } else {
                _showFlwNotification('Payment was not completed. Please try again.', 'warning');
            }
        },
        onclose: function () {
            console.log('Flutterwave payment popup closed');
        }
    });
}

// ─── Verify with backend after success callback ───────────────────────────

async function verifyFlutterwavePayment(reference, transactionId) {
    try {
        const token = localStorage.getItem('user_token');
        _showFlwLoading(true);

        console.log('🔍 Verifying Flutterwave payment:', reference, transactionId);

        const response = await fetch(`${API_BASE}/api/payments/flw-deposit-verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ reference, transaction_id: String(transactionId) })
        });

        const data = await response.json();
        _showFlwLoading(false);

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Payment verification failed');
        }

        console.log('✅ Flutterwave payment verified');

        // ── Update balance everywhere ─────────────────────────────────
        const userData = (() => {
            try { return JSON.parse(localStorage.getItem('userData')); } catch { return null; }
        })();
        const currency = userData?.currency || 'KES';

        if (typeof updateBalanceDisplay === 'function') {
            updateBalanceDisplay(data.newBalance);
        } else {
            // Inline balance update as fallback
            if (userData) {
                userData.balance = data.newBalance;
                localStorage.setItem('userData', JSON.stringify(userData));
            }
            // Update all common balance DOM nodes
            [
                document.getElementById('headerBalance'),
                document.getElementById('balance-amount'),
                document.getElementById('nav-balance'),
                document.getElementById('mobile-balance'),
                document.getElementById('message-balance'),
                document.querySelector('.balance-amount')
            ].forEach(el => {
                if (el) el.textContent = flwFormatCurrency(data.newBalance, currency);
            });

            // Also update the AviatorGame instance if on the game page
            if (window.aviatorGame) {
                window.aviatorGame.playerBalance = data.newBalance;
                window.aviatorGame.updateBalance();
            }
        }

        _showFlwNotification(
            `✅ Deposit successful! New balance: ${flwFormatCurrency(data.newBalance, currency)}`,
            'success'
        );

        // Reload profile if the function exists (profile page)
        if (typeof loadUserProfile === 'function') {
            await loadUserProfile();
        }

        // Close deposit modal
        const depositModal = document.getElementById('deposit-modal');
        if (depositModal) depositModal.style.display = 'none';

    } catch (error) {
        _showFlwLoading(false);
        console.error('❌ Flutterwave verification error:', error);
        _showFlwNotification(error.message || 'Payment verification failed', 'error');
    }
}

// ─── Paystack fallback (when Flutterwave is down) ─────────────────────────

function _openPaystackFallback(paymentData, userData, currency) {
    if (typeof PaystackPop === 'undefined') {
        // Load Paystack SDK on-the-fly
        const script  = document.createElement('script');
        script.src    = 'https://js.paystack.co/v1/inline.js';
        script.onload = () => _openPaystackFallback(paymentData, userData, currency);
        script.onerror = () => {
            _showFlwNotification('Both payment providers are unavailable. Please try again later.', 'error');
        };
        document.head.appendChild(script);
        return;
    }

    const PAYSTACK_PUBLIC_KEY_FB = 'pk_live_4b4f3a0ed97c13680b6a29897e6624734c072f54';
    const amountInMinor = Math.round(parseFloat(paymentData.amount) * 100);
    const channels = (currency === 'KES')
        ? ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer', 'eft']
        : ['card', 'bank'];

    const handler = PaystackPop.setup({
        key:      PAYSTACK_PUBLIC_KEY_FB,
        email:    userData.email || `${userData.username}@ClassyBet.com`,
        amount:   amountInMinor,
        currency: currency,
        ref:      paymentData.reference,
        channels,
        callback: function (response) {
            console.log('✅ Paystack fallback payment:', response.reference);
            _verifyPaystackFallback(response.reference);
        },
        onClose: function () {
            _showFlwNotification('Payment cancelled', 'warning');
        }
    });
    handler.openIframe();
}

async function _verifyPaystackFallback(reference) {
    try {
        const token = localStorage.getItem('user_token');
        _showFlwLoading(true);

        const response = await fetch(`${API_BASE}/api/payments/deposit-verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ reference })
        });

        const data = await response.json();
        _showFlwLoading(false);

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Payment verification failed');
        }

        const userData = (() => {
            try { return JSON.parse(localStorage.getItem('userData')); } catch { return null; }
        })();
        const currency = userData?.currency || 'KES';

        if (typeof updateBalanceDisplay === 'function') {
            updateBalanceDisplay(data.newBalance);
        } else {
            if (userData) {
                userData.balance = data.newBalance;
                localStorage.setItem('userData', JSON.stringify(userData));
            }
            [
                document.getElementById('headerBalance'),
                document.getElementById('balance-amount'),
                document.getElementById('nav-balance'),
                document.getElementById('mobile-balance'),
                document.querySelector('.balance-amount')
            ].forEach(el => {
                if (el) el.textContent = flwFormatCurrency(data.newBalance, currency);
            });
            if (window.aviatorGame) {
                window.aviatorGame.playerBalance = data.newBalance;
                window.aviatorGame.updateBalance();
            }
        }

        _showFlwNotification(
            `✅ Deposit successful! New balance: ${flwFormatCurrency(data.newBalance, currency)}`,
            'success'
        );

        const depositModal = document.getElementById('deposit-modal');
        if (depositModal) depositModal.style.display = 'none';

    } catch (error) {
        _showFlwLoading(false);
        _showFlwNotification(error.message || 'Verification failed', 'error');
    }
}

// ─── Notification helper ──────────────────────────────────────────────────

function _showFlwNotification(message, type = 'info') {
    const colorMap = { success: '#30fcbe', error: '#ff4757', warning: '#ffa502', info: '#fff' };

    // Try page-specific helpers first
    if (type === 'success' && typeof showSuccess === 'function') {
        return showSuccess('deposit-success', message);
    }
    if (type === 'error' && typeof showError === 'function') {
        return showError('deposit-error', message);
    }

    // Generic toast
    let toast = document.getElementById('flw-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'flw-toast';
        toast.style.cssText = `
            position:fixed;bottom:30px;right:24px;z-index:99998;
            padding:14px 22px;border-radius:12px;font-size:.95rem;
            font-family:'Inter',sans-serif;font-weight:500;
            box-shadow:0 8px 24px rgba(0,0,0,.4);
            background:rgba(15,20,35,.97);border:1px solid;
            transition:opacity .4s;max-width:360px;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent    = message;
    toast.style.color    = colorMap[type] || '#fff';
    toast.style.borderColor = colorMap[type] || '#555';
    toast.style.opacity  = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 5000);
}

// ─── Exports ──────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.initiateFlutterwaveDeposit = initiateFlutterwaveDeposit;
    window.verifyFlutterwavePayment   = verifyFlutterwavePayment;
    window.flwFormatCurrency          = flwFormatCurrency;
    window.flwGetCurrencyLimits       = flwGetCurrencyLimits;

    // Expose as the shared initiatePaystackDeposit alias so existing call-sites
    // that reference initiatePaystackDeposit automatically use Flutterwave instead.
    window.initiatePaystackDeposit = initiateFlutterwaveDeposit;
}
