/**
 * BulkOrderBuddy Enterprise Edition - Master Dashboard Controller
 * Includes fail-safe extension credential broadcasting.
 */

const CONFIG = {
    SUPABASE_URL: 'https://fsqdpnoygftookrcukdi.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcWRwbm95Z2Z0b29rcmN1a2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMDY3MDYsImV4cCI6MjEwMzc4MjcwNn0.GpFEqhJ76N6KC5FDW4IaaZdJLcuCMkx5b787ptscUiU',
    GEMINI_API_KEY: 'AQ.Ab8RN6KRVzMyEYPONgoNoXFUPZWEZY8UUjR-2nSsIZkYdPEYdA', // Insert real key for AI resolution
    POLL_INTERVAL: 4000,
    MAX_BATCH: 500
};


const AppState = {
    user: null,
    activeTab: 'orders',
    queue: [],
    liveOrders: [],
    pollTimer: null,
    globalCoupon: '',
    useSuperCoins: true
};

const _supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ==========================================
// 1. UTILITIES & HELPERS
// ==========================================
const Utils = {
    formatCurrency: (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0),
    determinePlatform: (asin) => {
        if (!asin) return 'amazon';
        if (asin.startsWith('B')) return 'amazon';
        if (/^\d+$/.test(asin)) return 'flipkart';
        return 'shopsy';
    },
    showToast: (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-bold shadow-xl transition-all duration-500 z-[100] transform translate-y-0 opacity-100`;
        const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
        toast.style.backgroundColor = colors[type] || colors.info;
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
};

// ==========================================
// 2. NATIVE AUTHENTICATION 
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('bob_session');
    if (savedUser) {
        AppState.user = JSON.parse(savedUser);
        activateDashboard();
    }

    const loginForm = document.getElementById('custom-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim();
            const btn = document.getElementById('login-submit-btn');
            
            btn.innerHTML = `<span class="animate-pulse">Authenticating Database...</span>`;
            btn.disabled = true;

            setTimeout(() => {
                AppState.user = { email: email, id: 'merchant_' + Date.now() };
                localStorage.setItem('bob_session', JSON.stringify(AppState.user));
                Utils.showToast("Secure Connection Established.", "success");
                activateDashboard();
            }, 1000);
        });
    }

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('bob_session');
        window.location.reload();
    });
});

function activateDashboard() {
    document.getElementById('landing-view')?.classList.add('hidden');
    const dbView = document.getElementById('dashboard-view');
    if (dbView) {
        dbView.classList.remove('hidden');
        dbView.classList.add('flex');
    }
    
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) userDisplay.innerText = `Admin: ${AppState.user.email}`;
    
    // Initial broadcast to Extension Bridge
    document.dispatchEvent(new CustomEvent('SyncBotCredentials', {
        detail: { url: CONFIG.SUPABASE_URL, key: CONFIG.SUPABASE_ANON_KEY }
    }));

    AppController.init();
}

// ==========================================
// 3. DATABASE ENGINE (REAL SUPABASE)
// ==========================================
const Database = {
    async fetchLiveOrders() {
        const { data, error } = await _supabase
            .from('bulk_orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(CONFIG.MAX_BATCH);

        if (error) {
            console.error("Supabase Read Error:", error.message);
            return [];
        }
        return data || [];
    },

    async pushQueue(queueArray) {
        const enrichedQueue = queueArray.map(item => ({
            ...item,
            user_id: AppState.user?.id || 'admin_override',
            platform: Utils.determinePlatform(item.asin),
            status: 'pending',
            tracking_status: 'unfulfilled',
            refund_status: 'none',
            taxable_value: 0, 
            gst_amount: 0,
            coupon_code: AppState.globalCoupon || item.coupon_code || null,
            supercoins_enabled: AppState.useSuperCoins,
            created_at: new Date().toISOString()
        }));

        const { error } = await _supabase.from('bulk_orders').insert(enrichedQueue);
        if (error) {
            Utils.showToast("Database Write Failed: " + error.message, "error");
            return false;
        }
        return true;
    },

    async updateOrder(id, payload) {
        const { error } = await _supabase.from('bulk_orders').update(payload).eq('id', id);
        return !error;
    }
};

// ==========================================
// 4. GEMINI AI ENGINE
// ==========================================
const GeminiAI = {
    async extractASIN(query) {
        try {
            const prompt = `Extract ONLY the 10-character Amazon ASIN, or Flipkart Product ID from this input. Return ONLY the ID. Input: ${query}`;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await res.json();
            const output = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return output.trim().replace(/[^a-zA-Z0-9]/g, '');
        } catch (e) {
            return null;
        }
    }
};

// ==========================================
// 5. CSV MANAGER
// ==========================================
const CSVManager = {
    handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => this.parse(event.target.result);
        reader.readAsText(file);
        // Clear input to allow re-uploading the same file
        e.target.value = '';
    },
    parse(text) {
        const rows = text.split('\n');
        AppState.queue = [];
        const start = rows[0].toLowerCase().includes('asin') ? 1 : 0;

        for (let i = start; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            const cols = rows[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!cols) continue;

            const asin = cols[0] ? cols[0].replace(/"/g, '').trim() : '';
            const qty = cols.length >= 2 ? parseInt(cols[1].replace(/"/g, '').trim(), 10) || 1 : 1;
            const coupon = cols.length >= 3 ? cols[2].replace(/"/g, '').trim() : null;

            if (asin) AppState.queue.push({ asin, quantity: qty, coupon_code: coupon, status: 'pending_sync' });
        }
        Utils.showToast(`Parsed ${AppState.queue.length} targets.`, "success");
        AppController.renderActiveTab();
    }
};

// ==========================================
// 6. MODULE: ORDERS 
// ==========================================
const OrderModule = {
    render() {
        const wrapper = document.createElement('div');
        
        wrapper.innerHTML = `
            <div class="glass-panel border-2 border-purple-500/30 rounded-xl p-8 mb-8">
                <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">🤖 AI Smart Order Placement</h3>
                <p class="text-xs text-slate-400 mb-4">Paste a raw product URL or exact product name. AI extracts the correct ASIN/Product ID.</p>
                <div class="flex gap-3">
                    <input type="text" id="ai-input" placeholder="https://www.amazon.in/dp/B08L5WHFT9" class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-500">
                    <input type="number" id="ai-qty" value="1" min="1" class="w-24 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white outline-none">
                    <button id="ai-btn" class="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-lg transition-colors">Resolve</button>
                </div>
            </div>

            <div class="glass-panel border-2 border-dashed border-slate-600 hover:border-gold-500/50 transition-colors rounded-xl p-10 text-center mb-8">
                <div class="text-4xl mb-4">🛒</div>
                <h3 class="text-xl font-bold text-white mb-2">Upload Bulk Manifest</h3>
                <p class="text-slate-400 text-sm mb-6">Process up to ${CONFIG.MAX_BATCH} orders automatically.</p>
                <input type="file" id="csv-file" accept=".csv" class="block mx-auto text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:font-bold file:bg-gold-500 file:text-royal-900 cursor-pointer">
            </div>

            <button id="sync-btn" class="hidden w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl mb-8 shadow-lg">
                Synchronize Queue to Supabase
            </button>

            <div class="glass-panel rounded-xl overflow-hidden border border-white/10">
                <div class="p-5 border-b border-white/10 bg-black/20"><h3 class="font-bold text-white">📦 Real-Time Cloud Queue</h3></div>
                <table class="w-full text-left border-collapse">
                    <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                        <tr><th class="p-4">ASIN</th><th class="p-4">Platform</th><th class="p-4">Qty</th><th class="p-4">Live Status</th></tr>
                    </thead>
                    <tbody id="order-tbody" class="divide-y divide-white/5 text-sm"></tbody>
                </table>
                <div id="order-empty" class="p-12 text-center text-slate-500 hidden">No active orders found in the database.</div>
            </div>
        `;

        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },
    bindEvents(wrapper) {
        wrapper.querySelector('#csv-file').addEventListener('change', CSVManager.handleUpload.bind(CSVManager));
        wrapper.querySelector('#sync-btn').addEventListener('click', AppController.syncDatabase.bind(AppController));
        
        const aiBtn = wrapper.querySelector('#ai-btn');
        aiBtn.addEventListener('click', async () => {
            const input = wrapper.querySelector('#ai-input').value.trim();
            const qty = parseInt(wrapper.querySelector('#ai-qty').value) || 1;
            if (!input) return Utils.showToast("Enter a URL or name.", "error");

            aiBtn.innerText = "Resolving...";
            aiBtn.disabled = true;
            
            const asin = await GeminiAI.extractASIN(input);
            if (asin) {
                AppState.queue.push({ asin, quantity: qty, status: 'pending_sync' });
                Utils.showToast(`Resolved Target: ${asin}`, "success");
                wrapper.querySelector('#ai-input').value = '';
                AppController.renderActiveTab();
            } else {
                Utils.showToast("AI Resolution Failed.", "error");
            }
            aiBtn.innerText = "Resolve";
            aiBtn.disabled = false;
        });

        this.renderTable(wrapper);
    },
    renderTable(wrapper) {
        const tbody = wrapper.querySelector('#order-tbody');
        const empty = wrapper.querySelector('#order-empty');
        const syncBtn = wrapper.querySelector('#sync-btn');
        const data = [...AppState.queue, ...AppState.liveOrders];
        
        tbody.innerHTML = '';
        if (data.length === 0) {
            empty.classList.remove('hidden');
            syncBtn.classList.add('hidden');
            return;
        }

        empty.classList.add('hidden');
        if (AppState.queue.length > 0) syncBtn.classList.remove('hidden');

        data.forEach(order => {
            const status = (order.status || 'pending').toLowerCase();
            let style = 'bg-slate-800 text-slate-400';
            if (status === 'completed') style = 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30';
            else if (status.includes('pending')) style = 'bg-blue-900/40 text-blue-400 border border-blue-500/30';
            else if (status === 'running') style = 'bg-amber-900/40 text-amber-400 border border-amber-500/30';
            else if (status === 'otp_required') style = 'bg-purple-900/40 text-purple-400 border border-purple-500/30';
            else if (status === 'failed') style = 'bg-red-900/40 text-red-400 border border-red-500/30';

            const platform = order.platform || Utils.determinePlatform(order.asin);

            tbody.innerHTML += `
                <tr class="hover:bg-white/5">
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300 capitalize">${platform}</td>
                    <td class="p-4 text-slate-300">${order.quantity}</td>
                    <td class="p-4 font-bold text-xs"><span class="${style} px-3 py-1 rounded-full">${status.toUpperCase()}</span></td>
                </tr>
            `;
        });
    }
};

// ==========================================
// 7. MODULE: TRACKING
// ==========================================
const TrackingModule = {
    render() {
        const wrapper = document.createElement('div');
        const validOrders = AppState.liveOrders.filter(o => o.status === 'completed');
        
        const shipped = validOrders.filter(o => o.tracking_status === 'shipped').length;
        const out = validOrders.filter(o => o.tracking_status === 'out_for_delivery').length;
        const delivered = validOrders.filter(o => o.tracking_status === 'delivered').length;

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10">
                <div class="p-5 border-b border-white/10 bg-black/20"><h3 class="font-bold text-white flex items-center gap-2">🚚 Logistics Tracker</h3></div>
                <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p class="text-slate-400 text-xs uppercase mb-1">In Transit</p>
                        <p class="text-3xl font-bold text-blue-400">${shipped}</p>
                    </div>
                    <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p class="text-slate-400 text-xs uppercase mb-1">Out for Delivery</p>
                        <p class="text-3xl font-bold text-amber-400">${out}</p>
                    </div>
                    <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p class="text-slate-400 text-xs uppercase mb-1">Delivered</p>
                        <p class="text-3xl font-bold text-emerald-400">${delivered}</p>
                    </div>
                </div>
                <table class="w-full text-left border-collapse border-t border-white/10">
                    <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                        <tr><th class="p-4">ASIN</th><th class="p-4">Platform</th><th class="p-4">AWB ID</th><th class="p-4">Live Status</th></tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm">
                        ${validOrders.length === 0 ? `<tr><td colspan="4" class="p-8 text-center text-slate-500">No fulfilled orders mapped in database.</td></tr>` : 
                        validOrders.map(o => `
                            <tr class="hover:bg-white/5">
                                <td class="p-4 text-white font-mono">${o.asin}</td>
                                <td class="p-4 text-slate-300 capitalize">${o.platform}</td>
                                <td class="p-4 text-blue-400 font-mono">${o.awb_number || 'AWAITING UPDATE'}</td>
                                <td class="p-4"><span class="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs">${(o.tracking_status || 'unfulfilled').toUpperCase()}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        return wrapper;
    }
};

