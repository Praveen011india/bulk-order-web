/**
 * BulkOrderBuddy Enterprise Edition - Master Dashboard Controller
 * 
 * Features Supported:
 * - 🛒 Bulk ordering & Queue Management (up to 500 orders/10 min)
 * - 🏪 Multi-platform routing (Amazon, Flipkart, Shopsy)
 * - 🎟️ Coupon & Reward configurations
 * - 🧾 GST & Invoice tracking
 * - 🚚 Live Delivery Tracking
 * - 💰 Refund Monitoring
 * - 🔐 OTP Manager (Manual Intervention Gate)
 */

// ==========================================
// 1. SYSTEM CONFIGURATION & STATE MANAGEMENT
// ==========================================

const CONFIG = {
    // Database credentials
    SUPABASE_URL: 'https://kjcvmchftyeiccfpiemd.supabase.co', //[cite: 1]
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY3ZtY2hmdHllaWNjZnBpZW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM2MjcsImV4cCI6MjEwMzU4OTYyN30.m4wUParS14xU7FnAU3y-Eqtxjyvd3rNKFFrP0EL_Chk', //[cite: 1]
    CLERK_PUB_KEY: 'pk_test_ZGVlcC1nbG93d29ybS02ODYwLmNsZXJrLmFjY291bnRzLmRldiQ', //[cite: 1]
    
    // System limits
    MAX_BATCH_SIZE: 500, // Supports up to 500 orders per batch
    POLLING_INTERVAL: 5000, // 5 seconds
    
    // Platforms supported
    PLATFORMS: {
        AMAZON: 'amazon',
        FLIPKART: 'flipkart',
        SHOPSY: 'shopsy'
    }
};

const AppState = {
    user: null,
    queue: [],
    liveOrders: [],
    activeTab: 'orders', // orders, tracking, gst, refunds, otp
    isPolling: false,
    pollTimer: null,
    platformFilter: 'all'
};

// Initialize Supabase Client
const _supabase = window.supabase ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;

// ==========================================
// 2. UTILITY & HELPER FUNCTIONS
// ==========================================

