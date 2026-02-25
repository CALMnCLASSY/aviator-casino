/**
 * Currency Configuration Utility
 * Maps country codes to currencies and provides currency-specific settings
 */

// Paystack currencies actually enabled on the ClassyBet account
const PAYSTACK_CURRENCIES = ['KES', 'USD'];

// Approximate exchange rates TO USD (update periodically)
// e.g. 1 ZAR ≈ 0.054 USD
const USD_EXCHANGE_RATES = {
    USD: 1,
    KES: 0.0077,   // 1 KES ≈ $0.0077
    NGN: 0.00062,  // 1 NGN ≈ $0.00062
    GHS: 0.077,    // 1 GHS ≈ $0.077
    ZAR: 0.054,    // 1 ZAR ≈ $0.054
    GBP: 1.27,     // 1 GBP ≈ $1.27
    EUR: 1.08      // 1 EUR ≈ $1.08
};

// Currency symbols
const CURRENCY_SYMBOLS = {
    KES: 'KSh',
    NGN: '₦',
    GHS: 'GH₵',
    ZAR: 'R',
    USD: '$',
    GBP: '£',
    EUR: '€'
};

// Currency names
const CURRENCY_NAMES = {
    KES: 'Kenyan Shilling',
    NGN: 'Nigerian Naira',
    GHS: 'Ghanaian Cedi',
    ZAR: 'South African Rand',
    USD: 'US Dollar',
    GBP: 'British Pound',
    EUR: 'Euro'
};

// Map country codes to currencies
const COUNTRY_CURRENCY_MAP = {
    // East Africa
    '+254': { currency: 'KES', country: 'Kenya' },
    '+255': { currency: 'USD', country: 'Tanzania' },
    '+256': { currency: 'USD', country: 'Uganda' },
    '+250': { currency: 'USD', country: 'Rwanda' },
    '+257': { currency: 'USD', country: 'Burundi' },
    '+251': { currency: 'USD', country: 'Ethiopia' },
    '+252': { currency: 'USD', country: 'Somalia' },
    '+253': { currency: 'USD', country: 'Djibouti' },

    // West Africa
    '+234': { currency: 'NGN', country: 'Nigeria' },
    '+233': { currency: 'GHS', country: 'Ghana' },
    '+221': { currency: 'USD', country: 'Senegal' },
    '+223': { currency: 'USD', country: 'Mali' },
    '+225': { currency: 'USD', country: 'Ivory Coast' },
    '+226': { currency: 'USD', country: 'Burkina Faso' },
    '+227': { currency: 'USD', country: 'Niger' },
    '+228': { currency: 'USD', country: 'Togo' },
    '+229': { currency: 'USD', country: 'Benin' },
    '+220': { currency: 'USD', country: 'Gambia' },
    '+224': { currency: 'USD', country: 'Guinea' },
    '+245': { currency: 'USD', country: 'Guinea-Bissau' },
    '+232': { currency: 'USD', country: 'Sierra Leone' },
    '+231': { currency: 'USD', country: 'Liberia' },

    // Southern Africa
    '+27': { currency: 'ZAR', country: 'South Africa' },
    '+260': { currency: 'USD', country: 'Zambia' },
    '+263': { currency: 'USD', country: 'Zimbabwe' },
    '+267': { currency: 'USD', country: 'Botswana' },
    '+265': { currency: 'USD', country: 'Malawi' },
    '+258': { currency: 'USD', country: 'Mozambique' },
    '+264': { currency: 'USD', country: 'Namibia' },
    '+266': { currency: 'USD', country: 'Lesotho' },
    '+268': { currency: 'USD', country: 'Eswatini' },

    // North Africa
    '+20': { currency: 'USD', country: 'Egypt' },
    '+212': { currency: 'USD', country: 'Morocco' },
    '+213': { currency: 'USD', country: 'Algeria' },
    '+216': { currency: 'USD', country: 'Tunisia' },
    '+218': { currency: 'USD', country: 'Libya' },

    // Central Africa
    '+237': { currency: 'USD', country: 'Cameroon' },
    '+241': { currency: 'USD', country: 'Gabon' },
    '+242': { currency: 'USD', country: 'Republic of the Congo' },
    '+243': { currency: 'USD', country: 'Democratic Republic of Congo' },
    '+236': { currency: 'USD', country: 'Central African Republic' },
    '+235': { currency: 'USD', country: 'Chad' },
    '+240': { currency: 'USD', country: 'Equatorial Guinea' },
    '+244': { currency: 'USD', country: 'Angola' },

    // Europe
    '+44': { currency: 'GBP', country: 'United Kingdom' },
    '+33': { currency: 'EUR', country: 'France' },
    '+49': { currency: 'EUR', country: 'Germany' },
    '+39': { currency: 'EUR', country: 'Italy' },
    '+34': { currency: 'EUR', country: 'Spain' },
    '+31': { currency: 'EUR', country: 'Netherlands' },
    '+32': { currency: 'EUR', country: 'Belgium' },
    '+41': { currency: 'USD', country: 'Switzerland' },
    '+43': { currency: 'EUR', country: 'Austria' },
    '+351': { currency: 'EUR', country: 'Portugal' },
    '+30': { currency: 'EUR', country: 'Greece' },
    '+353': { currency: 'EUR', country: 'Ireland' },
    '+358': { currency: 'EUR', country: 'Finland' },
    '+46': { currency: 'USD', country: 'Sweden' },
    '+47': { currency: 'USD', country: 'Norway' },
    '+45': { currency: 'USD', country: 'Denmark' },
    '+48': { currency: 'USD', country: 'Poland' },

    // Americas
    '+1': { currency: 'USD', country: 'United States' },

    // Asia
    '+91': { currency: 'USD', country: 'India' },
    '+86': { currency: 'USD', country: 'China' },
    '+81': { currency: 'USD', country: 'Japan' },
    '+82': { currency: 'USD', country: 'South Korea' },
    '+65': { currency: 'USD', country: 'Singapore' },
    '+60': { currency: 'USD', country: 'Malaysia' },
    '+66': { currency: 'USD', country: 'Thailand' },
    '+63': { currency: 'USD', country: 'Philippines' },
    '+62': { currency: 'USD', country: 'Indonesia' },
    '+84': { currency: 'USD', country: 'Vietnam' },
    '+92': { currency: 'USD', country: 'Pakistan' },
    '+880': { currency: 'USD', country: 'Bangladesh' },
    '+94': { currency: 'USD', country: 'Sri Lanka' },

    // Oceania
    '+61': { currency: 'USD', country: 'Australia' },
    '+64': { currency: 'USD', country: 'New Zealand' },

    // Middle East
    '+971': { currency: 'USD', country: 'UAE' },
    '+966': { currency: 'USD', country: 'Saudi Arabia' },
    '+974': { currency: 'USD', country: 'Qatar' },
    '+965': { currency: 'USD', country: 'Kuwait' },
    '+973': { currency: 'USD', country: 'Bahrain' },
    '+968': { currency: 'USD', country: 'Oman' },
    '+962': { currency: 'USD', country: 'Jordan' },
    '+961': { currency: 'USD', country: 'Lebanon' },
    '+972': { currency: 'USD', country: 'Israel' },
    '+90': { currency: 'USD', country: 'Turkey' }
};