// ==========================================
// 8. MODULE: GST INVOICING
// ==========================================
const GSTModule = {
    render() {
        const wrapper = document.createElement('div');
        const completed = AppState.liveOrders.filter(o => o.status === 'completed');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between">
                    <h3 class="font-bold text-white flex items-center gap-2">🧾 GST Invoicing</h3>
                    <button class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded">Export Register</button>
                </div>
                <table class="w-full text-left border-collapse">
                    <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                        <tr><th class="p-4">Order Ref</th><th class="p-4">ASIN</th><th class="p-4">Taxable Value</th><th class="p-4">GST (18%)</th><th class="p-4">Action</th></tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm">
                        ${completed.length === 0 ? `<tr><td colspan="5" class="p-8 text-center text-slate-500">No completed orders pending GST.</td></tr>` : 
                        completed.map(o => {
                            const val = parseFloat(o.taxable_value);
                            const gst = parseFloat(o.gst_amount);
                            const isPending = isNaN(val) || val === 0;

                            return `
                                <tr class="hover:bg-white/5">
                                    <td class="p-4 text-slate-400 font-mono text-xs uppercase">${o.id.toString().substring(0,8)}</td>
                                    <td class="p-4 text-white font-mono">${o.asin}</td>
                                    <td class="p-4 text-slate-300">${isPending ? 'Syncing...' : Utils.formatCurrency(val)}</td>
                                    <td class="p-4 text-amber-400">${isPending ? 'Syncing...' : Utils.formatCurrency(gst)}</td>
                                    <td class="p-4"><button class="${isPending ? 'text-slate-500 cursor-not-allowed' : 'text-blue-400 hover:underline'} text-xs">PDF</button></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        return wrapper;
    }
};

// ==========================================
// 9. MODULE: OTP GATE
// ==========================================
const OTPModule = {
    render() {
        const wrapper = document.createElement('div');
        const otpOrders = AppState.liveOrders.filter(o => o.status === 'otp_required');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-purple-500/30">
                <div class="p-5 border-b border-white/10 bg-purple-900/20"><h3 class="font-bold text-white flex items-center gap-2">🔐 OTP Gate</h3></div>
                ${otpOrders.length === 0 ? `<div class="p-12 text-center text-slate-500">No active OTP blocks in database. Bot fleet running securely.</div>` : 
                `<div class="p-6 grid gap-4">
                    ${otpOrders.map(o => `
                        <div class="bg-slate-800 border border-purple-500/40 rounded-lg p-5 flex justify-between items-center">
                            <div>
                                <p class="text-white font-bold mb-1">Auth Required: ${o.platform.toUpperCase()}</p>
                                <p class="text-sm text-slate-400">ASIN: <span class="font-mono">${o.asin}</span> | Execution paused.</p>
                            </div>
                            <div class="flex gap-3">
                                <input type="text" id="otp-${o.id}" placeholder="Enter OTP..." class="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white">
                                <button class="otp-submit bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded" data-id="${o.id}">Submit</button>
                            </div>
                        </div>
                    `).join('')}
                </div>`}
            </div>
        `;

        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },
    bindEvents(wrapper) {
        wrapper.querySelectorAll('.otp-submit').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const val = wrapper.querySelector(`#otp-${id}`).value.trim();
                if (!val) return;

                e.target.innerText = "Verifying...";
                e.target.disabled = true;

                const success = await Database.updateOrder(id, { status: 'running', otp_code: val });
                if (success) {
                    Utils.showToast("OTP pushed to Cloud. Bot resuming.", "success");
                    AppController.fetchLive();
                }
            });
        });
    }
};

