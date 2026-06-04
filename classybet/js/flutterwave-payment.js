/**
 * Flutterwave Payment Integration – Frontend
 * Primary payment provider. Paystack is the automatic fallback.
 *
 * Architecture: No secret key needed.
 *   - Backend creates a pending DB transaction and returns widget params
 *   - Frontend opens Flutterwave inline widget with the PUBLIC key
 *   - Balance is credited automatically via Flutterwave webhook (hash-verified)
 *   - Status polling provides immediate UI feedback after widget closes
 *
 * Requires: API_BASE global to be defined before this script loads.
 */

'use strict';

const FLW_PUBLIC_KEY = 'FLWPUBK-e450961746a39675aadee69fea53e983-X';

// ─── Currency helpers ──────────────────────────────────────────────────────

const FLW_CURRENCY_LIMITS = {
    KES: { min: 499,   max: 150000,  symbol: 'KSh'  },
    NGN: { min: 5000,  max: 500000,  symbol: '₦'    },
    GHS: { min: 50,    max: 5000,    symbol: 'GH₵'  },
    ZAR: { min: 100,   max: 50000,   symbol: 'R'    },
    USD: { min: 5,     max: 10000,   symbol: '$'    },
    GBP: { min: 4,     max: 8000,    symbol: '£'    },
    EUR: { min: 5,     max: 9000,    symbol: '€'    }
};

function flwFormatCurrency(amount, currency) {
    currency = currency || 'KES';
    const limits = FLW_CURRENCY_LIMITS[currency] || FLW_CURRENCY_LIMITS.USD;
    return `${limits.symbol} ${parseFloat(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    })}`;
}

function flwGetCurrencyLimits(currency) {
    return FLW_CURRENCY_LIMITS[currency || 'KES'] || FLW_CURRENCY_LIMITS.USD;
}

// ─── Loading overlay ───────────────────────────────────────────────────────

function _showFlwLoading(show) {
    let overlay = document.getElementById('flw-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'flw-loading-overlay';
        overlay.style.cssText = [
            'position:fixed;top:0;left:0;width:100%;height:100%;',
            'background:rgba(8,12,24,.85);z-index:99999;',
            'display:flex;flex-direction:column;align-items:center;justify-content:center;',
            'font-family:Inter,sans-serif;color:#fff;'
        ].join('');
        overlay.innerHTML = [
            '<div style="width:60px;height:60px;border:4px solid rgba(255,255,255,.15);',
            'border-top-color:#30fcbe;border-radius:50%;',
            'animation:flwSpin 0.8s linear infinite;margin-bottom:20px"></div>',
            '<p style="font-size:1.1rem;color:#30fcbe;font-weight:600">Opening payment\u2026</p>',
            '<p style="font-size:.85rem;color:#aaa;margin-top:6px">Flutterwave secure checkout</p>',
            '<style>@keyframes flwSpin{to{transform:rotate(360deg)}}</style>'
        ].join('');
        document.body.appendChild(overlay);
    }
    overlay.style.display = show ? 'flex' : 'none';
}

// ─── Main entry-point ─────────────────────────────────────────────────────

async function initiateFlutterwaveDeposit(amount) {
    const token    = localStorage.getItem('user_token');
    const userData = (function () {
        try { return JSON.parse(localStorage.getItem('userData')); } catch (e) { return null; }
    }());

    if (!userData || !token) {
        throw new Error('Please login to make a deposit');
    }

    const currency = userData.currency || 'KES';
    const limits   = flwGetCurrencyLimits(currency);

    if (amount < limits.min || amount > limits.max) {
        throw new Error(
            'Amount must be between ' + flwFormatCurrency(limits.min, currency) +
            ' and ' + flwFormatCurrency(limits.max, currency)
        );
    }

    console.log('🔄 Initializing Flutterwave deposit:', { amount: amount, currency: currency });
    _showFlwLoading(true);

    try {
        // Step 1: backend creates pending DB record, returns widget params (no FLW API call)
        var initResp = await fetch(API_BASE + '/api/payments/flw-deposit-initialize', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ amount: parseFloat(amount) })
        });

        var initData = await initResp.json();

        if (!initResp.ok || !initData.success) {
            throw new Error(initData.error || 'Failed to initialize payment');
        }

        _showFlwLoading(false);

        // Step 2a: Paystack fallback (only if FLW init itself failed on backend)
        if (initData.provider === 'paystack' || initData.fallback) {
            console.log('⚠️  Falling back to Paystack');
            _openPaystackFallback(initData.data, userData, initData.data.currency);
            return;
        }

        // Step 2b: Open Flutterwave inline widget — backend supplies all params
        var ref          = initData.data.reference;
        var widgetParams = initData.data.widgetParams;

        if (!widgetParams || !widgetParams.amount) {
            console.error('❌ Invalid Flutterwave configuration received:', initData);
            throw new Error('Server returned incomplete Flutterwave configuration.');
        }

        _openFlutterwaveWidget(ref, widgetParams);

    } catch (error) {
        _showFlwLoading(false);
        console.error('❌ Flutterwave deposit error:', error);
        throw error;
    }
}

