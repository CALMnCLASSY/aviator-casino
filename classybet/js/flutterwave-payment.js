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

(function () {

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
    if (typeof window.formatCurrency === 'function') {
        return window.formatCurrency(amount, currency);
    }
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

        if (initData.provider === 'paystack' || initData.fallback) {
            console.log('⚠️  Falling back to Paystack');
            _openPaystackFallback(initData.data, userData, initData.data.currency);
            return;
        }

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
            console.warn('⚠️ Flutterwave SDK failed to load. Attempting Paystack fallback...');
            _showFlwNotification('Switching to alternative secure payment checkout...', 'info');
            if (typeof window.initiateOriginalPaystackDeposit === 'function') {
                window.initiateOriginalPaystackDeposit(widgetParams.amount)
                    .catch(function (err) {
                        _showFlwNotification('Payment initialization failed. Please try again.', 'error');
                    });
            } else {
                _showFlwNotification('Failed to load payment checkout. Please refresh.', 'error');
            }
        };
        document.head.appendChild(script);
        return;
    }

    FlutterwaveCheckout(Object.assign({}, widgetParams, {
        public_key: widgetParams.public_key || FLW_PUBLIC_KEY,
        tx_ref:     widgetParams.tx_ref     || reference,

        callback: function (data) {
            console.log('✅ FLW callback status:', data.status, '| tx_id:', data.transaction_id);
            if (data.status === 'successful' || data.status === 'completed') {
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
            console.log('FLW popup closed, polling for confirmation…');
            _pollTransactionStatus(reference, 0);
        }
    }));
}

// ─── Poll until webhook confirms ──────────────────────────────────────────

function _pollTransactionStatus(reference, attempt) {
    var maxAttempts = 12; // 12 * 5s = 60s
    if (attempt >= maxAttempts) {
        console.log('⏳ Polling timed out. Assuming webhook will process it.');
        return;
    }

    console.log('🔍 Polling transaction status (' + (attempt + 1) + '/' + maxAttempts + ')…');

    var token = localStorage.getItem('user_token');
    if (!token) return;

    setTimeout(async function () {
        try {
            var res = await fetch(API_BASE + '/api/payments/flw-deposit-status?reference=' + reference, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            var data = await res.json();

            if (res.ok && data.success && data.status === 'completed') {
                console.log('🎉 Polling confirmed payment success!');
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
                return;
            }

            _pollTransactionStatus(reference, attempt + 1);

        } catch (e) {
            console.error('Polling error:', e);
            _pollTransactionStatus(reference, attempt + 1);
        }
    }, 5000);
}

// ─── Verify transaction (API fallback) ────────────────────────────────────

async function verifyFlutterwavePayment(reference, transactionId) {
    var token = localStorage.getItem('user_token');
    if (!token) throw new Error('Auth token missing');

    console.log('🔍 Verifying payment with backend:', reference);

    var res = await fetch(API_BASE + '/api/payments/flw-deposit-verify', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type':  'application/json'
        },
        body: JSON.stringify({ reference: reference, transactionId: transactionId })
    });

    var data = await res.json();

    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification endpoint failed');
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
            _showFlwLoading(false);
            _showFlwNotification('Failed to load Paystack SDK fallback.', 'error');
        };
        document.head.appendChild(script);
        return;
    }

    console.log('💳 Opening Paystack fallback popup...');
    var amountInKobo = Math.round(parseFloat(paymentData.amount) * 100);
    var channels = (currency === 'KES')
        ? ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer', 'eft']
        : ['card', 'bank'];

    var handler = PaystackPop.setup({
        key:      paymentData.public_key || 'pk_live_4b4f3a0ed97c13680b6a29897e6624734c072f54',
        email:    userData.email || (userData.username + '@ClassyBet.com'),
        amount:   amountInKobo,
        currency: currency,
        ref:      paymentData.reference,
        channels: channels,
        metadata: {
            custom_fields: [
                { display_name: 'Username', variable_name: 'username', value: userData.username },
                { display_name: 'User ID',  variable_name: 'user_id',  value: userData.userId || userData.id }
            ]
        },
        callback: function (response) {
            console.log('✅ Paystack fallback successful:', response.reference);
            verifyPaystackFallback(response.reference);
        },
        onClose: function () {
            _showFlwNotification('Payment cancelled', 'warning');
        }
    });
    handler.openIframe();
}

async function verifyPaystackFallback(reference) {
    var token = localStorage.getItem('user_token');
    if (!token) return;

    try {
        var res = await fetch(API_BASE + '/api/payments/deposit-verify', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({ reference: reference })
        });
        var data = await res.json();
        if (res.ok && data.success) {
            console.log('✅ Paystack fallback payment verified');
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
    } catch (e) {
        console.error('Fallback verification failed:', e);
    }
}

// ─── Toast System ──────────────────────────────────────────────────────────

function _showFlwNotification(message, type) {
    var colorMap = {
        success: '#30fcbe',
        error:   '#ff4d4d',
        warning: '#ffc107',
        info:    '#00bcd4'
    };

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

})();
