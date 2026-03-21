/**
 * Paystack Payment Service
 * Handles all Paystack API interactions for deposits and withdrawals
 */

const axios = require('axios');

class PaystackService {
    constructor() {
        this.secretKey = process.env.PAYSTACK_SECRET_KEY;
        this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
        this.baseUrl = 'https://api.paystack.co';

        if (!this.secretKey) {
            console.warn('⚠️ PAYSTACK_SECRET_KEY not configured');
        }
    }

    /**
     * Get headers for Paystack API requests
     */
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Initialize a deposit transaction
     * @param {object} params - { email, amount, currency, reference, channels, metadata }
     * @returns {Promise<object>} - Paystack initialization response
     */
    async initializeTransaction(params) {
        try {
            const { email, amount, currency, reference, channels, metadata = {} } = params;

            // Convert amount to kobo/pesewas/cents (smallest currency unit)
            const amountInMinorUnit = Math.round(amount * 100);

            const payload = {
                email,
                amount: amountInMinorUnit,
                currency: currency.toUpperCase(),
                reference,
                channels: channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer', 'eft'],
                metadata: {
                    ...metadata,
                    custom_fields: [
                        {
                            display_name: 'Transaction Type',
                            variable_name: 'transaction_type',
                            value: 'deposit'
                        }
                    ]
                },
                callback_url: metadata.callback_url || `${process.env.FRONTEND_URL || 'http://localhost:5500'}/deposit-success.html`
            };

            console.log('🔄 Initializing Paystack transaction:', {
                email,
                amount: amountInMinorUnit,
                currency,
                reference,
                channels: payload.channels
            });

            const response = await axios.post(
                `${this.baseUrl}/transaction/initialize`,
                payload,
                { headers: this.getHeaders() }
            );

            if (response.data.status) {
                console.log('✅ Paystack transaction initialized:', response.data.data.reference);
                return {
                    success: true,
                    data: response.data.data
                };
            } else {
                throw new Error(response.data.message || 'Transaction initialization failed');
            }

        } catch (error) {
            console.error('❌ Paystack initialization error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Verify a transaction
     * @param {string} reference - Transaction reference
     * @returns {Promise<object>} - Verification result
     */
    async verifyTransaction(reference) {
        try {
            console.log('🔍 Verifying Paystack transaction:', reference);

            const response = await axios.get(
                `${this.baseUrl}/transaction/verify/${reference}`,
                { headers: this.getHeaders() }
            );

            if (response.data.status) {
                const data = response.data.data;
                console.log('✅ Transaction verified:', {
                    reference: data.reference,
                    status: data.status,
                    amount: data.amount / 100,
                    currency: data.currency
                });

                return {
                    success: true,
                    data: {
                        reference: data.reference,
                        amount: data.amount / 100, // Convert back to major unit
                        currency: data.currency,
                        status: data.status,
                        paidAt: data.paid_at,
                        channel: data.channel,
                        customer: data.customer,
                        metadata: data.metadata
                    }
                };
            } else {
                throw new Error(response.data.message || 'Verification failed');
            }

        } catch (error) {
            console.error('❌ Paystack verification error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Initialize a transfer (withdrawal)
     * @param {object} params - { amount, currency, recipient, reason, reference }
     * @returns {Promise<object>} - Transfer initialization response
     */
    async initiateTransfer(params) {
        try {
            const { amount, currency, recipient, reason, reference } = params;

            // Convert amount to minor unit
            const amountInMinorUnit = Math.round(amount * 100);

            const payload = {
                source: 'balance',
                amount: amountInMinorUnit,
                currency: currency.toUpperCase(),
                recipient,
                reason: reason || 'Withdrawal',
                reference
            };

            console.log('🔄 Initiating Paystack transfer:', {
                amount: amountInMinorUnit,
                currency,
                reference
            });

            const response = await axios.post(
                `${this.baseUrl}/transfer`,
                payload,
                { headers: this.getHeaders() }
            );

            if (response.data.status) {
                console.log('✅ Transfer initiated:', response.data.data.reference);
                return {
                    success: true,
                    data: response.data.data
                };
            } else {
                throw new Error(response.data.message || 'Transfer initiation failed');
            }

        } catch (error) {
            console.error('❌ Paystack transfer error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Create a transfer recipient
     * @param {object} params - { type, name, account_number, bank_code, currency }
     * @returns {Promise<object>} - Recipient creation response
     */
    async createTransferRecipient(params) {
        try {
            const { type, name, account_number, bank_code, currency } = params;

            const payload = {
                type: type || 'nuban', // nuban for Nigerian banks, mobile_money for Ghana, etc.
                name,
                account_number,
                bank_code,
                currency: currency.toUpperCase()
            };

            console.log('🔄 Creating transfer recipient:', { name, currency });

            const response = await axios.post(
                `${this.baseUrl}/transferrecipient`,
                payload,
                { headers: this.getHeaders() }
            );

            if (response.data.status) {
                console.log('✅ Recipient created:', response.data.data.recipient_code);
                return {
                    success: true,
                    data: response.data.data
                };
            } else {
                throw new Error(response.data.message || 'Recipient creation failed');
            }

        } catch (error) {
            console.error('❌ Paystack recipient creation error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * List banks for a country
     * @param {string} currency - Currency code
     * @returns {Promise<object>} - List of banks
     */
    async listBanks(currency) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/bank?currency=${currency.toUpperCase()}`,
                { headers: this.getHeaders() }
            );

            if (response.data.status) {
                return {
                    success: true,
                    data: response.data.data
                };
            } else {
                throw new Error(response.data.message || 'Failed to fetch banks');
            }

        } catch (error) {
            console.error('❌ Paystack banks list error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Verify webhook signature
     * @param {string} signature - X-Paystack-Signature header
     * @param {object} body - Request body
     * @returns {boolean} - Whether signature is valid
     */
    verifyWebhookSignature(signature, body) {
        const crypto = require('crypto');
        const hash = crypto
            .createHmac('sha512', this.secretKey)
            .update(JSON.stringify(body))
            .digest('hex');

        return hash === signature;
    }

    /**
     * Get transaction timeline
     * @param {string} reference - Transaction reference
     * @returns {Promise<object>} - Transaction timeline
     */
    async getTransactionTimeline(reference) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/transaction/timeline/${reference}`,
                { headers: this.getHeaders() }
            );

            if (response.data.status) {
                return {
                    success: true,
                    data: response.data.data
                };
            } else {
                throw new Error(response.data.message || 'Failed to fetch timeline');
            }

        } catch (error) {
            console.error('❌ Paystack timeline error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

// Export singleton instance
module.exports = new PaystackService();
