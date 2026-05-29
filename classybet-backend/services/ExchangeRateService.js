const axios = require('axios');

class ExchangeRateService {
    constructor() {
        this.rates = {};
        this.lastUpdated = null;
        // Using fawazahmed0 currency API via jsDelivr CDN
        this.apiUrl = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
    }

    async fetchRates() {
        try {
            console.log('🔄 Fetching latest exchange rates...');
            const response = await axios.get(this.apiUrl);
            
            if (response.data && response.data.usd) {
                // The API returns rates where 1 USD = X of other currency
                this.rates = response.data.usd;
                this.lastUpdated = new Date(response.data.date || Date.now());
                console.log(`✅ Exchange rates updated successfully. Tracking ${Object.keys(this.rates).length} currencies.`);
            } else {
                throw new Error('Invalid response format from currency API');
            }
        } catch (error) {
            console.error('❌ Error fetching exchange rates:', error.message);
            // If we fail on startup, we might want to have some fallback or just keep the empty object
            // The currencyConfig will have to handle missing rates safely
        }
    }

    /**
     * Get the rate of a currency against 1 USD
     * e.g., if 1 USD = 130 KES, getRate('KES') returns 130
     * @param {string} currencyCode - 3-letter currency code
     * @returns {number|null} - The exchange rate or null if not found
     */
    getRate(currencyCode) {
        const code = currencyCode.toLowerCase();
        if (code === 'usd') return 1;
        return this.rates[code] || null;
    }

    /**
     * Start automatic daily updates
     */
    startPeriodicUpdates() {
        // Fetch immediately
        this.fetchRates();

        // Then fetch every 24 hours (24 * 60 * 60 * 1000 ms)
        setInterval(() => {
            this.fetchRates();
        }, 24 * 60 * 60 * 1000);
    }
}

// Export a singleton instance
module.exports = new ExchangeRateService();