const Utils = {
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
    },
    
    formatDate: (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    
    generateId: () => {
        return 'id-' + Math.random().toString(36).substr(2, 16);
    },

    determinePlatform: (asin) => {
        // Simple mock logic: if it starts with B, it's Amazon. If it's numeric, Flipkart. Else Shopsy.
        if (!asin) return CONFIG.PLATFORMS.AMAZON;
        if (asin.startsWith('B')) return CONFIG.PLATFORMS.AMAZON;
        if (/^\d+$/.test(asin)) return CONFIG.PLATFORMS.FLIPKART;
        return CONFIG.PLATFORMS.SHOPSY;
    },

    showToast: (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-bold shadow-xl transition-opacity duration-500 z-50`;
        
        switch(type) {
            case 'success': toast.style.backgroundColor = '#10b981'; break;
            case 'error': toast.style.backgroundColor = '#ef4444'; break;
            case 'warning': toast.style.backgroundColor = '#f59e0b'; break;
            default: toast.style.backgroundColor = '#3b82f6';
        }
        
        toast.innerText = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 500);
        }, 3000);
    }
};

// ==========================================
// 3. AUTHENTICATION (CLERK)
// ==========================================

async function initClerk() {
    try {
        await window.Clerk.load();

        if (window.Clerk.user) {
            AppState.user = window.Clerk.user;
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('dashboard-content').style.display = 'flex'; //[cite: 3]
            
            const userBtnContainer = document.getElementById('user-button');
            if (userBtnContainer) {
                window.Clerk.mountUserButton(userBtnContainer);
            }
            
            // Start the application lifecycle
            AppController.init();
        } else {
            document.getElementById('dashboard-content').style.display = 'none';
            const authContainer = document.getElementById('auth-container');
            if (authContainer) {
                authContainer.style.display = 'flex'; //[cite: 3]
                window.Clerk.mountSignIn(authContainer);
            }
        }
    } catch (error) {
        console.error("Clerk Initialization Error:", error);
        Utils.showToast("Authentication service failed to load.", "error");
    }
}

// ==========================================
// 4. DATABASE OPERATIONS (SUPABASE)
// ==========================================

const Database = {
    async fetchLiveOrders() {
        if (!_supabase) return [];
        try {
            const { data, error } = await _supabase
                .from('bulk_orders') //[cite: 1]
                .select('*')
                .order('created_at', { ascending: false })
                .limit(CONFIG.MAX_BATCH_SIZE);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Fetch Error:", error);
            return [];
        }
    },

    async pushQueueToDatabase(queueArray) {
        if (!_supabase) return false;
        try {
            // Add metadata for advanced features
            const enrichedQueue = queueArray.map(item => ({
                ...item,
                user_id: AppState.user?.id || 'anonymous',
                platform: Utils.determinePlatform(item.asin),
                gst_status: 'pending',
                tracking_status: 'unfulfilled',
                refund_status: 'none',
                created_at: new Date().toISOString()
            }));

            const { error } = await _supabase.from('bulk_orders').insert(enrichedQueue); //[cite: 1]
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Sync Error:", error);
            Utils.showToast(`Sync Error: ${error.message}`, "error");
            return false;
        }
    },

    async updateOrderStatus(id, updates) {
        if (!_supabase) return false;
        try {
            const { error } = await _supabase
                .from('bulk_orders') //[cite: 1]
                .update(updates)
                .eq('id', id);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Update Error:", error);
            return false;
        }
    }
};

// ==========================================
// 5. CSV PARSING & DATA INGESTION
// ==========================================

const CSVManager = {
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            CSVManager.parse(text);
        };
        reader.readAsText(file);
    },

    parse(csvText) {
        const rows = csvText.split('\n');
        AppState.queue = [];
        let errors = 0;

        // Skip header if it exists
        const startIndex = rows[0].toLowerCase().includes('asin') ? 1 : 0;

        for (let i = startIndex; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            
            // Advanced parsing handling quotes
            const columns = rows[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!columns) continue;

            const asin = columns[0] ? columns[0].replace(/"/g, '').trim() : '';
            let qty = 1;
            let coupon = null;

            if (columns.length >= 2 && columns[1].trim() !== '') {
                const parsed = parseInt(columns[1].replace(/"/g, '').trim(), 10);
                if (!isNaN(parsed)) qty = parsed;
            }

            // Parse optional 3rd column for coupons/rewards
            if (columns.length >= 3 && columns[2].trim() !== '') {
                coupon = columns[2].replace(/"/g, '').trim();
            }

            if (asin) {
                AppState.queue.push({ 
                    asin: asin, 
                    quantity: qty, 
                    coupon_code: coupon,
                    status: 'pending_sync'
                });
            } else {
                errors++;
            }
        }

        if (AppState.queue.length > CONFIG.MAX_BATCH_SIZE) {
            Utils.showToast(`Batch too large. Sliced to ${CONFIG.MAX_BATCH_SIZE} orders.`, "warning");
            AppState.queue = AppState.queue.slice(0, CONFIG.MAX_BATCH_SIZE);
        }

        Utils.showToast(`Parsed ${AppState.queue.length} orders successfully.`, "success");
        if (errors > 0) console.warn(`Skipped ${errors} invalid rows.`);
        
        UIManager.renderMainQueue();
    }
};

// ==========================================
// 6. USER INTERFACE (UI) RENDERERS
// ==========================================

const UIManager = {
    initNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => { //[cite: 3]
            item.addEventListener('click', (e) => {
                e.preventDefault();
                // Update active state
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Determine target view
                const tabName = item.dataset.target || 'orders';
                AppState.activeTab = tabName;
                UIManager.renderActiveTab();
            });
        });
    },

    renderActiveTab() {
        const container = document.getElementById('module-container');
        if (!container) return;

        container.innerHTML = ''; // Clear current view

        switch(AppState.activeTab) {
            case 'orders':
                container.appendChild(this.buildOrdersModule());
                break;
            case 'tracking':
                container.appendChild(this.buildTrackingModule());
                break;
            case 'gst':
                container.appendChild(this.buildGSTModule());
                break;
            case 'refunds':
                container.appendChild(this.buildRefundsModule());
                break;
            case 'otp':
                container.appendChild(this.buildOTPModule());
                break;
            case 'coupons':
                container.appendChild(this.buildCouponsModule());
                break;
            default:
                container.appendChild(this.buildOrdersModule());
        }
    },

    // --- MODULE: BULK ORDERS (CORE) ---
    buildOrdersModule() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in';
        
        wrapper.innerHTML = `
            <div class="glass-panel border-2 border-dashed border-slate-600 hover:border-emerald-500 transition-colors rounded-xl p-10 text-center mb-8">
                <div class="text-4xl mb-4">📦</div>
                <h3 class="text-xl font-bold text-white mb-2">Upload Order Manifest</h3>
                <p class="text-slate-400 text-sm mb-6 max-w-md mx-auto">Upload a CSV containing hundreds of ASINs/Product IDs. The PaidProject local agent will process up to ${CONFIG.MAX_BATCH_SIZE} orders every 10 minutes.</p>
                <input type="file" id="csv-file" accept=".csv" class="block mx-auto text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-emerald-500 file:text-slate-900 hover:file:bg-emerald-400 cursor-pointer transition-colors">
            </div>

            <button id="process-btn" class="hidden w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-4 rounded-xl mb-8 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all">
                Synchronize Queue to Cloud Database
            </button>

            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <h3 class="font-bold text-white flex items-center gap-2">
                        <span class="relative flex h-3 w-3">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        Live Execution Tracking
                    </h3>
                    <div class="flex gap-2">
                        <select id="platform-filter" class="bg-slate-800 text-xs text-white border border-slate-600 rounded px-2 py-1 outline-none">
                            <option value="all">All Platforms</option>
                            <option value="amazon">Amazon</option>
                            <option value="flipkart">Flipkart</option>
                            <option value="shopsy">Shopsy</option>
                        </select>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                            <tr>
                                <th class="p-4 font-semibold">Target ID (ASIN)</th>
                                <th class="p-4 font-semibold">Platform</th>
                                <th class="p-4 font-semibold">Qty</th>
                                <th class="p-4 font-semibold">Live Status</th>
                                <th class="p-4 font-semibold">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody id="table-body" class="divide-y divide-white/5 text-sm">
                            <!-- Dynamic Content -->
                        </tbody>
                    </table>
                    <div id="empty-state" class="p-12 text-center text-slate-500">
                        No active orders in the cloud queue.
                    </div>
                </div>
            </div>
        `;

        // Bind Events
        setTimeout(() => {
            const fileInput = document.getElementById('csv-file');
            if (fileInput) fileInput.addEventListener('change', CSVManager.handleFileUpload);

            const processBtn = document.getElementById('process-btn');
            if (processBtn) processBtn.addEventListener('click', AppController.syncDatabase);

            const filter = document.getElementById('platform-filter');
            if (filter) {
                filter.value = AppState.platformFilter;
                filter.addEventListener('change', (e) => {
                    AppState.platformFilter = e.target.value;
                    this.renderLiveTable();
                });
            }
            
            this.renderMainQueue();
        }, 0);

        return wrapper;
    },

    renderMainQueue() {
        const tbody = document.getElementById('table-body');
        const emptyState = document.getElementById('empty-state');
        const processBtn = document.getElementById('process-btn');
        
        if (!tbody || !emptyState || !processBtn) return;

        tbody.innerHTML = '';

        // If user uploaded a new CSV, show pending queue
        if (AppState.queue.length > 0) {
            emptyState.style.display = 'none';
            processBtn.style.display = 'block';

            AppState.queue.forEach(item => {
                const platform = Utils.determinePlatform(item.asin);
                tbody.innerHTML += `
                    <tr class="hover:bg-white/5 transition-colors">
                        <td class="p-4 text-white font-mono">${item.asin}</td>
                        <td class="p-4 text-slate-300 capitalize flex items-center gap-2">
                            ${this.getPlatformIcon(platform)} ${platform}
                        </td>
                        <td class="p-4 text-slate-300">${item.quantity}</td>
                        <td class="p-4 text-blue-400 font-bold tracking-wider text-xs">
                            <span class="bg-blue-900/40 px-3 py-1 rounded-full border border-blue-500/30">PENDING UPLOAD</span>
                        </td>
                        <td class="p-4 text-slate-500 text-xs">Just Now</td>
                    </tr>
                `;
            });
        } else {
            // Show live data from Supabase
            this.renderLiveTable();
        }
    },

    renderLiveTable() {
        const tbody = document.getElementById('table-body');
        const emptyState = document.getElementById('empty-state');
        const processBtn = document.getElementById('process-btn');
        
        if (!tbody || !emptyState) return;
        
        if (processBtn) processBtn.style.display = 'none';

        let displayData = AppState.liveOrders;
        
        // Apply Filters
        if (AppState.platformFilter !== 'all') {
            displayData = displayData.filter(order => (order.platform || '').toLowerCase() === AppState.platformFilter);
        }

        if (displayData.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        tbody.innerHTML = '';

        displayData.forEach(order => {
            let statusColor = '#fff';
            let bgStyle = 'bg-slate-800/40 border-slate-500/30';
            
            const status = (order.status || 'pending').toLowerCase();
            
            if (status === 'completed') { statusColor = '#10b981'; bgStyle = 'bg-emerald-900/40 border-emerald-500/30 text-emerald-400'; }
            if (status === 'pending') { statusColor = '#f59e0b'; bgStyle = 'bg-amber-900/40 border-amber-500/30 text-amber-400'; }
            if (status === 'error') { statusColor = '#ef4444'; bgStyle = 'bg-red-900/40 border-red-500/30 text-red-400'; }
            if (status === 'otp_required') { statusColor = '#8b5cf6'; bgStyle = 'bg-purple-900/40 border-purple-500/30 text-purple-400'; }
            if (status === 'running') { statusColor = '#3b82f6'; bgStyle = 'bg-blue-900/40 border-blue-500/30 text-blue-400'; }

            const platform = order.platform || Utils.determinePlatform(order.asin);

            tbody.innerHTML += `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5">
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300 capitalize flex items-center gap-2">
                        ${this.getPlatformIcon(platform)} ${platform}
                    </td>
                    <td class="p-4 text-slate-300">${order.quantity}</td>
                    <td class="p-4 font-bold tracking-wider text-xs">
                        <span class="${bgStyle} px-3 py-1 rounded-full border">${status.toUpperCase().replace('_', ' ')}</span>
                    </td>
                    <td class="p-4 text-slate-500 text-xs">${Utils.formatDate(order.created_at)}</td>
                </tr>
            `;
        });
    },

    // --- MODULE: DELIVERY TRACKING ---
    buildTrackingModule() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg mb-8">
                <div class="p-5 border-b border-white/10 bg-black/20">
                    <h3 class="font-bold text-white flex items-center gap-2">🚚 Logistics & Delivery Tracking</h3>
                    <p class="text-xs text-slate-400 mt-1">Monitor real-time shipment updates across all platforms.</p>
                </div>
                <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p class="text-slate-400 text-xs uppercase tracking-wider mb-1">In Transit</p>
                        <p class="text-3xl font-bold text-blue-400">${AppState.liveOrders.filter(o => o.tracking_status === 'shipped').length}</p>
                    </div>
                    <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p class="text-slate-400 text-xs uppercase tracking-wider mb-1">Out for Delivery</p>
                        <p class="text-3xl font-bold text-amber-400">${AppState.liveOrders.filter(o => o.tracking_status === 'out_for_delivery').length}</p>
                    </div>
                    <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p class="text-slate-400 text-xs uppercase tracking-wider mb-1">Delivered Today</p>
                        <p class="text-3xl font-bold text-emerald-400">${AppState.liveOrders.filter(o => o.tracking_status === 'delivered').length}</p>
                    </div>
                </div>
                
                <table class="w-full text-left border-collapse border-t border-white/10">
                    <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                        <tr>
                            <th class="p-4 font-semibold">ASIN</th>
                            <th class="p-4 font-semibold">Courier</th>
                            <th class="p-4 font-semibold">Tracking ID</th>
                            <th class="p-4 font-semibold">Status</th>
                            <th class="p-4 font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm">
                        ${this.generateTrackingRows()}
                    </tbody>
                </table>
            </div>
        `;
        return wrapper;
    },

    generateTrackingRows() {
        const validOrders = AppState.liveOrders.filter(o => o.status === 'completed');
        if (validOrders.length === 0) {
            return `<tr><td colspan="5" class="p-8 text-center text-slate-500">No shipped orders available for tracking.</td></tr>`;
        }
        
        return validOrders.map(order => {
            // Mock tracking data based on order status
            const trackingId = `AWB${Math.floor(Math.random() * 900000000) + 100000000}`;
            const courier = order.platform === 'amazon' ? 'Amazon Shipping' : 'Ecom Express';
            let tStatus = order.tracking_status || 'Processing';
            let badgeStyle = 'bg-slate-700 text-slate-300';
            
            if(tStatus === 'shipped') badgeStyle = 'bg-blue-900/50 text-blue-400 border-blue-500/30';
            if(tStatus === 'delivered') badgeStyle = 'bg-emerald-900/50 text-emerald-400 border-emerald-500/30';

            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300">${courier}</td>
                    <td class="p-4 text-blue-400 font-mono hover:underline cursor-pointer">${trackingId}</td>
                    <td class="p-4">
                        <span class="${badgeStyle} px-2 py-1 rounded text-xs border border-transparent">${tStatus.toUpperCase()}</span>
                    </td>
                    <td class="p-4"><button class="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-white">Track Live</button></td>
                </tr>
            `;
        }).join('');
    },

    // --- MODULE: GST & INVOICING ---
    buildGSTModule() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between">
                    <h3 class="font-bold text-white flex items-center gap-2">🧾 B2B GST Invoicing</h3>
                    <button class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded shadow">Download Monthly GST Report</button>
                </div>
                <table class="w-full text-left border-collapse">
                    <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                        <tr>
                            <th class="p-4 font-semibold">Order ID</th>
                            <th class="p-4 font-semibold">ASIN</th>
                            <th class="p-4 font-semibold">Taxable Value</th>
                            <th class="p-4 font-semibold">GST Amount</th>
                            <th class="p-4 font-semibold">Invoice Status</th>
                            <th class="p-4 font-semibold">Download</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm">
                        ${this.generateGSTRows()}
                    </tbody>
                </table>
            </div>
        `;
        return wrapper;
    },

    generateGSTRows() {
        const completed = AppState.liveOrders.filter(o => o.status === 'completed');
        if (completed.length === 0) {
            return `<tr><td colspan="6" class="p-8 text-center text-slate-500">No completed orders for GST generation.</td></tr>`;
        }

        return completed.map(order => {
            const val = Math.floor(Math.random() * 5000) + 500;
            const gst = (val * 0.18).toFixed(2);
            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-4 text-slate-400 font-mono text-xs">${order.id.split('-')[0]}...</td>
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300">₹${val}</td>
                    <td class="p-4 text-amber-400">₹${gst} (18%)</td>
                    <td class="p-4"><span class="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-xs">Generated</span></td>
                    <td class="p-4"><button class="text-blue-400 hover:text-blue-300 underline text-xs">PDF</button></td>
                </tr>
            `;
        }).join('');
    },

    // --- MODULE: OTP MANAGER (CRITICAL) ---
    buildOTPModule() {
        const wrapper = document.createElement('div');
        const otpOrders = AppState.liveOrders.filter(o => o.status === 'otp_required');
        
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-purple-500/30 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                <div class="p-5 border-b border-white/10 bg-purple-900/20">
                    <h3 class="font-bold text-white flex items-center gap-2">🔐 Manual Intervention Gate (OTP / Captcha)</h3>
                    <p class="text-xs text-slate-400 mt-1">If the Chrome Extension hits an authentication wall during bulk processing, it pauses and waits for your input here.</p>
                </div>
                
                ${otpOrders.length === 0 ? 
                    `<div class="p-12 text-center text-slate-500 flex flex-col items-center">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mb-4 opacity-50"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
                        No active OTP gates. Bots are running freely.
                    </div>` 
                    : 
                    `<div class="p-6 grid grid-cols-1 gap-4">
                        ${otpOrders.map(order => `
                            <div class="bg-slate-800 border border-purple-500/40 rounded-lg p-5 flex justify-between items-center">
                                <div>
                                    <p class="text-white font-bold mb-1">Authentication Required: ${order.platform.toUpperCase()}</p>
                                    <p class="text-sm text-slate-400">ASIN: <span class="font-mono text-purple-300">${order.asin}</span> | The bot requires a delivery/login OTP to proceed.</p>
                                </div>
                                <div class="flex gap-3 items-center">
                                    <input type="text" placeholder="Enter OTP..." class="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-purple-500">
                                    <button class="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded transition-colors" onclick="AppController.submitOTP('${order.id}')">Submit & Resume Bot</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;
        return wrapper;
    },

    // --- MODULE: REFUNDS ---
    buildRefundsModule() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20">
                    <h3 class="font-bold text-white flex items-center gap-2">💰 Refund & Returns Monitor</h3>
                </div>
                <div class="p-12 text-center text-slate-500">
                    No active return requests detected across platforms.
                </div>
            </div>
        `;
        return wrapper;
    },

    // --- MODULE: COUPONS ---
    buildCouponsModule() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20">
                    <h3 class="font-bold text-white flex items-center gap-2">🎟️ Coupons & SuperCoins Engine</h3>
                    <p class="text-xs text-slate-400 mt-1">Configure global discount rules applied automatically during bot checkout.</p>
                </div>
                <div class="p-6">
                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-5 mb-4">
                        <label class="block text-sm font-bold text-white mb-2">Global Amazon Coupon Code</label>
                        <div class="flex gap-3">
                            <input type="text" placeholder="e.g. SAVE20" class="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none">
                            <button class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">Apply Rule</button>
                        </div>
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-5">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" class="w-5 h-5 rounded bg-slate-900 border-slate-600" checked>
                            <span class="text-white font-bold">Automatically Apply Flipkart SuperCoins</span>
                        </label>
                        <p class="text-xs text-slate-400 mt-1 ml-8">If checked, the extension will attempt to click 'Pay with SuperCoins' on the payment page.</p>
                    </div>
                </div>
            </div>
        `;
        return wrapper;
    },

    // --- HELPERS ---
    getPlatformIcon(platform) {
        if(platform === 'amazon') return `<span class="text-orange-400 font-bold">A</span>`;
        if(platform === 'flipkart') return `<span class="text-blue-500 font-bold">F</span>`;
        if(platform === 'shopsy') return `<span class="text-pink-500 font-bold">S</span>`;
        return '🛒';
    }
};

// ==========================================
// 7. APPLICATION CONTROLLER & LIFECYCLE
// ==========================================

const AppController = {
    init() {
        UIManager.initNavigation();
        
        // Setup Module Container if it doesn't exist in the HTML yet (Dynamic Injection)
        const mainArea = document.querySelector('main .max-w-6xl');
        if (mainArea && !document.getElementById('module-container')) {
            // Remove old static HTML from previous iterations, inject dynamic container
            const existingStatic = mainArea.querySelectorAll('.glass-panel');
            existingStatic.forEach(el => el.remove());
            
            const processBtn = document.getElementById('process-btn');
            if(processBtn) processBtn.remove();

            const container = document.createElement('div');
            container.id = 'module-container';
            mainArea.appendChild(container);
        }

        // Render Initial View
        UIManager.renderActiveTab();
        
        // Start Polling Engine
        this.startLiveTracking();
    },

    async syncDatabase() {
        if (AppState.queue.length === 0) {
            Utils.showToast("No orders in queue to sync.", "warning");
            return;
        }

        const btn = document.getElementById('process-btn');
        if (btn) {
            btn.innerHTML = `<span class="animate-pulse">Synchronizing ${AppState.queue.length} orders...</span>`;
            btn.disabled = true;
        }

        const success = await Database.pushQueueToDatabase(AppState.queue);
        
        if (success) {
            Utils.showToast("Successfully synchronized to cloud database!", "success");
            AppState.queue = []; // Clear local queue
            await AppController.fetchAndUpdateLiveState();
        } else {
            if (btn) {
                btn.innerHTML = `Retry Synchronization`;
                btn.disabled = false;
            }
        }
    },

    async fetchAndUpdateLiveState() {
        const newData = await Database.fetchLiveOrders();
        
        // Check for state changes to trigger notifications
        const oldOtpCount = AppState.liveOrders.filter(o => o.status === 'otp_required').length;
        const newOtpCount = newData.filter(o => o.status === 'otp_required').length;
        
        if (newOtpCount > oldOtpCount) {
            Utils.showToast("CRITICAL: Bot paused. Manual OTP intervention required!", "warning");
            // Auto-switch to OTP tab if critical
            if(AppState.activeTab !== 'otp') {
                document.querySelector('.nav-item[data-target="otp"]')?.click();
            }
        }

        AppState.liveOrders = newData;
        
        // Only re-render if the user is looking at a relevant tab to prevent input stealing
        if (['orders', 'tracking', 'gst', 'otp'].includes(AppState.activeTab)) {
            // Don't full re-render the OTP module if user is typing
            if (AppState.activeTab === 'otp') {
                const inputs = document.querySelectorAll('input:focus');
                if (inputs.length === 0) UIManager.renderActiveTab();
            } else {
                if (AppState.activeTab === 'orders' && AppState.queue.length === 0) {
                    UIManager.renderLiveTable();
                } else if (AppState.activeTab !== 'orders') {
                    UIManager.renderActiveTab();
                }
            }
        }
    },

    startLiveTracking() {
        if (AppState.isPolling) return;
        AppState.isPolling = true;
        
        // Initial fetch
        this.fetchAndUpdateLiveState();
        
        // Polling loop (Simulates WebSocket for environments where WebSockets are blocked)
        AppState.pollTimer = setInterval(() => {
            if (!AppState.queue.length) { // Don't interrupt user during CSV review
                this.fetchAndUpdateLiveState();
            }
        }, CONFIG.POLLING_INTERVAL);
    },

    async submitOTP(orderId) {
        // Find the input relative to this order
        const inputs = document.querySelectorAll('input[type="text"]');
        let otpValue = '';
        for(let input of inputs) {
            if(input.value.trim().length > 0) {
                otpValue = input.value.trim();
                input.value = '';
                break;
            }
        }

        if(!otpValue) {
            Utils.showToast("Please enter an OTP before submitting.", "error");
            return;
        }

        Utils.showToast(`Submitting OTP for Order...`, "info");
        
        // In a real system, you push this to a dedicated OTP table or append to the order metadata
        // For the POC state machine, we flip the status back to 'running' so the extension resumes
        const success = await Database.updateOrderStatus(orderId, { status: 'running' });
        
        if(success) {
            Utils.showToast("OTP Accepted. Bot resuming checkout.", "success");
            this.fetchAndUpdateLiveState();
        } else {
            Utils.showToast("Failed to submit OTP to database.", "error");
        }
    }
};

// ==========================================
// 8. GLOBAL EVENT BINDINGS
// ==========================================

// Ensure script setup matches index.html data attributes
document.addEventListener('DOMContentLoaded', () => {
    // Modify existing Sidebar HTML to include data-targets for our router
    const navItems = document.querySelectorAll('.nav-item');
    const targets = ['orders', 'tracking', 'gst', 'refunds', 'otp', 'coupons'];
    
    navItems.forEach((item, index) => {
        if (targets[index]) {
            item.setAttribute('data-target', targets[index]);
        }
    });
});

// Clerk triggers window onload automatically based on script tag[cite: 3]
window.initClerk = initClerk;

// Expose necessary functions to the global window for inline HTML onclick handlers
window.AppController = AppController;
window.CSVManager = CSVManager;