// Minimum deposit amounts per currency (in smallest unit)
const MIN_DEPOSIT = {
    KES: 200,
    NGN: 500,
    GHS: 10,
    ZAR: 50,
    USD: 5,
    GBP: 5,
    EUR: 5
};

// Maximum deposit amounts per currency
const MAX_DEPOSIT = {
    KES: 150000,
    NGN: 500000,
    GHS: 5000,
    ZAR: 50000,
    USD: 10000,
    GBP: 10000,
    EUR: 10000
};

// Minimum withdrawal amounts per currency
const MIN_WITHDRAWAL = {
    KES: 1200,
    NGN: 2000,
    GHS: 50,
    ZAR: 200,
    USD: 20,
    GBP: 20,
    EUR: 20
};

// Maximum withdrawal amounts per currency
const MAX_WITHDRAWAL = {
    KES: 150000,
    NGN: 500000,
    GHS: 5000,
    ZAR: 50000,
    USD: 10000,
    GBP: 10000,
    EUR: 10000
};

/**
 * Get currency and country for a given country code
 * @param {string} countryCode - Country code (e.g., '+254')
 * @returns {object} - { currency, country }
 */
function getCurrencyForCountryCode(countryCode) {
    const mapping = COUNTRY_CURRENCY_MAP[countryCode];
    if (mapping) {
        return mapping;
    }
    // Default to USD for unknown countries
    return { currency: 'USD', country: 'International' };
}

/**
 * Get currency symbol
 * @param {string} currency - Currency code (e.g., 'KES')
 * @returns {string} - Currency symbol
 */
