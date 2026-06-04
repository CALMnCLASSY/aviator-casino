const PAYSTACK_CURRENCIES = ['KES', 'USD'];

const CURRENCY_SYMBOLS = {
    'AFN': '؋',
    'DZD': 'د.ج',
    'AOA': 'Kz',
    'AUD': '$',
    'EUR': '€',
    'BHD': 'ب.د',
    'BDT': '৳',
    'XOF': 'CFA',
    'BWP': 'P',
    'BND': '$',
    'BGN': 'лв',
    'KHR': '៛',
    'XAF': 'FCFA',
    'CAD': '$',
    'CVE': '$',
    'CNY': '¥',
    'KMF': 'CF',
    'CZK': 'Kč',
    'CDF': 'FC',
    'DKK': 'kr',
    'DJF': 'Fdj',
    'EGP': '£',
    'ERN': 'Nfk',
    'SZL': 'E',
    'ETB': 'Br',
    'GMD': 'D',
    'GHS': 'GH₵',
    'GNF': 'FG',
    'HUF': 'Ft',
    'INR': '₹',
    'IDR': 'Rp',
    'IRR': '﷼',
    'IQD': 'ع.د',
    'ILS': '₪',
    'JPY': '¥',
    'JOD': 'د.ا',
    'KES': 'KSh',
    'KWD': 'د.ك',
    'LAK': '₭',
    'LBP': 'ل.ل',
    'LSL': 'L',
    'LRD': '$',
    'LYD': 'ل.د',
    'MGA': 'Ar',
    'MWK': 'MK',
    'MYR': 'RM',
    'MVR': 'Rf',
    'MUR': '₨',
    'MAD': 'د.م.',
    'MZN': 'MT',
    'MMK': 'K',
    'NAD': '$',
    'NPR': 'रु',
    'NGN': '₦',
    'NOK': 'kr',
    'OMR': 'ر.ع.',
    'PKR': '₨',
    'PHP': '₱',
    'PLN': 'zł',
    'QAR': '﷼',
    'RON': 'lei',
    'RUB': '₽',
    'RWF': 'FRw',
    'STN': 'Db',
    'SAR': '﷼',
    'RSD': 'дин.',
    'SCR': '₨',
    'SLL': 'Le',
    'SGD': '$',
    'SOS': 'Sh',
    'ZAR': 'R',
    'KRW': '₩',
    'LKR': 'Rs',
    'SDG': 'ج.س.',
    'SEK': 'kr',
    'CHF': 'CHF',
    'SYP': '£',
    'TZS': 'TSh',
    'THB': '฿',
    'TND': 'د.ت',
    'TRY': '₺',
    'AED': 'د.إ',
    'UGX': 'USh',
    'UAH': '₴',
    'GBP': '£',
    'USD': '$',
    'VND': '₫',
    'ZMW': 'ZK',
    'ZWL': 'Z$',
};