// ─── Open widget ───────────────────────────────────────────────────────────

function _openFlutterwaveWidget(reference, widgetParams) {
    if (typeof FlutterwaveCheckout === 'undefined') {
        var script    = document.createElement('script');
        script.src    = 'https://checkout.flutterwave.com/v3.js';
        script.onload = function () { _openFlutterwaveWidget(reference, widgetParams); };
        script.onerror = function () {
            _showFlwLoading(false);
            _showFlwNotification('Failed to load Flutterwave SDK. Please refresh.', 'error');
        };
        document.head.appendChild(script);
        return;
    }

    // Merge backend params; always override callbacks so we control them
    FlutterwaveCheckout(Object.assign({}, widgetParams, {
        public_key: widgetParams.public_key || FLW_PUBLIC_KEY,
        tx_ref:     widgetParams.tx_ref     || reference,

        callback: function (data) {
            console.log('✅ FLW callback status:', data.status, '| tx_id:', data.transaction_id);
            if (data.status === 'successful' || data.status === 'completed') {
                // Try API verify first (needs secret key). On fail, webhook will confirm.
                verifyFlutterwavePayment(reference, data.transaction_id)
                    .catch(function () {
                        _showFlwNotification('✅ Payment received! Balance updating shortly…', 'success');
                        _pollTransactionStatus(reference, 0);
                    });
            } else {
                _showFlwNotification('Payment not completed. Please try again.', 'warning');
            }
        },

        onclose: function () {
            // Silently poll — webhook may fire before or after this
            console.log('FLW popup closed, polling for confirmation…');
            _pollTransactionStatus(reference, 0);
        }
    }));
}

// ─── Poll until webhook confirms ──────────────────────────────────────────

async function _pollTransactionStatus(reference, attempts) {
    attempts = attempts || 0;
    if (attempts >= 10) return; // 30 seconds max

    try {
        var token = localStorage.getItem('user_token');
        var resp  = await fetch(
            API_BASE + '/api/payments/flw-deposit-status?reference=' + encodeURIComponent(reference),
            { headers: { 'Authorization': 'Bearer ' + token } }
        );
        if (!resp.ok) throw new Error('poll failed');
        var data = await resp.json();

        if (data.status === 'completed') {
            _applyBalanceUpdate(data.newBalance);
            _showFlwNotification(
                '✅ Deposit confirmed! New balance: ' + flwFormatCurrency(data.newBalance, data.currency),
                'success'
            );
            var modal = document.getElementById('deposit-modal');
            if (modal) modal.style.display = 'none';
            return;
        }
    } catch (e) { /* silent */ }

    setTimeout(function () { _pollTransactionStatus(reference, attempts + 1); }, 3000);
}

// ─── Verify via backend (secret key path, optional) ───────────────────────

async function verifyFlutterwavePayment(reference, transactionId) {
    var token = localStorage.getItem('user_token');
    _showFlwLoading(true);
    console.log('🔍 Verifying Flutterwave payment:', reference, transactionId);

    var response = await fetch(API_BASE + '/api/payments/flw-deposit-verify', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type':  'application/json'
        },
        body: JSON.stringify({ reference: reference, transaction_id: String(transactionId) })
    });

    var data = await response.json();
    _showFlwLoading(false);

    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Payment verification failed');
    }

    console.log('✅ Flutterwave payment verified');
    _applyBalanceUpdate(data.newBalance);

    var userData = (function () {
        try { return JSON.parse(localStorage.getItem('userData')); } catch (e) { return null; }
    }());
    var currency = (userData && userData.currency) || 'KES';

    _showFlwNotification(
        '✅ Deposit successful! New balance: ' + flwFormatCurrency(data.newBalance, currency),
        'success'
    );

    if (typeof loadUserProfile === 'function') {
        await loadUserProfile();
    }

    var depositModal = document.getElementById('deposit-modal');
    if (depositModal) depositModal.style.display = 'none';
}

// ─── Apply balance to DOM + localStorage ──────────────────────────────────

