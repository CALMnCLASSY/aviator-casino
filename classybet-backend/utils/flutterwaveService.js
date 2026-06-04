/**
 * Flutterwave Payment Service
 * Handles all Flutterwave Rave API interactions for deposits
 * Primary payment provider (Paystack is used as fallback)
 */

const axios = require('axios');

class FlutterwaveService {
    constructor() {
        this.secretKey  = process.env.FLUTTERWAVE_SECRET_KEY;
        this.publicKey  = process.env.FLUTTERWAVE_PUBLIC_KEY;
        this.baseUrl    = 'https://api.flutterwave.com/v3';
        this.encryptKey = process.env.FLUTTERWAVE_ENCRYPT_KEY || '';

        if (!this.secretKey) {
            console.warn('⚠️  FLUTTERWAVE_SECRET_KEY not configured – Flutterwave payments disabled');
        }
    }

    getHeaders() {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Initialize a Flutterwave hosted payment link.
     * Returns a redirect URL that opens Flutterwave's hosted payment page.
     *
     * @param {object} params
     *   amount            {number}  – amount in user's currency
     *   currency          {string}  – ISO 4217 code (e.g. KES, USD, NGN, GHS)
     *   email             {string}
     *   reference         {string}  – our internal transaction reference
     *   redirectUrl       {string}  – where Flutterwave redirects after payment
     *   customerName      {string}
     *   customerPhone     {string}
     *   description       {string}
     *   meta              {object}  – arbitrary key-value pairs
     */
    async initializeTransaction(params) {
        try {
            const {
                amount,
                currency,
                email,
                reference,
                redirectUrl,
                customerName,
                customerPhone,
                description,
                meta = {}
            } = params;

            const payload = {
                tx_ref:           reference,
                amount:           amount,          // Flutterwave uses major units (no *100)
                currency:         currency.toUpperCase(),
                redirect_url:     redirectUrl,
                payment_options:  'card,mobilemoney,ussd,banktransfer,mpesa,barter,nqr',
                customer: {
                    email:        email,
                    phonenumber:  customerPhone || '',
                    name:         customerName  || email
                },
                customizations: {
                    title:        'ClassyBet Deposit',
                    description:  description || `Deposit of ${currency} ${amount}`,
                    logo:         'https://classybetaviator.com/images/classybetcasino-logo.jpeg'
                },
                meta: {
                    ...meta,
                    source: 'classybet'
                }
            };

            console.log('🔄 Initializing Flutterwave transaction:', {
                reference,
                amount,
                currency
            });

            const response = await axios.post(
                `${this.baseUrl}/payments`,
                payload,
                { headers: this.getHeaders() }
            );

            if (response.data.status === 'success') {
                console.log('✅ Flutterwave transaction initialized:', reference);
                return {
                    success:  true,
                    data: {
                        authorization_url: response.data.data.link,
                        reference:         reference
                    }
                };
            } else {
                throw new Error(response.data.message || 'Flutterwave initialization failed');
            }

        } catch (error) {
            const httpStatus  = error.response?.status;
            const httpBody    = error.response?.data;
            console.error('\u274c Flutterwave API error:');
            console.error('   HTTP Status  :', httpStatus || 'No response (network error)');
            console.error('   Response Body:', JSON.stringify(httpBody) || error.message);
            console.error('   Secret Key OK:', !!this.secretKey,
                this.secretKey ? '(' + this.secretKey.substring(0, 10) + '...)' : '(NOT SET)');
            return {
                success: false,
                error:   httpBody?.message || error.message
            };
        }
    }

    /**
     * Verify a transaction by transaction ID (returned in the redirect or webhook).
     *
     * @param {string|number} transactionId  – Flutterwave's numeric transaction_id
     */
    async verifyTransaction(transactionId) {
        try {
            console.log('🔍 Verifying Flutterwave transaction:', transactionId);

            const response = await axios.get(
                `${this.baseUrl}/transactions/${transactionId}/verify`,
                { headers: this.getHeaders() }
            );

            if (response.data.status === 'success') {
                const data = response.data.data;
                console.log('✅ Flutterwave transaction verified:', {
                    id:       data.id,
                    status:   data.status,
                    amount:   data.amount,
                    currency: data.currency
                });

                return {
                    success: true,
                    data: {
                        transactionId: data.id,
                        reference:     data.tx_ref,
                        amount:        data.amount,        // already in major units
                        currency:      data.currency,
                        status:        data.status,        // 'successful' | 'failed' | 'pending'
                        paidAt:        data.created_at,
                        channel:       data.payment_type,
                        customer:      data.customer,
                        metadata:      data.meta
                    }
                };
            } else {
                throw new Error(response.data.message || 'Flutterwave verification failed');
            }

        } catch (error) {
            console.error('❌ Flutterwave verification error:', error.response?.data || error.message);
            return {
                success: false,
                error:   error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Verify Flutterwave webhook signature.
     * Flutterwave sends a verif-hash header that must match FLUTTERWAVE_WEBHOOK_HASH env var.
     *
     * @param {string} signature  – value of 'verif-hash' header
     * @returns {boolean}
     */
    verifyWebhookSignature(signature) {
        const secret = process.env.FLUTTERWAVE_WEBHOOK_HASH;
        if (!secret) {
            console.warn('⚠️  FLUTTERWAVE_WEBHOOK_HASH not set – skipping signature verification');
            return true; // allow through but warn
        }
        return signature === secret;
    }
}

module.exports = new FlutterwaveService();