const CURRENCY_NAMES = {
    'AFN': 'AFN',
    'DZD': 'DZD',
    'AOA': 'AOA',
    'AUD': 'AUD',
    'EUR': 'EUR',
    'BHD': 'BHD',
    'BDT': 'BDT',
    'XOF': 'XOF',
    'BWP': 'BWP',
    'BND': 'BND',
    'BGN': 'BGN',
    'KHR': 'KHR',
    'XAF': 'XAF',
    'CAD': 'CAD',
    'CVE': 'CVE',
    'CNY': 'CNY',
    'KMF': 'KMF',
    'CZK': 'CZK',
    'CDF': 'CDF',
    'DKK': 'DKK',
    'DJF': 'DJF',
    'EGP': 'EGP',
    'ERN': 'ERN',
    'SZL': 'SZL',
    'ETB': 'ETB',
    'GMD': 'GMD',
    'GHS': 'GHS',
    'GNF': 'GNF',
    'HUF': 'HUF',
    'INR': 'INR',
    'IDR': 'IDR',
    'IRR': 'IRR',
    'IQD': 'IQD',
    'ILS': 'ILS',
    'JPY': 'JPY',
    'JOD': 'JOD',
    'KES': 'KES',
    'KWD': 'KWD',
    'LAK': 'LAK',
    'LBP': 'LBP',
    'LSL': 'LSL',
    'LRD': 'LRD',
    'LYD': 'LYD',
    'MGA': 'MGA',
    'MWK': 'MWK',
    'MYR': 'MYR',
    'MVR': 'MVR',
    'MUR': 'MUR',
    'MAD': 'MAD',
    'MZN': 'MZN',
    'MMK': 'MMK',
    'NAD': 'NAD',
    'NPR': 'NPR',
    'NGN': 'NGN',
    'NOK': 'NOK',
    'OMR': 'OMR',
    'PKR': 'PKR',
    'PHP': 'PHP',
    'PLN': 'PLN',
    'QAR': 'QAR',
    'RON': 'RON',
    'RUB': 'RUB',
    'RWF': 'RWF',
    'STN': 'STN',
    'SAR': 'SAR',
    'RSD': 'RSD',
    'SCR': 'SCR',
    'SLL': 'SLL',
    'SGD': 'SGD',
    'SOS': 'SOS',
    'ZAR': 'ZAR',
    'KRW': 'KRW',
    'LKR': 'LKR',
    'SDG': 'SDG',
    'SEK': 'SEK',
    'CHF': 'CHF',
    'SYP': 'SYP',
    'TZS': 'TZS',
    'THB': 'THB',
    'TND': 'TND',
    'TRY': 'TRY',
    'AED': 'AED',
    'UGX': 'UGX',
    'UAH': 'UAH',
    'GBP': 'GBP',
    'USD': 'USD',
    'VND': 'VND',
    'ZMW': 'ZMW',
    'ZWL': 'ZWL',
};