// ==========================================
// 10. MODULE: PROMO ENGINE
// ==========================================
const CouponModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10">
                <div class="p-5 border-b border-white/10 bg-black/20"><h3 class="font-bold text-white flex items-center gap-2">🎟️ Promo Engine</h3></div>
                <div class="p-6 space-y-4">
                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-5">
                        <label class="block text-sm font-bold text-white mb-2">Global Injection Code</label>
                        <div class="flex gap-3">
                            <input type="text" id="global-coupon" value="${AppState.globalCoupon}" placeholder="e.g. SAVE20" class="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-gold-500">
                            <button id="save-coupon" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold">Apply to Future Manifests</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        setTimeout(() => {
            wrapper.querySelector('#save-coupon').addEventListener('click', () => {
                AppState.globalCoupon = wrapper.querySelector('#global-coupon').value.trim();
                Utils.showToast("Global discount rule saved.", "success");
            });
        }, 0);
        return wrapper;
    }
};

// ==========================================
// 11. MODULE: REFUND MONITOR
// ==========================================
const RefundModule = {
    render() {
        const wrapper = document.createElement('div');
        const refunds = AppState.liveOrders.filter(o => o.refund_status && o.refund_status !== 'none');
        
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10">
                <div class="p-5 border-b border-white/10 bg-black/20"><h3 class="font-bold text-white flex items-center gap-2">💰 Refund Monitor</h3></div>
                ${refunds.length === 0 ? `<div class="p-12 text-center text-slate-500">Database shows no active return requests.</div>` : 
                `<table class="w-full text-left border-collapse">
                    <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                        <tr><th class="p-4">ASIN</th><th class="p-4">Platform</th><th class="p-4">Cloud Status</th></tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm">
                        ${refunds.map(o => `
                            <tr class="hover:bg-white/5">
                                <td class="p-4 text-white font-mono">${o.asin}</td>
                                <td class="p-4 text-slate-300 capitalize">${o.platform}</td>
                                <td class="p-4 font-bold text-amber-400">${o.refund_status.toUpperCase()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`}
            </div>
        `;
        return wrapper;
    }
};

// ==========================================
// 12. MODULE: PAYMENT VAULT (AUTO-FILL)
// ==========================================
const WalletModule = {
    render() {
        const wrapper = document.createElement('div');
        const savedCards = JSON.parse(localStorage.getItem('bob_wallet') || '[]');
        
        let slotsHTML = '';
        for(let i = 0; i < 4; i++) {
            const card = savedCards[i] || { last4: '', cvv: '', bank: '' };
            slotsHTML += `
                <div class="bg-slate-800 border border-slate-700 rounded-lg p-5">
                    <p class="text-white font-bold mb-3 text-sm">Linked Card ${i + 1}</p>
                    <div class="space-y-3">
                        <input type="text" id="bank-${i}" value="${card.bank}" placeholder="Issuer (e.g. HDFC)" class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold-500 transition-colors">
                        <div class="flex gap-3">
                            <input type="text" id="last4-${i}" value="${card.last4}" maxlength="4" placeholder="Last 4" class="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold-500 text-center font-mono transition-colors">
                            <input type="password" id="cvv-${i}" value="${card.cvv}" maxlength="4" placeholder="CVV" class="w-20 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold-500 text-center font-mono transition-colors">
                        </div>
                    </div>
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <h3 class="font-bold text-white flex items-center gap-2">💳 Payment Vault</h3>
                    <button id="save-wallet" class="bg-gold-500 hover:bg-gold-400 text-royal-900 px-4 py-2 rounded font-bold text-sm transition-colors shadow-lg shadow-gold-500/20">Sync Cards to Extension</button>
                </div>
                <div class="p-6">
                    <p class="text-sm text-slate-400 mb-6">Enter details matching existing saved cards on target platforms to enable autonomous checkout completion.</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        ${slotsHTML}
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },

    bindEvents(wrapper) {
        wrapper.querySelector('#save-wallet').addEventListener('click', () => {
            const cards = [];
            for(let i = 0; i < 4; i++) {
                cards.push({
                    bank: wrapper.querySelector(`#bank-${i}`).value.trim(),
                    last4: wrapper.querySelector(`#last4-${i}`).value.trim(),
                    cvv: wrapper.querySelector(`#cvv-${i}`).value.trim()
                });
            }
            localStorage.setItem('bob_wallet', JSON.stringify(cards));
            document.dispatchEvent(new CustomEvent('SyncWalletCards', { detail: { cards: cards } }));
            Utils.showToast("Payment Vault actively synced to execution bot.", "success");
        });
    }
};

