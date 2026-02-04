/**
 * Paystack Payment Integration
 * Handles multi-currency deposits with all available payment methods
 * Note: Requires global API_BASE to be defined before this script loads
 */

const PAYSTACK_PUBLIC_KEY = 'pk_live_4b4f3a0ed97c13680b6a29897e6624734c072f54';

// Currency limits (from backend currencyConfig)
const CURRENCY_LIMITS = {
    KES: { min: 200, max: 150000, symbol: 'KSh' },
    NGN: { min: 500, max: 500000, symbol: '₦' },
    GHS: { min: 10, max: 5000, symbol: 'GH₵' },
    ZAR: { min: 50, max: 50000, symbol: 'R' },
    USD: { min: 5, max: 10000, symbol: '$' },
    GBP: { min: 5, max: 10000, symbol: '£' },
    EUR: { min: 5, max: 10000, symbol: '€' }
};

/**
 * Format currency amount with symbol
 */
function formatCurrency(amount, currency = 'KES') {
    const limits = CURRENCY_LIMITS[currency] || CURRENCY_LIMITS.USD;
    return `${limits.symbol} ${parseFloat(amount).toFixed(2)}`;
}

/**
 * Get currency limits for user
 */
function getCurrencyLimits(currency = 'KES') {
    return CURRENCY_LIMITS[currency] || CURRENCY_LIMITS.USD;
}

/**
 * Initialize Paystack deposit
 */
async function initiatePaystackDeposit(amount) {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        const token = localStorage.getItem('user_token');

        if (!userData || !token) {
            throw new Error('Please login to make a deposit');
        }

        const currency = userData.currency || 'KES';
        const limits = getCurrencyLimits(currency);

        // Validate amount
        if (amount < limits.min || amount > limits.max) {
            throw new Error(`Amount must be between ${formatCurrency(limits.min, currency)} and ${formatCurrency(limits.max, currency)}`);
        }

        console.log('🔄 Initializing Paystack deposit:', { amount, currency });

        // Call backend to initialize transaction
        const response = await fetch(`${API_BASE}/api/payments/deposit-initialize`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount: parseFloat(amount) })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to initialize payment');
        }

        console.log('✅ Payment initialized:', data.data.reference);

        // Open Paystack payment popup
        openPaystackPopup(data.data, userData, currency);

    } catch (error) {
        console.error('❌ Deposit initialization error:', error);
        throw error;
    }
}

/**
 * Open Paystack payment popup with all payment methods
 */
function openPaystackPopup(paymentData, userData, currency) {
    // Get the actual amount from the transaction data
    // Amount must be in kobo/cents (multiply by 100)
    const amountInMinorUnits = Math.round(parseFloat(paymentData.amount) * 100);

    console.log('💳 Opening Paystack popup:', {
        reference: paymentData.reference,
        amount: paymentData.amount,
        amountInKobo: amountInMinorUnits,
        currency: currency
    });

    const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: userData.email || `${userData.username}@classybet.com`,
        amount: amountInMinorUnits, // Amount in kobo/cents
        currency: currency,
        ref: paymentData.reference,
        // Enable all payment channels - Paystack will show available ones for the currency
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer', 'eft'],
        metadata: {
            custom_fields: [
                {
                    display_name: 'Username',
                    variable_name: 'username',
                    value: userData.username
                },
                {
                    display_name: 'User ID',
                    variable_name: 'user_id',
                    value: userData.userId || userData.id
                }
            ]
        },
        callback: function (response) {
            console.log('✅ Payment successful:', response.reference);
            verifyPaystackPayment(response.reference);
        },
        onClose: function () {
            console.log('Payment popup closed');
            showNotification('Payment cancelled', 'warning');
        }
    });

    handler.openIframe();
}

/**
 * Verify payment with backend
 */
async function verifyPaystackPayment(reference) {
    try {
        const token = localStorage.getItem('user_token');

        console.log('🔍 Verifying payment:', reference);

        const response = await fetch(`${API_BASE}/api/payments/deposit-verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reference })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Payment verification failed');
        }

        console.log('✅ Payment verified successfully');

        // Update balance display
        if (typeof updateBalanceDisplay === 'function') {
            updateBalanceDisplay(data.newBalance);
        }

        // Show success message
        const userData = JSON.parse(localStorage.getItem('userData'));
        const currency = userData?.currency || 'KES';
        showNotification(
            `Deposit successful! Your new balance is ${formatCurrency(data.newBalance, currency)}`,
            'success'
        );

        // Reload user data
        if (typeof loadUserProfile === 'function') {
            await loadUserProfile();
        }

        // Close deposit modal if exists
        if (typeof closeDepositModal === 'function') {
            closeDepositModal();
        }

    } catch (error) {
        console.error('❌ Payment verification error:', error);
        showNotification(error.message || 'Payment verification failed', 'error');
    }
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
    // Try to use existing notification system
    if (typeof showSuccess === 'function' && type === 'success') {
        showSuccess('deposit-success', message);
    } else if (typeof showError === 'function' && type === 'error') {
        showError('deposit-error', message);
    } else {
        // Fallback to alert
        alert(message);
    }
}

/**
 * Update balance display across the page
 */
function updateBalanceDisplay(newBalance) {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const currency = userData?.currency || 'KES';
    const formattedBalance = formatCurrency(newBalance, currency);

    // Update all balance elements
    const balanceElements = [
        document.getElementById('headerBalance'),
        document.getElementById('balance'),
        document.querySelector('.balance-amount'),
        document.querySelector('#user-balance')
    ];

    balanceElements.forEach(el => {
        if (el) {
            el.textContent = formattedBalance;
        }
    });

    // Update userData in localStorage
    if (userData) {
        userData.balance = newBalance;
        localStorage.setItem('userData', JSON.stringify(userData));
    }
}

/**
 * Get user's currency from localStorage
 */
function getUserCurrency() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    return userData?.currency || 'KES';
}

/**
 * Get user's currency symbol
 */
function getUserCurrencySymbol() {
    const currency = getUserCurrency();
    const limits = getCurrencyLimits(currency);
    return limits.symbol;
}

// Export functions for global use
if (typeof window !== 'undefined') {
    window.initiatePaystackDeposit = initiatePaystackDeposit;
    window.verifyPaystackPayment = verifyPaystackPayment;
    window.formatCurrency = formatCurrency;
    window.getCurrencyLimits = getCurrencyLimits;
    window.updateBalanceDisplay = updateBalanceDisplay;
    window.getUserCurrency = getUserCurrency;
    window.getUserCurrencySymbol = getUserCurrencySymbol;
}