const COUNTRY_CURRENCY_MAP = {
    '+93': { currency: 'AFN', country: 'Afghanistan' },
    '+213': { currency: 'DZD', country: 'Algeria' },
    '+244': { currency: 'AOA', country: 'Angola' },
    '+61': { currency: 'AUD', country: 'Australia' },
    '+43': { currency: 'EUR', country: 'Austria' },
    '+973': { currency: 'BHD', country: 'Bahrain' },
    '+880': { currency: 'BDT', country: 'Bangladesh' },
    '+32': { currency: 'EUR', country: 'Belgium' },
    '+229': { currency: 'XOF', country: 'Benin' },
    '+267': { currency: 'BWP', country: 'Botswana' },
    '+673': { currency: 'BND', country: 'Brunei' },
    '+359': { currency: 'BGN', country: 'Bulgaria' },
    '+226': { currency: 'XOF', country: 'Burkina Faso' },
    '+855': { currency: 'KHR', country: 'Cambodia' },
    '+237': { currency: 'XAF', country: 'Cameroon' },
    '+1': { currency: 'CAD', country: 'Canada' },
    '+238': { currency: 'CVE', country: 'Cape Verde' },
    '+236': { currency: 'XAF', country: 'Central African Republic' },
    '+235': { currency: 'XAF', country: 'Chad' },
    '+86': { currency: 'CNY', country: 'China' },
    '+269': { currency: 'KMF', country: 'Comoros' },
    '+385': { currency: 'EUR', country: 'Croatia' },
    '+420': { currency: 'CZK', country: 'Czech Republic' },
    '+243': { currency: 'CDF', country: 'Democratic Republic of Congo' },
    '+45': { currency: 'DKK', country: 'Denmark' },
    '+253': { currency: 'DJF', country: 'Djibouti' },
    '+20': { currency: 'EGP', country: 'Egypt' },
    '+240': { currency: 'XAF', country: 'Equatorial Guinea' },
    '+291': { currency: 'ERN', country: 'Eritrea' },
    '+372': { currency: 'EUR', country: 'Estonia' },
    '+268': { currency: 'SZL', country: 'Eswatini' },
    '+251': { currency: 'ETB', country: 'Ethiopia' },
    '+358': { currency: 'EUR', country: 'Finland' },
    '+33': { currency: 'EUR', country: 'France' },
    '+241': { currency: 'XAF', country: 'Gabon' },
    '+220': { currency: 'GMD', country: 'Gambia' },
    '+49': { currency: 'EUR', country: 'Germany' },
    '+233': { currency: 'GHS', country: 'Ghana' },
    '+30': { currency: 'EUR', country: 'Greece' },
    '+224': { currency: 'GNF', country: 'Guinea' },
    '+245': { currency: 'XOF', country: 'Guinea-Bissau' },
    '+36': { currency: 'HUF', country: 'Hungary' },
    '+91': { currency: 'INR', country: 'India' },
    '+62': { currency: 'IDR', country: 'Indonesia' },
    '+98': { currency: 'IRR', country: 'Iran' },
    '+964': { currency: 'IQD', country: 'Iraq' },
    '+972': { currency: 'ILS', country: 'Israel' },
    '+39': { currency: 'EUR', country: 'Italy' },
    '+225': { currency: 'XOF', country: 'Ivory Coast' },
    '+81': { currency: 'JPY', country: 'Japan' },
    '+962': { currency: 'JOD', country: 'Jordan' },
    '+254': { currency: 'KES', country: 'Kenya' },
    '+965': { currency: 'KWD', country: 'Kuwait' },
    '+856': { currency: 'LAK', country: 'Laos' },
    '+371': { currency: 'EUR', country: 'Latvia' },
    '+961': { currency: 'LBP', country: 'Lebanon' },
    '+266': { currency: 'LSL', country: 'Lesotho' },
    '+231': { currency: 'LRD', country: 'Liberia' },
    '+218': { currency: 'LYD', country: 'Libya' },
    '+370': { currency: 'EUR', country: 'Lithuania' },
    '+261': { currency: 'MGA', country: 'Madagascar' },
    '+265': { currency: 'MWK', country: 'Malawi' },
    '+60': { currency: 'MYR', country: 'Malaysia' },
    '+960': { currency: 'MVR', country: 'Maldives' },
    '+223': { currency: 'XOF', country: 'Mali' },
    '+230': { currency: 'MUR', country: 'Mauritius' },
    '+212': { currency: 'MAD', country: 'Morocco' },
    '+258': { currency: 'MZN', country: 'Mozambique' },
    '+95': { currency: 'MMK', country: 'Myanmar' },
    '+264': { currency: 'NAD', country: 'Namibia' },
    '+977': { currency: 'NPR', country: 'Nepal' },
    '+31': { currency: 'EUR', country: 'Netherlands' },
    '+227': { currency: 'XOF', country: 'Niger' },
    '+234': { currency: 'NGN', country: 'Nigeria' },
    '+47': { currency: 'NOK', country: 'Norway' },
    '+968': { currency: 'OMR', country: 'Oman' },
    '+92': { currency: 'PKR', country: 'Pakistan' },
    '+63': { currency: 'PHP', country: 'Philippines' },
    '+48': { currency: 'PLN', country: 'Poland' },
    '+351': { currency: 'EUR', country: 'Portugal' },
    '+974': { currency: 'QAR', country: 'Qatar' },
    '+242': { currency: 'XAF', country: 'Republic of the Congo' },
    '+40': { currency: 'RON', country: 'Romania' },
    '+7': { currency: 'RUB', country: 'Russia' },
    '+250': { currency: 'RWF', country: 'Rwanda' },
    '+239': { currency: 'STN', country: 'Sao Tome and Principe' },
    '+966': { currency: 'SAR', country: 'Saudi Arabia' },
    '+221': { currency: 'XOF', country: 'Senegal' },
    '+381': { currency: 'RSD', country: 'Serbia' },
    '+248': { currency: 'SCR', country: 'Seychelles' },
    '+232': { currency: 'SLL', country: 'Sierra Leone' },
    '+65': { currency: 'SGD', country: 'Singapore' },
    '+421': { currency: 'EUR', country: 'Slovakia' },
    '+386': { currency: 'EUR', country: 'Slovenia' },
    '+252': { currency: 'SOS', country: 'Somalia' },
    '+27': { currency: 'ZAR', country: 'South Africa' },
    '+82': { currency: 'KRW', country: 'South Korea' },
    '+34': { currency: 'EUR', country: 'Spain' },
    '+94': { currency: 'LKR', country: 'Sri Lanka' },
    '+249': { currency: 'SDG', country: 'Sudan' },
    '+46': { currency: 'SEK', country: 'Sweden' },
    '+41': { currency: 'CHF', country: 'Switzerland' },
    '+963': { currency: 'SYP', country: 'Syria' },
    '+255': { currency: 'TZS', country: 'Tanzania' },
    '+66': { currency: 'THB', country: 'Thailand' },
    '+228': { currency: 'XOF', country: 'Togo' },
    '+216': { currency: 'TND', country: 'Tunisia' },
    '+90': { currency: 'TRY', country: 'Turkey' },
    '+971': { currency: 'AED', country: 'UAE' },
    '+256': { currency: 'UGX', country: 'Uganda' },
    '+380': { currency: 'UAH', country: 'Ukraine' },
    '+44': { currency: 'GBP', country: 'United Kingdom' },
    '+1': { currency: 'USD', country: 'United States' },
    '+84': { currency: 'VND', country: 'Vietnam' },
    '+260': { currency: 'ZMW', country: 'Zambia' },
    '+263': { currency: 'ZWL', country: 'Zimbabwe' },
};

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
    return `${symbol} ${amount.toFixed(2)}`;
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
    if (amount < limits.min) return { valid: false, error: `Minimum deposit is ${formatCurrency(limits.min, currency)}` };
    if (amount > limits.max) return { valid: false, error: `Maximum deposit is ${formatCurrency(limits.max, currency)}` };
    return { valid: true };
}

