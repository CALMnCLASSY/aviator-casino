/**
 * Flutterwave Payment Service
 * Handles all Flutterwave Rave API interactions for deposits
 * Primary payment provider (Paystack is used as fallback)
 */

const axios = require('axios');

class FlutterwaveService {
    constructor() {
        // Read & trim at construction – trimming avoids leading/trailing whitespace bugs
        this.secretKey  = (process.env.FLUTTERWAVE_SECRET_KEY  || '').trim();
        this.publicKey  = (process.env.FLUTTERWAVE_PUBLIC_KEY  || '').trim();
        this.baseUrl    = 'https://api.flutterwave.com/v3';
        this.encryptKey = (process.env.FLUTTERWAVE_ENCRYPT_KEY || '').trim();

        if (!this.secretKey) {
            console.warn('⚠️  FLUTTERWAVE_SECRET_KEY not configured – Flutterwave payments disabled');
        } else {
            console.log('✅ Flutterwave service ready. Key prefix:', this.secretKey.substring(0, 12) + '...');
        }
    }

    /**
     * Always read key fresh from env at request time in case
     * it was updated after module load (e.g. hot config reload).
     */
    getSecretKey() {
        return (process.env.FLUTTERWAVE_SECRET_KEY || this.secretKey || '').trim();
    }

    getHeaders() {
        return {
            Authorization: `Bearer ${this.getSecretKey()}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Prepare transaction metadata for the frontend Flutterwave inline widget.
     * No Flutterwave API call is made – the frontend opens the widget directly
     * using the public key. Balance is credited via webhook on payment success.
     *
     * @param {object} params
     * @returns {{ success: boolean, data: object }}
     */
    async initializeTransaction(params) {
        // No secret key needed – just return the params for the frontend widget
        const {
            amount, currency, email, reference,
            redirectUrl, customerName, customerPhone, description, meta = {}
        } = params;

        console.log('🔄 Preparing Flutterwave widget payload:', { reference, amount, currency });

        return {
            success: true,
            data: {
                // The frontend widget only needs a payment_link-style flag and the tx_ref
                authorization_url: null,         // not used in inline widget mode
                reference,
                inlineMode: true,                // tells frontend to open FlutterwaveCheckout()
                widgetParams: {
                    public_key:      this.publicKey || process.env.FLUTTERWAVE_PUBLIC_KEY,
                    tx_ref:          reference,
                    amount,
                    currency:        currency.toUpperCase(),
                    redirect_url:    redirectUrl,
                    payment_options: 'card,mobilemoney,ussd,banktransfer,mpesa,barter',
                    customer: {
                        email:       email,
                        phonenumber: customerPhone || '',
                        name:        customerName  || email
                    },
                    customizations: {
                        title:       'ClassyBet Deposit',
                        description: description || `Deposit of ${currency} ${amount}`,
                        logo:        'https://classybetaviator.com/images/classybetcasino-logo.jpeg'
                    },
                    meta: { ...meta, source: 'classybet' }
                }
            }
        };
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
