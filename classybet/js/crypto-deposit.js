/**
 * Crypto Deposit Module – Frontend
 * Sole deposit method: manual USDT deposits on TRC20 / BEP20 / ERC20.
 *
 * Architecture:
 *   - Injects its own modal DOM + styles (shared across pages)
 *   - Fetches networks/addresses/limits from GET /api/payments/crypto-options
 *   - User enters local-currency amount, picks a network, sends USDT
 *   - POST /api/payments/crypto-deposit declares the deposit (pending)
 *   - Admin verifies on-chain and confirms via /api/payments/confirm-deposit
 *
 * Usage: window.openCryptoDepositModal({ presetAmount, lockAmount, withdrawalId })
 * Requires: API_BASE global (falls back to localhost/prod detection).
 */

'use strict';

(function () {

    // Resolved lazily: pages expose the backend as API_BASE (const), API, or not at all.
    function apiRoot() {
        try { if (typeof API_BASE !== 'undefined' && API_BASE) return API_BASE; } catch (e) {}
        try { if (typeof API !== 'undefined' && API) return API; } catch (e) {}
        if (typeof window.API_BASE !== 'undefined' && window.API_BASE) return window.API_BASE;
        var h = window.location.hostname, p = window.location.protocol;
        return (h === 'localhost' || h === '127.0.0.1' || p === 'file:')
            ? 'http://localhost:4000'
            : 'https://back.classybetaviator.com';
    }

    // Fallback network config (mirrors backend defaults) if the API is unreachable
    var FALLBACK_NETWORKS = [
        { id: 'trc20', label: 'Tron (TRC20)', token: 'USDT', address: 'THv2KRPRJFeSxkptFw5A4XUwWAZfCTfNyR', explorer: 'https://tronscan.org/#/transaction/', feeHint: '~1 USDT network fee', recommended: true },
        { id: 'bep20', label: 'BNB Smart Chain (BEP20)', token: 'USDT', address: '0xEA976d5e41084B613Cd8970F79bCc5D414f99621', explorer: 'https://bscscan.com/tx/', feeHint: '~$0.30 network fee', recommended: false },
        { id: 'erc20', label: 'Ethereum (ERC20)', token: 'USDT', address: '0xEA976d5e41084B613Cd8970F79bCc5D414f99621', explorer: 'https://etherscan.io/tx/', feeHint: 'Higher gas fees', recommended: false }
    ];

    var NETWORK_LOGOS = {
        trc20:
            '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="16" cy="16" r="16" fill="#FF060A"/>' +
            '<path d="M17.3 9.2l5.6 6.8-1.7.4-3.7-4.5v9.9l8.1-9.7-4.2-2.9zM8.9 12.1l7.4 4.4-.1-4.3-7.4-4.4 5.7-2.3 3.9 2.4-6.1 1.9v2.3z" fill="#fff"/></svg>',
        bep20:
            '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="16" cy="16" r="16" fill="#F0B90B"/>' +
            '<path fill="#fff" d="M12.1 14.7L16 10.8l3.9 3.9 2.3-2.3L16 6.2l-6.2 6.2zM6.2 16l2.3-2.3L10.8 16l-2.3 2.3zM12.1 17.3l3.9 3.9 3.9-3.9 2.3 2.3-6.2 6.2-6.2-6.2zM21.2 16l2.3-2.3L25.8 16l-2.3 2.3z"/>' +
            '<path fill="#fff" d="M18.4 16L16 13.6 13.6 16l2.4 2.4z"/></svg>',
        erc20:
            '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="16" cy="16" r="16" fill="#627EEA"/>' +
            '<path fill="#fff" fill-opacity="0.6" d="M16.5 4v8.9l7.5 3.3z"/>' +
            '<path fill="#fff" d="M16.5 4L9 16.2l7.5-3.3z"/>' +
            '<path fill="#fff" fill-opacity="0.6" d="M16.5 21.9v6.1l7.5-10.4z"/>' +
            '<path fill="#fff" d="M16.5 28v-6.1L9 17.6z"/>' +
            '<path fill="#fff" fill-opacity="0.2" d="M16.5 20.6l7.5-4.4-7.5-3.3z"/>' +
            '<path fill="#fff" fill-opacity="0.6" d="M9 16.2l7.5 4.4v-7.7z"/></svg>'
    };

    var NETWORK_BRAND = {
        trc20: { color: '#FF060A', bg: 'rgba(255,6,10,0.12)' },
        bep20: { color: '#F0B90B', bg: 'rgba(240,185,11,0.12)' },
        erc20: { color: '#627EEA', bg: 'rgba(98,126,234,0.12)' }
    };

    var _options = null;          // cached /crypto-options response
    var _optionsPromise = null;   // de-dupe concurrent fetches
    var _ctx = { presetAmount: null, lockAmount: false, withdrawalId: null, onSuccess: null };
    var _selectedNetwork = 'trc20';
    var _qrLoaded = false;

    // ─── Styles + DOM injection ────────────────────────────────────────────────

    function _inject() {
        if (document.getElementById('cd-overlay')) return;

        var style = document.createElement('style');
        style.id = 'cd-styles';
        style.textContent = [
            '#cd-overlay{position:fixed;inset:0;background:rgba(4,8,18,.88);z-index:12000;display:none;align-items:center;justify-content:center;animation:cdFade .25s ease;}',
            '@keyframes cdFade{from{opacity:0}to{opacity:1}}',
            '#cd-box{background:linear-gradient(135deg,rgba(20,25,40,.98),rgba(15,20,35,.98));border:1px solid rgba(48,252,190,.25);border-radius:18px;max-width:620px;width:92%;max-height:92vh;overflow-y:auto;box-shadow:0 16px 60px rgba(0,0,0,.65);font-family:Inter,sans-serif;color:#fff;}',
            '#cd-box::-webkit-scrollbar{width:6px}#cd-box::-webkit-scrollbar-thumb{background:rgba(48,252,190,.3);border-radius:3px}',
            '.cd-head{display:flex;justify-content:space-between;align-items:center;padding:1.4rem 1.75rem;border-bottom:1px solid rgba(48,252,190,.15);position:sticky;top:0;background:rgba(20,25,40,.98);z-index:2;}',
            '.cd-head h3{margin:0;color:#30fcbe;font-size:1.15rem;display:flex;align-items:center;gap:.6rem;}',
            '.cd-close{background:none;border:none;color:#999;font-size:1.6rem;cursor:pointer;line-height:1;padding:0;}',
            '.cd-close:hover{color:#fff;}',
            '.cd-body{padding:1.75rem;}',
            '.cd-label{display:block;color:#30fcbe;font-weight:600;font-size:.9rem;margin-bottom:.6rem;}',
            '.cd-amount-wrap{position:relative;margin-bottom:1.5rem;}',
            '.cd-amount{width:100%;padding:.95rem 5.5rem .95rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:1.15rem;font-weight:600;box-sizing:border-box;}',
            '.cd-amount:focus{outline:none;border-color:#30fcbe;box-shadow:0 0 0 3px rgba(48,252,190,.12);}',
            '.cd-amount:disabled{opacity:.7;cursor:not-allowed;}',
            '.cd-cur{position:absolute;right:1rem;top:50%;transform:translateY(-50%);color:#999;font-weight:600;font-size:.95rem;}',
            '.cd-hint{color:#888;font-size:.8rem;margin-top:.4rem;display:block;}',
            '.cd-usdt{color:#ffc107;font-size:.85rem;margin-top:.4rem;display:block;font-weight:600;min-height:1em;}',
            '.cd-netgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.5rem;}',
            '.cd-net{border-radius:12px;padding:.9rem .5rem;text-align:center;cursor:pointer;border:2px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);transition:all .25s;position:relative;}',
            '.cd-net:hover{transform:translateY(-2px);border-color:rgba(48,252,190,.4);box-shadow:0 6px 18px rgba(0,0,0,.35);}',
            '.cd-net.cd-sel{border-color:#30fcbe;background:rgba(48,252,190,.08);box-shadow:0 0 0 3px rgba(48,252,190,.12);}',
            '.cd-net-logo{width:34px;height:34px;margin:0 auto .5rem;display:block;}',
            '.cd-net-logo svg{width:100%;height:100%;}',
            '.cd-net-name{font-weight:700;font-size:.8rem;}',
            '.cd-net-fee{color:#999;font-size:.68rem;margin-top:.3rem;}',
            '.cd-net-rec{position:absolute;top:-8px;right:-4px;background:#30fcbe;color:#04121c;font-size:.6rem;font-weight:800;padding:2px 7px;border-radius:10px;letter-spacing:.3px;}',
            '.cd-addr-panel{background:rgba(48,252,190,.06);border:1px solid rgba(48,252,190,.2);border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;}',
            '.cd-addr-row{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;}',
            '.cd-qr{width:96px;height:96px;flex:0 0 96px;background:#fff;border-radius:10px;padding:6px;display:flex;align-items:center;justify-content:center;}',
            '.cd-qr img,.cd-qr canvas{display:block;max-width:100%;max-height:100%;}',
            '.cd-addr-col{flex:1;min-width:190px;}',
            '.cd-addr-net{font-size:.8rem;color:#ccc;margin-bottom:.5rem;font-weight:600;}',
            '.cd-addr{font-family:"Courier New",monospace;word-break:break-all;background:rgba(0,0,0,.35);border:1px solid rgba(48,252,190,.2);border-radius:8px;padding:.7rem .8rem;color:#30fcbe;font-size:.82rem;margin-bottom:.6rem;}',
            '.cd-copybtn{background:rgba(48,252,190,.18);border:1px solid #30fcbe;color:#30fcbe;padding:.55rem 1.1rem;border-radius:8px;cursor:pointer;font-weight:700;font-size:.85rem;transition:all .2s;}',
            '.cd-copybtn:hover{background:rgba(48,252,190,.3);}',
            '.cd-warn{background:rgba(255,152,0,.1);border:1px solid rgba(255,152,0,.25);border-radius:10px;padding:.85rem 1rem;margin-bottom:1.25rem;color:#ffa726;font-size:.85rem;line-height:1.5;}',
            '.cd-txhash{width:100%;padding:.8rem 1rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#30fcbe;font-family:"Courier New",monospace;font-size:.85rem;box-sizing:border-box;}',
            '.cd-txhash:focus{outline:none;border-color:#30fcbe;}',
            '.cd-actions{display:flex;gap:.75rem;margin-top:1.25rem;}',
            '.cd-btn-ghost{flex:1;padding:.85rem;border:1px solid #666;background:transparent;color:#ccc;border-radius:9px;cursor:pointer;font-weight:600;transition:all .2s;}',
            '.cd-btn-ghost:hover{border-color:#999;color:#fff;}',
            '.cd-btn-main{flex:2;padding:.85rem;background:linear-gradient(135deg,#30fcbe,#28d1a0);color:#04121c;border:none;border-radius:9px;cursor:pointer;font-weight:800;font-size:.95rem;transition:all .2s;}',
            '.cd-btn-main:hover{filter:brightness(1.08);transform:translateY(-1px);}',
            '.cd-btn-main:disabled{opacity:.55;cursor:not-allowed;transform:none;}',
            '.cd-err{display:none;background:rgba(251,2,76,.12);border:1px solid rgba(251,2,76,.3);border-radius:8px;padding:.75rem 1rem;margin-bottom:1rem;color:#fb024c;font-size:.88rem;}',
            '.cd-success{display:none;text-align:center;padding:1rem 0;}',
            '.cd-success h4{color:#30fcbe;margin:.75rem 0 .5rem;font-size:1.15rem;}',
            '.cd-success p{color:#ccc;font-size:.9rem;line-height:1.6;margin:.3rem 0;}',
            '.cd-ref{font-family:"Courier New",monospace;color:#ffc107;font-weight:700;}',
            '.cd-check{width:60px;height:60px;border-radius:50%;background:rgba(48,252,190,.12);border:2px solid #30fcbe;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:1.8rem;color:#30fcbe;}',
            '@media(max-width:560px){.cd-netgrid{grid-template-columns:1fr;}.cd-net{display:flex;align-items:center;gap:.75rem;text-align:left;padding:.75rem 1rem;}.cd-net-logo{margin:0;}.cd-net-fee{margin-top:.15rem;}}'
        ].join('\n');
        document.head.appendChild(style);

        var overlay = document.createElement('div');
        overlay.id = 'cd-overlay';
        overlay.innerHTML = [
            '<div id="cd-box" role="dialog" aria-modal="true">',
            '  <div class="cd-head"><h3><i class="fas fa-coins"></i> Deposit via Crypto</h3><button class="cd-close" id="cd-close" aria-label="Close">×</button></div>',
            '  <div class="cd-body">',
            '    <div id="cd-err" class="cd-err"></div>',
            '    <div id="cd-main">',
            '      <label class="cd-label" for="cd-amount">Deposit Amount</label>',
            '      <div class="cd-amount-wrap">',
            '        <input type="number" id="cd-amount" class="cd-amount" min="0" step="any" placeholder="0.00">',
            '        <span class="cd-cur" id="cd-cur">USD</span>',
            '      </div>',
            '      <span class="cd-hint" id="cd-limits-hint">Loading limits…</span>',
            '      <span class="cd-usdt" id="cd-usdt-eq"></span>',
            '      <label class="cd-label" style="margin-top:1.25rem;">Select Network (USDT)</label>',
            '      <div class="cd-netgrid" id="cd-netgrid"></div>',
            '      <div class="cd-addr-panel">',
            '        <div class="cd-addr-row">',
            '          <div class="cd-qr" id="cd-qr"></div>',
            '          <div class="cd-addr-col">',
            '            <div class="cd-addr-net" id="cd-addr-net"></div>',
            '            <div class="cd-addr" id="cd-addr"></div>',
            '            <button type="button" class="cd-copybtn" id="cd-copy"><i class="fas fa-copy"></i> Copy Address</button>',
            '          </div>',
            '        </div>',
            '      </div>',
            '      <div class="cd-warn" id="cd-warn"></div>',
            '      <label class="cd-label" for="cd-txhash">Transaction Hash (optional — speeds up verification)</label>',
            '      <input type="text" id="cd-txhash" class="cd-txhash" placeholder="Paste txid after sending…">',
            '      <div class="cd-actions">',
            '        <button type="button" class="cd-btn-ghost" id="cd-cancel">CLOSE</button>',
            '        <button type="button" class="cd-btn-main" id="cd-submit"><i class="fas fa-check-circle"></i> I\'VE SENT THE PAYMENT</button>',
            '      </div>',
            '    </div>',
            '    <div id="cd-success" class="cd-success">',
            '      <div class="cd-check"><i class="fas fa-check"></i></div>',
            '      <h4>Deposit Declared!</h4>',
            '      <p>Reference: <span class="cd-ref" id="cd-ref"></span></p>',
            '      <p id="cd-success-msg">Our team is verifying your transaction on the blockchain.<br>Your balance will be credited within 5–30 minutes.</p>',
            '      <div class="cd-actions"><button type="button" class="cd-btn-main" id="cd-done" style="flex:1;">DONE</button></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
        document.body.appendChild(overlay);

        // Wire events
        document.getElementById('cd-close').addEventListener('click', closeCryptoDepositModal);
        document.getElementById('cd-cancel').addEventListener('click', closeCryptoDepositModal);
        document.getElementById('cd-done').addEventListener('click', closeCryptoDepositModal);
        document.getElementById('cd-copy').addEventListener('click', _copyAddress);
        document.getElementById('cd-submit').addEventListener('click', _submit);
        document.getElementById('cd-amount').addEventListener('input', _updateUsdtEquiv);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeCryptoDepositModal(); });
    }

    // ─── Data ──────────────────────────────────────────────────────────────────

    function _getToken() { return localStorage.getItem('user_token'); }

    function _getCurrency() {
        try {
            var u = JSON.parse(localStorage.getItem('userData'));
            return (u && u.currency) || 'USD';
        } catch (e) { return 'USD'; }
    }

    function _fmt(amount, currency) {
        if (typeof window.formatCurrency === 'function') {
            return window.formatCurrency(amount, currency);
        }
        var sym = (typeof window.getCurrencySymbol === 'function') ? window.getCurrencySymbol(currency) : currency;
        return sym + ' ' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    async function _loadOptions() {
        if (_options) return _options;
        if (_optionsPromise) return _optionsPromise;

        _optionsPromise = (async function () {
            var token = _getToken();
            try {
                var res = await fetch(apiRoot() + '/api/payments/crypto-options', {
                    headers: token ? { 'Authorization': 'Bearer ' + token } : {}
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                var data = await res.json();
                _options = {
                    networks: (data.networks && data.networks.length) ? data.networks : FALLBACK_NETWORKS,
                    currency: data.currency || _getCurrency(),
                    unitsPerUsd: data.unitsPerUsd || null,
                    limits: data.limits || null
                };
            } catch (e) {
                console.warn('crypto-options fetch failed, using fallback:', e.message);
                _options = {
                    networks: FALLBACK_NETWORKS,
                    currency: _getCurrency(),
                    unitsPerUsd: null,
                    limits: {
                        min: (typeof window.dynamicMinDeposit === 'number') ? window.dynamicMinDeposit : 5,
                        max: (typeof window.dynamicMaxDeposit === 'number') ? window.dynamicMaxDeposit : 10000,
                        formattedMin: null, formattedMax: null
                    }
                };
            }
            _optionsPromise = null;
            return _options;
        })();

        return _optionsPromise;
    }

    // ─── UI helpers ────────────────────────────────────────────────────────────

    function _getNetwork(id) {
        var nets = (_options && _options.networks) || FALLBACK_NETWORKS;
        for (var i = 0; i < nets.length; i++) if (nets[i].id === id) return nets[i];
        return nets[0];
    }

    function _renderNetworks() {
        var grid = document.getElementById('cd-netgrid');
        var nets = (_options && _options.networks) || FALLBACK_NETWORKS;
        grid.innerHTML = '';
        nets.forEach(function (n) {
            var card = document.createElement('div');
            card.className = 'cd-net' + (n.id === _selectedNetwork ? ' cd-sel' : '');
            card.dataset.net = n.id;
            card.innerHTML =
                (n.recommended ? '<span class="cd-net-rec">BEST</span>' : '') +
                '<span class="cd-net-logo">' + (NETWORK_LOGOS[n.id] || '') + '</span>' +
                '<span><span class="cd-net-name" style="color:' + (NETWORK_BRAND[n.id] ? NETWORK_BRAND[n.id].color : '#fff') + '">' + n.label + '</span>' +
                '<span class="cd-net-fee">' + (n.feeHint || '') + '</span></span>';
            card.addEventListener('click', function () { _selectNetwork(n.id); });
            grid.appendChild(card);
        });
    }

    function _selectNetwork(id) {
        _selectedNetwork = id;
        document.querySelectorAll('#cd-netgrid .cd-net').forEach(function (el) {
            el.classList.toggle('cd-sel', el.dataset.net === id);
        });
        _renderAddress();
    }

    function _renderAddress() {
        var n = _getNetwork(_selectedNetwork);
        var brand = NETWORK_BRAND[n.id] || { color: '#30fcbe' };
        document.getElementById('cd-addr-net').innerHTML =
            'Send <strong style="color:' + brand.color + '">' + n.token + '</strong> on <strong style="color:' + brand.color + '">' + n.label + '</strong>';
        document.getElementById('cd-addr').textContent = n.address;
        document.getElementById('cd-warn').innerHTML =
            '<i class="fas fa-exclamation-triangle"></i> <strong>Only send ' + n.token + ' on ' + n.label + '.</strong> ' +
            'Sending any other token or using a different network will result in permanent loss of funds.';

        // QR code (lazy-load qrcodejs once)
        var qrBox = document.getElementById('cd-qr');
        qrBox.innerHTML = '';
        _withQrLib(function () {
            try {
                new QRCode(qrBox, { text: n.address, width: 84, height: 84, correctLevel: QRCode.CorrectLevel.M });
            } catch (e) { qrBox.style.display = 'none'; }
        });
    }

    function _withQrLib(cb) {
        if (typeof QRCode !== 'undefined') return cb();
        if (_qrLoaded) { var q = document.getElementById('cd-qr'); if (q) q.style.display = 'none'; return; }
        _qrLoaded = true;
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        s.onload = cb;
        s.onerror = function () {
            var q = document.getElementById('cd-qr');
            if (q) q.style.display = 'none';
        };
        document.head.appendChild(s);
    }

    function _updateUsdtEquiv() {
        var el = document.getElementById('cd-usdt-eq');
        var amount = parseFloat(document.getElementById('cd-amount').value);
        var rate = _options && _options.unitsPerUsd;
        if (!amount || amount <= 0) { el.textContent = ''; return; }
        if (rate && rate > 0) {
            el.textContent = '≈ ' + (amount / rate).toFixed(2) + ' USDT to send';
        } else {
            el.textContent = 'Our team will credit the USDT equivalent of this amount';
        }
    }

    function _copyAddress() {
        var n = _getNetwork(_selectedNetwork);
        var btn = document.getElementById('cd-copy');
        var orig = btn.innerHTML;
        navigator.clipboard.writeText(n.address).then(function () {
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(function () { btn.innerHTML = orig; }, 2000);
        }).catch(function () {
            // Fallback for older browsers / non-secure contexts
            var ta = document.createElement('textarea');
            ta.value = n.address;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); btn.innerHTML = '<i class="fas fa-check"></i> Copied!'; } catch (e) { }
            document.body.removeChild(ta);
            setTimeout(function () { btn.innerHTML = orig; }, 2000);
        });
    }

    function _showError(msg) {
        var el = document.getElementById('cd-err');
        el.textContent = msg;
        el.style.display = 'block';
        clearTimeout(el._t);
        el._t = setTimeout(function () { el.style.display = 'none'; }, 6000);
    }

    // ─── Submit ────────────────────────────────────────────────────────────────

    async function _submit() {
        var errEl = document.getElementById('cd-err');
        errEl.style.display = 'none';

        var amount = parseFloat(document.getElementById('cd-amount').value);
        var txHash = document.getElementById('cd-txhash').value.trim();

        if (!_ctx.withdrawalId) {
            var min = (_options && _options.limits && _options.limits.min) || 5;
            var max = (_options && _options.limits && _options.limits.max) || 10000;
            if (isNaN(amount) || amount <= 0) return _showError('Please enter a valid amount');
            if (amount < min || amount > max) {
                return _showError('Amount must be between ' + _fmt(min, _options.currency) + ' and ' + _fmt(max, _options.currency));
            }
        } else if (isNaN(amount) || amount <= 0) {
            return _showError('Invalid fee amount');
        }

        var token = _getToken();
        if (!token) return _showError('Please login to make a deposit');

        var btn = document.getElementById('cd-submit');
        var orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Declaring…';

        try {
            var res = await fetch(apiRoot() + '/api/payments/crypto-deposit', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amount,
                    network: _selectedNetwork,
                    txHash: txHash || undefined,
                    withdrawalId: _ctx.withdrawalId || undefined
                })
            });
            var data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Failed to declare deposit');

            document.getElementById('cd-ref').textContent = data.reference;
            document.getElementById('cd-success-msg').innerHTML = _ctx.withdrawalId
                ? 'Your activation fee is being verified on the blockchain.<br>Once confirmed, your account will be reactivated and the withdrawal approved.'
                : 'Our team is verifying your transaction on the blockchain.<br>Your balance will be credited within 5–30 minutes.';
            document.getElementById('cd-main').style.display = 'none';
            document.getElementById('cd-success').style.display = 'block';

            _notifySupport(amount, data);

            if (typeof _ctx.onSuccess === 'function') {
                try { _ctx.onSuccess(data); } catch (e) { }
            }
        } catch (e) {
            _showError(e.message || 'Something went wrong. Please try again.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

    function _notifySupport(amount, data) {
        try {
            var userData = JSON.parse(localStorage.getItem('userData') || '{}');
            var n = _getNetwork(_selectedNetwork);
            var txHash = document.getElementById('cd-txhash').value.trim();
            fetch(apiRoot() + '/api/support/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _getToken() },
                body: JSON.stringify({
                    message: '🔔 CRYPTO DEPOSIT DECLARED\nUser: ' + (userData.username || 'unknown') +
                        '\nAmount: ' + amount + ' ' + (_options.currency || 'USD') +
                        '\nNetwork: ' + n.label + ' (' + n.token + ')' +
                        '\nWallet: ' + n.address +
                        (txHash ? '\nTx Hash: ' + txHash : '') +
                        '\nReference: ' + data.reference +
                        '\nTime: ' + new Date().toLocaleString(),
                    page: window.location.pathname, url: window.location.href
                })
            }).catch(function () { });
        } catch (e) { }
    }

    // ─── Public API ────────────────────────────────────────────────────────────

    async function openCryptoDepositModal(opts) {
        opts = opts || {};
        _ctx = {
            presetAmount: (typeof opts.presetAmount === 'number') ? opts.presetAmount : null,
            lockAmount: !!opts.lockAmount,
            withdrawalId: opts.withdrawalId || null,
            onSuccess: opts.onSuccess || null
        };

        _inject();

        var overlay = document.getElementById('cd-overlay');
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Reset view
        document.getElementById('cd-main').style.display = 'block';
        document.getElementById('cd-success').style.display = 'none';
        document.getElementById('cd-err').style.display = 'none';
        document.getElementById('cd-txhash').value = '';

        var amountInput = document.getElementById('cd-amount');
        amountInput.value = (_ctx.presetAmount != null) ? _ctx.presetAmount : '';
        amountInput.disabled = _ctx.lockAmount;
        if (_ctx.lockAmount) {
            document.getElementById('cd-limits-hint').textContent = 'Activation / processing fee';
        }

        await _loadOptions();

        document.getElementById('cd-cur').textContent = _options.currency || _getCurrency();
        if (!_ctx.lockAmount && _options.limits) {
            var minTxt = _options.limits.formattedMin || _fmt(_options.limits.min, _options.currency);
            var maxTxt = _options.limits.formattedMax || _fmt(_options.limits.max, _options.currency);
            document.getElementById('cd-limits-hint').textContent = 'Min: ' + minTxt + ' • Max: ' + maxTxt;
        } else if (!_ctx.lockAmount) {
            document.getElementById('cd-limits-hint').textContent = '';
        }

        _selectedNetwork = (_options.networks && _options.networks[0]) ? _options.networks[0].id : 'trc20';
        _renderNetworks();
        _renderAddress();
        _updateUsdtEquiv();
    }

    function closeCryptoDepositModal() {
        var overlay = document.getElementById('cd-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeCryptoDepositModal();
    });

    window.openCryptoDepositModal = openCryptoDepositModal;
    window.closeCryptoDepositModal = closeCryptoDepositModal;

})();