function getCurrencySymbol(currency) {
    return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Get currency name
 * @param {string} currency - Currency code
 * @returns {string} - Currency name
 */
function getCurrencyName(currency) {
    return CURRENCY_NAMES[currency] || currency;
}

/**
 * Format amount with currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} - Formatted amount
 */
function formatCurrency(amount, currency) {
    const symbol = getCurrencySymbol(currency);
    return `${symbol} ${amount.toFixed(2)}`;
}

/**
 * Check if currency is supported by Paystack
 * @param {string} currency - Currency code
 * @returns {boolean}
 */
function isPaystackSupported(currency) {
    return PAYSTACK_CURRENCIES.includes(currency);
}

/**
 * Get deposit limits for currency
 * @param {string} currency - Currency code
 * @returns {object} - { min, max }
 */
function getDepositLimits(currency) {
    return {
        min: MIN_DEPOSIT[currency] || MIN_DEPOSIT.USD,
        max: MAX_DEPOSIT[currency] || MAX_DEPOSIT.USD
    };
}

/**
 * Get withdrawal limits for currency
 * @param {string} currency - Currency code
 * @returns {object} - { min, max }
 */
function getWithdrawalLimits(currency) {
    return {
        min: MIN_WITHDRAWAL[currency] || MIN_WITHDRAWAL.USD,
        max: MAX_WITHDRAWAL[currency] || MAX_WITHDRAWAL.USD
    };
}

/**
 * Validate deposit amount for currency
 * @param {number} amount - Amount to validate
 * @param {string} currency - Currency code
 * @returns {object} - { valid, error }
 */
function validateDepositAmount(amount, currency) {
    const limits = getDepositLimits(currency);

    if (amount < limits.min) {
        return {
            valid: false,
            error: `Minimum deposit is ${formatCurrency(limits.min, currency)}`
        };
    }

    if (amount > limits.max) {
        return {
            valid: false,
            error: `Maximum deposit is ${formatCurrency(limits.max, currency)}`
        };
    }

    return { valid: true };
}

/**
 * Validate withdrawal amount for currency
 * @param {number} amount - Amount to validate
 * @param {string} currency - Currency code
 * @returns {object} - { valid, error }
 */
function validateWithdrawalAmount(amount, currency) {
    const limits = getWithdrawalLimits(currency);

    if (amount < limits.min) {
        return {
            valid: false,
            error: `Minimum withdrawal is ${formatCurrency(limits.min, currency)}`
        };
    }

    if (amount > limits.max) {
        return {
            valid: false,
            error: `Maximum withdrawal is ${formatCurrency(limits.max, currency)}`
        };
    }

    return { valid: true };
}

/**
 * Convert an amount to a Paystack-supported currency.
 * KES stays as KES. Everything else converts to USD.
 * @param {number} amount - Amount in the user's currency
 * @param {string} fromCurrency - User's currency code
 * @returns {object} - { paystackAmount, paystackCurrency, converted, originalAmount, originalCurrency }
 */
function convertToPaystackCurrency(amount, fromCurrency) {
    // KES and USD are natively supported — pass through
    if (PAYSTACK_CURRENCIES.includes(fromCurrency)) {
        return {
            paystackAmount: amount,
            paystackCurrency: fromCurrency,
            converted: false,
            originalAmount: amount,
            originalCurrency: fromCurrency
        };
    }

    // Convert to USD
    const rate = USD_EXCHANGE_RATES[fromCurrency];
    if (!rate) {
        // Unknown currency — reject
        return {
            paystackAmount: null,
            paystackCurrency: null,
            converted: false,
            error: `Currency ${fromCurrency} is not supported`
        };
    }

    const usdAmount = parseFloat((amount * rate).toFixed(2));
    return {
        paystackAmount: usdAmount,
        paystackCurrency: 'USD',
        converted: true,
        originalAmount: amount,
        originalCurrency: fromCurrency,
        exchangeRate: rate
    };
}

module.exports = {
    PAYSTACK_CURRENCIES,
    USD_EXCHANGE_RATES,
    CURRENCY_SYMBOLS,
    CURRENCY_NAMES,
    COUNTRY_CURRENCY_MAP,
    getCurrencyForCountryCode,
    getCurrencySymbol,
    getCurrencyName,
    formatCurrency,
    isPaystackSupported,
    getDepositLimits,
    getWithdrawalLimits,
    validateDepositAmount,
    validateWithdrawalAmount,
    convertToPaystackCurrency
};