function _applyBalanceUpdate(newBalance) {
    var userData = (function () {
        try { return JSON.parse(localStorage.getItem('userData')); } catch (e) { return null; }
    }());
    var currency = (userData && userData.currency) || 'KES';

    if (typeof updateBalanceDisplay === 'function') {
        updateBalanceDisplay(newBalance);
        return;
    }

    if (userData) {
        userData.balance = newBalance;
        localStorage.setItem('userData', JSON.stringify(userData));
    }

    [
        document.getElementById('headerBalance'),
        document.getElementById('balance-amount'),
        document.getElementById('nav-balance'),
        document.getElementById('mobile-balance'),
        document.getElementById('message-balance'),
        document.querySelector('.balance-amount')
    ].forEach(function (el) {
        if (el) el.textContent = flwFormatCurrency(newBalance, currency);
    });

    if (window.aviatorGame) {
        window.aviatorGame.playerBalance = newBalance;
        window.aviatorGame.updateBalance();
    }
}

// ─── Paystack fallback ─────────────────────────────────────────────────────

function _openPaystackFallback(paymentData, userData, currency) {
    if (typeof PaystackPop === 'undefined') {
        var script    = document.createElement('script');
        script.src    = 'https://js.paystack.co/v1/inline.js';
        script.onload = function () { _openPaystackFallback(paymentData, userData, currency); };
        script.onerror = function () {
            _showFlwNotification('Both payment providers unavailable. Please try again later.', 'error');
        };
        document.head.appendChild(script);
        return;
    }

    var PAYSTACK_PUBLIC_KEY_FB = 'pk_live_4b4f3a0ed97c13680b6a29897e6624734c072f54';
    var amountInMinor = Math.round(parseFloat(paymentData.amount) * 100);
    var channels = (currency === 'KES')
        ? ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer', 'eft']
        : ['card', 'bank'];

    var handler = PaystackPop.setup({
        key:      PAYSTACK_PUBLIC_KEY_FB,
        email:    userData.email || (userData.username + '@ClassyBet.com'),
        amount:   amountInMinor,
        currency: currency,
        ref:      paymentData.reference,
        channels: channels,
        callback: function (response) {
            console.log('✅ Paystack fallback:', response.reference);
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
        var token = localStorage.getItem('user_token');
        _showFlwLoading(true);

        var response = await fetch(API_BASE + '/api/payments/deposit-verify', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ reference: reference })
        });

        var data = await response.json();
        _showFlwLoading(false);

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Verification failed');
        }

        _applyBalanceUpdate(data.newBalance);

        var userData = (function () {
            try { return JSON.parse(localStorage.getItem('userData')); } catch (e) { return null; }
        }());
        var currency = (userData && userData.currency) || 'KES';

        _showFlwNotification(
            '✅ Deposit successful! New balance: ' + flwFormatCurrency(data.newBalance, currency),
            'success'
        );

        var modal = document.getElementById('deposit-modal');
        if (modal) modal.style.display = 'none';

    } catch (error) {
        _showFlwLoading(false);
        _showFlwNotification(error.message || 'Verification failed', 'error');
    }
}

// ─── Toast notification ───────────────────────────────────────────────────

function _showFlwNotification(message, type) {
    type = type || 'info';
    var colorMap = { success: '#30fcbe', error: '#ff4757', warning: '#ffa502', info: '#fff' };

    if (type === 'success' && typeof showSuccess === 'function') {
        return showSuccess('deposit-success', message);
    }
    if (type === 'error' && typeof showError === 'function') {
        return showError('deposit-error', message);
    }

    var toast = document.getElementById('flw-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'flw-toast';
        toast.style.cssText = [
            'position:fixed;bottom:30px;right:24px;z-index:99998;',
            'padding:14px 22px;border-radius:12px;font-size:.95rem;',
            'font-family:Inter,sans-serif;font-weight:500;',
            'box-shadow:0 8px 24px rgba(0,0,0,.4);',
            'background:rgba(15,20,35,.97);border:1px solid;',
            'transition:opacity .4s;max-width:360px;'
        ].join('');
        document.body.appendChild(toast);
    }

    toast.textContent     = message;
    toast.style.color     = colorMap[type] || '#fff';
    toast.style.borderColor = colorMap[type] || '#555';
    toast.style.opacity   = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { toast.style.opacity = '0'; }, 5000);
}

// ─── Exports ──────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.initiateFlutterwaveDeposit = initiateFlutterwaveDeposit;
    window.verifyFlutterwavePayment   = verifyFlutterwavePayment;
    window.flwFormatCurrency          = flwFormatCurrency;
    window.flwGetCurrencyLimits       = flwGetCurrencyLimits;

    // Alias — all existing call-sites that use initiatePaystackDeposit now
    // automatically route through Flutterwave first.
    window.initiatePaystackDeposit = initiateFlutterwaveDeposit;
}
