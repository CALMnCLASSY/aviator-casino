const fs = require('fs');
const codes = require('../classybet/country-codes.js');

let mapStr = '';
let symStr = '';
let nameStr = '';

const symbols = {};

codes.forEach(c => {
    mapStr += `    '${c.code}': { currency: '${c.currency}', country: '${c.name}' },\n`;
    symbols[c.currency] = c.currencySymbol;
});

Object.keys(symbols).forEach(k => {
    symStr += `    '${k}': '${symbols[k]}',\n`;
    nameStr += `    '${k}': '${k}',\n`; 
});

const configContent = `/**
 * Currency Configuration Utility
 */

const PAYSTACK_CURRENCIES = ['KES', 'USD'];

const CURRENCY_SYMBOLS = {
${symStr}};

const CURRENCY_NAMES = {
${nameStr}};

const COUNTRY_CURRENCY_MAP = {
${mapStr}};

function getCurrencyForCountryCode(countryCode) {
    const mapping = COUNTRY_CURRENCY_MAP[countryCode];
    return mapping || { currency: 'USD', country: 'International' };
}

function getCurrencySymbol(currency) {
    return CURRENCY_SYMBOLS[currency] || currency;
}

function getCurrencyName(currency) {
    return CURRENCY_NAMES[currency] || currency;
}

function formatCurrency(amount, currency) {
    const symbol = getCurrencySymbol(currency);
    return \`\${symbol} \${amount.toFixed(2)}\`;
}

function isPaystackSupported(currency) {
    return PAYSTACK_CURRENCIES.includes(currency);
}

function getDepositLimits(currency) {
    const ExchangeRateService = require('../services/ExchangeRateService');
    const rate = ExchangeRateService.getRate(currency);
    const baseMinUsd = 5;
    const baseMaxUsd = 10000;
    const mult = rate || 1;
    return {
        min: Math.ceil(baseMinUsd * mult),
        max: Math.floor(baseMaxUsd * mult)
    };
}

function getWithdrawalLimits(currency) {
    const ExchangeRateService = require('../services/ExchangeRateService');
    const rate = ExchangeRateService.getRate(currency);
    const baseMinUsd = 20;
    const baseMaxUsd = 10000;
    const mult = rate || 1;
    return {
        min: Math.ceil(baseMinUsd * mult),
        max: Math.floor(baseMaxUsd * mult)
    };
}

function validateDepositAmount(amount, currency) {
    const limits = getDepositLimits(currency);
    if (amount < limits.min) return { valid: false, error: \`Minimum deposit is \${formatCurrency(limits.min, currency)}\` };
    if (amount > limits.max) return { valid: false, error: \`Maximum deposit is \${formatCurrency(limits.max, currency)}\` };
    return { valid: true };
}

function validateWithdrawalAmount(amount, currency) {
    const limits = getWithdrawalLimits(currency);
    if (amount < limits.min) return { valid: false, error: \`Minimum withdrawal is \${formatCurrency(limits.min, currency)}\` };
    if (amount > limits.max) return { valid: false, error: \`Maximum withdrawal is \${formatCurrency(limits.max, currency)}\` };
    return { valid: true };
}

function convertToPaystackCurrency(amount, fromCurrency) {
    if (PAYSTACK_CURRENCIES.includes(fromCurrency)) {
        return {
            paystackAmount: amount,
            paystackCurrency: fromCurrency,
            converted: false,
            originalAmount: amount,
            originalCurrency: fromCurrency
        };
    }
    const ExchangeRateService = require('../services/ExchangeRateService');
    const localToUsdRate = ExchangeRateService.getRate(fromCurrency);
    if (!localToUsdRate) {
        return {
            paystackAmount: null,
            paystackCurrency: null,
            converted: false,
            error: \`Currency \${fromCurrency} is not supported or rates unavailable\`
        };
    }
    const usdAmount = parseFloat((amount / localToUsdRate).toFixed(2));
    return {
        paystackAmount: usdAmount,
        paystackCurrency: 'USD',
        converted: true,
        originalAmount: amount,
        originalCurrency: fromCurrency,
        exchangeRate: 1 / localToUsdRate
    };
}

module.exports = {
    PAYSTACK_CURRENCIES,
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
\`;

fs.writeFileSync('utils/currencyConfig.js', configContent);
console.log('Successfully re-generated utils/currencyConfig.js');
