const fs = require('fs');

const data = require('../classybet/country-codes.js');

const trueCurrencies = {
  'Uganda': {c: 'UGX', s: 'USh'},
  'Tanzania': {c: 'TZS', s: 'TSh'},
  'Rwanda': {c: 'RWF', s: 'FRw'},
  'Ethiopia': {c: 'ETB', s: 'Br'},
  'Zambia': {c: 'ZMW', s: 'ZK'},
  'Zimbabwe': {c: 'ZWL', s: 'Z$'},
  'Botswana': {c: 'BWP', s: 'P'},
  'Malawi': {c: 'MWK', s: 'MK'},
  'Mozambique': {c: 'MZN', s: 'MT'},
  'India': {c: 'INR', s: '₹'},
  'United States': {c: 'USD', s: '$'},
  'Canada': {c: 'CAD', s: '$'},
  'Australia': {c: 'AUD', s: '$'},
  'Switzerland': {c: 'CHF', s: 'CHF'},
  'Sweden': {c: 'SEK', s: 'kr'},
  'Norway': {c: 'NOK', s: 'kr'},
  'Denmark': {c: 'DKK', s: 'kr'},
  'Poland': {c: 'PLN', s: 'zł'},
  'Czech Republic': {c: 'CZK', s: 'Kč'},
  'Hungary': {c: 'HUF', s: 'Ft'},
  'Turkey': {c: 'TRY', s: '₺'},
  'Russia': {c: 'RUB', s: '₽'},
  'Ukraine': {c: 'UAH', s: '₴'},
  'Romania': {c: 'RON', s: 'lei'},
  'Bulgaria': {c: 'BGN', s: 'лв'},
  'Serbia': {c: 'RSD', s: 'дин.'},
  'China': {c: 'CNY', s: '¥'},
  'Japan': {c: 'JPY', s: '¥'},
  'South Korea': {c: 'KRW', s: '₩'},
  'Thailand': {c: 'THB', s: '฿'},
  'Vietnam': {c: 'VND', s: '₫'},
  'Malaysia': {c: 'MYR', s: 'RM'},
  'Singapore': {c: 'SGD', s: '$'},
  'Philippines': {c: 'PHP', s: '₱'},
  'Indonesia': {c: 'IDR', s: 'Rp'},
  'Bangladesh': {c: 'BDT', s: '৳'},
  'Pakistan': {c: 'PKR', s: '₨'},
  'Sri Lanka': {c: 'LKR', s: 'Rs'},
  'Nepal': {c: 'NPR', s: 'रु'},
  'Myanmar': {c: 'MMK', s: 'K'},
  'Cambodia': {c: 'KHR', s: '៛'},
  'Laos': {c: 'LAK', s: '₭'},
  'Brunei': {c: 'BND', s: '$'},
  'Maldives': {c: 'MVR', s: 'Rf'},
  'Afghanistan': {c: 'AFN', s: '؋'},
  'Iran': {c: 'IRR', s: '﷼'},
  'Iraq': {c: 'IQD', s: 'ع.د'},
  'Saudi Arabia': {c: 'SAR', s: '﷼'},
  'UAE': {c: 'AED', s: 'د.إ'},
  'Qatar': {c: 'QAR', s: '﷼'},
  'Kuwait': {c: 'KWD', s: 'د.ك'},
  'Bahrain': {c: 'BHD', s: 'ب.د'},
  'Oman': {c: 'OMR', s: 'ر.ع.'},
  'Jordan': {c: 'JOD', s: 'د.ا'},
  'Lebanon': {c: 'LBP', s: 'ل.ل'},
  'Syria': {c: 'SYP', s: '£'},
  'Israel': {c: 'ILS', s: '₪'},
  'Egypt': {c: 'EGP', s: '£'},
  'Libya': {c: 'LYD', s: 'ل.د'},
  'Tunisia': {c: 'TND', s: 'د.ت'},
  'Algeria': {c: 'DZD', s: 'د.ج'},
  'Morocco': {c: 'MAD', s: 'د.م.'},
  'Senegal': {c: 'XOF', s: 'CFA'},
  'Mali': {c: 'XOF', s: 'CFA'},
  'Burkina Faso': {c: 'XOF', s: 'CFA'},
  'Niger': {c: 'XOF', s: 'CFA'},
  'Chad': {c: 'XAF', s: 'FCFA'},
  'Sudan': {c: 'SDG', s: 'ج.س.'},
  'Eritrea': {c: 'ERN', s: 'Nfk'},
  'Djibouti': {c: 'DJF', s: 'Fdj'},
  'Somalia': {c: 'SOS', s: 'Sh'},
  'Madagascar': {c: 'MGA', s: 'Ar'},
  'Mauritius': {c: 'MUR', s: '₨'},
  'Seychelles': {c: 'SCR', s: '₨'},
  'Comoros': {c: 'KMF', s: 'CF'},
  'Cape Verde': {c: 'CVE', s: '$'},
  'Sao Tome and Principe': {c: 'STN', s: 'Db'},
  'Equatorial Guinea': {c: 'XAF', s: 'FCFA'},
  'Gabon': {c: 'XAF', s: 'FCFA'},
  'Republic of the Congo': {c: 'XAF', s: 'FCFA'},
  'Democratic Republic of Congo': {c: 'CDF', s: 'FC'},
  'Central African Republic': {c: 'XAF', s: 'FCFA'},
  'Cameroon': {c: 'XAF', s: 'FCFA'},
  'Angola': {c: 'AOA', s: 'Kz'},
  'Namibia': {c: 'NAD', s: '$'},
  'Lesotho': {c: 'LSL', s: 'L'},
  'Eswatini': {c: 'SZL', s: 'E'},
  'Gambia': {c: 'GMD', s: 'D'},
  'Guinea-Bissau': {c: 'XOF', s: 'CFA'},
  'Guinea': {c: 'GNF', s: 'FG'},
  'Sierra Leone': {c: 'SLL', s: 'Le'},
  'Liberia': {c: 'LRD', s: '$'},
  'Ivory Coast': {c: 'XOF', s: 'CFA'},
  'Togo': {c: 'XOF', s: 'CFA'},
  'Benin': {c: 'XOF', s: 'CFA'},
  'Mexico': {c: 'MXN', s: '$'},
  'Brazil': {c: 'BRL', s: 'R$'}
};

data.forEach(c => {
    if (trueCurrencies[c.name]) {
        c.currency = trueCurrencies[c.name].c;
        c.currencySymbol = trueCurrencies[c.name].s;
    }
});

let fileContent = '// Country codes for international phone number support with currency mapping\n' +
    'const countryCodes = [\n';

data.forEach((c, idx) => {
    fileContent += `    { name: "${c.name}", code: "${c.code}", flag: "${c.flag}", pattern: "${c.pattern}", placeholder: "${c.placeholder}", currency: "${c.currency}", currencySymbol: "${c.currencySymbol}" }${idx < data.length - 1 ? ',' : ''}\n`;
});

fileContent += '];\n\n' +
    '// Sort by country name for better UX\n' +
    'countryCodes.sort((a, b) => a.name.localeCompare(b.name));\n\n' +
    '// Export for use\n' +
    "if (typeof module !== 'undefined' && module.exports) {\\n" +
    "    module.exports = countryCodes;\\n" +
    "} else if (typeof window !== 'undefined') {\\n" +
    "    window.countryCodes = countryCodes;\\n" +
    "}\\n";

fs.writeFileSync('../classybet/country-codes.js', fileContent);
console.log('Updated classybet/country-codes.js successfully');
