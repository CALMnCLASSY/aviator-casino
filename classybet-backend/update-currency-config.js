const fs = require('fs');

const codes = require('../classybet/country-codes.js');

let mapStr = 'const COUNTRY_CURRENCY_MAP = {\n';
let symStr = 'const CURRENCY_SYMBOLS = {\n';
let nameStr = 'const CURRENCY_NAMES = {\n';

const symbols = {};
const names = {};

codes.forEach(c => {
    mapStr += `    '${c.code}': { currency: '${c.currency}', country: '${c.name}' },\n`;
    symbols[c.currency] = c.currencySymbol;
    names[c.currency] = c.currency; 
});

Object.keys(symbols).forEach(k => {
    symStr += `    '${k}': '${symbols[k]}',\n`;
});
Object.keys(symbols).forEach(k => {
    nameStr += `    '${k}': '${k}',\n`; 
});

mapStr += '};\n';
symStr += '};\n';
nameStr += '};\n';

const content = fs.readFileSync('utils/currencyConfig.js', 'utf8');

// Replace the sections in the file
let newContent = content;

// Use regex to replace the blocks
newContent = newContent.replace(/const CURRENCY_SYMBOLS = \{[\s\S]*?\};\n/, symStr + '\n');
newContent = newContent.replace(/const CURRENCY_NAMES = \{[\s\S]*?\};\n/, nameStr + '\n');
newContent = newContent.replace(/const COUNTRY_CURRENCY_MAP = \{[\s\S]*?\};\n/, mapStr + '\n');

// Also update getDepositLimits and getWithdrawalLimits to use dynamic conversion if not explicitly mapped
newContent = newContent.replace(
    /function getDepositLimits\(currency\) \{[\s\S]*?\}/,
    `function getDepositLimits(currency) {
    const ExchangeRateService = require('../services/ExchangeRateService');
    const rate = ExchangeRateService.getRate(currency);
    
    // Base limits in USD
    const baseMinUsd = 5;
    const baseMaxUsd = 10000;
    
    if (MIN_DEPOSIT[currency]) {
        return {
            min: MIN_DEPOSIT[currency],
            max: MAX_DEPOSIT[currency] || (baseMaxUsd * (rate || 1))
        };
    }
    
    // Dynamic calculation
    const mult = rate || 1;
    return {
        min: Math.ceil(baseMinUsd * mult),
        max: Math.floor(baseMaxUsd * mult)
    };
}`
);

newContent = newContent.replace(
    /function getWithdrawalLimits\(currency\) \{[\s\S]*?\}/,
    `function getWithdrawalLimits(currency) {
    const ExchangeRateService = require('../services/ExchangeRateService');
    const rate = ExchangeRateService.getRate(currency);
    
    // Base limits in USD
    const baseMinUsd = 20;
    const baseMaxUsd = 10000;
    
    if (MIN_WITHDRAWAL[currency]) {
        return {
            min: MIN_WITHDRAWAL[currency],
            max: MAX_WITHDRAWAL[currency] || (baseMaxUsd * (rate || 1))
        };
    }
    
    // Dynamic calculation
    const mult = rate || 1;
    return {
        min: Math.ceil(baseMinUsd * mult),
        max: Math.floor(baseMaxUsd * mult)
    };
}`
);



fs.writeFileSync('utils/currencyConfig.js', newContent);
console.log('Successfully updated utils/currencyConfig.js');