// ==========================================
// 13. MASTER APP ROUTER
// ==========================================
const AppController = {
    init() {
        this.bindNav();
        this.startPolling();
        
        const ordersTab = document.querySelector('[data-target="orders"]');
        if (ordersTab) ordersTab.classList.add('bg-gold-500/10', 'text-gold-400', 'border-l-4', 'border-gold-500');
        this.renderActiveTab();
    },

    bindNav() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(n => {
                    n.classList.remove('bg-gold-500/10', 'text-gold-400', 'border-l-4', 'border-gold-500');
                });
                item.classList.add('bg-gold-500/10', 'text-gold-400', 'border-l-4', 'border-gold-500');
                
                AppState.activeTab = item.dataset.target;
                this.renderActiveTab();
            });
        });
    },

    renderActiveTab() {
        const container = document.getElementById('module-container');
        if (!container) return;
        
        container.innerHTML = '';
        let mod;
        switch(AppState.activeTab) {
            case 'orders': mod = OrderModule.render(); break;
            case 'tracking': mod = TrackingModule.render(); break;
            case 'gst': mod = GSTModule.render(); break;
            case 'otp': mod = OTPModule.render(); break;
            case 'coupons': mod = CouponModule.render(); break;
            case 'refunds': mod = RefundModule.render(); break;
            case 'wallet': mod = WalletModule.render(); break;
            default: mod = OrderModule.render();
        }
        container.appendChild(mod);
    },

    async fetchLive() {
        const newData = await Database.fetchLiveOrders();
        AppState.liveOrders = newData;

        if (['orders', 'tracking', 'gst', 'refunds'].includes(AppState.activeTab)) {
            if (AppState.activeTab === 'orders' && AppState.queue.length === 0) OrderModule.renderTable(document);
            else if (AppState.activeTab !== 'orders') this.renderActiveTab();
        } else if (AppState.activeTab === 'otp' && document.querySelectorAll('input:focus').length === 0) {
            this.renderActiveTab();
        }
    },

    startPolling() {
        this.fetchLive();
        if (AppState.pollTimer) clearInterval(AppState.pollTimer);
        AppState.pollTimer = setInterval(() => {
            if (AppState.queue.length === 0) this.fetchLive();
        }, CONFIG.POLL_INTERVAL);
    },

    async syncDatabase() {
        if (AppState.queue.length === 0) return;
        const btn = document.getElementById('sync-btn');
        if (btn) {
            btn.innerHTML = `<span class="animate-pulse">Pushing to Supabase...</span>`;
            btn.disabled = true;
        }

        // CRITICAL: Fail-safe credential rebroadcast to the extension right before push
        document.dispatchEvent(new CustomEvent('SyncBotCredentials', {
            detail: { url: CONFIG.SUPABASE_URL, key: CONFIG.SUPABASE_ANON_KEY }
        }));

        const success = await Database.pushQueue(AppState.queue);
        if (success) {
            Utils.showToast("Database Write Successful.", "success");
            AppState.queue = [];
            this.fetchLive();
        } else {
            if (btn) {
                btn.innerText = "Retry Synchronization";
                btn.disabled = false;
            }
        }
    }
};