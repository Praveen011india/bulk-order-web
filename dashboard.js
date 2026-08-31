/**
 * BulkOrderBuddy Enterprise Edition - Master Dashboard Controller
 * 
 * Features Supported:
 * - 🛒 Bulk ordering & Queue Management (up to 500 orders)
 * - 🏪 Multi-platform routing (Amazon, Flipkart, Shopsy)
 * - 🎟️ Coupon & Reward configurations
 * - 🧾 GST & Invoice tracking (Real Database Values)
 * - 🚚 Live Delivery Tracking (Real Database Values)
 * - 💰 Refund Monitoring (Real Database Values)
 * - 🔐 OTP Manager (Manual Intervention Gate)
 * - 🤖 AI Smart Order Placement (Gemini API)
 */

// ==========================================
// 1. SYSTEM CONFIGURATION & STATE
// ==========================================
const CONFIG = {
    SUPABASE_URL: 'https://kjcvmchftyeiccfpiemd.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY3ZtY2hmdHllaWNjZnBpZW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM2MjcsImV4cCI6MjEwMzU4OTYyN30.m4wUParS14xU7FnAU3y-Eqtxjyvd3rNKFFrP0EL_Chk',
    GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE', 
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
// 2. UTILITIES
// ==========================================
const Utils = {
    formatCurrency: (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0),
    formatDate: (dateString) => {
        if (!dateString) return 'Pending';
        return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    },
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
// 3. CLERK AUTHENTICATION
// ==========================================
window.addEventListener('load', async () => {
    try {
        await window.Clerk.load();
        if (window.Clerk.user) {
            AppState.user = window.Clerk.user;
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('dashboard-content').style.display = 'flex';
            window.Clerk.mountUserButton(document.getElementById('user-button'));
            AppController.init();
        } else {
            document.getElementById('dashboard-content').style.display = 'none';
            document.getElementById('auth-container').style.display = 'flex';
            window.Clerk.mountSignIn(document.getElementById('auth-container'));
        }
    } catch (err) {
        Utils.showToast("Authentication failed to load.", "error");
    }
});

// ==========================================
// 4. DATABASE ENGINE (REAL DATA)
// ==========================================
const Database = {
    async fetchLiveOrders() {
        const { data, error } = await _supabase
            .from('bulk_orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(CONFIG.MAX_BATCH);

        if (error) {
            console.error("DB Fetch Error:", error);
            return [];
        }
        return data || [];
    },

    async pushQueue(queueArray) {
        const enrichedQueue = queueArray.map(item => ({
            ...item,
            user_id: AppState.user.id,
            platform: Utils.determinePlatform(item.asin),
            status: 'pending',
            tracking_status: 'unfulfilled',
            refund_status: 'none',
            taxable_value: 0, 
            gst_amount: 0,
            coupon_code: AppState.globalCoupon || item.coupon_code,
            supercoins_enabled: AppState.useSuperCoins,
            created_at: new Date().toISOString()
        }));

        const { error } = await _supabase.from('bulk_orders').insert(enrichedQueue);
        if (error) {
            Utils.showToast(error.message, "error");
            return false;
        }
        return true;
    },

    async updateOrder(id, payload) {
        const { error } = await _supabase.from('bulk_orders').update(payload).eq('id', id);
        if (error) {
            Utils.showToast(error.message, "error");
            return false;
        }
        return true;
    }
};

// ==========================================
// 5. GEMINI AI ENGINE
// ==========================================
const GeminiAI = {
    async extractASIN(query) {
        try {
            const prompt = `Extract ONLY the 10-character Amazon ASIN, or Flipkart/Shopsy Product ID from this input. Return ONLY the alphanumeric ID. Input: ${query}`;
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await response.json();
            const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return rawOutput.trim().replace(/[^a-zA-Z0-9]/g, '');
        } catch (err) {
            console.error("Gemini AI Error:", err);
            return null;
        }
    }
};

// ==========================================
// 6. CSV PARSER
// ==========================================
const CSVManager = {
    handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => this.parse(event.target.result);
        reader.readAsText(file);
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

            if (asin) {
                AppState.queue.push({ asin, quantity: qty, coupon_code: coupon, status: 'pending_sync' });
            }
        }
        Utils.showToast(`Parsed ${AppState.queue.length} targets from manifest.`, "success");
        AppController.renderActiveTab();
    }
};

// ==========================================
// 7. MODULE: BULK ORDERS & AI
// ==========================================
const OrderModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'animate-fade-in w-full';
        
        wrapper.innerHTML = `
            <div class="glass-panel border-2 border-purple-500/30 rounded-xl p-8 mb-8 relative group">
                <div class="flex flex-col md:flex-row gap-4 items-center">
                    <div class="flex-1 w-full">
                        <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">🤖 AI Smart Order Placement</h3>
                        <p class="text-xs text-slate-400 mb-4">Paste a raw product URL or exact product name. AI extracts the correct ASIN/Product ID.</p>
                        <div class="flex gap-3">
                            <input type="text" id="ai-input" placeholder="https://amazon.in/dp/B08L5WHFT9" class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-500">
                            <input type="number" id="ai-qty" value="1" min="1" class="w-24 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-500">
                            <button id="ai-btn" class="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-lg transition-colors">Resolve</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="glass-panel border-2 border-dashed border-slate-600 hover:border-gold-500/50 transition-colors rounded-xl p-10 text-center mb-8">
                <div class="text-4xl mb-4">🛒</div>
                <h3 class="text-xl font-bold text-white mb-2">Upload Bulk Order Manifest</h3>
                <p class="text-slate-400 text-sm mb-6">Process up to ${CONFIG.MAX_BATCH} orders automatically.</p>
                <input type="file" id="csv-file" accept=".csv" class="block mx-auto text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:font-bold file:bg-gold-500 file:text-royal-900 cursor-pointer">
            </div>

            <button id="sync-btn" class="hidden w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-royal-900 font-bold py-4 rounded-xl mb-8 shadow-lg hover:-translate-y-1 transition-transform">
                Synchronize Queue to Cloud Database
            </button>

            <div class="glass-panel rounded-xl overflow-hidden shadow-lg border border-white/10">
                <div class="p-5 border-b border-white/10 bg-black/20"><h3 class="font-bold text-white">📦 Real-Time Order Management</h3></div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                            <tr>
                                <th class="p-4 font-semibold">ASIN</th>
                                <th class="p-4 font-semibold">Platform</th>
                                <th class="p-4 font-semibold">Qty</th>
                                <th class="p-4 font-semibold">Live Status</th>
                            </tr>
                        </thead>
                        <tbody id="order-tbody" class="divide-y divide-white/5 text-sm"></tbody>
                    </table>
                    <div id="order-empty" class="p-12 text-center text-slate-500 hidden">No active orders found in the database.</div>
                </div>
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
            if (status === 'completed') style = 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30';
            else if (status.includes('pending')) style = 'bg-blue-900/40 text-blue-400 border-blue-500/30';
            else if (status === 'running') style = 'bg-amber-900/40 text-amber-400 border-amber-500/30';
            else if (status === 'otp_required') style = 'bg-purple-900/40 text-purple-400 border-purple-500/30';

            const platform = order.platform || Utils.determinePlatform(order.asin);

            tbody.innerHTML += `
                <tr class="hover:bg-white/5">
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300 capitalize">${platform}</td>
                    <td class="p-4 text-slate-300">${order.quantity}</td>
                    <td class="p-4 font-bold text-xs"><span class="${style} px-3 py-1 rounded-full border">${status.toUpperCase()}</span></td>
                </tr>
            `;
        });
    }
};

// ==========================================
// 8. MODULE: TRACKING
// ==========================================
const TrackingModule = {
    render() {
        const wrapper = document.createElement('div');
        const validOrders = AppState.liveOrders.filter(o => o.status === 'completed');
        
        const shipped = validOrders.filter(o => o.tracking_status === 'shipped').length;
        const out = validOrders.filter(o => o.tracking_status === 'out_for_delivery').length;
        const delivered = validOrders.filter(o => o.tracking_status === 'delivered').length;

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20"><h3 class="font-bold text-white">🚚 Logistics & Delivery Tracking</h3></div>
                
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
                        <p class="text-slate-400 text-xs uppercase mb-1">Delivered Today</p>
                        <p class="text-3xl font-bold text-emerald-400">${delivered}</p>
                    </div>
                </div>
                
                <table class="w-full text-left border-collapse border-t border-white/10">
                    <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                        <tr><th class="p-4">ASIN</th><th class="p-4">Courier</th><th class="p-4">AWB ID</th><th class="p-4">Status</th></tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm">
                        ${validOrders.length === 0 ? `<tr><td colspan="4" class="p-8 text-center text-slate-500">No shipped orders available for tracking.</td></tr>` : 
                        validOrders.map(o => `
                            <tr class="hover:bg-white/5">
                                <td class="p-4 text-white font-mono">${o.asin}</td>
                                <td class="p-4 text-slate-300">${o.awb_number ? (o.platform==='amazon'?'Amazon Shipping':'Ecom Express') : 'Awaiting Fulfillment'}</td>
                                <td class="p-4 text-blue-400 font-mono">${o.awb_number || 'PENDING'}</td>
                                <td class="p-4"><span class="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs">${(o.tracking_status||'processing').toUpperCase()}</span></td>
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
// 9. MODULE: GST & INVOICING
// ==========================================
const GSTModule = {
    render() {
        const wrapper = document.createElement('div');
        const completed = AppState.liveOrders.filter(o => o.status === 'completed');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between">
                    <h3 class="font-bold text-white">🧾 B2B GST Invoicing</h3>
                    <button class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded shadow">Export Register</button>
                </div>
                <table class="w-full text-left border-collapse">
                    <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                        <tr><th class="p-4">Order Ref</th><th class="p-4">ASIN</th><th class="p-4">Taxable Value</th><th class="p-4">GST Amount</th><th class="p-4">Invoice</th></tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm">
                        ${completed.length === 0 ? `<tr><td colspan="5" class="p-8 text-center text-slate-500">No completed orders for GST generation.</td></tr>` : 
                        completed.map(o => `
                            <tr class="hover:bg-white/5">
                                <td class="p-4 text-slate-400 font-mono text-xs uppercase">${o.id.substring(0,8)}</td>
                                <td class="p-4 text-white font-mono">${o.asin}</td>
                                <td class="p-4 text-slate-300">${o.taxable_value > 0 ? Utils.formatCurrency(o.taxable_value) : 'Syncing...'}</td>
                                <td class="p-4 text-amber-400">${o.gst_amount > 0 ? Utils.formatCurrency(o.gst_amount) : 'Syncing...'}</td>
                                <td class="p-4"><button class="text-blue-400 underline text-xs">Download PDF</button></td>
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
// 10. MODULE: OTP MANAGER
// ==========================================
const OTPModule = {
    render() {
        const wrapper = document.createElement('div');
        const otpOrders = AppState.liveOrders.filter(o => o.status === 'otp_required');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-purple-500/30 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                <div class="p-5 border-b border-white/10 bg-purple-900/20"><h3 class="font-bold text-white">🔐 Manual Intervention Gate</h3></div>
                
                ${otpOrders.length === 0 ? 
                    `<div class="p-12 text-center text-slate-500">No active OTP gates. Bots are running freely.</div>` : 
                    `<div class="p-6 grid gap-4">
                        ${otpOrders.map(o => `
                            <div class="bg-slate-800 border border-purple-500/40 rounded-lg p-5 flex justify-between items-center shadow-lg">
                                <div>
                                    <p class="text-white font-bold mb-1">Auth Required: ${o.platform.toUpperCase()}</p>
                                    <p class="text-sm text-slate-400">ASIN: <span class="font-mono">${o.asin}</span> | Enter OTP to resume.</p>
                                </div>
                                <div class="flex gap-3">
                                    <input type="text" id="otp-${o.id}" placeholder="Enter OTP..." class="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none">
                                    <button class="otp-submit bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded" data-id="${o.id}">Submit</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
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
                if (!val) return Utils.showToast("Enter an OTP.", "error");

                e.target.innerText = "Verifying...";
                e.target.disabled = true;

                const success = await Database.updateOrder(id, { status: 'running', otp_code: val });
                if (success) {
                    Utils.showToast("OTP Accepted. Bot resuming.", "success");
                    AppController.fetchLive();
                } else {
                    e.target.innerText = "Submit";
                    e.target.disabled = false;
                }
            });
        });
    }
};

// ==========================================
// 11. MODULE: COUPONS & REWARDS
// ==========================================
const CouponModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10">
                <div class="p-5 border-b border-white/10 bg-black/20"><h3 class="font-bold text-white">🎟️ Coupons & SuperCoins Engine</h3></div>
                <div class="p-6 space-y-4">
                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-5 mb-4">
                        <label class="block text-sm font-bold text-white mb-2">Global Amazon Coupon Code</label>
                        <div class="flex gap-3">
                            <input type="text" id="global-coupon" value="${AppState.globalCoupon}" placeholder="e.g. SAVE20" class="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none">
                            <button id="save-coupon" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold">Apply Rule</button>
                        </div>
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-5">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" id="supercoin-toggle" ${AppState.useSuperCoins ? 'checked' : ''} class="w-5 h-5 rounded bg-slate-900 border-slate-600 text-emerald-500 focus:ring-emerald-500">
                            <span class="text-white font-bold">Automatically Apply Flipkart SuperCoins</span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            wrapper.querySelector('#save-coupon').addEventListener('click', () => {
                AppState.globalCoupon = wrapper.querySelector('#global-coupon').value.trim();
                Utils.showToast("Global coupon rule updated.", "success");
            });
            wrapper.querySelector('#supercoin-toggle').addEventListener('change', (e) => {
                AppState.useSuperCoins = e.target.checked;
                Utils.showToast(`SuperCoins ${AppState.useSuperCoins ? 'Enabled' : 'Disabled'}.`, "info");
            });
        }, 0);
        return wrapper;
    }
};

// ==========================================
// 12. MODULE: REFUNDS
// ==========================================
const RefundModule = {
    render() {
        const wrapper = document.createElement('div');
        const refunds = AppState.liveOrders.filter(o => o.refund_status && o.refund_status !== 'none');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10">
                <div class="p-5 border-b border-white/10 bg-black/20"><h3 class="font-bold text-white">💰 Refund Monitor</h3></div>
                ${refunds.length === 0 ? `<div class="p-12 text-center text-slate-500">No active return requests detected.</div>` : 
                `<table class="w-full text-left border-collapse">
                    <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                        <tr><th class="p-4">ASIN</th><th class="p-4">Platform</th><th class="p-4">Refund Status</th></tr>
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
// 13. MASTER CONTROLLER & ROUTER
// ==========================================
const AppController = {
    init() {
        this.bindNav();
        this.startPolling();
    },

    bindNav() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active', 'border-emerald-500', 'bg-emerald-500/10'));
                item.classList.add('active', 'border-emerald-500', 'bg-emerald-500/10');
                
                const text = item.innerText.toLowerCase();
                if (text.includes('ordering')) AppState.activeTab = 'orders';
                else if (text.includes('tracking')) AppState.activeTab = 'tracking';
                else if (text.includes('gst')) AppState.activeTab = 'gst';
                else if (text.includes('refund')) AppState.activeTab = 'refunds';
                else if (text.includes('otp')) AppState.activeTab = 'otp';
                else if (text.includes('coupon')) AppState.activeTab = 'coupons';
                
                this.renderActiveTab();
            });
        });
    },

    renderActiveTab() {
        const container = document.querySelector('main .max-w-6xl') || document.getElementById('module-container');
        if (!container) return;
        
        const existing = container.querySelectorAll('.module-fade-in, .animate-fade-in, .glass-panel');
        existing.forEach(el => el.remove());

        let moduleWrapper;
        switch(AppState.activeTab) {
            case 'orders': moduleWrapper = OrderModule.render(); break;
            case 'tracking': moduleWrapper = TrackingModule.render(); break;
            case 'gst': moduleWrapper = GSTModule.render(); break;
            case 'otp': moduleWrapper = OTPModule.render(); break;
            case 'coupons': moduleWrapper = CouponModule.render(); break;
            case 'refunds': moduleWrapper = RefundModule.render(); break;
            default: moduleWrapper = OrderModule.render();
        }

        container.appendChild(moduleWrapper);
    },

    async fetchLive() {
        const newData = await Database.fetchLiveOrders();
        
        const oldOTP = AppState.liveOrders.filter(o => o.status === 'otp_required').length;
        const newOTP = newData.filter(o => o.status === 'otp_required').length;
        if (newOTP > oldOTP) Utils.showToast("CRITICAL: Bot paused. OTP required!", "warning");

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
            btn.innerHTML = `<span class="animate-pulse">Syncing to Cloud...</span>`;
            btn.disabled = true;
        }

        const success = await Database.pushQueue(AppState.queue);
        if (success) {
            Utils.showToast("Manifest synced successfully.", "success");
            AppState.queue = [];
            this.fetchLive();
        } else {
            if (btn) {
                btn.innerText = "Retry Sync";
                btn.disabled = false;
            }
        }
    }
};

window.AppController = AppController;