/**
 * Flutterwave Payment Service
 * Handles Flutterwave inline widget initialization and transaction verification.
 * No secret key is required for initialization — widget opens with public key.
 * Secret key is only used for verifyTransaction() (optional backup to webhook).
 */

const axios = require('axios');

class FlutterwaveService {
    constructor() {
        this.secretKey  = (process.env.FLUTTERWAVE_SECRET_KEY  || '').trim();
        this.publicKey  = (process.env.FLUTTERWAVE_PUBLIC_KEY  || '').trim();
        this.baseUrl    = 'https://api.flutterwave.com/v3';

        if (!this.secretKey) {
            console.warn('⚠️  FLUTTERWAVE_SECRET_KEY not configured – verify endpoint will use webhook-only flow');
        } else {
            console.log('✅ Flutterwave service ready. Key prefix:', this.secretKey.substring(0, 12) + '...');
        }
    }

    /** Read key fresh at request-time to handle hot config reloads */
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
     * Returns ONLY the payment options that Flutterwave supports for a given currency.
     * Passing incompatible options causes the widget's internal Redux store to crash.
     *
     * Supported by currency:
     *   XAF / XOF (CEMAC/ECOWAS) → mobilemoney, card
     *   KES (Kenya)               → card, mobilemoney, mpesa, banktransfer
     *   GHS (Ghana)               → card, mobilemoney
     *   NGN (Nigeria)             → card, banktransfer, ussd, mobilemoney, barter
     *   ZAR (South Africa)        → card, banktransfer, eft
     *   USD / GBP / EUR etc.      → card
     */
    getPaymentOptions(currency) {
        switch ((currency || '').toUpperCase()) {
            // CEMAC/ECOWAS mobile-money zones
            case 'XAF':
            case 'XOF':
            case 'RWF':   // Rwanda
            case 'UGX':   // Uganda
            case 'TZS':   // Tanzania
            case 'ETB':   // Ethiopia
            case 'ZMW':   // Zambia
            case 'MWK':   // Malawi
            case 'SLL':   // Sierra Leone
                return 'mobilemoney,card';

            case 'KES':
                return 'card,mobilemoney,mpesa,banktransfer';

            case 'GHS':
                return 'card,mobilemoney';

            case 'NGN':
                return 'card,banktransfer,ussd,mobilemoney,barter';

            case 'ZAR':
                return 'card,banktransfer,eft';

            // All other currencies — card is universally supported
            default:
                return 'card';
        }
    }

    /**
     * Prepare transaction metadata for the frontend Flutterwave inline widget.
     * No Flutterwave API call is made — the frontend opens the widget directly
     * using the PUBLIC key only.
     *
     * @param {object} params
     * @returns {{ success: boolean, data: object }}
     */
    async initializeTransaction(params) {
        const {
            amount, currency, email, reference,
            redirectUrl, customerName, customerPhone, description, meta = {}
        } = params;

        const cur            = (currency || 'USD').toUpperCase();
        const paymentOptions = this.getPaymentOptions(cur);

        console.log(`🔄 FLW widget params: ${reference} | ${cur} ${amount} | options: [${paymentOptions}]`);

        return {
            success: true,
            data: {
                authorization_url: null,   // not used in inline mode
                reference,
                inlineMode: true,
                widgetParams: {
                    public_key:      (this.publicKey || process.env.FLUTTERWAVE_PUBLIC_KEY || '').trim(),
                    tx_ref:          reference,
                    amount,
                    currency:        cur,
                    redirect_url:    redirectUrl,
                    payment_options: paymentOptions,
                    customer: {
                        email:       email,
                        phonenumber: customerPhone || '',
                        name:        customerName  || email
                    },
                    customizations: {
                        title:       'ClassyBet Deposit',
                        description: description || `Deposit of ${cur} ${amount}`,
                        logo:        'https://classybetaviator.com/images/classybetcasino-logo.jpeg'
                    },
                    meta: { ...meta, source: 'classybet' }
                }
            }
        };
    }

    /**
     * Verify a completed transaction using the secret key.
     * Called from /flw-deposit-verify after the widget's callback fires.
     *
     * @param {string|number} transactionId – Flutterwave's numeric transaction_id
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
                        amount:        data.amount,
                        currency:      data.currency,
                        status:        data.status,   // 'successful' | 'failed' | 'pending'
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
            const httpStatus = error.response?.status;
            const httpBody   = error.response?.data;
            console.error('❌ Flutterwave verify error:', httpStatus, JSON.stringify(httpBody) || error.message);
            return {
                success: false,
                error:   httpBody?.message || error.message
            };
        }
    }

    /**
     * Verify Flutterwave webhook signature.
     * Uses the verif-hash header — does NOT require secret key.
     *
     * @param {string} signature – value of 'verif-hash' header
     * @returns {boolean}
     */
    verifyWebhookSignature(signature) {
        const secret = process.env.FLUTTERWAVE_WEBHOOK_HASH;
        if (!secret) {
            console.warn('⚠️  FLUTTERWAVE_WEBHOOK_HASH not set – skipping signature check');
            return true;
        }
        return signature === secret;
    }
}

module.exports = new FlutterwaveService();
