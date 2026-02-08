/**
 * Currency Utility Module
 * Provides currency formatting and symbol mapping for multi-currency support
 */

// Currency symbols mapping
const CURRENCY_SYMBOLS = {
    KES: 'KSh',
    NGN: '₦',
    GHS: 'GH₵',
    ZAR: 'R',
    USD: '$',
    GBP: '£',
    EUR: '€'
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
    window.CURRENCY_SYMBOLS = CURRENCY_SYMBOLS;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCurrencySymbol,
        getUserCurrency,
        formatCurrency,
        formatBalance,
        CURRENCY_SYMBOLS
    };
}