function validateWithdrawalAmount(amount, currency) {
    const limits = getWithdrawalLimits(currency);
    if (amount < limits.min) return { valid: false, error: `Minimum withdrawal is ${formatCurrency(limits.min, currency)}` };
    if (amount > limits.max) return { valid: false, error: `Maximum withdrawal is ${formatCurrency(limits.max, currency)}` };
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
            error: `Currency ${fromCurrency} is not supported or rates unavailable`
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

const FLUTTERWAVE_CURRENCIES = ['NGN', 'KES', 'GHS', 'UGX', 'TZS', 'RWF', 'XAF', 'XOF', 'ZAR', 'ZMW', 'MWK', 'ETB', 'SLL', 'USD', 'GBP', 'EUR'];

function isFlutterwaveSupported(currency) {
    return FLUTTERWAVE_CURRENCIES.includes((currency || '').toUpperCase());
}

function convertToFlutterwaveCurrency(amount, fromCurrency) {
    const cur = (fromCurrency || '').toUpperCase();
    if (FLUTTERWAVE_CURRENCIES.includes(cur)) {
        return {
            flwAmount: amount,
            flwCurrency: cur,
            converted: false,
            originalAmount: amount,
            originalCurrency: fromCurrency
        };
    }
    const ExchangeRateService = require('../services/ExchangeRateService');
    const localToUsdRate = ExchangeRateService.getRate(cur);
    if (!localToUsdRate) {
        return {
            flwAmount: null,
            flwCurrency: null,
            converted: false,
            error: `Currency ${fromCurrency} is not supported or rates unavailable`
        };
    }
    const usdAmount = parseFloat((amount / localToUsdRate).toFixed(2));
    return {
        flwAmount: usdAmount,
        flwCurrency: 'USD',
        converted: true,
        originalAmount: amount,
        originalCurrency: fromCurrency,
        exchangeRate: 1 / localToUsdRate
    };
}

module.exports.isFlutterwaveSupported = isFlutterwaveSupported;
module.exports.convertToFlutterwaveCurrency = convertToFlutterwaveCurrency;
