/**
 * Currency Utility Module
 * Provides currency formatting and symbol mapping for multi-currency support
 */

const CURRENCY_SYMBOLS = {
    KES: 'KSh',
    NGN: '₦',
    GHS: 'GH₵',
    ZAR: 'R',
    USD: '$',
    GBP: '£',
    EUR: '€'
};

// Deposit limits for each currency (min and max amounts)
const DEPOSIT_LIMITS = {
    KES: { min: 650, max: 150000 },
    NGN: { min: 12000, max: 2800000 },  // ~650 KES equivalent
    GHS: { min: 1100, max: 250000 },    // ~650 KES equivalent
    ZAR: { min: 230, max: 52000 },      // ~650 KES equivalent
    USD: { min: 5, max: 1150 },         // ~650 KES equivalent
    GBP: { min: 4, max: 920 },          // ~650 KES equivalent
    EUR: { min: 5, max: 1050 }          // ~650 KES equivalent
};

/**
 * Get currency symbol for a given currency code
 * @param {string} currencyCode - Currency code (e.g., 'KES', 'USD')
 * @returns {string} Currency symbol
 */
function getCurrencySymbol(currencyCode) {
    return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

/**
 * Get user's currency from localStorage
 * @returns {string} User's currency code, defaults to 'KES'
 */
function getUserCurrency() {
    try {
        const userData = localStorage.getItem('userData');
        if (userData) {
            const user = JSON.parse(userData);
            return user.currency || 'KES';
        }
    } catch (error) {
        console.warn('Error getting user currency:', error);
    }
    return 'KES'; // Default fallback
}

/**
 * Format amount with appropriate currency symbol
 * @param {number} amount - Amount to format
 * @param {string} currency - Optional currency code, uses user's currency if not provided
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currency = null) {
    const currencyCode = currency || getUserCurrency();
    const symbol = getCurrencySymbol(currencyCode);
    const numAmount = parseFloat(amount) || 0;
    return `${symbol} ${numAmount.toFixed(2)}`;
}

/**
 * Get deposit limits for a given currency
 * @param {string} currency - Currency code, uses user's currency if not provided
 * @returns {object} Object with min and max deposit amounts
 */
function getDepositLimits(currency = null) {
    const currencyCode = currency || getUserCurrency();
    return DEPOSIT_LIMITS[currencyCode] || DEPOSIT_LIMITS.KES; // Default to KES if not found
}

/**
 * Format deposit limits with currency symbol
 * @param {string} currency - Currency code, uses user's currency if not provided
 * @returns {object} Object with formatted min and max strings
 */
function formatDepositLimits(currency = null) {
    const currencyCode = currency || getUserCurrency();
    const limits = getDepositLimits(currencyCode);
    return {
        min: formatCurrency(limits.min, currencyCode),
        max: formatCurrency(limits.max, currencyCode),
        minValue: limits.min,
        maxValue: limits.max
    };
}

/**
 * Format amount for display in balance elements
 * @param {number} amount - Amount to format
 * @returns {string} Formatted balance string
 */
function formatBalance(amount) {
    return formatCurrency(amount);
}

// Make functions available globally
if (typeof window !== 'undefined') {
    window.getCurrencySymbol = getCurrencySymbol;
    window.getUserCurrency = getUserCurrency;
    window.formatCurrency = formatCurrency;
    window.formatBalance = formatBalance;
    window.getDepositLimits = getDepositLimits;
    window.formatDepositLimits = formatDepositLimits;
    window.CURRENCY_SYMBOLS = CURRENCY_SYMBOLS;
    window.DEPOSIT_LIMITS = DEPOSIT_LIMITS;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCurrencySymbol,
        getUserCurrency,
        formatCurrency,
        formatBalance,
        getDepositLimits,
        formatDepositLimits,
        CURRENCY_SYMBOLS,
        DEPOSIT_LIMITS
    };
}
